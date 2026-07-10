'use client';

import { Loader2 } from 'lucide-react';

interface ParseProgressPanelProps {
  progress: {
    bytesProcessed: number;
    totalBytes: number;
    rowsParsed: number;
  } | null;
  fileName: string;
}

export function ParseProgressPanel({ progress, fileName }: ParseProgressPanelProps) {
  const percent = progress && progress.totalBytes > 0
    ? Math.min(100, Math.round((progress.bytesProcessed / progress.totalBytes) * 100))
    : 0;

  return (
    <div className="w-full max-w-2xl mx-auto rounded-xl bg-white shadow-sm border border-slate-200 p-8 text-center">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-500 mb-4" />
      <h2 className="text-xl font-semibold text-slate-900">Parsing file...</h2>
      <p className="mt-1 text-sm text-slate-500 truncate max-w-md mx-auto" title={fileName}>
        {fileName}
      </p>

      <div className="mt-8 max-w-md mx-auto">
        <div className="mb-2 flex justify-between text-sm text-slate-600">
          <span>Rows processed: {progress?.rowsParsed ?? 0}</span>
          <span className="font-medium">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  );
}
