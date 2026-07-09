import { CRM_FIELDS } from '@groeasy/shared';
import { logger } from '../../utils/logger';
import {
  boundText,
  CRM_NOTE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  detectRepeatedTailPattern,
  SKIP_REASON_MAX_LENGTH,
} from './promptInjection';

/** Strip optional Markdown code fences from model output */
export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  return cleaned.trim();
}

export function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  const message = (err as Error).message?.toLowerCase() ?? '';
  return (
    message.includes('json') ||
    message.includes('unexpected token') ||
    message.includes('property name') ||
    message.includes("expected ','") ||
    message.includes("expected '}'")
  );
}

function extractErrorPosition(message: string): number | null {
  const match = message.match(/position\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/** Log safe diagnostics in development — never logs full response or secrets */
export function logJsonParseDiagnostics(
  text: string,
  err: unknown,
  finishReason?: string,
  sourceRowNumbers?: number[],
): void {
  if (process.env.NODE_ENV === 'production') return;

  const message = (err as Error).message ?? String(err);
  const position = extractErrorPosition(message);

  logger.error('Gemini JSON parse failure', {
    responseLength: text.length,
    sourceRowNumbers,
    previewStart: text.slice(0, 300),
    previewEnd: text.slice(-300),
    previewAround: position != null
      ? text.slice(Math.max(0, position - 150), position + 150)
      : undefined,
    parseError: message,
    finishReason: finishReason ?? 'unknown',
  });
}

/** Log bounded diagnostics when output hits MAX_TOKENS */
export function logMaxTokensDiagnostics(
  text: string,
  finishReason: string,
  sourceRowNumbers: number[],
): void {
  if (process.env.NODE_ENV === 'production') return;

  logger.error('Gemini MAX_TOKENS pathological output', {
    responseLength: text.length,
    finishReason,
    sourceRowNumbers,
    previewStart: text.slice(0, 300),
    previewEnd: text.slice(-500),
    repeatedPattern: detectRepeatedTailPattern(text),
  });
}

function boundExtractedField(field: string, value: string): string {
  if (field === 'crm_note') return boundText(value, CRM_NOTE_MAX_LENGTH);
  if (field === 'description') return boundText(value, DESCRIPTION_MAX_LENGTH);
  if (field === 'skip_reason') return boundText(value, SKIP_REASON_MAX_LENGTH);
  return value.trim();
}

export function parseGeminiJsonText(text: string): unknown {
  const cleaned = stripCodeFences(text);
  return JSON.parse(cleaned);
}

const EXTRA_FIELD_KEYS = ['extra_emails', 'extra_phones'] as const;

/**
 * Normalize flat CRM-field records (preferred) or legacy nested `fields` objects
 * into the shared batch extraction contract.
 */
export function normalizeBatchExtraction(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const root = parsed as { records?: unknown[] };
  if (!Array.isArray(root.records)) return parsed;

  return {
    records: root.records.map((rec) => {
      const row = rec as Record<string, unknown>;
      if (row.fields && typeof row.fields === 'object' && !Array.isArray(row.fields)) {
        return {
          row_number: row.row_number,
          fields: row.fields,
          skip: row.skip,
          skip_reason: row.skip_reason,
        };
      }

      const fields: Record<string, string> = {};
      for (const field of CRM_FIELDS) {
        if (row[field] != null && String(row[field]).trim() !== '') {
          fields[field] = boundExtractedField(field, String(row[field]));
        }
      }
      for (const extra of EXTRA_FIELD_KEYS) {
        if (row[extra] != null && String(row[extra]).trim() !== '') {
          fields[extra] = String(row[extra]).trim();
        }
      }

      const skipReason = row.skip_reason != null
        ? boundExtractedField('skip_reason', String(row.skip_reason))
        : row.skip_reason;

      return {
        row_number: row.row_number,
        fields,
        skip: row.skip,
        skip_reason: skipReason,
      };
    }),
  };
}
