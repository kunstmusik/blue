import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Tree, type NodeRendererProps, type TreeApi } from 'react-arborist';
import {
  getFileManagerActionState,
  type FileManagerRootSnapshot,
} from '../../../../../../shared/file-manager';
import { writeFileManagerDragPayload } from './file-manager-drag-drop';
import {
  attachDiagnostics,
  childToNode,
  collectAncestorIdentities,
  collectBreadcrumb,
  findNode,
  getRootDisplayLabel,
  resetFileManagerTreeSessionState,
  rootToNode,
  sessionTreeState,
  toTreeData,
  withChildren,
  type BreadcrumbSegment,
  type FileTreeNode,
} from './file-manager-tree-state';
import { FileManagerBreadcrumb } from './FileManagerBreadcrumb';
import { FileManagerRootRenameDialog } from './FileManagerRootRenameDialog';

export { resetFileManagerTreeSessionState, type FileTreeNode, type BreadcrumbSegment };

interface FileManagerTreeProps {
  roots: FileManagerRootSnapshot[];
  onAddFavorite: (path: string) => Promise<void>;
  onRemoveFavorite: (path: string, rootId: string) => Promise<void>;
  onRenameRoot?: (rootId: string, rootPath: string, newLabel: string) => Promise<void>;
  /** Called when a regular file row is double-clicked. */
  onOpenFile?: (path: string) => void;
}

interface FileManagerTreeActions {
  onAddFavorite: (path: string) => Promise<void>;
  onRemoveFavorite: (path: string, rootId: string) => Promise<void>;
  refreshDirectory: (nodeId: string, path: string) => void;
  onOpenFile: (path: string) => void;
  onFocusDirectory: (node: FileTreeNode) => Promise<void>;
  renamingRootId: string | null;
  startRenameRoot: (rootId: string) => void;
  submitRenameRoot: (rootId: string, rootPath: string, newLabel: string) => Promise<void>;
  cancelRenameRoot: () => void;
}

const TreeActionsContext = createContext<FileManagerTreeActions | null>(null);
const SINGLE_CLICK_TOGGLE_DELAY_MS = 250;

function DirectoryNodeMenu({
  node,
  children,
}: {
  node: NodeRendererProps<FileTreeNode>['node'];
  children: React.ReactNode;
}): React.ReactElement {
  const actions = useContext(TreeActionsContext);
  const actionState = getFileManagerActionState({
    nodeKind: node.data.kind,
    rootKind: node.data.rootKind,
  });

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu" collisionPadding={8}>
          {actionState.refreshFolder && actions && (
            <ContextMenu.Item
              className="editor-context-menu__item"
              onSelect={() => actions.refreshDirectory(node.id, node.data.path)}
            >
              Refresh Folder
            </ContextMenu.Item>
          )}
          {actionState.addToFavorites && actions && (
            <ContextMenu.Item
              className="editor-context-menu__item"
              onSelect={() => void actions.onAddFavorite(node.data.path)}
            >
              Add to Favorites
            </ContextMenu.Item>
          )}
          {actionState.removeFromFavorites && actions && (
            <ContextMenu.Item
              className="editor-context-menu__item"
              onSelect={() => void actions.onRemoveFavorite(node.data.path, node.data.id)}
            >
              Remove from Favorites
            </ContextMenu.Item>
          )}
          {node.data.rootKind !== null && actions && (
            <>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item
                className="editor-context-menu__item"
                onSelect={() => actions.startRenameRoot(node.data.id)}
              >
                Rename Root
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function NodeRenderer({ node, style, dragHandle }: NodeRendererProps<FileTreeNode>): React.ReactElement {
  const actions = useContext(TreeActionsContext);
  const diagnostic = node.data.diagnosticId ?? null;
  const isDirectory = node.data.kind === 'directory';
  const isRoot = node.data.rootKind !== null;
  const pendingToggleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootDisplayLabel = isRoot
    ? getRootDisplayLabel(node.data.rootLabel, node.data.path)
    : null;

  useEffect(() => () => {
    if (pendingToggleRef.current !== null) clearTimeout(pendingToggleRef.current);
  }, []);

  const icon = isDirectory ? (
    node.isOpen ? (
      <FolderOpen aria-hidden="true" className="h-3.5 w-3.5 flex-none text-yellow-500" />
    ) : (
      <Folder aria-hidden="true" className="h-3.5 w-3.5 flex-none text-yellow-600" />
    )
  ) : (
    <File aria-hidden="true" className="h-3.5 w-3.5 flex-none text-blue-400" />
  );

  const handleClick = (event: React.MouseEvent) => {
    if (actions?.renamingRootId === node.data.id) return;
    node.handleClick(event);
    if (!node.data.canExpand) return;
    if (pendingToggleRef.current !== null) clearTimeout(pendingToggleRef.current);
    pendingToggleRef.current = setTimeout(() => {
      pendingToggleRef.current = null;
      node.toggle();
    }, SINGLE_CLICK_TOGGLE_DELAY_MS);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (actions?.renamingRootId === node.data.id || !actions) return;
    event.stopPropagation();
    if (pendingToggleRef.current !== null) {
      clearTimeout(pendingToggleRef.current);
      pendingToggleRef.current = null;
    }
    if (isDirectory) {
      void actions.onFocusDirectory(node.data);
    } else {
      actions.onOpenFile(node.data.path);
    }
  };

  const handleDragStart = (event: React.DragEvent) => {
    if (node.data.kind !== 'file') return;
    writeFileManagerDragPayload(event.dataTransfer, {
      version: 1,
      kind: 'file',
      path: node.data.path,
      name: node.data.name,
    });
  };

  const nodeContent = (
    <div
      ref={dragHandle}
      style={style}
      className={[
        'flex items-center gap-1.5 pr-2 text-content select-none cursor-pointer',
        node.isSelected ? 'bg-app-accent/20 text-app-text-bright' : 'text-app-text hover:bg-app-hover',
      ].join(' ')}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable={node.data.kind === 'file'}
      onDragStart={handleDragStart}
    >
      {node.data.canExpand ? (
        <ChevronRight
          aria-hidden="true"
          className={['h-3 w-3 flex-none transition-transform', node.isOpen ? 'rotate-90' : ''].join(' ')}
        />
      ) : (
        <span className="w-3 flex-none" />
      )}
      {icon}
      {isRoot ? (
        <span className="min-w-0 flex-1 truncate" title={node.data.path}>
          <span>{rootDisplayLabel}</span>
          <span className="text-app-text-muted"> - {node.data.path}</span>
        </span>
      ) : (
        <span className="min-w-0 truncate" title={node.data.path}>{node.data.name}</span>
      )}
      {node.data.rootKind === 'favorite' && (
        <span className="ml-auto flex-none text-ui text-app-text-muted">favorite</span>
      )}
      {diagnostic !== null && (
        <span
          role="note"
          className="min-w-0 flex-1 truncate text-ui text-red-400"
          title={diagnostic}
        >
          {diagnostic}
        </span>
      )}
    </div>
  );

  if (!isDirectory) return nodeContent;
  return <DirectoryNodeMenu node={node}>{nodeContent}</DirectoryNodeMenu>;
}

/**
 * Lazy, virtualized filesystem tree with focus navigation, breadcrumb bar,
 * context-menu root labels, and stable session-persisted scroll offset.
 */
export default function FileManagerTree({
  roots,
  onAddFavorite,
  onRemoveFavorite,
  onRenameRoot = async () => {},
  onOpenFile = () => {},
}: FileManagerTreeProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const treeApiRef = useRef<TreeApi<FileTreeNode> | null>(null);
  const [treeHeight, setTreeHeight] = useState(400);
  const [tree, setTreeState] = useState<FileTreeNode[]>(() => sessionTreeState.tree);
  const [diagnostics, setDiagnosticsState] = useState<Record<string, string>>(
    () => sessionTreeState.diagnostics,
  );
  const [renamingRootId, setRenamingRootId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(
    () => sessionTreeState.focusedNodeId,
  );
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbSegment[]>(
    () => sessionTreeState.breadcrumb,
  );
  const initialScrollOffsetRef = useRef(sessionTreeState.scrollOffset);
  const restoringInitialScrollRef = useRef(initialScrollOffsetRef.current > 0);

  const inFlightRef = useRef(new Set<string>());
  const treeRef = useRef(tree);
  treeRef.current = tree;

  const applyTree = useCallback((updater: (previous: FileTreeNode[]) => FileTreeNode[]) => {
    setTreeState((previous) => {
      const next = updater(previous);
      sessionTreeState.tree = next;
      return next;
    });
  }, []);

  const applyDiagnostics = useCallback((updater: (previous: Record<string, string>) => Record<string, string>) => {
    setDiagnosticsState((previous) => {
      const next = updater(previous);
      sessionTreeState.diagnostics = next;
      return next;
    });
  }, []);

  const rootKey = useMemo(() => roots.map((root) => `${root.id}:${root.label}`).join('\n'), [roots]);
  useEffect(() => {
    applyTree((previous) =>
      roots.map((root) => rootToNode(root, findNode(previous, root.id))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      setTreeHeight(el.clientHeight || 400);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Restore scroll offset on mount
  useEffect(() => {
    const targetScroll = initialScrollOffsetRef.current;
    if (targetScroll <= 0) return;

    const timeoutId = setTimeout(() => {
      treeApiRef.current?.list.current?.scrollTo(targetScroll);
      if (treeApiRef.current?.listEl.current) {
        treeApiRef.current.listEl.current.scrollTop = targetScroll;
      }
      restoringInitialScrollRef.current = false;
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const loadChildrenFor = useCallback(async (nodeId: string, directoryPath: string) => {
    if (inFlightRef.current.has(nodeId)) return;
    inFlightRef.current.add(nodeId);
    try {
      const result = await window.blueAPI.listFileManagerDirectory({ path: directoryPath });
      if (result.status === 'ok') {
        const ancestorIdentities = new Set(collectAncestorIdentities(treeRef.current, nodeId) ?? []);
        const target = findNode(treeRef.current, nodeId);
        if (!target) return;
        const children = result.snapshot.children
          .filter((child) => !ancestorIdentities.has(child.id))
          .map((child) => childToNode(target, child));
        applyTree((previous) => {
          if (!findNode(previous, nodeId)) return previous;
          return withChildren(previous, nodeId, children);
        });
        applyDiagnostics((previous) => {
          const diagnostic = result.snapshot.diagnostic;
          if (diagnostic !== undefined) return { ...previous, [nodeId]: diagnostic };
          if (!(nodeId in previous)) return previous;
          const next = { ...previous };
          delete next[nodeId];
          return next;
        });
      } else {
        applyDiagnostics((previous) => ({ ...previous, [nodeId]: result.message }));
      }
    } catch (err) {
      applyDiagnostics((previous) => ({
        ...previous,
        [nodeId]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      inFlightRef.current.delete(nodeId);
    }
  }, [applyDiagnostics, applyTree]);

  useEffect(() => {
    if (sessionTreeState.focusedNodeId !== null) {
      const node = findNode(treeRef.current, sessionTreeState.focusedNodeId);
      if (node && node.children === undefined) {
        void loadChildrenFor(node.id, node.path);
      }
    }
  }, [loadChildrenFor]);

  const handleToggle = useCallback((id: string) => {
    if (sessionTreeState.openIds.has(id)) {
      sessionTreeState.openIds.delete(id);
    } else {
      sessionTreeState.openIds.add(id);
    }
    const node = findNode(treeRef.current, id);
    if (!node || !node.canExpand) return;
    if (node.children === undefined) {
      void loadChildrenFor(id, node.path);
    }
  }, [loadChildrenFor]);

  const initialOpenState = useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const id of sessionTreeState.openIds) open[id] = true;
    if (focusedNodeId !== null) open[focusedNodeId] = true;
    return open;
  }, [focusedNodeId]);

  const refreshDirectory = useCallback((nodeId: string, directoryPath: string) => {
    void loadChildrenFor(nodeId, directoryPath);
  }, [loadChildrenFor]);

  const handleFocusDirectory = useCallback(async (targetNode: FileTreeNode) => {
    const freshNode = findNode(treeRef.current, targetNode.id);
    if (!freshNode || freshNode.children === undefined) {
      await loadChildrenFor(targetNode.id, targetNode.path);
    }

    const chain = collectBreadcrumb(treeRef.current, targetNode.id) ?? [{
      id: targetNode.id,
      path: targetNode.path,
      name: targetNode.name,
    }];

    sessionTreeState.levelStack.push({
      focusedNodeId: sessionTreeState.focusedNodeId,
      breadcrumb: [...sessionTreeState.breadcrumb],
      openIds: new Set(sessionTreeState.openIds),
      scrollOffset: sessionTreeState.scrollOffset,
    });

    sessionTreeState.focusedNodeId = targetNode.id;
    sessionTreeState.breadcrumb = chain;
    sessionTreeState.openIds = new Set([targetNode.id]);
    sessionTreeState.scrollOffset = 0;

    setFocusedNodeId(targetNode.id);
    setBreadcrumb(chain);

    treeApiRef.current?.list.current?.scrollTo(0);
    if (treeApiRef.current?.listEl.current) {
      treeApiRef.current.listEl.current.scrollTop = 0;
    }
  }, [loadChildrenFor]);

  const handleNavigateToRoots = useCallback(() => {
    const rootState = sessionTreeState.levelStack.find((s) => s.focusedNodeId === null) ?? {
      focusedNodeId: null,
      breadcrumb: [],
      openIds: new Set(),
      scrollOffset: 0,
    };

    sessionTreeState.focusedNodeId = null;
    sessionTreeState.breadcrumb = [];
    sessionTreeState.openIds = new Set(rootState.openIds);
    sessionTreeState.scrollOffset = rootState.scrollOffset;
    sessionTreeState.levelStack = [];

    setFocusedNodeId(null);
    setBreadcrumb([]);

    const targetScroll = rootState.scrollOffset;
    setTimeout(() => {
      treeApiRef.current?.list.current?.scrollTo(targetScroll);
      if (treeApiRef.current?.listEl.current) {
        treeApiRef.current.listEl.current.scrollTop = targetScroll;
      }
    }, 0);
  }, []);

  const handleNavigateToSegment = useCallback((index: number) => {
    if (index < 0 || index >= breadcrumb.length) return;
    const targetSegment = breadcrumb[index];
    if (!targetSegment) return;

    // Stack entries are keyed by the view they snapshot (focusedNodeId, null
    // = roots view), not by breadcrumb position: a level the user skipped —
    // for example a root that was expanded but never focused — has no saved
    // entry, so it gets a fresh state instead of a neighboring level's.
    const stack = sessionTreeState.levelStack;
    let savedIndex = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]!.focusedNodeId === targetSegment.id) {
        savedIndex = i;
        break;
      }
    }
    const saved = savedIndex >= 0 ? stack[savedIndex] : undefined;

    const restoredOpenIds = saved ? new Set(saved.openIds) : new Set([targetSegment.id]);
    const restoredScroll = saved ? saved.scrollOffset : 0;

    const nextBreadcrumb = breadcrumb.slice(0, index + 1);
    // Pop the restored view's old snapshot. If the level was never visited,
    // retain the entries above it so the roots snapshot stays restorable.
    const nextLevelStack = savedIndex >= 0
      ? stack.slice(0, savedIndex)
      : stack.slice(0, index + 1);

    sessionTreeState.focusedNodeId = targetSegment.id;
    sessionTreeState.breadcrumb = nextBreadcrumb;
    sessionTreeState.openIds = restoredOpenIds;
    sessionTreeState.scrollOffset = restoredScroll;
    sessionTreeState.levelStack = nextLevelStack;

    setFocusedNodeId(targetSegment.id);
    setBreadcrumb(nextBreadcrumb);

    setTimeout(() => {
      treeApiRef.current?.list.current?.scrollTo(restoredScroll);
      if (treeApiRef.current?.listEl.current) {
        treeApiRef.current.listEl.current.scrollTop = restoredScroll;
      }
    }, 0);
  }, [breadcrumb]);

  const startRenameRoot = useCallback((rootId: string) => {
    setRenamingRootId(rootId);
  }, []);

  const cancelRenameRoot = useCallback(() => {
    setRenamingRootId(null);
  }, []);

  const submitRenameRoot = useCallback(async (rootId: string, rootPath: string, newLabel: string) => {
    setRenamingRootId(null);
    await onRenameRoot(rootId, rootPath, newLabel);
  }, [onRenameRoot]);

  const actions = useMemo<FileManagerTreeActions>(
    () => ({
      onAddFavorite,
      onRemoveFavorite,
      refreshDirectory,
      onOpenFile,
      onFocusDirectory: handleFocusDirectory,
      renamingRootId,
      startRenameRoot,
      submitRenameRoot,
      cancelRenameRoot,
    }),
    [
      onAddFavorite,
      onRemoveFavorite,
      refreshDirectory,
      onOpenFile,
      handleFocusDirectory,
      renamingRootId,
      startRenameRoot,
      submitRenameRoot,
      cancelRenameRoot,
    ],
  );

  const visibleNodes = useMemo(() => {
    if (focusedNodeId !== null) {
      const focused = findNode(tree, focusedNodeId);
      if (focused) return [focused];
    }
    return tree;
  }, [tree, focusedNodeId]);

  const data = useMemo(
    () => toTreeData(attachDiagnostics(visibleNodes, diagnostics)),
    [visibleNodes, diagnostics],
  );
  const renamingRoot = renamingRootId === null ? undefined : findNode(tree, renamingRootId);

  return (
    <div className="flex h-full w-full flex-col">
      {focusedNodeId !== null && breadcrumb.length > 0 && (
        <FileManagerBreadcrumb
          breadcrumb={breadcrumb}
          onNavigateToRoots={handleNavigateToRoots}
          onNavigateToSegment={handleNavigateToSegment}
        />
      )}
      <div ref={containerRef} className="min-h-0 flex-1 w-full overflow-hidden">
        <TreeActionsContext.Provider value={actions}>
          <Tree<FileTreeNode>
            key={focusedNodeId ?? 'roots'}
            ref={treeApiRef}
            data={data}
            openByDefault={false}
            initialOpenState={initialOpenState}
            width="100%"
            height={treeHeight}
            indent={16}
            rowHeight={24}
            overscanCount={10}
            idAccessor="id"
            childrenAccessor="children"
            onToggle={handleToggle}
            onScroll={(props) => {
              // react-window reports its initial position (0) during mount.
              // Do not let that callback erase a cached offset before the
              // mount restore effect has applied it.
              if (restoringInitialScrollRef.current) {
                if (props.scrollOffset === 0) return;
                restoringInitialScrollRef.current = false;
              }
              sessionTreeState.scrollOffset = props.scrollOffset;
            }}
            disableDrag={() => true}
            disableDrop={() => true}
          >
            {NodeRenderer}
          </Tree>
        </TreeActionsContext.Provider>
      </div>
      {renamingRoot && (
        <FileManagerRootRenameDialog
          initialLabel={
            renamingRoot.rootLabel?.trim() && renamingRoot.rootLabel.trim() !== renamingRoot.path
              ? renamingRoot.rootLabel.trim()
              : ''
          }
          path={renamingRoot.path}
          onCancel={cancelRenameRoot}
          onSubmit={(label) => submitRenameRoot(renamingRoot.id, renamingRoot.path, label)}
        />
      )}
    </div>
  );
}
