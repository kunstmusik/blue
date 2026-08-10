// Code Repository service.
//
// The main-process canonical owner. Owns the repository client, migration, the
// durable snapshot, change notifications, and failure/recovery state. Mirrors
// the unified-library service lifecycle but is materially simpler: no project
// adapter, no editor sessions, no drag sessions — just snapshot, mutations,
// migration, import/export, and change events.

import { EventEmitter } from 'node:events';
import type { CodeRepositoryNode } from '@blue/data';
import { createEmptyCodeRepositoryDocument, parseCodeRepositoryXml, serializeCodeRepositoryXml } from '@blue/data';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CodeRepositoryClient } from './repository-client';
import type { CodeRepositorySnapshotData } from './repository';
import {
  CodeRepositoryMigrationStateStore,
  shouldRunAutomaticMigration,
  type CodeRepositoryMigrationStateDocument,
} from './migration-state-store';
import { classifyCodeRepositoryFailure } from './recovery';
import type {
  CodeRepositoryChangedEvent,
  CodeRepositoryDiagnostic,
  CodeRepositoryMigrationStatus,
  CodeRepositorySnapshot,
  CodeRepositoryStatus,
} from '../../shared/code-repository';

export interface CodeRepositoryServiceOptions {
  /** Directory scanned for the legacy `codeRepository.xml` (~/.blue). */
  readonly legacyConfigurationDirectory?: string;
  /** Path to the migration/recovery state JSON sidecar. */
  readonly migrationStatePath?: string;
  /** Override the client factory for testing. */
  readonly clientFactory?: (databasePath: string) => CodeRepositoryClient;
}

export type CodeRepositoryServicePhase = 'initializing' | 'migrating' | 'ready' | 'failed' | 'stopped';

interface CodeRepositoryServiceSnapshot {
  readonly phase: CodeRepositoryServicePhase;
  readonly snapshot: CodeRepositorySnapshot | null;
  readonly failure: {
    kind: string;
    message: string;
    retryable: boolean;
  } | null;
}

function toPublicSnapshot(data: CodeRepositorySnapshotData): CodeRepositorySnapshot {
  return {
    root: data.root,
    contentRevision: data.contentRevision,
    initialized: data.initialized,
  };
}

export class CodeRepositoryService {
  private client: CodeRepositoryClient | null = null;
  private phase: CodeRepositoryServicePhase = 'initializing';
  private snapshot: CodeRepositorySnapshot | null = null;
  private failure: CodeRepositoryServiceSnapshot['failure'] = null;
  private migrationStatus: CodeRepositoryMigrationStatus = 'not-started';
  private migrationDiagnostic: CodeRepositoryDiagnostic | undefined;
  private readonly stateStore: CodeRepositoryMigrationStateStore | null;
  private readonly emitter = new EventEmitter();

  constructor(
    private readonly databasePath: string,
    private readonly options: CodeRepositoryServiceOptions = {},
  ) {
    this.stateStore = options.migrationStatePath
      ? new CodeRepositoryMigrationStateStore(options.migrationStatePath)
      : null;
  }

  // Lifecycle ---------------------------------------------------------

  async start(): Promise<void> {
    this.setPhase('initializing');
    this.failure = null;
    this.migrationStatus = 'not-started';
    this.migrationDiagnostic = undefined;
    const factory = this.options.clientFactory ?? CodeRepositoryClient.open;
    try {
      this.client = factory(this.databasePath);
      if (this.stateStore && this.options.legacyConfigurationDirectory) {
        this.setPhase('migrating');
        await this.runAutomaticMigration();
      }
      await this.refreshSnapshot();
      this.setPhase('ready');
    } catch (error) {
      const failure = toFailure(classifyCodeRepositoryFailure(error));
      this.failure = failure;
      this.migrationStatus = 'failed';
      this.migrationDiagnostic = {
        code: 'storage-unavailable',
        message: publicStorageFailureMessage(failure?.kind),
      };
      await this.client?.close().catch(() => undefined);
      this.client = null;
      this.setPhase('failed');
    }
  }

  async stop(): Promise<void> {
    await this.client?.close().catch(() => undefined);
    this.client = null;
    this.snapshot = null;
    this.setPhase('stopped');
    this.emitter.removeAllListeners();
  }

  /** Reopen unavailable storage or retry a failed first-run migration. */
  async retry(): Promise<CodeRepositoryStatus> {
    if (this.phase === 'failed') {
      await this.client?.close().catch(() => undefined);
      this.client = null;
      await this.start();
      if (this.getStatus().available) this.publishChanged('recovery');
      return this.getStatus();
    }
    if (this.phase === 'ready' && this.migrationStatus === 'failed') {
      await this.runAutomaticMigration(true);
      await this.refreshSnapshot();
      this.publishChanged('recovery');
    }
    return this.getStatus();
  }

  // Snapshot / status ------------------------------------------------

  getSnapshot(): CodeRepositorySnapshot | null {
    return this.snapshot;
  }

  getStatus(): CodeRepositoryStatus {
    return {
      available: this.phase === 'ready',
      migrationStatus: this.migrationStatus,
      ...(this.migrationDiagnostic ? { diagnostic: this.migrationDiagnostic } : {}),
    };
  }

  getServiceSnapshot(): CodeRepositoryServiceSnapshot {
    return {
      phase: this.phase,
      snapshot: this.snapshot,
      failure: this.failure,
    };
  }

  onChanged(listener: (event: CodeRepositoryChangedEvent) => void): () => void {
    this.emitter.on('changed', listener);
    return () => this.emitter.off('changed', listener);
  }

  // Mutations --------------------------------------------------------

  private requireClient(): CodeRepositoryClient {
    if (!this.client || this.phase !== 'ready') {
      throw new ServiceError('storage-unavailable', 'Code Repository is not available', false);
    }
    return this.client;
  }

  async commitDraft(expectedRevision: number, root: CodeRepositoryNode): Promise<CodeRepositorySnapshot> {
    const client = this.requireClient();
    try {
      const data = await client.commitDraft(expectedRevision, root);
      this.snapshot = toPublicSnapshot(data);
      this.publishChanged('commit');
      return this.snapshot;
    } catch (error) {
      throw await this.mapMutationError(error, client);
    }
  }

  async createGroup(parentId: string, name: string, expectedRevision: number): Promise<CodeRepositorySnapshot> {
    return this.runMutation((client) => client.createGroup(parentId, name, expectedRevision));
  }

  async createSnippet(
    parentId: string,
    name: string,
    code: string,
    expectedRevision: number,
  ): Promise<CodeRepositorySnapshot> {
    return this.runMutation((client) => client.createSnippet(parentId, name, code, expectedRevision));
  }

  async moveNode(
    nodeId: string,
    parentId: string,
    order: number,
    expectedRevision: number,
  ): Promise<CodeRepositorySnapshot> {
    return this.runMutation((client) => client.moveNode(nodeId, parentId, order, expectedRevision));
  }

  async updateNode(
    nodeId: string,
    patch: { readonly name?: string; readonly code?: string },
    expectedRevision: number,
  ): Promise<CodeRepositorySnapshot> {
    return this.runMutation((client) => client.updateNode(nodeId, patch, expectedRevision));
  }

  async deleteNode(nodeId: string, expectedRevision: number): Promise<CodeRepositorySnapshot> {
    return this.runMutation((client) => client.deleteNode(nodeId, expectedRevision));
  }

  private async runMutation(
    operation: (client: CodeRepositoryClient) => Promise<CodeRepositorySnapshotData>,
  ): Promise<CodeRepositorySnapshot> {
    const client = this.requireClient();
    try {
      const data = await operation(client);
      this.snapshot = toPublicSnapshot(data);
      this.publishChanged('commit');
      return this.snapshot;
    } catch (error) {
      throw await this.mapMutationError(error, client);
    }
  }

  // Import / export --------------------------------------------------

  async importXml(
    xml: string,
    sourceLabel: string,
    expectedRevision: number,
  ): Promise<{
    snapshot: CodeRepositorySnapshot;
    importedNodeCount: number;
    sourceHash: string;
  }> {
    const hash = sha256(xml);
    let parsed;
    try {
      parsed = parseCodeRepositoryXml(xml);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid Code Repository XML';
      await this.client
        ?.recordImport({
          id: randomUUID(),
          sourcePath: sourceLabel,
          sourceHash: hash,
          sourceKind: 'explicit',
          status: 'failed',
          nodeCount: null,
          diagnostics: message,
        })
        .catch(() => undefined);
      this.finishMigrationAttempt({
        state: 'failed',
        sourcePath: sourceLabel,
        sourceHash: hash,
        sourceKind: 'explicit',
        error: message,
      });
      this.migrationStatus = 'failed';
      this.migrationDiagnostic = {
        code: 'invalid-legacy-xml',
        message,
        sourceLabel: publicSourceLabel(sourceLabel),
      };
      throw new ServiceError('invalid-legacy-xml', message, false);
    }
    const client = this.requireClient();
    try {
      // Replace the tree atomically by committing the parsed root.
      const data = await client.importTree(expectedRevision, parsed.root, {
        id: randomUUID(),
        sourcePath: sourceLabel,
        sourceHash: hash,
        sourceKind: 'explicit',
        status: 'succeeded',
        nodeCount: parsed.groupCount + parsed.snippetCount,
        diagnostics: null,
      });
      this.finishMigrationAttempt({
        state: 'succeeded',
        sourcePath: sourceLabel,
        sourceHash: hash,
        sourceKind: 'explicit',
      });
      this.migrationStatus = 'succeeded';
      this.migrationDiagnostic = undefined;
      this.snapshot = toPublicSnapshot(data);
      this.publishChanged('import');
      return {
        snapshot: this.snapshot,
        importedNodeCount: parsed.groupCount + parsed.snippetCount,
        sourceHash: hash,
      };
    } catch (error) {
      throw await this.mapMutationError(error, client);
    }
  }

  /** Read a user-selected source in main, then perform the same atomic import. */
  async importFile(
    sourcePath: string,
    expectedRevision: number,
  ): Promise<{
    snapshot: CodeRepositorySnapshot;
    importedNodeCount: number;
    sourceHash: string;
  }> {
    let xml: string;
    try {
      xml = fs.readFileSync(sourcePath, 'utf8');
    } catch {
      const message = 'Unable to read the selected Code Repository XML source.';
      this.finishMigrationAttempt({
        state: 'failed',
        sourcePath,
        sourceKind: 'explicit',
        error: message,
      });
      this.migrationStatus = 'failed';
      this.migrationDiagnostic = {
        code: 'source-unreadable',
        message,
        sourceLabel: publicSourceLabel(sourcePath),
      };
      throw new ServiceError('source-unreadable', message, true);
    }
    if (this.phase === 'failed') {
      return this.recoverFromXml(xml, sourcePath);
    }
    return this.importXml(xml, sourcePath, expectedRevision);
  }

  exportXml(): { xml: string; format: 'java-blue-code-repository-v1' } {
    if (!this.snapshot) {
      throw new ServiceError('not-initialized', 'Code Repository is not initialized', false);
    }
    try {
      return {
        xml: serializeCodeRepositoryXml(this.snapshot.root),
        format: 'java-blue-code-repository-v1',
      };
    } catch (error) {
      throw new ServiceError('export-failed', error instanceof Error ? error.message : 'Export failed', false);
    }
  }

  // Automatic migration ---------------------------------------------

  private async runAutomaticMigration(force = false): Promise<void> {
    if (!this.stateStore) return;
    const state = this.stateStore.load();
    if (!force && !shouldRunAutomaticMigration(state)) {
      if (state.attemptStatus === 'interrupted') {
        this.migrationStatus = 'failed';
        this.migrationDiagnostic = {
          code: 'migration-interrupted',
          message: 'Code Repository migration was interrupted. Retry to continue.',
          ...(state.sourcePath ? { sourceLabel: publicSourceLabel(state.sourcePath) } : {}),
        };
        return;
      }
      this.migrationStatus = toMigrationStatus(state.migrationState);
      if (state.lastError) {
        this.migrationDiagnostic = {
          code: 'invalid-legacy-xml',
          message: state.lastError,
          ...(state.sourcePath ? { sourceLabel: publicSourceLabel(state.sourcePath) } : {}),
        };
      }
      return;
    }
    this.beginMigrationAttempt();
    const legacyPath = path.join(this.options.legacyConfigurationDirectory ?? '', 'codeRepository.xml');
    let attemptedSourcePath: string | null = null;
    try {
      const current = await this.client!.getSnapshot();
      if (fs.existsSync(legacyPath)) {
        attemptedSourcePath = legacyPath;
        let xml: string;
        try {
          xml = fs.readFileSync(legacyPath, 'utf8');
        } catch {
          throw new ServiceError('source-unreadable', 'Unable to read the legacy Code Repository source.', true);
        }
        const hash = sha256(xml);
        if (await this.client!.hasImportedHash(hash)) {
          this.snapshot = toPublicSnapshot(await this.client!.getSnapshot());
          this.finishMigrationAttempt({
            state: 'succeeded',
            sourcePath: legacyPath,
            sourceHash: hash,
            sourceKind: 'automatic',
          });
          this.migrationStatus = 'succeeded';
          this.migrationDiagnostic = undefined;
          return;
        }
        if (current.initialized) {
          this.snapshot = toPublicSnapshot(current);
          this.finishMigrationAttempt({ state: 'skipped' });
          this.migrationStatus = 'skipped';
          return;
        }
        const parsed = parseCodeRepositoryXml(xml);
        const data = await this.client!.importTree(current.contentRevision, parsed.root, {
          id: randomUUID(),
          sourcePath: legacyPath,
          sourceHash: hash,
          sourceKind: 'automatic',
          status: 'succeeded',
          nodeCount: parsed.groupCount + parsed.snippetCount,
          diagnostics: null,
        });
        this.finishMigrationAttempt({
          state: 'succeeded',
          sourcePath: legacyPath,
          sourceHash: hash,
          sourceKind: 'automatic',
        });
        this.snapshot = toPublicSnapshot(data);
        this.migrationStatus = 'succeeded';
        this.migrationDiagnostic = undefined;
        return;
      }
      if (current.initialized) {
        this.snapshot = toPublicSnapshot(current);
        this.finishMigrationAttempt({ state: 'skipped' });
        this.migrationStatus = 'skipped';
        return;
      }
      // No legacy source: initialize the protected root programmatically. A
      // fresh TS Blue installation intentionally starts with an empty
      // repository; Java-compatible XML remains available for legacy and
      // explicit imports, not as a packaged first-run template.
      const empty = createEmptyCodeRepositoryDocument();
      const data = await this.client!.commitDraft(current.contentRevision, empty.root);
      this.finishMigrationAttempt({ state: 'skipped' });
      this.snapshot = toPublicSnapshot(data);
      this.migrationStatus = 'skipped';
      this.migrationDiagnostic = undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = error instanceof ServiceError ? error.code : 'invalid-legacy-xml';
      this.finishMigrationAttempt({
        state: 'failed',
        sourcePath: attemptedSourcePath,
        error: message,
      });
      this.migrationStatus = 'failed';
      this.migrationDiagnostic = {
        code,
        message,
        ...(attemptedSourcePath ? { sourceLabel: publicSourceLabel(attemptedSourcePath) } : {}),
      };
      // Migration failure does not block the rest of startup; the repository
      // remains usable with whatever tree loaded (possibly empty).
    }
  }

  private async refreshSnapshot(): Promise<void> {
    if (!this.client) return;
    const data = await this.client.getSnapshot();
    this.snapshot = toPublicSnapshot(data);
  }

  /**
   * Recover unavailable storage from an explicitly selected, fully validated
   * XML source. The unusable database and SQLite sidecars are preserved before
   * a fresh database is created; a failed recovery restores them.
   */
  private async recoverFromXml(
    xml: string,
    sourcePath: string,
  ): Promise<{
    snapshot: CodeRepositorySnapshot;
    importedNodeCount: number;
    sourceHash: string;
  }> {
    const hash = sha256(xml);
    let parsed;
    try {
      parsed = parseCodeRepositoryXml(xml);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid Code Repository XML';
      this.migrationStatus = 'failed';
      this.migrationDiagnostic = {
        code: 'invalid-legacy-xml',
        message,
        sourceLabel: publicSourceLabel(sourcePath),
      };
      throw new ServiceError('invalid-legacy-xml', message, false);
    }

    const preservedFiles = preserveDatabaseFiles(this.databasePath);
    const factory = this.options.clientFactory ?? CodeRepositoryClient.open;
    let recoveryClient: CodeRepositoryClient | null = null;
    try {
      this.setPhase('initializing');
      recoveryClient = factory(this.databasePath);
      this.client = recoveryClient;
      const current = await recoveryClient.getSnapshot();
      const data = await recoveryClient.importTree(current.contentRevision, parsed.root, {
        id: randomUUID(),
        sourcePath,
        sourceHash: hash,
        sourceKind: 'explicit',
        status: 'succeeded',
        nodeCount: parsed.groupCount + parsed.snippetCount,
        diagnostics: null,
      });
      this.finishMigrationAttempt({
        state: 'succeeded',
        sourcePath,
        sourceHash: hash,
        sourceKind: 'explicit',
      });
      this.snapshot = toPublicSnapshot(data);
      this.failure = null;
      this.migrationStatus = 'succeeded';
      this.migrationDiagnostic = undefined;
      this.setPhase('ready');
      this.publishChanged('recovery');
      return {
        snapshot: this.snapshot,
        importedNodeCount: parsed.groupCount + parsed.snippetCount,
        sourceHash: hash,
      };
    } catch (error) {
      await recoveryClient?.close().catch(() => undefined);
      this.client = null;
      this.snapshot = null;
      let recoveryError = error;
      try {
        restoreDatabaseFiles(this.databasePath, preservedFiles);
      } catch (restoreError) {
        recoveryError = restoreError;
      }
      const classified = classifyCodeRepositoryFailure(recoveryError);
      const publicMessage = publicStorageFailureMessage(classified.kind);
      this.failure = toFailure(classified);
      this.migrationStatus = 'failed';
      this.migrationDiagnostic = {
        code: 'storage-unavailable',
        message: publicMessage,
      };
      this.setPhase('failed');
      throw new ServiceError('storage-unavailable', publicMessage, classified.retryable);
    }
  }

  private beginMigrationAttempt(): void {
    try {
      this.stateStore?.beginAttempt();
    } catch {
      // SQLite provenance still prevents duplicate imports if the optional
      // sidecar cannot be updated.
    }
  }

  private finishMigrationAttempt(input: Parameters<CodeRepositoryMigrationStateStore['finishAttempt']>[0]): void {
    try {
      this.stateStore?.finishAttempt(input);
    } catch {
      // Keep repository data usable; successful import provenance is committed
      // atomically in SQLite and remains the canonical idempotency record.
    }
  }

  private async mapMutationError(error: unknown, client: CodeRepositoryClient): Promise<ServiceError> {
    if (error instanceof Error && error.message.includes('revision-conflict')) {
      try {
        this.snapshot = toPublicSnapshot(await client.getSnapshot());
      } catch {
        // Keep the last known snapshot if storage cannot provide the newer one.
      }
    }
    const mapped = mapMutationError(error, this.snapshot);
    if (mapped.code === 'storage-unavailable') {
      const classified = classifyCodeRepositoryFailure(error);
      await client.close().catch(() => undefined);
      if (this.client === client) this.client = null;
      this.snapshot = null;
      this.failure = toFailure(classified);
      this.migrationDiagnostic = {
        code: 'storage-unavailable',
        message: publicStorageFailureMessage(classified.kind),
      };
      this.setPhase('failed');
    }
    return mapped;
  }

  private publishChanged(reason: CodeRepositoryChangedEvent['reason']): void {
    if (!this.snapshot) return;
    this.emitter.emit('changed', {
      contentRevision: this.snapshot.contentRevision,
      reason,
    } satisfies CodeRepositoryChangedEvent);
  }

  private setPhase(phase: CodeRepositoryServicePhase): void {
    this.phase = phase;
  }
}

// Errors -------------------------------------------------------------

export class ServiceError extends Error {
  constructor(
    readonly code:
      | 'storage-unavailable'
      | 'invalid-tree'
      | 'revision-conflict'
      | 'invalid-legacy-xml'
      | 'source-unreadable'
      | 'export-failed'
      | 'not-initialized',
    message: string,
    readonly retryable: boolean,
    readonly currentSnapshot?: CodeRepositorySnapshot,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

function mapMutationError(error: unknown, currentSnapshot: CodeRepositorySnapshot | null): ServiceError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('revision-conflict')) {
    return new ServiceError(
      'revision-conflict',
      'The repository was modified in another window.',
      true,
      currentSnapshot ?? undefined,
    );
  }
  if (message.startsWith('invalid-tree')) {
    return new ServiceError('invalid-tree', message, false);
  }
  return new ServiceError('storage-unavailable', 'Code Repository storage is unavailable.', true);
}

function toMigrationStatus(
  state: CodeRepositoryMigrationStateDocument['migrationState'],
): CodeRepositoryMigrationStatus {
  return state === 'not-started' ? 'not-started' : state;
}

function toFailure(snapshot: {
  kind: string;
  message: string;
  retryable: boolean;
}): CodeRepositoryServiceSnapshot['failure'] {
  return {
    kind: snapshot.kind,
    message: snapshot.message,
    retryable: snapshot.retryable,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

interface PreservedDatabaseFile {
  readonly originalPath: string;
  readonly preservedPath: string;
}

function databaseFiles(databasePath: string): string[] {
  if (databasePath === ':memory:') return [];
  return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];
}

function preserveDatabaseFiles(databasePath: string): PreservedDatabaseFile[] {
  const suffix = `.failed-${Date.now()}-${randomUUID()}`;
  const preserved: PreservedDatabaseFile[] = [];
  try {
    for (const originalPath of databaseFiles(databasePath)) {
      if (!fs.existsSync(originalPath)) continue;
      const preservedPath = `${originalPath}${suffix}`;
      fs.renameSync(originalPath, preservedPath);
      preserved.push({ originalPath, preservedPath });
    }
    return preserved;
  } catch (error) {
    for (const file of preserved.reverse()) {
      if (fs.existsSync(file.preservedPath) && !fs.existsSync(file.originalPath)) {
        fs.renameSync(file.preservedPath, file.originalPath);
      }
    }
    throw error;
  }
}

function restoreDatabaseFiles(databasePath: string, preserved: readonly PreservedDatabaseFile[]): void {
  for (const currentPath of databaseFiles(databasePath)) {
    if (fs.existsSync(currentPath)) fs.rmSync(currentPath, { force: true });
  }
  for (const file of preserved) {
    if (fs.existsSync(file.preservedPath) && !fs.existsSync(file.originalPath)) {
      fs.renameSync(file.preservedPath, file.originalPath);
    }
  }
}

function publicSourceLabel(sourcePath: string): string {
  const basename = sourcePath.split(/[\\/]/).at(-1) ?? '';
  return basename || 'Code Repository XML';
}

function publicStorageFailureMessage(kind: string | undefined): string {
  switch (kind) {
    case 'version':
      return 'The Code Repository database was created by a newer version of Blue.';
    case 'integrity':
      return 'The Code Repository database failed its integrity check.';
    case 'lock':
      return 'The Code Repository database is locked by another process.';
    case 'worker':
      return 'The Code Repository background service stopped unexpectedly.';
    default:
      return 'Code Repository storage is unavailable.';
  }
}
