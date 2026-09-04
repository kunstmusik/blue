import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  getLibraryTransferSourceType,
  type LibraryBrowseNode,
  type LibraryItemKey,
} from '../../../../shared/unified-library';
import { LibraryTree } from '../../libraries/LibraryTree';
import { LibraryBlockDropMarker } from '../../libraries/LibraryDropMarker';
import { ConfirmationDialog } from '../../dialogs/ConfirmationDialog';
import { libraryEditorPanelId, useLibraryEditorStore } from '../../../stores/library-editor-store';
import { useLibraryStore } from '../../../stores/library-store';
import { getProjectDocumentRevision, useProjectStore } from '../../../stores/project-store';
import { useWorkbenchStore } from '../../../stores/workbench-store';

interface PendingDeleteState {
  node: LibraryBrowseNode;
  token: string;
  linkedInstances: number;
  locations: readonly string[];
  requiresConfirmation: boolean;
  projectSessionId: number | null;
  projectRevision: number;
  selectedKey: LibraryItemKey | null;
}

export default function SoundObjectLibraryPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const projectRevision = getProjectDocumentRevision();
  const [nodes, setNodes] = useState<LibraryBrowseNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
  const refreshGeneration = useRef(0);
  const openEditor = useLibraryStore((state) => state.openEditor);
  const captureClipboard = useLibraryStore((state) => state.captureClipboard);
  const clipboard = useLibraryStore((state) => state.clipboard);
  const transferToProject = useLibraryStore((state) => state.transferToProject);
  const selectedKey = useLibraryStore((state) => state.selectedKey);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    if (!loaded) {
      setNodes([]);
      setError(null);
      return;
    }
    const parent = {
      scope: 'projectShared',
      libraryType: 'soundObject',
      projectSessionId,
    } as const;
    const nextNodes: LibraryBrowseNode[] = [];
    const seenNodeIds = new Set<string>();
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let contentRevision: number | undefined;
    do {
      const result = await window.blueAPI.browseLibraries({
        parent,
        cursor,
        limit: 500,
        ...(contentRevision === undefined ? {} : { expectedContentRevision: contentRevision }),
      });
      if (generation !== refreshGeneration.current) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      contentRevision ??= result.value.contentRevision;
      for (const child of result.value.children) {
        if (!seenNodeIds.has(child.nodeId)) {
          seenNodeIds.add(child.nodeId);
          nextNodes.push(child);
        }
      }
      const nextCursor = result.value.nextCursor ?? undefined;
      if (nextCursor && seenCursors.has(nextCursor)) {
        setError('Project SoundObject browse returned a repeated cursor.');
        return;
      }
      if (nextCursor) seenCursors.add(nextCursor);
      cursor = nextCursor;
    } while (cursor);
    if (generation !== refreshGeneration.current) return;
    setNodes(nextNodes);
    setError(null);
  }, [loaded, projectSessionId]);

  useEffect(() => {
    void refresh();
    const unsubscribe = window.blueAPI.onLibraryChanged(() => {
      void refresh();
    });
    return () => {
      refreshGeneration.current += 1;
      unsubscribe();
    };
  }, [refresh]);

  const deleteNode = (node: LibraryBrowseNode): void => {
    if (!node.key || node.key.scope !== 'projectShared') return;
    const selectedKeyAtPreview = useLibraryStore.getState().selectedKey;
    const projectSessionIdAtPreview = projectSessionId;
    const projectRevisionAtPreview = getProjectDocumentRevision();
    void (async () => {
      let preview: Awaited<ReturnType<typeof window.blueAPI.previewProjectLibraryDelete>>;
      try {
        preview = await window.blueAPI.previewProjectLibraryDelete(node.key!);
      } catch {
        setError('Unable to preview Project SoundObject deletion.');
        return;
      }
      if (!preview.ok) {
        setError(preview.error.message);
        return;
      }
      setPendingDelete({
        node,
        token: preview.value.confirmationToken,
        linkedInstances: preview.value.linkedInstanceCount,
        locations: [...preview.value.locations],
        requiresConfirmation: preview.value.requiresConfirmation,
        projectSessionId: projectSessionIdAtPreview,
        projectRevision: projectRevisionAtPreview,
        selectedKey: selectedKeyAtPreview,
      });
    })();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !pendingDelete.node.key) return;
    const { node } = pendingDelete;
    setPendingDelete(null);
    const currentSelectedKey = useLibraryStore.getState().selectedKey;
    const currentNode = nodes.find(
      (candidate) =>
        candidate.nodeId === node.nodeId &&
        candidate.revision === node.revision &&
        JSON.stringify(candidate.key) === JSON.stringify(node.key),
    );
    if (
      !currentNode ||
      useProjectStore.getState().sessionId !== pendingDelete.projectSessionId ||
      getProjectDocumentRevision() !== pendingDelete.projectRevision ||
      JSON.stringify(currentSelectedKey) !== JSON.stringify(pendingDelete.selectedKey) ||
      (currentSelectedKey !== null &&
        JSON.stringify(currentSelectedKey) !== JSON.stringify(node.key))
    ) {
      setError('Project SoundObject changed before deletion; try again.');
      return;
    }

    let revalidatedPreview: Awaited<ReturnType<typeof window.blueAPI.previewProjectLibraryDelete>>;
    try {
      revalidatedPreview = await window.blueAPI.previewProjectLibraryDelete(node.key);
    } catch {
      setError('Unable to revalidate Project SoundObject deletion.');
      return;
    }
    if (!revalidatedPreview.ok) {
      setError(revalidatedPreview.error.message);
      return;
    }
    if (
      revalidatedPreview.value.linkedInstanceCount !== pendingDelete.linkedInstances ||
      JSON.stringify(revalidatedPreview.value.locations) !==
        JSON.stringify(pendingDelete.locations) ||
      revalidatedPreview.value.requiresConfirmation !== pendingDelete.requiresConfirmation ||
      revalidatedPreview.value.confirmationToken.length === 0
    ) {
      setError('Project SoundObject changed before deletion; try again.');
      return;
    }

    const result = await window.blueAPI.deleteProjectLibraryItem(
      node.key,
      revalidatedPreview.value.confirmationToken,
    );
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    for (const sessionId of result.value.closedEditorSessionIds ?? []) {
      useLibraryEditorStore.setState((state) => {
        const sessions = { ...state.sessions };
        delete sessions[sessionId];
        return { sessions };
      });
      useWorkbenchStore.getState().closePanel(libraryEditorPanelId(sessionId));
    }
    if (JSON.stringify(useLibraryStore.getState().selectedKey) === JSON.stringify(node.key)) {
      useLibraryStore.setState({ selectedKey: null });
    }
    toast.success(`${node.displayName} deleted from Project SoundObjects.`);
    await refresh();
  };

  const pasteIntoProjectLibrary = (): void => {
    if (!clipboard) return;
    void transferToProject(
      { kind: 'clipboard', source: clipboard.source },
      { kind: 'projectSoundObjectLibrary', projectSessionId, projectRevision },
    );
  };
  const canPaste = Boolean(
    clipboard &&
    getLibraryTransferSourceType(clipboard.source) === 'soundObject' &&
    !(
      clipboard.operation === 'cut' &&
      clipboard.source.kind === 'library' &&
      clipboard.source.key.scope === 'projectShared'
    ),
  );

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-app-bg px-4 text-role-body text-app-text-muted">
        No project loaded
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-black p-1 text-app-text">
      {error && (
        <p role="alert" className="px-2 py-1 text-role-callout text-red-400">
          {error}
        </p>
      )}
      <LibraryTree
        label="Project SoundObjects"
        nodes={nodes}
        onSelect={(key) => {
          void openEditor(key, false);
        }}
        onOpen={(key) => {
          void openEditor(key, true);
        }}
        onCopy={(node) => {
          void captureClipboard(node, 'copy');
        }}
        onCut={(node) => {
          void captureClipboard(node, 'cut');
        }}
        onPaste={canPaste ? pasteIntoProjectLibrary : undefined}
        clipboard={clipboard}
        onDelete={deleteNode}
      />
      <LibraryBlockDropMarker
        target={{ kind: 'projectSoundObjectLibrary', projectSessionId, projectRevision }}
        label="Add SoundObject to Project SoundObjects"
      />
      {pendingDelete && (
        <ConfirmationDialog
          open={true}
          title={`Delete “${pendingDelete.node.displayName}”?`}
          description={`Delete “${pendingDelete.node.displayName}”${
            pendingDelete.linkedInstances > 0
              ? ` and ${pendingDelete.linkedInstances} linked score instance${pendingDelete.linkedInstances === 1 ? '' : 's'}`
              : ''
          }? This cannot be undone.`}
          actions={[
            { id: 'cancel', label: 'Cancel', intent: 'cancel' },
            { id: 'delete', label: 'Delete', intent: 'destructive' },
          ]}
          cancelActionId="cancel"
          onDecision={(actionId) => {
            if (actionId === 'delete') {
              void handleConfirmDelete();
            } else {
              setPendingDelete(null);
            }
          }}
        />
      )}
    </div>
  );
}
