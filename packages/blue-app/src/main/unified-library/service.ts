import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  BrowseLibraryRequest,
  BrowseLibraryResult,
  LibraryChangedEvent,
  LibraryBrowseNode,
  LibraryItemKey,
  LibraryItemPreview,
  LibraryContextRequest,
  LibraryContextSnapshot,
  BeginLibraryDragRequest,
  LibraryDragDescriptor,
  LibraryExactTransferTarget,
  LibraryTransferPreview,
  LibraryTransferPreviewRequest,
  LibraryTransferSourceReference,
  LibraryInsertionPreview,
  LibraryInsertionRequest,
  ConfirmedLibraryInsertionRequest,
  ProjectMutationReceipt,
  UserLibraryMutation,
  LibraryMutationReceipt,
  LibraryMutationPreview,
  PrepareLibraryMutationRequest,
  LibraryEditorPatchRequest,
  LibraryEditorConflictRequest,
  LibraryEditorSessionSnapshot,
  LibraryEditorSaveResult,
  LibraryDraftShutdownPreview,
  ProjectLibraryUsage,
  ProjectLibraryDeletePreview,
  ManualLibraryImportPreview,
  ManualLibraryImportResult,
  LibraryResult,
  LibrarySearchResult,
  LibraryServiceOperationSnapshot,
  LibraryServiceSnapshot,
  LibraryType,
  SearchLibrariesRequest,
  SearchLibrariesResult,
} from '../../shared/unified-library';
import {
  createLibraryCursor,
  createLibraryServiceError,
  parseLibraryCursor,
} from '../../shared/unified-library';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import type { RepositoryNode } from './repository';
import { UnifiedLibraryEditorSessionService } from './editor-session-service';
import { UnifiedLibraryImportExportService } from './import-export-service';
import { LibraryMigrationStateStore } from './migration-state-store';
import * as fs from 'node:fs';
import { classifyRepositoryFailure, verifyRepositoryBackup } from './recovery';
import { LibraryDragSessionService } from './drag-session-service';

type RepositoryClientFactory = (databasePath: string) => UnifiedLibraryRepositoryClient;

export interface UnifiedLibraryServiceOptions {
  readonly legacyConfigurationDirectory?: string;
  readonly migrationStatePath?: string;
}

const EMPTY_COUNTS = {
  instrument: 0,
  udo: 0,
  soundObject: 0,
  effect: 0,
} as const;

export class UnifiedLibraryService {
  private readonly events = new EventEmitter();
  private client: UnifiedLibraryRepositoryClient | null = null;
  private editorSessions: UnifiedLibraryEditorSessionService | null = null;
  private importExport: UnifiedLibraryImportExportService | null = null;
  private recoveryPromise: Promise<LibraryResult<LibraryServiceSnapshot>> | null = null;
  private activeOperation: LibraryServiceOperationSnapshot | null = null;
  private context: LibraryContextSnapshot = { selectedType: 'instrument', target: null };
  private readonly insertionPreviews = new Map<string, {
    readonly input: LibraryInsertionRequest;
    readonly payloadXml?: string;
    readonly targetRevision: string;
    readonly expiresAt: number;
  }>();
  private readonly dragSessions = new LibraryDragSessionService();
  private readonly transferPreviews = new Map<string, {
    readonly source: LibraryTransferSourceReference;
    readonly key: LibraryItemKey;
    readonly sourceRevision: number | string;
    readonly payloadXml?: string;
    readonly target: LibraryExactTransferTarget;
    readonly mode: 'independent' | 'sharedInstance';
    readonly expiresAt: number;
  }>();
  private readonly mutationPreviews = new Map<string, {
    readonly request: PrepareLibraryMutationRequest;
    readonly affectedNodeIds: readonly string[];
    readonly expiresAt: number;
  }>();
  private snapshot: LibraryServiceSnapshot = {
    phase: 'initializing',
    contentRevision: 0,
    migrationState: 'never',
    userItemCounts: { ...EMPTY_COUNTS },
    projectSessionId: null,
    writable: false,
  };

  constructor(
    private readonly databasePath: string,
    private readonly clientFactory: RepositoryClientFactory = UnifiedLibraryRepositoryClient.open,
    private readonly projectAdapter: UnifiedLibraryProjectAdapter = new UnifiedLibraryProjectAdapter(() => null),
    private readonly options: UnifiedLibraryServiceOptions = {},
  ) {}

  async start(): Promise<LibraryServiceSnapshot> {
    if (this.client || this.snapshot.phase === 'ready') return this.getSnapshot();
    this.updateSnapshot({ phase: 'initializing', writable: false, failure: undefined });
    try {
      this.client = this.clientFactory(this.databasePath);
      this.editorSessions = new UnifiedLibraryEditorSessionService(this.client, this.projectAdapter);
      this.importExport = new UnifiedLibraryImportExportService(this.client);
      let repository = await this.client.getSnapshot();
      let migrationState = this.snapshot.migrationState;
      if (this.options.legacyConfigurationDirectory && this.options.migrationStatePath) {
        const stateStore = new LibraryMigrationStateStore(this.options.migrationStatePath);
        migrationState = stateStore.load().legacyMigrationState;
        this.updateSnapshot({ phase: 'migrating', migrationState, writable: true });
        await this.importExport.runAutomaticMigration(
          this.options.legacyConfigurationDirectory,
          stateStore,
        );
        migrationState = stateStore.load().legacyMigrationState;
        repository = await this.client.getSnapshot();
      }
      this.updateSnapshot({
        phase: 'ready',
        writable: true,
        migrationState,
        contentRevision: repository.contentRevision,
        userItemCounts: repository.itemCounts,
        projectSessionId: this.projectAdapter.getProjectSessionId(),
        failure: undefined,
      });
    } catch (error) {
      const failedClient = this.client;
      this.client = null;
      this.editorSessions = null;
      this.importExport = null;
      await failedClient?.close().catch(() => undefined);
      this.updateSnapshot({
        phase: 'readOnlyFailure',
        writable: false,
        failure: classifyRepositoryFailure(error),
      });
    }
    return this.getSnapshot();
  }

  getSnapshot(): LibraryServiceSnapshot {
    return {
      ...this.snapshot,
      userItemCounts: { ...this.snapshot.userItemCounts },
      ...(this.activeOperation ? { operation: { ...this.activeOperation } } : {}),
    };
  }

  async browseLibraries(
    request: BrowseLibraryRequest,
  ): Promise<LibraryResult<BrowseLibraryResult>> {
    const client = this.getReadyClient();
    if (!client) return this.notReady();
    try {
      const repository = await this.refreshRepositorySnapshot(client);
      const limit = this.boundedLimit(request.limit);
      const signature = JSON.stringify(request.parent);
      const cursor = this.resolveCursor(
        request.cursor, 'browse', signature, repository.contentRevision,
      );
      if (!cursor.ok) return cursor;
      if (
        request.expectedContentRevision !== undefined
        && request.expectedContentRevision !== repository.contentRevision
      ) return this.staleCursor('The library changed before browsing could continue.');
      const offset = cursor.value;

      if (request.parent.scope !== 'user') {
        if (request.parent.projectSessionId !== this.projectAdapter.getProjectSessionId()) {
          return {
            ok: false,
            error: createLibraryServiceError(
              'stale-project-session', 'The selected project is no longer active.', false,
            ),
          };
        }
        const all = this.projectAdapter.list(request.parent.libraryType);
        const entries = all.filter((entry) => entry.scope === request.parent.scope);
        const children = entries.slice(offset, offset + limit).map((entry) => (
          this.projectEntryToBrowseNode(entry)
        ));
        return {
          ok: true,
          value: {
            contentRevision: repository.contentRevision,
            parent: this.projectRootNode(
              request.parent.libraryType,
              request.parent.scope,
              request.parent.projectSessionId,
            ),
            children,
            nextCursor: offset + children.length < entries.length
              ? createLibraryCursor({
                  kind: 'browse', contentRevision: repository.contentRevision,
                  offset: offset + children.length, signature,
                })
              : null,
          },
        };
      }

      const parent = request.parent.nodeId
        ? await client.getNode(request.parent.nodeId)
        : await client.getRoot(request.parent.libraryType);
      if (parent.libraryType !== request.parent.libraryType || parent.nodeKind === 'item') {
        return {
          ok: false,
          error: createLibraryServiceError('invalid-request', 'Invalid library browse parent.', false),
        };
      }
      const page = await client.listChildrenPage(parent.id, offset, limit);
      const children = await Promise.all(page.nodes.map((node) => this.userNodeToBrowseNode(client, node)));
      return {
        ok: true,
        value: {
          contentRevision: repository.contentRevision,
          parent: await this.userNodeToBrowseNode(client, parent),
          children,
          nextCursor: page.hasMore
            ? createLibraryCursor({
                kind: 'browse', contentRevision: repository.contentRevision,
                offset: offset + children.length, signature,
              })
            : null,
        },
      };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async searchLibraries(
    request: SearchLibrariesRequest,
  ): Promise<LibraryResult<SearchLibrariesResult>> {
    const client = this.getReadyClient();
    if (!client) return this.notReady();
    try {
      const repository = await this.refreshRepositorySnapshot(client);
      const normalizedQuery = request.query.normalize('NFKC').toLocaleLowerCase().trim();
      const limit = this.boundedLimit(request.limit);
      const signature = JSON.stringify({
        query: normalizedQuery,
        typeFilter: request.typeFilter,
        projectSessionId: request.projectSessionId,
      });
      const cursor = this.resolveCursor(
        request.cursor, 'search', signature, repository.contentRevision,
      );
      if (!cursor.ok) return cursor;
      if (
        request.expectedContentRevision !== undefined
        && request.expectedContentRevision !== repository.contentRevision
      ) return this.staleCursor('The library changed before search could continue.');
      if (!normalizedQuery) {
        return {
          ok: true,
          value: { contentRevision: repository.contentRevision, normalizedQuery, results: [], nextCursor: null },
        };
      }

      const offset = cursor.value;
      const userPage = await client.searchItems(
        normalizedQuery, request.typeFilter, Math.min(offset, Number.MAX_SAFE_INTEGER), limit,
      );
      let results: LibrarySearchResult[] = userPage.items.map(({ node, ...metadata }) => ({
        key: { scope: 'user', libraryType: node.libraryType, nodeId: node.id },
        libraryType: node.libraryType,
        scope: 'user',
        displayName: node.displayName,
        breadcrumb: metadata.breadcrumb,
        supportStatus: metadata.supportStatus,
        objectType: metadata.objectType,
        revision: node.revision,
      }));

      let total = userPage.total;
      if (request.projectSessionId !== null) {
        if (request.projectSessionId !== this.projectAdapter.getProjectSessionId()) {
          return {
            ok: false,
            error: createLibraryServiceError(
              'stale-project-session', 'The selected project is no longer active.', false,
            ),
          };
        }
        const projectResults = this.projectAdapter.search(normalizedQuery, request.typeFilter);
        total += projectResults.length;
        if (results.length < limit) {
          const projectOffset = Math.max(0, offset - userPage.total);
          results = results.concat(projectResults.slice(projectOffset, projectOffset + limit - results.length));
        }
      }
      return {
        ok: true,
        value: {
          contentRevision: repository.contentRevision,
          normalizedQuery,
          results,
          nextCursor: offset + results.length < total
            ? createLibraryCursor({
                kind: 'search', contentRevision: repository.contentRevision,
                offset: offset + results.length, signature,
              })
            : null,
        },
      };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async getLibraryItemPreview(
    key: LibraryItemKey,
  ): Promise<LibraryResult<LibraryItemPreview>> {
    const client = this.getReadyClient();
    if (!client) return this.notReady();
    try {
      if (key.scope !== 'user') {
        const preview = this.projectAdapter.preview(key);
        return preview
          ? { ok: true, value: preview }
          : {
              ok: false,
              error: createLibraryServiceError(
                key.projectSessionId === this.projectAdapter.getProjectSessionId()
                  ? 'not-found'
                  : 'stale-project-session',
                'The project library item is no longer available.', false,
              ),
            };
      }
      const node = await client.getNode(key.nodeId);
      if (node.nodeKind !== 'item' || node.libraryType !== key.libraryType) {
        return {
          ok: false,
          error: createLibraryServiceError('not-found', 'Library item not found.', false),
        };
      }
      const payload = await client.getItemPayload(node.id);
      const fields = Object.fromEntries(Object.entries(payload.preview).filter(([, value]) => (
        typeof value === 'object' && value !== null && 'state' in value
      ))) as LibraryItemPreview['fields'];
      const owned = Array.isArray(payload.dependencies.itemOwned)
        ? payload.dependencies.itemOwned.map(String)
        : [];
      const unresolvedValue = payload.dependencies.unresolvedExternal ?? payload.dependencies.unresolved;
      const unresolved = Array.isArray(unresolvedValue) ? unresolvedValue.map(String) : [];
      return {
        ok: true,
        value: {
          key,
          displayName: node.displayName,
          libraryType: node.libraryType,
          scope: 'user',
          objectType: payload.objectType,
          supportStatus: payload.supportStatus,
          supportMessage: payload.supportMessage,
          fields,
          dependencies: { itemOwned: owned, unresolvedExternal: unresolved },
        },
      };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  onSnapshot(listener: (snapshot: LibraryServiceSnapshot) => void): () => void {
    this.events.on('snapshot', listener);
    return () => this.events.off('snapshot', listener);
  }

  onChanged(listener: (event: LibraryChangedEvent) => void): () => void {
    this.events.on('changed', listener);
    return () => this.events.off('changed', listener);
  }

  onContext(listener: (context: LibraryContextSnapshot) => void): () => void {
    this.events.on('context', listener);
    return () => this.events.off('context', listener);
  }

  getContext(): LibraryContextSnapshot {
    return {
      selectedType: this.context.selectedType,
      target: this.context.target ? { ...this.context.target } : null,
    };
  }

  setLibraryContext(request: LibraryContextRequest): LibraryResult<LibraryContextSnapshot> {
    if (request.type === 'browseType') {
      this.context = { selectedType: request.libraryType, target: null };
    } else {
      const libraryType = request.type === 'instrumentTarget'
        ? 'instrument'
        : request.type === 'udoTarget'
          ? 'udo'
          : request.type === 'effectTarget'
            ? 'effect'
            : 'soundObject';
      const activeSession = this.projectAdapter.getProjectSessionId();
      if (activeSession === null || activeSession !== request.projectSessionId) {
        return {
          ok: false,
          error: createLibraryServiceError(
            'stale-project-session', 'The selected project is no longer active.', false,
          ),
        };
      }
      const details = request.type === 'effectTarget'
        ? {
            channelId: request.channelId,
            chain: request.chain,
            insertIndex: request.insertIndex,
            targetRevision: request.targetRevision,
          }
        : request.type === 'soundObjectTarget'
          ? { location: request.location, targetRevision: request.targetRevision }
          : {};
      const labels = {
        instrument: 'Project Orchestra',
        udo: 'Project UDOs',
        effect: request.type === 'effectTarget'
          ? `${request.channelId} / ${request.chain}`
          : 'Mixer',
        soundObject: 'Score',
      } as const;
      const target = this.projectAdapter.createContextTarget(libraryType, labels[libraryType], details);
      if (!target) return this.notReady();
      this.context = { selectedType: libraryType, target };
    }
    this.events.emit('context', this.getContext());
    return { ok: true, value: this.getContext() };
  }

  clearLibraryInsertionTarget(): LibraryContextSnapshot {
    this.context = { ...this.context, target: null };
    this.events.emit('context', this.getContext());
    return this.getContext();
  }

  async applyLibraryMutation(
    command: UserLibraryMutation,
  ): Promise<LibraryResult<LibraryMutationReceipt>> {
    const client = this.getReadyClient();
    if (!client || !this.snapshot.writable) return this.notReady();
    try {
      let affected: RepositoryNode[] = [];
      let closedEditorSessionIds: string[] = [];
      if (command.type === 'createFolder') {
        affected = [await client.createFolder({
          libraryType: command.libraryType,
          parentId: command.parentId,
          displayName: command.name,
          sortIndex: command.insertIndex,
        })];
      } else if (command.type === 'renameNode') {
        affected = [await client.renameNode(command.nodeId, command.expectedRevision, command.name)];
      } else if (command.type === 'moveNode') {
        affected = [await client.moveNode(
          command.nodeId, command.expectedRevision, command.parentId, command.targetIndex,
          command.expectedParentRevision,
        )];
      } else if (command.type === 'reorderNode') {
        affected = [await client.reorderNode(command.nodeId, command.expectedRevision, command.targetIndex)];
      } else if (command.type === 'duplicateNode') {
        affected = [await client.duplicateNode(
          command.nodeId, command.expectedRevision, command.parentId, command.targetIndex,
          command.expectedParentRevision,
        )];
      } else {
        const preview = this.mutationPreviews.get(command.confirmation);
        this.mutationPreviews.delete(command.confirmation);
        if (
          !preview
          || preview.expiresAt < Date.now()
          || preview.request.nodeId !== command.nodeId
          || preview.request.expectedRevision !== command.expectedRevision
        ) {
          return {
            ok: false,
            error: createLibraryServiceError('preview-expired', 'Delete confirmation expired. Review the affected items again.', false),
          };
        }
        const currentIds = await client.listDescendantNodeIds(command.nodeId);
        if (JSON.stringify(currentIds) !== JSON.stringify(preview.affectedNodeIds)) {
          return { ok: false, error: createLibraryServiceError('stale-revision', 'The delete contents changed. Review them again.', false) };
        }
        const openSessions = this.editorSessions?.getUserSessionsForNodeIds(currentIds) ?? [];
        if (openSessions.some((session) => session.dirty)) {
          return { ok: false, error: createLibraryServiceError('validation-failed', 'Save or discard dirty Library Item editors before deleting.', false) };
        }
        await client.deleteNode(command.nodeId, command.expectedRevision);
        closedEditorSessionIds = this.editorSessions?.closeDeletedUserNodes(currentIds) ?? [];
      }
      for (const node of affected) await this.editorSessions?.reconcileUserNode(node.id);
      const repository = await this.refreshRepositorySnapshot(client);
      const affectedNodes = await Promise.all(affected.map((node) => this.userNodeToBrowseNode(client, node)));
      this.publishChanged({
        contentRevision: repository.contentRevision,
        cause: 'mutation',
        requiresFullRefresh: true,
      });
      return {
        ok: true,
        value: {
          contentRevision: repository.contentRevision,
          affectedNodes,
          ...(closedEditorSessionIds.length > 0 ? { closedEditorSessionIds } : {}),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Library mutation failed.';
      const code = /stale/i.test(message) ? 'stale-revision'
        : /name/i.test(message) ? 'invalid-name'
          : /move|descendant|type/i.test(message) ? 'invalid-move'
            : 'storage-failure';
      return { ok: false, error: createLibraryServiceError(code, message, false) };
    }
  }

  async prepareLibraryMutation(
    request: PrepareLibraryMutationRequest,
  ): Promise<LibraryResult<LibraryMutationPreview>> {
    const client = this.getReadyClient();
    if (!client || !this.snapshot.writable) return this.notReady();
    try {
      const node = await client.getNode(request.nodeId);
      if (node.nodeKind === 'root') throw new Error('Library roots cannot be deleted');
      if (node.revision !== request.expectedRevision) throw new Error('Stale revision');
      const affectedNodeIds = await client.listDescendantNodeIds(node.id);
      const dirtyEditorSessionIds = (this.editorSessions?.getUserSessionsForNodeIds(affectedNodeIds) ?? [])
        .filter((session) => session.dirty)
        .map((session) => session.sessionId);
      const confirmationToken = randomUUID();
      const expiresAt = Date.now() + 60_000;
      this.mutationPreviews.set(confirmationToken, { request, affectedNodeIds, expiresAt });
      return {
        ok: true,
        value: {
          confirmationToken,
          nodeId: node.id,
          expectedRevision: node.revision,
          affectedNodeIds,
          affectedCount: affectedNodeIds.length,
          dirtyEditorSessionIds,
          expiresAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare Library deletion.';
      return { ok: false, error: createLibraryServiceError(/stale/i.test(message) ? 'stale-revision' : 'validation-failed', message, false) };
    }
  }

  async openLibraryItemEditor(
    key: LibraryItemKey,
    pinned = false,
  ): Promise<LibraryResult<LibraryEditorSessionSnapshot>> {
    if (!this.editorSessions) return this.notReady();
    try {
      const session = await this.editorSessions.open(key, pinned);
      this.events.emit('editor', session);
      return { ok: true, value: session };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  getLibraryEditorSession(sessionId: string): LibraryResult<LibraryEditorSessionSnapshot> {
    const session = this.editorSessions?.get(sessionId) ?? null;
    return session
      ? { ok: true, value: session }
      : { ok: false, error: createLibraryServiceError('not-found', 'Editor session not found.', false) };
  }

  patchLibraryEditorSession(
    request: LibraryEditorPatchRequest,
  ): LibraryResult<LibraryEditorSessionSnapshot> {
    try {
      if (!this.editorSessions) return this.notReady();
      const session = this.editorSessions.patch(request.sessionId, request);
      this.events.emit('editor', session);
      return { ok: true, value: session };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async saveLibraryEditorSession(
    sessionId: string,
  ): Promise<LibraryResult<LibraryEditorSaveResult>> {
    try {
      if (!this.editorSessions) return this.notReady();
      const result = await this.editorSessions.save(sessionId);
      this.events.emit('editor', result.session);
      if (result.status === 'saved' && result.session.key.scope !== 'user') {
        this.publishProjectChanged();
      } else if (result.status === 'saved' && this.client) {
        const snapshot = await this.refreshRepositorySnapshot(this.client);
        this.publishChanged({
          contentRevision: snapshot.contentRevision,
          cause: 'itemSave',
          affectedKeys: [result.session.key],
          requiresFullRefresh: false,
        });
      }
      return { ok: true, value: result };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async revertLibraryEditorSession(
    sessionId: string,
  ): Promise<LibraryResult<LibraryEditorSessionSnapshot>> {
    try {
      if (!this.editorSessions) return this.notReady();
      const session = await this.editorSessions.revert(sessionId);
      this.events.emit('editor', session);
      return { ok: true, value: session };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async resolveLibraryEditorConflict(
    request: LibraryEditorConflictRequest,
  ): Promise<LibraryResult<LibraryEditorSessionSnapshot>> {
    try {
      if (!this.editorSessions) return this.notReady();
      const session = await this.editorSessions.resolveConflict(request.sessionId, request.decision);
      this.events.emit('editor', session);
      if (request.decision === 'overwrite' && session.status === 'ready' && !session.dirty) {
        if (session.key.scope !== 'user') {
          this.publishProjectChanged();
        } else if (this.client) {
          const snapshot = await this.refreshRepositorySnapshot(this.client);
          this.publishChanged({
            contentRevision: snapshot.contentRevision,
            cause: 'itemSave',
            affectedKeys: [session.key],
            requiresFullRefresh: false,
          });
        }
      }
      return { ok: true, value: session };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  closeLibraryEditorSession(sessionId: string, decision?: 'discard' | 'cancel'): LibraryResult<boolean> {
    try {
      if (!this.editorSessions) return this.notReady();
      return { ok: true, value: this.editorSessions.close(sessionId, decision) };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  onEditorSession(listener: (session: LibraryEditorSessionSnapshot) => void): () => void {
    this.events.on('editor', listener);
    return () => this.events.off('editor', listener);
  }

  prepareLibraryDraftShutdown(
    reason: LibraryDraftShutdownPreview['reason'],
  ): LibraryDraftShutdownPreview {
    return this.editorSessions?.prepareShutdown(reason) ?? { reason, dirtySessionIds: [], mayContinue: true };
  }

  async resolveLibraryDraftShutdown(decision: 'save' | 'discard' | 'cancel'): Promise<{ mayContinue: boolean }> {
    return this.editorSessions?.resolveShutdown(decision) ?? { mayContinue: true };
  }

  getProjectLibraryUsage(key: LibraryItemKey): LibraryResult<ProjectLibraryUsage> {
    try {
      return { ok: true, value: this.projectAdapter.getUsage(key) };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  previewProjectLibraryDelete(key: LibraryItemKey): LibraryResult<ProjectLibraryDeletePreview> {
    try {
      return { ok: true, value: this.projectAdapter.previewDelete(key) };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  deleteProjectLibraryItem(
    key: LibraryItemKey,
    confirmationToken: string,
  ): LibraryResult<ProjectMutationReceipt> {
    try {
      const receipt = this.projectAdapter.deleteProjectItem(key, confirmationToken);
      this.publishProjectChanged();
      return { ok: true, value: receipt };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async copyProjectLibraryItemToUser(
    key: LibraryItemKey,
    parentId: string,
  ): Promise<LibraryResult<LibraryMutationReceipt>> {
    const client = this.getReadyClient();
    if (!client) return this.notReady();
    try {
      const node = await this.projectAdapter.copyProjectItemToUser(key, client, parentId);
      const repository = await this.refreshRepositorySnapshot(client);
      const browseNode = await this.userNodeToBrowseNode(client, node);
      this.publishChanged({ contentRevision: repository.contentRevision, cause: 'mutation', requiresFullRefresh: true });
      return { ok: true, value: { contentRevision: repository.contentRevision, affectedNodes: [browseNode] } };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async previewManualImport(paths: readonly string[]): Promise<LibraryResult<ManualLibraryImportPreview>> {
    if (!this.importExport) return this.notReady();
    try {
      return { ok: true, value: await this.importExport.previewManualImport(paths) };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async executeManualImport(previewToken: string): Promise<LibraryResult<ManualLibraryImportResult>> {
    if (!this.importExport) return this.notReady();
    try {
      const value = await this.importExport.executeManualImport(previewToken);
      if (this.client) {
        const snapshot = await this.refreshRepositorySnapshot(this.client);
        this.publishChanged({ contentRevision: snapshot.contentRevision, cause: 'import', requiresFullRefresh: true });
      }
      return { ok: true, value };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async exportCurrentLibrary(libraryType: LibraryType, targetPath: string): Promise<LibraryResult<true>> {
    if (!this.importExport) return this.notReady();
    try {
      await this.importExport.exportCurrent(libraryType, targetPath);
      return { ok: true, value: true };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async exportAllLibraries(destinationDirectory: string): Promise<LibraryResult<true>> {
    if (!this.importExport) return this.notReady();
    try {
      await this.importExport.exportAll(destinationDirectory);
      return { ok: true, value: true };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  retryRecovery(): Promise<LibraryResult<LibraryServiceSnapshot>> {
    return this.runRecovery(async () => {
      await this.closeRepositoryForRecovery();
      return this.start();
    });
  }

  restoreRecoveryBackup(backupPath: string): Promise<LibraryResult<LibraryServiceSnapshot>> {
    return this.runRecovery(async () => {
      if (!(await verifyRepositoryBackup(backupPath))) throw new Error('Selected backup failed integrity verification');
      await this.closeRepositoryForRecovery();
      const preservedPath = `${this.databasePath}.failed-${Date.now()}`;
      if (fs.existsSync(this.databasePath)) fs.renameSync(this.databasePath, preservedPath);
      const temporaryPath = `${this.databasePath}.restore.tmp`;
      try {
        fs.copyFileSync(backupPath, temporaryPath, fs.constants.COPYFILE_EXCL);
        fs.renameSync(temporaryPath, this.databasePath);
      } catch (error) {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        if (!fs.existsSync(this.databasePath) && fs.existsSync(preservedPath)) fs.copyFileSync(preservedPath, this.databasePath);
        throw error;
      }
      return this.start();
    });
  }

  createFreshRecoveryDatabase(): Promise<LibraryResult<LibraryServiceSnapshot>> {
    return this.runRecovery(async () => {
      await this.closeRepositoryForRecovery();
      if (fs.existsSync(this.databasePath)) fs.renameSync(this.databasePath, `${this.databasePath}.failed-${Date.now()}`);
      if (this.options.migrationStatePath) {
        const stateStore = new LibraryMigrationStateStore(this.options.migrationStatePath);
        if (stateStore.load().legacyMigrationState === 'never') {
          stateStore.finishAttempt({ state: 'skipped', resultKind: 'noSources', batchId: null });
        }
      }
      return this.start();
    });
  }

  async previewLibraryInsertion(
    request: LibraryInsertionRequest,
  ): Promise<LibraryResult<LibraryInsertionPreview>> {
    const target = this.context.target;
    if (!target || target.libraryType !== request.key.libraryType) {
      return {
        ok: false,
        error: createLibraryServiceError('stale-target', 'Choose a current project destination first.', false),
      };
    }
    const preview = await this.getLibraryItemPreview(request.key);
    if (!preview.ok) return preview;
    let payloadXml: string | undefined;
    if (request.key.scope === 'user') {
      const client = this.getReadyClient();
      if (!client) return this.notReady();
      payloadXml = (await client.getItemPayload(request.key.nodeId)).payloadXml;
    }
    const allowedModes = request.key.scope === 'projectShared' && request.key.libraryType === 'soundObject'
      ? ['independent', 'sharedInstance'] as const
      : ['independent'] as const;
    const requestedMode = request.mode ?? 'independent';
    const blockingReasons: string[] = [];
    if (!allowedModes.includes(requestedMode as never)) {
      blockingReasons.push('The requested copy mode is not available for this item.');
    }
    if (preview.value.supportStatus === 'unsupported') {
      blockingReasons.push(preview.value.supportMessage ?? 'This payload cannot be inserted safely.');
    }
    if (preview.value.dependencies.unresolvedExternal.length > 0) {
      blockingReasons.push('Resolve external dependencies before insertion.');
    }
    if (!target.valid) blockingReasons.push(target.invalidReason ?? 'The destination is stale.');
    const previewToken = randomUUID();
    this.insertionPreviews.set(previewToken, {
      input: { ...request, mode: requestedMode },
      payloadXml,
      targetRevision: target.targetRevision,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return {
      ok: true,
      value: {
        previewToken,
        item: preview.value,
        target,
        requestedMode,
        allowedModes,
        canApply: blockingReasons.length === 0,
        blockingReasons,
      },
    };
  }

  async beginLibraryDrag(
    request: BeginLibraryDragRequest,
  ): Promise<LibraryResult<LibraryDragDescriptor>> {
    const descriptor = this.dragSessions.begin(
      request.key,
      request.revision,
      request.dragSessionId,
    );
    try {
      const currentRevision = await this.getCurrentSourceRevision(request.key);
      if (String(currentRevision) !== String(request.revision)) {
        this.dragSessions.discard(request.dragSessionId);
        return { ok: false, error: createLibraryServiceError('source-changed', 'The library item changed before dragging began.', true) };
      }
      return { ok: true, value: descriptor };
    } catch (error) {
      this.dragSessions.discard(request.dragSessionId);
      return this.failureResult(error);
    }
  }

  cancelLibraryDrag(dragSessionId: string): void {
    this.dragSessions.cancel(dragSessionId);
  }

  async previewLibraryTransfer(
    request: LibraryTransferPreviewRequest,
  ): Promise<LibraryResult<LibraryTransferPreview>> {
    try {
      const source = await this.resolveTransferSource(request.source, false);
      if (source.key.libraryType !== this.targetLibraryType(request.target)) {
        return { ok: false, error: createLibraryServiceError('unsupported', 'This item type cannot be placed at that destination.', false) };
      }
      const targetError = this.projectAdapter.validateTransferTarget(request.target, source.key.libraryType);
      const preview = await this.getLibraryItemPreview(source.key);
      if (!preview.ok) return preview;
      const requestedMode = request.mode ?? 'independent';
      const allowedModes = source.key.scope === 'projectShared' && source.key.libraryType === 'soundObject'
        ? ['independent', 'sharedInstance'] as const
        : ['independent'] as const;
      const blockingReasons: string[] = [];
      if (targetError) blockingReasons.push(targetError);
      if (!allowedModes.includes(requestedMode as never)) blockingReasons.push('The requested copy mode is not available for this item.');
      if (preview.value.supportStatus === 'unsupported') blockingReasons.push(preview.value.supportMessage ?? 'This payload cannot be transferred safely.');
      if (preview.value.dependencies.unresolvedExternal.length > 0) blockingReasons.push('Resolve external dependencies before transfer.');
      const readyClient = source.key.scope === 'user' ? this.getReadyClient() : null;
      if (source.key.scope === 'user' && !readyClient) return this.notReady();
      const payloadXml = source.key.scope === 'user'
        ? (await readyClient!.getItemPayload(source.key.nodeId)).payloadXml
        : undefined;
      const previewToken = randomUUID();
      this.transferPreviews.set(previewToken, {
        source: request.source,
        key: source.key,
        sourceRevision: source.revision,
        payloadXml,
        target: request.target,
        mode: requestedMode,
        expiresAt: Date.now() + 5 * 60_000,
      });
      return {
        ok: true,
        value: {
          previewToken,
          item: preview.value,
          target: request.target,
          requestedMode,
          allowedModes,
          canApply: blockingReasons.length === 0,
          blockingReasons,
        },
      };
    } catch (error) {
      return this.failureResult(error);
    }
  }

  async applyLibraryTransfer(previewToken: string): Promise<LibraryResult<ProjectMutationReceipt>> {
    const pending = this.transferPreviews.get(previewToken);
    this.transferPreviews.delete(previewToken);
    if (!pending || pending.expiresAt < Date.now()) {
      return { ok: false, error: createLibraryServiceError('preview-expired', 'Transfer preview expired.', true) };
    }
    try {
      const current = await this.resolveTransferSource(pending.source, pending.source.kind === 'drag');
      if (String(current.revision) !== String(pending.sourceRevision)) throw new Error('Library source changed before transfer');
      const targetError = this.projectAdapter.validateTransferTarget(pending.target, pending.key.libraryType);
      if (targetError) throw new Error(targetError);
      const target = this.toInsertionTarget(pending.target, pending.key.libraryType);
      const receipt = this.projectAdapter.applyInsertion({
        key: pending.key,
        payloadXml: pending.payloadXml,
        target,
        mode: pending.mode,
      });
      this.publishProjectChanged();
      return { ok: true, value: receipt };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transfer failed.';
      const code = /source|changed/i.test(message) ? 'source-changed'
        : /session/i.test(message) ? 'stale-project-session'
          : /target|destination|layer|revision/i.test(message) ? 'stale-target'
            : /dependency/i.test(message) ? 'dependency-conflict'
              : 'validation-failed';
      return { ok: false, error: createLibraryServiceError(code, message, false) };
    }
  }

  async applyLibraryInsertion(
    request: ConfirmedLibraryInsertionRequest,
  ): Promise<LibraryResult<ProjectMutationReceipt>> {
    const pending = this.insertionPreviews.get(request.previewToken);
    this.insertionPreviews.delete(request.previewToken);
    const target = this.context.target;
    if (!pending || pending.expiresAt < Date.now()) {
      return {
        ok: false,
        error: createLibraryServiceError('preview-expired', 'Insertion preview expired.', true),
      };
    }
    if (!target || target.targetRevision !== pending.targetRevision) {
      return {
        ok: false,
        error: createLibraryServiceError('stale-target', 'The insertion destination changed.', false),
      };
    }
    try {
      const receipt = this.projectAdapter.applyInsertion({
        key: pending.input.key,
        payloadXml: pending.payloadXml,
        target,
        mode: pending.input.mode ?? 'independent',
      });
      this.publishProjectChanged();
      return { ok: true, value: receipt };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Insertion failed.';
      const code = /session/i.test(message)
        ? 'stale-project-session'
        : /target|destination|layer/i.test(message)
          ? 'stale-target'
          : /dependency/i.test(message)
            ? 'dependency-conflict'
            : 'validation-failed';
      return { ok: false, error: createLibraryServiceError(code, message, false) };
    }
  }

  acquireOperation(
    kind: LibraryServiceOperationSnapshot['kind'],
    phase: string,
  ): () => void {
    if (this.activeOperation) {
      throw new Error(`Unified Library operation already in progress: ${this.activeOperation.kind}`);
    }
    this.activeOperation = { kind, phase, startedAt: new Date().toISOString() };
    this.emitSnapshot();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeOperation = null;
      this.emitSnapshot();
    };
  }

  private async getCurrentSourceRevision(key: LibraryItemKey): Promise<number | string> {
    if (key.scope === 'user') {
      const client = this.getReadyClient();
      if (!client) throw new Error('Library service is not ready');
      return (await client.getNode(key.nodeId)).revision;
    }
    if (this.projectAdapter.getProjectSessionId() !== key.projectSessionId) throw new Error('Stale project session');
    const entry = this.projectAdapter.list(key.libraryType).find((candidate) => JSON.stringify(candidate.key) === JSON.stringify(key));
    if (!entry) throw new Error('Library source not found');
    return entry.revision;
  }

  private async resolveTransferSource(
    reference: LibraryTransferSourceReference,
    consume: boolean,
  ): Promise<{ key: LibraryItemKey; revision: number | string }> {
    if (reference.kind === 'clipboard') {
      const source = reference.source;
      const key: LibraryItemKey = source.kind === 'library'
        ? source.key
        : { scope: 'user', libraryType: source.libraryType, nodeId: source.nodeId };
      const revision = await this.getCurrentSourceRevision(key);
      if (String(revision) !== String(source.revision)) throw new Error('Library source changed before transfer');
      return { key, revision };
    }
    const session = consume
      ? this.dragSessions.peek(reference.dragSessionId)
      : this.dragSessions.claim(reference.dragSessionId);
    if (!session) throw new Error('Drag session expired');
    const currentRevision = await this.getCurrentSourceRevision(session.key);
    return consume
      ? this.dragSessions.consume(reference.dragSessionId, currentRevision)
      : this.dragSessions.resolve(reference.dragSessionId, currentRevision);
  }

  private targetLibraryType(target: LibraryExactTransferTarget): LibraryType {
    if (target.kind === 'orchestra') return 'instrument';
    if (target.kind === 'projectUdo') return 'udo';
    if (target.kind === 'effectChain') return 'effect';
    return 'soundObject';
  }

  private toInsertionTarget(target: LibraryExactTransferTarget, libraryType: LibraryType) {
    const base = {
      libraryType,
      projectSessionId: target.projectSessionId,
      valid: true,
      targetRevision: String(target.projectRevision),
    } as const;
    if (target.kind === 'effectChain') return { ...base, label: `${target.chain === 'pre' ? 'Pre' : 'Post'} Effects`, channelId: target.channelId, chain: target.chain, insertIndex: target.insertIndex };
    if (target.kind === 'score') return { ...base, label: 'Score', location: target.location };
    return { ...base, label: target.kind === 'orchestra' ? 'Orchestra' : 'Project UDOs', insertIndex: target.insertIndex };
  }

  publishChanged(event: LibraryChangedEvent): void {
    if (event.contentRevision >= this.snapshot.contentRevision) {
      this.snapshot = { ...this.snapshot, contentRevision: event.contentRevision };
    }
    this.events.emit('changed', event);
    this.emitSnapshot();
  }

  publishProjectChanged(): void {
    this.snapshot = {
      ...this.snapshot,
      projectSessionId: this.projectAdapter.getProjectSessionId(),
    };
    this.publishChanged({
      contentRevision: this.snapshot.contentRevision,
      cause: 'projectChanged',
      requiresFullRefresh: true,
    });
  }

  async stop(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.editorSessions = null;
    this.importExport = null;
    if (client) await client.close();
    this.activeOperation = null;
    this.insertionPreviews.clear();
    this.transferPreviews.clear();
    this.mutationPreviews.clear();
    this.updateSnapshot({ phase: 'stopped', writable: false });
    this.events.removeAllListeners();
  }

  private runRecovery(
    operation: () => Promise<LibraryServiceSnapshot>,
  ): Promise<LibraryResult<LibraryServiceSnapshot>> {
    if (this.recoveryPromise) return this.recoveryPromise;
    this.updateSnapshot({ phase: 'recovering', writable: false });
    this.recoveryPromise = operation()
      .then((value) => ({ ok: true as const, value }))
      .catch((error) => {
        this.updateSnapshot({ phase: 'readOnlyFailure', writable: false, failure: classifyRepositoryFailure(error) });
        return { ok: false as const, error: createLibraryServiceError('recovery-required', error instanceof Error ? error.message : 'Recovery failed.', true) };
      })
      .finally(() => { this.recoveryPromise = null; });
    return this.recoveryPromise;
  }

  private async closeRepositoryForRecovery(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.editorSessions = null;
    this.importExport = null;
    await client?.close();
  }

  private updateSnapshot(update: Partial<LibraryServiceSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...update,
      userItemCounts: update.userItemCounts
        ? { ...update.userItemCounts }
        : this.snapshot.userItemCounts,
    };
    this.emitSnapshot();
  }

  private getReadyClient(): UnifiedLibraryRepositoryClient | null {
    return this.snapshot.phase === 'ready' ? this.client : null;
  }

  private boundedLimit(limit: number | undefined): number {
    return Math.max(1, Math.min(limit ?? 100, 500));
  }

  private resolveCursor(
    cursorValue: string | undefined,
    kind: 'browse' | 'search',
    signature: string,
    contentRevision: number,
  ): LibraryResult<number> {
    if (!cursorValue) return { ok: true, value: 0 };
    const cursor = parseLibraryCursor(cursorValue);
    if (
      !cursor
      || cursor.kind !== kind
      || cursor.signature !== signature
      || cursor.contentRevision !== contentRevision
    ) return this.staleCursor('The library changed or this page token no longer matches the request.');
    return { ok: true, value: cursor.offset };
  }

  private staleCursor<T>(message: string): LibraryResult<T> {
    return { ok: false, error: createLibraryServiceError('stale-cursor', message, true) };
  }

  private notReady<T>(): LibraryResult<T> {
    return {
      ok: false,
      error: createLibraryServiceError('service-not-ready', 'Libraries are not ready.', true),
    };
  }

  private failureResult<T>(error: unknown): LibraryResult<T> {
    const message = error instanceof Error ? error.message : 'Library storage failed.';
    const notFound = /not found/i.test(message);
    return {
      ok: false,
      error: createLibraryServiceError(
        notFound ? 'not-found' : 'storage-failure', message, !notFound,
      ),
    };
  }

  private async refreshRepositorySnapshot(
    client: UnifiedLibraryRepositoryClient,
  ) {
    const repository = await client.getSnapshot();
    if (
      repository.contentRevision !== this.snapshot.contentRevision
      || this.snapshot.projectSessionId !== this.projectAdapter.getProjectSessionId()
    ) {
      this.snapshot = {
        ...this.snapshot,
        contentRevision: repository.contentRevision,
        userItemCounts: repository.itemCounts,
        projectSessionId: this.projectAdapter.getProjectSessionId(),
      };
    }
    return repository;
  }

  private async userNodeToBrowseNode(
    client: UnifiedLibraryRepositoryClient,
    node: RepositoryNode,
  ): Promise<LibraryBrowseNode> {
    let supportStatus: LibraryBrowseNode['supportStatus'];
    let objectType: string | undefined;
    if (node.nodeKind === 'item') {
      const summary = await client.getItemSummary(node.id);
      supportStatus = summary.supportStatus;
      objectType = summary.objectType;
    }
    return {
      key: node.nodeKind === 'item'
        ? { scope: 'user', libraryType: node.libraryType, nodeId: node.id }
        : null,
      nodeId: node.id,
      parentId: node.parentId,
      libraryType: node.libraryType,
      scope: 'user',
      nodeKind: node.nodeKind,
      displayName: node.displayName,
      breadcrumb: await client.getBreadcrumb(node.id),
      ...(supportStatus ? { supportStatus } : {}),
      ...(objectType ? { objectType } : {}),
      revision: node.revision,
      hasChildren: node.nodeKind !== 'item' && await client.hasChildren(node.id),
    };
  }

  private projectRootNode(
    libraryType: Exclude<LibraryType, 'effect'>,
    scope: 'projectOwned' | 'projectShared',
    sessionId: number,
  ): LibraryBrowseNode {
    const labels: Record<Exclude<LibraryType, 'effect'>, string> = {
      instrument: 'Project Orchestra',
      udo: 'Project UDOs',
      soundObject: 'Project Shared SoundObjects',
    };
    return {
      key: null,
      nodeId: `${scope}:${sessionId}:${libraryType}`,
      parentId: null,
      libraryType,
      scope,
      nodeKind: 'root',
      displayName: labels[libraryType],
      breadcrumb: [labels[libraryType]],
      revision: `project:${sessionId}`,
      hasChildren: this.projectAdapter.list(libraryType).length > 0,
    };
  }

  private projectEntryToBrowseNode(entry: LibrarySearchResult): LibraryBrowseNode {
    const projectSessionId = entry.key.scope === 'user' ? 0 : entry.key.projectSessionId;
    return {
      key: entry.key,
      nodeId: `project:${projectSessionId}:${JSON.stringify(entry.key)}`,
      parentId: `${entry.scope}:${projectSessionId}:${entry.libraryType}`,
      libraryType: entry.libraryType,
      scope: entry.scope,
      nodeKind: 'item',
      displayName: entry.displayName,
      breadcrumb: entry.breadcrumb,
      supportStatus: entry.supportStatus,
      objectType: entry.objectType,
      revision: entry.revision,
      hasChildren: false,
    };
  }

  private emitSnapshot(): void {
    this.events.emit('snapshot', this.getSnapshot());
  }
}
