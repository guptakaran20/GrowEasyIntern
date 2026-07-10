import type { ImportProcessRequest, ImportResult, ImportProgress } from '@importlyai/shared';
import { config } from '../../config';

interface Job {
  id: string;
  request: ImportProcessRequest;
  progress: ImportProgress;
  result?: ImportResult;
  createdAt: number;
}

class JobStore {
  private jobs = new Map<string, Job>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  create(id: string, request: ImportProcessRequest): void {
    this.jobs.set(id, {
      id,
      request,
      progress: {
        job_id: id,
        status: 'pending',
        stage: 'Queued',
        rows_processed: 0,
        total_rows: request.rows.length,
        imported_count: 0,
        skipped_count: 0,
        current_batch: 0,
        total_batches: Math.ceil(request.rows.length / config.batch.size),
      },
      createdAt: Date.now(),
    });
  }

  updateProgress(id: string, progress: ImportProgress): void {
    const job = this.jobs.get(id);
    if (job) {
      job.progress = progress;
    }
  }

  complete(id: string, result: ImportResult): void {
    const job = this.jobs.get(id);
    if (job) {
      job.result = result;
      job.progress = {
        ...job.progress,
        status: result.warnings.length > 0 ? 'partial' : 'completed',
        stage: 'Complete',
        rows_processed: result.total_rows,
        imported_count: result.imported_count,
        skipped_count: result.skipped_count,
      };
    }
  }

  fail(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.progress = {
        ...job.progress,
        status: 'failed',
        stage: 'Failed',
        error,
      };
    }
  }

  getProgress(id: string): ImportProgress | null {
    return this.jobs.get(id)?.progress ?? null;
  }

  getResult(id: string): ImportResult | null {
    const job = this.jobs.get(id);
    if (!job?.result) return null;
    return job.result;
  }

  exists(id: string): boolean {
    return this.jobs.has(id);
  }

  startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, job] of this.jobs) {
        if (now - job.createdAt > config.jobs.ttlMs) {
          this.jobs.delete(id);
        }
      }
    }, config.jobs.cleanupIntervalMs);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const jobStore = new JobStore();
