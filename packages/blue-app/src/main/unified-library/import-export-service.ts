import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  LEGACY_LIBRARY_FORMATS,
  exportLegacyLibraryDocument,
  parseLegacyLibraryDocument,
  type LegacyLibraryDocumentPlan,
  type LegacyLibraryFolderPlan,
  type LegacyLibraryTreeNode,
  type LibraryType,
} from '@blue/data';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import {
  LibraryMigrationStateStore,
  shouldRunAutomaticMigration,
} from './migration-state-store';

export interface AutomaticMigrationSourceSummary {
  readonly libraryType: LibraryType;
  readonly sourcePath: string;
  readonly status: 'imported' | 'absent' | 'failed';
  readonly folderCount: number;
  readonly itemCount: number;
  readonly unsupportedCount: number;
  readonly error?: string;
  readonly backupAvailable: boolean;
}

export interface AutomaticMigrationReport {
  readonly batchId: string | null;
  readonly status: 'complete' | 'partial' | 'failed' | 'skipped';
  readonly message: string;
  readonly sources: readonly AutomaticMigrationSourceSummary[];
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface ManualImportSourcePreview {
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly libraryType: LibraryType | null;
  readonly folderCount: number;
  readonly itemCount: number;
  readonly unsupportedCount: number;
  readonly exactDuplicateCount: number;
  readonly aliasConflictCount: number;
  readonly ambiguousFolderCount: number;
  readonly error?: string;
}

export interface ManualImportPreview {
  readonly previewToken: string;
  readonly expiresAt: number;
  readonly sources: readonly ManualImportSourcePreview[];
}

export interface ManualImportResult {
  readonly batchId: string;
  readonly status: 'completed' | 'partial' | 'failed';
  readonly createdNodeCount: number;
  readonly exactDuplicateCount: number;
  readonly aliasCount: number;
}

interface PendingManualPreview {
  readonly expiresAt: number;
  readonly sources: readonly {
    readonly preview: ManualImportSourcePreview;
    readonly plan?: LegacyLibraryDocumentPlan;
  }[];
}

export interface AtomicExportOutput {
  readonly targetPath: string;
  readonly contents: string;
}

export function commitAtomicExport(
  outputs: readonly AtomicExportOutput[],
  options: { readonly failAfterPromotions?: number } = {},
): void {
  if (outputs.length === 0) return;
  const transactionId = randomUUID();
  const prepared = outputs.map((output) => ({
    ...output,
    stagedPath: `${output.targetPath}.${transactionId}.tmp`,
    backupPath: `${output.targetPath}.${transactionId}.bak`,
    existed: fs.existsSync(output.targetPath),
  }));
  const journalPath = path.join(path.dirname(outputs[0]!.targetPath), `.blue-library-export-${transactionId}.json`);
  const promoted: typeof prepared = [];
  const backedUp: typeof prepared = [];
  try {
    for (const output of prepared) {
      fs.mkdirSync(path.dirname(output.targetPath), { recursive: true });
      const descriptor = fs.openSync(output.stagedPath, 'w', 0o600);
      try {
        fs.writeFileSync(descriptor, output.contents, 'utf8');
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
    }
    fs.writeFileSync(journalPath, JSON.stringify({ transactionId, outputs: prepared.map(({ targetPath, stagedPath, backupPath, existed }) => ({ targetPath, stagedPath, backupPath, existed })) }), 'utf8');
    for (const output of prepared) {
      if (output.existed) {
        fs.renameSync(output.targetPath, output.backupPath);
        backedUp.push(output);
      }
    }
    for (const output of prepared) {
      fs.renameSync(output.stagedPath, output.targetPath);
      promoted.push(output);
      if (options.failAfterPromotions === promoted.length) throw new Error('Injected export promotion failure');
    }
    for (const output of backedUp) fs.unlinkSync(output.backupPath);
    fs.unlinkSync(journalPath);
  } catch (error) {
    for (const output of promoted.reverse()) {
      if (fs.existsSync(output.targetPath)) fs.unlinkSync(output.targetPath);
    }
    for (const output of backedUp.reverse()) {
      if (fs.existsSync(output.backupPath)) fs.renameSync(output.backupPath, output.targetPath);
    }
    for (const output of prepared) {
      if (fs.existsSync(output.stagedPath)) fs.unlinkSync(output.stagedPath);
      if (fs.existsSync(output.backupPath) && !fs.existsSync(output.targetPath)) fs.renameSync(output.backupPath, output.targetPath);
    }
    if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
    throw error;
  }
}

function hashBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

export class UnifiedLibraryImportExportService {
  private operationActive = false;
  private readonly manualPreviews = new Map<string, PendingManualPreview>();

  constructor(private readonly repository: UnifiedLibraryRepositoryClient) {}

  async previewManualImport(sourcePaths: readonly string[]): Promise<ManualImportPreview> {
    if (this.operationActive) throw new Error('A library interchange operation is already in progress');
    const sources: { preview: ManualImportSourcePreview; plan?: LegacyLibraryDocumentPlan }[] = [];
    for (const sourcePath of sourcePaths) {
      const bytes = fs.readFileSync(sourcePath);
      const sourceHash = hashBytes(bytes);
      try {
        const plan = parseLegacyLibraryDocument(bytes.toString('utf8'));
        const conflicts = await this.analyzeManualPlan(plan);
        sources.push({
          plan,
          preview: {
            sourcePath,
            sourceHash,
            libraryType: plan.libraryType,
            folderCount: plan.folderCount,
            itemCount: plan.itemCount,
            unsupportedCount: plan.unsupportedCount,
            ...conflicts,
          },
        });
      } catch (error) {
        sources.push({ preview: {
          sourcePath,
          sourceHash,
          libraryType: null,
          folderCount: 0,
          itemCount: 0,
          unsupportedCount: 0,
          exactDuplicateCount: 0,
          aliasConflictCount: 0,
          ambiguousFolderCount: 0,
          error: safeMessage(error),
        } });
      }
    }
    const previewToken = randomUUID();
    const expiresAt = Date.now() + 5 * 60_000;
    this.manualPreviews.set(previewToken, { expiresAt, sources });
    return { previewToken, expiresAt, sources: sources.map((source) => source.preview) };
  }

  async executeManualImport(previewToken: string): Promise<ManualImportResult> {
    const pending = this.manualPreviews.get(previewToken);
    this.manualPreviews.delete(previewToken);
    if (!pending || pending.expiresAt < Date.now()) throw new Error('Import preview expired');
    if (this.operationActive) throw new Error('A library interchange operation is already in progress');
    this.operationActive = true;
    const batchId = randomUUID();
    const startedAt = new Date().toISOString();
    try {
      for (const source of pending.sources) {
        if (hashBytes(fs.readFileSync(source.preview.sourcePath)) !== source.preview.sourceHash) {
          throw new Error(`Import source changed after preview: ${source.preview.sourcePath}`);
        }
      }
      await this.repository.startImportBatch({ id: batchId, mode: 'manualXmlFiles', sourceCount: pending.sources.length, startedAt });
      let createdNodeCount = 0;
      let exactDuplicateCount = 0;
      let aliasCount = 0;
      let successfulSources = 0;
      let failedSources = 0;
      for (const source of pending.sources) {
        const sourceId = randomUUID();
        if (!source.plan) {
          failedSources += 1;
          await this.repository.recordImportSourceFailure({
            batchId, sourceId, sourcePath: source.preview.sourcePath, sourceKind: 'selectedFile',
            sourceRawHash: source.preview.sourceHash, diagnostic: source.preview.error ?? 'Unrecognized source',
          });
          continue;
        }
        try {
          const result = await this.repository.importLegacyDocument({
            batchId, sourceId, sourcePath: source.preview.sourcePath, sourceKind: 'selectedFile',
            plan: source.plan, conflictPolicy: 'merge',
          });
          createdNodeCount += result.createdNodeIds.length;
          exactDuplicateCount += result.exactDuplicateCount;
          aliasCount += result.aliasCount;
          successfulSources += 1;
        } catch (error) {
          failedSources += 1;
          await this.repository.recordImportSourceFailure({
            batchId, sourceId, sourcePath: source.preview.sourcePath, sourceKind: 'selectedFile',
            libraryType: source.plan.libraryType, sourceRawHash: source.preview.sourceHash,
            diagnostic: safeMessage(error),
          });
        }
      }
      const status: ManualImportResult['status'] = successfulSources > 0
        ? failedSources > 0 ? 'partial' : 'completed'
        : 'failed';
      await this.repository.finishImportBatch({
        batchId,
        status,
        completedAt: new Date().toISOString(),
        counts: { createdNodeCount, exactDuplicateCount, aliasCount, successfulSources, failedSources },
        report: { previewToken },
      });
      return { batchId, status, createdNodeCount, exactDuplicateCount, aliasCount };
    } finally {
      this.operationActive = false;
    }
  }

  async undoManualImport(batchId: string): Promise<readonly string[]> {
    if (this.operationActive) throw new Error('A library interchange operation is already in progress');
    this.operationActive = true;
    try {
      return (await this.repository.undoImportBatch(batchId)).removedNodeIds;
    } finally { this.operationActive = false; }
  }

  async exportCurrent(libraryType: LibraryType, targetPath: string): Promise<void> {
    const plan = await this.buildExportPlan(libraryType);
    const contents = exportLegacyLibraryDocument(plan);
    parseLegacyLibraryDocument(contents);
    commitAtomicExport([{ targetPath, contents }]);
  }

  async exportAll(destinationDirectory: string): Promise<void> {
    if (this.operationActive) throw new Error('A library interchange operation is already in progress');
    this.operationActive = true;
    try {
      const outputs: AtomicExportOutput[] = [];
      for (const descriptor of Object.values(LEGACY_LIBRARY_FORMATS)) {
        const contents = exportLegacyLibraryDocument(await this.buildExportPlan(descriptor.libraryType));
        parseLegacyLibraryDocument(contents);
        outputs.push({ targetPath: path.join(destinationDirectory, descriptor.fileName), contents });
      }
      commitAtomicExport(outputs);
    } finally { this.operationActive = false; }
  }

  async runAutomaticMigration(
    configurationDirectory: string,
    stateStore: LibraryMigrationStateStore,
  ): Promise<AutomaticMigrationReport> {
    if (this.operationActive) throw new Error('A library interchange operation is already in progress');
    this.operationActive = true;
    const startedAt = new Date().toISOString();
    try {
      const snapshot = await this.repository.getSnapshot();
      const itemCount = Object.values(snapshot.itemCounts).reduce((sum, count) => sum + count, 0);
      const hasUserContent = itemCount > 0 || snapshot.contentRevision > 0;
      const state = stateStore.load();
      if (hasUserContent && state.legacyMigrationState === 'never') {
        stateStore.finishAttempt({ state: 'skipped', resultKind: 'noSources', batchId: null });
        return this.emptyReport(startedAt, 'skipped', 'Automatic migration was skipped because the user library is nonempty.');
      }
      if (!shouldRunAutomaticMigration(state, hasUserContent ? Math.max(1, itemCount) : 0)) {
        return this.emptyReport(startedAt, 'skipped', 'Automatic migration was already attempted; use manual import to retry.');
      }

      const descriptors = Object.values(LEGACY_LIBRARY_FORMATS);
      const available = descriptors.filter((descriptor) => (
        fs.existsSync(path.join(configurationDirectory, descriptor.fileName))
      ));
      stateStore.beginAttempt(startedAt);
      if (available.length === 0) {
        stateStore.finishAttempt({ state: 'skipped', resultKind: 'noSources', batchId: null });
        return {
          ...this.emptyReport(startedAt, 'skipped', 'No recognized Java Blue library files were found.'),
          sources: descriptors.map((descriptor) => ({
            libraryType: descriptor.libraryType,
            sourcePath: path.join(configurationDirectory, descriptor.fileName),
            status: 'absent' as const,
            folderCount: 0,
            itemCount: 0,
            unsupportedCount: 0,
            backupAvailable: fs.existsSync(path.join(configurationDirectory, `${descriptor.fileName}~`)),
          })),
        };
      }

      const batchId = randomUUID();
      await this.repository.startImportBatch({
        id: batchId,
        mode: 'automatic',
        sourceCount: available.length,
        startedAt,
      });
      const sources: AutomaticMigrationSourceSummary[] = [];
      for (const descriptor of descriptors) {
        const sourcePath = path.join(configurationDirectory, descriptor.fileName);
        const backupAvailable = fs.existsSync(`${sourcePath}~`);
        if (!fs.existsSync(sourcePath)) {
          sources.push({
            libraryType: descriptor.libraryType,
            sourcePath,
            status: 'absent',
            folderCount: 0,
            itemCount: 0,
            unsupportedCount: 0,
            backupAvailable,
          });
          continue;
        }
        const sourceId = randomUUID();
        let sourceHash: string | undefined;
        try {
          const bytes = fs.readFileSync(sourcePath);
          sourceHash = hashBytes(bytes);
          const plan = parseLegacyLibraryDocument(bytes.toString('utf8'));
          if (plan.libraryType !== descriptor.libraryType) throw new Error('Library type does not match the source filename');
          const result = await this.repository.importLegacyDocument({
            batchId,
            sourceId,
            sourcePath,
            sourceKind: 'primary',
            plan,
          });
          sources.push({
            libraryType: descriptor.libraryType,
            sourcePath,
            status: 'imported',
            folderCount: result.folderCount,
            itemCount: result.itemCount,
            unsupportedCount: result.unsupportedCount,
            backupAvailable,
          });
        } catch (error) {
          const message = safeMessage(error);
          await this.repository.recordImportSourceFailure({
            batchId,
            sourceId,
            sourcePath,
            sourceKind: 'primary',
            libraryType: descriptor.libraryType,
            sourceRawHash: sourceHash,
            status: backupAvailable ? 'backupOffered' : 'failed',
            diagnostic: message,
          });
          sources.push({
            libraryType: descriptor.libraryType,
            sourcePath,
            status: 'failed',
            folderCount: 0,
            itemCount: 0,
            unsupportedCount: 0,
            error: message,
            backupAvailable,
          });
        }
      }

      const imported = sources.filter((source) => source.status === 'imported');
      const failed = sources.filter((source) => source.status === 'failed');
      const status = imported.length > 0
        ? failed.length > 0 ? 'partial' as const : 'complete' as const
        : 'failed' as const;
      const completedAt = new Date().toISOString();
      const counts = {
        folders: imported.reduce((sum, source) => sum + source.folderCount, 0),
        items: imported.reduce((sum, source) => sum + source.itemCount, 0),
        unsupported: imported.reduce((sum, source) => sum + source.unsupportedCount, 0),
        importedSources: imported.length,
        failedSources: failed.length,
      };
      await this.repository.finishImportBatch({
        batchId,
        status: status === 'complete' ? 'completed' : status,
        completedAt,
        counts,
        report: { sources },
      });
      stateStore.finishAttempt({
        state: imported.length > 0 ? 'completed' : 'failed',
        resultKind: status === 'partial' ? 'partial' : status === 'complete' ? 'complete' : 'pipelineFailure',
        batchId,
        error: failed.length > 0 ? `${failed.length} source${failed.length === 1 ? '' : 's'} failed.` : null,
        at: completedAt,
      });
      return {
        batchId,
        status,
        message: status === 'complete'
          ? 'Java Blue libraries were imported successfully.'
          : status === 'partial'
            ? 'Some Java Blue libraries were imported; review the failed sources.'
            : 'No Java Blue library source could be imported.',
        sources,
        startedAt,
        completedAt,
      };
    } catch (error) {
      stateStore.finishAttempt({
        state: 'failed', resultKind: 'pipelineFailure', batchId: null, error: safeMessage(error),
      });
      throw error;
    } finally {
      this.operationActive = false;
    }
  }

  private emptyReport(
    startedAt: string,
    status: AutomaticMigrationReport['status'],
    message: string,
  ): AutomaticMigrationReport {
    return { batchId: null, status, message, sources: [], startedAt, completedAt: new Date().toISOString() };
  }

  private async analyzeManualPlan(plan: LegacyLibraryDocumentPlan): Promise<{
    exactDuplicateCount: number;
    aliasConflictCount: number;
    ambiguousFolderCount: number;
  }> {
    let exactDuplicateCount = 0;
    let aliasConflictCount = 0;
    let ambiguousFolderCount = 0;
    const root = await this.repository.getRoot(plan.libraryType);
    const walk = async (parentId: string, children: readonly LegacyLibraryTreeNode[]): Promise<void> => {
      const siblings = await this.repository.listChildren(parentId);
      for (const child of children) {
        if (child.kind === 'folder') {
          const matches = siblings.filter((candidate) => candidate.nodeKind === 'folder' && candidate.displayName === child.name);
          if (matches.length > 1) ambiguousFolderCount += 1;
          if (matches.length === 1) await walk(matches[0]!.id, child.children);
          continue;
        }
        let duplicate = false;
        let sameName = false;
        for (const sibling of siblings.filter((candidate) => candidate.nodeKind === 'item')) {
          if (sibling.displayName === child.displayName) sameName = true;
          if ((await this.repository.getItemPayload(sibling.id)).canonicalContentHash === child.payload.canonicalContentHash) duplicate = true;
        }
        if (duplicate) exactDuplicateCount += 1;
        else if (sameName) aliasConflictCount += 1;
      }
    };
    await walk(root.id, plan.root.children);
    return { exactDuplicateCount, aliasConflictCount, ambiguousFolderCount };
  }

  private async buildExportPlan(libraryType: LibraryType): Promise<LegacyLibraryDocumentPlan> {
    const descriptor = LEGACY_LIBRARY_FORMATS[libraryType];
    const rootNode = await this.repository.getRoot(libraryType);
    let folderCount = 0;
    let itemCount = 0;
    let unsupportedCount = 0;
    const buildChildren = async (parentId: string): Promise<LegacyLibraryTreeNode[]> => {
      const result: LegacyLibraryTreeNode[] = [];
      for (const node of await this.repository.listChildren(parentId)) {
        if (node.nodeKind === 'folder') {
          folderCount += 1;
          result.push({
            kind: 'folder', name: node.displayName, isRoot: false, sourceIndex: node.sortIndex,
            children: await buildChildren(node.id),
          });
        } else if (node.nodeKind === 'item') {
          const payload = await this.repository.getItemPayload(node.id);
          itemCount += 1;
          if (payload.supportStatus === 'unsupported') unsupportedCount += 1;
          result.push({
            kind: 'item', displayName: node.displayName, sourceIndex: node.sortIndex,
            payload: {
              embeddedName: payload.embeddedName,
              objectType: payload.objectType,
              supportStatus: payload.supportStatus,
              supportReasonCode: payload.supportReasonCode,
              supportMessage: payload.supportMessage,
              rawXml: payload.payloadXml,
              rawHash: payload.rawHash,
              canonicalContentHash: payload.canonicalContentHash,
              preview: payload.preview as never,
              dependencies: {
                itemOwned: Array.isArray(payload.dependencies.itemOwned) ? payload.dependencies.itemOwned.map(String) : [],
                unresolvedExternal: Array.isArray(payload.dependencies.unresolvedExternal) ? payload.dependencies.unresolvedExternal.map(String) : [],
              },
            },
          });
        }
      }
      return result;
    };
    const root: LegacyLibraryFolderPlan = {
      kind: 'folder', name: rootNode.displayName, isRoot: true, sourceIndex: 0,
      children: await buildChildren(rootNode.id),
    };
    return {
      libraryType, descriptor, root, folderCount, itemCount, unsupportedCount,
      diagnostics: [], sourceRawHash: '',
    };
  }
}
