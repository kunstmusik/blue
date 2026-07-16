import { useEffect } from 'react';
import type { LibraryBrowseNode, LibraryType } from '../../../../shared/unified-library';
import { LibrarySearchBar } from '../../libraries/LibrarySearchBar';
import { LibraryTree } from '../../libraries/LibraryTree';
import { LibraryActionsMenu } from '../../libraries/LibraryActionsMenu';
import { LibraryMigrationNotice } from '../../libraries/LibraryMigrationNotice';
import { LibraryImportDialog } from '../../libraries/LibraryImportDialog';
import { LibraryHistoryPanel } from '../../libraries/LibraryHistoryPanel';
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
  useEffect(() => {
    void useLibraryStore.getState().initialize();
  }, []);

  const types = state.typeFilter === 'all'
    ? (Object.keys(TYPE_LABELS) as LibraryType[])
    : [state.typeFilter];
  const showUser = state.sourceFilter !== 'project';
  const showProject = state.sourceFilter !== 'user' && state.projectAvailable;
  const searchNodes: LibraryBrowseNode[] = state.searchResults.map((result, index) => ({
    key: result.key,
    nodeId: `search:${index}:${JSON.stringify(result.key)}`,
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
    if (typeof node.revision !== 'number') return;
    void state.applyMutation({ type: 'renameNode', nodeId: node.nodeId, expectedRevision: node.revision, name });
  };
  const duplicateNode = (node: LibraryBrowseNode): void => {
    if (typeof node.revision !== 'number') return;
    void state.applyMutation({ type: 'duplicateNode', nodeId: node.nodeId, expectedRevision: node.revision });
  };
  const createFolder = (node: LibraryBrowseNode): void => {
    const name = window.prompt('Folder name');
    if (!name) return;
    void state.applyMutation({ type: 'createFolder', libraryType: node.libraryType, parentId: node.nodeId, name });
  };
  const deleteNode = (node: LibraryBrowseNode): void => {
    if (node.key?.scope !== 'user') {
      if (!node.key) return;
      void (async () => {
        const preview = await window.blueAPI.previewProjectLibraryDelete(node.key!);
        if (!preview.ok) return;
        const usage = preview.value.linkedInstanceCount > 0
          ? ` and ${preview.value.linkedInstanceCount} linked score instance${preview.value.linkedInstanceCount === 1 ? '' : 's'}`
          : '';
        if (!window.confirm(`Delete “${node.displayName}”${usage}? This cannot be undone.`)) return;
        const result = await window.blueAPI.deleteProjectLibraryItem(node.key!, preview.value.confirmationToken);
        if (result.ok) await state.refresh();
      })();
      return;
    }
    void state.prepareDelete(node);
  };
  const copyProjectToUser = (node: LibraryBrowseNode): void => {
    if (!node.key || node.key.scope === 'user') return;
    const destination = state.userRootsByType[node.libraryType];
    if (!destination) return;
    void (async () => {
      const result = await window.blueAPI.copyProjectLibraryItemToUser(node.key!, destination.nodeId);
      if (!result.ok) {
        useLibraryStore.setState({ error: result.error.message });
        return;
      }
      await state.refresh();
    })();
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
          sourceFilter={state.sourceFilter}
          projectAvailable={state.projectAvailable}
          onQueryChange={state.setQuery}
          onTypeFilterChange={state.setTypeFilter}
          onSourceFilterChange={state.setSourceFilter}
        />
        <LibraryActionsMenu
          selectedType={state.typeFilter}
          onImport={() => { void state.selectImportFiles(); }}
          onExportCurrent={() => { void state.exportCurrent(); }}
          onExportAll={() => { void state.exportAll(); }}
          onHistory={() => { void state.openHistory(); }}
          hasMigrationReport={Boolean(state.migrationSummary)}
          onMigrationReport={() => { void state.openHistory(); }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1">
          {!state.projectAvailable && (
            <p className="px-2 py-1 text-xs text-app-text-muted">No project is open. User Libraries remain available.</p>
          )}
          {state.error && <p role="alert" className="px-2 py-1 text-xs text-red-400">{state.error}</p>}
          {state.query.trim() ? (
            <>
              <LibraryTree label="Library search results" nodes={searchNodes} onSelect={state.selectItem} onOpen={(key) => { void state.openEditor(key, true); }} clipboard={state.clipboard} />
              {state.nextSearchCursor && (
                <button type="button" className="m-2 rounded border border-app-border px-2 py-1 text-xs" onClick={state.loadMoreSearchResults}>
                  Load more
                </button>
              )}
            </>
          ) : (
            <>
              {showUser && (
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
                        defaultExpandedNodeIds={rootNode ? [rootNode.nodeId] : []}
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
              )}
              {showProject && (
                <section aria-label="Current Project">
                  <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-app-text-muted">Current Project</h2>
                  {types.filter((type) => type !== 'effect').map((type) => (
                    <div key={`project-${type}`}>
                      <h3 className="px-2 py-1 text-xs font-medium">{TYPE_LABELS[type]}</h3>
                      <LibraryTree
                        label={`Project ${TYPE_LABELS[type]}`}
                        nodes={state.projectNodesByType[type]}
                        onSelect={state.selectItem}
                        onOpen={(key) => { void state.openEditor(key); }}
                        onDelete={deleteNode}
                        onCopyToUser={copyProjectToUser}
                        clipboard={state.clipboard}
                      />
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
      </div>
      {state.migrationSummary && (
        <LibraryMigrationNotice
          summary={state.migrationSummary}
          onDismiss={state.dismissMigrationSummary}
          onReport={() => { void state.openHistory(); }}
        />
      )}
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
      {state.historyOpen && (
        <LibraryHistoryPanel entries={state.history} onUndo={(batchId) => { void state.undoImport(batchId); }} onClose={state.closeHistory} />
      )}
    </div>
  );
}
