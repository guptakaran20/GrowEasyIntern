import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../../config/env';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import {
  schemaInferenceResponseSchema,
  batchExtractionResponseSchema,
  type SchemaInferenceResponse,
  type BatchExtractionResponse,
} from '@importlyai/shared';
import { buildSchemaInferencePrompt } from '../../ai/prompts/schemaInferencePrompt';
import { buildRecordExtractionPrompt } from '../../ai/prompts/recordExtractionPrompt';
import { buildBatchExtractionResponseSchema } from './batchExtractionSchema';
import {
  isJsonParseError,
  logJsonParseDiagnostics,
  logMaxTokensDiagnostics,
  normalizeBatchExtraction,
  parseGeminiJsonText,
} from './geminiJson';
import { ExtractionTruncatedError, splitBatchInHalf } from './extractionErrors';
import {
  isDailyQuotaError,
  isRateLimitError,
  computeRetryDelayMs,
} from './geminiRetry';
import {
  recordExtractionRequest,
  recordGeminiRetry,
  recordInferenceRequest,
} from './geminiMetrics';
import {
  appendSourceRemark,
  type HeldBackByRow,
  mergeHeldBackIntoRecords,
  sanitizeBatchForExtraction,
  type BatchRowInput,
  type MappingInput,
} from './promptInjection';
import { normalizeSchemaInferenceResponse } from './schemaInferenceNormalize';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const schemaInferenceSchema = {
  type: SchemaType.OBJECT,
  properties: {
    mappings: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          source_column: { type: SchemaType.STRING },
          target_field: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
          reason: { type: SchemaType.STRING },
        },
        required: ['source_column', 'target_field', 'confidence', 'reason'],
      },
    },
    unmapped_columns: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    warnings: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ['mappings', 'unmapped_columns', 'warnings'],
};

const batchExtractionSchema = buildBatchExtractionResponseSchema();

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = config.batch.maxRetries,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      if (err instanceof ExtractionTruncatedError) {
        throw err;
      }

      if (isDailyQuotaError(err)) {
        throw err;
      }

      const isRetryable = isTransientError(err);

      if (!isRetryable || attempt === maxRetries) {
        logger.error(`${label} failed after ${attempt + 1} attempts`, {
          error: lastError.message,
        });
        throw lastError;
      }

      recordGeminiRetry();
      const delay = computeRetryDelayMs(
        attempt,
        err,
        config.batch.retryBaseDelayMs,
        config.batch.retryMaxDelayMs,
      );
      logger.warn(`${label} retry ${attempt + 1}/${maxRetries}`, {
        delay,
        reason: lastError.message.slice(0, 120),
      });
      await sleep(delay);
    }
  }

  throw lastError!;
}

function isTransientError(err: unknown): boolean {
  if (err instanceof ExtractionTruncatedError) return false;
  if (isDailyQuotaError(err)) return false;
  if (isRateLimitError(err)) return true;
  if (isJsonParseError(err)) return true;

  const message = (err as Error).message?.toLowerCase() ?? '';
  return (
    message.includes('timeout') ||
    message.includes('503') ||
    message.includes('500') ||
    message.includes('overloaded')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFinishReason(result: { response: { candidates?: Array<{ finishReason?: string }> } }): string | undefined {
  return result.response.candidates?.[0]?.finishReason;
}

function rowNumbers(batchRows: BatchRowInput[]): number[] {
  return batchRows.map((r) => r.row_number);
}

function finalizeExtraction(
  parsed: BatchExtractionResponse,
  heldBack: HeldBackByRow,
): BatchExtractionResponse {
  mergeHeldBackIntoRecords(parsed.records, heldBack);
  return parsed;
}

/** Deterministic fallback when a single row still pathologically fails after sanitization */
function deterministicFallbackRecord(
  row: BatchRowInput,
  heldBack: HeldBackByRow,
): BatchExtractionResponse {
  const fields: Record<string, string> = {};
  const held = heldBack.get(row.row_number);
  if (held?.length) {
    fields.crm_note = appendSourceRemark('', held);
  }

  if (process.env.NODE_ENV !== 'production') {
    logger.warn('Using deterministic extraction fallback for row', {
      sourceRowNumber: row.row_number,
    });
  }

  return {
    records: [{ row_number: row.row_number, fields }],
  };
}

export async function inferSchema(
  headers: string[],
  columnProfiles: object[],
  semanticHints: object[],
  sampleRows: object[],
): Promise<SchemaInferenceResponse> {
  const prompt = buildSchemaInferencePrompt(
    headers,
    columnProfiles,
    semanticHints,
    sampleRows,
  );

  return withRetry(async () => {
    recordInferenceRequest();
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      generationConfig: {
        temperature: config.gemini.temperature,
        maxOutputTokens: config.gemini.maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: schemaInferenceSchema,
      },
    });

    const start = Date.now();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const finishReason = getFinishReason(result);

    logger.info('Schema inference completed', {
      durationMs: Date.now() - start,
      responseLength: text.length,
      finishReason,
    });

    try {
      const parsed = parseGeminiJsonText(text);
      const normalized = normalizeSchemaInferenceResponse(parsed);
      return schemaInferenceResponseSchema.parse(normalized);
    } catch (err) {
      logJsonParseDiagnostics(text, err, finishReason);
      throw err;
    }
  }, 'Schema inference');
}

async function extractBatchOnce(
  mappings: MappingInput[],
  promptRows: BatchRowInput[],
  heldBack: HeldBackByRow,
): Promise<BatchExtractionResponse> {
  const { promptRows: sanitizedRows, heldBack: batchHeldBack } = sanitizeBatchForExtraction(
    promptRows,
    mappings,
  );
  for (const [rowNum, fields] of batchHeldBack) {
    if (!heldBack.has(rowNum)) {
      heldBack.set(rowNum, fields);
    }
  }

  const prompt = buildRecordExtractionPrompt(mappings, sanitizedRows);
  const sourceRowNumbers = rowNumbers(promptRows);

  if (process.env.NODE_ENV !== 'production') {
    logger.info('Batch extraction prompt metrics', {
      rowCount: promptRows.length,
      sourceRowNumbers,
      promptLength: prompt.length,
      compactInputLength: JSON.stringify(sanitizedRows).length,
      heldBackRowCount: batchHeldBack.size,
    });
  }

  return withRetry(async () => {
    recordExtractionRequest();
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      generationConfig: {
        temperature: config.gemini.temperature,
        maxOutputTokens: config.gemini.maxOutputTokensExtraction,
        responseMimeType: 'application/json',
        responseSchema: batchExtractionSchema,
      },
    });

    const start = Date.now();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const finishReason = getFinishReason(result);

    logger.info('Batch extraction completed', {
      durationMs: Date.now() - start,
      rowCount: promptRows.length,
      sourceRowNumbers,
      responseLength: text.length,
      finishReason,
    });

    if (finishReason === 'MAX_TOKENS') {
      logMaxTokensDiagnostics(text, finishReason, sourceRowNumbers);
      logger.warn('Batch extraction truncated by token limit', {
        rowCount: promptRows.length,
        sourceRowNumbers,
        responseLength: text.length,
        finishReason,
      });
      throw new ExtractionTruncatedError(
        finishReason,
        text.length,
        sourceRowNumbers,
        text,
      );
    }

    try {
      const parsed = parseGeminiJsonText(text);
      const normalized = normalizeBatchExtraction(parsed);
      const validated = batchExtractionResponseSchema.parse(normalized);
      return finalizeExtraction(validated, heldBack);
    } catch (err) {
      logJsonParseDiagnostics(text, err, finishReason, sourceRowNumbers);
      throw err;
    }
  }, 'Batch extraction');
}

async function extractBatchRecursive(
  mappings: MappingInput[],
  batchRows: BatchRowInput[],
  heldBack: HeldBackByRow,
): Promise<BatchExtractionResponse> {
  if (batchRows.length === 0) return { records: [] };

  try {
    const result = await extractBatchOnce(mappings, batchRows, heldBack);

    const requestedRows = new Set(batchRows.map((r) => r.row_number));
    const uniqueRecords = [];
    const seen = new Set<number>();

    for (const rec of result.records) {
      if (requestedRows.has(rec.row_number) && !seen.has(rec.row_number)) {
        seen.add(rec.row_number);
        uniqueRecords.push(rec);
      }
    }

    if (uniqueRecords.length === batchRows.length) {
      return { records: uniqueRecords };
    }

    if (uniqueRecords.length === 0) {
      throw new ExtractionTruncatedError(
        'ZERO_PROGRESS',
        0,
        rowNumbers(batchRows),
        'AI failed to extract any requested rows (hallucination loop)',
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.warn('AI silently dropped rows, recursively extracting the remainder', {
        expected: batchRows.length,
        extracted: uniqueRecords.length,
      });
    }

    const missingRows = batchRows.filter((r) => !seen.has(r.row_number));
    const missingResult = await extractBatchRecursive(mappings, missingRows, heldBack);

    return { records: [...uniqueRecords, ...missingResult.records] };
  } catch (err) {
    if (err instanceof ExtractionTruncatedError && batchRows.length > 1) {
      const [first, second] = splitBatchInHalf(batchRows);
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Splitting batch into smaller sub-batches', {
          originalRowCount: batchRows.length,
          sourceRowNumbers: rowNumbers(batchRows),
          firstHalf: rowNumbers(first),
          secondHalf: rowNumbers(second),
          reason: err.finishReason,
        });
      }
      const r1 = await extractBatchRecursive(mappings, first, heldBack);
      const r2 = await extractBatchRecursive(mappings, second, heldBack);
      return { records: [...r1.records, ...r2.records] };
    }

    if (err instanceof ExtractionTruncatedError && batchRows.length === 1) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Single-row MAX_TOKENS — using deterministic fallback', {
          sourceRowNumber: batchRows[0].row_number,
          responseLength: err.responseLength,
          finishReason: err.finishReason,
        });
      }
      return deterministicFallbackRecord(batchRows[0], heldBack);
    }

    throw err;
  }
}

export async function extractBatch(
  mappings: object[],
  batchRows: object[],
): Promise<BatchExtractionResponse> {
  const typedMappings = mappings as MappingInput[];
  const typedRows = batchRows as BatchRowInput[];
  const heldBack: HeldBackByRow = new Map();
  return extractBatchRecursive(typedMappings, typedRows, heldBack);
}
