import type { ConfirmedMapping, CrmRecord, ParsedRow } from '@groeasy/shared';
import { shouldRejectValueForField } from './contactSelection';
import { normalizeDate } from './normalization';

/** Optional CRM text fields that must not be invented without mapped source evidence */
export const SOURCE_GROUNDED_FIELDS = [
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'possession_time',
] as const satisfies readonly (keyof CrmRecord)[];

export type SourceGroundedField = (typeof SOURCE_GROUNDED_FIELDS)[number];

const PLACEHOLDER_EXACT = new Set([
  'unknown',
  'unknown state',
  'unknown state/province',
  'unknown state / province',
  'n/a',
  'na',
  'none',
  'null',
  'not available',
  'not provided',
  'unspecified',
  '-',
]);

/** Country tokens used only to block country names in state without source evidence */
const KNOWN_COUNTRY_TOKENS = new Set([
  'india',
  'in',
  'usa',
  'us',
  'united states',
  'uk',
  'united kingdom',
  'australia',
  'au',
  'canada',
  'ca',
  'uae',
  'dubai',
]);

function normalizeComparable(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/');
}

function stripTrailingEllipsis(value: string): string {
  return value.replace(/\.{2,}$/, '').trim();
}

/**
 * True when the entire value is an AI missing-value placeholder (case-insensitive).
 * Does not match legitimate sentences that merely contain the word "unknown".
 */
export function isMissingValuePlaceholder(value: string): boolean {
  const trimmed = stripTrailingEllipsis(value.trim());
  if (!trimmed) return true;

  const normalized = normalizeComparable(trimmed);
  if (PLACEHOLDER_EXACT.has(normalized)) return true;

  if (normalized.startsWith('unknown state') && normalized.length <= 48) {
    return true;
  }

  return false;
}

/** Normalize AI missing-value placeholders to blank; otherwise return trimmed value */
export function normalizeOptionalAiText(value: string): string {
  if (isMissingValuePlaceholder(value)) return '';
  return value.trim();
}

export function isKnownCountryName(value: string): boolean {
  const normalized = normalizeComparable(value);
  return KNOWN_COUNTRY_TOKENS.has(normalized);
}

/** Non-empty mapped source values that are valid evidence for a CRM field */
export function getMappedSourceEvidence(
  sourceRow: ParsedRow,
  mappings: ConfirmedMapping[],
  field: keyof CrmRecord,
): string[] {
  return mappings
    .filter((mapping) => mapping.target_field === field)
    .map((mapping) => sourceRow.data[mapping.source_column] ?? '')
    .filter((value) => {
      const trimmed = value.trim();
      if (!trimmed || isMissingValuePlaceholder(trimmed)) return false;
      return !shouldRejectValueForField(field, trimmed);
    });
}

export function hasSourceEvidenceForField(
  sourceRow: ParsedRow,
  mappings: ConfirmedMapping[],
  field: keyof CrmRecord,
): boolean {
  return getMappedSourceEvidence(sourceRow, mappings, field).length > 0;
}

function valuesMatchGrounded(field: SourceGroundedField, value: string, evidence: string[]): boolean {
  if (evidence.length === 0) return false;

  const normalizedValue = normalizeComparable(value);
  if (!normalizedValue) return false;

  return evidence.some((sourceValue) => {
    const normalizedSource = normalizeComparable(sourceValue);
    if (normalizedValue === normalizedSource) return true;

    if (field === 'possession_time') {
      const parsedValue = normalizeDate(value);
      const parsedSource = normalizeDate(sourceValue);
      if (parsedValue && parsedSource && parsedValue === parsedSource) return true;
    }

    return false;
  });
}

function shouldClearStateAsMisplacedCountry(
  stateValue: string,
  sourceRow: ParsedRow,
  mappings: ConfirmedMapping[],
): boolean {
  if (!isKnownCountryName(stateValue)) return false;

  const stateEvidence = getMappedSourceEvidence(sourceRow, mappings, 'state');
  if (stateEvidence.some((evidence) => normalizeComparable(evidence) === normalizeComparable(stateValue))) {
    return false;
  }

  return true;
}

/** Clear optional CRM fields that are placeholders or not grounded in mapped source data */
export function enforceSourceGrounding(
  record: CrmRecord,
  sourceRow: ParsedRow,
  mappings: ConfirmedMapping[],
): void {
  for (const field of SOURCE_GROUNDED_FIELDS) {
    const current = record[field].trim();
    if (!current) continue;

    if (isMissingValuePlaceholder(current)) {
      record[field] = '';
      continue;
    }

    const evidence = getMappedSourceEvidence(sourceRow, mappings, field);
    if (!valuesMatchGrounded(field, current, evidence)) {
      record[field] = '';
    }
  }

  if (record.state.trim() && shouldClearStateAsMisplacedCountry(record.state, sourceRow, mappings)) {
    record.state = '';
  }
}
