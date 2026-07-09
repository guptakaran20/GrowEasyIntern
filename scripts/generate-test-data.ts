/**
 * Generates large performance test CSV files in test-data/performance/
 * Run: npx tsx scripts/generate-test-data.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', 'data', 'test-data', 'performance');

function generateRows(count: number): string {
  const header =
    'created_at,name,email,country_code,mobile_without_country_code,company,city,state,country,lead_owner,crm_status,crm_note,data_source,possession_time,description';
  const lines = [header];
  for (let i = 1; i <= count; i++) {
    const email = `lead${i}@example.com`;
    const phone = String(9876500000 + (i % 999999)).slice(0, 10);
    lines.push(
      `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z,Lead ${i},${email},+91,${phone},Company ${i},City ${i},State,India,Owner ${i % 5},GOOD_LEAD_FOLLOW_UP,Note ${i},eden_park,,Description ${i}`,
    );
  }
  return lines.join('\n');
}

mkdirSync(ROOT, { recursive: true });
writeFileSync(join(ROOT, '15_large_1000_rows.csv'), generateRows(1000), 'utf-8');
writeFileSync(join(ROOT, '16_large_10000_rows.csv'), generateRows(10000), 'utf-8');
console.log('Generated performance CSVs: 1000 and 10000 rows');
