/**

 * AI accuracy benchmark — measures extraction quality against curated fixtures.

 */

import dotenv from 'dotenv';

import { readFileSync, existsSync } from 'fs';

import { join } from 'path';

import type { CrmRecord } from '@groeasy/shared';



const ROOT = join(__dirname, '..', '..');

dotenv.config({ path: join(ROOT, 'apps', 'api', '.env') });



interface ExpectedConfig {

  min_valid_records?: number;

  min_skipped_records?: number;

  total_rows?: number;

  requires_roundtrip?: boolean;

  row_expectations?: Array<{

    row: number;

    email?: string;

    mobile?: string;

    crm_status?: string;

  }>;

}



interface DatasetScore {

  file: string;

  schemaValidity: number;

  validContactRetention: number;

  statusAccuracy: number;

  sourceAccuracy: number;

  invalidDetection: number;

  roundtripOk: boolean;

  overall: number;

  importedCount: number;

  skippedCount: number;

  totalRows: number;

}



type FixtureStatus = 'passed' | 'failed' | 'error';



interface FixtureResult {

  file: string;

  status: FixtureStatus;

  score?: DatasetScore;

  error?: string;

}



interface EvaluationArtifacts {

  mappings: Array<{ source_column: string; target_field: string }>;

  inferenceWarnings: string[];

  extractionRecords: Array<{

    row_number: number;

    fields: Record<string, string>;

    skip?: boolean;

    skip_reason?: string;

  }>;

  imported: CrmRecord[];

  skipped: Array<{ row_number: number; reason: string; original_record: Record<string, string> }>;

  rowOutcomes: Array<{

    row_number: number;

    sourceRow: Record<string, string>;

    imported: boolean;

    skipReason?: string;

    record?: CrmRecord;

    schemaErrors?: string[];

    contactCandidates: { emails: string[]; phones: string[] };

  }>;

}



async function main() {

  const { parseCsvBuffer } = await import('../apps/api/src/services/csv/parser');

  const { profileDataset, getSampleRows } = await import('../apps/api/src/services/csv/profiler');

  const { inferSchema, extractBatch } = await import('../apps/api/src/services/ai/geminiService');

  const { buildCrmRecordFromExtracted } = await import('../apps/api/src/services/import/recordBuilder');

  const { collectContactCandidates } = await import('../apps/api/src/services/import/contactSelection');

  const { exportRecordsToCsv } = await import('../apps/api/src/utils/csvExport');

  const {

    CRM_STATUS_VALUES,

    DATA_SOURCE_VALUES,

    crmRecordSchema,

    LIMITS,

  } = await import('@groeasy/shared');



  const FIXTURES = join(ROOT, 'evaluation', 'fixtures');

  const EXPECTED_PATH = join(ROOT, 'evaluation', 'expected', 'expected-results.json');



  function schemaValidationErrors(record: CrmRecord): string[] {

    const result = crmRecordSchema.safeParse(record);

    if (result.success) return [];

    return result.error.issues.map(

      (issue) => `${issue.path.join('.')}: ${issue.message}`,

    );

  }



  async function evaluateDataset(

    fileName: string,

    expected: ExpectedConfig,

  ): Promise<{ score: DatasetScore; artifacts: EvaluationArtifacts }> {

    const path = join(FIXTURES, fileName);

    if (!existsSync(path)) {

      throw new Error(`Fixture not found: ${fileName}`);

    }



    const buffer = readFileSync(path);

    const { headers, rows } = parseCsvBuffer(buffer, fileName);

    const { profiles, hints } = profileDataset(headers, rows);

    const sampleRows = getSampleRows(rows, LIMITS.SCHEMA_INFERENCE_SAMPLE_ROWS);



    const inference = await inferSchema(headers, profiles, hints, sampleRows);

    const mappings = inference.mappings.map((m) => ({

      source_column: m.source_column,

      target_field: m.target_field,

    }));



    const batchRows = rows.map((r) => ({ row_number: r.row_number, data: r.data }));

    const extraction = await extractBatch(mappings, batchRows);

    const rowMap = new Map(rows.map((r) => [r.row_number, r]));



    const imported: CrmRecord[] = [];

    const skipped: EvaluationArtifacts['skipped'] = [];

    const rowOutcomes: EvaluationArtifacts['rowOutcomes'] = [];

    let schemaValid = 0;

    let statusValid = 0;

    let sourceValid = 0;



    for (const extracted of extraction.records) {

      const sourceRow = rowMap.get(extracted.row_number);

      if (!sourceRow) continue;



      const contactCandidates = collectContactCandidates(sourceRow);

      const result = buildCrmRecordFromExtracted(extracted, sourceRow, mappings);



      if (result.skip) {

        skipped.push({

          row_number: extracted.row_number,

          reason: result.skip.reason,

          original_record: result.skip.original_record,

        });

        rowOutcomes.push({

          row_number: extracted.row_number,

          sourceRow: sourceRow.data,

          imported: false,

          skipReason: result.skip.reason,

          contactCandidates,

        });

      } else {

        imported.push(result.record);

        const errors = schemaValidationErrors(result.record);

        if (errors.length === 0) schemaValid++;



        const statusOk =

          result.record.crm_status === '' ||

          (CRM_STATUS_VALUES as readonly string[]).includes(result.record.crm_status);

        const sourceOk =

          result.record.data_source === '' ||

          (DATA_SOURCE_VALUES as readonly string[]).includes(result.record.data_source);

        if (statusOk) statusValid++;

        if (sourceOk) sourceValid++;



        rowOutcomes.push({

          row_number: extracted.row_number,

          sourceRow: sourceRow.data,

          imported: true,

          record: result.record,

          schemaErrors: errors.length > 0 ? errors : undefined,

          contactCandidates,

        });

      }

    }



    for (const row of rows) {

      if (!rowOutcomes.some((outcome) => outcome.row_number === row.row_number)) {

        rowOutcomes.push({

          row_number: row.row_number,

          sourceRow: row.data,

          imported: false,

          skipReason: 'No extraction record returned for row',

          contactCandidates: collectContactCandidates(row),

        });

      }

    }



    rowOutcomes.sort((a, b) => a.row_number - b.row_number);



    const schemaValidity = imported.length > 0 ? (schemaValid / imported.length) * 100 : 0;

    const validRetention =

      expected.min_valid_records != null

        ? Math.min(imported.length / expected.min_valid_records, 1) * 100

        : 100;

    const invalidDetection =

      expected.min_skipped_records != null

        ? Math.min(skipped.length / expected.min_skipped_records, 1) * 100

        : 100;



    let roundtripOk = true;

    if (expected.requires_roundtrip && imported.length > 0) {

      const csv = exportRecordsToCsv(imported);

      try {

        const reparsed = parseCsvBuffer(Buffer.from(csv), 'roundtrip.csv');

        roundtripOk = reparsed.rowCount === imported.length;

      } catch {

        roundtripOk = false;

      }

    }



    const overall =

      (schemaValidity +

        validRetention +

        (imported.length > 0 ? (statusValid / imported.length) * 100 : 100) +

        (imported.length > 0 ? (sourceValid / imported.length) * 100 : 100) +

        invalidDetection +

        (roundtripOk ? 100 : 0)) /

      6;



    return {

      score: {

        file: fileName,

        schemaValidity: Math.round(schemaValidity * 10) / 10,

        validContactRetention: Math.round(validRetention * 10) / 10,

        statusAccuracy: imported.length > 0 ? Math.round((statusValid / imported.length) * 1000) / 10 : 100,

        sourceAccuracy: imported.length > 0 ? Math.round((sourceValid / imported.length) * 1000) / 10 : 100,

        invalidDetection: Math.round(invalidDetection * 10) / 10,

        roundtripOk,

        overall: Math.round(overall * 10) / 10,

        importedCount: imported.length,

        skippedCount: skipped.length,

        totalRows: rows.length,

      },

      artifacts: {

        mappings,

        inferenceWarnings: inference.warnings,

        extractionRecords: extraction.records.map((r) => ({

          row_number: r.row_number,

          fields: r.fields,

          skip: r.skip,

          skip_reason: r.skip_reason,

        })),

        imported,

        skipped,

        rowOutcomes,

      },

    };

  }



  function printMessyDiagnostics(

    expected: ExpectedConfig,

    score: DatasetScore,

    artifacts: EvaluationArtifacts,

  ): void {

    console.log('\n=== messy.csv DIAGNOSTIC REPORT ===\n');

    console.log('Benchmark expectation (expected-results.json):');

    console.log(`  min_valid_records: ${expected.min_valid_records ?? 'not set'}`);

    console.log(`  requires_roundtrip: ${expected.requires_roundtrip ?? false}`);

    console.log(`  row_expectations: ${expected.row_expectations ? JSON.stringify(expected.row_expectations) : 'none defined'}`);

    console.log('\nStage A mappings:');

    for (const mapping of artifacts.mappings) {

      console.log(`  ${mapping.source_column} → ${mapping.target_field}`);

    }

    if (artifacts.inferenceWarnings.length > 0) {

      console.log('\nStage A warnings:');

      for (const warning of artifacts.inferenceWarnings) {

        console.log(`  - ${warning}`);

      }

    }



    console.log('\nPer-row analysis:');

    for (const outcome of artifacts.rowOutcomes) {

      const rowExpectation = expected.row_expectations?.find((e) => e.row === outcome.row_number);

      console.log(`\n--- Row ${outcome.row_number} ---`);

      console.log('Source row:', JSON.stringify(outcome.sourceRow));

      console.log('Imported:', outcome.imported ? 'YES' : 'NO');

      if (outcome.skipReason) {

        console.log('Skip reason:', outcome.skipReason);

      }

      console.log('Contact candidates (deterministic):', JSON.stringify(outcome.contactCandidates));

      console.log('Expected primary email:', rowExpectation?.email ?? '(not defined in benchmark)');

      console.log('Expected primary mobile:', rowExpectation?.mobile ?? '(not defined in benchmark)');



      const extracted = artifacts.extractionRecords.find((r) => r.row_number === outcome.row_number);

      if (extracted) {

        console.log('Stage B AI extracted fields:', JSON.stringify(extracted.fields));

        if (extracted.skip) {

          console.log('Stage B AI skip:', extracted.skip_reason ?? 'true');

        }

      }



      if (outcome.record) {

        console.log('Final normalized record:', JSON.stringify(outcome.record));

        console.log('Actual primary email:', outcome.record.email || '(blank)');

        console.log('Actual primary mobile:', outcome.record.mobile_without_country_code || '(blank)');

        console.log('Actual country_code:', outcome.record.country_code || '(blank)');

        if (outcome.schemaErrors?.length) {

          console.log('Schema validation failures:');

          for (const err of outcome.schemaErrors) {

            console.log(`  - ${err}`);

          }

        } else {

          console.log('Schema validation: PASS');

        }

      } else {

        console.log('Final normalized record: (none — row skipped)');

        console.log('Schema validation failures: n/a (no imported record)');

      }

    }



    console.log('\nSummary:');

    console.log(`  Total rows: ${score.totalRows}`);

    console.log(`  Imported: ${score.importedCount}`);

    console.log(`  Skipped: ${score.skippedCount}`);

    console.log(`  Schema validity: ${score.schemaValidity}%`);

    console.log(`  Valid contact retention: ${score.validContactRetention}% (needs ${expected.min_valid_records ?? '?'} imported)`);

    console.log('=== end messy.csv diagnostics ===\n');

  }



  function printFacebookAudit(artifacts: EvaluationArtifacts): void {

    console.log('\n=== facebook.csv PATHOLOGICAL OUTPUT AUDIT ===\n');

    console.log('Stage A mappings:');

    for (const mapping of artifacts.mappings) {

      console.log(`  ${mapping.source_column} → ${mapping.target_field}`);

    }



    const deterministicFields = new Set(['name', 'email', 'mobile_without_country_code', 'created_at', 'data_source', 'crm_note']);

    const mappedTargets = new Set(

      artifacts.mappings

        .filter((m) => m.target_field !== '__ignore__')

        .map((m) => m.target_field),

    );



    console.log('\nFields already deterministically solvable from Stage A mappings:');

    for (const field of deterministicFields) {

      if (mappedTargets.has(field)) {

        console.log(`  ✓ ${field}`);

      }

    }



    console.log('\nStage B extraction shape:');

    console.log('  Prompt/schema requires all 15 CRM string fields per record even when unmapped.');

    console.log('  Mapped columns for facebook.csv typically cover only: name, email, mobile, created_at, crm_note/data_source.');

    console.log('  Remaining 10+ fields are empty-string placeholders the model may pathologically expand.');



    console.log('\nPer-row Stage B AI field counts:');

    for (const extracted of artifacts.extractionRecords) {

      const nonEmpty = Object.entries(extracted.fields).filter(([, v]) => v?.trim()).length;

      console.log(`  Row ${extracted.row_number}: ${nonEmpty} non-empty AI fields`);

      if (nonEmpty > 0) {

        const keys = Object.keys(extracted.fields).filter((k) => extracted.fields[k]?.trim());

        console.log(`    keys: ${keys.join(', ')}`);

      }

    }



    console.log('\nObservations (no redesign applied):');

    console.log('  - Rows hitting MAX_TOKENS likely repeat placeholder prose across empty geographic/optional fields.');

    console.log('  - Deterministic fallback strips pathological AI output and keeps mapped source values via recordBuilder.');

    console.log('  - Future optimization: restrict Stage B to unresolved fields only; bypass AI for exact mapped columns.');

    console.log('=== end facebook.csv audit ===\n');

  }



  console.log('=== Importlyai CRM Importer — AI Evaluation Benchmark ===\n');



  if (!process.env.GEMINI_API_KEY) {

    console.error('GEMINI_API_KEY required. Set it in apps/api/.env');

    process.exit(1);

  }



  const { execSync } = await import('child_process');

  execSync('npx tsx evaluation/setup-fixtures.ts', { stdio: 'inherit', cwd: ROOT });



  const expected = JSON.parse(readFileSync(EXPECTED_PATH, 'utf-8')) as Record<

    string,

    ExpectedConfig

  >;



  const fixtureNames = Object.keys(expected);

  const results: FixtureResult[] = [];



  for (const file of fixtureNames) {

    const config = expected[file];

    console.log(`Evaluating: ${file}`);

    try {

      const { score, artifacts } = await evaluateDataset(file, config);

      const status: FixtureStatus = score.overall >= 100 ? 'passed' : 'failed';

      results.push({ file, status, score });



      console.log(`  Schema validity:         ${score.schemaValidity}%`);

      console.log(`  Valid contact retention: ${score.validContactRetention}%`);

      console.log(`  CRM status accuracy:     ${score.statusAccuracy}%`);

      console.log(`  Data source accuracy:    ${score.sourceAccuracy}%`);

      console.log(`  Invalid record detection:${score.invalidDetection}%`);

      console.log(`  Export round-trip:       ${score.roundtripOk ? 'PASS' : 'FAIL'}`);

      console.log(`  Imported / skipped:      ${score.importedCount} / ${score.skippedCount} of ${score.totalRows}`);

      console.log(`  Overall score:           ${score.overall}%`);

      console.log(`  Fixture status:          ${status.toUpperCase()}\n`);



      if (file === 'messy.csv') {

        printMessyDiagnostics(config, score, artifacts);

      }

      if (file === 'facebook.csv') {

        printFacebookAudit(artifacts);

      }

    } catch (err) {

      results.push({

        file,

        status: 'error',

        error: (err as Error).message,

      });

      console.log(`  ERROR: ${(err as Error).message}`);

      console.log(`  Fixture status:          ERROR\n`);

    }

  }



  const passed = results.filter((r) => r.status === 'passed').length;

  const failed = results.filter((r) => r.status === 'failed').length;

  const errored = results.filter((r) => r.status === 'error').length;

  const totalFixtures = fixtureNames.length;



  const completedScores = results

    .filter((r): r is FixtureResult & { score: DatasetScore } => r.score != null)

    .map((r) => r.score);



  const avgCompletedOnly =

    completedScores.reduce((sum, s) => sum + s.overall, 0) / Math.max(completedScores.length, 1);



  const honestAggregate =

    (completedScores.reduce((sum, s) => sum + s.overall, 0) + errored * 0) / Math.max(totalFixtures, 1);



  console.log('=== Benchmark Summary ===');

  console.log(`Fixtures total:    ${totalFixtures}`);

  console.log(`Fixtures passed:   ${passed} (overall score = 100%)`);

  console.log(`Fixtures failed:   ${failed} (completed but overall < 100%)`);

  console.log(`Fixtures errored:  ${errored} (hard error during evaluation)`);

  console.log(`Aggregate metric (completed fixtures only): ${Math.round(avgCompletedOnly * 10) / 10}%`);

  console.log(`Honest aggregate (errors count as 0, all fixtures in denominator): ${Math.round(honestAggregate * 10) / 10}%`);

  console.log('\nAggregation formula:');

  console.log('  per-fixture overall = average of 6 metrics:');

  console.log('    schema validity, valid contact retention, CRM status accuracy,');

  console.log('    data source accuracy, invalid record detection, export round-trip');

  console.log('  previous "Benchmark Overall" used only completed fixtures in denominator (errored fixtures excluded).');

  console.log('  honest aggregate includes errored fixtures as 0% in the denominator.');

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});


