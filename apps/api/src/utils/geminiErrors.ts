import { AppError } from '../middleware/errorHandler';
import { isDailyQuotaError, isRateLimitError } from '../services/ai/geminiRetry';

const DAILY_QUOTA_MESSAGE =
  'AI processing is temporarily unavailable because the current API quota has been reached. Please try again later.';

const RPM_LIMIT_MESSAGE =
  'AI service rate limit reached. Please wait and try again.';

export function toGeminiAppError(err: unknown): AppError {
  const message = (err as Error).message?.toLowerCase() ?? '';

  if (isDailyQuotaError(err)) {
    return new AppError('GEMINI_DAILY_QUOTA', DAILY_QUOTA_MESSAGE, 503);
  }

  if (isRateLimitError(err) || message.includes('429') || message.includes('rate limit')) {
    return new AppError('GEMINI_RATE_LIMIT', RPM_LIMIT_MESSAGE, 429);
  }

  if (message.includes('401') || message.includes('403') || message.includes('api key')) {
    return new AppError(
      'GEMINI_AUTH_ERROR',
      'AI service authentication failed. Check server configuration.',
      503,
    );
  }

  if (message.includes('timeout') || message.includes('503') || message.includes('overloaded')) {
    return new AppError(
      'GEMINI_UNAVAILABLE',
      'AI service is temporarily unavailable. Please retry.',
      503,
    );
  }

  return new AppError(
    'GEMINI_ERROR',
    'AI processing failed. Please retry.',
    502,
  );
}
