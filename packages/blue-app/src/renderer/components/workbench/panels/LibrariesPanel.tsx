import { useEffect } from 'react';
import type { LibraryBrowseNode, LibraryType } from '../../../../shared/unified-library';
import { LibraryPreview } from '../../libraries/LibraryPreview';
import { LibrarySearchBar } from '../../libraries/LibrarySearchBar';
import { LibraryTree } from '../../libraries/LibraryTree';
import { LibraryTargetBanner } from '../../libraries/LibraryTargetBanner';
import { LibraryMigrationSummary } from '../../libraries/LibraryMigrationSummary';
import { LibraryActionsMenu } from '../../libraries/LibraryActionsMenu';
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
    void state.applyMutation({ type: 'renameNode', nodeId: node.nodeId, expectedRevision: node.revision, name });
  };
  const duplicateNode = (node: LibraryBrowseNode): void => {
    void state.applyMutation({ type: 'duplicateNode', nodeId: node.nodeId, expectedRevision: node.revision });
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
    if (!window.confirm(`Delete “${node.displayName}”? This cannot be undone.`)) return;
    void state.applyMutation({ type: 'deleteNode', nodeId: node.nodeId, expectedRevision: node.revision, confirmation: 'DELETE' });
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
      {state.migrationSummary && (
        <LibraryMigrationSummary
          summary={state.migrationSummary}
          onDismiss={state.dismissMigrationSummary}
          onHistory={() => { void state.openHistory(); }}
        />
      )}
      <LibraryActionsMenu
        selectedType={state.typeFilter}
        onImport={() => { void state.selectImportFiles(); }}
        onExportCurrent={() => { void state.exportCurrent(); }}
        onExportAll={() => { void state.exportAll(); }}
        onHistory={() => { void state.openHistory(); }}
      />
      <LibrarySearchBar
        query={state.query}
        typeFilter={state.typeFilter}
        sourceFilter={state.sourceFilter}
        projectAvailable={state.projectAvailable}
        onQueryChange={state.setQuery}
        onTypeFilterChange={state.setTypeFilter}
        onSourceFilterChange={state.setSourceFilter}
      />
      <LibraryTargetBanner context={state.context} onClear={() => { void state.clearTarget(); }} />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(140px,1fr)_minmax(120px,0.75fr)]">
        <div className="overflow-auto border-b border-app-border p-1">
          {!state.projectAvailable && (
            <p className="px-2 py-1 text-xs text-app-text-muted">No project is open. User Libraries remain available.</p>
          )}
          {state.error && <p role="alert" className="px-2 py-1 text-xs text-red-400">{state.error}</p>}
          {state.query.trim() ? (
            <>
              <LibraryTree label="Library search results" nodes={searchNodes} onSelect={state.selectItem} onOpen={(key) => { void state.openEditor(key, true); }} />
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
                  {types.map((type) => (
                    <div key={`user-${type}`}>
                      <h3 className="px-2 py-1 text-xs font-medium">{TYPE_LABELS[type]}</h3>
                      <LibraryTree
                        label={`User ${TYPE_LABELS[type]}`}
                        nodes={state.nodesByType[type]}
                        childrenByParent={state.childrenByParent}
                        onSelect={state.selectItem}
                        onExpand={state.expandNode}
                        onOpen={(key) => { void state.openEditor(key); }}
                        onRename={renameNode}
                        onDuplicate={duplicateNode}
                        onDelete={deleteNode}
                      />
                    </div>
                  ))}
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
                      />
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
        <LibraryPreview preview={state.selectedPreview} />
      </div>
      {state.context.target && state.selectedKey && (
        <div className="absolute bottom-2 right-2 flex gap-2">
          {state.insertionPreview ? (
            <button
              type="button"
              disabled={!state.insertionPreview.canApply}
              className="rounded bg-app-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
              onClick={() => { void state.applyInsertion(); }}
            >
              Confirm Insert
            </button>
          ) : (
            <button
              type="button"
              className="rounded bg-app-accent px-3 py-1.5 text-xs text-white"
              onClick={() => { void state.previewInsertion(); }}
            >
              Insert
            </button>
          )}
        </div>
      )}
      {state.importPreview && (
        <LibraryImportDialog preview={state.importPreview} onImport={() => { void state.executeImport(); }} onCancel={state.cancelImport} />
      )}
      {state.historyOpen && (
        <LibraryHistoryPanel entries={state.history} onUndo={(batchId) => { void state.undoImport(batchId); }} onClose={state.closeHistory} />
      )}
    </div>
  );
}
