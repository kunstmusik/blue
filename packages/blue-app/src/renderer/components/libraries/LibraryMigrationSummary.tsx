import type { LibraryMigrationSummary as MigrationSummary } from '../../../shared/unified-library';

interface LibraryMigrationSummaryProps {
  summary: MigrationSummary;
  onHistory: () => void;
  onDismiss: () => void;
}

const LABELS = { instrument: 'Instruments', udo: 'UDOs', effect: 'Effects', soundObject: 'SoundObjects' } as const;

export function LibraryMigrationSummary({ summary, onHistory, onDismiss }: LibraryMigrationSummaryProps): React.ReactElement {
  return (
    <aside role="status" aria-live="polite" className="border-b border-app-border bg-app-panel px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Java Blue library migration</p>
          <p className="text-app-text-muted">{summary.message}</p>
        </div>
        <button type="button" aria-label="Dismiss migration summary" onClick={onDismiss}>×</button>
      </div>
      {summary.sources.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {summary.sources.filter((source) => source.status !== 'absent').map((source) => (
            <li key={`${source.libraryType}:${source.sourcePath}`}>
              <span className="font-medium">{LABELS[source.libraryType]}</span>{' — '}
              {source.status === 'imported'
                ? `${source.itemCount} items, ${source.folderCount} folders, ${source.unsupportedCount} preserved unsupported`
                : `failed: ${source.error ?? 'Unknown error'}${source.backupAvailable ? ' (backup available)' : ''}`}
              <span className="sr-only"> Source {source.sourcePath.split(/[/\\]/u).at(-1)}</span>
            </li>
          ))}
        </ul>
      )}
      {summary.batchId && (
        <button data-action="history" type="button" onClick={onHistory} className="mt-2 text-app-accent underline">View Import History</button>
      )}
    </aside>
  );
}
