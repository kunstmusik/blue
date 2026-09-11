import React, { useEffect } from 'react';
import { useProjectHistory, useProjectHistoryEntries } from '../../../hooks/use-project-history';
import { cn } from '../../../lib/cn';
import { useProjectStore } from '../../../stores/project-store';
import type { ProjectHistoryEntrySummary } from '../../../../shared/project-history';

function formatEntryTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function HistoryEntryRow({
  entry,
  applied,
  saved,
}: {
  entry: ProjectHistoryEntrySummary;
  applied: boolean;
  saved: boolean;
}): React.ReactElement {
  return (
    <div
      role="listitem"
      data-history-state={applied ? 'applied' : 'undone'}
      className={cn(
        'flex items-baseline gap-2 px-2 py-1 text-role-body',
        applied ? 'text-blue-text' : 'text-blue-muted opacity-70',
      )}
    >
      <span className="min-w-0 flex-1 truncate" title={entry.label}>
        {entry.label}
      </span>
      {saved ? (
        <span className="flex-none rounded border border-blue-border/30 px-1 text-role-callout text-blue-muted">
          Saved
        </span>
      ) : null}
      <span className="flex-none text-role-callout text-blue-muted">
        {formatEntryTime(entry.timestamp)}
      </span>
    </div>
  );
}

function CurrentPositionRow(): React.ReactElement {
  return (
    <div
      role="separator"
      aria-label="Current position in history"
      className="border-t border-blue-border/40 px-2 py-1 text-role-callout text-blue-muted"
    >
      Current
    </div>
  );
}

/**
 * Display order is most recent first; the undo/redo split and the divider
 * position derive solely from the snapshot's own cursor (data-model.md).
 */
function displayRows(
  snapshot: ProjectHistoryEntriesSnapshot,
): Array<{ entry: ProjectHistoryEntrySummary; index: number }> {
  return snapshot.entries.map((entry, index) => ({ entry, index })).reverse();
}

/**
 * Undo History panel (spec 106): read-only visualization of the project
 * history stack with Undo/Redo commands. Closed by default; opens through
 * Window → Properties and docks with the properties group.
 */
export default function UndoHistoryPanel(): React.ReactElement {
  const loaded = useProjectStore((s) => s.loaded);
  const {
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    undo,
    redo,
    revision,
    cursor,
    length,
    savedStateId,
    retentionStatus,
  } = useProjectHistory();
  const { snapshot, refreshEntries } = useProjectHistoryEntries();

  // Refetch on mount and whenever the projection fingerprint changes, so
  // commits, undos, redos, evictions, and edits from other windows all keep
  // the list current without a dedicated push channel.
  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries, revision, cursor, length]);

  const hasUndoneEntries = snapshot !== null && snapshot.cursor < snapshot.entries.length;
  const dividerIndex = snapshot ? snapshot.cursor - 1 : -1;

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-blue-muted text-role-body p-4">
        No project loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black text-blue-text">
      <div className="flex flex-none items-center gap-2 border-b border-blue-border/20 px-2 py-1.5">
        <button
          type="button"
          className="toolbar-text-button"
          disabled={!canUndo}
          onClick={() => {
            void undo();
          }}
          title={undoLabel ? `Undo ${undoLabel}` : 'Undo'}
          aria-label={undoLabel ? `Undo ${undoLabel}` : 'Undo'}
        >
          Undo
        </button>
        <button
          type="button"
          className="toolbar-text-button"
          disabled={!canRedo}
          onClick={() => {
            void redo();
          }}
          title={redoLabel ? `Redo ${redoLabel}` : 'Redo'}
          aria-label={redoLabel ? `Redo ${redoLabel}` : 'Redo'}
        >
          Redo
        </button>
      </div>
      {snapshot && snapshot.entries.length > 0 ? (
        <div
          role="list"
          aria-label="Project history edits, most recent first"
          className="flex-1 min-h-0 overflow-auto"
        >
          {displayRows(snapshot).map(({ entry, index }) => (
            <React.Fragment key={entry.entryId}>
              {hasUndoneEntries && index === dividerIndex ? <CurrentPositionRow /> : null}
              <HistoryEntryRow
                entry={entry}
                applied={index < snapshot.cursor}
                saved={entry.afterStateId === savedStateId}
              />
            </React.Fragment>
          ))}
          {hasUndoneEntries && dividerIndex < 0 ? <CurrentPositionRow /> : null}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-4 text-blue-muted text-role-body text-center">No edits yet.</div>
        </div>
      )}
      {retentionStatus === 'at-entry-limit' || retentionStatus === 'at-byte-limit' ? (
        <div className="flex-none border-t border-blue-border/20 px-2 py-1 text-role-callout text-blue-muted">
          History limit reached; oldest edits were dropped.
        </div>
      ) : null}
    </div>
  );
}
