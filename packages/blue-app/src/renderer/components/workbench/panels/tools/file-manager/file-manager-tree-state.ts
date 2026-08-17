import type {
  FileManagerNodeSnapshot,
  FileManagerRootKind,
  FileManagerRootSnapshot,
} from '../../../../../../shared/file-manager';

export interface FileTreeNode {
  id: string;
  identity: string;
  path: string;
  name: string;
  kind: 'file' | 'directory';
  rootKind: FileManagerRootKind | null;
  rootLabel?: string;
  canExpand: boolean;
  /** Undefined means the directory has never been expanded. */
  children?: FileTreeNode[];
  /** Diagnostic message when this directory's listing failed. */
  diagnosticId?: string;
}

export interface BreadcrumbSegment {
  id: string;
  path: string;
  name: string;
}

export const UNNAMED_ROOT_LABEL = 'Unnamed Root';

export function getRootDisplayLabel(rootLabel: string | undefined, rootPath: string): string {
  const trimmedLabel = rootLabel?.trim() ?? '';
  return trimmedLabel.length > 0 && trimmedLabel !== rootPath
    ? trimmedLabel
    : UNNAMED_ROOT_LABEL;
}

export interface FocusLevelState {
  focusedNodeId: string | null;
  breadcrumb: BreadcrumbSegment[];
  openIds: Set<string>;
  scrollOffset: number;
}

/**
 * Session-lifetime tree state. Moving the panel between docked and slideout
 * auxiliary modes remounts the component; this cache keeps loaded listings,
 * diagnostics, open-node ids, focus level, breadcrumb stack, and scroll offset
 * alive across those moves. It is disposable renderer session state and is never
 * written to settings or project data.
 */
export const sessionTreeState: {
  tree: FileTreeNode[];
  diagnostics: Record<string, string>;
  openIds: Set<string>;
  scrollOffset: number;
  focusedNodeId: string | null;
  breadcrumb: BreadcrumbSegment[];
  levelStack: FocusLevelState[];
} = {
  tree: [],
  diagnostics: {},
  openIds: new Set(),
  scrollOffset: 0,
  focusedNodeId: null,
  breadcrumb: [],
  levelStack: [],
};

/** Clears session-cached tree state (used by tests for isolation and on app restart). */
export function resetFileManagerTreeSessionState(): void {
  sessionTreeState.tree = [];
  sessionTreeState.diagnostics = {};
  sessionTreeState.openIds = new Set();
  sessionTreeState.scrollOffset = 0;
  sessionTreeState.focusedNodeId = null;
  sessionTreeState.breadcrumb = [];
  sessionTreeState.levelStack = [];
}

export function rootToNode(root: FileManagerRootSnapshot, previous?: FileTreeNode): FileTreeNode {
  const displayName = getRootDisplayLabel(root.label, root.path);
  return {
    id: root.id,
    identity: root.id,
    path: root.path,
    name: displayName,
    kind: 'directory',
    rootKind: root.kind,
    rootLabel: root.label,
    canExpand: true,
    children: previous?.children,
  };
}

export function childToNode(parent: FileTreeNode, child: FileManagerNodeSnapshot): FileTreeNode {
  const separator = parent.rootKind !== null ? '#' : '/';
  return {
    id: `${parent.id}${separator}${child.name}`,
    identity: child.id,
    path: child.path,
    name: child.name,
    kind: child.kind,
    rootKind: null,
    canExpand: child.canExpand,
  };
}

export function findNode(nodes: FileTreeNode[], id: string): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Collects the chain of normalized filesystem identities to the target node. */
export function collectAncestorIdentities(nodes: FileTreeNode[], id: string, chain: string[] = []): string[] | null {
  for (const node of nodes) {
    const nextChain = [...chain, node.identity];
    if (node.id === id) return nextChain;
    if (node.children) {
      const found = collectAncestorIdentities(node.children, id, nextChain);
      if (found) return found;
    }
  }
  return null;
}

/** Collects breadcrumb segments from the root ancestor down to the target node. */
export function collectBreadcrumb(
  nodes: FileTreeNode[],
  targetId: string,
  chain: BreadcrumbSegment[] = [],
): BreadcrumbSegment[] | null {
  for (const node of nodes) {
    let segmentName = node.name;
    if (node.rootKind !== null) {
      segmentName = getRootDisplayLabel(node.rootLabel, node.path);
    }
    const nextChain = [...chain, { id: node.id, path: node.path, name: segmentName }];
    if (node.id === targetId) return nextChain;
    if (node.children) {
      const found = collectBreadcrumb(node.children, targetId, nextChain);
      if (found) return found;
    }
  }
  return null;
}

export function withChildren(nodes: FileTreeNode[], id: string, children: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, children };
    if (node.children) return { ...node, children: withChildren(node.children, id, children) };
    return node;
  });
}

/**
 * Marks a node whose directory listing failed with the diagnostic message so
 * the row can present a recoverable inline error.
 */
export function attachDiagnostics(nodes: FileTreeNode[], diagnostics: Record<string, string>): FileTreeNode[] {
  let changed = false;
  const mapped = nodes.map((node) => {
    const diagnostic = diagnostics[node.id];
    const children = node.children ? attachDiagnostics(node.children, diagnostics) : node.children;
    const diagnosticId = diagnostic ?? null;
    if (node.diagnosticId === diagnosticId && children === node.children) return node;
    changed = true;
    return { ...node, children, diagnosticId: diagnosticId ?? undefined };
  });
  return changed ? mapped : nodes;
}

/** Gives unloaded directories an empty children array so they stay expandable. */
export function toTreeData(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.children) {
      const children = toTreeData(node.children);
      return children === node.children ? node : { ...node, children };
    }
    return node.canExpand ? { ...node, children: [] as FileTreeNode[] } : node;
  });
}
