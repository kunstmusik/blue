import type { LibraryFailureSnapshot } from '../../../shared/unified-library';

interface LibraryRecoveryPanelProps {
  failure: LibraryFailureSnapshot;
  onRetry: () => void;
  onRestore: () => void;
  onFresh: () => void;
  onManualImport: () => void;
}

export function LibraryRecoveryPanel({
  failure,
  onRetry,
  onRestore,
  onFresh,
  onManualImport,
}: LibraryRecoveryPanelProps): React.ReactElement {
  return (
    <div
      data-library-blocking-only="true"
      role="alert"
      className="flex h-full flex-col items-start justify-center gap-3 p-6 text-role-body"
    >
      <div>
        <h2 className="text-role-title-2 font-semibold">Libraries need recovery</h2>
        <p className="mt-1 text-app-text-muted">{failure.message}</p>
        <p className="mt-1 text-role-callout text-app-text-muted">
          Projects, playback, and other app features remain available.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!failure.retryable}
          onClick={onRetry}
          className="rounded border border-app-border px-3 py-1 disabled:opacity-40"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="rounded border border-app-border px-3 py-1"
        >
          Restore Backup
        </button>
        <button
          type="button"
          onClick={onManualImport}
          className="rounded border border-app-border px-3 py-1"
        >
          Re-import Java XML
        </button>
        <button
          type="button"
          onClick={onFresh}
          className="rounded border border-red-500 px-3 py-1 text-red-300"
        >
          Create Fresh
        </button>
      </div>
      <p className="text-role-callout text-app-text-muted">
        Recovery preserves the failed database before replacing it.
      </p>
    </div>
  );
}
