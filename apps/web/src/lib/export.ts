import {
  CRM_FIELD_ORDER,
  type CrmRecord,
  type SkippedRecord,
} from '@groeasy/shared';

/** Escape CSV field value and mitigate formula injection */
function escapeCsvField(value: string): string {
  let escaped = value;
  // Formula injection mitigation
  if (/^[=+\-@\t\r]/.test(escaped)) {
    escaped = `'${escaped}`;
  }
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

export function exportRecordsToCsv(records: CrmRecord[]): string {
  const headers = CRM_FIELD_ORDER;
  // Use exact CRM field names for re-import compatibility
  const headerRow = headers.map((h) => escapeCsvField(h)).join(',');
  const dataRows = records.map((record) =>
    headers.map((field) => escapeCsvField(record[field] ?? '')).join(','),
  );
  return [headerRow, ...dataRows].join('\n');
}

export function exportSkippedToCsv(skipped: SkippedRecord[]): string {
  const headers = ['row_number', 'reason', ...Object.keys(skipped[0]?.original_record ?? {})];
  const headerRow = headers.map(escapeCsvField).join(',');
  const dataRows = skipped.map((s) => {
    const values = [
      String(s.row_number),
      s.reason,
      ...headers.slice(2).map((h) => s.original_record[h] ?? ''),
    ];
    return values.map(escapeCsvField).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function getSampleTemplateCsv(): string {
  const headers = CRM_FIELD_ORDER;
  const headerRow = headers.join(',');
  const sampleRow = [
    '2024-01-15T10:30:00.000Z',
    'John Doe',
    'john@example.com',
    '+91',
    '9876543210',
    'Acme Corp',
    'Bangalore',
    'Karnataka',
    'India',
    'Sales Team',
    'GOOD_LEAD_FOLLOW_UP',
    'Interested in 3BHK',
    'eden_park',
    '',
    'Looking for property in Whitefield',
  ].map(escapeCsvField).join(',');
  return [headerRow, sampleRow].join('\n');
}
