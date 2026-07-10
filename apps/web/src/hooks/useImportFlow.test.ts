import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImportFlow } from './useImportFlow';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({
  analyzeCsv: vi.fn(),
  startImportJob: vi.fn(),
  subscribeToProgress: vi.fn(),
  getImportResult: vi.fn(),
}));

describe('useImportFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockFileAndAnalysis = (result: { current: ReturnType<typeof useImportFlow> }) => {
    act(() => {
      result.current.setState({
        file: new File([''], 'test.csv'),
        analysis: { all_rows: [] } as unknown as import('@importlyai/shared').AnalysisResponse,
        mappings: [],
      });
    });
  };

  it('1. one start creates exactly one job', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    const unsubscribeSpy = vi.fn();
    vi.mocked(api.subscribeToProgress).mockReturnValue(unsubscribeSpy);

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    expect(api.startImportJob).toHaveBeenCalledTimes(1);
    expect(api.subscribeToProgress).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('IMPORTING');
  });

  it('2. two immediate runImport calls create exactly one job (duplicate start prevention)', async () => {
    let resolveStart: (jobId: string) => void;
    const startPromise = new Promise<string>((r) => {
      resolveStart = r;
    });
    vi.mocked(api.startImportJob).mockReturnValue(startPromise);
    const unsubscribeSpy = vi.fn();
    vi.mocked(api.subscribeToProgress).mockReturnValue(unsubscribeSpy);

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    act(() => {
      result.current.runImport();
      result.current.runImport(); // Immediate second call
    });

    expect(api.startImportJob).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStart!('job-1');
    });

    expect(api.subscribeToProgress).toHaveBeenCalledTimes(1);
  });

  it('3. progress event updates real progress state', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    let onProgressCb: (data: unknown) => void;
    vi.mocked(api.subscribeToProgress).mockImplementation((jobId, onProgress) => {
      onProgressCb = onProgress;
      return vi.fn();
    });

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      onProgressCb!({
        job_id: 'job-1',
        status: 'processing',
        rows_processed: 5,
        total_rows: 10,
      });
    });

    expect(result.current.importProgress?.rows_processed).toBe(5);
  });

  it('4. progress never visibly regresses from stale numeric updates', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    let onProgressCb: (data: unknown) => void;
    vi.mocked(api.subscribeToProgress).mockImplementation((jobId, onProgress) => {
      onProgressCb = onProgress;
      return vi.fn();
    });

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      onProgressCb!({ rows_processed: 10 });
    });
    expect(result.current.importProgress?.rows_processed).toBe(10);

    act(() => {
      onProgressCb!({ rows_processed: 5 }); // Stale event
    });
    expect(result.current.importProgress?.rows_processed).toBe(10); // Should not regress
  });

  it('5 & 6. completion fetches result exactly once & duplicate completion event is ignored', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    vi.mocked(api.getImportResult).mockResolvedValue({ total_rows: 10 } as unknown as import('@importlyai/shared').ImportResult);
    
    let onCompleteCb: () => void;
    vi.mocked(api.subscribeToProgress).mockImplementation((jobId, onProgress, onComplete) => {
      onCompleteCb = onComplete;
      return vi.fn();
    });

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    await act(async () => {
      onCompleteCb!();
      onCompleteCb!(); // duplicate
    });

    expect(api.getImportResult).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('COMPLETED');
    expect(result.current.importResult?.total_rows).toBe(10);
  });

  it('7 & 8. reset and unmount unsubscribe', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    const unsubscribeSpy = vi.fn();
    vi.mocked(api.subscribeToProgress).mockReturnValue(unsubscribeSpy);

    const { result, unmount } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      result.current.reset();
    });
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);

    // Run again for unmount
    setupMockFileAndAnalysis(result);
    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      unmount();
    });
    expect(unsubscribeSpy).toHaveBeenCalledTimes(2);
  });

  it('9 & 10. old-job event after reset or new run does not mutate state', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    let onProgressCb1: (data: unknown) => void;
    vi.mocked(api.subscribeToProgress).mockImplementation((jobId, onProgress) => {
      if (jobId === 'job-1') onProgressCb1 = onProgress;
      return vi.fn();
    });

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      result.current.reset();
    });

    act(() => {
      onProgressCb1!({ rows_processed: 50 }); // late event from old job
    });

    expect(result.current.importProgress).toBeNull();
  });

  it('11. explicit terminal backend failure enters ERROR', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    let onProgressCb: (data: unknown) => void;
    vi.mocked(api.subscribeToProgress).mockImplementation((jobId, onProgress) => {
      onProgressCb = onProgress;
      return vi.fn();
    });

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      onProgressCb!({ status: 'failed', error: 'Boom' });
    });

    expect(result.current.state).toBe('ERROR');
    expect(result.current.error).toBe('Boom');
  });

  it('12. transient EventSource transport interruption does not fail the job', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    let onErrorCb: (err: Error) => void;
    vi.mocked(api.subscribeToProgress).mockImplementation((jobId, onProgress, onComplete, onError) => {
      onErrorCb = onError;
      return vi.fn();
    });

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      onErrorCb!(new Error('Transient disconnect'));
    });

    expect(result.current.state).toBe('IMPORTING'); // Should stay importing
  });
  
  it('12b. permanent EventSource transport interruption fails the job', async () => {
    vi.mocked(api.startImportJob).mockResolvedValue('job-1');
    let onErrorCb: (err: Error) => void;
    vi.mocked(api.subscribeToProgress).mockImplementation((jobId, onProgress, onComplete, onError) => {
      onErrorCb = onError;
      return vi.fn();
    });

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    act(() => {
      onErrorCb!(new Error('Progress stream disconnected permanently'));
    });

    expect(result.current.state).toBe('ERROR');
  });

  it('13. startImportJob failure releases the lock', async () => {
    vi.mocked(api.startImportJob).mockRejectedValue(new Error('Start failed'));

    const { result } = renderHook(() => useImportFlow());
    setupMockFileAndAnalysis(result);

    await act(async () => {
      await result.current.runImport();
    });

    expect(result.current.state).toBe('ERROR');

    // Should be able to start again
    vi.mocked(api.startImportJob).mockResolvedValue('job-2');
    await act(async () => {
      await result.current.runImport();
    });

    expect(result.current.state).toBe('IMPORTING');
  });
});
