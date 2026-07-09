/** Lightweight per-operation Gemini request counters (development observability) */
export interface GeminiRequestMetrics {
  model: string;
  inferenceRequests: number;
  extractionRequests: number;
  retries: number;
}

let activeMetrics: GeminiRequestMetrics | null = null;

export function startGeminiMetrics(model: string): void {
  activeMetrics = {
    model,
    inferenceRequests: 0,
    extractionRequests: 0,
    retries: 0,
  };
}

export function recordInferenceRequest(): void {
  if (activeMetrics) activeMetrics.inferenceRequests++;
}

export function recordExtractionRequest(): void {
  if (activeMetrics) activeMetrics.extractionRequests++;
}

export function recordGeminiRetry(): void {
  if (activeMetrics) activeMetrics.retries++;
}

export function getGeminiMetrics(): GeminiRequestMetrics | null {
  return activeMetrics ? { ...activeMetrics } : null;
}

export function finishGeminiMetrics(_label: string): GeminiRequestMetrics | null {
  const metrics = getGeminiMetrics();
  activeMetrics = null;
  return metrics
    ? {
        ...metrics,
        // attach label via spread for logging caller
      }
    : null;
}

export function totalGeminiRequests(metrics: GeminiRequestMetrics): number {
  return metrics.inferenceRequests + metrics.extractionRequests;
}
