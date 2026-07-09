import type { CrmRecord, ParsedRow } from '@groeasy/shared';
import {
  extractEmails,
  extractPhones,
  isLikelyDate,
  isLikelyEmail,
  isLikelyPhone,
  normalizeEmail,
  validateEmail,
} from '../csv/patterns';
import { parsePhone } from './normalization';
import { normalizeHeader } from '../csv/headerNormalization';

const EMAIL_HEADER_HINTS = [
  'email',
  'e_mail',
  'mail',
  'primary_email',
  'alternate_email',
  'alt_email',
  'secondary_email',
  'work_email',
];

const PHONE_HEADER_HINTS = [
  'phone',
  'mobile',
  'tel',
  'telephone',
  'contact',
  'whatsapp',
  'phone_1',
  'phone_2',
  'phone1',
  'phone2',
  'primary_phone',
  'alternate_phone',
  'secondary_phone',
  'contact_number',
];

const GEOGRAPHIC_FIELDS = new Set(['state', 'city', 'country']);
const CONTACT_TARGET_FIELDS = new Set(['email', 'mobile_without_country_code', 'country_code']);

/** Detect single or combined phone/contact values unsuitable for geographic fields */
export function isPhoneLikeValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isLikelyDate(trimmed)) return false;
  if (isLikelyPhone(trimmed)) return true;

  const phones = extractPhones(trimmed);
  if (phones.length >= 2) return true;

  const digitRuns = trimmed.match(/\d{7,}/g);
  if (digitRuns && digitRuns.length >= 2) return true;

  const allDigits = trimmed.replace(/\D/g, '');
  if (allDigits.length >= 7 && allDigits.length <= 15) {
    const nonPhoneChars = trimmed.replace(/[\d\s\-+().,/|]/g, '');
    if (nonPhoneChars.length <= 4) return true;
  }

  // Multiple phones joined without extractPhones splitting (e.g. 10digit-10digit)
  if (allDigits.length >= 14 && allDigits.length <= 30) {
    const alpha = trimmed.replace(/[\d\s\-+().,/|]/g, '');
    if (alpha.length <= 3) return true;
  }

  return false;
}

export function isEmailLikeValue(value: string): boolean {
  return isLikelyEmail(value.trim()) || extractEmails(value).length > 0;
}

export function isContactLikeColumn(header: string): 'email' | 'phone' | 'either' | null {
  const normalized = normalizeHeader(header);
  if (EMAIL_HEADER_HINTS.some((h) => normalized.includes(h) || normalized === h)) {
    return 'email';
  }
  if (PHONE_HEADER_HINTS.some((h) => normalized.includes(h) || normalized === h)) {
    return 'phone';
  }
  if (normalized.includes('contact') && !normalized.includes('name')) {
    return 'either';
  }
  return null;
}

function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (!validateEmail(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function phoneDigitKey(phone: string): string {
  return phone.replace(/\D/g, '');
}

function dedupePhones(phones: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const phone of phones) {
    const key = phoneDigitKey(phone);
    if (key.length < 7 || seen.has(key)) continue;
    seen.add(key);
    result.push(phone.trim());
  }
  return result;
}

/** Collect email/phone candidates from all source columns in column order */
export function collectContactCandidates(sourceRow: ParsedRow): {
  emails: string[];
  phones: string[];
} {
  const emailCandidates: string[] = [];
  const phoneCandidates: string[] = [];
  const columns = Object.keys(sourceRow.data);

  for (const column of columns) {
    const value = sourceRow.data[column] ?? '';
    if (!value.trim()) continue;

    const headerHint = isContactLikeColumn(column);
    const emails = extractEmails(value);
    const phones = extractPhones(value);

    if (headerHint === 'email' || headerHint === 'either' || emails.length > 0) {
      emailCandidates.push(...emails);
    }
    if (headerHint === 'phone' || headerHint === 'either' || phones.length > 0) {
      phoneCandidates.push(...phones);
    }

    if (!headerHint && emails.length === 0 && phones.length === 0) {
      if (isLikelyEmail(value)) emailCandidates.push(value.trim().toLowerCase());
      else if (isPhoneLikeValue(value)) phoneCandidates.push(value.trim());
    }
  }

  return {
    emails: dedupeEmails(emailCandidates),
    phones: dedupePhones(phoneCandidates),
  };
}

export function applyContactCandidates(
  record: CrmRecord,
  emails: string[],
  phones: string[],
  noteParts: string[],
  countryHint?: string,
): void {
  if (emails.length > 0) {
    record.email = emails[0];
    if (emails.length > 1) {
      noteParts.push(`Additional emails: ${emails.slice(1).join(', ')}`);
    }
  }

  if (phones.length > 0) {
    const parts = parsePhone(phones[0], countryHint ?? record.country);
    record.country_code = parts.country_code || record.country_code;
    record.mobile_without_country_code = parts.mobile_without_country_code;
    if (phones.length > 1) {
      noteParts.push(`Additional phones: ${phones.slice(1).join(', ')}`);
    }
  }
}

export function shouldRejectValueForField(
  field: keyof CrmRecord,
  value: string,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (GEOGRAPHIC_FIELDS.has(field)) {
    return isPhoneLikeValue(trimmed) || isEmailLikeValue(trimmed);
  }

  if (field === 'company') {
    return isPhoneLikeValue(trimmed) || isEmailLikeValue(trimmed);
  }

  return false;
}

export function sanitizeGeographicFields(record: CrmRecord): void {
  for (const field of ['state', 'city', 'country'] as const) {
    const value = record[field];
    if (value && shouldRejectValueForField(field, value)) {
      record[field] = '';
    }
  }
  if (record.company && shouldRejectValueForField('company', record.company)) {
    record.company = '';
  }
}

export function isContactTargetField(field: string): boolean {
  return CONTACT_TARGET_FIELDS.has(field);
}
