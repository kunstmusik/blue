import React from 'react';
import { Check, LoaderCircle, X } from 'lucide-react';

import type { RenderOperationStatus } from '../../../../shared/render-freeze-contract';

/** Row status vocabulary shared by the operation progress dialogs. */
export type OperationRowStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled'
  | 'notApplied';

export function isTerminalOperationPhase(phase: RenderOperationStatus['phase'] | null): boolean {
  return phase === 'completed' || phase === 'cancelled' || phase === 'failed';
}

export function operationDialogTitle(verb: string, phase: RenderOperationStatus['phase'] | null): string {
  const state = phase === 'completed'
    ? 'Complete'
    : phase === 'cancelled'
      ? 'Cancelled'
      : phase === 'failed'
        ? 'Failed'
        : 'Running';
  return `${verb} - ${state}`;
}

/** Indefinite spinner while running, checkmark on success, X on failure. */
export function OperationStatusCell({ status }: { status: OperationRowStatus }): React.ReactElement {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-app-text">
        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
        Running
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1.5 text-blue-accent">
        <Check size={14} strokeWidth={2.5} aria-hidden="true" />
        Complete
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-400">
        <X size={14} aria-hidden="true" />
        Failed
      </span>
    );
  }
  const label = status === 'pending' ? 'Waiting' : status === 'cancelled' ? 'Cancelled' : 'Not applied';
  return <span className="text-app-text-muted">{label}</span>;
}
