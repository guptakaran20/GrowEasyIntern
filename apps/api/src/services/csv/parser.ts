import { parse } from 'csv-parse/sync';
import { LIMITS } from '@groeasy/shared';
import type { ParsedRow } from '@groeasy/shared';
import { AppError } from '../../middleware/errorHandler';
import { deduplicateHeaders } from './headerNormalization';
import { logger } from '../../utils/logger';

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  rowCount: number;
}

export function parseCsvBuffer(buffer: Buffer, fileName: string): ParseResult {
  const content = buffer.toString('utf-8');

  if (!content.trim()) {
    throw new AppError('EMPTY_FILE', 'The uploaded file is empty');
  }

  // Remove BOM if present
  const cleanContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  let records: Record<string, string>[];
  let rawHeaders: string[];

  try {
    const parsed = parse(cleanContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      bom: true,
    }) as Record<string, string>[];

    records = parsed;

    if (records.length === 0) {
      // Try parsing without headers
      const rawParsed = parse(cleanContent, {
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as string[][];

      if (rawParsed.length === 0) {
        throw new AppError('EMPTY_CSV', 'The CSV file contains no data rows');
      }

      rawHeaders = rawParsed[0].map((h, i) => h?.trim() || `column_${i + 1}`);
      records = rawParsed.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        rawHeaders.forEach((h, i) => {
          obj[h] = row[i]?.trim() ?? '';
        });
        return obj;
      });
    } else {
      rawHeaders = Object.keys(records[0]);
    }
  } catch (err) {
    logger.error('CSV parse error', { fileName, error: (err as Error).message });
    throw new AppError(
      'MALFORMED_CSV',
      'The uploaded file could not be parsed as CSV',
      400,
      [(err as Error).message],
    );
  }

  if (rawHeaders.length === 0 || rawHeaders.every((h) => !h.trim())) {
    throw new AppError('EMPTY_HEADERS', 'The CSV file has no valid column headers');
  }

  if (rawHeaders.length > LIMITS.MAX_COLUMNS) {
    throw new AppError(
      'TOO_MANY_COLUMNS',
      `CSV exceeds maximum of ${LIMITS.MAX_COLUMNS} columns`,
      400,
      [`Found ${rawHeaders.length} columns`],
    );
  }

  if (records.length > LIMITS.MAX_ROWS) {
    throw new AppError(
      'TOO_MANY_ROWS',
      `CSV exceeds maximum of ${LIMITS.MAX_ROWS} rows`,
      400,
      [`Found ${records.length} rows`],
    );
  }

  const headers = deduplicateHeaders(rawHeaders);

  // Remap records if headers were deduplicated
  const rows: ParsedRow[] = records.map((record, index) => {
    const data: Record<string, string> = {};
    rawHeaders.forEach((rawHeader, i) => {
      const key = headers[i];
      const existing = data[key];
      const value = record[rawHeader] ?? '';
      // Merge duplicate column values
      data[key] = existing ? `${existing}; ${value}` : value;
    });
    return {
      row_number: index + 1,
      data,
    };
  });

  return {
    headers,
    rows,
    rowCount: rows.length,
  };
}

export function validateCsvFile(
  file: Express.Multer.File,
  maxSize: number,
  allowedExtensions: string[],
  allowedMimeTypes: string[],
): void {
  if (!file) {
    throw new AppError('NO_FILE', 'No file uploaded');
  }

  if (file.size > maxSize) {
    throw new AppError(
      'FILE_TOO_LARGE',
      `File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
    );
  }

  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  if (!allowedExtensions.includes(ext)) {
    throw new AppError(
      'INVALID_FILE_TYPE',
      'Only CSV files are allowed',
      400,
      [`Extension ${ext} is not allowed`],
    );
  }

  // MIME check is advisory — extension and content matter more
  if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
    logger.warn('Unexpected MIME type', {
      mime: file.mimetype,
      fileName: file.originalname,
    });
  }
}
