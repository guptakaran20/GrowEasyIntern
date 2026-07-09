const DAILY_QUOTA_PATTERNS = [
  'perday',
  'per day',
  'generate_requests_per_day',
  'requestsperday',
  'requests_per_day',
  'rpd',
];

const RPM_RATE_LIMIT_PATTERNS = [
  'perminute',
  'per minute',
  'generate_requests_per_minute',
  'requestsperminute',
  'requests_per_minute',
  '429',
  'rate limit',
  'too many requests',
  'resource exhausted',
];

export function getErrorMessage(err: unknown): string {
  return (err as Error).message?.toLowerCase() ?? String(err).toLowerCase();
}

/** Daily quota exhaustion — do not retry */
export function isDailyQuotaError(err: unknown): boolean {
  const message = getErrorMessage(err);
  return DAILY_QUOTA_PATTERNS.some((p) => message.includes(p));
}

/** Transient RPM / overload limit — retry with backoff */
export function isRateLimitError(err: unknown): boolean {
  const message = getErrorMessage(err);
  if (isDailyQuotaError(err)) return false;
  return RPM_RATE_LIMIT_PATTERNS.some((p) => message.includes(p));
}

/** Extract Retry-After delay in ms from SDK/provider error when available */
export function getRetryAfterMs(err: unknown): number | undefined {
  const e = err as {
    status?: number;
    response?: { headers?: { get?: (name: string) => string | null } };
    errorDetails?: Array<{ retryDelay?: string; '@type'?: string }>;
  };

  const headerValue = e.response?.headers?.get?.('retry-after');
  if (headerValue) {
    const seconds = parseInt(headerValue, 10);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  }

  for (const detail of e.errorDetails ?? []) {
    if (detail.retryDelay) {
      const match = detail.retryDelay.match(/(\d+(?:\.\d+)?)s/);
      if (match) return Math.ceil(parseFloat(match[1]) * 1000);
    }
  }

  const message = getErrorMessage(err);
  const retryMatch = message.match(/retry(?:\s+after|\s+in)?\s+(\d+(?:\.\d+)?)\s*s/);
  if (retryMatch) return Math.ceil(parseFloat(retryMatch[1]) * 1000);

  return undefined;
}

export function computeRetryDelayMs(
  attempt: number,
  err: unknown,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const retryAfter = getRetryAfterMs(err);
  if (retryAfter != null) {
    return Math.min(retryAfter, maxDelayMs);
  }
  const exponential = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
  return Math.min(exponential, maxDelayMs);
}
