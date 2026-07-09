import { describe, it, expect } from 'vitest';
import { parseCsvBuffer } from './parser';

describe('CSV parser', () => {
  it('parses simple CSV', () => {
    const csv = 'name,email,phone\nJohn,john@test.com,9876543210\nJane,jane@test.com,9876543211';
    const result = parseCsvBuffer(Buffer.from(csv), 'test.csv');
    expect(result.headers).toEqual(['name', 'email', 'phone']);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0].data.name).toBe('John');
  });

  it('handles quoted fields with commas', () => {
    const csv = 'name,notes\nJohn,"Hello, world"';
    const result = parseCsvBuffer(Buffer.from(csv), 'test.csv');
    expect(result.rows[0].data.notes).toBe('Hello, world');
  });

  it('handles BOM', () => {
    const csv = '\uFEFFname,email\nJohn,john@test.com';
    const result = parseCsvBuffer(Buffer.from(csv), 'test.csv');
    expect(result.rowCount).toBe(1);
  });

  it('skips empty lines', () => {
    const csv = 'name,email\n\nJohn,john@test.com\n\n';
    const result = parseCsvBuffer(Buffer.from(csv), 'test.csv');
    expect(result.rowCount).toBe(1);
  });

  it('assigns row numbers starting at 1', () => {
    const csv = 'name\nA\nB\nC';
    const result = parseCsvBuffer(Buffer.from(csv), 'test.csv');
    expect(result.rows.map((r) => r.row_number)).toEqual([1, 2, 3]);
  });
});
