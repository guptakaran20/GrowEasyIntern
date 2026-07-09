import { SchemaType } from '@google/generative-ai';
import { CRM_FIELDS } from '@groeasy/shared';

/** Strict bounded schema — CRM string fields only, no open objects or echo fields */
export function buildBatchExtractionResponseSchema() {
  const crmProperties: Record<string, { type: typeof SchemaType.STRING }> = {};
  for (const field of CRM_FIELDS) {
    crmProperties[field] = { type: SchemaType.STRING };
  }

  return {
    type: SchemaType.OBJECT,
    properties: {
      records: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            row_number: { type: SchemaType.NUMBER },
            ...crmProperties,
            skip: { type: SchemaType.BOOLEAN },
            skip_reason: { type: SchemaType.STRING },
          },
          required: ['row_number'],
        },
      },
    },
    required: ['records'],
  };
}
