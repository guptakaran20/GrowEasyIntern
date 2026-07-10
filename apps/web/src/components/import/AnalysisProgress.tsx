'use client';

import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGES = [
  'Reading CSV structure',
  'Profiling columns',
  'Detecting field meanings',
  'Building CRM mapping',
  'Validating analysis',
];

interface AnalysisProgressProps {
  currentStage: string;
}

export function AnalysisProgress({ currentStage }: AnalysisProgressProps) {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-xl bg-surface p-8 shadow-xl border border-border">
        <div className="mb-6 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
          <h2 className="mt-4 text-lg font-semibold text-primary">Analyzing CSV</h2>
          <p className="mt-1 text-sm text-muted">
            AI is inferring column mappings for your data
          </p>
        </div>

        <ul className="space-y-3">
          {STAGES.map((stage, index) => {
            const isComplete = currentIndex > index;
            const isCurrent = stage === currentStage;
            const isPending = currentIndex < index;

            return (
              <li
                key={stage}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isCurrent && 'bg-success-bg text-success-text',
                  isComplete && 'text-primary',
                  isPending && 'text-muted',
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {stage}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
