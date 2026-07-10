import { IGNORE_FIELD } from '@importlyai/shared';

/** Model-generated aliases that mean "no CRM mapping" for target_field only */
const UNMAPPED_TARGET_ALIASES = new Set([
  '',
  'ignore',
  'ignored',
  'unmapped',
  'none',
  'n/a',
  'na',
  IGNORE_FIELD,
]);

/**
 * Normalize model-generated unmapped target_field aliases to __ignore__.
 * Returns undefined when value should pass through unchanged (including invalid CRM names).
 */
export function normalizeInferenceTargetField(value: unknown): unknown {
  if (value === null || value === undefined) {
    return IGNORE_FIELD;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const lowered = trimmed.toLowerCase();

  if (UNMAPPED_TARGET_ALIASES.has(lowered)) {
    return IGNORE_FIELD;
  }

  return trimmed;
}

/** Apply target_field normalization to a parsed schema inference JSON payload */
export function normalizeSchemaInferenceResponse(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed;
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.mappings)) {
    return parsed;
  }

  return {
    ...obj,
    mappings: obj.mappings.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return entry;
      }
      const mapping = entry as Record<string, unknown>;
      return {
        ...mapping,
        target_field: normalizeInferenceTargetField(mapping.target_field),
      };
    }),
  };
}
