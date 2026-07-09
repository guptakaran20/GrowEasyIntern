import type {
  AnalysisResponse,
  ImportResult,
  ImportProcessRequest,
  ConfirmedMapping,
} from '@groeasy/shared';
import { API_URL } from './utils';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

async function handleResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}

export async function analyzeCsv(file: File): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/csv/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const json = (await res.json()) as ApiFailure;
    throw new Error(json.error?.message ?? 'Analysis failed');
  }

  return handleResponse<AnalysisResponse>(res);
}

export async function processImport(
  request: ImportProcessRequest,
): Promise<ImportResult> {
  const res = await fetch(`${API_URL}/api/import/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const json = (await res.json()) as ApiFailure;
    throw new Error(json.error?.message ?? 'Import failed');
  }

  return handleResponse<ImportResult>(res);
}

export async function startImportJob(
  request: ImportProcessRequest,
): Promise<string> {
  const res = await fetch(`${API_URL}/api/import/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const data = await handleResponse<{ job_id: string }>(res);
  return data.job_id;
}

export function subscribeToProgress(
  jobId: string,
  onProgress: (data: object) => void,
  onComplete: () => void,
  onError: (err: Error) => void,
): () => void {
  const eventSource = new EventSource(`${API_URL}/api/import/${jobId}/progress`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      onProgress(data);
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'partial') {
        eventSource.close();
        onComplete();
      }
    } catch {
      onError(new Error('Failed to parse progress update'));
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    onError(new Error('Progress stream disconnected'));
  };

  return () => eventSource.close();
}

export async function getImportResult(jobId: string): Promise<ImportResult> {
  const res = await fetch(`${API_URL}/api/import/${jobId}/result`);
  return handleResponse<ImportResult>(res);
}

export type { ConfirmedMapping };
