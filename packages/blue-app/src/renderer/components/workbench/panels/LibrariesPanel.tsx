import { useEffect, useLayoutEffect, useRef } from 'react';
import type { LibraryBrowseNode, LibraryType } from '../../../../shared/unified-library';
import { LibrarySearchBar } from '../../libraries/LibrarySearchBar';
import { LibraryTree } from '../../libraries/LibraryTree';
import { LibraryActionsMenu } from '../../libraries/LibraryActionsMenu';
import { LibraryImportDialog } from '../../libraries/LibraryImportDialog';
import { LibraryRecoveryPanel } from '../../libraries/LibraryRecoveryPanel';
import { useLibraryStore } from '../../../stores/library-store';

const TYPE_LABELS: Record<LibraryType, string> = {
  instrument: 'Instruments',
  udo: 'UDOs',
  soundObject: 'SoundObjects',
  effect: 'Effects',
};

export default function LibrariesPanel(): React.ReactElement {
  const state = useLibraryStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(useLibraryStore.getState().scrollTop);
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scrollTopRef.current;
    return () => {
      useLibraryStore.setState({ scrollTop: scrollTopRef.current });
    };
  }, []);

  const types = state.typeFilter === 'all'
    ? (Object.keys(TYPE_LABELS) as LibraryType[])
    : [state.typeFilter];
  const searchNodes: LibraryBrowseNode[] = state.searchResults.map((result, index) => ({
    key: result.key,
    nodeId: result.key.scope === 'user'
      ? result.key.nodeId
      : `search:${index}:${JSON.stringify(result.key)}`,
    parentId: null,
    libraryType: result.libraryType,
    scope: result.scope,
    nodeKind: 'item',
    displayName: result.displayName,
    breadcrumb: result.breadcrumb,
    supportStatus: result.supportStatus,
    objectType: result.objectType,
    revision: result.revision,
    hasChildren: false,
  }));
  const renameNode = (node: LibraryBrowseNode, name: string): void => {
    if (node.scope !== 'user' || typeof node.revision !== 'number') return;
    void state.applyMutation({ type: 'renameNode', nodeId: node.nodeId, expectedRevision: node.revision, name });
  };
  const duplicateNode = (node: LibraryBrowseNode): void => {
    if (node.scope !== 'user' || typeof node.revision !== 'number') return;
    void state.applyMutation({ type: 'duplicateNode', nodeId: node.nodeId, expectedRevision: node.revision });
  };
  const createFolder = (node: LibraryBrowseNode): void => {
    const name = window.prompt('Folder name');
    if (!name) return;
    void state.applyMutation({ type: 'createFolder', libraryType: node.libraryType, parentId: node.nodeId, name });
  };
  const deleteNode = (node: LibraryBrowseNode): void => {
    if (node.key?.scope !== 'user') return;
    void state.prepareDelete(node);
  };
  const restoreTreeFocus = (): void => {
    requestAnimationFrame(() => {
      const tree = document.querySelector<HTMLElement>('[role="tree"]');
      tree?.focus();
    });
  };

  if (state.snapshot?.phase === 'readOnlyFailure' && state.snapshot.failure) {
    return (
      <LibraryRecoveryPanel
        failure={state.snapshot.failure}
        onRetry={() => { void state.retryRecovery(); }}
        onRestore={() => { void state.restoreBackup(); }}
        onFresh={() => { void state.createFreshDatabase(); }}
        onManualImport={() => { void state.selectImportFiles(); }}
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-app-panel text-app-text">
      <div className="flex flex-none items-center border-b border-app-border pr-1">
        <LibrarySearchBar
          query={state.query}
          typeFilter={state.typeFilter}
          onQueryChange={state.setQuery}
          onTypeFilterChange={state.setTypeFilter}
        />
        <LibraryActionsMenu
          selectedType={state.typeFilter}
          onImport={() => { void state.selectImportFiles(); }}
          onExportCurrent={() => { void state.exportCurrent(); }}
          onExportAll={() => { void state.exportAll(); }}
        />
      </div>
      <div
        ref={scrollRef}
        data-library-scroll
        className="min-h-0 flex-1 overflow-auto p-1"
        onScroll={(event) => { scrollTopRef.current = event.currentTarget.scrollTop; }}
      >
          {state.error && <p role="alert" className="px-2 py-1 text-xs text-red-400">{state.error}</p>}
          {state.query.trim() ? (
            <>
              <LibraryTree
                label="Library search results"
                nodes={searchNodes}
                onSelect={state.selectItem}
                onOpen={(key) => { void state.openEditor(key, true); }}
                onRename={renameNode}
                onDuplicate={duplicateNode}
                onDelete={deleteNode}
                onCut={(node) => state.captureClipboard(node, 'cut')}
                onCopy={(node) => state.captureClipboard(node, 'copy')}
                clipboard={state.clipboard}
              />
              {state.nextSearchCursor && (
                <button type="button" className="m-2 rounded border border-app-border px-2 py-1 text-xs" onClick={state.loadMoreSearchResults}>
                  Load more
                </button>
              )}
            </>
          ) : (
            <>
              <section aria-label="User Libraries">
                <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-app-text-muted">User Libraries</h2>
                {types.map((type) => {
                  const rootNode = state.userRootsByType[type];
                  return (
                  <div key={`user-${type}`}>
                    <LibraryTree
                      label={`User ${TYPE_LABELS[type]}`}
                      nodes={rootNode ? [rootNode] : []}
                      childrenByParent={rootNode ? {
                        ...state.childrenByParent,
                        [rootNode.nodeId]: state.nodesByType[type],
                      } : state.childrenByParent}
                      onSelect={state.selectItem}
                      onExpand={state.expandNode}
                      onOpen={(key) => { void state.openEditor(key); }}
                      onRename={renameNode}
                      onDuplicate={duplicateNode}
                      onDelete={deleteNode}
                      onCreateFolder={createFolder}
                      onCut={(node) => state.captureClipboard(node, 'cut')}
                      onCopy={(node) => state.captureClipboard(node, 'copy')}
                      onPaste={(node) => { void state.pasteInto(node); }}
                      clipboard={state.clipboard}
                    />
                  </div>
                  );
                })}
              </section>
            </>
          )}
      </div>
      {state.importPreview && (
        <LibraryImportDialog preview={state.importPreview} onImport={() => { void state.executeImport(); }} onCancel={state.cancelImport} />
      )}
      {state.deletePreview && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="library-delete-title">
          <div className="w-full max-w-sm rounded border border-app-border bg-app-panel p-4 shadow-2xl">
            <h2 id="library-delete-title" className="font-semibold">Delete “{state.deletePreview.displayName}”?</h2>
            <p className="mt-2 text-xs text-app-text-muted">
              This removes {state.deletePreview.affectedCount} Library {state.deletePreview.affectedCount === 1 ? 'node' : 'nodes'} and cannot be undone.
            </p>
            {state.deletePreview.dirtyEditorSessionIds.length > 0 && (
              <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                {state.deletePreview.dirtyEditorSessionIds.length} affected Library Item {state.deletePreview.dirtyEditorSessionIds.length === 1 ? 'editor has' : 'editors have'} unsaved changes.
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded border border-app-border px-3 py-1 text-xs" onClick={() => { state.cancelDelete(); restoreTreeFocus(); }}>Cancel</button>
              {state.deletePreview.dirtyEditorSessionIds.length > 0 && (
                <button type="button" className="rounded border border-red-500/60 px-3 py-1 text-xs text-red-300" onClick={() => { void state.confirmDelete('discard').then(restoreTreeFocus); }}>Discard &amp; Delete</button>
              )}
              <button type="button" className="rounded bg-red-600 px-3 py-1 text-xs text-white" onClick={() => { void state.confirmDelete(state.deletePreview!.dirtyEditorSessionIds.length > 0 ? 'save' : 'discard').then(restoreTreeFocus); }}>
                {state.deletePreview.dirtyEditorSessionIds.length > 0 ? 'Save & Delete' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
