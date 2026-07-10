'use client';

import { Header } from '@/components/layout/Header';
import { UploadZone } from '@/components/import/UploadZone';
import { PreviewPanel } from '@/components/import/PreviewPanel';
import { AnalysisProgress } from '@/components/import/AnalysisProgress';
import { MappingReview } from '@/components/import/MappingReview';
import { ImportProgressPanel } from '@/components/import/ImportProgress';
import { ParseProgressPanel } from '@/components/import/ParseProgressPanel';
import { ResultsPanel } from '@/components/import/ResultsPanel';
import { useImportFlow } from '@/hooks/useImportFlow';
import { parseCsvLocally } from '@/lib/csvParser';
import { CheckCircle2, FileSpreadsheet, Sparkles, ShieldCheck, Download } from 'lucide-react';

export default function HomePage() {
  const flow = useImportFlow();

  const handleFileSelected = async (file: File) => {
    try {
      const runId = flow.startParsing(file);
      
      const abortController = new AbortController();
      
      const preview = await parseCsvLocally(file, {
        onProgress: (progress) => flow.setParseProgress(progress, runId),
        signal: abortController.signal
      });
      
      flow.selectFile(file, preview, runId);
    } catch (err) {
      flow.setState({
        state: 'ERROR',
        error: (err as Error).message,
      });
    }
  };

  const isIdle = flow.state === 'IDLE' || flow.state === 'ERROR';
  const showParsing = flow.state === 'PARSING';
  const showPreview = flow.state === 'PREVIEW_READY' && flow.preview;
  const showAnalysis = flow.state === 'ANALYZING';
  const showMapping = flow.state === 'MAPPING_REVIEW' && flow.analysis;
  const showImporting = flow.state === 'IMPORTING';
  const showResults = flow.state === 'COMPLETED' && flow.importResult;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Header />
      
      <main className="flex-1">
        {isIdle ? (
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl mb-4">
                Turn messy CSV files into clean CRM data
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                Upload lead exports from any source. AI understands the columns, maps the data, and converts it into a clean CRM-ready format.
              </p>
            </div>

            {/* Upload Area */}
            <div className="mb-16">
              <UploadZone onFileSelected={handleFileSelected} />
              
              {flow.state === 'ERROR' && flow.error && (
                <div className="mt-4 mx-auto max-w-2xl rounded-xl border border-error-border bg-error-bg p-4 text-center shadow-sm">
                  <p className="text-sm font-medium text-error-text">Error processing file</p>
                  <p className="text-sm text-error-text opacity-90">{flow.error}</p>
                </div>
              )}
            </div>

            {/* Capability Strip */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-4 max-w-5xl mx-auto mb-16">
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-teal-100 p-3 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-primary text-sm">Local Preview</h3>
                <p className="mt-1 text-sm text-muted">Previewed locally before AI analysis</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-orange-100 p-3 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-primary text-sm">Intelligent Mapping</h3>
                <p className="mt-1 text-sm text-muted">AI automatically aligns your columns</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-primary text-sm">Structured Validation</h3>
                <p className="mt-1 text-sm text-muted">Ensures phones and emails are valid</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-purple-100 p-3 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-primary text-sm">CRM-Ready Export</h3>
                <p className="mt-1 text-sm text-muted">Download perfectly formatted data</p>
              </div>
            </div>

            {/* How It Works & Supported Inputs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
              <div>
                <h2 className="text-xl font-semibold text-primary mb-6">How it works</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium text-primary">1</div>
                    <div>
                      <h4 className="font-medium text-primary">Upload & Preview</h4>
                      <p className="text-sm text-muted mt-1">Select your raw CSV export. We&apos;ll preview it locally.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium text-primary">2</div>
                    <div>
                      <h4 className="font-medium text-primary">Review AI Mapping</h4>
                      <p className="text-sm text-muted mt-1">Our AI analyzes your headers and data to suggest the best CRM fields.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium text-primary">3</div>
                    <div>
                      <h4 className="font-medium text-primary">Export Clean Data</h4>
                      <p className="text-sm text-muted mt-1">Process your rows and download a unified CSV ready for import.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface p-8 rounded-2xl border border-border shadow-sm">
                <h2 className="text-xl font-semibold text-primary mb-6 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted" />
                  Supported Inputs
                </h2>
                <p className="text-sm text-muted mb-6">
                  Designed to handle messy, unstandardized data formats from any platform:
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md bg-surface-secondary px-2.5 py-1 text-sm font-medium text-primary border border-border">Facebook Leads</span>
                  <span className="inline-flex items-center rounded-md bg-surface-secondary px-2.5 py-1 text-sm font-medium text-primary border border-border">Google Ads</span>
                  <span className="inline-flex items-center rounded-md bg-surface-secondary px-2.5 py-1 text-sm font-medium text-primary border border-border">Excel / Sheets</span>
                  <span className="inline-flex items-center rounded-md bg-surface-secondary px-2.5 py-1 text-sm font-medium text-primary border border-border">Real Estate CRM</span>
                  <span className="inline-flex items-center rounded-md bg-surface-secondary px-2.5 py-1 text-sm font-medium text-primary border border-border">Agency Exports</span>
                  <span className="inline-flex items-center rounded-md bg-surface-secondary px-2.5 py-1 text-sm font-medium text-primary border border-border">Custom CSV</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {showParsing && (
              <ParseProgressPanel
                progress={flow.parseProgress}
                fileName={flow.file?.name ?? 'File'}
              />
            )}

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
        )}
      </main>
    </div>
  );
}
