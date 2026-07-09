import { z } from 'zod';
import {
  CRM_FIELDS,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  IGNORE_FIELD,
} from './constants';

/** Final CRM record schema — all fields required as strings */
export const crmRecordSchema = z.object({
  created_at: z.string(),
  name: z.string(),
  email: z.string(),
  country_code: z.string(),
  mobile_without_country_code: z.string(),
  company: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  lead_owner: z.string(),
  crm_status: z.union([z.enum(CRM_STATUS_VALUES), z.literal('')]),
  crm_note: z.string(),
  data_source: z.union([z.enum(DATA_SOURCE_VALUES), z.literal('')]),
  possession_time: z.string(),
  description: z.string(),
});

export type CrmRecord = z.infer<typeof crmRecordSchema>;

/** Create an empty CRM record with all fields as empty strings */
export function createEmptyCrmRecord(): CrmRecord {
  return {
    created_at: '',
    name: '',
    email: '',
    country_code: '',
    mobile_without_country_code: '',
    company: '',
    city: '',
    state: '',
    country: '',
    lead_owner: '',
    crm_status: '',
    crm_note: '',
    data_source: '',
    possession_time: '',
    description: '',
  };
}

/** Skipped record during import */
export const skippedRecordSchema = z.object({
  row_number: z.number().int().positive(),
  reason: z.string(),
  original_record: z.record(z.string()),
});

export type SkippedRecord = z.infer<typeof skippedRecordSchema>;

/** Column mapping from schema inference */
export const columnMappingSchema = z.object({
  source_column: z.string(),
  target_field: z.union([z.enum(CRM_FIELDS), z.literal(IGNORE_FIELD)]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;

/** Schema inference AI response (Stage A) */
export const schemaInferenceResponseSchema = z.object({
  mappings: z.array(columnMappingSchema),
  unmapped_columns: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type SchemaInferenceResponse = z.infer<typeof schemaInferenceResponseSchema>;

/** Single extracted record from batch AI (Stage B) */
export const extractedRecordSchema = z.object({
  row_number: z.number().int().positive(),
  fields: z.record(z.string()),
  skip: z.boolean().optional(),
  skip_reason: z.string().optional(),
});

export type ExtractedRecord = z.infer<typeof extractedRecordSchema>;

/** Batch extraction AI response (Stage B) */
export const batchExtractionResponseSchema = z.object({
  records: z.array(extractedRecordSchema),
});

export type BatchExtractionResponse = z.infer<typeof batchExtractionResponseSchema>;

/** Column profile from deterministic profiling */
export const columnProfileSchema = z.object({
  original_header: z.string(),
  normalized_header: z.string(),
  total_sampled: z.number().int().nonnegative(),
  non_empty_count: z.number().int().nonnegative(),
  empty_ratio: z.number().min(0).max(1),
  unique_ratio: z.number().min(0).max(1),
  representative_values: z.array(z.string()),
  likely_email_ratio: z.number().min(0).max(1),
  likely_phone_ratio: z.number().min(0).max(1),
  likely_date_ratio: z.number().min(0).max(1),
  likely_url_ratio: z.number().min(0).max(1),
  avg_value_length: z.number().nonnegative(),
  deterministic_hint: z.string().nullable(),
});

export type ColumnProfile = z.infer<typeof columnProfileSchema>;

/** Deterministic semantic hint for a column */
export const semanticHintSchema = z.object({
  column: z.string(),
  suggested_field: z.union([z.enum(CRM_FIELDS), z.literal(IGNORE_FIELD)]).nullable(),
  hint_source: z.enum(['header_alias', 'value_pattern', 'none']),
  confidence: z.number().min(0).max(1),
});

export type SemanticHint = z.infer<typeof semanticHintSchema>;

/** Parsed CSV row with source row number */
export const parsedRowSchema = z.object({
  row_number: z.number().int().positive(),
  data: z.record(z.string()),
});

export type ParsedRow = z.infer<typeof parsedRowSchema>;

/** API error shape */
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.string()).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Successful API response wrapper */
export function apiSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

/** Analysis response from POST /api/csv/analyze */
export const analysisResponseSchema = z.object({
  file_name: z.string(),
  file_size: z.number(),
  row_count: z.number().int().nonnegative(),
  column_count: z.number().int().nonnegative(),
  headers: z.array(z.string()),
  column_profiles: z.array(columnProfileSchema),
  semantic_hints: z.array(semanticHintSchema),
  sample_rows: z.array(parsedRowSchema),
  inferred_mapping: schemaInferenceResponseSchema,
  all_rows: z.array(parsedRowSchema),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

/** Confirmed mapping from user review */
export const confirmedMappingSchema = z.object({
  source_column: z.string(),
  target_field: z.union([z.enum(CRM_FIELDS), z.literal(IGNORE_FIELD)]),
});

export type ConfirmedMapping = z.infer<typeof confirmedMappingSchema>;

/** Import process request */
export const importProcessRequestSchema = z.object({
  file_name: z.string(),
  mappings: z.array(confirmedMappingSchema),
  rows: z.array(parsedRowSchema),
});

export type ImportProcessRequest = z.infer<typeof importProcessRequestSchema>;

/** Import result */
export const importResultSchema = z.object({
  file_name: z.string(),
  total_rows: z.number().int().nonnegative(),
  imported_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(100),
  imported_records: z.array(crmRecordSchema),
  skipped_records: z.array(skippedRecordSchema),
  mappings_used: z.array(confirmedMappingSchema),
  warnings: z.array(z.string()),
  duration_ms: z.number().nonnegative(),
});

export type ImportResult = z.infer<typeof importResultSchema>;

/** Import progress for SSE */
export const importProgressSchema = z.object({
  job_id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'partial']),
  stage: z.string(),
  rows_processed: z.number().int().nonnegative(),
  total_rows: z.number().int().nonnegative(),
  imported_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  current_batch: z.number().int().nonnegative(),
  total_batches: z.number().int().nonnegative(),
  error: z.string().optional(),
});

export type ImportProgress = z.infer<typeof importProgressSchema>;

/** Start import response */
export const startImportResponseSchema = z.object({
  job_id: z.string(),
});

export type StartImportResponse = z.infer<typeof startImportResponseSchema>;

/** Repair prompt response for failed records */
export const repairResponseSchema = z.object({
  row_number: z.number().int().positive(),
  fields: z.record(z.string()),
});

export type RepairResponse = z.infer<typeof repairResponseSchema>;
