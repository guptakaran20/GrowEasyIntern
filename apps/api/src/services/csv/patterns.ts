const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+().]{7,20}$/;
const URL_REGEX = /^https?:\/\//i;
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,
  /^\d{2}\/\d{2}\/\d{4}/,
  /^\d{2}-\d{2}-\d{4}/,
  /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i,
];

export function isLikelyEmail(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return EMAIL_REGEX.test(trimmed);
}

export function isLikelyPhone(value: string): boolean {
  if (isLikelyDate(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  return PHONE_REGEX.test(value.trim());
}

export function isLikelyDate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (DATE_PATTERNS.some((p) => p.test(trimmed))) return true;
  const parsed = Date.parse(trimmed);
  return !isNaN(parsed) && trimmed.length >= 6;
}

export function isLikelyUrl(value: string): boolean {
  return URL_REGEX.test(value.trim());
}

/** Extract all valid emails from a string that may contain multiple */
export function extractEmails(value: string): string[] {
  if (!value.trim()) return [];
  const parts = value.split(/[,;|\s]+/).map((p) => p.trim().toLowerCase());
  const emails: string[] = [];
  const emailInText = value.match(/[^\s@,;|]+@[^\s@,;|]+\.[^\s@,;|]+/g);
  if (emailInText) {
    for (const e of emailInText) {
      const normalized = e.trim().toLowerCase();
      if (isLikelyEmail(normalized) && !emails.includes(normalized)) {
        emails.push(normalized);
      }
    }
  }
  for (const part of parts) {
    if (isLikelyEmail(part) && !emails.includes(part)) {
      emails.push(part);
    }
  }
  return emails;
}

/** Extract all valid phone numbers from a string */
export function extractPhones(value: string): string[] {
  if (!value.trim()) return [];
  const phones: string[] = [];
  const parts = value.split(/[,;|/]+/).map((p) => p.trim());
  for (const part of parts) {
    if (part && isLikelyPhone(part)) {
      const normalized = part.replace(/\s+/g, ' ').trim();
      if (!phones.some((p) => p.replace(/\D/g, '') === normalized.replace(/\D/g, ''))) {
        phones.push(normalized);
      }
    }
  }
  // Also try to find phone patterns in the full string
  const phoneMatches = value.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g);
  if (phoneMatches) {
    for (const match of phoneMatches) {
      const trimmed = match.trim();
      if (isLikelyPhone(trimmed) && !phones.some((p) => p.replace(/\D/g, '') === trimmed.replace(/\D/g, ''))) {
        phones.push(trimmed);
      }
    }
  }
  return phones;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return isLikelyEmail(email);
}
