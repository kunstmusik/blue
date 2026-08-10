// Synchronous Code Repository database layer. Runs inside the worker thread.
//
// Owns the normalized ordered tree in `blue_code_repository.sqlite`. Mirrors the
// unified-library repository's transaction/revision conventions but is
// materially simpler: one protected root, one global content revision used as
// the optimistic-lock token, and snippet code stored inline on the node row.

import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { CodeRepositoryNode } from '@blue/data';
import { CODE_REPOSITORY_ROOT_ID, collectDescendantIds, validateCodeRepositoryTree } from '@blue/data';
import { initializeCodeRepositorySchema } from './schema';

/** Shape of a row mapped out of the database for internal validation. */
interface CodeRepositoryDbNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly kind: 'root' | 'group' | 'snippet';
}

export interface CodeRepositorySnapshotData {
  readonly root: CodeRepositoryNode;
  readonly contentRevision: number;
  readonly initialized: boolean;
}

/** Provenance recorded for each completed import, including historical default seeds. */
export interface CodeRepositoryImportRecordInput {
  readonly id: string;
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly sourceKind: 'automatic' | 'explicit' | 'defaultSeed';
  readonly status: 'succeeded' | 'failed' | 'skipped';
  readonly nodeCount: number | null;
  readonly diagnostics: string | null;
}

export interface CodeRepositoryImportRecord extends CodeRepositoryImportRecordInput {
  readonly importedAt: number;
}

/** Returns true when `hash` already succeeded as an automatic import. */
export class CodeRepositoryRepository {
  private closed = false;

  private constructor(private readonly database: DatabaseSync) {}

  static open(databasePath: string): CodeRepositoryRepository {
    const database = new DatabaseSync(databasePath);
    try {
      const integrity = database.prepare('PRAGMA quick_check').get();
      if (String(integrity ? Object.values(integrity)[0] : '') !== 'ok') {
        throw new Error('Code Repository integrity check failed');
      }
      initializeCodeRepositorySchema(database, {
        fileBacked: databasePath !== ':memory:',
      });
      return new CodeRepositoryRepository(database);
    } catch (error) {
      database.close();
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }

  getContentRevision(): number {
    this.assertOpen();
    const row = this.database
      .prepare('SELECT content_revision FROM code_repository_state WHERE singleton_id = 1')
      .get();
    return Number(row?.content_revision ?? 0);
  }

  isInitialized(): boolean {
    this.assertOpen();
    const row = this.database.prepare('SELECT initialized FROM code_repository_state WHERE singleton_id = 1').get();
    return Boolean(row?.initialized);
  }

  /** Load the full tree and revision as the canonical snapshot. */
  getSnapshot(): CodeRepositorySnapshotData {
    this.assertOpen();
    const rows = this.database
      .prepare('SELECT * FROM code_repository_nodes ORDER BY parent_id IS NULL DESC, sort_order, id')
      .all() as Record<string, unknown>[];
    const nodes = new Map<string, CodeRepositoryNode>();
    const childrenByParent = new Map<string | null, CodeRepositoryNode[]>();
    for (const row of rows) {
      const node = toSnapshotNode(row);
      nodes.set(node.id, node);
      const list = childrenByParent.get(node.parentId) ?? [];
      list.push(node);
      childrenByParent.set(node.parentId, list);
    }
    // Attach ordered children.
    for (const node of nodes.values()) {
      const kids = childrenByParent.get(node.id) ?? [];
      (node as { children?: CodeRepositoryNode[] }).children = kids;
    }
    const root = nodes.get(CODE_REPOSITORY_ROOT_ID);
    if (!root) {
      throw new Error('Code Repository root row is missing');
    }
    const validationError = validateCodeRepositoryTree(root);
    if (validationError) {
      throw new Error(`Code Repository tree is invalid: ${validationError.code}`);
    }
    if (countTreeNodes(root) !== nodes.size) {
      throw new Error('Code Repository contains unreachable or additional root rows');
    }
    return {
      root,
      contentRevision: this.getContentRevision(),
      initialized: this.isInitialized(),
    };
  }

  // Atomic draft commit ------------------------------------------------

  /**
   * Replace the entire tree (except the protected root row) with `root` and
   * bump the content revision. Throws `'Stale revision'` if `expectedRevision`
   * does not match the current revision. Validates the incoming tree first and
   * rolls back on any invariant violation.
   */
  commitDraft(expectedRevision: number, root: CodeRepositoryNode): CodeRepositorySnapshotData {
    return this.withTransaction(() => {
      this.assertExpectedRevision(expectedRevision);
      const error = validateCodeRepositoryTree(root);
      if (error) {
        throw new Error(`invalid-tree:${error.code}`);
      }
      // Delete every non-root row, then re-insert the incoming tree. The root
      // row is protected and retained.
      this.database.prepare("DELETE FROM code_repository_nodes WHERE kind <> 'root'").run();
      this.insertSubtree(root);
      this.markInitialized();
      this.incrementContentRevision();
      return this.getSnapshot();
    });
  }

  /**
   * Replace the tree and retain the successful import provenance in the same
   * SQLite transaction. A failed provenance write must never leave an imported
   * tree without its source hash.
   */
  importTree(
    expectedRevision: number,
    root: CodeRepositoryNode,
    importRecord: CodeRepositoryImportRecordInput,
  ): CodeRepositorySnapshotData {
    return this.withTransaction(() => {
      this.assertExpectedRevision(expectedRevision);
      const error = validateCodeRepositoryTree(root);
      if (error) throw new Error(`invalid-tree:${error.code}`);
      this.database.prepare("DELETE FROM code_repository_nodes WHERE kind <> 'root'").run();
      this.insertSubtree(root);
      this.recordImportInTransaction(importRecord);
      this.markInitialized();
      this.incrementContentRevision();
      return this.getSnapshot();
    });
  }

  // Single-node operations --------------------------------------------

  createGroup(parentId: string, name: string, expectedRevision: number): CodeRepositorySnapshotData {
    return this.withTransaction(() => {
      this.assertExpectedRevision(expectedRevision);
      const displayName = requireNonBlankName(name);
      const parent = this.requireGroupLike(parentId);
      const id = randomUUID();
      const order = this.nextSortOrder(parentId);
      const now = Date.now();
      this.database
        .prepare(
          `INSERT INTO code_repository_nodes (
            id, parent_id, kind, display_name, code_text, sort_order, created_at, updated_at
          ) VALUES (?, ?, 'group', ?, NULL, ?, ?, ?)`,
        )
        .run(id, parent.id, displayName, order, now, now);
      this.markInitialized();
      this.incrementContentRevision();
      return this.getSnapshot();
    });
  }

  createSnippet(parentId: string, name: string, code: string, expectedRevision: number): CodeRepositorySnapshotData {
    return this.withTransaction(() => {
      this.assertExpectedRevision(expectedRevision);
      const displayName = requireNonBlankName(name);
      const parent = this.requireGroupLike(parentId);
      const id = randomUUID();
      const order = this.nextSortOrder(parentId);
      const now = Date.now();
      this.database
        .prepare(
          `INSERT INTO code_repository_nodes (
            id, parent_id, kind, display_name, code_text, sort_order, created_at, updated_at
          ) VALUES (?, ?, 'snippet', ?, ?, ?, ?, ?)`,
        )
        .run(id, parent.id, displayName, code, order, now, now);
      this.markInitialized();
      this.incrementContentRevision();
      return this.getSnapshot();
    });
  }

  moveNode(nodeId: string, parentId: string, order: number, expectedRevision: number): CodeRepositorySnapshotData {
    return this.withTransaction(() => {
      this.assertExpectedRevision(expectedRevision);
      if (nodeId === CODE_REPOSITORY_ROOT_ID) {
        throw new Error('invalid-tree:root-protected');
      }
      const target = this.requireGroupLike(parentId);
      // Reject moving a node into itself or one of its descendants.
      const snapshot = this.getSnapshot();
      const descendantIds = new Set(collectDescendantIds(snapshot.root, nodeId));
      if (descendantIds.has(parentId)) {
        throw new Error('invalid-tree:cycle');
      }
      const node = this.requireNode(nodeId);
      void target;
      void node;
      const now = Date.now();
      this.database
        .prepare('UPDATE code_repository_nodes SET parent_id = ?, updated_at = ? WHERE id = ?')
        .run(parentId, now, nodeId);
      this.normalizeSiblingOrder(parentId, nodeId, order);
      const oldParent = node.parentId;
      if (oldParent && oldParent !== parentId) {
        this.normalizeSiblingOrder(oldParent);
      }
      this.incrementContentRevision();
      return this.getSnapshot();
    });
  }

  updateNode(
    nodeId: string,
    patch: { readonly name?: string; readonly code?: string },
    expectedRevision: number,
  ): CodeRepositorySnapshotData {
    return this.withTransaction(() => {
      this.assertExpectedRevision(expectedRevision);
      if (nodeId === CODE_REPOSITORY_ROOT_ID) {
        throw new Error('invalid-tree:root-protected');
      }
      const node = this.requireNode(nodeId);
      const now = Date.now();
      if (patch.name !== undefined) {
        const displayName = requireNonBlankName(patch.name);
        this.database
          .prepare('UPDATE code_repository_nodes SET display_name = ?, updated_at = ? WHERE id = ?')
          .run(displayName, now, nodeId);
      }
      if (patch.code !== undefined) {
        if (node.kind !== 'snippet') {
          throw new Error('invalid-tree:group-has-code');
        }
        this.database
          .prepare('UPDATE code_repository_nodes SET code_text = ?, updated_at = ? WHERE id = ?')
          .run(patch.code, now, nodeId);
      }
      this.incrementContentRevision();
      return this.getSnapshot();
    });
  }

  deleteNode(nodeId: string, expectedRevision: number): CodeRepositorySnapshotData {
    return this.withTransaction(() => {
      this.assertExpectedRevision(expectedRevision);
      if (nodeId === CODE_REPOSITORY_ROOT_ID) {
        throw new Error('invalid-tree:root-protected');
      }
      const node = this.requireNode(nodeId);
      // Cascading delete removes descendants (FK ON DELETE CASCADE).
      this.database.prepare('DELETE FROM code_repository_nodes WHERE id = ?').run(nodeId);
      if (node.parentId) this.normalizeSiblingOrder(node.parentId);
      this.incrementContentRevision();
      return this.getSnapshot();
    });
  }

  // Import provenance --------------------------------------------------

  recordImport(input: CodeRepositoryImportRecordInput): void {
    this.assertOpen();
    this.recordImportInTransaction(input);
  }

  private recordImportInTransaction(input: CodeRepositoryImportRecordInput): void {
    const now = Date.now();
    this.database
      .prepare(
        `INSERT INTO code_repository_imports (
          id, source_path, source_hash, source_kind, status, node_count, diagnostics, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.sourcePath,
        input.sourceHash,
        input.sourceKind,
        input.status,
        input.nodeCount,
        input.diagnostics,
        now,
      );
  }

  hasImportedHash(hash: string): boolean {
    this.assertOpen();
    return Boolean(
      this.database
        .prepare(
          "SELECT 1 AS found FROM code_repository_imports WHERE source_hash = ? AND status = 'succeeded' LIMIT 1",
        )
        .get(hash),
    );
  }

  listImports(limit = 50): CodeRepositoryImportRecord[] {
    this.assertOpen();
    const rows = this.database
      .prepare('SELECT * FROM code_repository_imports ORDER BY imported_at DESC, id DESC LIMIT ?')
      .all(Math.max(1, Math.min(limit, 500))) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      sourcePath: String(row.source_path),
      sourceHash: String(row.source_hash),
      sourceKind: row.source_kind as CodeRepositoryImportRecordInput['sourceKind'],
      status: row.status as CodeRepositoryImportRecordInput['status'],
      nodeCount: row.node_count === null ? null : Number(row.node_count),
      diagnostics: row.diagnostics === null ? null : String(row.diagnostics),
      importedAt: Number(row.imported_at),
    }));
  }

  // Internals ----------------------------------------------------------

  private requireNode(nodeId: string): CodeRepositoryDbNode {
    const row = this.database.prepare('SELECT * FROM code_repository_nodes WHERE id = ?').get(nodeId);
    if (!row) throw new Error(`invalid-tree:missing-node:${nodeId}`);
    return mapDbRow(row as Record<string, unknown>);
  }

  private requireGroupLike(nodeId: string): CodeRepositoryDbNode {
    const node = this.requireNode(nodeId);
    if (node.kind === 'snippet') {
      throw new Error('invalid-tree:invalid-parent-kind');
    }
    return node;
  }

  private insertSubtree(node: CodeRepositoryNode): void {
    if (node.kind === 'root') {
      for (const child of node.children ?? []) this.insertSubtree(child);
      return;
    }
    const now = Date.now();
    this.database
      .prepare(
        `INSERT INTO code_repository_nodes (
          id, parent_id, kind, display_name, code_text, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        node.id,
        node.parentId,
        node.kind,
        node.name,
        node.kind === 'snippet' ? (node.code ?? '') : null,
        node.order,
        now,
        now,
      );
    if (node.kind === 'group') {
      for (const child of node.children ?? []) this.insertSubtree(child);
    }
  }

  private nextSortOrder(parentId: string): number {
    const row = this.database
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM code_repository_nodes WHERE parent_id = ?')
      .get(parentId);
    return Number(row?.next_order ?? 0);
  }

  private normalizeSiblingOrder(parentId: string, movingId?: string, targetIndex?: number): void {
    const rows = this.database
      .prepare('SELECT id FROM code_repository_nodes WHERE parent_id = ? ORDER BY sort_order, id')
      .all(parentId) as Record<string, unknown>[];
    const ids = rows.map((row) => String(row.id));
    if (movingId) {
      const from = ids.indexOf(movingId);
      if (from >= 0) {
        const [moving] = ids.splice(from, 1);
        const insertAt = Math.max(0, Math.min(Math.trunc(targetIndex ?? ids.length), ids.length));
        ids.splice(insertAt, 0, moving);
      }
    }
    const update = this.database.prepare('UPDATE code_repository_nodes SET sort_order = ? WHERE id = ?');
    ids.forEach((id, index) => update.run(index, id));
  }

  private markInitialized(): void {
    const now = Date.now();
    this.database
      .prepare('UPDATE code_repository_state SET initialized = 1, updated_at = ? WHERE singleton_id = 1')
      .run(now);
  }

  private assertExpectedRevision(expectedRevision: number): void {
    const current = this.getContentRevision();
    if (current !== expectedRevision) {
      const err = new Error('revision-conflict');
      (err as Error & { expected?: number; actual?: number }).expected = expectedRevision;
      (err as Error & { expected?: number; actual?: number }).actual = current;
      throw err;
    }
  }

  private incrementContentRevision(): void {
    const now = Date.now();
    this.database
      .prepare(
        'UPDATE code_repository_state SET content_revision = content_revision + 1, updated_at = ? WHERE singleton_id = 1',
      )
      .run(now);
  }

  private withTransaction<T>(operation: () => T): T {
    this.assertOpen();
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure; the original error is more useful.
      }
      throw error;
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Code Repository database is closed');
  }
}

function mapDbRow(row: Record<string, unknown>): CodeRepositoryDbNode {
  const kind = row.kind;
  if (kind !== 'root' && kind !== 'group' && kind !== 'snippet') {
    throw new Error(`Invalid node kind in database: ${String(kind)}`);
  }
  return {
    id: String(row.id),
    parentId: row.parent_id === null ? null : String(row.parent_id),
    kind,
  };
}

function toSnapshotNode(row: Record<string, unknown>): CodeRepositoryNode {
  const kind = row.kind;
  if (kind !== 'root' && kind !== 'group' && kind !== 'snippet') {
    throw new Error(`Invalid node kind in database: ${String(kind)}`);
  }
  return {
    id: String(row.id),
    kind,
    name: String(row.display_name),
    parentId: row.parent_id === null ? null : String(row.parent_id),
    order: Number(row.sort_order),
    ...(kind === 'snippet' ? { code: row.code_text === null ? '' : String(row.code_text) } : {}),
    ...(kind !== 'snippet' ? { children: [] } : {}),
  };
}

function requireNonBlankName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error('invalid-tree:empty-name');
  return normalized;
}

function countTreeNodes(root: CodeRepositoryNode): number {
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    count += 1;
    stack.push(...(node.children ?? []));
  }
  return count;
}
