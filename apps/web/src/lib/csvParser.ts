import Papa from 'papaparse';
import { LIMITS } from '@importlyai/shared';

export interface LocalPreview {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export interface ParseProgress {
  bytesProcessed: number;
  totalBytes: number;
  rowsParsed: number;
}

export const INCREMENTAL_PARSE_THRESHOLD_BYTES = 1024 * 512; // 512KB

export interface ParseOptions {
  onProgress?: (progress: ParseProgress) => void;
  signal?: AbortSignal;
}

export function parseCsvLocally(
  file: File,
  options?: ParseOptions
): Promise<LocalPreview> {
  const { onProgress, signal } = options || {};

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Parsing aborted'));
      return;
    }

    if (file.size <= INCREMENTAL_PARSE_THRESHOLD_BYTES) {
      // Small file: synchronous fast path
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
        error: (error) => reject(new Error(error.message)),
      });
    } else {
      // Large file: incremental chunk path
      let headers: string[] = [];
      const allRows: Record<string, string>[] = [];
      let totalRowsParsed = 0;
      let lastProgressUpdate = Date.now();

      let activeParser: Papa.Parser | null = null;

      if (signal) {
        signal.addEventListener('abort', () => {
          if (activeParser) {
            activeParser.abort();
            reject(new Error('Parsing aborted'));
          }
        });
      }

      let hasError = false;

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        chunkSize: 1024 * 256, // 256KB chunks for responsive yielding
        transformHeader: (header) => header.trim(),
        chunk: (results, parser) => {
          activeParser = parser;

          if (signal?.aborted) {
            hasError = true;
            parser.abort();
            reject(new Error('Parsing aborted'));
            return;
          }
          if (headers.length === 0 && results.meta.fields) {
            headers = results.meta.fields;
            if (headers.length === 0) {
              hasError = true;
              parser.abort();
              reject(new Error('No column headers detected'));
              return;
            }
            if (headers.length > LIMITS.MAX_COLUMNS) {
              hasError = true;
              parser.abort();
              reject(new Error(`CSV exceeds maximum of ${LIMITS.MAX_COLUMNS} columns`));
              return;
            }
          }

          const validRows = results.data.filter((row) =>
            Object.values(row).some((v) => v?.trim()),
          );
          
          allRows.push(...validRows);
          totalRowsParsed += validRows.length;

          if (totalRowsParsed > LIMITS.MAX_ROWS) {
            hasError = true;
            parser.abort();
            reject(new Error(`CSV exceeds maximum of ${LIMITS.MAX_ROWS} rows`));
            return;
          }

          // Throttle progress updates to ~30fps to maintain responsiveness without overwhelming React
          const now = Date.now();
          if (onProgress && now - lastProgressUpdate > 32) {
            onProgress({
              bytesProcessed: results.meta.cursor,
              totalBytes: file.size,
              rowsParsed: totalRowsParsed,
            });
            lastProgressUpdate = now;
          }

          // Yield to event loop to keep UI responsive
          parser.pause();
          setTimeout(() => parser.resume(), 0);
        },
        complete: (results) => {
          if (signal?.aborted || hasError) return;

          // In case there was an error in the very first chunk without any data
          if (headers.length === 0 && results.errors.length > 0 && allRows.length === 0) {
            reject(new Error(results.errors[0]?.message ?? 'Failed to parse CSV'));
            return;
          }
          if (headers.length === 0) {
            reject(new Error('No column headers detected'));
            return;
          }

          if (onProgress) {
             onProgress({
               bytesProcessed: file.size,
               totalBytes: file.size,
               rowsParsed: totalRowsParsed,
             });
          }

          resolve({
            fileName: file.name,
            fileSize: file.size,
            headers,
            rows: allRows,
            rowCount: totalRowsParsed,
          });
        },
        error: (error) => reject(new Error(error.message)),
      });
    }
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
