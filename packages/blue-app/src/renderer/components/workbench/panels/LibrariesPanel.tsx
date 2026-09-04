import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { LibraryBrowseNode, LibraryType } from '../../../../shared/unified-library';
import { LibrarySearchBar } from '../../libraries/LibrarySearchBar';
import { LibraryTree, validateLibraryNodeName } from '../../libraries/LibraryTree';
import { LibraryActionsMenu } from '../../libraries/LibraryActionsMenu';
import { LibraryImportDialog } from '../../libraries/LibraryImportDialog';
import { LibraryRecoveryPanel } from '../../libraries/LibraryRecoveryPanel';
import { ConfirmationDialog } from '../../dialogs/ConfirmationDialog';
import { useLibraryStore } from '../../../stores/library-store';

const TYPE_LABELS: Record<LibraryType, string> = {
  instrument: 'Instruments',
  udo: 'User-Defined Opcodes',
  soundObject: 'SoundObjects',
  effect: 'Effects',
};

export default function LibrariesPanel(): React.ReactElement {
  const [folderParent, setFolderParent] = useState<LibraryBrowseNode | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderNameError, setFolderNameError] = useState<string | null>(null);
  const [folderCreating, setFolderCreating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const state = useLibraryStore(
    useShallow((current) => ({
      snapshot: current.snapshot,
      error: current.error,
      typeFilter: current.typeFilter,
      query: current.query,
      nodesByType: current.nodesByType,
      userRootsByType: current.userRootsByType,
      childrenByParent: current.childrenByParent,
      searchResults: current.searchResults,
      nextSearchCursor: current.nextSearchCursor,
      clipboard: current.clipboard,
      importPreview: current.importPreview,
      deletePreview: current.deletePreview,
      setTypeFilter: current.setTypeFilter,
      setQuery: current.setQuery,
      selectItem: current.selectItem,
      openEditor: current.openEditor,
      expandNode: current.expandNode,
      captureClipboard: current.captureClipboard,
      pasteInto: current.pasteInto,
      transferToUser: current.transferToUser,
      moveUserNode: current.moveUserNode,
      prepareDelete: current.prepareDelete,
      applyMutation: current.applyMutation,
      loadMoreSearchResults: current.loadMoreSearchResults,
      selectImportFiles: current.selectImportFiles,
      selectImportDirectory: current.selectImportDirectory,
      executeImport: current.executeImport,
      cancelImport: current.cancelImport,
      importInstrumentToFolder: current.importInstrumentToFolder,
      exportInstrument: current.exportInstrument,
      exportCurrent: current.exportCurrent,
      exportAll: current.exportAll,
      cancelDelete: current.cancelDelete,
      confirmDelete: current.confirmDelete,
      retryRecovery: current.retryRecovery,
      restoreBackup: current.restoreBackup,
      createFreshDatabase: current.createFreshDatabase,
    })),
  );
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

  const types =
    state.typeFilter === 'all' ? (Object.keys(TYPE_LABELS) as LibraryType[]) : [state.typeFilter];
  const searchNodes: LibraryBrowseNode[] = state.searchResults.map((result, index) => ({
    key: result.key,
    nodeId:
      result.key.scope === 'user'
        ? result.key.nodeId
        : `search:${index}:${JSON.stringify(result.key)}`,
    parentId: result.parentId,
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
    void state.applyMutation({
      type: 'renameNode',
      nodeId: node.nodeId,
      expectedRevision: node.revision,
      name,
    });
  };
  const duplicateNode = (node: LibraryBrowseNode): void => {
    if (node.scope !== 'user' || typeof node.revision !== 'number') return;
    void state.applyMutation({
      type: 'duplicateNode',
      nodeId: node.nodeId,
      expectedRevision: node.revision,
    });
  };
  const createFolder = (node: LibraryBrowseNode): void => {
    setFolderParent(node);
    setFolderName('');
    setFolderNameError(null);
  };
  const cancelCreateFolder = (): void => {
    setFolderParent(null);
    setFolderName('');
    setFolderNameError(null);
  };
  const submitCreateFolder = async (): Promise<void> => {
    if (!folderParent || folderCreating) return;
    const name = folderName.normalize('NFKC').trim();
    const validationError = validateLibraryNodeName(name);
    if (validationError) {
      setFolderNameError(validationError);
      return;
    }
    setFolderCreating(true);
    const created = await state.applyMutation({
      type: 'createFolder',
      libraryType: folderParent.libraryType,
      parentId: folderParent.nodeId,
      name,
    });
    setFolderCreating(false);
    if (created) {
      cancelCreateFolder();
      restoreTreeFocus();
    } else {
      setFolderNameError(useLibraryStore.getState().error ?? 'Unable to create the folder.');
    }
  };
  const deleteNode = (node: LibraryBrowseNode): void => {
    if (node.scope !== 'user' || node.nodeKind === 'root') return;
    void state.prepareDelete(node);
  };
  const reorderNode = (node: LibraryBrowseNode, targetIndex: number): void => {
    if (node.scope !== 'user' || node.nodeKind === 'root' || typeof node.revision !== 'number')
      return;
    void state.applyMutation({
      type: 'reorderNode',
      nodeId: node.nodeId,
      expectedRevision: node.revision,
      targetIndex,
    });
  };
  const restoreTreeFocus = (): void => {
    requestAnimationFrame(() => {
      const tree = document.querySelector<HTMLElement>('[role="tree"]');
      tree?.focus();
    });
  };
  const confirmDelete = async (decision: 'save' | 'discard'): Promise<void> => {
    const affectedNodeIds = state.deletePreview?.affectedNodeIds ?? [];
    const deleted = await state.confirmDelete(decision);
    if (deleted && selectedNodeId && affectedNodeIds.includes(selectedNodeId)) {
      setSelectedNodeId(null);
    }
    restoreTreeFocus();
  };

  if (state.snapshot?.phase === 'readOnlyFailure' && state.snapshot.failure) {
    return (
      <LibraryRecoveryPanel
        failure={state.snapshot.failure}
        onRetry={() => {
          void state.retryRecovery();
        }}
        onRestore={() => {
          void state.restoreBackup();
        }}
        onFresh={() => {
          void state.createFreshDatabase();
        }}
        onManualImport={() => {
          void state.selectImportFiles();
        }}
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-app-bg text-app-text">
      <div className="flex flex-none items-center border-b border-app-border pr-1">
        <LibrarySearchBar
          query={state.query}
          typeFilter={state.typeFilter}
          onQueryChange={state.setQuery}
          onTypeFilterChange={state.setTypeFilter}
        />
        <LibraryActionsMenu
          selectedType={state.typeFilter}
          onImport={() => {
            void state.selectImportFiles();
          }}
          onImportDirectory={() => {
            void state.selectImportDirectory();
          }}
          onExportCurrent={() => {
            void state.exportCurrent();
          }}
          onExportAll={() => {
            void state.exportAll();
          }}
        />
      </div>
      <div
        ref={scrollRef}
        data-library-scroll
        className="min-h-0 flex-1 overflow-auto p-1 bg-black"
        onScroll={(event) => {
          scrollTopRef.current = event.currentTarget.scrollTop;
        }}
      >
        {state.error && (
          <p role="alert" className="px-2 py-1 text-role-callout text-red-400">
            {state.error}
          </p>
        )}
        {state.query.trim() ? (
          <>
            <LibraryTree
              label="Library search results"
              nodes={searchNodes}
              onSelect={state.selectItem}
              onOpen={(key) => {
                void state.openEditor(key, true);
              }}
              onRename={renameNode}
              onDuplicate={duplicateNode}
              onDelete={deleteNode}
              onCut={(node) => {
                void state.captureClipboard(node, 'cut');
              }}
              onCopy={(node) => {
                void state.captureClipboard(node, 'copy');
              }}
              onPaste={(node) => {
                void state.pasteInto(node);
              }}
              clipboard={state.clipboard}
              selectedNodeId={selectedNodeId}
              onSelectedNodeChange={setSelectedNodeId}
            />
            {state.nextSearchCursor && (
              <button
                type="button"
                className="m-2 rounded border border-app-border px-2 py-1 text-role-callout"
                onClick={state.loadMoreSearchResults}
              >
                Load more
              </button>
            )}
          </>
        ) : (
          <>
            <section aria-label="User Libraries">
              <h2 className="px-2 py-1 text-role-headline font-bold uppercase tracking-wide text-app-text-muted">
                User Libraries
              </h2>
              {types.map((type) => {
                const rootNode = state.userRootsByType[type];
                const displayRootNode = rootNode && {
                  ...rootNode,
                  displayName: TYPE_LABELS[type],
                  breadcrumb: ['User Library', TYPE_LABELS[type]],
                };
                return (
                  <div key={`user-${type}`}>
                    <LibraryTree
                      label={`User ${TYPE_LABELS[type]}`}
                      nodes={displayRootNode ? [displayRootNode] : []}
                      childrenByParent={
                        rootNode
                          ? {
                              ...state.childrenByParent,
                              [rootNode.nodeId]: state.nodesByType[type],
                            }
                          : state.childrenByParent
                      }
                      onSelect={state.selectItem}
                      onExpand={state.expandNode}
                      onOpen={(key) => {
                        void state.openEditor(key);
                      }}
                      onRename={renameNode}
                      onDuplicate={duplicateNode}
                      onDelete={deleteNode}
                      onCreateFolder={createFolder}
                      onCut={(node) => {
                        void state.captureClipboard(node, 'cut');
                      }}
                      onCopy={(node) => {
                        void state.captureClipboard(node, 'copy');
                      }}
                      onPaste={(node) => {
                        void state.pasteInto(node);
                      }}
                      onImportInstrument={(node) => {
                        void state.importInstrumentToFolder(node);
                      }}
                      onExportInstrument={(node) => {
                        void state.exportInstrument(node);
                      }}
                      onTransferToUser={(descriptor, node) => {
                        void state.transferToUser(
                          { kind: 'drag', dragSessionId: descriptor.dragSessionId },
                          node,
                        );
                      }}
                      onMoveToUser={(source, destination) => {
                        void state.moveUserNode(source, destination);
                      }}
                      onReorder={reorderNode}
                      clipboard={state.clipboard}
                      selectedNodeId={selectedNodeId}
                      onSelectedNodeChange={setSelectedNodeId}
                    />
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
      {state.importPreview && (
        <LibraryImportDialog
          preview={state.importPreview}
          onImport={(folderSelections) => {
            void state.executeImport(folderSelections);
          }}
          onCancel={state.cancelImport}
        />
      )}
      {folderParent && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-create-folder-title"
        >
          <form
            className="w-full max-w-sm rounded border border-app-border bg-app-overlay p-4 text-app-text shadow-2xl"
            data-library-dialog-surface
            onSubmit={(event) => {
              event.preventDefault();
              void submitCreateFolder();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !folderCreating) {
                event.preventDefault();
                cancelCreateFolder();
                restoreTreeFocus();
              }
            }}
          >
            <h2 id="library-create-folder-title" className="text-role-title-3 font-semibold">
              Create Folder
            </h2>
            <label className="mt-3 block text-role-callout text-app-text-muted">
              Folder name
              <input
                autoFocus
                aria-label="Folder name"
                className="mt-1 w-full rounded border border-app-border bg-app-input px-2 py-1 text-app-text outline-none focus:border-app-accent"
                value={folderName}
                onChange={(event) => {
                  setFolderName(event.currentTarget.value);
                  setFolderNameError(null);
                }}
              />
            </label>
            {folderNameError && (
              <p role="alert" className="mt-2 text-role-callout text-red-400">
                {folderNameError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-app-border px-3 py-1 text-role-callout"
                disabled={folderCreating}
                onClick={() => {
                  cancelCreateFolder();
                  restoreTreeFocus();
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-app-accent px-3 py-1 text-role-callout text-white disabled:opacity-50"
                disabled={folderCreating}
              >
                {folderCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
      {state.deletePreview && (
        <ConfirmationDialog
          open={true}
          title={`Delete “${state.deletePreview.displayName}”?`}
          description={`This removes ${state.deletePreview.affectedCount} Library ${state.deletePreview.affectedCount === 1 ? 'node' : 'nodes'} and cannot be undone.`}
          actions={[
            { id: 'cancel', label: 'Cancel', intent: 'cancel' },
            ...(state.deletePreview.dirtyEditorSessionIds.length > 0
              ? [{ id: 'discard', label: 'Discard & Delete', intent: 'destructive' as const }]
              : []),
            {
              id: 'delete',
              label:
                state.deletePreview.dirtyEditorSessionIds.length > 0 ? 'Save & Delete' : 'Delete',
              intent: 'destructive' as const,
            },
          ]}
          cancelActionId="cancel"
          onDecision={(actionId) => {
            if (actionId === 'cancel') {
              state.cancelDelete();
              restoreTreeFocus();
            } else if (actionId === 'discard') {
              void confirmDelete('discard');
            } else if (actionId === 'delete') {
              void confirmDelete(
                state.deletePreview!.dirtyEditorSessionIds.length > 0 ? 'save' : 'discard',
              );
            }
          }}
        >
          {state.deletePreview.dirtyEditorSessionIds.length > 0 && (
            <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-role-callout text-amber-200">
              {state.deletePreview.dirtyEditorSessionIds.length} affected Library Item{' '}
              {state.deletePreview.dirtyEditorSessionIds.length === 1
                ? 'editor has'
                : 'editors have'}{' '}
              unsaved changes.
            </p>
          )}
        </ConfirmationDialog>
      )}
    </div>
  );
}
