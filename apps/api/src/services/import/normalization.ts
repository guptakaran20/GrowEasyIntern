import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from '@groeasy/shared';
import type { CrmStatus, DataSource } from '@groeasy/shared';

const STATUS_PATTERNS: Array<{ pattern: RegExp; status: CrmStatus }> = [
  // BAD and negative patterns first to avoid "not interested" matching "interested"
  { pattern: /\b(bad\s*lead|not\s*interested|invalid|junk|spam|wrong\s*number|disqualified|rejected|cold)\b/i, status: 'BAD_LEAD' },
  { pattern: /\b(not\s*connected|no\s*answer|not\s*answering|unreachable|busy|didn'?t\s*pick|call\s*failed|no\s*response|nc|not\s*reachable|phone\s*switched\s*off|switched\s*off)\b/i, status: 'DID_NOT_CONNECT' },
  { pattern: /\b(sold|closed\s*won|deal\s*closed|converted|sale\s*complete|booked|confirmed|payment\s*completed)\b/i, status: 'SALE_DONE' },
  { pattern: /\b(good\s*lead|follow\s*up|interested|callback|hot|warm|contact\s*later|qualified|prospect|call\s*tomorrow)\b/i, status: 'GOOD_LEAD_FOLLOW_UP' },
];

const SOURCE_PATTERNS: Array<{ pattern: RegExp; source: DataSource }> = [
  { pattern: /\bleads?\s*on\s*demand\b/i, source: 'leads_on_demand' },
  { pattern: /\bmeridian\s*tower\b/i, source: 'meridian_tower' },
  { pattern: /\beden\s*park\b/i, source: 'eden_park' },
  { pattern: /\bvarah\s*swamy\b/i, source: 'varah_swamy' },
  { pattern: /\bsarjapur\s*plots?\b/i, source: 'sarjapur_plots' },
];

export function normalizeCrmStatus(value: string): CrmStatus | '' {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if ((CRM_STATUS_VALUES as readonly string[]).includes(upper)) {
    return upper as CrmStatus;
  }

  for (const { pattern, status } of STATUS_PATTERNS) {
    if (pattern.test(trimmed)) return status;
  }

  return '';
}

export function normalizeDataSource(value: string): DataSource | '' {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if ((DATA_SOURCE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DataSource;
  }

  for (const { pattern, source } of SOURCE_PATTERNS) {
    if (pattern.test(trimmed)) return source;
  }

  return '';
}

export interface PhoneParts {
  country_code: string;
  mobile_without_country_code: string;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  india: '+91',
  in: '+91',
  usa: '+1',
  us: '+1',
  uk: '+44',
  'united kingdom': '+44',
  australia: '+61',
  au: '+61',
  canada: '+1',
  ca: '+1',
  uae: '+971',
  dubai: '+971',
};

export function parsePhone(
  phone: string,
  countryHint?: string,
): PhoneParts {
  const result: PhoneParts = { country_code: '', mobile_without_country_code: '' };
  if (!phone.trim()) return result;

  const cleaned = phone.trim().replace(/[^\d+]/g, '');

  // Handle + prefix
  if (cleaned.startsWith('+')) {
    // Try common country codes
    const codes = ['+91', '+1', '+44', '+61', '+971', '+65', '+81', '+86'];
    for (const code of codes.sort((a, b) => b.length - a.length)) {
      if (cleaned.startsWith(code)) {
        result.country_code = code;
        result.mobile_without_country_code = cleaned.slice(code.length);
        return result;
      }
    }
    // Generic: take first 1-3 digits as country code
    const match = cleaned.match(/^\+(\d{1,3})(\d+)$/);
    if (match) {
      result.country_code = `+${match[1]}`;
      result.mobile_without_country_code = match[2];
      return result;
    }
  }

  // Handle leading country code without +
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    result.country_code = '+91';
    result.mobile_without_country_code = cleaned.slice(2);
    return result;
  }
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    result.country_code = '+1';
    result.mobile_without_country_code = cleaned.slice(1);
    return result;
  }

  // 10-digit Indian mobile
  if (/^\d{10}$/.test(cleaned)) {
    result.mobile_without_country_code = cleaned;
    if (countryHint) {
      const hint = countryHint.toLowerCase().trim();
      if (COUNTRY_CODE_MAP[hint]) {
        result.country_code = COUNTRY_CODE_MAP[hint];
      } else if (hint === 'india' || hint === 'in') {
        result.country_code = '+91';
      }
    }
    return result;
  }

  // Fallback: store as mobile without splitting
  result.mobile_without_country_code = cleaned.replace(/^\+/, '');
  return result;
}

export function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + 'T00:00:00.000Z');
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in India)
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // MM/DD/YYYY — only if day > 12 (unambiguous)
  const mdyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdyMatch) {
    const [, a, b, year] = mdyMatch;
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (numA > 12 && numB <= 12) {
      // Must be DD/MM
      const d = new Date(`${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}T00:00:00.000Z`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Textual month
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  // Excel serial date
  const excelNum = parseFloat(trimmed);
  if (!isNaN(excelNum) && excelNum > 30000 && excelNum < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + excelNum * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return '';
}

export function isValidDate(value: string): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}
