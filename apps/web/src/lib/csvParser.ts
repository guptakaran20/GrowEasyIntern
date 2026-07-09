import Papa from 'papaparse';
import { LIMITS } from '@groeasy/shared';

export interface LocalPreview {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export function parseCsvLocally(file: File): Promise<LocalPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(results.errors[0]?.message ?? 'Failed to parse CSV'));
          return;
        }

        const rows = results.data.filter((row) =>
          Object.values(row).some((v) => v?.trim()),
        );

        const headers = results.meta.fields ?? [];

        if (headers.length === 0) {
          reject(new Error('No column headers detected'));
          return;
        }

        if (rows.length > LIMITS.MAX_ROWS) {
          reject(new Error(`CSV exceeds maximum of ${LIMITS.MAX_ROWS} rows`));
          return;
        }

        if (headers.length > LIMITS.MAX_COLUMNS) {
          reject(new Error(`CSV exceeds maximum of ${LIMITS.MAX_COLUMNS} columns`));
          return;
        }

        resolve({
          fileName: file.name,
          fileSize: file.size,
          headers,
          rows,
          rowCount: rows.length,
        });
      },
      error: (error) => {
        reject(new Error(error.message));
      },
    });
  });
}

export function validateCsvFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'Only CSV files are supported';
  }
  if (file.size > LIMITS.MAX_FILE_SIZE_BYTES) {
    return `File exceeds maximum size of ${Math.round(LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB`;
  }
  if (file.size === 0) {
    return 'File is empty';
  }
  return null;
}
