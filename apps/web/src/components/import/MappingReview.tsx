'use client';

import { AlertTriangle, X } from 'lucide-react';
import type { AnalysisResponse, ConfirmedMapping } from '@importlyai/shared';
import {
  CRM_FIELDS,
  CRM_FIELD_LABELS,
  IGNORE_FIELD,
  getConfidenceTier,
} from '@importlyai/shared';
import { cn } from '@/lib/utils';

interface MappingReviewProps {
  analysis: AnalysisResponse;
  mappings: ConfirmedMapping[];
  onUpdateMapping: (sourceColumn: string, targetField: ConfirmedMapping['target_field']) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const TARGET_OPTIONS = [
  { value: IGNORE_FIELD, label: '— Ignore —' },
  ...CRM_FIELDS.map((f) => ({ value: f, label: CRM_FIELD_LABELS[f] })),
];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tier = getConfidenceTier(confidence);
  const labels = { high: 'High confidence', medium: 'Medium confidence', low: 'Needs review' };
  const colors = {
    high: 'bg-success-bg text-success-text border-success-border',
    medium: 'bg-warning-bg text-warning-text border-warning-border',
    low: 'bg-error-bg text-error-text border-error-border',
  };

  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', colors[tier])}>
      {Math.round(confidence * 100)}% · {labels[tier]}
    </span>
  );
}

export function MappingReview({
  analysis,
  mappings,
  onUpdateMapping,
  onConfirm,
  onCancel,
  loading,
}: MappingReviewProps) {
  const { inferred_mapping, column_profiles } = analysis;
  const warnings = inferred_mapping.warnings;

  const mappingLookup = new Map(mappings.map((m) => [m.source_column, m.target_field]));
  const inferenceLookup = new Map(
    inferred_mapping.mappings.map((m) => [m.source_column, m]),
  );

  const allColumns = column_profiles.map((p) => p.original_header);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-surface shadow-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Review Field Mapping</h2>
            <p className="text-xs text-muted">
              AI-inferred mappings — adjust any field before importing
            </p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-muted hover:bg-surface-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {warnings.length > 0 && (
          <div className="border-b border-warning-border bg-warning-bg px-6 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" />
              <ul className="space-y-1 text-sm text-warning-text opacity-90">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="pb-2 pr-4">Source Column</th>
                <th className="pb-2 pr-4">Sample Values</th>
                <th className="pb-2 pr-4">Mapped CRM Field</th>
                <th className="pb-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {allColumns.map((col) => {
                const profile = column_profiles.find((p) => p.original_header === col);
                const inference = inferenceLookup.get(col);
                const currentTarget = mappingLookup.get(col) ?? IGNORE_FIELD;

                return (
                  <tr key={col} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium text-primary">{col}</td>
                    <td className="max-w-[200px] py-3 pr-4">
                      <div className="space-y-0.5">
                        {(profile?.representative_values ?? []).slice(0, 2).map((v, i) => (
                          <p key={i} className="truncate text-xs text-muted" title={v}>
                            {v}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={currentTarget}
                        onChange={(e) =>
                          onUpdateMapping(
                            col,
                            e.target.value as ConfirmedMapping['target_field'],
                          )
                        }
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring text-primary"
                      >
                        {TARGET_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      {inference ? (
                        <ConfidenceBadge confidence={inference.confidence} />
                      ) : (
                        <span className="text-xs text-muted">Unmapped</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Importing...' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
