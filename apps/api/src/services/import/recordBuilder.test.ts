import { describe, it, expect } from 'vitest';
import { parseCsvBuffer } from '../csv/parser';
import {
  buildCrmRecordFromExtracted,
  hasValidContact,
  splitIntoBatches,
} from './recordBuilder';
import {
  collectContactCandidates,
  shouldRejectValueForField,
  isPhoneLikeValue,
} from './contactSelection';
import {
  isMissingValuePlaceholder,
  normalizeOptionalAiText,
} from './fieldGrounding';
import { createEmptyCrmRecord } from '@importlyai/shared';
import { loadTestCsv, TEST_FILES } from '../../test/testData';

/** Typical mis-inference: Phone 2 mapped to state, alternate email ignored */
const BUGGY_MULTIPLE_CONTACTS_MAPPINGS = [
  { source_column: 'name', target_field: 'name' },
  { source_column: 'Primary Email', target_field: 'email' },
  { source_column: 'Alternate Email', target_field: '__ignore__' },
  { source_column: 'Phone 1', target_field: 'mobile_without_country_code' },
  { source_column: 'Phone 2', target_field: 'state' },
  { source_column: 'State', target_field: 'state' },
  { source_column: 'Notes', target_field: 'crm_note' },
];

function loadMultipleContactsFixture() {
  const parsed = parseCsvBuffer(loadTestCsv(TEST_FILES.multipleContactsTest), 'multiple_contacts_test.csv');
  return parsed.rows;
}

describe('batch splitting', () => {
  it('splits items into batches', () => {
    const items = Array.from({ length: 55 }, (_, i) => i);
    const batches = splitIntoBatches(items, 25);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(25);
    expect(batches[1]).toHaveLength(25);
    expect(batches[2]).toHaveLength(5);
  });

  it('handles empty array', () => {
    expect(splitIntoBatches([], 25)).toEqual([]);
  });
});

describe('record validity', () => {
  it('validates record with email', () => {
    const record = createEmptyCrmRecord();
    record.email = 'test@example.com';
    expect(hasValidContact(record)).toBe(true);
  });

  it('validates record with phone', () => {
    const record = createEmptyCrmRecord();
    record.mobile_without_country_code = '9876543210';
    expect(hasValidContact(record)).toBe(true);
  });

  it('rejects record without contact', () => {
    const record = createEmptyCrmRecord();
    expect(hasValidContact(record)).toBe(false);
  });
});

describe('contactSelection', () => {
  it('promotes alternate email when primary is blank', () => {
    const { emails } = collectContactCandidates({
      row_number: 4,
      data: {
        'Primary Email': '',
        'Alternate Email': 'ananya@example.com',
        'Phone 2': '9090909090',
      },
    });
    expect(emails[0]).toBe('ananya@example.com');
  });

  it('promotes Phone 2 when Phone 1 is blank', () => {
    const { phones } = collectContactCandidates({
      row_number: 4,
      data: {
        'Phone 1': '',
        'Phone 2': '9090909090',
      },
    });
    expect(phones[0]).toBe('9090909090');
  });

  it('orders multiple emails with extras available for notes', () => {
    const { emails } = collectContactCandidates({
      row_number: 1,
      data: {
        'Primary Email': 'primary@test.com',
        'Alternate Email': 'alt@test.com',
      },
    });
    expect(emails).toEqual(['primary@test.com', 'alt@test.com']);
  });

  it('dedupes duplicate emails and phones', () => {
    const { emails, phones } = collectContactCandidates({
      row_number: 1,
      data: {
        'Primary Email': 'dup@test.com',
        'Alternate Email': 'dup@test.com',
        'Phone 1': '9876543210',
        'Phone 2': '9876543210',
      },
    });
    expect(emails).toHaveLength(1);
    expect(phones).toHaveLength(1);
  });

  it('rejects phone-like values for state', () => {
    expect(shouldRejectValueForField('state', '9988776655')).toBe(true);
    expect(shouldRejectValueForField('state', 'IN-91-9876543210')).toBe(true);
    expect(shouldRejectValueForField('state', '9765432109-9654321098')).toBe(true);
    expect(shouldRejectValueForField('state', '9765432109, 9654321098')).toBe(true);
    expect(shouldRejectValueForField('state', '+91 9765432109 / 9654321098')).toBe(true);
    expect(shouldRejectValueForField('state', 'Karnataka')).toBe(false);
    expect(shouldRejectValueForField('state', 'Sector 21')).toBe(false);
  });

  it('detects phone-like formatted values', () => {
    expect(isPhoneLikeValue('IN-91-9876543210')).toBe(true);
    expect(isPhoneLikeValue('9765432109-9654321098')).toBe(true);
  });

  it('clears AI-provided combined phones from state field', () => {
    const rows = loadMultipleContactsFixture();
    const row = rows.find((r) => r.data.name === 'Kabir Singh')!;
    const { record } = buildCrmRecordFromExtracted(
      { row_number: row.row_number, fields: { state: '9765432109-9654321098' } },
      row,
      BUGGY_MULTIPLE_CONTACTS_MAPPINGS,
    );
    expect(record.state).toBe('');
    expect(record.mobile_without_country_code).toBe('9765432109');
    expect(record.crm_note).toContain('9654321098');
  });
});

describe('multiple_contacts_test.csv fixture', () => {
  it('imports all 4 rows with buggy phone→state mapping', () => {
    const rows = loadMultipleContactsFixture();
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const result = buildCrmRecordFromExtracted(
        { row_number: row.row_number, fields: {} },
        row,
        BUGGY_MULTIPLE_CONTACTS_MAPPINGS,
      );
      if (result.skip) {
        skipped++;
      } else {
        imported++;
        expect(result.record.state).toBe('');
        expect(result.record.crm_status).not.toBe('HACKED');
      }
    }

    expect(imported).toBe(4);
    expect(skipped).toBe(0);
  });

  it('matches expected contacts for Aarav Sharma', () => {
    const rows = loadMultipleContactsFixture();
    const row = rows.find((r) => r.data.name === 'Aarav Sharma')!;
    const { record } = buildCrmRecordFromExtracted(
      { row_number: row.row_number, fields: {} },
      row,
      BUGGY_MULTIPLE_CONTACTS_MAPPINGS,
    );
    expect(record.email).toBe('aarav.primary@example.com');
    expect(record.mobile_without_country_code).toBe('9876543210');
    expect(record.country_code).toBe('+91');
    expect(record.state).toBe('');
    expect(record.crm_note).toContain('aarav.alt@example.com');
    expect(record.crm_note).toContain('9123456789');
  });

  it('matches expected contacts for Ananya Mehta', () => {
    const rows = loadMultipleContactsFixture();
    const row = rows.find((r) => r.data.name === 'Ananya Mehta')!;
    const result = buildCrmRecordFromExtracted(
      { row_number: row.row_number, fields: {} },
      row,
      BUGGY_MULTIPLE_CONTACTS_MAPPINGS,
    );
    expect(result.skip).toBeUndefined();
    expect(result.record.email).toBe('ananya@example.com');
    expect(result.record.mobile_without_country_code).toBe('9090909090');
    expect(result.record.state).toBe('');
  });

  it('does not put phone values in state for Ishita or Kabir', () => {
    const rows = loadMultipleContactsFixture();
    for (const name of ['Ishita Verma', 'Kabir Singh']) {
      const row = rows.find((r) => r.data.name === name)!;
      const { record } = buildCrmRecordFromExtracted(
        {
          row_number: row.row_number,
          fields: name === 'Kabir Singh' ? { state: '9765432109-9654321098' } : {},
        },
        row,
        BUGGY_MULTIPLE_CONTACTS_MAPPINGS,
      );
      expect(record.state).toBe('');
      expect(record.mobile_without_country_code.replace(/\D/g, '').length).toBeGreaterThanOrEqual(10);
    }
  });

  it('ignores erroneous AI skip when cross-column contacts are available', () => {
    const rows = loadMultipleContactsFixture();
    const row = rows.find((r) => r.data.name === 'Ananya Mehta')!;
    const result = buildCrmRecordFromExtracted(
      {
        row_number: row.row_number,
        fields: { state: 'unknown' },
        skip: true,
        skip_reason: 'No usable email or phone number provided.',
      },
      row,
      BUGGY_MULTIPLE_CONTACTS_MAPPINGS,
    );
    expect(result.skip).toBeUndefined();
    expect(result.record.email).toBe('ananya@example.com');
    expect(result.record.mobile_without_country_code).toBe('9090909090');
    expect(result.record.state).toBe('');
  });

  it('clears AI geographic hallucinations for all four rows', () => {
    const rows = loadMultipleContactsFixture();
    const aiFieldsByName: Record<string, Record<string, string>> = {
      'Aarav Sharma': {},
      'Ishita Verma': { state: 'India', city: 'Mumbai', country: 'India' },
      'Kabir Singh': { state: 'Unknown State/Province ...', city: 'Unknown', country: 'IN' },
      'Ananya Mehta': { state: 'unknown', city: 'n/a', country: 'not provided' },
    };

    let imported = 0;
    for (const row of rows) {
      const name = row.data.name;
      const result = buildCrmRecordFromExtracted(
        { row_number: row.row_number, fields: aiFieldsByName[name] ?? {} },
        row,
        BUGGY_MULTIPLE_CONTACTS_MAPPINGS,
      );
      expect(result.skip).toBeUndefined();
      imported++;
      expect(result.record.state).toBe('');
      expect(result.record.city).toBe('');
      expect(result.record.country).toBe('');
    }
    expect(imported).toBe(4);
  });
});

describe('fieldGrounding placeholders via recordBuilder', () => {
  const stateOnlyMapping = [{ source_column: 'State', target_field: 'state' }];

  it.each([
    ['unknown'],
    ['Unknown State/Province'],
    ['N/A'],
    ['not provided'],
  ])('normalizes state placeholder %j to blank', (state) => {
    const { record } = buildCrmRecordFromExtracted(
      { row_number: 1, fields: { state } },
      { row_number: 1, data: { State: '' } },
      stateOnlyMapping,
    );
    expect(record.state).toBe('');
  });

  it('preserves legitimate source state Karnataka', () => {
    const { record } = buildCrmRecordFromExtracted(
      { row_number: 1, fields: { state: 'India' } },
      { row_number: 1, data: { State: 'Karnataka' } },
      stateOnlyMapping,
    );
    expect(record.state).toBe('Karnataka');
  });

  it('preserves legitimate source country India in country field', () => {
    const { record } = buildCrmRecordFromExtracted(
      { row_number: 1, fields: { country: 'USA', state: 'India' } },
      { row_number: 1, data: { Country: 'India', State: '' } },
      [
        { source_column: 'Country', target_field: 'country' },
        { source_column: 'State', target_field: 'state' },
      ],
    );
    expect(record.country).toBe('India');
    expect(record.state).toBe('');
  });

  it('does not blank sentences that merely contain unknown', () => {
    expect(isMissingValuePlaceholder('Status unknown until callback')).toBe(false);
    expect(normalizeOptionalAiText('Status unknown until callback')).toBe(
      'Status unknown until callback',
    );
  });
});
