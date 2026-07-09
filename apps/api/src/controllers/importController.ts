import { Request, Response, NextFunction } from 'express';
import { importProcessRequestSchema } from '@groeasy/shared';
import { processImport, startImportJob } from '../services/import/importEngine';
import { jobStore } from '../services/import/jobStore';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { toGeminiAppError } from '../utils/geminiErrors';
import { config } from '../config';
import { env } from '../config/env';
import {
  finishGeminiMetrics,
  startGeminiMetrics,
  totalGeminiRequests,
} from '../services/ai/geminiMetrics';

export async function processImportSync(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = importProcessRequestSchema.parse(req.body);
    const startTime = Date.now();

    logger.info('Starting sync import', {
      requestId: req.requestId,
      fileName: body.file_name,
      rowCount: body.rows.length,
    });

    startGeminiMetrics(config.gemini.model);
    const result = await processImport(body);
    const geminiMetrics = finishGeminiMetrics('import');
    const plannedExtractionBatches = Math.ceil(body.rows.length / config.batch.size);

    logger.info('Sync import complete', {
      requestId: req.requestId,
      durationMs: Date.now() - startTime,
      imported: result.imported_count,
      skipped: result.skipped_count,
      ...(env.NODE_ENV === 'development' && geminiMetrics
        ? {
            geminiModel: geminiMetrics.model,
            plannedExtractionBatches,
            inferenceRequests: geminiMetrics.inferenceRequests,
            extractionRequests: geminiMetrics.extractionRequests,
            geminiRetries: geminiMetrics.retries,
            totalGeminiRequests: totalGeminiRequests(geminiMetrics),
          }
        : {}),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    finishGeminiMetrics('import-error');
    const message = (err as Error).message?.toLowerCase() ?? '';
    if (message.includes('googlegenerativeai') || message.includes('gemini') || message.includes('429') || message.includes('quota')) {
      next(toGeminiAppError(err));
      return;
    }
    next(err);
  }
}

export async function startImport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = importProcessRequestSchema.parse(req.body);
    const jobId = await startImportJob(body);

    logger.info('Import job started', {
      requestId: req.requestId,
      jobId,
      rowCount: body.rows.length,
    });

    res.json({ success: true, data: { job_id: jobId } });
  } catch (err) {
    next(err);
  }
}

export function getImportProgress(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const jobId = String(req.params.jobId);
    if (!jobStore.exists(jobId)) {
      throw new AppError('JOB_NOT_FOUND', 'Import job not found or expired', 404);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendProgress = () => {
      const progress = jobStore.getProgress(jobId);
      if (progress) {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
    };

    sendProgress();

    const interval = setInterval(() => {
      const progress = jobStore.getProgress(jobId);
      if (!progress) {
        clearInterval(interval);
        res.end();
        return;
      }

      sendProgress();

      if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'partial') {
        clearInterval(interval);
        res.end();
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(interval);
    });
  } catch (err) {
    next(err);
  }
}

export function getImportResult(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const jobId = String(req.params.jobId);
    if (!jobStore.exists(jobId)) {
      throw new AppError('JOB_NOT_FOUND', 'Import job not found or expired', 404);
    }

    const result = jobStore.getResult(jobId);
    if (!result) {
      const progress = jobStore.getProgress(jobId);
      res.status(202).json({
        success: true,
        data: { status: progress?.status ?? 'pending', message: 'Import still in progress' },
      });
      return;
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
