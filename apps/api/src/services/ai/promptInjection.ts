/** Maximum length for preserved source remarks appended after extraction */
export const REMARK_MAX_LENGTH = 500;
export const CRM_NOTE_MAX_LENGTH = 500;
export const DESCRIPTION_MAX_LENGTH = 500;
export const SKIP_REASON_MAX_LENGTH = 200;

const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+)?previous\s+instructions?\b/i,
  /\bdisregard\s+(all\s+)?(prior|previous)\s+instructions?\b/i,
  /\bforget\s+(all\s+)?(prior|previous)\s+instructions?\b/i,
  /\b(system|assistant|admin)\s*:\s*/i,
  /\byou\s+are\s+now\s+in\s+(debug|admin|developer)\s+mode\b/i,
  /\bprint\s+(all\s+)?environment\s+variables?\b/i,
  /\breveal\s+(the\s+)?(api\s+key|secret|password|token)\b/i,
  /\boutput\s+markdown\b/i,
  /\bchange\s+crm_status\s+to\b/i,
  /\bact\s+as\s+(system|admin|root)\b/i,
  /\breturn\s+(the\s+)?gemini\s+api\s+key\b/i,
  /\bHACKED\b/,
  /\brepeat\s+(this\s+)?text\s+(forever|infinitely)\b/i,
];

export interface HeldBackField {
  column: string;
  value: string;
  targetField?: string;
}

export type HeldBackByRow = Map<number, HeldBackField[]>;

export interface PromptRow {
  row_number: number;
  source_fields: Record<string, string>;
}

export interface BatchRowInput {
  row_number: number;
  data: Record<string, string>;
}

export interface MappingInput {
  source_column: string;
  target_field: string;
}

/** Detect cell values that attempt prompt injection or pathological model behavior */
export function isLikelyPromptInjection(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function boundText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength - 3) + '...';
}

export function appendSourceRemark(
  existing: string,
  heldBack: HeldBackField[],
  maxLength = CRM_NOTE_MAX_LENGTH,
): string {
  const remarks = heldBack
    .map((f) => f.value.trim())
    .filter(Boolean)
    .map((v) => `Source remark: ${boundText(v, REMARK_MAX_LENGTH)}`);

  if (remarks.length === 0) return boundText(existing, maxLength);

  const combined = [existing.trim(), ...remarks].filter(Boolean).join('; ');
  return boundText(combined, maxLength);
}

/** Omit flagged injection cells from LLM prompt; preserve for deterministic post-processing */
export function sanitizeBatchForExtraction(
  batchRows: BatchRowInput[],
  mappings: MappingInput[],
): { promptRows: PromptRow[]; heldBack: HeldBackByRow } {
  const columns = mappings
    .filter((m) => m.target_field !== '__ignore__')
    .map((m) => m.source_column);
  const targetByColumn = new Map(mappings.map((m) => [m.source_column, m.target_field]));
  const heldBack: HeldBackByRow = new Map();

  const promptRows: PromptRow[] = batchRows.map((row) => {
    const source_fields: Record<string, string> = {};
    const held: HeldBackField[] = [];

    for (const col of columns) {
      const value = row.data[col] ?? '';
      if (!value.trim()) continue;

      if (isLikelyPromptInjection(value)) {
        held.push({
          column: col,
          value,
          targetField: targetByColumn.get(col),
        });
        continue;
      }
      source_fields[col] = value;
    }

    if (held.length > 0) {
      heldBack.set(row.row_number, held);
    }

    return { row_number: row.row_number, source_fields };
  });

  return { promptRows, heldBack };
}

export function mergeHeldBackIntoRecords(
  records: Array<{ row_number: number; fields: Record<string, string>; skip?: boolean; skip_reason?: string }>,
  heldBack: HeldBackByRow,
): void {
  for (const record of records) {
    const held = heldBack.get(record.row_number);
    if (!held?.length) continue;
    record.fields.crm_note = appendSourceRemark(record.fields.crm_note ?? '', held);
  }
}

/** Simple repetition indicator for truncated output diagnostics */
export function detectRepeatedTailPattern(text: string, tailLength = 500): string | undefined {
  const tail = text.slice(-tailLength);
  if (tail.length < 40) return undefined;

  for (let len = 10; len <= 80; len += 5) {
    const sample = tail.slice(-len);
    if (sample.length < 10) continue;
    const occurrences = tail.split(sample).length - 1;
    if (occurrences >= 4) {
      return `repeated_${len}char_substring_x${occurrences}`;
    }
  }
  return undefined;
}
