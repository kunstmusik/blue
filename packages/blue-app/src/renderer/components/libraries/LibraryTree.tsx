import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import type {
  LibraryBrowseNode,
  LibraryDragDescriptor,
  LibraryInteractionClipboard,
  LibraryItemKey,
} from '../../../shared/unified-library';
import { LibraryContextMenu } from './LibraryContextMenu';
import {
  BLUE_LIBRARY_DRAG_MIME,
  beginLibraryNodeDrag,
  cancelLibraryNodeDrag,
  readLibraryDragDescriptor,
  writeLibraryDragDescriptor,
} from './library-drag-drop';

interface LibraryTreeProps {
  label: string;
  nodes: readonly LibraryBrowseNode[];
  childrenByParent?: Readonly<Record<string, readonly LibraryBrowseNode[]>>;
  onSelect: (key: LibraryItemKey) => void;
  onExpand?: (node: LibraryBrowseNode) => void;
  onOpen?: (key: LibraryItemKey) => void;
  onRename?: (node: LibraryBrowseNode, name: string) => void;
  onDuplicate?: (node: LibraryBrowseNode) => void;
  onDelete?: (node: LibraryBrowseNode) => void;
  onCreateFolder?: (node: LibraryBrowseNode) => void;
  onCut?: (node: LibraryBrowseNode) => void;
  onCopy?: (node: LibraryBrowseNode) => void;
  onPaste?: (node: LibraryBrowseNode) => void;
  onImportInstrument?: (node: LibraryBrowseNode) => void;
  onExportInstrument?: (node: LibraryBrowseNode) => void;
  onTransferToUser?: (descriptor: LibraryDragDescriptor, destination: LibraryBrowseNode) => void;
  onMoveToUser?: (source: LibraryBrowseNode, destination: LibraryBrowseNode) => void;
  dropRoot?: LibraryBrowseNode | null;
  onReorder?: (node: LibraryBrowseNode, targetIndex: number) => void;
  clipboard?: LibraryInteractionClipboard | null;
  defaultExpandedNodeIds?: readonly string[];
  selectedNodeId?: string | null;
  onSelectedNodeChange?: (nodeId: string) => void;
}

interface VisibleTreeNode {
  node: LibraryBrowseNode;
  level: number;
}

const EMPTY_EXPANDED_NODE_IDS: readonly string[] = [];

export function validateLibraryNodeName(name: string): string | null {
  const normalized = name.normalize('NFKC').trim();
  if (!normalized) return 'A name is required.';
  if (normalized.length > 255) return 'Names must be 255 characters or fewer.';
  if (/[/\\\u0000-\u001f]/u.test(normalized))
    return 'Names cannot contain slashes or control characters.';
  return null;
}

/**
 * Native HTML drag/drop tree for Libraries (SPEC 084).
 *
 * Explicit non-participant in the per-`Document` React DnD ownership domain:
 * this tree uses `draggable`/`DataTransfer` events only and must never create
 * a React DnD HTML5 backend. It coexists with `BlueTree` surfaces in the same
 * document; see docs/tree-drag-and-drop.md before changing its drag behavior.
 */
export function LibraryTree({
  label,
  nodes,
  childrenByParent = {},
  onSelect,
  onExpand,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onCreateFolder,
  onCut,
  onCopy,
  onPaste,
  onImportInstrument,
  onExportInstrument,
  onTransferToUser,
  onMoveToUser,
  dropRoot = null,
  onReorder,
  clipboard = null,
  defaultExpandedNodeIds = EMPTY_EXPANDED_NODE_IDS,
  selectedNodeId,
  onSelectedNodeChange,
}: LibraryTreeProps): React.ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(defaultExpandedNodeIds));
  const treeRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const dragDescriptors = useRef<Record<string, LibraryDragDescriptor>>({});
  const draggedUserNodes = useRef<Record<string, LibraryBrowseNode>>({});
  const activeUserDragDescriptor = useRef<LibraryDragDescriptor | null>(null);
  const [dragMessage, setDragMessage] = useState('');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  useEffect(() => {
    setExpanded((current) => {
      if (defaultExpandedNodeIds.every((nodeId) => current.has(nodeId))) return current;
      return new Set([...current, ...defaultExpandedNodeIds]);
    });
  }, [defaultExpandedNodeIds]);
  const visible = useMemo(() => {
    const result: VisibleTreeNode[] = [];
    const append = (items: readonly LibraryBrowseNode[], level: number) => {
      for (const node of items) {
        result.push({ node, level });
        if (expanded.has(node.nodeId)) append(childrenByParent[node.nodeId] ?? [], level + 1);
      }
    };
    append(nodes, 1);
    return result;
  }, [childrenByParent, expanded, nodes]);
  const visibleById = useMemo(
    () =>
      new Map(
        [...visible.map(({ node }) => node), ...(dropRoot ? [dropRoot] : [])].map((node) => [
          node.nodeId,
          node,
        ]),
      ),
    [dropRoot, visible],
  );
  const resolvedActiveIndex =
    selectedNodeId === undefined
      ? activeIndex
      : visible.findIndex(({ node }) => node.nodeId === selectedNodeId);

  const markActive = (index: number): void => {
    setActiveIndex(index);
    const nodeId = visible[index]?.node.nodeId;
    if (nodeId) onSelectedNodeChange?.(nodeId);
  };

  const isDescendantDestination = useCallback(
    (source: LibraryBrowseNode, destination: LibraryBrowseNode): boolean => {
      let current: LibraryBrowseNode | undefined = destination;
      const visited = new Set<string>();
      while (current && !visited.has(current.nodeId)) {
        if (current.nodeId === source.nodeId) return true;
        visited.add(current.nodeId);
        current = current.parentId ? visibleById.get(current.parentId) : undefined;
      }
      return false;
    },
    [visibleById],
  );

  const toggle = (node: LibraryBrowseNode): void => {
    if (node.nodeKind === 'item') return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(node.nodeId)) next.delete(node.nodeId);
      else {
        next.add(node.nodeId);
        onExpand?.(node);
      }
      return next;
    });
  };

  const prepareDrag = useCallback((node: LibraryBrowseNode) => {
    if (node.supportStatus === 'unsupported' || dragDescriptors.current[node.nodeId]) return;
    const descriptor =
      node.scope === 'user' && node.nodeKind === 'folder'
        ? {
            dragSessionId: crypto.randomUUID(),
            libraryType: node.libraryType,
            sourceScope: 'user' as const,
          }
        : beginLibraryNodeDrag(node);
    if (descriptor) {
      dragDescriptors.current[node.nodeId] = descriptor;
      if (node.scope === 'user') draggedUserNodes.current[descriptor.dragSessionId] = node;
    }
  }, []);

  const activate = (index: number): void => {
    const candidate = visible[index]?.node;
    if (candidate) markActive(index);
    if (candidate?.key) onSelect(candidate.key);
    else if (candidate) toggle(candidate);
    queueMicrotask(() => treeRef.current?.focus());
  };

  const startRename = (node: LibraryBrowseNode): void => {
    setRenamingId(node.nodeId);
    setRenameValue(node.displayName);
    setRenameError(null);
  };

  const submitRename = (node: LibraryBrowseNode): void => {
    const error = validateLibraryNodeName(renameValue);
    if (error) {
      setRenameError(error);
      requestAnimationFrame(() => renameInputRef.current?.focus());
      return;
    }
    onRename?.(node, renameValue.normalize('NFKC').trim());
    setRenamingId(null);
    setRenameError(null);
    queueMicrotask(() => treeRef.current?.focus());
  };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={
        visible[resolvedActiveIndex]
          ? `library-node-${visible[resolvedActiveIndex].node.nodeId}`
          : undefined
      }
      className="outline-none focus-visible:ring-1 focus-visible:ring-app-accent"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(BLUE_LIBRARY_DRAG_MIME)) return;
        const transferredDescriptor = readLibraryDragDescriptor(event.dataTransfer);
        const descriptor =
          transferredDescriptor?.sourceScope === 'user'
            ? transferredDescriptor
            : (activeUserDragDescriptor.current ?? transferredDescriptor);
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-library-node-id]');
        const destination =
          visible.find(({ node }) => node.nodeId === row?.dataset.libraryNodeId)?.node ?? dropRoot;
        if (descriptor?.sourceScope === 'user') {
          const source = draggedUserNodes.current[descriptor.dragSessionId];
          if (
            !source ||
            !onMoveToUser ||
            !destination ||
            destination.scope !== 'user' ||
            destination.nodeKind === 'item' ||
            source.libraryType !== destination.libraryType ||
            (source.nodeKind === 'folder' && isDescendantDestination(source, destination))
          )
            return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropTargetId(destination.nodeId);
          return;
        }
        if (!onTransferToUser) return;
        if (
          !destination ||
          destination.scope !== 'user' ||
          (descriptor && destination.libraryType !== descriptor.libraryType)
        )
          return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setDropTargetId(destination.nodeId);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDropTargetId(null);
      }}
      onDrop={(event) => {
        const transferredDescriptor = readLibraryDragDescriptor(event.dataTransfer);
        const descriptor =
          transferredDescriptor?.sourceScope === 'user'
            ? transferredDescriptor
            : (activeUserDragDescriptor.current ?? transferredDescriptor);
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-library-node-id]');
        const destination =
          visible.find(({ node }) => node.nodeId === row?.dataset.libraryNodeId)?.node ?? dropRoot;
        setDropTargetId(null);
        if (descriptor?.sourceScope === 'user') {
          const source = draggedUserNodes.current[descriptor.dragSessionId];
          delete draggedUserNodes.current[descriptor.dragSessionId];
          if (
            !source ||
            !onMoveToUser ||
            !destination ||
            destination.scope !== 'user' ||
            destination.nodeKind === 'item' ||
            source.libraryType !== destination.libraryType ||
            (source.nodeKind === 'folder' && isDescendantDestination(source, destination))
          )
            return;
          event.preventDefault();
          onMoveToUser(source, destination);
          if (source.nodeKind === 'item') void cancelLibraryNodeDrag(descriptor);
          activeUserDragDescriptor.current = null;
          return;
        }
        if (
          !descriptor ||
          !onTransferToUser ||
          !destination ||
          destination.scope !== 'user' ||
          destination.libraryType !== descriptor.libraryType
        )
          return;
        event.preventDefault();
        onTransferToUser(descriptor, destination);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          markActive(Math.min(visible.length - 1, resolvedActiveIndex + 1));
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          markActive(Math.max(0, resolvedActiveIndex - 1));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          const node = visible[resolvedActiveIndex]?.node;
          if (node && !expanded.has(node.nodeId)) toggle(node);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          const node = visible[resolvedActiveIndex]?.node;
          if (node && expanded.has(node.nodeId)) toggle(node);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(resolvedActiveIndex);
        } else if (event.key === 'F2') {
          const node = visible[resolvedActiveIndex]?.node;
          if (node && node.nodeKind !== 'root' && onRename) startRename(node);
        } else if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
          event.preventDefault();
          const node = visible[resolvedActiveIndex]?.node;
          if (node) {
            const row = document.getElementById(`library-node-${node.nodeId}`);
            const rect = row?.getBoundingClientRect();
            row?.dispatchEvent(
              new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: rect?.left ?? 12,
                clientY: rect?.bottom ?? 12,
              }),
            );
          }
        }
      }}
    >
      <span className="sr-only" aria-live="polite">
        {dragMessage}
      </span>
      {nodes.length === 0 && (
        <p className="px-3 py-2 text-role-callout text-app-text-muted">No items</p>
      )}
      {visible.map(({ node, level }, index) => {
        const canExpand = node.nodeKind !== 'item';
        const siblings = node.parentId ? (childrenByParent[node.parentId] ?? []) : nodes;
        const siblingIndex = siblings.findIndex((candidate) => candidate.nodeId === node.nodeId);
        const tooltip = node.nodeKind === 'item' ? node.breadcrumb.join(' / ') : node.displayName;
        return (
          <LibraryContextMenu
            key={node.nodeId}
            node={node}
            clipboard={clipboard}
            onCreateFolder={onCreateFolder}
            onDuplicate={onDuplicate}
            onCut={onCut}
            onCopy={onCopy}
            onPaste={onPaste}
            onImportInstrument={onImportInstrument}
            onExportInstrument={onExportInstrument}
            onDelete={onDelete}
            onMoveUp={
              onReorder && siblingIndex > 0
                ? (candidate) => onReorder(candidate, siblingIndex - 1)
                : undefined
            }
            onMoveDown={
              onReorder && siblingIndex >= 0 && siblingIndex < siblings.length - 1
                ? (candidate) => onReorder(candidate, siblingIndex + 1)
                : undefined
            }
          >
            <div
              id={`library-node-${node.nodeId}`}
              data-library-node-id={node.nodeId}
              role="treeitem"
              aria-level={level}
              aria-selected={index === resolvedActiveIndex}
              aria-expanded={canExpand ? expanded.has(node.nodeId) : undefined}
              title={tooltip}
              className={cn(
                'flex min-h-7 items-center gap-1 rounded px-1 text-role-body [contain-intrinsic-size:auto_28px] [content-visibility:auto]',
                dropTargetId === node.nodeId
                  ? 'ring-1 ring-inset ring-app-accent'
                  : index === resolvedActiveIndex
                    ? 'bg-app-selection'
                    : 'hover:bg-app-hover',
              )}
              style={{ paddingLeft: `${(level - 1) * 14 + 4}px` }}
              onMouseDown={() => markActive(index)}
              onContextMenu={() => markActive(index)}
              onPointerDown={() => prepareDrag(node)}
              onMouseEnter={() => prepareDrag(node)}
              draggable={
                (node.nodeKind === 'item' && node.supportStatus !== 'unsupported') ||
                (node.scope === 'user' && node.nodeKind === 'folder')
              }
              onDragStart={(event) => {
                // This is a browser-native library drag, not a React DnD
                // Arborist source. Keep the shared tree manager from starting
                // an empty drag for the same DOM event.
                event.stopPropagation();
                const descriptor = dragDescriptors.current[node.nodeId];
                if (!descriptor) {
                  event.preventDefault();
                  setDragMessage('Preparing library item. Try dragging again.');
                  prepareDrag(node);
                  return;
                }
                writeLibraryDragDescriptor(event.dataTransfer, descriptor);
                if (node.scope === 'user') activeUserDragDescriptor.current = descriptor;
                setDragMessage(`Dragging ${node.displayName}`);
              }}
              onDragEnd={(event) => {
                const descriptor = dragDescriptors.current[node.nodeId] ?? null;
                if (event.dataTransfer.dropEffect === 'none' && node.nodeKind === 'item') {
                  window.setTimeout(() => void cancelLibraryNodeDrag(descriptor), 5_000);
                }
                delete dragDescriptors.current[node.nodeId];
                if (descriptor) delete draggedUserNodes.current[descriptor.dragSessionId];
                activeUserDragDescriptor.current = null;
                setDragMessage(
                  event.dataTransfer.dropEffect === 'none'
                    ? 'Drag cancelled'
                    : node.scope === 'user'
                      ? `${node.displayName} moved`
                      : `${node.displayName} added`,
                );
              }}
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label={
                  canExpand
                    ? `${expanded.has(node.nodeId) ? 'Collapse' : 'Expand'} ${node.displayName}`
                    : undefined
                }
                className={
                  canExpand
                    ? 'flex h-6 w-6 shrink-0 items-center justify-center text-app-text-strong'
                    : 'h-6 w-6 shrink-0 text-app-text-muted'
                }
                onClick={() => (canExpand ? toggle(node) : activate(index))}
              >
                {canExpand ? (
                  expanded.has(node.nodeId) ? (
                    <ChevronDown aria-hidden="true" size={14} strokeWidth={2.5} />
                  ) : (
                    <ChevronRight aria-hidden="true" size={14} strokeWidth={2.5} />
                  )
                ) : (
                  ''
                )}
              </button>
              {renamingId === node.nodeId ? (
                <span className="min-w-0 flex-1">
                  <input
                    ref={renameInputRef}
                    autoFocus
                    aria-label={`Rename ${node.displayName}`}
                    aria-invalid={Boolean(renameError)}
                    value={renameValue}
                    onChange={(event) => {
                      setRenameValue(event.currentTarget.value);
                      setRenameError(null);
                    }}
                    onBlur={() => submitRename(node)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') submitRename(node);
                      if (event.key === 'Escape') setRenamingId(null);
                    }}
                    className="w-full rounded border border-app-accent bg-app-input px-1 text-role-body"
                  />
                  {renameError && (
                    <span role="alert" className="block text-role-callout text-red-400">
                      {renameError}
                    </span>
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  tabIndex={-1}
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => activate(index)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (onRename && node.scope === 'user' && node.nodeKind !== 'root')
                      startRename(node);
                    else if (node.key) onOpen?.(node.key);
                  }}
                >
                  {node.displayName}
                </button>
              )}
              {node.supportStatus === 'unsupported' && (
                <span
                  role="status"
                  aria-label={`${node.displayName} is unsupported`}
                  title="Contains unsupported nested data"
                  className="text-amber-400"
                >
                  ⚠ unsupported
                </span>
              )}
            </div>
          </LibraryContextMenu>
        );
      })}
    </div>
  );
}
