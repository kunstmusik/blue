import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  LibrarySupportStatus,
  LibraryType,
} from '../../shared/unified-library';
import { initializeUnifiedLibrarySchema } from './schema';
import {
  classifyLibraryPayload,
  parseRawXmlDocument,
  type LegacyLibraryDocumentPlan,
  type LegacyLibraryTreeNode,
} from '@blue/data';

export type LibraryNodeKind = 'root' | 'folder' | 'item';

export interface RepositoryNode {
  readonly id: string;
  readonly libraryType: LibraryType;
  readonly nodeKind: LibraryNodeKind;
  readonly parentId: string | null;
  readonly displayName: string;
  readonly searchName: string;
  readonly sortIndex: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByImportBatchId: string | null;
}

export interface RepositoryItemPayloadInput {
  readonly embeddedName: string | null;
  readonly objectType: string;
  readonly supportStatus: LibrarySupportStatus;
  readonly supportReasonCode: string | null;
  readonly supportMessage: string | null;
  readonly payloadXml: string;
  readonly rawHash: string;
  readonly canonicalContentHash: string;
  readonly serializerRevision: string | null;
  readonly preview: Readonly<Record<string, unknown>>;
  readonly dependencies: Readonly<Record<string, unknown>>;
  readonly metadataRevision: number;
}

export interface RepositoryItemPayload extends RepositoryItemPayloadInput {
  readonly nodeId: string;
}

export interface RepositorySnapshot {
  readonly contentRevision: number;
  readonly itemCounts: Record<LibraryType, number>;
}

export interface RepositoryBrowsePage {
  readonly nodes: readonly RepositoryNode[];
  readonly hasMore: boolean;
}

export interface RepositorySearchItem {
  readonly node: RepositoryNode;
  readonly objectType: string;
  readonly supportStatus: LibrarySupportStatus;
  readonly breadcrumb: readonly string[];
}

export type RepositoryItemSummary = Omit<RepositorySearchItem, 'breadcrumb'>;

export interface RepositorySearchPage {
  readonly items: readonly RepositorySearchItem[];
  readonly hasMore: boolean;
  readonly total: number;
}

export interface RepositoryImportSourceResult {
  readonly sourceId: string;
  readonly createdNodeIds: readonly string[];
  readonly folderCount: number;
  readonly itemCount: number;
  readonly unsupportedCount: number;
  readonly exactDuplicateCount: number;
  readonly aliasCount: number;
}

export interface RepositoryImportHistoryEntry {
  readonly id: string;
  readonly mode: 'automatic' | 'manualJavaFolder' | 'manualXmlFiles';
  readonly status: 'previewed' | 'running' | 'completed' | 'partial' | 'failed' | 'undone';
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly sourceCount: number;
  readonly counts: Readonly<Record<string, unknown>>;
  readonly report: Readonly<Record<string, unknown>>;
}

function normalizeSearchName(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase();
}

function validateDisplayName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error('Invalid library node name');
  }
  return trimmed;
}

function asLibraryType(value: unknown): LibraryType {
  if (value === 'instrument' || value === 'udo' || value === 'soundObject' || value === 'effect') {
    return value;
  }
  throw new Error(`Invalid library type in database: ${String(value)}`);
}

function asNodeKind(value: unknown): LibraryNodeKind {
  if (value === 'root' || value === 'folder' || value === 'item') return value;
  throw new Error(`Invalid node kind in database: ${String(value)}`);
}

function mapNode(row: Record<string, unknown>): RepositoryNode {
  return {
    id: String(row.id),
    libraryType: asLibraryType(row.library_type),
    nodeKind: asNodeKind(row.node_kind),
    parentId: row.parent_id === null ? null : String(row.parent_id),
    displayName: String(row.display_name),
    searchName: String(row.search_name),
    sortIndex: Number(row.sort_index),
    revision: Number(row.revision),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdByImportBatchId:
      row.created_by_import_batch_id === null
        ? null
        : String(row.created_by_import_batch_id),
  };
}

export class UnifiedLibraryRepository {
  private closed = false;

  private constructor(
    private readonly database: DatabaseSync,
  ) {}

  static open(databasePath: string): UnifiedLibraryRepository {
    const database = new DatabaseSync(databasePath);
    try {
      const integrity = database.prepare('PRAGMA quick_check').get();
      if (String(integrity ? Object.values(integrity)[0] : '') !== 'ok') {
        throw new Error('Unified Library integrity check failed');
      }
      initializeUnifiedLibrarySchema(database, { fileBacked: databasePath !== ':memory:' });
      const repository = new UnifiedLibraryRepository(database);
      repository.refreshUnsupportedClassifications();
      return repository;
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
      .prepare('SELECT content_revision FROM library_store_state WHERE singleton_id = 1')
      .get();
    return Number(row?.content_revision ?? 0);
  }

  getSnapshot(): RepositorySnapshot {
    this.assertOpen();
    const itemCounts: Record<LibraryType, number> = {
      instrument: 0,
      udo: 0,
      soundObject: 0,
      effect: 0,
    };
    for (const row of this.database
      .prepare("SELECT library_type, COUNT(*) AS count FROM library_nodes WHERE node_kind = 'item' GROUP BY library_type")
      .all()) {
      itemCounts[asLibraryType(row.library_type)] = Number(row.count);
    }
    return { contentRevision: this.getContentRevision(), itemCounts };
  }

  private refreshUnsupportedClassifications(): void {
    const rows = this.database.prepare(`
      SELECT nodes.id, nodes.library_type, payload.*
      FROM library_nodes nodes
      JOIN library_item_payloads payload ON payload.node_id = nodes.id
      WHERE payload.support_status = 'unsupported'
    `).all();
    if (rows.length === 0) return;

    this.withTransaction(() => {
      let updated = 0;
      const now = new Date().toISOString();
      for (const row of rows) {
        try {
          const payloadXml = String(row.payload_xml);
          const classified = classifyLibraryPayload(
            asLibraryType(row.library_type),
            parseRawXmlDocument(payloadXml).root,
          );
          if (
            classified.supportStatus !== 'supported'
            || classified.rawHash !== String(row.raw_hash)
          ) continue;
          this.database.prepare(`
            UPDATE library_item_payloads
            SET object_type = ?, support_status = 'supported',
                support_reason_code = NULL, support_message = NULL,
                preview_json = ?, dependency_json = ?,
                metadata_revision = metadata_revision + 1
            WHERE node_id = ?
          `).run(
            classified.objectType,
            JSON.stringify(classified.preview),
            JSON.stringify(classified.dependencies),
            String(row.id),
          );
          this.database.prepare(`
            UPDATE library_nodes
            SET revision = revision + 1, updated_at = ?
            WHERE id = ?
          `).run(now, String(row.id));
          updated += 1;
        } catch {
          // Preserved unsupported payloads remain untouched when they cannot be classified safely.
        }
      }
      if (updated > 0) this.incrementContentRevision();
    });
  }

  getRoot(libraryType: LibraryType): RepositoryNode {
    this.assertOpen();
    const row = this.database
      .prepare("SELECT * FROM library_nodes WHERE library_type = ? AND node_kind = 'root'")
      .get(libraryType);
    if (!row) throw new Error(`Library root not found: ${libraryType}`);
    return mapNode(row);
  }

  getNode(nodeId: string): RepositoryNode {
    this.assertOpen();
    const row = this.database.prepare('SELECT * FROM library_nodes WHERE id = ?').get(nodeId);
    if (!row) throw new Error(`Library node not found: ${nodeId}`);
    return mapNode(row);
  }

  listChildren(parentId: string): RepositoryNode[] {
    this.assertOpen();
    return this.database
      .prepare(`
        SELECT * FROM library_nodes
        WHERE parent_id = ?
        ORDER BY CASE node_kind WHEN 'folder' THEN 0 ELSE 1 END, sort_index, id
      `)
      .all(parentId)
      .map(mapNode);
  }

  listChildrenPage(parentId: string, offset: number, limit: number): RepositoryBrowsePage {
    this.assertOpen();
    const boundedLimit = Math.max(1, Math.min(limit, 500));
    const boundedOffset = Math.max(0, Math.trunc(offset));
    const rows = this.database
      .prepare(`
        SELECT * FROM library_nodes
        WHERE parent_id = ?
        ORDER BY CASE node_kind WHEN 'folder' THEN 0 ELSE 1 END, sort_index, id
        LIMIT ? OFFSET ?
      `)
      .all(parentId, boundedLimit + 1, boundedOffset);
    return {
      nodes: rows.slice(0, boundedLimit).map(mapNode),
      hasMore: rows.length > boundedLimit,
    };
  }

  hasChildren(nodeId: string): boolean {
    this.assertOpen();
    return Boolean(this.database
      .prepare('SELECT 1 AS found FROM library_nodes WHERE parent_id = ? LIMIT 1')
      .get(nodeId));
  }

  getBreadcrumb(nodeId: string): string[] {
    this.assertOpen();
    const rows = this.database
      .prepare(`
        WITH RECURSIVE ancestors(id, parent_id, display_name, depth) AS (
          SELECT id, parent_id, display_name, 0 FROM library_nodes WHERE id = ?
          UNION ALL
          SELECT parent.id, parent.parent_id, parent.display_name, ancestors.depth + 1
          FROM library_nodes parent
          JOIN ancestors ON ancestors.parent_id = parent.id
        )
        SELECT display_name FROM ancestors ORDER BY depth DESC
      `)
      .all(nodeId);
    return rows.map((row) => String(row.display_name));
  }

  searchItems(
    query: string,
    libraryType: LibraryType | 'all',
    offset: number,
    limit: number,
  ): RepositorySearchPage {
    this.assertOpen();
    const normalized = normalizeSearchName(query.trim());
    if (normalized.length === 0) return { items: [], hasMore: false, total: 0 };
    const escaped = normalized.replace(/[\\%_]/g, (character) => `\\${character}`);
    const boundedLimit = Math.max(1, Math.min(limit, 500));
    const boundedOffset = Math.max(0, Math.trunc(offset));
    const sql = `
      SELECT nodes.*, payload.object_type, payload.support_status
      FROM library_nodes nodes
      JOIN library_item_payloads payload ON payload.node_id = nodes.id
      WHERE nodes.node_kind = 'item'
        AND nodes.search_name LIKE ? ESCAPE '\\'
        ${libraryType === 'all' ? '' : 'AND nodes.library_type = ?'}
      ORDER BY nodes.library_type, nodes.search_name, nodes.id
      LIMIT ? OFFSET ?
    `;
    const args = libraryType === 'all'
      ? [`%${escaped}%`, boundedLimit + 1, boundedOffset]
      : [`%${escaped}%`, libraryType, boundedLimit + 1, boundedOffset];
    const rows = this.database.prepare(sql).all(...args);
    const countSql = `
      SELECT COUNT(*) AS count
      FROM library_nodes nodes
      WHERE nodes.node_kind = 'item'
        AND nodes.search_name LIKE ? ESCAPE '\\'
        ${libraryType === 'all' ? '' : 'AND nodes.library_type = ?'}
    `;
    const countArgs = libraryType === 'all' ? [`%${escaped}%`] : [`%${escaped}%`, libraryType];
    const count = this.database.prepare(countSql).get(...countArgs);
    return {
      items: rows.slice(0, boundedLimit).map((row) => ({
        node: mapNode(row),
        objectType: String(row.object_type),
        supportStatus: row.support_status === 'supported' ? 'supported' : 'unsupported',
        breadcrumb: this.getBreadcrumb(String(row.id)),
      })),
      hasMore: rows.length > boundedLimit,
      total: Number(count?.count ?? 0),
    };
  }

  getItemPayload(nodeId: string): RepositoryItemPayload {
    this.assertOpen();
    const row = this.database
      .prepare('SELECT * FROM library_item_payloads WHERE node_id = ?')
      .get(nodeId);
    if (!row) throw new Error(`Library item payload not found: ${nodeId}`);
    return {
      nodeId: String(row.node_id),
      embeddedName: row.embedded_name === null ? null : String(row.embedded_name),
      objectType: String(row.object_type),
      supportStatus: row.support_status === 'supported' ? 'supported' : 'unsupported',
      supportReasonCode:
        row.support_reason_code === null ? null : String(row.support_reason_code),
      supportMessage: row.support_message === null ? null : String(row.support_message),
      payloadXml: String(row.payload_xml),
      rawHash: String(row.raw_hash),
      canonicalContentHash: String(row.canonical_content_hash),
      serializerRevision:
        row.serializer_revision === null ? null : String(row.serializer_revision),
      preview: JSON.parse(String(row.preview_json)) as Record<string, unknown>,
      dependencies: JSON.parse(String(row.dependency_json)) as Record<string, unknown>,
      metadataRevision: Number(row.metadata_revision),
    };
  }

  getItemSummary(nodeId: string): RepositoryItemSummary {
    this.assertOpen();
    const row = this.database
      .prepare(`
        SELECT nodes.*, payload.object_type, payload.support_status
        FROM library_nodes nodes
        JOIN library_item_payloads payload ON payload.node_id = nodes.id
        WHERE nodes.id = ? AND nodes.node_kind = 'item'
      `)
      .get(nodeId);
    if (!row) throw new Error(`Library item not found: ${nodeId}`);
    return {
      node: mapNode(row),
      objectType: String(row.object_type),
      supportStatus: row.support_status === 'supported' ? 'supported' : 'unsupported',
    };
  }

  createFolder(input: {
    readonly libraryType: LibraryType;
    readonly parentId: string;
    readonly displayName: string;
    readonly sortIndex?: number;
    readonly createdByImportBatchId?: string | null;
  }): RepositoryNode {
    return this.withTransaction(() => {
      const parent = this.getNode(input.parentId);
      if (parent.libraryType !== input.libraryType || parent.nodeKind === 'item') {
        throw new Error('Invalid library folder parent');
      }
      const node = this.insertNode({
        libraryType: input.libraryType,
        nodeKind: 'folder',
        parentId: input.parentId,
        displayName: input.displayName,
        sortIndex: input.sortIndex,
        createdByImportBatchId: input.createdByImportBatchId,
      });
      this.incrementContentRevision();
      return node;
    });
  }

  createItem(input: {
    readonly libraryType: LibraryType;
    readonly parentId: string;
    readonly displayName: string;
    readonly sortIndex?: number;
    readonly payload: RepositoryItemPayloadInput;
    readonly createdByImportBatchId?: string | null;
  }): RepositoryNode {
    return this.withTransaction(() => {
      const parent = this.getNode(input.parentId);
      if (parent.libraryType !== input.libraryType || parent.nodeKind === 'item') {
        throw new Error('Invalid library item parent');
      }
      const node = this.insertNode({
        libraryType: input.libraryType,
        nodeKind: 'item',
        parentId: input.parentId,
        displayName: input.displayName,
        sortIndex: input.sortIndex,
        createdByImportBatchId: input.createdByImportBatchId,
      });
      this.insertPayload(node.id, input.payload);
      this.incrementContentRevision();
      return node;
    });
  }

  renameNode(nodeId: string, expectedRevision: number, displayName: string): RepositoryNode {
    return this.withTransaction(() => {
      const node = this.getNode(nodeId);
      if (node.nodeKind === 'root') throw new Error('Library roots cannot be renamed');
      if (node.revision !== expectedRevision) throw new Error('Stale revision');
      const name = validateDisplayName(displayName);
      const now = new Date().toISOString();
      this.database
        .prepare(`
          UPDATE library_nodes
          SET display_name = ?, search_name = ?, revision = revision + 1, updated_at = ?
          WHERE id = ? AND revision = ?
        `)
        .run(name, normalizeSearchName(name), now, nodeId, expectedRevision);
      this.incrementContentRevision();
      return this.getNode(nodeId);
    });
  }

  moveNode(
    nodeId: string,
    expectedRevision: number,
    parentId: string,
    targetIndex: number,
    expectedParentRevision?: number,
  ): RepositoryNode {
    return this.withTransaction(() => {
      const node = this.getMutableNode(nodeId, expectedRevision);
      const parent = this.getNode(parentId);
      if (expectedParentRevision !== undefined && parent.revision !== expectedParentRevision) {
        throw new Error('Stale destination revision');
      }
      if (parent.nodeKind === 'item' || parent.libraryType !== node.libraryType) {
        throw new Error('Invalid cross-type library move');
      }
      if (node.nodeKind === 'folder' && this.isDescendant(parentId, node.id)) {
        throw new Error('A folder cannot move into its descendant');
      }
      const oldParentId = node.parentId;
      const now = new Date().toISOString();
      this.database.prepare(`
        UPDATE library_nodes
        SET parent_id = ?, sort_index = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(parentId, Math.max(0, Math.trunc(targetIndex)), now, node.id, expectedRevision);
      if (oldParentId) this.normalizeSiblingOrder(oldParentId);
      this.normalizeSiblingOrder(parentId, node.id, targetIndex);
      this.incrementContentRevision();
      return this.getNode(node.id);
    });
  }

  reorderNode(nodeId: string, expectedRevision: number, targetIndex: number): RepositoryNode {
    return this.withTransaction(() => {
      const node = this.getMutableNode(nodeId, expectedRevision);
      if (!node.parentId) throw new Error('Library roots cannot be reordered');
      this.normalizeSiblingOrder(node.parentId, node.id, targetIndex);
      const now = new Date().toISOString();
      this.database.prepare(`
        UPDATE library_nodes SET revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(now, node.id, expectedRevision);
      this.incrementContentRevision();
      return this.getNode(node.id);
    });
  }

  duplicateNode(
    nodeId: string,
    expectedRevision: number,
    parentId?: string,
    targetIndex?: number,
    expectedParentRevision?: number,
  ): RepositoryNode {
    return this.withTransaction(() => {
      const node = this.getNode(nodeId);
      if (node.nodeKind === 'root' || node.parentId === null) throw new Error('Library roots cannot be duplicated');
      if (node.revision !== expectedRevision) throw new Error('Stale revision');
      const destinationId = parentId ?? node.parentId;
      const destination = this.getNode(destinationId);
      if (expectedParentRevision !== undefined && destination.revision !== expectedParentRevision) {
        throw new Error('Stale destination revision');
      }
      if (destination.nodeKind === 'item' || destination.libraryType !== node.libraryType) {
        throw new Error('Invalid duplicate destination type');
      }
      const duplicate = this.duplicateSubtree(node, destinationId);
      if (targetIndex !== undefined) this.normalizeSiblingOrder(destinationId, duplicate.id, targetIndex);
      this.incrementContentRevision();
      return duplicate;
    });
  }

  deleteNode(nodeId: string, expectedRevision: number): string[] {
    return this.withTransaction(() => {
      const node = this.getMutableNode(nodeId, expectedRevision);
      const parentId = node.parentId;
      const ids = this.listDescendantNodeIds(node.id);
      const remove = this.database.prepare('DELETE FROM library_nodes WHERE id = ?');
      for (const id of ids) remove.run(id);
      if (parentId) this.normalizeSiblingOrder(parentId);
      this.incrementContentRevision();
      return ids;
    });
  }

  listDescendantNodeIds(nodeId: string): string[] {
    this.getNode(nodeId);
    const rows = this.database.prepare(`
      WITH RECURSIVE descendants(id, depth) AS (
        SELECT id, 0 FROM library_nodes WHERE id = ?
        UNION ALL
        SELECT child.id, descendants.depth + 1
        FROM library_nodes child JOIN descendants ON child.parent_id = descendants.id
      ) SELECT id FROM descendants ORDER BY depth DESC
    `).all(nodeId);
    return rows.map((row) => String(row.id));
  }

  updateItemPayload(
    nodeId: string,
    expectedRevision: number,
    payload: RepositoryItemPayloadInput,
  ): RepositoryNode {
    return this.withTransaction(() => {
      const node = this.getMutableNode(nodeId, expectedRevision);
      if (node.nodeKind !== 'item') throw new Error('Only items have editable payloads');
      this.database.prepare('DELETE FROM library_item_payloads WHERE node_id = ?').run(node.id);
      this.insertPayload(node.id, payload);
      const now = new Date().toISOString();
      this.database.prepare(`
        UPDATE library_nodes SET revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(now, node.id, expectedRevision);
      this.incrementContentRevision();
      return this.getNode(node.id);
    });
  }

  updateItem(
    nodeId: string,
    expectedRevision: number,
    displayName: string,
    payload: RepositoryItemPayloadInput,
  ): RepositoryNode {
    return this.withTransaction(() => {
      const node = this.getMutableNode(nodeId, expectedRevision);
      if (node.nodeKind !== 'item') throw new Error('Only items have editable payloads');
      const name = validateDisplayName(displayName);
      this.database.prepare('DELETE FROM library_item_payloads WHERE node_id = ?').run(node.id);
      this.insertPayload(node.id, payload);
      const now = new Date().toISOString();
      this.database.prepare(`
        UPDATE library_nodes
        SET display_name = ?, search_name = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(name, normalizeSearchName(name), now, node.id, expectedRevision);
      this.incrementContentRevision();
      return this.getNode(node.id);
    });
  }

  startImportBatch(input: {
    readonly id: string;
    readonly mode: 'automatic' | 'manualJavaFolder' | 'manualXmlFiles';
    readonly sourceCount: number;
    readonly startedAt: string;
  }): void {
    this.withTransaction(() => {
      this.database.prepare(`
        INSERT INTO import_batches (id, mode, status, started_at, source_count)
        VALUES (?, ?, 'running', ?, ?)
      `).run(input.id, input.mode, input.startedAt, input.sourceCount);
    });
  }

  importLegacyDocument(input: {
    readonly batchId: string;
    readonly sourceId: string;
    readonly sourcePath: string;
    readonly sourceKind: 'primary' | 'backupCandidate' | 'selectedFile';
    readonly plan: LegacyLibraryDocumentPlan;
    readonly conflictPolicy?: 'preserve' | 'merge';
  }): RepositoryImportSourceResult {
    return this.withTransaction(() => {
      const root = this.getRoot(input.plan.libraryType);
      const createdNodeIds: string[] = [];
      let exactDuplicateCount = 0;
      let aliasCount = 0;
      this.database.prepare(`
        INSERT INTO import_sources (
          id, batch_id, library_type, source_kind, source_path,
          source_raw_hash, status, counts_json, diagnostics_json
        ) VALUES (?, ?, ?, ?, ?, ?, 'recognized', '{}', ?)
      `).run(
        input.sourceId, input.batchId, input.plan.libraryType, input.sourceKind,
        input.sourcePath, input.plan.sourceRawHash, JSON.stringify(input.plan.diagnostics),
      );
      const recordChange = this.database.prepare(`
        INSERT INTO import_changes (source_id, node_id, action, recorded_revision, detail_json)
        VALUES (?, ?, ?, ?, ?)
      `);
      const append = (parentId: string, child: LegacyLibraryTreeNode): void => {
        if (child.kind === 'folder') {
          if (input.conflictPolicy === 'merge') {
            const matches = this.listChildren(parentId).filter((candidate) => (
              candidate.nodeKind === 'folder' && candidate.displayName === child.name
            ));
            if (matches.length === 1) {
              for (const nested of child.children) append(matches[0]!.id, nested);
              return;
            }
          }
          const folder = this.insertNode({
            libraryType: input.plan.libraryType,
            nodeKind: 'folder',
            parentId,
            displayName: child.name,
            sortIndex: child.sourceIndex,
            createdByImportBatchId: input.batchId,
          });
          createdNodeIds.push(folder.id);
          recordChange.run(input.sourceId, folder.id, 'created', 1, '{}');
          for (const nested of child.children) append(folder.id, nested);
          return;
        }
        if (input.conflictPolicy === 'merge') {
          const siblings = this.listChildren(parentId).filter((candidate) => candidate.nodeKind === 'item');
          const duplicate = siblings.find((candidate) => (
            this.getItemPayload(candidate.id).canonicalContentHash === child.payload.canonicalContentHash
          ));
          if (duplicate) {
            exactDuplicateCount += 1;
            recordChange.run(
              input.sourceId, duplicate.id, 'exactDuplicateSkipped', duplicate.revision,
              JSON.stringify({ sourceName: child.displayName }),
            );
            return;
          }
        }
        let displayName = child.displayName;
        if (input.conflictPolicy === 'merge') {
          const names = new Set(this.listChildren(parentId).map((candidate) => candidate.displayName));
          if (names.has(displayName)) {
            let suffix = 2;
            while (names.has(`${child.displayName} (Imported ${suffix})`)) suffix += 1;
            displayName = `${child.displayName} (Imported ${suffix})`;
            aliasCount += 1;
          }
        }
        const item = this.insertNode({
          libraryType: input.plan.libraryType,
          nodeKind: 'item',
          parentId,
          displayName,
          sortIndex: child.sourceIndex,
          createdByImportBatchId: input.batchId,
        });
        this.insertPayload(item.id, {
          embeddedName: child.payload.embeddedName,
          objectType: child.payload.objectType,
          supportStatus: child.payload.supportStatus,
          supportReasonCode: child.payload.supportReasonCode,
          supportMessage: child.payload.supportMessage,
          payloadXml: child.payload.rawXml,
          rawHash: child.payload.rawHash,
          canonicalContentHash: child.payload.canonicalContentHash,
          serializerRevision: '1',
          preview: child.payload.preview,
          dependencies: child.payload.dependencies,
          metadataRevision: 1,
        });
        createdNodeIds.push(item.id);
        recordChange.run(
          input.sourceId, item.id, aliasCount > 0 && displayName !== child.displayName ? 'aliasedConflictCreated' : 'created',
          1, JSON.stringify(displayName === child.displayName ? {} : { embeddedName: child.displayName, alias: displayName }),
        );
      };
      for (const child of input.plan.root.children) append(root.id, child);
      const counts = {
        folders: input.plan.folderCount,
        items: input.plan.itemCount,
        unsupported: input.plan.unsupportedCount,
      };
      this.database.prepare(`
        UPDATE import_sources SET status = 'imported', counts_json = ? WHERE id = ?
      `).run(JSON.stringify(counts), input.sourceId);
      this.incrementContentRevision();
      return {
        sourceId: input.sourceId,
        createdNodeIds,
        folderCount: input.plan.folderCount,
        itemCount: input.plan.itemCount,
        unsupportedCount: input.plan.unsupportedCount,
        exactDuplicateCount,
        aliasCount,
      };
    });
  }

  undoImportBatch(batchId: string): { readonly removedNodeIds: readonly string[] } {
    return this.withTransaction(() => {
      const batch = this.database.prepare('SELECT status FROM import_batches WHERE id = ?').get(batchId);
      if (!batch || batch.status === 'undone') throw new Error('Import batch is not undoable');
      const rows = this.database.prepare(`
        SELECT changes.node_id, changes.recorded_revision, nodes.node_kind
        FROM import_changes changes
        LEFT JOIN library_nodes nodes ON nodes.id = changes.node_id
        WHERE changes.source_id IN (SELECT id FROM import_sources WHERE batch_id = ?)
          AND changes.action IN ('created', 'aliasedConflictCreated')
        ORDER BY changes.id DESC
      `).all(batchId);
      for (const row of rows) {
        if (row.node_id === null || row.node_kind === null) throw new Error('Import undo is unavailable because an imported node changed');
        const node = this.getNode(String(row.node_id));
        if (node.revision !== Number(row.recorded_revision)) throw new Error('Import undo is unavailable because an imported node changed');
        if (node.nodeKind === 'folder') {
          const laterChild = this.database.prepare(`
            SELECT 1 AS found FROM library_nodes
            WHERE parent_id = ? AND COALESCE(created_by_import_batch_id, '') <> ? LIMIT 1
          `).get(node.id, batchId);
          if (laterChild) throw new Error('Import undo is unavailable because a folder contains later content');
        }
      }
      const removedNodeIds: string[] = [];
      for (const row of rows) {
        const id = String(row.node_id);
        if (!this.database.prepare('SELECT 1 AS found FROM library_nodes WHERE id = ?').get(id)) continue;
        this.database.prepare('DELETE FROM library_nodes WHERE id = ?').run(id);
        removedNodeIds.push(id);
      }
      this.database.prepare(`
        UPDATE import_batches SET status = 'undone', undo_eligible = 0,
          undo_blocked_reason = 'Batch was undone' WHERE id = ?
      `).run(batchId);
      this.incrementContentRevision();
      return { removedNodeIds };
    });
  }

  recordImportSourceFailure(input: {
    readonly batchId: string;
    readonly sourceId: string;
    readonly sourcePath: string;
    readonly sourceKind: 'primary' | 'backupCandidate' | 'selectedFile';
    readonly libraryType?: LibraryType;
    readonly sourceRawHash?: string;
    readonly status?: 'failed' | 'backupOffered' | 'skipped';
    readonly diagnostic: string;
  }): void {
    this.withTransaction(() => {
      this.database.prepare(`
        INSERT INTO import_sources (
          id, batch_id, library_type, source_kind, source_path,
          source_raw_hash, status, counts_json, diagnostics_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?)
      `).run(
        input.sourceId, input.batchId, input.libraryType ?? null, input.sourceKind,
        input.sourcePath, input.sourceRawHash ?? null, input.status ?? 'failed',
        JSON.stringify([input.diagnostic.slice(0, 1000)]),
      );
    });
  }

  finishImportBatch(input: {
    readonly batchId: string;
    readonly status: 'completed' | 'partial' | 'failed';
    readonly completedAt: string;
    readonly counts: Readonly<Record<string, unknown>>;
    readonly report: Readonly<Record<string, unknown>>;
  }): void {
    this.withTransaction(() => {
      this.database.prepare(`
        UPDATE import_batches
        SET status = ?, completed_at = ?, counts_json = ?, report_json = ?
        WHERE id = ?
      `).run(
        input.status, input.completedAt, JSON.stringify(input.counts),
        JSON.stringify(input.report), input.batchId,
      );
    });
  }

  listImportHistory(limit = 100): RepositoryImportHistoryEntry[] {
    this.assertOpen();
    return this.database.prepare(`
      SELECT * FROM import_batches ORDER BY started_at DESC, id LIMIT ?
    `).all(Math.max(1, Math.min(500, Math.trunc(limit)))).map((row) => ({
      id: String(row.id),
      mode: row.mode as RepositoryImportHistoryEntry['mode'],
      status: row.status as RepositoryImportHistoryEntry['status'],
      startedAt: String(row.started_at),
      completedAt: row.completed_at === null ? null : String(row.completed_at),
      sourceCount: Number(row.source_count),
      counts: JSON.parse(String(row.counts_json)) as Record<string, unknown>,
      report: JSON.parse(String(row.report_json)) as Record<string, unknown>,
    }));
  }

  private insertNode(input: {
    readonly libraryType: LibraryType;
    readonly nodeKind: Exclude<LibraryNodeKind, 'root'>;
    readonly parentId: string;
    readonly displayName: string;
    readonly sortIndex?: number;
    readonly createdByImportBatchId?: string | null;
  }): RepositoryNode {
    const id = randomUUID();
    const name = validateDisplayName(input.displayName);
    const sortIndex = input.sortIndex ?? this.nextSortIndex(input.parentId, input.nodeKind);
    const now = new Date().toISOString();
    this.database
      .prepare(`
        INSERT INTO library_nodes (
          id, library_type, node_kind, parent_id, display_name, search_name,
          sort_index, revision, created_at, updated_at, created_by_import_batch_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `)
      .run(
        id,
        input.libraryType,
        input.nodeKind,
        input.parentId,
        name,
        normalizeSearchName(name),
        sortIndex,
        now,
        now,
        input.createdByImportBatchId ?? null,
      );
    return this.getNode(id);
  }

  private insertPayload(nodeId: string, payload: RepositoryItemPayloadInput): void {
    this.database
      .prepare(`
        INSERT INTO library_item_payloads (
          node_id, embedded_name, object_type, support_status,
          support_reason_code, support_message, payload_xml, raw_hash,
          canonical_content_hash, serializer_revision, preview_json,
          dependency_json, metadata_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        nodeId,
        payload.embeddedName,
        payload.objectType,
        payload.supportStatus,
        payload.supportReasonCode,
        payload.supportMessage,
        payload.payloadXml,
        payload.rawHash,
        payload.canonicalContentHash,
        payload.serializerRevision,
        JSON.stringify(payload.preview),
        JSON.stringify(payload.dependencies),
        payload.metadataRevision,
      );
  }

  private getMutableNode(nodeId: string, expectedRevision: number): RepositoryNode {
    const node = this.getNode(nodeId);
    if (node.nodeKind === 'root') throw new Error('Library roots cannot be changed');
    if (node.revision !== expectedRevision) throw new Error('Stale revision');
    return node;
  }

  private isDescendant(candidateId: string, ancestorId: string): boolean {
    return Boolean(this.database.prepare(`
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM library_nodes WHERE parent_id = ?
        UNION ALL
        SELECT child.id FROM library_nodes child JOIN descendants ON child.parent_id = descendants.id
      ) SELECT 1 AS found FROM descendants WHERE id = ? LIMIT 1
    `).get(ancestorId, candidateId));
  }

  private normalizeSiblingOrder(parentId: string, movingId?: string, targetIndex?: number): void {
    const nodes = this.listChildren(parentId);
    if (movingId) {
      const from = nodes.findIndex((node) => node.id === movingId);
      if (from >= 0) {
        const [moving] = nodes.splice(from, 1);
        nodes.splice(Math.max(0, Math.min(Math.trunc(targetIndex ?? nodes.length), nodes.length)), 0, moving);
      }
    }
    const update = this.database.prepare('UPDATE library_nodes SET sort_index = ? WHERE id = ?');
    const perKind = new Map<LibraryNodeKind, number>();
    nodes.forEach((node, mixedIndex) => {
      const index = node.libraryType === 'soundObject'
        ? mixedIndex
        : perKind.get(node.nodeKind) ?? 0;
      update.run(index, node.id);
      perKind.set(node.nodeKind, index + 1);
    });
  }

  private duplicateSubtree(node: RepositoryNode, parentId: string): RepositoryNode {
    const duplicate = this.insertNode({
      libraryType: node.libraryType,
      nodeKind: node.nodeKind as Exclude<LibraryNodeKind, 'root'>,
      parentId,
      displayName: node.displayName,
      createdByImportBatchId: null,
    });
    if (node.nodeKind === 'item') this.insertPayload(duplicate.id, this.getItemPayload(node.id));
    else for (const child of this.listChildren(node.id)) this.duplicateSubtree(child, duplicate.id);
    return duplicate;
  }

  private nextSortIndex(parentId: string, nodeKind: Exclude<LibraryNodeKind, 'root'>): number {
    const row = this.database
      .prepare(`
        SELECT COALESCE(MAX(sort_index), -1) + 1 AS next_index
        FROM library_nodes WHERE parent_id = ? AND node_kind = ?
      `)
      .get(parentId, nodeKind);
    return Number(row?.next_index ?? 0);
  }

  private incrementContentRevision(): void {
    const now = new Date().toISOString();
    this.database
      .prepare(`
        UPDATE library_store_state
        SET content_revision = content_revision + 1, updated_at = ?
        WHERE singleton_id = 1
      `)
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
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Unified Library repository is closed');
  }
}
