import { describe, it, expect } from 'vitest';
import {
  isDailyQuotaError,
  isRateLimitError,
  getRetryAfterMs,
  computeRetryDelayMs,
} from './geminiRetry';
import { toGeminiAppError } from '../../utils/geminiErrors';

describe('geminiRetry', () => {
  it('detects daily quota errors and does not treat them as RPM limits', () => {
    const err = new Error(
      'Quota exceeded for metric GenerateRequestsPerDayPerProjectPerModel-FreeTier limit: 500',
    );
    expect(isDailyQuotaError(err)).toBe(true);
    expect(isRateLimitError(err)).toBe(false);
  });

  it('detects RPM rate limit errors as retryable', () => {
    const err = new Error(
      '429 Too Many Requests: GenerateRequestsPerMinutePerProjectPerModel limit exceeded',
    );
    expect(isDailyQuotaError(err)).toBe(false);
    expect(isRateLimitError(err)).toBe(true);
  });

  it('extracts retry-after from error details', () => {
    const err = {
      errorDetails: [{ retryDelay: '12s', '@type': 'type.googleapis.com/google.rpc.RetryInfo' }],
    };
    expect(getRetryAfterMs(err)).toBe(12000);
  });

  it('uses exponential backoff when retry-after is absent', () => {
    const delay = computeRetryDelayMs(1, new Error('503 unavailable'), 1000, 30000);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(30000);
  });
});

describe('toGeminiAppError daily quota', () => {
  it('returns user-friendly daily quota message', () => {
    const appErr = toGeminiAppError(
      new Error('Quota exceeded for GenerateRequestsPerDayPerProjectPerModel-FreeTier'),
    );
    expect(appErr.code).toBe('GEMINI_DAILY_QUOTA');
    expect(appErr.message).toContain('quota has been reached');
    expect(appErr.statusCode).toBe(503);
  });

  it('returns RPM rate limit for per-minute quota', () => {
    const appErr = toGeminiAppError(
      new Error('429 GenerateRequestsPerMinutePerProjectPerModel quota exceeded'),
    );
    expect(appErr.code).toBe('GEMINI_RATE_LIMIT');
    expect(appErr.statusCode).toBe(429);
  });
});
