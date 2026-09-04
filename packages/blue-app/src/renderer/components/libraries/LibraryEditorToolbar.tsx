import type { LibraryEditorSessionSnapshot } from '../../../shared/unified-library';

interface LibraryEditorToolbarProps {
  session: LibraryEditorSessionSnapshot;
  onSave: () => void;
  onRevert: () => void;
  onResolveConflict: () => void;
}

export function LibraryEditorToolbar({
  session,
  onSave,
  onRevert,
  onResolveConflict,
}: LibraryEditorToolbarProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2 border-b border-app-border px-2 py-1">
      <button
        type="button"
        disabled={!session.dirty || session.status !== 'ready'}
        onClick={onSave}
        className="rounded border border-app-border px-2 py-1 text-role-callout disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        disabled={!session.dirty}
        onClick={onRevert}
        className="rounded border border-app-border px-2 py-1 text-role-callout disabled:opacity-40"
      >
        Revert
      </button>
      {session.status === 'conflict' && (
        <button
          type="button"
          onClick={onResolveConflict}
          className="rounded border border-app-border px-2 py-1 text-role-callout"
        >
          Resolve conflict
        </button>
      )}
      <span role="status" className="text-role-callout text-app-text-muted">
        {session.status === 'conflict'
          ? 'Conflict — reload or preserve your draft'
          : session.status === 'missing'
            ? 'Item was deleted'
            : session.dirty
              ? 'Unsaved changes'
              : 'Saved'}
      </span>
    </div>
  );
}
