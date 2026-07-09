import { describe, it, expect } from 'vitest';
import {
  normalizeCrmStatus,
  normalizeDataSource,
  parsePhone,
  normalizeDate,
} from './normalization';

describe('CRM status normalization', () => {
  it('maps exact enum values', () => {
    expect(normalizeCrmStatus('GOOD_LEAD_FOLLOW_UP')).toBe('GOOD_LEAD_FOLLOW_UP');
  });

  it('maps semantic status values', () => {
    expect(normalizeCrmStatus('interested')).toBe('GOOD_LEAD_FOLLOW_UP');
    expect(normalizeCrmStatus('no answer')).toBe('DID_NOT_CONNECT');
    expect(normalizeCrmStatus('junk')).toBe('BAD_LEAD');
    expect(normalizeCrmStatus('deal closed')).toBe('SALE_DONE');
  });

  it('returns empty for unknown status', () => {
    expect(normalizeCrmStatus('random status')).toBe('');
  });
});

describe('data source normalization', () => {
  it('maps exact enum values', () => {
    expect(normalizeDataSource('eden_park')).toBe('eden_park');
  });

  it('maps semantic source values', () => {
    expect(normalizeDataSource('Leads on Demand')).toBe('leads_on_demand');
    expect(normalizeDataSource('Eden Park Phase 2')).toBe('eden_park');
    expect(normalizeDataSource('Meridian Tower')).toBe('meridian_tower');
  });

  it('returns empty for unknown source', () => {
    expect(normalizeDataSource('Random Campaign')).toBe('');
  });
});

describe('phone parsing', () => {
  it('parses +91 prefix', () => {
    const result = parsePhone('+91 9876543210');
    expect(result.country_code).toBe('+91');
    expect(result.mobile_without_country_code).toBe('9876543210');
  });

  it('parses 91 prefix without plus', () => {
    const result = parsePhone('919876543210');
    expect(result.country_code).toBe('+91');
    expect(result.mobile_without_country_code).toBe('9876543210');
  });

  it('uses country hint for 10-digit numbers', () => {
    const result = parsePhone('9876543210', 'India');
    expect(result.country_code).toBe('+91');
    expect(result.mobile_without_country_code).toBe('9876543210');
  });

  it('handles plain 10-digit without hint', () => {
    const result = parsePhone('9876543210');
    expect(result.mobile_without_country_code).toBe('9876543210');
    expect(result.country_code).toBe('');
  });
});

describe('date normalization', () => {
  it('normalizes ISO dates', () => {
    const result = normalizeDate('2024-01-15T10:30:00.000Z');
    expect(result).toBe('2024-01-15T10:30:00.000Z');
  });

  it('normalizes DD/MM/YYYY', () => {
    const result = normalizeDate('15/01/2024');
    expect(result).toContain('2024-01-15');
  });

  it('normalizes YYYY-MM-DD', () => {
    const result = normalizeDate('2024-03-01');
    expect(result).toContain('2024-03-01');
  });

  it('returns empty for invalid date', () => {
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate('not a date')).toBe('');
  });
});
