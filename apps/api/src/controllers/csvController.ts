import { Request, Response, NextFunction } from 'express';
import { LIMITS } from '@importlyai/shared';
import { parseCsvBuffer, validateCsvFile } from '../services/csv/parser';
import { profileDataset, getSampleRows } from '../services/csv/profiler';
import { inferSchema } from '../services/ai/geminiService';
import { config } from '../config';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { toGeminiAppError } from '../utils/geminiErrors';
import {
  finishGeminiMetrics,
  startGeminiMetrics,
  totalGeminiRequests,
} from '../services/ai/geminiMetrics';

export async function analyzeCsv(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = req.file;
    validateCsvFile(
      file!,
      config.upload.maxFileSize,
      [...config.upload.allowedExtensions],
      [...config.upload.allowedMimeTypes],
    );

    const startTime = Date.now();
    const { headers, rows, rowCount } = parseCsvBuffer(file!.buffer, file!.originalname);

    if (rowCount === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_RECORDS', message: 'CSV contains no data rows' },
      });
      return;
    }

    const { profiles, hints } = profileDataset(headers, rows);
    const sampleRows = getSampleRows(rows, LIMITS.SCHEMA_INFERENCE_SAMPLE_ROWS);

    logger.info('Starting schema inference', {
      requestId: req.requestId,
      fileName: file!.originalname,
      rowCount,
      columnCount: headers.length,
    });

    startGeminiMetrics(config.gemini.model);
    const inferredMapping = await inferSchema(
      headers,
      profiles,
      hints,
      sampleRows,
    );

    const durationMs = Date.now() - startTime;
    const geminiMetrics = finishGeminiMetrics('analyze');
    logger.info('CSV analysis complete', {
      requestId: req.requestId,
      durationMs,
      mappingCount: inferredMapping.mappings.length,
      warningCount: inferredMapping.warnings.length,
      ...(env.NODE_ENV === 'development' && geminiMetrics
        ? {
            geminiModel: geminiMetrics.model,
            inferenceRequests: geminiMetrics.inferenceRequests,
            extractionRequests: geminiMetrics.extractionRequests,
            geminiRetries: geminiMetrics.retries,
            totalGeminiRequests: totalGeminiRequests(geminiMetrics),
          }
        : {}),
    });

    res.json({
      success: true,
      data: {
        file_name: file!.originalname,
        file_size: file!.size,
        row_count: rowCount,
        column_count: headers.length,
        headers,
        column_profiles: profiles,
        semantic_hints: hints,
        sample_rows: sampleRows,
        inferred_mapping: inferredMapping,
        all_rows: rows,
      },
    });
  } catch (err) {
    finishGeminiMetrics('analyze-error');
    const message = (err as Error).message?.toLowerCase() ?? '';
    if (message.includes('googlegenerativeai') || message.includes('gemini') || message.includes('429') || message.includes('quota')) {
      next(toGeminiAppError(err));
      return;
    }
    next(err);
  }
}
