'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import type {
  AnalysisResponse,
  ImportResult,
  ConfirmedMapping,
  ImportProgress,
} from '@importlyai/shared';
import type { LocalPreview } from '@/lib/csvParser';
import { analyzeCsv, startImportJob, subscribeToProgress, getImportResult } from '@/lib/api';

export type ImportState =
  | 'IDLE'
  | 'FILE_SELECTED'
  | 'PARSING'
  | 'PREVIEW_READY'
  | 'ANALYZING'
  | 'MAPPING_REVIEW'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'ERROR';

export interface ImportContext {
  state: ImportState;
  file: File | null;
  parseProgress: { bytesProcessed: number; totalBytes: number; rowsParsed: number } | null;
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
  parseProgress: null,
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

  // Lifecycle Refs
  const startLockRef = useRef(false);
  const terminalHandledRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);
  const activeUnsubscribeRef = useRef<(() => void) | null>(null);
  const runIdentityRef = useRef<number>(0);
  const maxRowsProcessedRef = useRef<number>(0);

  const cleanupSSE = useCallback(() => {
    if (activeUnsubscribeRef.current) {
      activeUnsubscribeRef.current();
      activeUnsubscribeRef.current = null;
    }
    activeJobIdRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSSE();
    };
  }, [cleanupSSE]);

  const setState = useCallback((updates: Partial<ImportContext>) => {
    setCtx((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    cleanupSSE();
    startLockRef.current = false;
    terminalHandledRef.current = false;
    runIdentityRef.current += 1;
    maxRowsProcessedRef.current = 0;
    setCtx(initialContext);
  }, [cleanupSSE]);

  const startParsing = useCallback((file: File) => {
    runIdentityRef.current += 1;
    setCtx({
      ...initialContext,
      state: 'PARSING',
      file,
    });
    return runIdentityRef.current;
  }, []);

  const setParseProgress = useCallback((progress: { bytesProcessed: number; totalBytes: number; rowsParsed: number }, runId: number) => {
    if (runIdentityRef.current !== runId) return;
    setState({ parseProgress: progress });
  }, [setState]);

  const selectFile = useCallback((file: File, preview: LocalPreview, runId?: number) => {
    if (runId !== undefined && runIdentityRef.current !== runId) return;
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

    if (startLockRef.current) return;
    startLockRef.current = true;

    cleanupSSE();
    terminalHandledRef.current = false;
    maxRowsProcessedRef.current = 0;
    runIdentityRef.current += 1;
    const currentRun = runIdentityRef.current;

    setState({ state: 'IMPORTING', error: null, importProgress: null });

    try {
      const jobId = await startImportJob({
        file_name: ctx.file.name,
        mappings: ctx.mappings,
        rows: ctx.analysis.all_rows,
      });

      if (currentRun !== runIdentityRef.current) return;

      activeJobIdRef.current = jobId;

      activeUnsubscribeRef.current = subscribeToProgress(
        jobId,
        (data: unknown) => {
          if (currentRun !== runIdentityRef.current) return;

          const progress = data as ImportProgress;

          if (progress.rows_processed < maxRowsProcessedRef.current) {
            progress.rows_processed = maxRowsProcessedRef.current;
          } else {
            maxRowsProcessedRef.current = progress.rows_processed;
          }

          setState({ importProgress: progress });

          if (progress.status === 'failed') {
            if (terminalHandledRef.current) return;
            terminalHandledRef.current = true;
            cleanupSSE();
            startLockRef.current = false;
            setState({ state: 'ERROR', error: progress.error || 'Backend job failed' });
          }
        },
        async () => {
          if (currentRun !== runIdentityRef.current) return;
          if (terminalHandledRef.current) return;

          terminalHandledRef.current = true;
          cleanupSSE();

          try {
            const result = await getImportResult(jobId);
            if (currentRun !== runIdentityRef.current) return;
            startLockRef.current = false;
            setState({
              state: 'COMPLETED',
              importResult: result,
            });
          } catch {
            if (currentRun !== runIdentityRef.current) return;
            startLockRef.current = false;
            setState({ state: 'ERROR', error: 'Failed to fetch final result' });
          }
        },
        (_err: Error) => {
          if (currentRun !== runIdentityRef.current) return;

          if (_err.message.includes('permanently')) {
            if (terminalHandledRef.current) return;
            terminalHandledRef.current = true;
            cleanupSSE();
            startLockRef.current = false;
            setState({ state: 'ERROR', error: 'Progress stream disconnected permanently' });
          }
        }
      );
    } catch (err) {
      if (currentRun !== runIdentityRef.current) return;
      cleanupSSE();
      startLockRef.current = false;
      setState({
        state: 'ERROR',
        error: (err as Error).message,
      });
    }
  }, [ctx.analysis, ctx.file, ctx.mappings, setState, cleanupSSE]);

  return {
    ...ctx,
    reset,
    startParsing,
    setParseProgress,
    selectFile,
    runAnalysis,
    updateMapping,
    runImport,
    setState,
  };
}

export type ImportFlow = ReturnType<typeof useImportFlow>;
