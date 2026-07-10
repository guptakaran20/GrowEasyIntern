'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileText, X } from 'lucide-react';
import type { LocalPreview } from '@/lib/csvParser';
import { formatFileSize } from '@/lib/utils';
import { LIMITS } from '@importlyai/shared';

interface PreviewTableProps {
  preview: LocalPreview;
  maxRows?: number;
}

export function PreviewTable({ preview, maxRows = LIMITS.MAX_PREVIEW_ROWS }: PreviewTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const displayRows = preview.rows.slice(0, maxRows);
  const { headers } = preview;

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <div
          ref={parentRef}
          className="max-h-[400px] overflow-y-auto"
          style={{ contain: 'strict' }}
        >
          <table className="w-full min-w-max text-sm">
            <thead className="sticky top-0 z-10 bg-surface-secondary">
              <tr>
                <th className="whitespace-nowrap border-b border-r border-border px-3 py-2 text-left text-xs font-medium text-muted">
                  #
                </th>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap border-b border-r border-border px-3 py-2 text-left text-xs font-medium text-primary"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = displayRows[virtualRow.index];
                return (
                  <tr
                    key={virtualRow.index}
                    className="hover:bg-surface-hover"
                    style={{
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    <td className="whitespace-nowrap border-b border-r border-border/50 px-3 py-2 text-xs text-muted">
                      {virtualRow.index + 1}
                    </td>
                    {headers.map((header) => (
                      <td
                        key={header}
                        className="max-w-[200px] truncate border-b border-r border-border/50 px-3 py-2 text-xs text-primary"
                        title={row[header] ?? ''}
                      >
                        {row[header] ?? ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {preview.rowCount > maxRows && (
        <div className="border-t border-border bg-surface-secondary px-3 py-2 text-xs text-muted">
          Showing {maxRows} of {preview.rowCount} rows
        </div>
      )}
    </div>
  );
}

interface PreviewPanelProps {
  preview: LocalPreview;
  onRemove: () => void;
  onCancel: () => void;
  onContinue: () => void;
  loading?: boolean;
}

export function PreviewPanel({
  preview,
  onRemove,
  onCancel,
  onContinue,
  loading,
}: PreviewPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-surface shadow-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">CSV Preview</h2>
            <p className="text-xs text-muted">
              Your CSV has only been parsed locally. Confirm to securely analyze its structure with AI.
            </p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-muted hover:bg-surface-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium text-primary">{preview.fileName}</span>
            </div>
            <span className="text-xs text-muted">{formatFileSize(preview.fileSize)}</span>
            <span className="text-xs text-muted">{preview.rowCount} rows</span>
            <span className="text-xs text-muted">{preview.headers.length} columns</span>
            <button
              onClick={onRemove}
              className="text-xs font-medium text-error-text hover:opacity-80"
            >
              Remove file
            </button>
          </div>

          <div className="mb-2">
            <p className="text-xs font-medium text-muted">Detected columns</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {preview.headers.map((h) => (
                <span
                  key={h}
                  className="rounded-full bg-surface-secondary border border-border px-2 py-0.5 text-xs text-primary"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          <PreviewTable preview={preview} />
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onContinue} disabled={loading}>
            {loading ? 'Analyzing...' : 'Confirm & Analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}
