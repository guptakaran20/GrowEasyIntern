import { describe, it, expect } from 'vitest';
import {
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  CRM_FIELDS,
  crmRecordSchema,
  schemaInferenceResponseSchema,
  batchExtractionResponseSchema,
} from '@groeasy/shared';
import { createEmptyCrmRecord } from '@groeasy/shared';
import { hasValidContact } from '../services/import/recordBuilder';
import { normalizeCrmStatus, normalizeDataSource, normalizeDate } from '../services/import/normalization';

const ALLOWED_STATUSES = ['', ...CRM_STATUS_VALUES];
const ALLOWED_SOURCES = ['', ...DATA_SOURCE_VALUES];

describe('recordValidator', () => {
  it('accepts record with valid email only', () => {
    const r = createEmptyCrmRecord();
    r.email = 'test@example.com';
    expect(hasValidContact(r)).toBe(true);
  });

  it('accepts record with valid phone only', () => {
    const r = createEmptyCrmRecord();
    r.mobile_without_country_code = '9876543210';
    expect(hasValidContact(r)).toBe(true);
  });

  it('rejects record with neither contact', () => {
    expect(hasValidContact(createEmptyCrmRecord())).toBe(false);
  });

  it('rejects invalid email without phone', () => {
    const r = createEmptyCrmRecord();
    r.email = 'not-valid';
    expect(hasValidContact(r)).toBe(false);
  });
});

describe('crmRecordSchema', () => {
  it('validates complete CRM record with all fields', () => {
    const record = createEmptyCrmRecord();
    record.name = 'Test';
    record.email = 'test@example.com';
    expect(crmRecordSchema.safeParse(record).success).toBe(true);
  });

  it('requires all 15 CRM fields', () => {
    expect(CRM_FIELDS).toHaveLength(15);
  });

  it('rejects invalid crm_status enum', () => {
    const record = createEmptyCrmRecord();
    record.email = 'a@test.com';
    (record as { crm_status: string }).crm_status = 'HACKED';
    expect(crmRecordSchema.safeParse(record).success).toBe(false);
  });
});

describe('enum survival', () => {
  const statusCases = [
    ['Interested', 'GOOD_LEAD_FOLLOW_UP'],
    ['Call tomorrow', 'GOOD_LEAD_FOLLOW_UP'],
    ['Hot Lead', 'GOOD_LEAD_FOLLOW_UP'],
    ['No answer', 'DID_NOT_CONNECT'],
    ['Phone switched off', 'DID_NOT_CONNECT'],
    ['Not interested', 'BAD_LEAD'],
    ['Junk lead', 'BAD_LEAD'],
    ['Deal closed', 'SALE_DONE'],
    ['Converted', 'SALE_DONE'],
    ['Payment completed', 'SALE_DONE'],
    ['Unknown random status', ''],
  ] as const;

  it.each(statusCases)('maps "%s" -> %s', (input, expected) => {
    const result = normalizeCrmStatus(input);
    expect(ALLOWED_STATUSES).toContain(result);
    expect(result).toBe(expected);
  });

  const sourceCases = [
    ['Leads on Demand', 'leads_on_demand'],
    ['LEADS_ON_DEMAND', 'leads_on_demand'],
    ['leads-on-demand', 'leads_on_demand'],
    ['Meridian Tower', 'meridian_tower'],
    ['Eden Park Phase 2', 'eden_park'],
    ['Varah Swamy', 'varah_swamy'],
    ['Sarjapur Plots Campaign', 'sarjapur_plots'],
    ['Facebook Ads', ''],
    ['Google Campaign 2026', ''],
    ['Unknown Project', ''],
  ] as const;

  it.each(sourceCases)('maps source "%s" -> %s', (input, expected) => {
    const result = normalizeDataSource(input);
    expect(ALLOWED_SOURCES).toContain(result);
    expect(result).toBe(expected);
  });
});

describe('date parseability', () => {
  const dates = [
    '2026-05-13 14:20:48',
    '2026-05-13T14:20:48Z',
    '13/05/2026',
    '13 May 2026',
    '2026/05/13',
  ];

  it.each(dates)('normalizes "%s" to parseable ISO', (input) => {
    const result = normalizeDate(input);
    expect(result).not.toBe('');
    expect(Number.isNaN(new Date(result).getTime())).toBe(false);
  });
});

describe('aiResponseValidator', () => {
  it('validates schema inference response', () => {
    const valid = {
      mappings: [{
        source_column: 'email',
        target_field: 'email',
        confidence: 0.95,
        reason: 'Values are emails',
      }],
      unmapped_columns: [],
      warnings: [],
    };
    expect(schemaInferenceResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid confidence range', () => {
    const invalid = {
      mappings: [{
        source_column: 'email',
        target_field: 'email',
        confidence: 1.5,
        reason: 'test',
      }],
      unmapped_columns: [],
      warnings: [],
    };
    expect(schemaInferenceResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it('validates batch extraction response', () => {
    const valid = {
      records: [{
        row_number: 1,
        fields: { name: 'John', email: 'john@test.com' },
      }],
    };
    expect(batchExtractionResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects batch response missing row_number', () => {
    const invalid = {
      records: [{ fields: { name: 'John' } }],
    };
    expect(batchExtractionResponseSchema.safeParse(invalid).success).toBe(false);
  });
});
