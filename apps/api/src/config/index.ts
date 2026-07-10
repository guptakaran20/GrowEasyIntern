import { LIMITS } from '@importlyai/shared';

export const config = {
  limits: LIMITS,
  gemini: {
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    temperature: 0.1,
    maxOutputTokens: 8192,
    maxOutputTokensExtraction: 4096,
  },
  batch: {
    size: Number(process.env.BATCH_SIZE) || LIMITS.DEFAULT_BATCH_SIZE,
    /** Max parallel extraction batches — default 1 for RPM-safe deployment */
    concurrency: Number(process.env.AI_CONCURRENCY) || 1,
    maxRetries: LIMITS.MAX_AI_RETRIES,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 30000,
  },
  upload: {
    maxFileSize: LIMITS.MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
    allowedExtensions: ['.csv'],
  },
  jobs: {
    ttlMs: 30 * 60 * 1000, // 30 minutes
    cleanupIntervalMs: 5 * 60 * 1000,
  },
} as const;
