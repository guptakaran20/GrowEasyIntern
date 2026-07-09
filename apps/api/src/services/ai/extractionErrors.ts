/** Thrown when Gemini stops due to output token limit — triggers batch split, not identical retry */
export class ExtractionTruncatedError extends Error {
  constructor(
    public readonly finishReason: string,
    public readonly responseLength: number,
    public readonly sourceRowNumbers: number[] = [],
    public readonly responseText?: string,
  ) {
    super(`Extraction truncated (${finishReason}) at ${responseLength} chars`);
    this.name = 'ExtractionTruncatedError';
  }
}
/** Split a batch in half for recursive extraction after truncation */
export function splitBatchInHalf<T>(rows: T[]): [T[], T[]] {
  const mid = Math.ceil(rows.length / 2);
  return [rows.slice(0, mid), rows.slice(mid)];
}
