/** Extracted retry logic for unit testing */
export async function withRetryTest<T>(
  fn: () => Promise<T>,
  maxRetries: number,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const message = lastError.message?.toLowerCase() ?? '';
      const isRetryable =
        message.includes('rate') ||
        message.includes('timeout') ||
        message.includes('503') ||
        message.includes('429');
      if (!isRetryable || attempt === maxRetries) throw lastError;
    }
  }
  throw lastError!;
}
