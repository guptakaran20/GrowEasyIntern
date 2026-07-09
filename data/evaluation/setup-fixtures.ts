import { readFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const FIXTURES = join(ROOT, 'data', 'evaluation', 'fixtures');
const EXPECTED = join(ROOT, 'data', 'evaluation', 'expected', 'expected-results.json');
const TEST_DATA = join(ROOT, 'data', 'test-data');

mkdirSync(FIXTURES, { recursive: true });

const FIXTURE_MAP: Record<string, string> = {
  'facebook.csv': 'valid/02_facebook_export.csv',
  'real-estate.csv': 'valid/04_real_estate.csv',
  'ambiguous.csv': 'messy/06_ambiguous_columns.csv',
  'invalid-records.csv': 'messy/08_invalid_records.csv',
  'messy.csv': 'messy/12_csv_edge_cases.csv',
};

for (const [dest, src] of Object.entries(FIXTURE_MAP)) {
  const srcPath = join(TEST_DATA, src);
  const destPath = join(FIXTURES, dest);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
  }
}

export {};
