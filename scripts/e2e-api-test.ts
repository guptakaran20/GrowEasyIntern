/**
 * End-to-end API validation against live backend + Gemini.
 * Run: npx tsx scripts/e2e-api-test.ts
 */
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', 'apps', 'api', '.env') });

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

interface DatasetResult {
  file: string;
  inputRows: number;
  imported: number;
  skipped: number;
  mappings: Array<{ source: string; target: string; confidence?: number }>;
  errors: string[];
  warnings: string[];
}

async function analyzeAndImport(relativePath: string): Promise<DatasetResult> {
  const filePath = join(__dirname, '..', 'test-data', relativePath);
  const fileName = relativePath.split('/').pop() ?? relativePath;
  const buffer = readFileSync(filePath);
  const blob = new Blob([buffer], { type: 'text/csv' });
  const form = new FormData();
  form.append('file', blob, fileName);

  const analyzeRes = await fetch(`${API}/api/csv/analyze`, { method: 'POST', body: form });
  const analyzeJson = await analyzeRes.json() as { success: boolean; data?: unknown; error?: { message: string } };

  if (!analyzeJson.success) {
    return {
      file: relativePath,
      inputRows: 0,
      imported: 0,
      skipped: 0,
      mappings: [],
      errors: [analyzeJson.error?.message ?? 'Analyze failed'],
      warnings: [],
    };
  }

  const analysis = analyzeJson.data as {
    row_count: number;
    inferred_mapping: { mappings: Array<{ source_column: string; target_field: string; confidence: number }>; warnings: string[] };
    all_rows: unknown[];
    file_name: string;
  };

  const mappings = analysis.inferred_mapping.mappings.map((m) => ({
    source_column: m.source_column,
    target_field: m.target_field,
  }));

  const importRes = await fetch(`${API}/api/import/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_name: analysis.file_name,
      mappings,
      rows: analysis.all_rows,
    }),
  });

  const importJson = await importRes.json() as { success: boolean; data?: { imported_count: number; skipped_count: number; total_rows: number; warnings: string[] }; error?: { message: string } };

  if (!importJson.success) {
    return {
      file: relativePath,
      inputRows: analysis.row_count,
      imported: 0,
      skipped: 0,
      mappings: analysis.inferred_mapping.mappings.map((m) => ({ source: m.source_column, target: m.target_field, confidence: m.confidence })),
      errors: [importJson.error?.message ?? 'Import failed'],
      warnings: analysis.inferred_mapping.warnings,
    };
  }

  const result = importJson.data!;
  return {
    file: relativePath,
    inputRows: result.total_rows,
    imported: result.imported_count,
    skipped: result.skipped_count,
    mappings: analysis.inferred_mapping.mappings.map((m) => ({ source: m.source_column, target: m.target_field, confidence: m.confidence })),
    errors: [],
    warnings: [...analysis.inferred_mapping.warnings, ...result.warnings],
  };
}

const DATASETS = [
  'valid/01_exact_schema.csv',
  'valid/02_facebook_export.csv',
  'valid/03_google_ads.csv',
  'valid/04_real_estate.csv',
  'messy/06_ambiguous_columns.csv',
  'messy/07_multiple_contacts.csv',
  'messy/08_invalid_records.csv',
  'adversarial/17_prompt_injection.csv',
];

async function main() {
  console.log('=== E2E API Test ===\n');
  const health = await fetch(`${API}/health`);
  if (!health.ok) {
    console.error('Backend not reachable at', API);
    process.exit(1);
  }

  for (const ds of DATASETS) {
    console.log(`--- ${ds} ---`);
    try {
      const r = await analyzeAndImport(ds);
      console.log(`  Input rows: ${r.inputRows}`);
      console.log(`  Imported:   ${r.imported}`);
      console.log(`  Skipped:    ${r.skipped}`);
      console.log(`  Mappings:   ${r.mappings.map((m) => `${m.source}->${m.target}`).join(', ')}`);
      if (r.warnings.length) console.log(`  Warnings:   ${r.warnings.join('; ')}`);
      if (r.errors.length) console.log(`  ERRORS:     ${r.errors.join('; ')}`);
    } catch (err) {
      console.log(`  FATAL: ${(err as Error).message}`);
    }
    console.log('');
  }
}

main().catch(console.error);
