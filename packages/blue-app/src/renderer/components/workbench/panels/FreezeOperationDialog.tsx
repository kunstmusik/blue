import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type {
  FreezeItemStatus,
  RenderOperationStatus,
} from '../../../../shared/render-freeze-contract';
import { useFreezeOperationStore } from '../../../stores/freeze-operation-store';
import { useDialogFocus } from '../../instruments/blue-x7/use-dialog-focus';
import {
  OperationStatusCell,
  isTerminalOperationPhase,
  operationDialogTitle,
} from './operation-dialog-shared';

/**
 * Global modal tracking a freeze/unfreeze operation: one row per ScoreObject
 * with an indefinite spinner while it renders and a checkmark after commit,
 * plus a collapsible per-row Csound output console. OK stays disabled until
 * the operation reaches a terminal phase; Cancel cancels the running
 * operation and is disabled once it has finished.
 */
export default function FreezeOperationDialog(): React.ReactElement | null {
  const open = useFreezeOperationStore((state) => state.open);
  const phase = useFreezeOperationStore((state) => state.phase);
  const progress = useFreezeOperationStore((state) => state.progress);
  const message = useFreezeOperationStore((state) => state.message);
  const rows = useFreezeOperationStore((state) => state.rows);
  const selectedSelectionId = useFreezeOperationStore((state) => state.selectedSelectionId);
  const outputExpanded = useFreezeOperationStore((state) => state.outputExpanded);
  const result = useFreezeOperationStore((state) => state.result);
  const error = useFreezeOperationStore((state) => state.error);
  const cancelRequested = useFreezeOperationStore((state) => state.cancelRequested);
  const cancel = useFreezeOperationStore((state) => state.cancel);
  const close = useFreezeOperationStore((state) => state.close);
  const selectRow = useFreezeOperationStore((state) => state.selectRow);
  const toggleOutput = useFreezeOperationStore((state) => state.toggleOutput);

  // Isolated renderer tests and early startup can intentionally expose only a
  // partial preload bridge; freeze actions still require the full bridge.
  useEffect(() => {
    const api = window.blueAPI;
    const unsubscribeStatus = api?.onRenderOperationStatus?.((status: RenderOperationStatus) => {
      useFreezeOperationStore.getState().handleStatus(status);
    });
    const unsubscribeItems = api?.onFreezeItemStatus?.((item: FreezeItemStatus) => {
      useFreezeOperationStore.getState().handleItemEvent(item);
    });
    return () => {
      unsubscribeStatus?.();
      unsubscribeItems?.();
    };
  }, []);

  const terminal = isTerminalOperationPhase(phase);
  const dialogRef = useDialogFocus(open, () => { close(); });
  const okButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open && terminal) okButtonRef.current?.focus();
  }, [open, terminal]);

  const selectedRow = rows.find((row) => row.selectionId === selectedSelectionId) ?? null;

  const outputRef = useRef<HTMLPreElement | null>(null);
  const stickToBottomRef = useRef(true);
  const handleOutputScroll = (): void => {
    const element = outputRef.current;
    if (!element) return;
    stickToBottomRef.current = element.scrollTop + element.clientHeight >= element.scrollHeight - 40;
  };
  const selectedOutput = selectedRow?.output ?? '';
  useEffect(() => {
    const element = outputRef.current;
    if (element && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [selectedOutput, outputExpanded, selectedSelectionId]);

  if (!open) {
    return null;
  }

  const verb = rows.every((row) => row.action === 'unfreeze')
    ? 'Unfreezing'
    : rows.every((row) => row.action === 'freeze')
      ? 'Freezing'
      : 'Freeze/Unfreeze';

  let summary: string;
  if (phase === 'completed') {
    const changes = [
      result && result.frozenCount > 0 ? `${result.frozenCount} frozen` : null,
      result && result.unfrozenCount > 0 ? `${result.unfrozenCount} unfrozen` : null,
    ].filter((part): part is string => part !== null);
    summary = changes.length > 0
      ? `Freeze/unfreeze complete: ${changes.join(', ')}.`
      : (message || 'Freeze/unfreeze complete.');
  } else if (phase === 'cancelled') {
    summary = 'Freeze/unfreeze cancelled.';
  } else if (phase === 'failed') {
    summary = 'Freeze/unfreeze failed.';
  } else {
    summary = message + (progress === null ? '' : ` (${Math.round(progress)}%)`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(event) => {
        if (event.target === event.currentTarget && terminal) close();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="flex max-h-[80vh] w-[70vw] flex-col rounded-lg border border-app-hover bg-app-overlay shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="freeze-operation-title"
      >
        <div className="flex items-center justify-between border-b border-app-hover px-4 py-3">
          <h2 id="freeze-operation-title" className="text-role-title-2 font-bold text-app-text-bright" data-testid="freeze-dialog-title">
            {operationDialogTitle(verb, phase)}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <table className="w-full border-collapse text-left text-role-body text-app-text" data-testid="freeze-items-table">
            <thead>
              <tr className="text-app-text-muted">
                <th scope="col" className="sticky top-0 bg-app-surface px-2 py-2 text-role-headline font-bold">Object</th>
                <th scope="col" className="sticky top-0 bg-app-surface px-2 py-2 text-role-headline font-bold">Freeze File</th>
                <th scope="col" className="sticky top-0 bg-app-surface px-2 py-2 text-role-headline font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.selectionId}
                  data-testid={`freeze-row-${row.selectionId}`}
                  aria-selected={row.selectionId === selectedSelectionId}
                  className={`cursor-pointer border-b border-app-hover/60 ${
                    row.selectionId === selectedSelectionId ? 'bg-app-selection' : 'hover:bg-app-hover/40'
                  }`}
                  onClick={() => selectRow(row.selectionId)}
                >
                  <td className="px-2 py-2 align-middle">{row.name}</td>
                  <td className="break-all px-2 py-2 align-middle font-mono text-role-body">
                    {row.freezeFile ?? <span className="font-sans text-app-text-muted">—</span>}
                  </td>
                  <td className="px-2 py-2 align-middle" title={row.reason ?? undefined}>
                    <OperationStatusCell status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error !== null && (
          <div
            role="alert"
            data-testid="freeze-dialog-error"
            className="max-h-24 overflow-auto border-t border-app-hover px-4 py-2 text-role-callout whitespace-pre-wrap text-red-400"
          >
            {error}
          </div>
        )}

        <div className="border-t border-app-hover">
          <button
            type="button"
            data-testid="freeze-output-toggle"
            className="flex w-full items-center gap-1.5 px-4 py-2 text-role-callout text-app-text-muted hover:text-app-text"
            aria-expanded={outputExpanded}
            aria-controls="freeze-output-console"
            onClick={toggleOutput}
          >
            {outputExpanded
              ? <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
              : <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />}
            <span>Output{selectedRow ? ` — ${selectedRow.name}` : ''}</span>
          </button>
          {outputExpanded && (
            <pre
              id="freeze-output-console"
              ref={outputRef}
              onScroll={handleOutputScroll}
              data-testid="freeze-output-text"
              className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-all border-t border-app-border-muted bg-black px-3 py-2 font-mono text-role-callout text-app-text"
            >
              {selectedOutput}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-app-hover px-4 py-3">
          <span className="min-w-0 truncate text-role-callout text-app-text-muted" data-testid="freeze-dialog-summary">
            {summary}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-testid="freeze-dialog-cancel"
              className="rounded border border-app-hover px-3 py-1.5 text-role-body text-app-text hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50"
              onClick={cancel}
              disabled={terminal || cancelRequested}
            >
              Cancel
            </button>
            <button
              ref={okButtonRef}
              type="button"
              data-testid="freeze-dialog-ok"
              className="rounded bg-blue-accent px-3 py-1.5 text-role-body text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={close}
              disabled={!terminal}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
