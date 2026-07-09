'use client';

import { useState } from 'react';
import { AlertCircle, Users, Upload } from 'lucide-react';
import { Sidebar, PageHeader } from '@/components/layout/Sidebar';
import { UploadModal } from '@/components/import/UploadModal';
import { PreviewPanel } from '@/components/import/PreviewPanel';
import { AnalysisProgress } from '@/components/import/AnalysisProgress';
import { MappingReview } from '@/components/import/MappingReview';
import { ImportProgressPanel } from '@/components/import/ImportProgress';
import { ResultsPanel } from '@/components/import/ResultsPanel';
import { useImportFlow } from '@/hooks/useImportFlow';
import { parseCsvLocally } from '@/lib/csvParser';

export default function HomePage() {
  const flow = useImportFlow();
  const [modalOpen, setModalOpen] = useState(false);

  const handleFileSelected = async (file: File) => {
    setModalOpen(false);
    try {
      const preview = await parseCsvLocally(file);
      flow.selectFile(file, preview);
    } catch (err) {
      flow.setState({
        state: 'ERROR',
        error: (err as Error).message,
      });
    }
  };

  const showPreview = flow.state === 'PREVIEW_READY' && flow.preview;
  const showAnalysis = flow.state === 'ANALYZING';
  const showMapping = flow.state === 'MAPPING_REVIEW' && flow.analysis;
  const showImporting = flow.state === 'IMPORTING';
  const showResults = flow.state === 'COMPLETED' && flow.importResult;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex flex-1 flex-col lg:ml-0">
        <PageHeader onImportClick={() => setModalOpen(true)} />

        <div className="flex-1 p-6">
          {/* Empty state */}
          {flow.state === 'IDLE' && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-20">
              <Users className="mb-4 h-12 w-12 text-slate-300" />
              <h2 className="text-lg font-medium text-slate-700">No leads imported yet</h2>
              <p className="mt-1 text-sm text-slate-500">
                Import a CSV file to get started with AI-powered lead mapping
              </p>
              <button
                className="btn-primary mt-6"
                onClick={() => setModalOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </button>
            </div>
          )}

          {/* Error state */}
          {flow.state === 'ERROR' && flow.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <h3 className="font-medium text-red-800">Something went wrong</h3>
                  <p className="mt-1 text-sm text-red-600">{flow.error}</p>
                  <button
                    className="btn-secondary mt-4"
                    onClick={flow.reset}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <UploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onFileSelected={handleFileSelected}
      />

      {showPreview && (
        <PreviewPanel
          preview={flow.preview!}
          onRemove={flow.reset}
          onCancel={flow.reset}
          onContinue={flow.runAnalysis}
        />
      )}

      {showAnalysis && (
        <AnalysisProgress currentStage={flow.analysisStage} />
      )}

      {showMapping && (
        <MappingReview
          analysis={flow.analysis!}
          mappings={flow.mappings}
          onUpdateMapping={flow.updateMapping}
          onConfirm={flow.runImport}
          onCancel={flow.reset}
          loading={false}
        />
      )}

      {showImporting && (
        <ImportProgressPanel
          progress={flow.importProgress}
          totalRows={flow.analysis?.row_count ?? 0}
        />
      )}

      {showResults && (
        <ResultsPanel
          result={flow.importResult!}
          onNewImport={flow.reset}
        />
      )}
    </div>
  );
}
