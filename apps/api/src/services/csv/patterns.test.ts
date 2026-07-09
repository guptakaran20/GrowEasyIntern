import { describe, it, expect } from 'vitest';
import {
  isLikelyEmail,
  extractEmails,
  extractPhones,
  isLikelyPhone,
  normalizeEmail,
  validateEmail,
} from './patterns';

describe('email patterns', () => {
  it('detects valid emails', () => {
    expect(isLikelyEmail('test@example.com')).toBe(true);
    expect(isLikelyEmail('invalid')).toBe(false);
  });

  it('extracts multiple emails', () => {
    const emails = extractEmails('primary@test.com; secondary@test.com, third@test.com');
    expect(emails).toHaveLength(3);
    expect(emails[0]).toBe('primary@test.com');
  });

  it('normalizes email to lowercase', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
  });

  it('validates email shape', () => {
    expect(validateEmail('valid@email.com')).toBe(true);
    expect(validateEmail('not-valid')).toBe(false);
  });
});

describe('phone patterns', () => {
  it('detects valid phones', () => {
    expect(isLikelyPhone('9876543210')).toBe(true);
    expect(isLikelyPhone('+91 9876543210')).toBe(true);
    expect(isLikelyPhone('abc')).toBe(false);
  });

  it('extracts multiple phones', () => {
    const phones = extractPhones('+91 9876543210, 9123456789');
    expect(phones.length).toBeGreaterThanOrEqual(2);
  });
});
