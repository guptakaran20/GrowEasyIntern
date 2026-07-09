async function main() {
  const mappings = [
    { source_column: 'name', target_field: 'name' },
    { source_column: 'phone', target_field: 'mobile_without_country_code' },
  ];
  const rows = [
    { row_number: 1, data: { name: 'Arjun', phone: '555-0101' } },
    { row_number: 2, data: { name: 'Simran', phone: '555-0102' } },
  ];

  let requestCounts = { start: 0, progress: 0, result: 0 };
  
  requestCounts.start++;
  const res = await fetch('http://localhost:4000/api/import/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: 'test.csv', mappings, rows }),
  });
  const startData = await res.json();
  const jobId = startData.data.job_id;

  requestCounts.progress++;
  const sseRes = await fetch(`http://localhost:4000/api/import/${jobId}/progress`);
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  
  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          events.push({ stage: data.stage, processed: data.rows_processed, total: data.total_rows, status: data.status });
          if (data.status === 'completed' || data.status === 'failed') {
             done = true;
          }
        }
      }
    }
  }

  requestCounts.result++;
  const resultRes = await fetch(`http://localhost:4000/api/import/${jobId}/result`);
  const resultData = await resultRes.json();
  console.log(JSON.stringify({
    events,
    requestCounts,
    result: resultData.data
  }, null, 2));
  process.exit(0);
}

main().catch(console.error);
