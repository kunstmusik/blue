import { useMemo, useState } from 'react';
import type { LibraryBrowseNode, LibraryItemKey } from '../../../shared/unified-library';

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
}

interface VisibleTreeNode {
  node: LibraryBrowseNode;
  level: number;
}

export function validateLibraryNodeName(name: string): string | null {
  const normalized = name.normalize('NFKC').trim();
  if (!normalized) return 'A name is required.';
  if (normalized.length > 255) return 'Names must be 255 characters or fewer.';
  if (/[/\\\u0000-\u001f]/u.test(normalized)) return 'Names cannot contain slashes or control characters.';
  return null;
}

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
}: LibraryTreeProps): React.ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
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

  const toggle = (node: LibraryBrowseNode): void => {
    if (!node.hasChildren) return;
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

  const activate = (index: number): void => {
    const candidate = visible[index]?.node;
    if (candidate?.key) onSelect(candidate.key);
    else if (candidate) toggle(candidate);
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
      return;
    }
    onRename?.(node, renameValue.normalize('NFKC').trim());
    setRenamingId(null);
    setRenameError(null);
  };

  if (nodes.length === 0) {
    return <p className="px-3 py-2 text-xs text-app-text-muted">No items</p>;
  }

  return (
    <div
      role="tree"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={visible[activeIndex] ? `library-node-${visible[activeIndex].node.nodeId}` : undefined}
      className="outline-none focus-visible:ring-1 focus-visible:ring-app-accent"
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((current) => Math.min(visible.length - 1, current + 1));
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex((current) => Math.max(0, current - 1));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          const node = visible[activeIndex]?.node;
          if (node && !expanded.has(node.nodeId)) toggle(node);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          const node = visible[activeIndex]?.node;
          if (node && expanded.has(node.nodeId)) toggle(node);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(activeIndex);
        } else if (event.key === 'F2') {
          const node = visible[activeIndex]?.node;
          if (node && node.nodeKind !== 'root' && onRename) startRename(node);
        } else if (event.key === 'Delete') {
          const node = visible[activeIndex]?.node;
          if (node && node.nodeKind !== 'root') onDelete?.(node);
        }
      }}
    >
      {visible.map(({ node, level }, index) => (
        <div
          id={`library-node-${node.nodeId}`}
          key={node.nodeId}
          role="treeitem"
          aria-level={level}
          aria-selected={index === activeIndex}
          aria-expanded={node.hasChildren ? expanded.has(node.nodeId) : undefined}
          className={`flex min-h-7 items-center gap-1 rounded px-1 text-sm ${index === activeIndex ? 'bg-app-selection' : 'hover:bg-app-hover'}`}
          style={{ paddingLeft: `${(level - 1) * 14 + 4}px` }}
          onMouseDown={() => setActiveIndex(index)}
          onDoubleClick={() => node.key ? onOpen?.(node.key) : toggle(node)}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={node.hasChildren ? `${expanded.has(node.nodeId) ? 'Collapse' : 'Expand'} ${node.displayName}` : undefined}
            className="h-5 w-5 shrink-0 text-app-text-muted"
            onClick={() => node.hasChildren ? toggle(node) : activate(index)}
          >
            {node.hasChildren ? (expanded.has(node.nodeId) ? '▾' : '▸') : '·'}
          </button>
          {renamingId === node.nodeId ? (
            <span className="min-w-0 flex-1">
              <input
                autoFocus
                aria-label={`Rename ${node.displayName}`}
                aria-invalid={Boolean(renameError)}
                value={renameValue}
                onChange={(event) => { setRenameValue(event.currentTarget.value); setRenameError(null); }}
                onBlur={() => submitRename(node)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Enter') submitRename(node);
                  if (event.key === 'Escape') setRenamingId(null);
                }}
                className="w-full rounded border border-app-accent bg-app-input px-1"
              />
              {renameError && <span role="alert" className="block text-xs text-red-400">{renameError}</span>}
            </span>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              className="min-w-0 flex-1 truncate text-left"
              title={node.breadcrumb.join(' / ')}
              onClick={() => activate(index)}
            >
              {node.displayName}
            </button>
          )}
          {node.nodeKind !== 'root' && index === activeIndex && renamingId !== node.nodeId && (onRename || onDuplicate || onDelete) && (
            <span className="flex gap-1" aria-label={`${node.displayName} commands`}>
              {onRename && <button type="button" aria-label={`Rename ${node.displayName}`} onClick={() => startRename(node)}>Rename</button>}
              {onDuplicate && <button type="button" aria-label={`Duplicate ${node.displayName}`} onClick={() => onDuplicate(node)}>Duplicate</button>}
              {onDelete && <button type="button" aria-label={`Delete ${node.displayName}`} onClick={() => onDelete(node)}>Delete</button>}
            </span>
          )}
          {node.supportStatus === 'unsupported' && (
            <span role="status" aria-label={`${node.displayName} is unsupported`} title="Contains unsupported nested data" className="text-amber-400">
              ⚠ unsupported
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
