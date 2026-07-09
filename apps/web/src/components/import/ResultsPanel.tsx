'use client';

import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CheckCircle2,
  XCircle,
  Download,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { ImportResult } from '@groeasy/shared';
import {
  CRM_FIELD_ORDER,
  CRM_FIELD_LABELS,
  type CrmField,
} from '@groeasy/shared';
import { exportRecordsToCsv, exportSkippedToCsv, downloadCsv } from '@/lib/export';
import { formatPercent, cn } from '@/lib/utils';

interface ResultsPanelProps {
  result: ImportResult;
  onNewImport: () => void;
}

type Tab = 'imported' | 'skipped' | 'mapping';

export function ResultsPanel({ result, onNewImport }: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('imported');
  const [search, setSearch] = useState('');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'imported', label: 'Imported Records', count: result.imported_count },
    { id: 'skipped', label: 'Skipped Records', count: result.skipped_count },
    { id: 'mapping', label: 'Mapping Summary', count: result.mappings_used.length },
  ];

  const handleExportImported = () => {
    const csv = exportRecordsToCsv(result.imported_records);
    downloadCsv(csv, `groeasy_import_${result.file_name}`);
  };

  const handleExportSkipped = () => {
    if (result.skipped_records.length === 0) return;
    const csv = exportSkippedToCsv(result.skipped_records);
    downloadCsv(csv, `groeasy_skipped_${result.file_name}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Import Complete</h2>
              <p className="text-xs text-slate-500">{result.file_name}</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={handleExportImported}>
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button className="btn-primary" onClick={onNewImport}>
                <RotateCcw className="h-4 w-4" />
                New Import
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total Rows" value={result.total_rows} />
            <SummaryCard label="Imported" value={result.imported_count} variant="success" />
            <SummaryCard label="Skipped" value={result.skipped_count} variant="warning" />
            <SummaryCard label="Success Rate" value={formatPercent(result.success_rate)} />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                )}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        {activeTab !== 'mapping' && (
          <div className="border-b border-slate-200 px-6 py-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search records..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'imported' && (
            <ImportedTable records={result.imported_records} search={search} />
          )}
          {activeTab === 'skipped' && (
            <SkippedTable
              records={result.skipped_records}
              search={search}
              onExport={handleExportSkipped}
            />
          )}
          {activeTab === 'mapping' && (
            <MappingSummary mappings={result.mappings_used} />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string | number;
  variant?: 'success' | 'warning';
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold',
          variant === 'success' && 'text-teal-600',
          variant === 'warning' && 'text-amber-600',
          !variant && 'text-slate-900',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ImportedTable({
  records,
  search,
}: {
  records: ImportResult['imported_records'];
  search: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const displayFields: CrmField[] = [...CRM_FIELD_ORDER];

  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return displayFields.some((f) => r[f].toLowerCase().includes(q));
  });

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  if (filtered.length === 0) {
    return <p className="text-sm text-slate-500">No imported records found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <div ref={parentRef} className="max-h-[400px] overflow-y-auto">
        <table className="w-full min-w-max text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {displayFields.map((f) => (
              <th key={f} className="whitespace-nowrap border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">
                {CRM_FIELD_LABELS[f]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virtualizer.getVirtualItems().map((vRow) => {
            const record = filtered[vRow.index];
            return (
              <tr key={vRow.index} className="hover:bg-slate-50">
                {displayFields.map((f) => (
                  <td key={f} className="max-w-[180px] truncate border-b border-r border-slate-100 px-3 py-2 text-xs text-slate-700">
                    {record[f]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function SkippedTable({
  records,
  search,
  onExport,
}: {
  records: ImportResult['skipped_records'];
  search: string;
  onExport: () => void;
}) {
  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.reason.toLowerCase().includes(q) ||
      String(r.row_number).includes(q) ||
      Object.values(r.original_record).some((v) => v.toLowerCase().includes(q))
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
        <CheckCircle2 className="h-8 w-8 text-teal-500" />
        <p className="text-sm">No records were skipped</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-secondary text-xs" onClick={onExport}>
          <Download className="h-3 w-3" />
          Export Skipped
        </button>
      </div>
      <div className="max-h-[400px] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">Row</th>
              <th className="border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">Reason</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">Source Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.row_number} className="hover:bg-slate-50">
                <td className="border-b border-r border-slate-100 px-3 py-2 text-xs text-slate-500">{r.row_number}</td>
                <td className="border-b border-r border-slate-100 px-3 py-2 text-xs text-red-600">
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 shrink-0" />
                    {r.reason}
                  </div>
                </td>
                <td className="max-w-[300px] truncate border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                  {Object.entries(r.original_record)
                    .filter(([, v]) => v.trim())
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MappingSummary({
  mappings,
}: {
  mappings: ImportResult['mappings_used'];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
          <th className="pb-2 pr-4">Source Column</th>
          <th className="pb-2">CRM Field</th>
        </tr>
      </thead>
      <tbody>
        {mappings
          .filter((m) => m.target_field !== '__ignore__')
          .map((m) => (
            <tr key={m.source_column} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-medium text-slate-900">{m.source_column}</td>
              <td className="py-2 text-slate-600">
                {CRM_FIELD_LABELS[m.target_field as CrmField] ?? m.target_field}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
