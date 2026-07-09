import type {
  CrmRecord,
  SkippedRecord,
  ConfirmedMapping,
  ParsedRow,
  ExtractedRecord,
} from '@groeasy/shared';
import { createEmptyCrmRecord, CRM_FIELDS } from '@groeasy/shared';
import {
  normalizeEmail,
  validateEmail,
  extractEmails,
  extractPhones,
} from '../csv/patterns';
import {
  normalizeCrmStatus,
  normalizeDataSource,
  parsePhone,
  normalizeDate,
} from './normalization';
import {
  applyContactCandidates,
  collectContactCandidates,
  isContactTargetField,
  sanitizeGeographicFields,
  shouldRejectValueForField,
} from './contactSelection';
import { enforceSourceGrounding, normalizeOptionalAiText } from './fieldGrounding';

export function hasValidContact(record: CrmRecord): boolean {
  const hasEmail = record.email.trim() !== '' && validateEmail(record.email);
  const hasPhone = record.mobile_without_country_code.trim() !== '' &&
    record.mobile_without_country_code.replace(/\D/g, '').length >= 7;
  return hasEmail || hasPhone;
}

export function buildCrmRecordFromExtracted(
  extracted: ExtractedRecord,
  sourceRow: ParsedRow,
  mappings: ConfirmedMapping[],
): { record: CrmRecord; skip?: SkippedRecord } {
  const record = createEmptyCrmRecord();
  const noteParts: string[] = [];

  const { emails, phones } = collectContactCandidates(sourceRow);
  applyContactCandidates(record, emails, phones, noteParts, record.country);

  for (const mapping of mappings) {
    if (mapping.target_field === '__ignore__') continue;
    if (isContactTargetField(mapping.target_field)) continue;

    const sourceValue = sourceRow.data[mapping.source_column] ?? '';
    if (!sourceValue.trim()) continue;
    if (shouldRejectValueForField(mapping.target_field as keyof CrmRecord, sourceValue)) {
      continue;
    }

    applyFieldValue(record, mapping.target_field as keyof CrmRecord, sourceValue, noteParts);
  }

  for (const [field, value] of Object.entries(extracted.fields)) {
    if (!value?.trim()) continue;
    const cleanedValue = normalizeOptionalAiText(value);
    if (!cleanedValue) continue;
    if ((CRM_FIELDS as readonly string[]).includes(field)) {
      if (isContactTargetField(field)) {
        applyContactOverlay(record, field as keyof CrmRecord, cleanedValue, noteParts);
        continue;
      }
      if (shouldRejectValueForField(field as keyof CrmRecord, cleanedValue)) {
        continue;
      }
      applyFieldValue(record, field as keyof CrmRecord, cleanedValue, noteParts);
    } else if (field === 'extra_emails') {
      mergeExtraEmails(record, extractEmails(value), noteParts);
    } else if (field === 'extra_phones') {
      mergeExtraPhones(record, extractPhones(value), noteParts);
    }
  }

  record.email = record.email ? normalizeEmail(record.email) : '';
  if (record.email && !validateEmail(record.email)) {
    noteParts.push(`Invalid email preserved: ${record.email}`);
    record.email = '';
  }

  if (record.mobile_without_country_code) {
    const parts = parsePhone(record.mobile_without_country_code, record.country);
    if (!record.country_code) record.country_code = parts.country_code;
    record.mobile_without_country_code = parts.mobile_without_country_code;
  }

  record.crm_status = normalizeCrmStatus(record.crm_status) as CrmRecord['crm_status'];
  record.data_source = normalizeDataSource(record.data_source) as CrmRecord['data_source'];
  record.created_at = normalizeDate(record.created_at);
  record.possession_time = normalizeDate(record.possession_time);

  sanitizeGeographicFields(record);
  enforceSourceGrounding(record, sourceRow, mappings);

  if (noteParts.length > 0) {
    const existing = record.crm_note.trim();
    const combined = [...(existing ? [existing] : []), ...noteParts];
    record.crm_note = combined.join('; ').replace(/\n+/g, ' ').trim();
  }

  for (const field of CRM_FIELDS) {
    (record as Record<string, string>)[field] = record[field].trim();
  }

  if (extracted.skip && !hasValidContact(record)) {
    return {
      record,
      skip: {
        row_number: extracted.row_number,
        reason: extracted.skip_reason ?? 'Marked as skip by extraction',
        original_record: sourceRow.data,
      },
    };
  }

  if (!hasValidContact(record)) {
    return {
      record,
      skip: {
        row_number: extracted.row_number,
        reason: 'Record contains neither a valid email address nor a usable mobile number.',
        original_record: sourceRow.data,
      },
    };
  }

  return { record };
}

function mergeExtraEmails(
  record: CrmRecord,
  emails: string[],
  noteParts: string[],
): void {
  const extras = [...emails];
  if (!record.email && extras.length > 0) {
    record.email = normalizeEmail(extras.shift()!);
  }
  if (extras.length > 0) {
    noteParts.push(`Additional emails: ${extras.join(', ')}`);
  }
}

function mergeExtraPhones(
  record: CrmRecord,
  phones: string[],
  noteParts: string[],
): void {
  const extras = [...phones];
  if (!record.mobile_without_country_code && extras.length > 0) {
    const parts = parsePhone(extras.shift()!, record.country);
    record.country_code = parts.country_code || record.country_code;
    record.mobile_without_country_code = parts.mobile_without_country_code;
  }
  if (extras.length > 0) {
    noteParts.push(`Additional phones: ${extras.join(', ')}`);
  }
}

function applyContactOverlay(
  record: CrmRecord,
  field: keyof CrmRecord,
  value: string,
  noteParts: string[],
): void {
  if (field === 'email') {
    mergeExtraEmails(record, extractEmails(value), noteParts);
  } else if (field === 'mobile_without_country_code' || field === 'country_code') {
    mergeExtraPhones(record, extractPhones(value), noteParts);
  }
}

function applyFieldValue(
  record: CrmRecord,
  field: keyof CrmRecord,
  value: string,
  noteParts: string[],
): void {
  if (field === 'created_at' || field === 'possession_time') {
    record[field] = value.trim();
    return;
  }

  switch (field) {
    case 'crm_status':
      record.crm_status = value.trim() as CrmRecord['crm_status'];
      break;
    case 'data_source':
      record.data_source = value.trim() as CrmRecord['data_source'];
      break;
    case 'crm_note':
      if (value.trim()) noteParts.push(value.trim());
      break;
    default:
      if (!record[field]) {
        record[field] = value.trim();
      }
  }
}

export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
