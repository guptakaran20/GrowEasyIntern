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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1">
        {isIdle ? (
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">
                Turn messy CSV files into clean CRM data
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed">
                Upload lead exports from any source. AI understands the columns, maps the data, and converts it into a clean CRM-ready format.
              </p>
            </div>

            {/* Upload Area */}
            <div className="mb-16">
              <UploadZone onFileSelected={handleFileSelected} />
              
              {flow.state === 'ERROR' && flow.error && (
                <div className="mt-4 mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-center shadow-sm">
                  <p className="text-sm font-medium text-red-800">Error processing file</p>
                  <p className="text-sm text-red-600">{flow.error}</p>
                </div>
              )}
            </div>

            {/* Capability Strip */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-4 max-w-5xl mx-auto mb-16">
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-teal-100 p-3 text-teal-600">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">Local Preview</h3>
                <p className="mt-1 text-sm text-slate-500">Previewed locally before AI analysis</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-orange-100 p-3 text-orange-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">Intelligent Mapping</h3>
                <p className="mt-1 text-sm text-slate-500">AI automatically aligns your columns</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-blue-100 p-3 text-blue-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">Structured Validation</h3>
                <p className="mt-1 text-sm text-slate-500">Ensures phones and emails are valid</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-3 rounded-full bg-purple-100 p-3 text-purple-600">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">CRM-Ready Export</h3>
                <p className="mt-1 text-sm text-slate-500">Download perfectly formatted data</p>
              </div>
            </div>

            {/* How It Works & Supported Inputs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-6">How it works</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">1</div>
                    <div>
                      <h4 className="font-medium text-slate-900">Upload & Preview</h4>
                      <p className="text-sm text-slate-500 mt-1">Select your raw CSV export. We&apos;ll preview it locally.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">2</div>
                    <div>
                      <h4 className="font-medium text-slate-900">Review AI Mapping</h4>
                      <p className="text-sm text-slate-500 mt-1">Our AI analyzes your headers and data to suggest the best CRM fields.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">3</div>
                    <div>
                      <h4 className="font-medium text-slate-900">Export Clean Data</h4>
                      <p className="text-sm text-slate-500 mt-1">Process your rows and download a unified CSV ready for import.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-slate-400" />
                  Supported Inputs
                </h2>
                <p className="text-sm text-slate-600 mb-6">
                  Designed to handle messy, unstandardized data formats from any platform:
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 border border-slate-200">Facebook Leads</span>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 border border-slate-200">Google Ads</span>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 border border-slate-200">Excel / Sheets</span>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 border border-slate-200">Real Estate CRM</span>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 border border-slate-200">Agency Exports</span>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 border border-slate-200">Custom CSV</span>
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
