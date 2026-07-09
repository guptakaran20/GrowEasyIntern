'use client';

import { useCallback, useState } from 'react';
import type {
  AnalysisResponse,
  ImportResult,
  ConfirmedMapping,
  ImportProgress,
} from '@groeasy/shared';
import type { LocalPreview } from '@/lib/csvParser';
import { analyzeCsv, processImport } from '@/lib/api';

export type ImportState =
  | 'IDLE'
  | 'FILE_SELECTED'
  | 'PREVIEW_READY'
  | 'ANALYZING'
  | 'MAPPING_REVIEW'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'ERROR';

export interface ImportContext {
  state: ImportState;
  file: File | null;
  preview: LocalPreview | null;
  analysis: AnalysisResponse | null;
  mappings: ConfirmedMapping[];
  importResult: ImportResult | null;
  importProgress: ImportProgress | null;
  error: string | null;
  analysisStage: string;
}

const initialContext: ImportContext = {
  state: 'IDLE',
  file: null,
  preview: null,
  analysis: null,
  mappings: [],
  importResult: null,
  importProgress: null,
  error: null,
  analysisStage: '',
};

const ANALYSIS_STAGES = [
  'Reading CSV structure',
  'Profiling columns',
  'Detecting field meanings',
  'Building CRM mapping',
  'Validating analysis',
];

export function useImportFlow() {
  const [ctx, setCtx] = useState<ImportContext>(initialContext);

  const setState = useCallback((updates: Partial<ImportContext>) => {
    setCtx((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setCtx(initialContext);
  }, []);

  const selectFile = useCallback((file: File, preview: LocalPreview) => {
    setCtx({
      ...initialContext,
      state: 'PREVIEW_READY',
      file,
      preview,
    });
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!ctx.file) return;

    setState({ state: 'ANALYZING', error: null });

    for (let i = 0; i < ANALYSIS_STAGES.length - 1; i++) {
      setState({ analysisStage: ANALYSIS_STAGES[i] });
      await new Promise((r) => setTimeout(r, 400));
    }

    try {
      setState({ analysisStage: ANALYSIS_STAGES[ANALYSIS_STAGES.length - 1] });
      const analysis = await analyzeCsv(ctx.file);

      const mappings: ConfirmedMapping[] = analysis.inferred_mapping.mappings.map((m) => ({
        source_column: m.source_column,
        target_field: m.target_field,
      }));

      setState({
        state: 'MAPPING_REVIEW',
        analysis,
        mappings,
        analysisStage: '',
      });
    } catch (err) {
      setState({
        state: 'ERROR',
        error: (err as Error).message,
        analysisStage: '',
      });
    }
  }, [ctx.file, setState]);

  const updateMapping = useCallback(
    (sourceColumn: string, targetField: ConfirmedMapping['target_field']) => {
      setCtx((prev) => ({
        ...prev,
        mappings: prev.mappings.map((m) =>
          m.source_column === sourceColumn
            ? { ...m, target_field: targetField }
            : m,
        ),
      }));
    },
    [],
  );

  const runImport = useCallback(async () => {
    if (!ctx.analysis || !ctx.file) return;

    setState({ state: 'IMPORTING', error: null, importProgress: null });

    try {
      const result = await processImport({
        file_name: ctx.file.name,
        mappings: ctx.mappings,
        rows: ctx.analysis.all_rows,
      });

      setState({
        state: 'COMPLETED',
        importResult: result,
      });
    } catch (err) {
      setState({
        state: 'ERROR',
        error: (err as Error).message,
      });
    }
  }, [ctx.analysis, ctx.file, ctx.mappings, setState]);

  return {
    ...ctx,
    selectFile,
    runAnalysis,
    updateMapping,
    runImport,
    reset,
    setState,
  };
}

export type ImportFlow = ReturnType<typeof useImportFlow>;
