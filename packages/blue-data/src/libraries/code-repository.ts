// Code Repository portable model.
//
// Pure TypeScript types and validation for the Java-compatible Code Repository
// tree (`customAccelerators` / `customGroup` / `customAccelerator`). This module
// is Node/Electron/DOM-free and uses static imports only, matching the
// `@blue/data` constraints documented in AGENTS.md.

/** Kind of a repository node. The single root is protected. */
export type CodeRepositoryNodeKind = 'root' | 'group' | 'snippet';

/** A single repository node in the ordered tree. */
export interface CodeRepositoryNode {
  /** Stable identifier used to refer to this node within the repository. */
  readonly id: string;
  /** Discriminant identifying the code repository node variant. */
  readonly kind: CodeRepositoryNodeKind;
  /** Name associated with the code repository node. */
  readonly name: string;
  /** Identifier of the containing node. */
  readonly parentId: string | null;
  /** Sibling ordering position, non-negative. */
  readonly order: number;
  /** Exact snippet code text. Present only for snippets. */
  readonly code?: string;
  /** Ordered children. Present for root/group. */
  readonly children?: readonly CodeRepositoryNode[];
}

/** The complete repository tree plus its durable revision. */
export interface CodeRepositoryDocument {
  /** Top-level element or container. */
  readonly root: CodeRepositoryNode;
  /** Monotonic version bumped after every committed mutation. */
  readonly contentRevision: number;
}

/** Stable error codes shared across the IPC boundary. */
export type CodeRepositoryErrorCode =
  | 'storage-unavailable'
  | 'invalid-tree'
  | 'revision-conflict'
  | 'invalid-legacy-xml'
  | 'source-unreadable'
  | 'export-failed'
  | 'not-initialized';

/** Reserved identifier of the code repository's top-level group. */
export const CODE_REPOSITORY_ROOT_ID = '00000000-0000-4000-8000-000000000001';
/** Default name of the code repository's top-level group. */
export const CODE_REPOSITORY_ROOT_NAME = 'Code Repository';

/** Maximum supported nesting depth for groups (defensive; UI is the real limit). */
export const CODE_REPOSITORY_MAX_DEPTH = 64;

/** Type guard for {@link CodeRepositoryNodeKind}. */
export function isCodeRepositoryNodeKind(value: unknown): value is CodeRepositoryNodeKind {
  return value === 'root' || value === 'group' || value === 'snippet';
}

/** Type guard for a single {@link CodeRepositoryNode}. */
export function isCodeRepositoryNode(value: unknown): value is CodeRepositoryNode {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return false;
    seen.add(candidate);
    const node = candidate as Partial<CodeRepositoryNode>;
    if (typeof node.id !== 'string' || node.id.length === 0) return false;
    if (!isCodeRepositoryNodeKind(node.kind)) return false;
    if (typeof node.name !== 'string' || node.name.trim().length === 0) return false;
    if (node.parentId !== null && typeof node.parentId !== 'string') return false;
    if (typeof node.order !== 'number' || !Number.isInteger(node.order) || node.order < 0)
      return false;
    if (node.code !== undefined && typeof node.code !== 'string') return false;
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) return false;
      pending.push(...node.children);
    }
  }
  return true;
}

/** Type guard for {@link CodeRepositoryDocument}. */
export function isCodeRepositoryDocument(value: unknown): value is CodeRepositoryDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<CodeRepositoryDocument>;
  if (!isCodeRepositoryNode(doc.root)) return false;
  if (
    typeof doc.contentRevision !== 'number' ||
    !Number.isInteger(doc.contentRevision) ||
    doc.contentRevision < 0
  ) {
    return false;
  }
  return true;
}

/** Describes why a tree failed validation. */
export type CodeRepositoryValidationError =
  | {
      /** Diagnostic code for no root. */
      readonly code: 'no-root';
    }
  | {
      /** Diagnostic code for multiple roots. */
      readonly code: 'multiple-roots';
    }
  | {
      /** Diagnostic code for root ID. */
      readonly code: 'root-id';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for root kind. */
      readonly code: 'root-kind';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for root name. */
      readonly code: 'root-name';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for root has parent. */
      readonly code: 'root-has-parent';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for root order. */
      readonly code: 'root-order';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for missing parent. */
      readonly code: 'missing-parent';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for snippet has children. */
      readonly code: 'snippet-has-children';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for snippet missing code. */
      readonly code: 'snippet-missing-code';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for group has code. */
      readonly code: 'group-has-code';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for invalid parent kind. */
      readonly code: 'invalid-parent-kind';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
      /** Identifier of the containing node. */
      readonly parentId: string;
    }
  | {
      /** Diagnostic code for empty name. */
      readonly code: 'empty-name';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for duplicate ID. */
      readonly code: 'duplicate-id';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for cycle. */
      readonly code: 'cycle';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    }
  | {
      /** Diagnostic code for order gap. */
      readonly code: 'order-gap';
      /** Identifier of the containing node. */
      readonly parentId: string | null;
    }
  | {
      /** Diagnostic code for depth exceeded. */
      readonly code: 'depth-exceeded';
      /** Identifier of the node associated with the diagnostic. */
      readonly nodeId: string;
    };

/**
 * Validate a repository tree against the invariants in the data model.
 *
 * Returns the first violation found, or `null` when the tree is well-formed.
 * Root must be the single protected root; every non-root node must have a
 * reachable group/root ancestor; snippets cannot have children and must carry
 * code; groups cannot carry code; names must be non-empty; ids must be unique;
 * sibling order is contiguous from 0.
 */
export function validateCodeRepositoryTree(
  root: CodeRepositoryNode,
): CodeRepositoryValidationError | null {
  if (root.id !== CODE_REPOSITORY_ROOT_ID) {
    return { code: 'root-id', nodeId: root.id };
  }
  if (root.kind !== 'root') {
    return { code: 'root-kind', nodeId: root.id };
  }
  if (root.name !== CODE_REPOSITORY_ROOT_NAME) {
    return { code: 'root-name', nodeId: root.id };
  }
  if (root.parentId !== null) {
    return { code: 'root-has-parent', nodeId: root.id };
  }
  if (root.order !== 0) {
    return { code: 'root-order', nodeId: root.id };
  }

  const ids = new Set<string>([root.id]);
  const stack: Array<{ node: CodeRepositoryNode; depth: number }> = [{ node: root, depth: 0 }];

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;

    if (depth > CODE_REPOSITORY_MAX_DEPTH) {
      return { code: 'depth-exceeded', nodeId: node.id };
    }
    if (depth > 0 && node.kind === 'root') {
      return { code: 'multiple-roots' };
    }
    if (node.name.trim().length === 0) {
      return { code: 'empty-name', nodeId: node.id };
    }

    if (node.kind === 'snippet') {
      if (node.children && node.children.length > 0) {
        return { code: 'snippet-has-children', nodeId: node.id };
      }
      if (node.code === undefined) {
        return { code: 'snippet-missing-code', nodeId: node.id };
      }
    } else {
      if (node.code !== undefined) {
        return { code: 'group-has-code', nodeId: node.id };
      }
      const children = node.children ?? [];
      // Sibling order must be contiguous starting at 0.
      for (let i = 0; i < children.length; i++) {
        if (children[i].order !== i) {
          return { code: 'order-gap', parentId: node.id };
        }
      }
      for (const child of children) {
        if (ids.has(child.id)) {
          return { code: 'duplicate-id', nodeId: child.id };
        }
        ids.add(child.id);
        if (child.parentId !== node.id) {
          if (child.parentId === null) {
            return { code: 'missing-parent', nodeId: child.id };
          }
          return { code: 'invalid-parent-kind', nodeId: child.id, parentId: child.parentId };
        }
        stack.push({ node: child, depth: depth + 1 });
      }
    }
  }

  return null;
}

/**
 * Collect all node ids that are descendants of (and including) `nodeId`.
 * Returns the input id first. Used for move-cycle rejection. Returns an empty
 * array when `nodeId` is not present in the tree.
 */
export function collectDescendantIds(root: CodeRepositoryNode, nodeId: string): string[] {
  const findAndCollect = (node: CodeRepositoryNode): boolean => {
    if (node.id === nodeId) {
      collectSubtree(node);
      return true;
    }
    for (const child of node.children ?? []) {
      if (findAndCollect(child)) return true;
    }
    return false;
  };
  const collectSubtree = (node: CodeRepositoryNode): void => {
    result.push(node.id);
    for (const child of node.children ?? []) collectSubtree(child);
  };
  const result: string[] = [];
  findAndCollect(root);
  return result;
}

/** Create an empty repository document rooted at the protected root. */
export function createEmptyCodeRepositoryDocument(): CodeRepositoryDocument {
  return {
    root: {
      id: CODE_REPOSITORY_ROOT_ID,
      kind: 'root',
      name: CODE_REPOSITORY_ROOT_NAME,
      parentId: null,
      order: 0,
      children: [],
    },
    contentRevision: 0,
  };
}
