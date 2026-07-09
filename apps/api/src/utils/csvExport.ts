import {
  CRM_FIELD_ORDER,
  type CrmRecord,
  type SkippedRecord,
} from '@groeasy/shared';

function escapeCsvField(value: string): string {
  let escaped = value;
  if (/^[=+\-@\t\r]/.test(escaped)) {
    escaped = `'${escaped}`;
  }
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

export function exportRecordsToCsv(records: CrmRecord[]): string {
  const headerRow = CRM_FIELD_ORDER.map((h) => escapeCsvField(h)).join(',');
  const dataRows = records.map((record) =>
    CRM_FIELD_ORDER.map((field) => escapeCsvField(record[field] ?? '')).join(','),
  );
  return [headerRow, ...dataRows].join('\n');
}

export function exportSkippedToCsv(skipped: SkippedRecord[]): string {
  if (skipped.length === 0) return 'row_number,reason';
  const extraHeaders = Object.keys(skipped[0].original_record);
  const headers = ['row_number', 'reason', ...extraHeaders];
  const headerRow = headers.map(escapeCsvField).join(',');
  const dataRows = skipped.map((s) => {
    const values = [
      String(s.row_number),
      s.reason,
      ...extraHeaders.map((h) => s.original_record[h] ?? ''),
    ];
    return values.map(escapeCsvField).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}
