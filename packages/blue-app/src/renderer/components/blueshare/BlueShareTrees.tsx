import { useEffect, useMemo, useState } from 'react';
import type { CategoryTreeNode, ResourceKind } from '../../../shared/blueshare';
import type { LibraryBrowseNode } from '../../../shared/unified-library';
import { LibraryTree } from '../libraries/LibraryTree';

/** Read-only pickers share the library tree's rendering and keyboard navigation. */
export function BlueShareLibraryTree({
  label,
  nodes,
  selectedNodeId,
  onSelect,
}: {
  label: string;
  nodes: readonly LibraryBrowseNode[];
  selectedNodeId: string | null;
  onSelect: (node: LibraryBrowseNode) => void;
}): React.ReactElement {
  const [activeNodeId, setActiveNodeId] = useState(selectedNodeId);
  useEffect(() => setActiveNodeId(selectedNodeId), [selectedNodeId]);
  const { roots, children, expanded } = useMemo(() => {
    const ids = new Set(nodes.map((node) => node.nodeId));
    const roots: LibraryBrowseNode[] = [];
    const children: Record<string, LibraryBrowseNode[]> = {};
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId)) {
        (children[node.parentId] ??= []).push(node);
      } else roots.push(node);
    }
    return {
      roots,
      children,
      expanded: roots.map((node) => node.nodeId),
    };
  }, [nodes]);
  return (
    <LibraryTree
      readOnly
      label={label}
      nodes={roots}
      childrenByParent={children}
      defaultExpandedNodeIds={expanded}
      selectedNodeId={activeNodeId}
      onSelectedNodeChange={setActiveNodeId}
      onSelect={(key) => {
        if (!('nodeId' in key)) return;
        const node = nodes.find((candidate) => candidate.nodeId === key.nodeId);
        if (node) onSelect(node);
      }}
    />
  );
}

export function BlueShareCategoryTree({
  label,
  categories,
  kind,
  selectedId,
  onSelect,
}: {
  label: string;
  categories: readonly CategoryTreeNode[];
  kind: ResourceKind;
  selectedId: number | null;
  onSelect: (id: number) => void;
}): React.ReactElement {
  const prefix = `blueshare-${label.replaceAll(' ', '-')}-${kind}-`;
  // Display-only keys adapt categories to the shared tree; they never reach library IPC.
  const nodes = useMemo(() => {
    const result: LibraryBrowseNode[] = [];
    const append = (items: readonly CategoryTreeNode[], parentId: string | null) => {
      for (const category of items) {
        const nodeId = `${prefix}${category.id}`;
        result.push({
          nodeId,
          parentId,
          key: { scope: 'user', libraryType: kind, nodeId },
          scope: 'user',
          libraryType: kind,
          nodeKind: category.children.length ? 'folder' : 'item',
          displayName: category.name,
          breadcrumb: [category.name],
          revision: 0,
          hasChildren: category.children.length > 0,
        });
        append(category.children, nodeId);
      }
    };
    append(categories, null);
    return result;
  }, [categories, kind, prefix]);
  return (
    <BlueShareLibraryTree
      label={label}
      nodes={nodes}
      selectedNodeId={selectedId === null ? null : `${prefix}${selectedId}`}
      onSelect={(node) => onSelect(Number(node.nodeId.slice(prefix.length)))}
    />
  );
}
