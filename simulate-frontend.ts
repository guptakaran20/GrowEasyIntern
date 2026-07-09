import * as EventSourcePkg from 'eventsource';
const EventSource = (EventSourcePkg as any).default || EventSourcePkg;

async function main() {
  console.log('Simulating live import...');
  
  const mappings = [
    { source_column: 'name', target_field: 'name' },
    { source_column: 'phone', target_field: 'mobile_without_country_code' },
  ];
  const rows = [
    { row_number: 1, data: { name: 'Arjun', phone: '555-0101' } },
    { row_number: 2, data: { name: 'Simran', phone: '555-0102' } },
  ];

  let requestCounts = {
    start: 0,
    progress: 0,
    result: 0
  };

  // 1. Start Job
  requestCounts.start++;
  const res = await fetch('http://localhost:4000/api/import/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: 'test.csv', mappings, rows }),
  });
  const startData = await res.json();
  if (!startData.success) {
    console.error('Start failed:', startData);
    process.exit(1);
  }
  const jobId = startData.data.job_id;
  console.log('Started job:', jobId);

  // 2. Subscribe to progress
  requestCounts.progress++;
  const es = new EventSource(`http://localhost:4000/api/import/${jobId}/progress`);
  
  const events: any[] = [];
  
  es.on('message', (event) => {
    const data = JSON.parse(event.data);
    events.push({ stage: data.stage, processed: data.rows_processed, total: data.total_rows, status: data.status });
    console.log('Progress event:', data);
    
    if (data.status === 'completed' || data.status === 'failed' || data.status === 'partial') {
      es.close();
      finish();
    }
  });
  
  es.on('error', (err) => {
    console.error('SSE Error', err);
    es.close();
    finish();
  });

  async function finish() {
    requestCounts.result++;
    const res = await fetch(`http://localhost:4000/api/import/${jobId}/result`);
    const resultData = await res.json();
    
    console.log('\n--- LIVE IMPORT RESULTS ---');
    console.log('Actual Progress Events Observed:', events);
    console.log('Network Request Counts:', requestCounts);
    console.log('Imported:', resultData.data?.imported_count);
    console.log('Skipped:', resultData.data?.skipped_count);
    process.exit(0);
  }
}

main().catch(console.error);
