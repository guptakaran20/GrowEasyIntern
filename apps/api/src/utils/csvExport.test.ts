import { describe, it, expect } from 'vitest';
import { parseCsvBuffer } from '../services/csv/parser';
import { exportRecordsToCsv } from '../utils/csvExport';
import { createEmptyCrmRecord, CRM_FIELD_ORDER } from '@importlyai/shared';
import { loadTestCsv, TEST_FILES } from '../test/testData';
import { buildCrmRecordFromExtracted } from '../services/import/recordBuilder';
import type { ConfirmedMapping } from '@importlyai/shared';

describe('csvExporter round-trip', () => {
  it('exports with exact CRM field headers', () => {
    const record = createEmptyCrmRecord();
    record.name = 'John';
    record.email = 'john@test.com';
    record.mobile_without_country_code = '9876543210';
    const csv = exportRecordsToCsv([record]);
    const headerLine = csv.split('\n')[0];
    expect(headerLine).toBe(CRM_FIELD_ORDER.join(','));
  });

  it('exported CSV can be parsed again with same row count', () => {
    const record = createEmptyCrmRecord();
    record.name = 'John Doe';
    record.email = 'john@example.com';
    record.country_code = '+91';
    record.mobile_without_country_code = '9876543210';
    record.company = 'Smith, Johnson & Co.';
    record.crm_note = 'Interested, call tomorrow';
    record.crm_status = 'GOOD_LEAD_FOLLOW_UP';
    record.data_source = 'eden_park';
    record.created_at = '2024-01-15T10:30:00.000Z';

    const csv = exportRecordsToCsv([record]);
    const parsed = parseCsvBuffer(Buffer.from(csv), 'roundtrip.csv');
    expect(parsed.rowCount).toBe(1);
    expect(parsed.rows[0].data.email).toBe('john@example.com');
    expect(parsed.rows[0].data.company).toBe('Smith, Johnson & Co.');
  });

  it('mitigates formula injection in export', () => {
    const record = createEmptyCrmRecord();
    record.email = 'test@example.com';
    record.crm_note = '=SUM(A1:A10)';
    const csv = exportRecordsToCsv([record]);
    expect(csv).toContain("'=SUM(A1:A10)");
  });
});

describe('test-data fixtures parse correctly', () => {
  it('parses exact schema CSV', () => {
    const buf = loadTestCsv(TEST_FILES.exactSchema);
    const result = parseCsvBuffer(buf, '01_exact_schema.csv');
    expect(result.rowCount).toBe(2);
    expect(result.headers).toContain('email');
  });

  it('parses CSV edge cases with quoted commas', () => {
    const buf = loadTestCsv(TEST_FILES.edgeCases);
    const result = parseCsvBuffer(buf, '12_csv_edge_cases.csv');
    expect(result.rowCount).toBeGreaterThanOrEqual(3);
    const john = result.rows.find((r) => r.data.name === 'John Doe');
    expect(john?.data.company).toBe('Smith, Johnson & Co.');
  });

  it('handles duplicate headers via deduplication', () => {
    const buf = loadTestCsv(TEST_FILES.duplicateHeaders);
    const result = parseCsvBuffer(buf, '20_duplicate_headers.csv');
    // csv-parse collapses duplicate keys; deduplicateHeaders adds suffixes when detected at parse layer
    expect(result.headers.some((h) => h.startsWith('name'))).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  it('rejects empty CSV', () => {
    const buf = loadTestCsv(TEST_FILES.empty);
    expect(() => parseCsvBuffer(buf, '19_empty.csv')).toThrow();
  });
});

describe('multiple contacts handling', () => {
  const mappings: ConfirmedMapping[] = [
    { source_column: 'name', target_field: 'name' },
    { source_column: 'contact', target_field: 'email' },
  ];

  it('puts extra emails in crm_note', () => {
    const sourceRow = {
      row_number: 1,
      data: { name: 'John', contact: 'john@test.com, john.work@test.com, john.other@test.com' },
    };
    const extracted = { row_number: 1, fields: {} };
    const { record, skip } = buildCrmRecordFromExtracted(extracted, sourceRow, mappings);
    expect(skip).toBeUndefined();
    expect(record.email).toBe('john@test.com');
    expect(record.crm_note).toContain('Additional emails:');
    expect(record.crm_note).toContain('john.work@test.com');
  });

  it('puts extra phones in crm_note', () => {
    const phoneMappings: ConfirmedMapping[] = [
      { source_column: 'name', target_field: 'name' },
      { source_column: 'contact', target_field: 'mobile_without_country_code' },
    ];
    const sourceRow = {
      row_number: 1,
      data: { name: 'Jane', contact: '9876543210 / 9876543211' },
    };
    const extracted = { row_number: 1, fields: {} };
    const { record } = buildCrmRecordFromExtracted(extracted, sourceRow, phoneMappings);
    expect(record.mobile_without_country_code).toBe('9876543210');
    expect(record.crm_note).toContain('Additional phones:');
  });
});

describe('invalid record skipping', () => {
  it('skips rows without valid contact from fixture logic', () => {
    const buf = loadTestCsv(TEST_FILES.invalidRecords);
    const parsed = parseCsvBuffer(buf, '08_invalid_records.csv');
    const mappings: ConfirmedMapping[] = [
      { source_column: 'name', target_field: 'name' },
      { source_column: 'email', target_field: 'email' },
      { source_column: 'phone', target_field: 'mobile_without_country_code' },
    ];

    let imported = 0;
    let skipped = 0;
    for (const row of parsed.rows) {
      const result = buildCrmRecordFromExtracted({ row_number: row.row_number, fields: {} }, row, mappings);
      if (result.skip) skipped++;
      else imported++;
    }
    expect(imported).toBe(2);
    expect(skipped).toBe(3);
    expect(imported + skipped).toBe(5);
  });
});
