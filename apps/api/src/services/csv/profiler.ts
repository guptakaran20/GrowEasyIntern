import type { ColumnProfile, SemanticHint, ParsedRow } from '@groeasy/shared';
import { LIMITS } from '@groeasy/shared';
import { normalizeHeader, getHeaderAliasHint } from './headerNormalization';
import {
  isLikelyEmail,
  isLikelyPhone,
  isLikelyDate,
  isLikelyUrl,
} from './patterns';

export function profileDataset(
  headers: string[],
  rows: ParsedRow[],
): { profiles: ColumnProfile[]; hints: SemanticHint[] } {
  const sampleRows = rows.slice(0, LIMITS.PROFILE_SAMPLE_ROWS);
  const profiles: ColumnProfile[] = [];
  const hints: SemanticHint[] = [];

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header);
    const values = sampleRows
      .map((r) => r.data[header] ?? '')
      .filter((v) => v.trim() !== '');

    const totalSampled = sampleRows.length;
    const nonEmptyCount = values.length;
    const emptyRatio = totalSampled > 0 ? 1 - nonEmptyCount / totalSampled : 1;
    const uniqueValues = new Set(values);
    const uniqueRatio = nonEmptyCount > 0 ? uniqueValues.size / nonEmptyCount : 0;

    let emailCount = 0;
    let phoneCount = 0;
    let dateCount = 0;
    let urlCount = 0;
    let totalLength = 0;

    for (const value of values) {
      if (isLikelyEmail(value)) emailCount++;
      if (isLikelyPhone(value)) phoneCount++;
      if (isLikelyDate(value)) dateCount++;
      if (isLikelyUrl(value)) urlCount++;
      totalLength += value.length;
    }

    const denominator = Math.max(nonEmptyCount, 1);
    const aliasHint = getHeaderAliasHint(normalizedHeader);

    const representativeValues = getRepresentativeValues(values, 5);

    profiles.push({
      original_header: header,
      normalized_header: normalizedHeader,
      total_sampled: totalSampled,
      non_empty_count: nonEmptyCount,
      empty_ratio: Math.round(emptyRatio * 1000) / 1000,
      unique_ratio: Math.round(uniqueRatio * 1000) / 1000,
      representative_values: representativeValues,
      likely_email_ratio: Math.round((emailCount / denominator) * 1000) / 1000,
      likely_phone_ratio: Math.round((phoneCount / denominator) * 1000) / 1000,
      likely_date_ratio: Math.round((dateCount / denominator) * 1000) / 1000,
      likely_url_ratio: Math.round((urlCount / denominator) * 1000) / 1000,
      avg_value_length: Math.round(totalLength / denominator),
      deterministic_hint: aliasHint?.field ?? null,
    });

    hints.push({
      column: header,
      suggested_field: aliasHint?.field ?? null,
      hint_source: aliasHint ? 'header_alias' : 'none',
      confidence: aliasHint?.confidence ?? 0,
    });
  }

  // Boost hints based on value patterns
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    const hint = hints[i];

    if (profile.likely_email_ratio > 0.7) {
      hint.suggested_field = 'email';
      hint.hint_source = 'value_pattern';
      hint.confidence = Math.max(hint.confidence, profile.likely_email_ratio);
    } else if (profile.likely_phone_ratio > 0.7) {
      hint.suggested_field = 'mobile_without_country_code';
      hint.hint_source = 'value_pattern';
      hint.confidence = Math.max(hint.confidence, profile.likely_phone_ratio);
    } else if (profile.likely_date_ratio > 0.7) {
      hint.suggested_field = 'created_at';
      hint.hint_source = 'value_pattern';
      hint.confidence = Math.max(hint.confidence, profile.likely_date_ratio);
    }
  }

  return { profiles, hints };
}

function getRepresentativeValues(values: string[], count: number): string[] {
  const unique = [...new Set(values)];
  if (unique.length <= count) return unique;

  const step = Math.floor(unique.length / count);
  const result: string[] = [];
  for (let i = 0; i < count && i * step < unique.length; i++) {
    const val = unique[i * step];
    result.push(val.length > 80 ? val.slice(0, 77) + '...' : val);
  }
  return result;
}

export function getSampleRows(rows: ParsedRow[], count: number): ParsedRow[] {
  if (rows.length <= count) return rows;

  // Take first few, middle few, and last few for representative sampling
  const third = Math.floor(count / 3);
  const first = rows.slice(0, third);
  const midStart = Math.floor(rows.length / 2) - Math.floor(third / 2);
  const middle = rows.slice(midStart, midStart + third);
  const last = rows.slice(-third);

  const combined = [...first, ...middle, ...last];
  const seen = new Set<number>();
  return combined.filter((r) => {
    if (seen.has(r.row_number)) return false;
    seen.add(r.row_number);
    return true;
  }).slice(0, count);
}
