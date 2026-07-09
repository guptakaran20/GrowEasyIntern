import { describe, it, expect } from 'vitest';
import { ExtractionTruncatedError, splitBatchInHalf } from './extractionErrors';

describe('extractionErrors', () => {
  it('splits batch in half', () => {
    const rows = [1, 2, 3, 4, 5];
    const [first, second] = splitBatchInHalf(rows);
    expect(first).toEqual([1, 2, 3]);
    expect(second).toEqual([4, 5]);
  });

  it('does not split single-row batch', () => {
    const [first, second] = splitBatchInHalf([42]);
    expect(first).toEqual([42]);
    expect(second).toEqual([]);
  });

  it('ExtractionTruncatedError carries finishReason and length', () => {
    const err = new ExtractionTruncatedError('MAX_TOKENS', 14634, [2]);
    expect(err.finishReason).toBe('MAX_TOKENS');
    expect(err.responseLength).toBe(14634);
    expect(err.sourceRowNumbers).toEqual([2]);
  });
});
