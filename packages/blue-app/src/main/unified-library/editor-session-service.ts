import { createHash, randomUUID } from 'node:crypto';
import type {
  LibraryEditorConflictDecision,
  LibraryEditorPatchRequest,
  LibraryEditorSessionSnapshot,
  LibraryItemKey,
} from '../../shared/unified-library';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { Element } from '@blue/data';
import { LibraryEditorAdapterRegistry } from './editor-adapters';

export type LibraryEditorSessionStatus = 'ready' | 'conflict' | 'missing';

interface InternalLibraryEditorSession extends LibraryEditorSessionSnapshot {
  readonly draftXml: string;
  readonly savedXml: string;
}

export type LibraryEditorSaveResult =
  | { readonly status: 'saved'; readonly session: LibraryEditorSessionSnapshot }
  | { readonly status: 'conflict'; readonly session: LibraryEditorSessionSnapshot }
  | { readonly status: 'missing'; readonly session: LibraryEditorSessionSnapshot };

export interface LibraryDraftShutdownPreview {
  readonly reason: 'quit' | 'closeProject' | 'switchProject';
  readonly dirtySessionIds: readonly string[];
  readonly mayContinue: boolean;
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function logicalKey(key: LibraryItemKey): string {
  return JSON.stringify(key);
}

export class UnifiedLibraryEditorSessionService {
  private readonly sessions = new Map<string, InternalLibraryEditorSession>();
  private readonly byLogicalKey = new Map<string, string>();

  private readonly savedNames = new Map<string, string>();
  private readonly adapters = new LibraryEditorAdapterRegistry();

  constructor(
    private readonly repository: UnifiedLibraryRepositoryClient,
    private readonly projectAdapter: UnifiedLibraryProjectAdapter = new UnifiedLibraryProjectAdapter(() => null),
  ) {}

  async open(key: LibraryItemKey, pinned = false): Promise<LibraryEditorSessionSnapshot> {
    const existingId = this.byLogicalKey.get(logicalKey(key));
    if (existingId) return this.toSnapshot(this.requireSession(existingId));
    for (const session of this.sessions.values()) {
      if (!session.dirty && !session.pinned) this.remove(session.sessionId);
    }
    const source = key.scope === 'user'
      ? null
      : this.projectAdapter.getEditorSource(key);
    if (key.scope !== 'user' && !source) throw new Error('Project library item not found');
    const node = key.scope === 'user' ? await this.repository.getNode(key.nodeId) : null;
    const payload = key.scope === 'user' ? await this.repository.getItemPayload(key.nodeId) : null;
    const payloadXml = payload?.payloadXml ?? source!.payloadXml;
    const objectType = payload?.objectType ?? source!.objectType;
    const session: InternalLibraryEditorSession = {
      sessionId: randomUUID(),
      key,
      displayName: node?.displayName ?? source!.displayName,
      objectType,
      breadcrumb: node ? await this.repository.getBreadcrumb(node.id) : source!.breadcrumb,
      baseRevision: node?.revision ?? source!.revision,
      document: this.adapters.hydrate(
        key.libraryType,
        payloadXml,
        objectType,
        payload?.supportStatus ?? 'supported',
      ),
      draftXml: payloadXml,
      savedXml: payloadXml,
      dirty: false,
      pinned,
      status: 'ready',
    };
    this.sessions.set(session.sessionId, session);
    this.savedNames.set(session.sessionId, session.displayName);
    this.byLogicalKey.set(logicalKey(key), session.sessionId);
    return this.toSnapshot(session);
  }

  get(sessionId: string): LibraryEditorSessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    return session ? this.toSnapshot(session) : null;
  }

  list(): LibraryEditorSessionSnapshot[] {
    return [...this.sessions.values()].map((session) => this.toSnapshot(session));
  }

  getUserSessionsForNodeIds(nodeIds: readonly string[]): LibraryEditorSessionSnapshot[] {
    const ids = new Set(nodeIds);
    return [...this.sessions.values()]
      .filter((session) => session.key.scope === 'user' && ids.has(session.key.nodeId))
      .map((session) => this.toSnapshot(session));
  }

  async reconcileUserNode(nodeId: string): Promise<void> {
    const node = await this.repository.getNode(nodeId);
    const breadcrumb = await this.repository.getBreadcrumb(nodeId);
    for (const [sessionId, session] of this.sessions) {
      if (session.key.scope !== 'user' || session.key.nodeId !== nodeId) continue;
      const next = {
        ...session,
        displayName: node.displayName,
        breadcrumb,
        baseRevision: node.revision,
        dirty: session.draftXml !== session.savedXml,
        status: 'ready' as const,
      };
      this.sessions.set(sessionId, next);
      this.savedNames.set(sessionId, node.displayName);
    }
  }

  closeDeletedUserNodes(nodeIds: readonly string[]): string[] {
    const sessions = this.getUserSessionsForNodeIds(nodeIds);
    if (sessions.some((session) => session.dirty)) {
      throw new Error('Dirty Library Item editors must be saved or discarded before deleting.');
    }
    for (const session of sessions) this.remove(session.sessionId);
    return sessions.map((session) => session.sessionId);
  }

  patch(
    sessionId: string,
    patch: Omit<LibraryEditorPatchRequest, 'sessionId'>,
  ): LibraryEditorSessionSnapshot {
    const current = this.requireSession(sessionId);
    const applied = patch.documentPatch
      ? this.adapters.applyPatch(current.key.libraryType, current.draftXml, patch.documentPatch)
      : null;
    const draftXml = applied?.payloadXml ?? current.draftXml;
    const next: InternalLibraryEditorSession = {
      ...current,
      displayName: patch.displayName ?? current.displayName,
      document: applied?.document ?? current.document,
      draftXml,
      dirty: draftXml !== current.savedXml
        || (patch.displayName ?? current.displayName) !== this.savedNames.get(sessionId),
      pinned: patch.pinned ?? (
        draftXml !== current.savedXml
        || (patch.displayName ?? current.displayName) !== this.savedNames.get(sessionId)
          ? true
          : current.pinned
      ),
      status: 'ready',
    };
    this.sessions.set(sessionId, next);
    return this.toSnapshot(next);
  }

  async save(sessionId: string): Promise<LibraryEditorSaveResult> {
    const current = this.requireSession(sessionId);
    if (current.key.scope !== 'user') {
      try {
        const savedSource = this.projectAdapter.saveEditorSource(
          current.key,
          String(current.baseRevision),
          current.draftXml,
        );
        if (!savedSource) {
          const missing = { ...current, status: 'missing' as const };
          this.sessions.set(sessionId, missing);
          return { status: 'missing', session: this.toSnapshot(missing) };
        }
        const saved = {
          ...current,
          key: savedSource.key,
          displayName: savedSource.displayName,
          objectType: savedSource.objectType,
          breadcrumb: savedSource.breadcrumb,
          baseRevision: savedSource.revision,
          savedXml: savedSource.payloadXml,
          draftXml: savedSource.payloadXml,
          document: this.adapters.hydrate(
            current.key.libraryType,
            savedSource.payloadXml,
            savedSource.objectType,
            'supported',
          ),
          dirty: false,
          status: 'ready' as const,
        };
        this.byLogicalKey.delete(logicalKey(current.key));
        this.byLogicalKey.set(logicalKey(saved.key), sessionId);
        this.sessions.set(sessionId, saved);
        this.savedNames.set(sessionId, saved.displayName);
        return { status: 'saved', session: this.toSnapshot(saved) };
      } catch (error) {
        if (!/conflict/i.test(error instanceof Error ? error.message : '')) throw error;
        const conflict = { ...current, status: 'conflict' as const };
        this.sessions.set(sessionId, conflict);
        return { status: 'conflict', session: this.toSnapshot(conflict) };
      }
    }
    try {
      Element.parse(current.draftXml);
      const node = await this.repository.getNode(current.key.nodeId);
      if (node.revision !== current.baseRevision) {
        const conflict = { ...current, status: 'conflict' as const };
        this.sessions.set(sessionId, conflict);
        return { status: 'conflict', session: this.toSnapshot(conflict) };
      }
      const payload = await this.repository.getItemPayload(node.id);
      const savedNode = await this.repository.updateItem(node.id, node.revision, current.displayName, {
        ...payload,
        payloadXml: current.draftXml,
        rawHash: hash(current.draftXml),
        canonicalContentHash: hash(current.draftXml),
      });
      const saved = {
        ...current,
        breadcrumb: await this.repository.getBreadcrumb(node.id),
        baseRevision: savedNode.revision,
        savedXml: current.draftXml,
        dirty: false,
        status: 'ready' as const,
      };
      this.sessions.set(sessionId, saved);
      this.savedNames.set(sessionId, saved.displayName);
      return { status: 'saved', session: this.toSnapshot(saved) };
    } catch (error) {
      if (!/not found/i.test(error instanceof Error ? error.message : '')) throw error;
      const missing = { ...current, status: 'missing' as const };
      this.sessions.set(sessionId, missing);
      return { status: 'missing', session: this.toSnapshot(missing) };
    }
  }

  async resolveConflict(
    sessionId: string,
    decision: LibraryEditorConflictDecision,
  ): Promise<LibraryEditorSessionSnapshot> {
    const current = this.requireSession(sessionId);
    if (current.status !== 'conflict') throw new Error('Editor session is not in conflict');
    if (decision === 'cancel') return this.toSnapshot(current);
    if (decision === 'reloadLatest') return this.revert(sessionId);

    if (current.key.scope === 'user') {
      const latest = await this.repository.getNode(current.key.nodeId);
      this.savedNames.set(sessionId, latest.displayName);
      this.sessions.set(sessionId, { ...current, baseRevision: latest.revision, status: 'ready' });
    } else {
      const latest = this.projectAdapter.getEditorSource(current.key);
      if (!latest) {
        const missing = { ...current, status: 'missing' as const };
        this.sessions.set(sessionId, missing);
        return this.toSnapshot(missing);
      }
      this.savedNames.set(sessionId, latest.displayName);
      this.sessions.set(sessionId, { ...current, baseRevision: latest.revision, status: 'ready' });
    }
    return (await this.save(sessionId)).session;
  }

  async revert(sessionId: string): Promise<LibraryEditorSessionSnapshot> {
    const current = this.requireSession(sessionId);
    if (current.key.scope !== 'user') {
      const source = this.projectAdapter.getEditorSource(current.key);
      if (!source) {
        const missing = { ...current, status: 'missing' as const };
        this.sessions.set(sessionId, missing);
        return this.toSnapshot(missing);
      }
      const reverted = {
        ...current,
        displayName: source.displayName,
        objectType: source.objectType,
        breadcrumb: source.breadcrumb,
        baseRevision: source.revision,
        draftXml: source.payloadXml,
        document: this.adapters.hydrate(
          current.key.libraryType,
          source.payloadXml,
          source.objectType,
          'supported',
        ),
        savedXml: source.payloadXml,
        dirty: false,
        status: 'ready' as const,
      };
      this.sessions.set(sessionId, reverted);
      this.savedNames.set(sessionId, reverted.displayName);
      return this.toSnapshot(reverted);
    }
    const node = await this.repository.getNode(current.key.nodeId);
    const payload = await this.repository.getItemPayload(node.id);
    const reverted = {
      ...current,
      displayName: node.displayName,
      breadcrumb: await this.repository.getBreadcrumb(node.id),
      baseRevision: node.revision,
      draftXml: payload.payloadXml,
      document: this.adapters.hydrate(
        current.key.libraryType,
        payload.payloadXml,
        payload.objectType,
        payload.supportStatus,
      ),
      savedXml: payload.payloadXml,
      dirty: false,
      status: 'ready' as const,
    };
    this.sessions.set(sessionId, reverted);
    this.savedNames.set(sessionId, reverted.displayName);
    return this.toSnapshot(reverted);
  }

  close(sessionId: string, decision?: 'discard' | 'cancel'): boolean {
    const session = this.requireSession(sessionId);
    if (session.dirty && decision !== 'discard') return false;
    this.remove(sessionId);
    return true;
  }

  prepareShutdown(reason: LibraryDraftShutdownPreview['reason']): LibraryDraftShutdownPreview {
    const dirtySessionIds = this.list().filter((session) => session.dirty).map((session) => session.sessionId);
    return { reason, dirtySessionIds, mayContinue: dirtySessionIds.length === 0 };
  }

  async resolveShutdown(decision: 'save' | 'discard' | 'cancel'): Promise<{ mayContinue: boolean }> {
    if (decision === 'cancel') return { mayContinue: false };
    if (decision === 'save') {
      for (const session of this.list().filter((candidate) => candidate.dirty)) {
        const result = await this.save(session.sessionId);
        if (result.status !== 'saved') return { mayContinue: false };
      }
      return { mayContinue: true };
    }
    for (const [id, session] of this.sessions) {
      if (session.dirty) this.sessions.set(id, {
        ...session,
        draftXml: session.savedXml,
        document: this.adapters.hydrate(
          session.key.libraryType,
          session.savedXml,
          session.objectType,
          session.document.kind === 'unsupported' ? 'unsupported' : 'supported',
        ),
        dirty: false,
        status: 'ready',
      });
    }
    return { mayContinue: true };
  }

  private requireSession(sessionId: string): InternalLibraryEditorSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Library editor session not found: ${sessionId}`);
    return session;
  }

  private toSnapshot(session: InternalLibraryEditorSession): LibraryEditorSessionSnapshot {
    const { draftXml: _draftXml, savedXml: _savedXml, ...snapshot } = session;
    return snapshot;
  }

  private remove(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    this.savedNames.delete(sessionId);
    this.byLogicalKey.delete(logicalKey(session.key));
  }
}
