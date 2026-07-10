import { describe, it, expect } from 'vitest';
import { schemaInferenceResponseSchema, CRM_FIELDS, IGNORE_FIELD } from '@importlyai/shared';
import {
  normalizeInferenceTargetField,
  normalizeSchemaInferenceResponse,
} from './schemaInferenceNormalize';

describe('normalizeInferenceTargetField', () => {
  it.each([
    ['', IGNORE_FIELD],
    [null, IGNORE_FIELD],
    [undefined, IGNORE_FIELD],
    ['ignore', IGNORE_FIELD],
    ['ignored', IGNORE_FIELD],
    ['unmapped', IGNORE_FIELD],
    ['none', IGNORE_FIELD],
    ['n/a', IGNORE_FIELD],
    ['N/A', IGNORE_FIELD],
    ['__ignore__', IGNORE_FIELD],
  ])('maps %j to __ignore__', (input, expected) => {
    expect(normalizeInferenceTargetField(input)).toBe(expected);
  });

  it('preserves valid CRM target fields', () => {
    for (const field of CRM_FIELDS) {
      expect(normalizeInferenceTargetField(field)).toBe(field);
    }
    expect(normalizeInferenceTargetField('email')).toBe('email');
  });

  it('does not silently accept arbitrary invalid CRM field names', () => {
    expect(normalizeInferenceTargetField('random_invalid_field')).toBe('random_invalid_field');
    expect(normalizeInferenceTargetField('Email')).toBe('Email');
  });
});

describe('normalizeSchemaInferenceResponse', () => {
  it('normalizes empty target_field before Zod validation', () => {
    const geminiLike = {
      mappings: [
        {
          source_column: 'Contact',
          target_field: '',
          confidence: 0.3,
          reason: 'Column contains mixed data types...',
        },
        {
          source_column: 'Owner',
          target_field: 'lead_owner',
          confidence: 0.9,
          reason: 'Owner column maps to lead owner',
        },
        {
          source_column: 'Status',
          target_field: 'crm_status',
          confidence: 0.85,
          reason: 'Status values match CRM statuses',
        },
      ],
      unmapped_columns: ['Contact'],
      warnings: [],
    };

    const normalized = normalizeSchemaInferenceResponse(geminiLike);
    const validated = schemaInferenceResponseSchema.parse(normalized);

    expect(validated.mappings[0].target_field).toBe(IGNORE_FIELD);
    expect(validated.mappings[1].target_field).toBe('lead_owner');
  });

  it('rejects arbitrary invalid target_field after normalization', () => {
    const invalid = {
      mappings: [
        {
          source_column: 'Contact',
          target_field: 'random_invalid_field',
          confidence: 0.5,
          reason: 'test',
        },
      ],
      unmapped_columns: [],
      warnings: [],
    };

    const normalized = normalizeSchemaInferenceResponse(invalid);
    expect(schemaInferenceResponseSchema.safeParse(normalized).success).toBe(false);
  });

  it('handles ambiguous.csv-style Gemini payload without crashing', () => {
    const ambiguousGeminiResponse = {
      mappings: [
        {
          source_column: 'Contact',
          target_field: '',
          confidence: 0.3,
          reason: 'Column contains mixed data types (email and phone). Cannot map to a single CRM field.',
        },
        {
          source_column: 'Owner',
          target_field: 'lead_owner',
          confidence: 0.95,
          reason: 'Owner names in sample rows',
        },
        {
          source_column: 'Status',
          target_field: 'crm_status',
          confidence: 0.9,
          reason: 'CRM-like status values',
        },
      ],
      unmapped_columns: ['Contact'],
      warnings: ['Contact column is ambiguous'],
    };

    expect(() =>
      schemaInferenceResponseSchema.parse(
        normalizeSchemaInferenceResponse(ambiguousGeminiResponse),
      ),
    ).not.toThrow();
  });
});
