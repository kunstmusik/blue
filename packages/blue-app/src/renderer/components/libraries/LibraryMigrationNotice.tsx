import type { LibraryMigrationSummary } from '../../../shared/unified-library';

interface LibraryMigrationNoticeProps {
  summary: LibraryMigrationSummary;
  onDismiss: () => void;
  onReport: () => void;
}

export function LibraryMigrationNotice({ summary, onDismiss, onReport }: LibraryMigrationNoticeProps): React.ReactElement {
  return (
    <aside
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute bottom-3 left-3 right-3 z-20 rounded border border-app-border bg-app-panel/95 p-2 text-xs shadow-xl backdrop-blur"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Library migration {summary.status}</p>
          <p className="truncate text-app-text-muted" title={summary.message}>{summary.message}</p>
        </div>
        <button type="button" className="text-app-accent" onClick={onReport}>Report</button>
        <button type="button" aria-label="Dismiss migration notice" onClick={onDismiss}>×</button>
      </div>
    </aside>
  );
}
