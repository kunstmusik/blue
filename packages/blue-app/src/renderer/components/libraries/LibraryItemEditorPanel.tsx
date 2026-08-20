import { useEffect, useState } from 'react';
import type { LibraryEditorSessionSnapshot } from '../../../shared/unified-library';
import { useLibraryEditorStore } from '../../stores/library-editor-store';
import { LibraryBreadcrumbs } from './LibraryBreadcrumbs';
import { LibraryControlledEditor } from './editor-registry';
import { LibraryEditorToolbar } from './LibraryEditorToolbar';
import { LibrarySessionDialog } from './LibrarySessionDialog';

const USER_LIBRARY_LABELS = {
  instrument: 'Instruments',
  udo: 'User-Defined Opcodes',
  soundObject: 'SoundObjects',
  effect: 'Effects',
} as const;

function getDisplayBreadcrumbs(session: LibraryEditorSessionSnapshot): readonly string[] {
  if (session.key.scope === 'user') {
    return ['User Library', USER_LIBRARY_LABELS[session.key.libraryType], ...session.breadcrumb.slice(1)];
  }
  if (session.key.scope === 'projectShared' && session.key.libraryType === 'soundObject') {
    return ['Project Library', 'SoundObjects', ...session.breadcrumb.slice(2)];
  }
  return session.breadcrumb;
}

interface LibraryItemEditorPanelProps {
  sessionId: string;
}

export function LibraryItemEditorPanel({ sessionId }: LibraryItemEditorPanelProps): React.ReactElement {
  const [conflictDialogDismissed, setConflictDialogDismissed] = useState(false);
  const session = useLibraryEditorStore((state) => state.sessions[sessionId]);
  const loading = useLibraryEditorStore((state) => state.loadingSessionIds.has(sessionId));
  const error = useLibraryEditorStore((state) => state.error);
  useEffect(() => {
    void useLibraryEditorStore.getState().hydrate(sessionId);
  }, [sessionId]);
  useEffect(() => {
    if (session?.status !== 'conflict') setConflictDialogDismissed(false);
  }, [session?.status]);

  if (!session) {
    return <div className="grid h-full place-items-center p-4 text-role-body text-app-text-muted">{loading ? 'Loading Library editor…' : (error ?? 'Library editor session is no longer available.')}</div>;
  }

  const store = useLibraryEditorStore.getState();
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-app-bg text-app-text">
      <div className="border-b border-app-border px-2 py-1">
        <LibraryBreadcrumbs parts={getDisplayBreadcrumbs(session)} />
      </div>
      <LibraryEditorToolbar
        session={session}
        onSave={() => { void store.save(sessionId); }}
        onRevert={() => { void store.revert(sessionId); }}
        onResolveConflict={() => { setConflictDialogDismissed(false); }}
      />
      <LibraryControlledEditor
        session={session}
        onPatch={(documentPatch) => { void store.patch(sessionId, { documentPatch }); }}
      />
      {session.status === 'conflict' && !conflictDialogDismissed && (
        <LibrarySessionDialog
          title="Library item changed"
          message="The saved item changed elsewhere. Reload the latest item and discard this draft, explicitly overwrite the latest item with this draft, or cancel and retain the draft."
          primaryLabel="Reload latest"
          secondaryLabel="Overwrite latest"
          onPrimary={() => { void store.resolveConflict(sessionId, 'reloadLatest'); }}
          onSecondary={() => { void store.resolveConflict(sessionId, 'overwrite'); }}
          onCancel={() => {
            setConflictDialogDismissed(true);
            void store.resolveConflict(sessionId, 'cancel');
          }}
        />
      )}
      {session.status === 'missing' && (
        <LibrarySessionDialog title="Library item missing" message="This item was deleted. Your draft remains available in this editor until you close it." primaryLabel="Dismiss" onPrimary={() => { void store.patch(sessionId, { pinned: true }); }} />
      )}
    </div>
  );
}
