import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getLibraryTransferSourceType, type LibraryBrowseNode } from '../../../../shared/unified-library';
import { LibraryTree } from '../../libraries/LibraryTree';
import { LibraryBlockDropMarker } from '../../libraries/LibraryDropMarker';
import { libraryEditorPanelId, useLibraryEditorStore } from '../../../stores/library-editor-store';
import { useLibraryStore } from '../../../stores/library-store';
import { getProjectDocumentRevision, useProjectStore } from '../../../stores/project-store';
import { useWorkbenchStore } from '../../../stores/workbench-store';

export default function SoundObjectLibraryPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const projectRevision = getProjectDocumentRevision();
  const [nodes, setNodes] = useState<LibraryBrowseNode[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    void (async () => {
      const preview = await window.blueAPI.previewProjectLibraryDelete(node.key!);
      if (!preview.ok) {
        setError(preview.error.message);
        return;
      }
      const linkedInstances = preview.value.linkedInstanceCount;
      const usage = linkedInstances > 0
        ? ` and ${linkedInstances} linked score instance${linkedInstances === 1 ? '' : 's'}`
        : '';
      if (!window.confirm(`Delete “${node.displayName}”${usage}? This cannot be undone.`)) return;
      const result = await window.blueAPI.deleteProjectLibraryItem(node.key!, preview.value.confirmationToken);
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
      if (JSON.stringify(selectedKey) === JSON.stringify(node.key)) {
        useLibraryStore.setState({ selectedKey: null });
      }
      toast.success(`${node.displayName} deleted from Project SoundObjects.`);
      await refresh();
    })();
  };

  const pasteIntoProjectLibrary = (): void => {
    if (!clipboard) return;
    void transferToProject(
      { kind: 'clipboard', source: clipboard.source },
      { kind: 'projectSoundObjectLibrary', projectSessionId, projectRevision },
    );
  };
  const canPaste = Boolean(
    clipboard
    && getLibraryTransferSourceType(clipboard.source) === 'soundObject'
    && !(
      clipboard.operation === 'cut'
      && clipboard.source.kind === 'library'
      && clipboard.source.key.scope === 'projectShared'
    ),
  );

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-app-bg px-4 text-sm text-app-text-muted">
        No project loaded
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-app-bg p-1 text-app-text">
      {error && <p role="alert" className="px-2 py-1 text-xs text-red-400">{error}</p>}
      <LibraryTree
        label="Project SoundObjects"
        nodes={nodes}
        onSelect={(key) => { void openEditor(key, false); }}
        onOpen={(key) => { void openEditor(key, true); }}
        onCopy={(node) => { void captureClipboard(node, 'copy'); }}
        onCut={(node) => { void captureClipboard(node, 'cut'); }}
        onPaste={canPaste ? pasteIntoProjectLibrary : undefined}
        clipboard={clipboard}
        onDelete={deleteNode}
      />
      <LibraryBlockDropMarker
        target={{ kind: 'projectSoundObjectLibrary', projectSessionId, projectRevision }}
        label="Add SoundObject to Project SoundObjects"
      />
    </div>
  );
}
