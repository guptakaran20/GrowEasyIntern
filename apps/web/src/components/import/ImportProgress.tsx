'use client';

import { Loader2 } from 'lucide-react';
import type { ImportProgress } from '@importlyai/shared';

interface ImportProgressPanelProps {
  progress: ImportProgress | null;
  totalRows: number;
}

export function ImportProgressPanel({ progress, totalRows }: ImportProgressPanelProps) {
  const hasLiveProgress = progress != null;
  const rowsProcessed = progress?.rows_processed ?? 0;
  const total = progress?.total_rows ?? totalRows;
  const percent = total > 0 ? Math.round((rowsProcessed / total) * 100) : 0;
  const stage = progress?.stage ?? 'Preparing job...';
  const currentBatch = progress?.current_batch ?? 0;
  const totalBatches = progress?.total_batches ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-xl bg-surface p-8 shadow-xl border border-border">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
          <h2 className="mt-4 text-lg font-semibold text-primary">Importing Leads</h2>
          <p className="mt-1 text-sm text-muted">{stage}</p>
        </div>

        <div className="mt-6">
          {hasLiveProgress ? (
            <>
              <div className="mb-2 flex justify-between text-sm text-muted">
                <span>{rowsProcessed} / {total} rows</span>
                {totalBatches > 0 && (
                  <span className="text-muted opacity-70 border-l border-border pl-2 ml-2">
                    Batch {currentBatch} of {totalBatches}
                  </span>
                )}
                <span className="ml-auto font-medium">{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          ) : (
            <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/70" />
            </div>
          )}
        </div>
        {progress && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-success-bg px-3 py-2 border border-success-border">
              <p className="text-lg font-semibold text-success-text">{progress.imported_count}</p>
              <p className="text-xs text-success-text opacity-90">Imported</p>
            </div>
            <div className="rounded-lg bg-surface-secondary px-3 py-2 border border-border">
              <p className="text-lg font-semibold text-primary">{progress.skipped_count}</p>
              <p className="text-xs text-muted">Skipped</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
