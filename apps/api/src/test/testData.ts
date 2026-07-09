import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

export const TEST_DATA_ROOT = join(__dirname, '..', '..', '..', '..', 'test-data');

export function loadTestCsv(relativePath: string): Buffer {
  const fullPath = join(TEST_DATA_ROOT, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Test fixture not found: ${fullPath}`);
  }
  return readFileSync(fullPath);
}

export const TEST_FILES = {
  exactSchema: 'valid/01_exact_schema.csv',
  facebook: 'valid/02_facebook_export.csv',
  googleAds: 'valid/03_google_ads.csv',
  realEstate: 'valid/04_real_estate.csv',
  weirdHeaders: 'messy/05_weird_headers.csv',
  ambiguous: 'messy/06_ambiguous_columns.csv',
  multipleContacts: 'messy/07_multiple_contacts.csv',
  multipleContactsTest: 'messy/multiple_contacts_test.csv',
  invalidRecords: 'messy/08_invalid_records.csv',
  messyDates: 'messy/09_messy_dates.csv',
  statusVariations: 'messy/10_status_variations.csv',
  dataSources: 'messy/11_data_sources.csv',
  edgeCases: 'messy/12_csv_edge_cases.csv',
  emptyValues: 'messy/13_empty_values.csv',
  irrelevantColumns: 'messy/14_irrelevant_columns.csv',
  promptInjection: 'adversarial/17_prompt_injection.csv',
  promptInjectionTest: 'adversarial/prompt_injection_test.csv',
  malformed: 'invalid/18_malformed.csv',
  empty: 'invalid/19_empty.csv',
  duplicateHeaders: 'invalid/20_duplicate_headers.csv',
  mappingA: 'messy/mapping_variant_a.csv',
  mappingB: 'messy/mapping_variant_b.csv',
  mappingC: 'messy/mapping_variant_c.csv',
  mappingD: 'messy/mapping_variant_d.csv',
  allFields: 'valid/all_crm_fields.csv',
  large1000: 'performance/15_large_1000_rows.csv',
  large10000: 'performance/16_large_10000_rows.csv',
} as const;
