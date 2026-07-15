import { createHash, randomUUID } from 'node:crypto';
import type {
  LibraryEditorConflictDecision,
  LibraryItemKey,
  LibraryType,
} from '../../shared/unified-library';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { Element } from '@blue/data';

export type LibraryEditorSessionStatus = 'ready' | 'conflict' | 'missing';

export interface LibraryEditorSessionSnapshot {
  readonly sessionId: string;
  readonly key: LibraryItemKey;
  readonly displayName: string;
  readonly objectType: string;
  readonly breadcrumb: readonly string[];
  readonly baseRevision: number | string;
  readonly draftXml: string;
  readonly savedXml: string;
  readonly dirty: boolean;
  readonly pinned: boolean;
  readonly status: LibraryEditorSessionStatus;
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
  private readonly sessions = new Map<string, LibraryEditorSessionSnapshot>();
  private readonly byLogicalKey = new Map<string, string>();

  private readonly savedNames = new Map<string, string>();

  constructor(
    private readonly repository: UnifiedLibraryRepositoryClient,
    private readonly projectAdapter: UnifiedLibraryProjectAdapter = new UnifiedLibraryProjectAdapter(() => null),
  ) {}

  async open(key: LibraryItemKey, pinned = false): Promise<LibraryEditorSessionSnapshot> {
    const existingId = this.byLogicalKey.get(logicalKey(key));
    if (existingId) return this.requireSession(existingId);
    for (const session of this.sessions.values()) {
      if (!session.dirty && !session.pinned) this.remove(session.sessionId);
    }
    const source = key.scope === 'user'
      ? null
      : this.projectAdapter.getEditorSource(key);
    if (key.scope !== 'user' && !source) throw new Error('Project library item not found');
    const node = key.scope === 'user' ? await this.repository.getNode(key.nodeId) : null;
    const payload = key.scope === 'user' ? await this.repository.getItemPayload(key.nodeId) : null;
    const session: LibraryEditorSessionSnapshot = {
      sessionId: randomUUID(),
      key,
      displayName: node?.displayName ?? source!.displayName,
      objectType: payload?.objectType ?? source!.objectType,
      breadcrumb: node ? await this.repository.getBreadcrumb(node.id) : source!.breadcrumb,
      baseRevision: node?.revision ?? source!.revision,
      draftXml: payload?.payloadXml ?? source!.payloadXml,
      savedXml: payload?.payloadXml ?? source!.payloadXml,
      dirty: false,
      pinned,
      status: 'ready',
    };
    this.sessions.set(session.sessionId, session);
    this.savedNames.set(session.sessionId, session.displayName);
    this.byLogicalKey.set(logicalKey(key), session.sessionId);
    return { ...session };
  }

  get(sessionId: string): LibraryEditorSessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  list(): LibraryEditorSessionSnapshot[] {
    return [...this.sessions.values()].map((session) => ({ ...session }));
  }

  patch(
    sessionId: string,
    patch: { readonly payloadXml?: string; readonly displayName?: string; readonly pinned?: boolean },
  ): LibraryEditorSessionSnapshot {
    const current = this.requireSession(sessionId);
    const draftXml = patch.payloadXml ?? current.draftXml;
    const next: LibraryEditorSessionSnapshot = {
      ...current,
      displayName: patch.displayName ?? current.displayName,
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
    return { ...next };
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
          return { status: 'missing', session: { ...missing } };
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
          dirty: false,
          status: 'ready' as const,
        };
        this.byLogicalKey.delete(logicalKey(current.key));
        this.byLogicalKey.set(logicalKey(saved.key), sessionId);
        this.sessions.set(sessionId, saved);
        this.savedNames.set(sessionId, saved.displayName);
        return { status: 'saved', session: { ...saved } };
      } catch (error) {
        if (!/conflict/i.test(error instanceof Error ? error.message : '')) throw error;
        const conflict = { ...current, status: 'conflict' as const };
        this.sessions.set(sessionId, conflict);
        return { status: 'conflict', session: { ...conflict } };
      }
    }
    try {
      Element.parse(current.draftXml);
      const node = await this.repository.getNode(current.key.nodeId);
      if (node.revision !== current.baseRevision) {
        const conflict = { ...current, status: 'conflict' as const };
        this.sessions.set(sessionId, conflict);
        return { status: 'conflict', session: { ...conflict } };
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
      return { status: 'saved', session: { ...saved } };
    } catch (error) {
      if (!/not found/i.test(error instanceof Error ? error.message : '')) throw error;
      const missing = { ...current, status: 'missing' as const };
      this.sessions.set(sessionId, missing);
      return { status: 'missing', session: { ...missing } };
    }
  }

  async resolveConflict(
    sessionId: string,
    decision: LibraryEditorConflictDecision,
  ): Promise<LibraryEditorSessionSnapshot> {
    const current = this.requireSession(sessionId);
    if (current.status !== 'conflict') throw new Error('Editor session is not in conflict');
    if (decision === 'cancel') return { ...current };
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
        return { ...missing };
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
        return { ...missing };
      }
      const reverted = {
        ...current,
        displayName: source.displayName,
        objectType: source.objectType,
        breadcrumb: source.breadcrumb,
        baseRevision: source.revision,
        draftXml: source.payloadXml,
        savedXml: source.payloadXml,
        dirty: false,
        status: 'ready' as const,
      };
      this.sessions.set(sessionId, reverted);
      this.savedNames.set(sessionId, reverted.displayName);
      return { ...reverted };
    }
    const node = await this.repository.getNode(current.key.nodeId);
    const payload = await this.repository.getItemPayload(node.id);
    const reverted = {
      ...current,
      displayName: node.displayName,
      breadcrumb: await this.repository.getBreadcrumb(node.id),
      baseRevision: node.revision,
      draftXml: payload.payloadXml,
      savedXml: payload.payloadXml,
      dirty: false,
      status: 'ready' as const,
    };
    this.sessions.set(sessionId, reverted);
    this.savedNames.set(sessionId, reverted.displayName);
    return { ...reverted };
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
        ...session, draftXml: session.savedXml, dirty: false, status: 'ready',
      });
    }
    return { mayContinue: true };
  }

  private requireSession(sessionId: string): LibraryEditorSessionSnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Library editor session not found: ${sessionId}`);
    return session;
  }

  private remove(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    this.savedNames.delete(sessionId);
    this.byLogicalKey.delete(logicalKey(session.key));
  }
}
