import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { RenderOperationStatus } from '../../../../shared/render-freeze-contract';
import type { OperationRowStatus } from './operation-dialog-shared';
import {
  OperationStatusCell,
  isTerminalOperationPhase,
  operationDialogTitle,
} from './operation-dialog-shared';
import { DISK_RENDER_OUTPUT_TAB, useRenderToDiskStore } from '../../../stores/render-to-disk-store';
import { useOutputStore } from '../../../stores/output-store';
import { useDialogFocus } from '../../dialogs/use-dialog-focus';

/**
 * Global modal tracking a Render-to-Disk operation: a single row showing the
 * output file with an indefinite spinner while Csound renders and a checkmark
 * when done, plus a collapsible console mirroring the Csound (Disk) output
 * tab. The render is started by the native menu in the main process; this
 * dialog opens from the first status broadcast. OK stays disabled until the
 * operation reaches a terminal phase; Cancel cancels the running render and
 * is disabled once it has finished.
 */
export default function RenderToDiskDialog(): React.ReactElement | null {
  const open = useRenderToDiskStore((state) => state.open);
  const phase = useRenderToDiskStore((state) => state.phase);
  const progress = useRenderToDiskStore((state) => state.progress);
  const message = useRenderToDiskStore((state) => state.message);
  const outputPath = useRenderToDiskStore((state) => state.outputPath);
  const error = useRenderToDiskStore((state) => state.error);
  const outputExpanded = useRenderToDiskStore((state) => state.outputExpanded);
  const cancelRequested = useRenderToDiskStore((state) => state.cancelRequested);
  const cancel = useRenderToDiskStore((state) => state.cancel);
  const close = useRenderToDiskStore((state) => state.close);
  const toggleOutput = useRenderToDiskStore((state) => state.toggleOutput);

  // Isolated renderer tests and early startup can intentionally expose only a
  // partial preload bridge; disk-render statuses still require the full bridge.
  useEffect(() => {
    const unsubscribe = window.blueAPI?.onRenderOperationStatus?.(
      (status: RenderOperationStatus) => {
        useRenderToDiskStore.getState().handleStatus(status);
      },
    );
    return () => {
      unsubscribe?.();
    };
  }, []);

  const terminal = isTerminalOperationPhase(phase);
  const dialogRef = useDialogFocus(open, () => {
    close();
  });
  const okButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open && terminal) okButtonRef.current?.focus();
  }, [open, terminal]);

  const outputTab = useOutputStore((state) => state.tabs[DISK_RENDER_OUTPUT_TAB]);
  const consoleText = useMemo(() => {
    if (!outputTab) return '';
    const parts = outputTab.lines.map((line) => line.text);
    if (outputTab.pendingText.length > 0) parts.push(outputTab.pendingText);
    return parts.join('\n');
  }, [outputTab]);

  const outputRef = useRef<HTMLPreElement | null>(null);
  const stickToBottomRef = useRef(true);
  const handleOutputScroll = (): void => {
    const element = outputRef.current;
    if (!element) return;
    stickToBottomRef.current =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 40;
  };
  useEffect(() => {
    const element = outputRef.current;
    if (element && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [consoleText, outputExpanded]);

  if (!open) {
    return null;
  }

  const rowStatus: OperationRowStatus =
    phase === 'completed'
      ? 'complete'
      : phase === 'cancelled'
        ? 'cancelled'
        : phase === 'failed'
          ? 'failed'
          : 'running';

  const summary = terminal
    ? message
    : message + (progress === null ? '' : ` (${Math.round(progress)}%)`);

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
        aria-labelledby="render-to-disk-title"
      >
        <div className="flex items-center justify-between border-b border-app-hover px-4 py-3">
          <h2
            id="render-to-disk-title"
            className="text-role-title-2 font-bold text-app-text-bright"
            data-testid="render-dialog-title"
          >
            {operationDialogTitle('Render to Disk', phase)}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <table
            className="w-full border-collapse text-left text-role-body text-app-text"
            data-testid="render-items-table"
          >
            <thead>
              <tr className="text-app-text-muted">
                <th
                  scope="col"
                  className="sticky top-0 bg-app-surface px-2 py-2 text-role-headline font-bold"
                >
                  Output
                </th>
                <th
                  scope="col"
                  className="sticky top-0 bg-app-surface px-2 py-2 text-role-headline font-bold"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-app-hover/60" data-testid="render-row-output">
                <td className="break-all px-2 py-2 align-middle font-mono text-role-body">
                  {outputPath ?? <span className="font-sans text-app-text-muted">—</span>}
                </td>
                <td className="px-2 py-2 align-middle">
                  <OperationStatusCell status={rowStatus} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {error !== null && (
          <div
            role="alert"
            data-testid="render-dialog-error"
            className="max-h-24 overflow-auto border-t border-app-hover px-4 py-2 text-role-callout whitespace-pre-wrap text-red-400"
          >
            {error}
          </div>
        )}

        <div className="border-t border-app-hover">
          <button
            type="button"
            data-testid="render-output-toggle"
            className="flex w-full items-center gap-1.5 px-4 py-2 text-role-callout text-app-text-muted hover:text-app-text"
            aria-expanded={outputExpanded}
            aria-controls="render-output-console"
            onClick={toggleOutput}
          >
            {outputExpanded ? (
              <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
            )}
            <span>Output</span>
          </button>
          {outputExpanded && (
            <pre
              id="render-output-console"
              ref={outputRef}
              onScroll={handleOutputScroll}
              data-testid="render-output-text"
              className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-all border-t border-app-border-muted bg-black px-3 py-2 font-mono text-role-callout text-app-text"
            >
              {consoleText}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-app-hover px-4 py-3">
          <span
            className="min-w-0 truncate text-role-callout text-app-text-muted"
            data-testid="render-dialog-summary"
          >
            {summary}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-testid="render-dialog-cancel"
              className="rounded border border-app-hover px-3 py-1.5 text-role-body text-app-text hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50"
              onClick={cancel}
              disabled={terminal || cancelRequested}
            >
              Cancel
            </button>
            <button
              ref={okButtonRef}
              type="button"
              data-testid="render-dialog-ok"
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
