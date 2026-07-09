/** Allowed CRM status values */
export const CRM_STATUS_VALUES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

/** Allowed data source values */
export const DATA_SOURCE_VALUES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

/** All target CRM fields */
export const CRM_FIELDS = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description',
] as const;

export type CrmField = (typeof CRM_FIELDS)[number];

/** Special mapping target for ignored columns */
export const IGNORE_FIELD = '__ignore__' as const;

export type MappingTarget = CrmField | typeof IGNORE_FIELD;

/** Exact field order for CSV export */
export const CRM_FIELD_ORDER: readonly CrmField[] = CRM_FIELDS;

/** Human-readable labels for CRM fields */
export const CRM_FIELD_LABELS: Record<CrmField, string> = {
  created_at: 'Created At',
  name: 'Name',
  email: 'Email',
  country_code: 'Country Code',
  mobile_without_country_code: 'Mobile',
  company: 'Company',
  city: 'City',
  state: 'State',
  country: 'Country',
  lead_owner: 'Lead Owner',
  crm_status: 'CRM Status',
  crm_note: 'CRM Note',
  data_source: 'Data Source',
  possession_time: 'Possession Time',
  description: 'Description',
};

/** Confidence tier thresholds */
export const CONFIDENCE_TIERS = {
  HIGH: 0.85,
  MEDIUM: 0.6,
} as const;

export type ConfidenceTier = 'high' | 'medium' | 'low';

export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= CONFIDENCE_TIERS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_TIERS.MEDIUM) return 'medium';
  return 'low';
}

/** Import flow states for frontend state machine */
export const IMPORT_STATES = [
  'IDLE',
  'FILE_SELECTED',
  'PREVIEW_READY',
  'ANALYZING',
  'MAPPING_REVIEW',
  'IMPORTING',
  'COMPLETED',
  'ERROR',
] as const;

export type ImportState = (typeof IMPORT_STATES)[number];

/** Application limits */
export const LIMITS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_ROWS: 10_000,
  MAX_COLUMNS: 100,
  PROFILE_SAMPLE_ROWS: 50,
  SCHEMA_INFERENCE_SAMPLE_ROWS: 15,
  DEFAULT_BATCH_SIZE: 25,
  DEFAULT_BATCH_CONCURRENCY: 2,
  MAX_AI_RETRIES: 3,
  MAX_PREVIEW_ROWS: 100,
} as const;
