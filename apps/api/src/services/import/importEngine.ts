import { v4 as uuidv4 } from 'uuid';
import type {
  ImportProcessRequest,
  ImportResult,
  ImportProgress,
  CrmRecord,
  SkippedRecord,
} from '@importlyai/shared';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { extractBatch } from '../ai/geminiService';
import { buildCrmRecordFromExtracted, splitIntoBatches } from './recordBuilder';
import { jobStore } from './jobStore';

export async function processImport(
  request: ImportProcessRequest,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const startTime = Date.now();
  const { file_name, mappings, rows } = request;
  const batches = splitIntoBatches(rows, config.batch.size);
  const totalBatches = batches.length;

  const importedRecords: CrmRecord[] = [];
  const skippedRecords: SkippedRecord[] = [];
  const warnings: string[] = [];
  let rowsProcessed = 0;

  const rowMap = new Map(rows.map((r) => [r.row_number, r]));

  const updateProgress = (
    stage: string,
    currentBatch: number,
    status: ImportProgress['status'] = 'processing',
  ) => {
    const progress: ImportProgress = {
      job_id: '',
      status,
      stage,
      rows_processed: rowsProcessed,
      total_rows: rows.length,
      imported_count: importedRecords.length,
      skipped_count: skippedRecords.length,
      current_batch: currentBatch,
      total_batches: totalBatches,
    };
    onProgress?.(progress);
  };

  updateProgress('Starting batch extraction', 0);

  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += config.batch.concurrency) {
    const chunk = batches.slice(i, i + config.batch.concurrency);

    const results = await Promise.allSettled(
      chunk.map(async (batch, chunkIndex) => {
        const batchIndex = i + chunkIndex;
        updateProgress(`Processing batch ${batchIndex + 1} of ${totalBatches}`, batchIndex + 1);

        try {
          const batchRows = batch.map((row) => ({
            row_number: row.row_number,
            data: row.data,
          }));

          const extraction = await extractBatch(mappings, batchRows);

          const batchImported: CrmRecord[] = [];
          const batchSkipped: SkippedRecord[] = [];
          const extractedRowsSeen = new Set<number>();

          for (const extracted of extraction.records) {
            if (extractedRowsSeen.has(extracted.row_number)) {
              // Skip hallucinated duplicates from AI
              continue;
            }
            extractedRowsSeen.add(extracted.row_number);

            const sourceRow = rowMap.get(extracted.row_number);
            if (!sourceRow) {
              batchSkipped.push({
                row_number: extracted.row_number,
                reason: 'Source row not found',
                original_record: {},
              });
              continue;
            }

            const result = buildCrmRecordFromExtracted(extracted, sourceRow, mappings);
            if (result.skip) {
              batchSkipped.push(result.skip);
            } else {
              batchImported.push(result.record);
            }
          }

          // Catch any rows the AI silently dropped
          for (const row of batchRows) {
            if (!extractedRowsSeen.has(row.row_number)) {
              batchSkipped.push({
                row_number: row.row_number,
                reason: 'AI silently dropped this row during extraction',
                original_record: row.data,
              });
            }
          }

          return { imported: batchImported, skipped: batchSkipped, batchIndex };
        } catch (err) {
          logger.error('Batch processing failed', {
            batchIndex,
            error: (err as Error).message,
          });
          warnings.push(`Batch ${batchIndex + 1} failed: ${(err as Error).message}`);

          const failedSkipped: SkippedRecord[] = batch.map((row) => ({
            row_number: row.row_number,
            reason: `Batch extraction failed: ${(err as Error).message}`,
            original_record: row.data,
          }));

          return { imported: [], skipped: failedSkipped, batchIndex };
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        importedRecords.push(...result.value.imported);
        skippedRecords.push(...result.value.skipped);
      }
    }

    rowsProcessed = Math.min(
      importedRecords.length + skippedRecords.length,
      rows.length,
    );
  }

  const durationMs = Date.now() - startTime;
  const successRate = rows.length > 0
    ? Math.round((importedRecords.length / rows.length) * 1000) / 10
    : 0;

  updateProgress('Import complete', totalBatches, warnings.length > 0 ? 'partial' : 'completed');

  return {
    file_name,
    total_rows: rows.length,
    imported_count: importedRecords.length,
    skipped_count: skippedRecords.length,
    success_rate: successRate,
    imported_records: importedRecords,
    skipped_records: skippedRecords,
    mappings_used: mappings,
    warnings,
    duration_ms: durationMs,
  };
}

export async function startImportJob(request: ImportProcessRequest): Promise<string> {
  const jobId = uuidv4();

  jobStore.create(jobId, request);

  // Process asynchronously
  processImport(request, (progress) => {
    jobStore.updateProgress(jobId, { ...progress, job_id: jobId });
  })
    .then((result) => {
      jobStore.complete(jobId, result);
    })
    .catch((err) => {
      jobStore.fail(jobId, (err as Error).message);
    });

  return jobId;
}
