'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { validateCsvFile } from '@/lib/csvParser';
import { getSampleTemplateCsv, downloadCsv } from '@/lib/export';
import { LIMITS } from '@importlyai/shared';

type DropState = 'idle' | 'hover' | 'dragging' | 'rejected' | 'selected';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
}

export function UploadZone({ onFileSelected }: UploadZoneProps) {
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
    [handleFile]
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

  return (
    <div className="w-full max-w-2xl mx-auto rounded-xl bg-surface shadow-sm border border-border">
      <div className="px-6 py-8">
        <div
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors cursor-pointer',
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
          onClick={() => {
            if (!selectedFile) inputRef.current?.click();
          }}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <FileText className="h-12 w-12 text-accent" />
              <p className="text-base font-medium text-primary">{selectedFile.name}</p>
              <p className="text-sm text-muted">{formatFileSize(selectedFile.size)}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-surface p-3 shadow-sm border border-border">
                <Upload className="h-8 w-8 text-muted" />
              </div>
              <p className="text-base font-medium text-primary">
                Click or drag CSV file here
              </p>
              <p className="mt-1 text-sm text-muted">
                Intelligent mapping to Importlyai CRM
              </p>
            </div>
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
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-error-text bg-error-bg p-3 rounded-lg border border-error-border">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-start">
            <p className="text-xs text-muted">
              Previewed locally before AI analysis. Max size: {Math.round(LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB.
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
              className="mt-1 text-xs font-medium text-accent hover:opacity-80"
            >
              Download sample template
            </button>
          </div>
          
          <button
            className="btn-primary w-full sm:w-auto"
            disabled={!selectedFile}
            onClick={(e) => { e.stopPropagation(); handleContinue(); }}
          >
            Start Import Process
          </button>
        </div>
      </div>
    </div>
  );
}
