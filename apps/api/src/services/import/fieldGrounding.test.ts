import { describe, it, expect } from 'vitest';
import {
  enforceSourceGrounding,
  getMappedSourceEvidence,
  isKnownCountryName,
  isMissingValuePlaceholder,
  normalizeOptionalAiText,
} from './fieldGrounding';
import { createEmptyCrmRecord } from '@importlyai/shared';

describe('isMissingValuePlaceholder', () => {
  it.each([
    'unknown',
    'Unknown',
    'UNKNOWN',
    'unknown state',
    'Unknown State/Province',
    'Unknown State/Province ...',
    'n/a',
    'N/A',
    'na',
    'none',
    'null',
    'not available',
    'not provided',
    'unspecified',
    '-',
    '  unknown  ',
  ])('treats %j as placeholder', (value) => {
    expect(isMissingValuePlaceholder(value)).toBe(true);
    expect(normalizeOptionalAiText(value)).toBe('');
  });

  it('preserves legitimate text containing unknown', () => {
    expect(isMissingValuePlaceholder('Status unknown until callback')).toBe(false);
    expect(normalizeOptionalAiText('Status unknown until callback')).toBe(
      'Status unknown until callback',
    );
  });
});

describe('isKnownCountryName', () => {
  it('detects common country tokens', () => {
    expect(isKnownCountryName('India')).toBe(true);
    expect(isKnownCountryName('IN')).toBe(true);
    expect(isKnownCountryName('Karnataka')).toBe(false);
  });
});

describe('enforceSourceGrounding', () => {
  const stateMapping = [{ source_column: 'State', target_field: 'state' }];
  const countryMapping = [{ source_column: 'Country', target_field: 'country' }];

  it('clears ungrounded AI state when source has no geographic evidence', () => {
    const record = createEmptyCrmRecord();
    record.state = 'India';
    record.city = 'Bengaluru';
    record.country = 'India';

    enforceSourceGrounding(
      record,
      { row_number: 1, data: { State: '', Country: '' } },
      [...stateMapping, ...countryMapping],
    );

    expect(record.state).toBe('');
    expect(record.city).toBe('');
    expect(record.country).toBe('');
  });

  it('preserves legitimate mapped state and country values', () => {
    const record = createEmptyCrmRecord();
    record.state = 'Karnataka';
    record.country = 'India';

    enforceSourceGrounding(
      record,
      { row_number: 1, data: { State: 'Karnataka', Country: 'India' } },
      [...stateMapping, ...countryMapping],
    );

    expect(record.state).toBe('Karnataka');
    expect(record.country).toBe('India');
  });

  it('clears country names placed in state without matching state source evidence', () => {
    const record = createEmptyCrmRecord();
    record.state = 'India';
    record.country = 'India';

    enforceSourceGrounding(
      record,
      { row_number: 1, data: { State: '', Country: 'India' } },
      [...stateMapping, ...countryMapping],
    );

    expect(record.state).toBe('');
    expect(record.country).toBe('India');
  });

  it('allows state=India when State column explicitly contains India', () => {
    const record = createEmptyCrmRecord();
    record.state = 'India';

    enforceSourceGrounding(
      record,
      { row_number: 1, data: { State: 'India' } },
      stateMapping,
    );

    expect(record.state).toBe('India');
  });
});

describe('getMappedSourceEvidence', () => {
  it('ignores empty and placeholder mapped values', () => {
    const evidence = getMappedSourceEvidence(
      { row_number: 1, data: { State: 'unknown', 'Phone 2': '9876543210' } },
      [
        { source_column: 'State', target_field: 'state' },
        { source_column: 'Phone 2', target_field: 'state' },
      ],
      'state',
    );

    expect(evidence).toEqual([]);
  });
});
