'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { validateCsvFile } from '@/lib/csvParser';
import { getSampleTemplateCsv, downloadCsv } from '@/lib/export';
import { LIMITS } from '@groeasy/shared';

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
    downloadCsv(getSampleTemplateCsv(), 'groeasy_crm_template.csv');
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
    <div className="w-full max-w-2xl mx-auto rounded-xl bg-white shadow-sm border border-slate-200">
      <div className="px-6 py-8">
        <div
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors cursor-pointer',
            dropState === 'dragging' || dropState === 'hover'
              ? 'border-teal-400 bg-teal-50'
              : dropState === 'rejected'
                ? 'border-red-300 bg-red-50'
                : dropState === 'selected'
                  ? 'border-teal-400 bg-teal-50/50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100',
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
              <FileText className="h-12 w-12 text-teal-500" />
              <p className="text-base font-medium text-slate-900">{selectedFile.name}</p>
              <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-white p-3 shadow-sm border border-slate-100">
                <Upload className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-base font-medium text-slate-900">
                Click or drag CSV file here
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Intelligent mapping to GrowEasy CRM
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
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-start">
            <p className="text-xs text-slate-500">
              Previewed locally before AI analysis. Max size: {Math.round(LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB.
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
              className="mt-1 text-xs font-medium text-teal-600 hover:text-teal-700"
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
