'use client';

import { Loader2 } from 'lucide-react';
import type { ImportProgress } from '@groeasy/shared';

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
      <div className="relative w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-500" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Importing Leads</h2>
          <p className="mt-1 text-sm text-slate-500">{stage}</p>
        </div>

        <div className="mt-6">
          {hasLiveProgress ? (
            <>
              <div className="mb-2 flex justify-between text-sm text-slate-600">
                <span>{rowsProcessed} / {total} rows</span>
                {totalBatches > 0 && (
                  <span className="text-slate-400 border-l border-slate-200 pl-2 ml-2">
                    Batch {currentBatch} of {totalBatches}
                  </span>
                )}
                <span className="ml-auto font-medium">{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          ) : (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-teal-400" />
            </div>
          )}
        </div>
        {progress && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-teal-50 px-3 py-2">
              <p className="text-lg font-semibold text-teal-700">{progress.imported_count}</p>
              <p className="text-xs text-teal-600">Imported</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-lg font-semibold text-slate-700">{progress.skipped_count}</p>
              <p className="text-xs text-slate-500">Skipped</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
