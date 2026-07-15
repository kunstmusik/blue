import type { LibraryImportHistoryEntry } from '../../../shared/unified-library';

interface LibraryHistoryPanelProps {
  entries: readonly LibraryImportHistoryEntry[];
  onUndo: (batchId: string) => void;
  onClose: () => void;
}

export function LibraryHistoryPanel({ entries, onUndo, onClose }: LibraryHistoryPanelProps): React.ReactElement {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="library-history-title" className="absolute inset-0 z-30 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded border border-app-border bg-app-panel p-4 shadow-xl">
        <div className="flex justify-between gap-2">
          <h2 id="library-history-title" className="font-semibold">Import History</h2>
          <button type="button" onClick={onClose} aria-label="Close Import History">×</button>
        </div>
        {entries.length === 0 ? <p className="my-4 text-sm text-app-text-muted">No import history.</p> : (
          <ol className="my-3 grid gap-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 rounded border border-app-border p-2 text-sm">
                <span><strong>{entry.mode}</strong> — {entry.status} — {entry.sourceCount} source{entry.sourceCount === 1 ? '' : 's'}</span>
                {entry.status === 'completed' || entry.status === 'partial' ? (
                  <button type="button" onClick={() => onUndo(entry.id)} className="rounded border border-app-border px-2 py-1 text-xs">Undo Import</button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
