import { describe, it, expect } from 'vitest';
import { normalizeHeader, getHeaderAliasHint, deduplicateHeaders } from './headerNormalization';

describe('headerNormalization', () => {
  it('normalizes headers to lowercase snake_case', () => {
    expect(normalizeHeader('Phone No.')).toBe('phone_no');
    expect(normalizeHeader('Full Name')).toBe('full_name');
    expect(normalizeHeader('  Email Address  ')).toBe('email_address');
  });

  it('deduplicates headers with suffix', () => {
    expect(deduplicateHeaders(['Name', 'Email', 'Name'])).toEqual([
      'Name',
      'Email',
      'Name_2',
    ]);
  });

  it('matches header aliases', () => {
    const hint = getHeaderAliasHint('email_address');
    expect(hint?.field).toBe('email');
    expect(hint?.confidence).toBeGreaterThan(0.5);
  });

  it('matches phone aliases', () => {
    const hint = getHeaderAliasHint('phone_number');
    expect(hint?.field).toBe('mobile_without_country_code');
  });

  it('matches created_at aliases', () => {
    const hint = getHeaderAliasHint('enquiry_date');
    expect(hint?.field).toBe('created_at');
  });
});
