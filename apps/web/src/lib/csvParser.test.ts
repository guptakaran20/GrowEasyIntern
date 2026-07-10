import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCsvLocally, INCREMENTAL_PARSE_THRESHOLD_BYTES } from './csvParser';
import Papa from 'papaparse';
import { LIMITS } from '@groeasy/shared';

// Helper to create a mock File
function createMockFile(content: string, name: string, type = 'text/csv'): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  return file;
}

describe('parseCsvLocally', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the fast synchronous path for small files', async () => {
    const csvContent = 'name,email\nArjun,arjun@example.com';
    const file = createMockFile(csvContent, 'small.csv');
    
    // Spy on Papa.parse to check the config
    const spy = vi.spyOn(Papa, 'parse');
    
    const result = await parseCsvLocally(file);
    
    expect(spy).toHaveBeenCalled();
    const config = spy.mock.calls[0][1] as unknown as { chunk: (...args: unknown[]) => unknown };
    expect(config.chunk).toBeUndefined(); // Fast path does not use chunk
    expect(result.rows).toHaveLength(1);
    expect(result.headers).toEqual(['name', 'email']);
  });

  it('uses the incremental chunk path for large files', async () => {
    const header = 'name,email\n';
    const longString = 'a'.repeat(1024 * 10); // 10KB per row
    const row = `Arjun,${longString}@example.com\n`;
    // Create a string larger than INCREMENTAL_PARSE_THRESHOLD_BYTES but < 10000 rows
    const largeContent = header + row.repeat(Math.ceil(INCREMENTAL_PARSE_THRESHOLD_BYTES / row.length) + 2);
    const file = createMockFile(largeContent, 'large.csv');
    
    const spy = vi.spyOn(Papa, 'parse');
    const onProgress = vi.fn();
    
    const result = await parseCsvLocally(file, { onProgress });
    
    expect(spy).toHaveBeenCalled();
    const config = spy.mock.calls[0][1] as unknown as { chunk: (...args: unknown[]) => unknown };
    expect(config.chunk).toBeDefined(); // Incremental path uses chunk
    expect(result.headers).toEqual(['name', 'email']);
    expect(result.rows.length).toBeGreaterThan(1);
    
    // Progress should have been called
    expect(onProgress).toHaveBeenCalled();
    const lastProgress = onProgress.mock.lastCall![0];
    expect(lastProgress.totalBytes).toEqual(file.size);
    expect(lastProgress.bytesProcessed).toEqual(file.size);
  });

  it('handles quotes, commas, multiline and Unicode correctly in incremental path', async () => {
    const csvContent = `name,address,note
"John, Doe","123 Street
Line 2","Hello 👋"
`;
    // Force incremental by artificially setting file size property using Object.defineProperty
    const file = createMockFile(csvContent, 'test.csv');
    Object.defineProperty(file, 'size', { value: INCREMENTAL_PARSE_THRESHOLD_BYTES + 100 });
    
    const result = await parseCsvLocally(file);
    
    expect(result.headers).toEqual(['name', 'address', 'note']);
    expect(result.rows[0].name).toEqual('John, Doe'); // Quoted comma
    expect(result.rows[0].address).toEqual('123 Street\nLine 2'); // Multiline
    expect(result.rows[0].note).toEqual('Hello 👋'); // Unicode/Emoji
  });

  it('aborts parsing when max rows limit is exceeded in incremental path', async () => {
    // Since MAX_ROWS is 10,000, we can just generate 10,001 rows
    const header = 'id\n';
    const row = '1\n';
    const content = header + row.repeat(LIMITS.MAX_ROWS + 1);
    const file = createMockFile(content, 'huge.csv');
    Object.defineProperty(file, 'size', { value: INCREMENTAL_PARSE_THRESHOLD_BYTES + 100 });

    await expect(parseCsvLocally(file)).rejects.toThrow(`CSV exceeds maximum of ${LIMITS.MAX_ROWS} rows`);
  });

  it('aborts correctly when AbortSignal is triggered', async () => {
    const header = 'id\n';
    const row = '1\n';
    const content = header + row.repeat(100);
    const file = createMockFile(content, 'test.csv');
    Object.defineProperty(file, 'size', { value: INCREMENTAL_PARSE_THRESHOLD_BYTES + 100 });

    const ac = new AbortController();
    const promise = parseCsvLocally(file, { signal: ac.signal });
    ac.abort();

    await expect(promise).rejects.toThrow('Parsing aborted');
  });
});
