import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  stripCodeFences,
  parseGeminiJsonText,
  isJsonParseError,
  normalizeBatchExtraction,
} from './geminiJson';
import { batchExtractionResponseSchema } from '@groeasy/shared';

async function withRetryLikeGemini<T>(
  fn: () => Promise<T>,
  maxRetries: number,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const retryable = isJsonParseError(err);
      if (!retryable || attempt === maxRetries) throw lastError;
    }
  }
  throw lastError!;
}

describe('geminiJson', () => {
  it('strips markdown code fences', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('parses valid JSON', () => {
    expect(parseGeminiJsonText('{"records":[]}')).toEqual({ records: [] });
  });

  it('parses JSON wrapped in code fences', () => {
    expect(parseGeminiJsonText('```\n{"records":[]}\n```')).toEqual({ records: [] });
  });

  it('throws on malformed JSON', () => {
    expect(() => parseGeminiJsonText('{"records":[{bad}]')).toThrow();
  });

  it('throws on truncated JSON', () => {
    const truncated = '{"records":[{"row_number":1,"name":"John"';
    expect(() => parseGeminiJsonText(truncated)).toThrow();
    try {
      parseGeminiJsonText(truncated);
    } catch (err) {
      expect(isJsonParseError(err)).toBe(true);
    }
  });

  it('detects JSON parse errors for retry', () => {
    expect(
      isJsonParseError(new SyntaxError("Expected property name or '}' in JSON at position 65304")),
    ).toBe(true);
    expect(isJsonParseError(new Error('429 rate limit'))).toBe(false);
  });

  it('retries after malformed JSON and succeeds on valid fenced JSON', async () => {
    let attempts = 0;
    const result = await withRetryLikeGemini(async () => {
      attempts++;
      if (attempts === 1) {
        throw new SyntaxError("Expected property name or '}' in JSON at position 65304");
      }
      return parseGeminiJsonText('```json\n{"records":[{"row_number":1,"fields":{"email":"a@test.com"}}]}\n```');
    }, 3);

    expect(attempts).toBe(2);
    expect(result).toEqual({
      records: [{ row_number: 1, fields: { email: 'a@test.com' } }],
    });
  });

  it('normalizes flat CRM fields into nested fields contract', () => {
    const normalized = normalizeBatchExtraction({
      records: [
        {
          row_number: 1,
          name: 'John',
          email: 'john@test.com',
          mobile_without_country_code: '9876543210',
        },
      ],
    });
    const parsed = batchExtractionResponseSchema.parse(normalized);
    expect(parsed.records[0].fields.name).toBe('John');
    expect(parsed.records[0].fields.email).toBe('john@test.com');
  });

  it('preserves legacy nested fields format', () => {
    const normalized = normalizeBatchExtraction({
      records: [{ row_number: 2, fields: { name: 'Jane' } }],
    });
    const parsed = batchExtractionResponseSchema.parse(normalized);
    expect(parsed.records[0].fields.name).toBe('Jane');
  });
});
