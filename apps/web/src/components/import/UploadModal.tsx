'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { validateCsvFile } from '@/lib/csvParser';
import { getSampleTemplateCsv, downloadCsv } from '@/lib/export';
import { LIMITS } from '@importlyai/shared';

type DropState = 'idle' | 'hover' | 'dragging' | 'rejected' | 'selected';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

export function UploadModal({ open, onClose, onFileSelected }: UploadModalProps) {
  const [dropState, setDropState] = useState<DropState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const validationError = validateCsvFile(file);
    if (validationError) {
      setError(validationError);
      setDropState('rejected');
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
    setDropState('selected');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
      else setDropState('idle');
    },
    [handleFile],
  );

  const handleDownloadTemplate = () => {
    downloadCsv(getSampleTemplateCsv(), 'importlyai_crm_template.csv');
  };

  const handleContinue = () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
      setSelectedFile(null);
      setDropState('idle');
      setError(null);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setDropState('idle');
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div
        className="relative w-full max-w-lg rounded-xl bg-surface shadow-xl border border-border"
        role="dialog"
        aria-labelledby="upload-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="upload-title" className="text-lg font-semibold text-primary">
            Import Leads via CSV
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-secondary hover:text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="mb-4 text-sm text-muted">
            Upload a CSV file containing your lead data. We&apos;ll intelligently map
            columns to the Importlyai CRM schema.
          </p>

          <div
            className={cn(
              'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors cursor-pointer',
              dropState === 'dragging' || dropState === 'hover'
                ? 'border-success-border bg-success-bg'
                : dropState === 'rejected'
                  ? 'border-error-border bg-error-bg'
                  : dropState === 'selected'
                    ? 'border-success-border bg-success-bg/50'
                    : 'border-border bg-surface-secondary hover:border-muted hover:bg-surface-hover',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDropState('dragging');
            }}
            onDragLeave={() => setDropState(selectedFile ? 'selected' : 'idle')}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-10 w-10 text-accent" />
                <p className="text-sm font-medium text-primary">{selectedFile.name}</p>
                <p className="text-xs text-muted">{formatFileSize(selectedFile.size)}</p>
              </div>
            ) : (
              <>
                <Upload className="mb-3 h-10 w-10 text-muted" />
                <p className="text-sm font-medium text-primary">
                  Drag and drop your CSV file here
                </p>
                <p className="mt-1 text-xs text-muted">or</p>
                <button
                  className="mt-2 text-sm font-medium text-accent hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                >
                  Browse files
                </button>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-error-text bg-error-bg p-3 rounded-lg border border-error-border">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <p className="mt-3 text-xs text-muted">
            Supported: CSV files up to {Math.round(LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB
          </p>

          <button
            onClick={handleDownloadTemplate}
            className="mt-2 text-xs font-medium text-accent hover:opacity-80"
          >
            Download sample template
          </button>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!selectedFile}
            onClick={handleContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
