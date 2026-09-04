import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { finished, pipeline } from 'stream/promises';
import {
  buildFactoryManifest,
  createFactoryManifestProvider,
  FactoryManifest,
  FactoryManifestProvider,
} from './manifest';
import {
  AtomicWriteSeams,
  ExampleLibraryOperationJournal,
  FactoryBaselineRecord,
  OperationKind,
  parseOperationJournalText,
  parseUserLibraryStateText,
  serializeOperationJournal,
  serializeUserLibraryState,
  UserLibraryState,
  writeJsonAtomically,
} from './state-store';
import {
  deriveSourceUserRevision,
  planExampleUpdate,
  UpdateConflictSummary,
  UserEntrySnapshot,
} from './merge-plan';
import { lexicalNativeContains } from './path-boundary';

/**
 * Main-process deep module owning the durable example-library filesystem
 * domain (contracts/example-library-lifecycle.md). Callers see only
 * inspect / prepare / commit / abort / decline / recovery outcomes; staging
 * names, journals, manifests, and sidecars stay hidden.
 */

export type LibraryFailureCode =
  | 'factory-unavailable'
  | 'user-library-invalid'
  | 'io-error'
  | 'conflict'
  | 'source-changed'
  | 'unsupported-entry';

export interface LibraryFailure {
  ok: false;
  code: LibraryFailureCode;
  message: string;
  retryable: boolean;
}

export type LibraryOutcome<T> = { ok: true; value: T } | LibraryFailure;

function failure(code: LibraryFailureCode, message: string, retryable = false): LibraryFailure {
  return { ok: false, code, message, retryable };
}

// ---------------------------------------------------------------------------
// Inspection

export interface InspectionCurrent {
  contentPath: string;
  state: UserLibraryState;
}

export type ExampleLibraryInspection =
  | { status: 'needs-initialization'; factory: FactoryManifest }
  | { status: 'ready'; factory: FactoryManifest; current: InspectionCurrent }
  | { status: 'declined-current'; factory: FactoryManifest; current: InspectionCurrent }
  | { status: 'update-available'; factory: FactoryManifest; current: InspectionCurrent }
  | { status: 'factory-unavailable'; current: InspectionCurrent }
  | { status: 'invalid-user-library'; diagnostic: string }
  | { status: 'unavailable'; diagnostic: string };

// ---------------------------------------------------------------------------
// Candidate generations

export type CandidateLifecycle = 'preparing' | 'prepared' | 'committing' | 'committed' | 'aborted';

export interface CandidateGeneration {
  operationId: string;
  kind: OperationKind;
  /** Blue-owned staging root; filesystem-only, never serialized. */
  readonly rootPath: string;
  /** Picker root while this candidate is prepared. */
  readonly contentPath: string;
  state: UserLibraryState;
  sourceUserRevision: string | null;
  summary: UpdateConflictSummary | null;
  lifecycle: CandidateLifecycle;
}

export interface ReadyExampleLibrary {
  contentPath: string;
  state: UserLibraryState;
}

// ---------------------------------------------------------------------------
// Filesystem seams (failure injection)

export interface ServiceDirentLike {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface ServiceFsSeams {
  readdirWithTypes?(dirPath: string): Promise<ServiceDirentLike[]>;
  readFileText?(filePath: string): Promise<string>;
  writeSidecarJson?(targetPath: string, contents: string): Promise<void>;
  rename?(fromPath: string, toPath: string): Promise<void>;
  unlink?(filePath: string): Promise<void>;
  removeTree?(dirPath: string): Promise<void>;
  createReadStream?(filePath: string): NodeJS.ReadableStream;
}

type InternalFs = Required<ServiceFsSeams>;

const STAGING_PATTERN = /^staging-[A-Za-z0-9_-]{6,128}$/;
const BACKUP_PATTERN = /^backup-[A-Za-z0-9_-]{6,128}$/;

function defaultServiceFs(
  seams: ServiceFsSeams | undefined,
  libraryRootForWrites: string,
  atomicSeams: AtomicWriteSeams | undefined,
): InternalFs {
  const sidecarWriter = async (targetPath: string, contents: string) =>
    writeJsonAtomically(targetPath, contents, {
      libraryRoot: libraryRootForWrites,
      seams: atomicSeams,
    });
  return {
    readdirWithTypes:
      seams?.readdirWithTypes ??
      ((dirPath) => fs.promises.readdir(dirPath, { withFileTypes: true })),
    readFileText: seams?.readFileText ?? ((filePath) => fs.promises.readFile(filePath, 'utf8')),
    writeSidecarJson: seams?.writeSidecarJson ?? sidecarWriter,
    rename: seams?.rename ?? ((fromPath, toPath) => fs.promises.rename(fromPath, toPath)),
    unlink: seams?.unlink ?? ((filePath) => fs.promises.unlink(filePath)),
    removeTree: seams?.removeTree ?? ((dirPath) => fs.promises.rm(dirPath, { recursive: true })),
    createReadStream:
      seams?.createReadStream ??
      ((filePath) => fs.createReadStream(filePath) as unknown as NodeJS.ReadableStream),
  };
}

function errnoOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface ExampleLibraryServiceOptions {
  /** Absolute native per-user library parent (`<userData>/examples`). */
  libraryRoot: string;
  /** Resolves the installed factory tree; null when none exists. */
  getFactoryRoot: () => Promise<string | null>;
  platform?: NodeJS.Platform;
  nowIso?: () => string;
  manifestProvider?: FactoryManifestProvider;
  fsSeams?: ServiceFsSeams;
  atomicWriteSeams?: AtomicWriteSeams;
}

interface LibraryLayout {
  parent: string;
  currentDir: string;
  contentPath: string;
  statePath: string;
  journalPath: string;
}

function layoutFor(libraryRoot: string): LibraryLayout {
  return {
    parent: libraryRoot,
    currentDir: path.join(libraryRoot, 'current'),
    contentPath: path.join(libraryRoot, 'current', 'content'),
    statePath: path.join(libraryRoot, 'current', 'state.json'),
    journalPath: path.join(libraryRoot, 'operation.json'),
  };
}

async function directoryExists(nativePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(nativePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Remove a Blue-owned generation directory whose name matches
 * `expectedPattern` and which lexically lives inside the library parent.
 * Unowned or unrecognized paths can never be deleted through this guard.
 */
async function removeOwnedGeneration(
  generationDir: string,
  layout: LibraryLayout,
  fsImpl: InternalFs,
  expectedPattern: RegExp,
): Promise<boolean> {
  const base = path.basename(generationDir);
  if (!expectedPattern.test(base)) {
    return false;
  }
  if (!lexicalNativeContains(layout.parent, generationDir)) {
    return false;
  }
  await fsImpl.removeTree(generationDir);
  return true;
}

export function createExampleLibraryService(options: ExampleLibraryServiceOptions) {
  const layout = layoutFor(options.libraryRoot);
  const nowIso = options.nowIso ?? (() => new Date().toISOString());
  const manifestProvider = options.manifestProvider ?? createFactoryManifestProvider();
  const fsImpl = defaultServiceFs(options.fsSeams, layout.parent, options.atomicWriteSeams);

  async function readInstalledFactoryManifest(): Promise<FactoryManifest | null> {
    const factoryRoot = await options.getFactoryRoot();
    if (factoryRoot === null) {
      return null;
    }
    try {
      const manifest = await manifestProvider.get(factoryRoot);
      if (
        manifest.files.length === 0 ||
        !manifest.files.some((record) => record.relativePath.toLowerCase().endsWith('.blue'))
      ) {
        return null;
      }
      return manifest;
    } catch {
      // Missing/partial/invalid factory input keeps installations safe.
      return null;
    }
  }

  interface CurrentReadResult {
    contentPresent: boolean;
    parsed: ReturnType<typeof parseUserLibraryStateText>;
  }

  async function readCurrentGeneration(): Promise<CurrentReadResult> {
    const contentPresent = await directoryExists(layout.contentPath);
    let rawStateText: string | null = null;
    try {
      rawStateText = await fsImpl.readFileText(layout.statePath);
    } catch {
      rawStateText = null;
    }
    return { contentPresent, parsed: parseUserLibraryStateText(rawStateText) };
  }

  async function readFileTextOrNull(targetPath: string): Promise<string | null> {
    try {
      return await fsImpl.readFileText(targetPath);
    } catch {
      return null;
    }
  }

  async function discardJournalBestEffort(): Promise<void> {
    try {
      await fsImpl.unlink(layout.journalPath);
    } catch {
      // best effort by contract
    }
  }

  /** Structural sanity of any generation directory (`content/` + valid state). */
  async function generationLayoutIsValid(generationDir: string): Promise<boolean> {
    try {
      const parsed = parseUserLibraryStateText(
        await fsImpl.readFileText(path.join(generationDir, 'state.json')),
      );
      if (parsed.kind !== 'loaded') {
        return false;
      }
      return await directoryExists(path.join(generationDir, 'content'));
    } catch {
      return false;
    }
  }

  async function generationMatchesRevision(
    generationDir: string,
    expectedRevision: string,
  ): Promise<boolean> {
    try {
      const parsed = parseUserLibraryStateText(
        await fsImpl.readFileText(path.join(generationDir, 'state.json')),
      );
      if (parsed.kind !== 'loaded') {
        return false;
      }
      if (parsed.value.acceptedFactoryRevision !== expectedRevision) {
        return false;
      }
      return await directoryExists(path.join(generationDir, 'content'));
    } catch {
      return false;
    }
  }

  async function initialCandidateContentMatches(candidate: CandidateGeneration): Promise<boolean> {
    try {
      const manifest = await buildFactoryManifest(candidate.contentPath, {
        platform: options.platform,
      });
      return manifest.revision === candidate.state.acceptedFactoryRevision;
    } catch {
      return false;
    }
  }

  // -- Recognition / recovery ---------------------------------------------

  /**
   * Lifecycle-table recovery, invoked before every inspection and thus only
   * ever from an explicit Open Example action (FR-002).
   */
  async function recover(): Promise<LibraryOutcome<{ recovered: boolean }>> {
    let entries: ServiceDirentLike[];
    try {
      entries = await fsImpl.readdirWithTypes(layout.parent);
    } catch (err) {
      // A not-yet-created library parent is simply "nothing to recover";
      // any other listing failure is genuinely unrecoverable here.
      if (errnoOf(err) !== 'ENOENT') {
        return failure(
          'io-error',
          `Cannot read the example library folder: ${messageOf(err)}`,
          true,
        );
      }
      entries = [];
    }

    const journalParsed = parseOperationJournalText(await readFileTextOrNull(layout.journalPath));

    if (journalParsed.kind === 'invalid') {
      return failure(
        'user-library-invalid',
        'An interrupted example-library operation could not be understood; nothing was modified.',
        false,
      );
    }

    const stagingNames = entries.filter((e) => STAGING_PATTERN.test(e.name)).map((e) => e.name);
    const backupNames = entries.filter((e) => BACKUP_PATTERN.test(e.name)).map((e) => e.name);

    if (journalParsed.kind === 'loaded') {
      return recoverJournaled(journalParsed.value, stagingNames, backupNames, entries);
    }

    // Names alone do not prove ownership. Without a valid journal, preserve
    // every candidate/backup and block mutation for user review.
    if (stagingNames.length > 0 || backupNames.length > 0) {
      return failure(
        'user-library-invalid',
        'Unrecognized staging or backup data next to the example library was preserved; review it before continuing.',
        false,
      );
    }

    return { ok: true, value: { recovered: false } };
  }

  async function recoverJournaled(
    journal: ExampleLibraryOperationJournal,
    stagingNames: string[],
    backupNames: string[],
    entries: ServiceDirentLike[],
  ): Promise<LibraryOutcome<{ recovered: boolean }>> {
    const stagingDir = path.join(layout.parent, journal.stagingDirectoryName);
    const stagingPresent = stagingNames.includes(journal.stagingDirectoryName);
    const stagingValid =
      stagingPresent &&
      (await generationMatchesRevision(stagingDir, journal.targetFactoryRevision));
    const backupName = journal.backupDirectoryName;
    const unexpectedStaging = stagingNames.some((name) => name !== journal.stagingDirectoryName);
    const unexpectedBackup = backupNames.some((name) => name !== backupName);
    if (unexpectedStaging || unexpectedBackup) {
      return failure(
        'user-library-invalid',
        'Multiple or unowned example-library generations were preserved; review them before continuing.',
        false,
      );
    }

    const currentPresent = await directoryExists(layout.currentDir);
    const currentValid = currentPresent && (await generationLayoutIsValid(layout.currentDir));
    const currentMatchesTarget =
      currentValid &&
      (await generationMatchesRevision(layout.currentDir, journal.targetFactoryRevision));
    const backupPresent = backupName !== null && backupNames.includes(backupName);

    // No rename happened yet (including a phase advanced just before a
    // current→backup rename). Keep current and discard only journal-matched
    // staging state.
    if (currentValid && stagingValid && !backupPresent && !currentMatchesTarget) {
      await removeOwnedGeneration(stagingDir, layout, fsImpl, STAGING_PATTERN);
      await discardJournalBestEffort();
      return { ok: true, value: { recovered: true } };
    }

    // Current missing + verified stage → finish the interrupted activation.
    if (!currentPresent && stagingValid) {
      const finished = await finishStagedActivation(journal, stagingDir);
      return finished.ok ? { ok: true, value: { recovered: true } } : finished;
    }

    // Observable target reality outranks a lagging journal phase. Keep the
    // activated target and remove only its journal-matched leftovers.
    if (currentMatchesTarget) {
      if (backupName !== null && backupPresent) {
        await removeOwnedGeneration(
          path.join(layout.parent, backupName),
          layout,
          fsImpl,
          BACKUP_PATTERN,
        );
      }
      if (stagingPresent) {
        await removeOwnedGeneration(stagingDir, layout, fsImpl, STAGING_PATTERN);
      }
      await discardJournalBestEffort();
      return { ok: true, value: { recovered: true } };
    }

    // Current missing + unusable/missing stage + verified backup → restore.
    if (!currentPresent && !stagingValid && backupName !== null) {
      const backupEntry = entries.find((e) => e.name === backupName);
      if (backupEntry !== undefined) {
        const restored = await restoreVerifiedBackup(backupName, journal.stagingDirectoryName);
        return restored.ok ? { ok: true, value: { recovered: true } } : restored;
      }
    }

    return failure(
      'user-library-invalid',
      'An interrupted example-library operation left unrecognized state; nothing was modified.',
      false,
    );
  }

  async function finishStagedActivation(
    journal: ExampleLibraryOperationJournal,
    stagingDir: string,
  ): Promise<LibraryOutcome<unknown>> {
    try {
      await fsImpl.rename(stagingDir, layout.currentDir);
    } catch (err) {
      return failure(
        'io-error',
        `Could not finish the interrupted operation: ${messageOf(err)}`,
        true,
      );
    }
    if (!(await generationLayoutIsValid(layout.currentDir))) {
      return failure(
        'user-library-invalid',
        'The interrupted preparation no longer produces a valid library.',
        false,
      );
    }
    // Remove the owned rollback generation before discarding the journal so
    // later inspections never see a journal-less "unrecognized" backup.
    if (journal.backupDirectoryName !== null) {
      await removeOwnedGeneration(
        path.join(layout.parent, journal.backupDirectoryName),
        layout,
        fsImpl,
        BACKUP_PATTERN,
      ).catch(() => false);
    }
    await writeJournalSafe({ ...journal, phase: 'activated' });
    await discardJournalBestEffort();
    return { ok: true, value: null };
  }

  async function restoreVerifiedBackup(
    backupName: string,
    stagingNameToClean: string,
  ): Promise<LibraryOutcome<unknown>> {
    const backupDir = path.join(layout.parent, backupName);
    if (!(await generationLayoutIsValid(backupDir))) {
      return failure(
        'user-library-invalid',
        'The preserved backup no longer matches its recorded shape.',
        false,
      );
    }
    try {
      await fsImpl.rename(backupDir, layout.currentDir);
    } catch (err) {
      return failure(
        'io-error',
        `Could not restore the previous example library: ${messageOf(err)}`,
        true,
      );
    }
    await removeOwnedGeneration(
      path.join(layout.parent, stagingNameToClean),
      layout,
      fsImpl,
      STAGING_PATTERN,
    ).catch(() => false);
    await discardJournalBestEffort();
    return { ok: true, value: null };
  }

  async function writeJournalSafe(journal: ExampleLibraryOperationJournal): Promise<void> {
    try {
      await fsImpl.writeSidecarJson(layout.journalPath, serializeOperationJournal(journal));
    } catch {
      // The durable-write failure is tolerated: shapes on disk remain the
      // authoritative recovery input on the next Open Example.
    }
  }

  // -- Update preparation (US3) --------------------------------------------

  async function hashLocalFileStreaming(
    nativePath: string,
  ): Promise<{ sha256: string; size: number }> {
    const hash = createHash('sha256');
    let size = 0;
    const input = fsImpl.createReadStream(nativePath);
    input.on('data', (chunk: Buffer | string) => {
      hash.update(chunk);
      size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
    });
    await finished(input);
    return { sha256: hash.digest('hex'), size };
  }

  /** Non-following snapshot of every entry below `contentRoot` (lstat kinds). */
  async function snapshotUserEntries(contentRoot: string): Promise<UserEntrySnapshot[]> {
    const out: UserEntrySnapshot[] = [];

    async function walk(dirPath: string): Promise<void> {
      let dirents;
      try {
        dirents = await fsImpl.readdirWithTypes(dirPath);
      } catch {
        return;
      }
      for (const entry of dirents) {
        const child = path.join(dirPath, entry.name);
        const relativeText = path.relative(contentRoot, child).split(path.sep).join('/');
        if (entry.isSymbolicLink()) {
          out.push({ relativePath: relativeText, kind: 'symlink', sha256: null, size: null });
          continue;
        }
        if (entry.isDirectory()) {
          out.push({ relativePath: relativeText, kind: 'directory', sha256: null, size: null });
          await walk(child);
          continue;
        }
        if (entry.isFile()) {
          const hashed = await hashLocalFileStreaming(child);
          out.push({
            relativePath: relativeText,
            kind: 'regular',
            sha256: hashed.sha256,
            size: hashed.size,
          });
          continue;
        }
        out.push({ relativePath: relativeText, kind: 'other', sha256: null, size: null });
      }
    }

    await walk(contentRoot);
    return out.sort((a, b) =>
      a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
    );
  }

  async function copyUserTreePreservingSymlinks(
    sourceContentRoot: string,
    destinationContentRoot: string,
  ): Promise<void> {
    async function walk(dirPath: string): Promise<void> {
      for (const entry of await fsImpl.readdirWithTypes(dirPath)) {
        const sourceChild = path.join(dirPath, entry.name);
        const destinationChild = path.join(
          destinationContentRoot,
          path.relative(sourceContentRoot, sourceChild),
        );
        if (entry.isSymbolicLink()) {
          try {
            const linkTarget = fs.readlinkSync(sourceChild);
            await fs.promises.symlink(linkTarget, destinationChild).catch(async (err) => {
              // Windows symlink privilege gaps make user trees un-updatable
              // in place — fail safe rather than dereferencing.
              throw Object.assign(err, { failedSymlink: sourceChild });
            });
          } catch (err) {
            throw new Error(
              `Unsupported library entry (symlink could not be preserved): ${path.basename(String((err as { failedSymlink?: string }).failedSymlink ?? sourceChild))}`,
            );
          }
          continue;
        }
        if (entry.isDirectory()) {
          await fs.promises.mkdir(destinationChild, { recursive: true });
          await walk(sourceChild);
          continue;
        }
        if (!entry.isFile()) {
          throw new Error(`Unsupported library entry type at ${path.basename(sourceChild)}`);
        }
        await copyLocalFile(sourceChild, destinationChild);
      }
    }

    async function copyLocalFile(sourceFile: string, destinationFile: string): Promise<void> {
      await fs.promises.mkdir(path.dirname(destinationFile), { recursive: true });
      const input = fsImpl.createReadStream(sourceFile);
      const output = fs.createWriteStream(destinationFile);
      await pipeline(input, output);
    }

    await fs.promises.mkdir(destinationContentRoot, { recursive: true });
    await walk(sourceContentRoot);
  }

  /**
   * Stage an update candidate: snapshot → plan → stage copy → overlay only
   * safe factory actions → verify overlay bytes → derive next state.
   * Any failure removes only this staging generation.
   */
  async function prepareUpdate(): Promise<LibraryOutcome<CandidateGeneration>> {
    const factoryManifest = await readInstalledFactoryManifest();
    const { contentPresent, parsed } = await readCurrentGeneration();

    if (
      !contentPresent ||
      parsed.kind !== 'loaded' ||
      factoryManifest === null ||
      parsed.value.declinedFactoryRevision === factoryManifest.revision ||
      parsed.value.acceptedFactoryRevision === factoryManifest.revision
    ) {
      return failure(
        'conflict',
        'The example library no longer offers an update at this moment.',
        false,
      );
    }

    const operationId = randomUUID();
    const stagingDir = path.join(layout.parent, `staging-${operationId}`);
    const stagingContentRoot = path.join(stagingDir, 'content');

    const candidate: CandidateGeneration = {
      operationId,
      kind: 'update',
      rootPath: stagingDir,
      contentPath: stagingContentRoot,
      state: parsed.value,
      sourceUserRevision: null,
      summary: null,
      lifecycle: 'preparing',
    };

    try {
      // 1–2. Snapshot current content and derive its canonical revision.
      const snapshotsBefore = await snapshotUserEntries(layout.contentPath);
      candidate.sourceUserRevision = deriveSourceUserRevision(snapshotsBefore);

      // 3. Pure classification against accepted baselines + installed tree.
      const plan = planExampleUpdate({
        baselines: parsed.value.baselines,
        userEntries: snapshotsBefore,
        installed: factoryManifest,
      });

      // 4. Stage complete user-tree copy without dereferencing symlinks.
      await copyUserTreePreservingSymlinks(layout.contentPath, stagingContentRoot);

      // 5. Overlay ONLY add-factory / replace-untouched paths.
      for (const appliedPath of plan.appliedFactoryPaths) {
        const record = factoryManifest.files.find((f) => f.relativePath === appliedPath);
        if (!record) throw new Error(`missing manifest record for ${appliedPath}`);
        const destinationFile = path.join(stagingContentRoot, ...appliedPath.split('/'));
        await fs.promises.mkdir(path.dirname(destinationFile), { recursive: true });
        await streamCopyFromFactory(appliedPath, destinationFile);
      }

      // 6. Write next provenance into the candidate.
      candidate.state = {
        ...parsed.value,
        schemaVersion: 1,
        acceptedFactoryRevision: plan.nextState.acceptedFactoryRevision,
        declinedFactoryRevision: null,
        baselines: plan.nextState.baselines,
        lastCompletedAt: nowIso(),
      };
      await fsImpl.writeSidecarJson(
        path.join(stagingDir, 'state.json'),
        serializeUserLibraryState(candidate.state),
      );

      // 7. Verify overlaid bytes equal the installed factory records.
      for (const appliedPath of plan.appliedFactoryPaths) {
        const record = factoryManifest.files.find((f) => f.relativePath === appliedPath);
        if (!record) continue;
        const stagedHash = await hashLocalFileStreaming(
          path.join(stagingContentRoot, ...appliedPath.split('/')),
        );
        if (stagedHash.sha256 !== record.sha256 || stagedHash.size !== record.size) {
          throw new Error(`verification failed for refreshed example file ${appliedPath}`);
        }
      }

      // 8. Refuse silently-changing sources between snapshot and finalize.
      const snapshotsAfter = await snapshotUserEntries(layout.contentPath);
      if (deriveSourceUserRevision(snapshotsAfter) !== candidate.sourceUserRevision) {
        candidate.lifecycle = 'aborted';
        await abortPreparedStaging(stagingDir);
        return failure(
          'source-changed',
          'Your example library changed while the update was being prepared.',
          true,
        );
      }

      candidate.summary = {
        totalConflicts: plan.summary.totalConflicts,
        totalCollisions: plan.summary.totalCollisions,
        conflicts: [...plan.summary.conflicts],
        collisions: [...plan.summary.collisions],
      };
      candidate.lifecycle = 'prepared';
      return { ok: true, value: candidate };
    } catch (err) {
      await abortPreparedStaging(stagingDir);
      return preparationFailure(err);
    }
  }

  /** Inspect after recognition/recovery. Purely observational. */
  async function inspect(): Promise<LibraryOutcome<ExampleLibraryInspection>> {
    const recovery = await recover();
    if (!recovery.ok) {
      return {
        ok: true,
        value: { status: 'invalid-user-library', diagnostic: recovery.message },
      };
    }

    const { contentPresent, parsed } = await readCurrentGeneration();
    const factoryManifest = await readInstalledFactoryManifest();

    if (!contentPresent && parsed.kind === 'absent') {
      if (factoryManifest === null) {
        return {
          ok: true,
          value: {
            status: 'unavailable',
            diagnostic: 'No packaged examples were found on this installation.',
          },
        };
      }
      return { ok: true, value: { status: 'needs-initialization', factory: factoryManifest } };
    }

    if (parsed.kind === 'invalid') {
      return {
        ok: true,
        value: {
          status: 'invalid-user-library',
          diagnostic: parsed.reasons.slice(0, 5).join('; '),
        },
      };
    }

    if (!contentPresent || parsed.kind !== 'loaded') {
      return {
        ok: true,
        value: {
          status: 'invalid-user-library',
          diagnostic:
            !contentPresent && parsed.kind === 'loaded'
              ? 'Example library provenance exists without its content directory.'
              : 'Example library content exists without valid provenance.',
        },
      };
    }

    const current: InspectionCurrent = {
      contentPath: layout.contentPath,
      state: parsed.value,
    };

    if (factoryManifest === null) {
      return { ok: true, value: { status: 'factory-unavailable', current } };
    }

    // Equality—not ordering—drives every offer (clarified unordered revisions).
    if (parsed.value.declinedFactoryRevision === factoryManifest.revision) {
      return { ok: true, value: { status: 'declined-current', factory: factoryManifest, current } };
    }
    if (parsed.value.acceptedFactoryRevision !== factoryManifest.revision) {
      return { ok: true, value: { status: 'update-available', factory: factoryManifest, current } };
    }
    return { ok: true, value: { status: 'ready', factory: factoryManifest, current } };
  }

  /** Stage a complete first-use copy; `current` remains untouched until commit. */
  async function prepareInitialCopy(
    factory: FactoryManifest,
  ): Promise<LibraryOutcome<CandidateGeneration>> {
    const operationId = randomUUID();
    const stagingDir = path.join(layout.parent, `staging-${operationId}`);
    const candidate: CandidateGeneration = {
      operationId,
      kind: 'initialize',
      rootPath: stagingDir,
      contentPath: path.join(stagingDir, 'content'),
      state: stateFromManifest(factory, nowIso()),
      sourceUserRevision: null,
      summary: null,
      lifecycle: 'preparing',
    };

    try {
      await fs.promises.mkdir(candidate.contentPath, { recursive: true });
      for (const record of factory.files) {
        const destinationFile = path.join(candidate.contentPath, ...record.relativePath.split('/'));
        await fs.promises.mkdir(path.dirname(destinationFile), { recursive: true });
        await streamCopyFromFactory(record.relativePath, destinationFile);
      }
      const copiedManifest = await buildFactoryManifest(candidate.contentPath, {
        platform: options.platform,
      });
      const factoryRootAfterCopy = await options.getFactoryRoot();
      const sourceManifestAfterCopy =
        factoryRootAfterCopy === null
          ? null
          : await buildFactoryManifest(factoryRootAfterCopy, { platform: options.platform });
      if (
        copiedManifest.revision !== factory.revision ||
        sourceManifestAfterCopy?.revision !== factory.revision
      ) {
        throw new Error('the packaged example source changed while it was being copied');
      }
      await fsImpl.writeSidecarJson(
        path.join(stagingDir, 'state.json'),
        serializeUserLibraryState(candidate.state),
      );
      candidate.lifecycle = 'prepared';
      return { ok: true, value: candidate };
    } catch (err) {
      await abortPreparedStaging(stagingDir);
      return preparationFailure(err);
    }
  }

  async function streamCopyFromFactory(
    relativePortion: string,
    destinationFile: string,
  ): Promise<void> {
    const factoryRoot = await options.getFactoryRoot();
    if (factoryRoot === null) {
      throw new Error('the packaged example source disappeared during preparation');
    }
    const sourceFile = path.join(factoryRoot, relativePortion);
    const input = fsImpl.createReadStream(sourceFile);
    const output = fs.createWriteStream(destinationFile);
    await pipeline(input, output);
  }

  function preparationFailure(error: unknown): LibraryFailure {
    const message = messageOf(error);
    const errno = errnoOf(error);
    if (errno === 'EACCES' || errno === 'EPERM') {
      return failure(
        'io-error',
        `Permission denied while preparing the example library: ${message}`,
        true,
      );
    }
    if (errno === 'ENOSPC') {
      return failure('io-error', 'Not enough disk space to prepare the example library.', true);
    }
    return failure('io-error', `Failed to prepare the example library: ${message}`, true);
  }

  function stateFromManifest(manifest: FactoryManifest, completedAt: string): UserLibraryState {
    const baselines: FactoryBaselineRecord[] = manifest.files.map((record) => ({
      relativePath: record.relativePath,
      factorySha256: record.sha256,
      factorySize: record.size,
      factoryPresent: true,
    }));
    return {
      schemaVersion: 1,
      acceptedFactoryRevision: manifest.revision,
      declinedFactoryRevision: null,
      baselines,
      lastCompletedAt: completedAt,
    };
  }

  async function abortPreparedStaging(stagingDir: string): Promise<void> {
    try {
      await removeOwnedGeneration(stagingDir, layout, fsImpl, STAGING_PATTERN);
    } catch {
      // idempotent best effort
    }
  }

  /** Discard a prepared candidate. Idempotent. */
  async function abort(candidate: CandidateGeneration): Promise<void> {
    if (candidate.lifecycle === 'committed' || candidate.lifecycle === 'aborted') {
      return;
    }
    candidate.lifecycle = 'aborted';
    await abortPreparedStaging(candidate.rootPath);
  }

  /** Keep Current: persist the decline decision without touching content. */
  async function recordDeclinedRevision(
    state: UserLibraryState,
    declinedRevision: string,
  ): Promise<LibraryOutcome<UserLibraryState>> {
    const normalizedDeclined =
      declinedRevision === state.acceptedFactoryRevision ? null : declinedRevision;
    const nextState: UserLibraryState = {
      ...state,
      declinedFactoryRevision: normalizedDeclined,
      lastCompletedAt: nowIso(),
    };
    try {
      await fsImpl.writeSidecarJson(layout.statePath, serializeUserLibraryState(nextState));
      return { ok: true, value: nextState };
    } catch (err) {
      return failure('io-error', `Could not record the decline decision: ${messageOf(err)}`, true);
    }
  }

  /**
   * Durable activation: validate → journal(prepared) → [current→backup]
   * → staging→current → journal(activated) → validate → cleanup. Any failure
   * restores the previous observable generation using only journal-proven
   * ownership.
   */
  async function commit(
    candidate: CandidateGeneration,
  ): Promise<LibraryOutcome<ReadyExampleLibrary>> {
    if (candidate.lifecycle !== 'prepared') {
      return failure('conflict', 'The prepared example library is no longer committable.', false);
    }
    candidate.lifecycle = 'committing';

    const currentExisted = await directoryExists(layout.currentDir);
    const backupName = `backup-${candidate.operationId}`;
    const stagingName = path.basename(candidate.rootPath);

    let journal: ExampleLibraryOperationJournal = {
      schemaVersion: 1,
      operationId: candidate.operationId,
      kind: candidate.kind,
      phase: 'prepared',
      stagingDirectoryName: path.basename(candidate.rootPath),
      backupDirectoryName: currentExisted ? backupName : null,
      sourceUserRevision: candidate.sourceUserRevision,
      targetFactoryRevision: candidate.state.acceptedFactoryRevision,
      startedAt: nowIso(),
    };

    try {
      if (candidate.kind === 'update' && candidate.sourceUserRevision !== null) {
        // Contract step 6: immediately before activation the live user tree
        // must still match the snapshot the candidate was built from.
        const liveSnapshots = await snapshotUserEntries(layout.contentPath);
        if (deriveSourceUserRevision(liveSnapshots) !== candidate.sourceUserRevision) {
          candidate.lifecycle = 'aborted';
          await abortPreparedStaging(candidate.rootPath);
          return failure(
            'source-changed',
            'Your example library changed while the update was being prepared. Nothing was modified — try Update and Open again.',
            true,
          );
        }
      }

      if (
        !(await generationMatchesRevision(candidate.rootPath, journal.targetFactoryRevision)) ||
        (candidate.kind === 'initialize' && !(await initialCandidateContentMatches(candidate)))
      ) {
        candidate.lifecycle = 'aborted';
        await abortPreparedStaging(candidate.rootPath);
        return failure('conflict', 'The prepared library failed its final validation.', false);
      }

      await fsImpl.writeSidecarJson(layout.journalPath, serializeOperationJournal(journal));

      if (currentExisted) {
        await fsImpl.rename(layout.currentDir, path.join(layout.parent, backupName));
        journal = { ...journal, phase: 'backup-created' };
        await fsImpl.writeSidecarJson(layout.journalPath, serializeOperationJournal(journal));
      }

      await fsImpl.rename(candidate.rootPath, layout.currentDir);
      journal = { ...journal, phase: 'activated' };
      await fsImpl.writeSidecarJson(layout.journalPath, serializeOperationJournal(journal));
    } catch (err) {
      // A post-rename seam failure can still leave the activation complete;
      // observable reality outranks the error report.
      const stageGone = !(await directoryExists(candidate.rootPath));
      const currentMatchesTarget = await generationMatchesRevision(
        layout.currentDir,
        journal.targetFactoryRevision,
      );
      if (stageGone && currentMatchesTarget) {
        if (journal.backupDirectoryName !== null) {
          await removeOwnedGeneration(
            path.join(layout.parent, backupName),
            layout,
            fsImpl,
            BACKUP_PATTERN,
          ).catch(() => false);
        }
        await discardJournalBestEffort();
        candidate.lifecycle = 'committed';
        return {
          ok: true,
          value: { contentPath: layout.contentPath, state: candidate.state },
        };
      }
      candidate.lifecycle = 'aborted';
      await unwindPartialCommit(journal, stagingName, backupName, currentExisted);
      return commitFailure(err);
    }

    if (!(await generationMatchesRevision(layout.currentDir, journal.targetFactoryRevision))) {
      // Invalid activation shape with a surviving, verified backup.
      const restoredBackup = await restoreBackupOverInvalidActivation(
        backupName,
        stagingName,
        journal,
      );
      candidate.lifecycle = 'aborted';
      return restoredBackup;
    }

    if (journal.backupDirectoryName !== null) {
      await removeOwnedGeneration(
        path.join(layout.parent, backupName),
        layout,
        fsImpl,
        BACKUP_PATTERN,
      ).catch(() => false);
    }
    await discardJournalBestEffort();

    candidate.lifecycle = 'committed';
    return {
      ok: true,
      value: { contentPath: layout.contentPath, state: candidate.state },
    };
  }

  /**
   * Reverse renames performed before the failing step. Ownership of every
   * manipulated path comes from the validated in-flight journal, so unmanaged
   * directories are never touched.
   */
  async function unwindPartialCommit(
    journal: ExampleLibraryOperationJournal,
    stagingName: string,
    backupName: string,
    currentExistedBeforeCommit: boolean,
  ): Promise<void> {
    try {
      const stagingPresent = await directoryExists(path.join(layout.parent, stagingName));
      const currentPresent = await directoryExists(layout.currentDir);
      const backupPresent = await directoryExists(path.join(layout.parent, backupName));

      // Case A: staging moved in but the post-activation journal write failed.
      if (!stagingPresent && currentPresent) {
        if (!(await generationLayoutIsValid(layout.currentDir)) && backupPresent) {
          // Swap back: current is our broken activation.
          await fsImpl.rename(layout.currentDir, path.join(layout.parent, stagingName));
          await fsImpl.rename(path.join(layout.parent, backupName), layout.currentDir);
        }
      }

      // Case B: current moved aside but staging rename never happened.
      if (currentExistedBeforeCommit && !currentPresent && stagingPresent) {
        if (backupPresent) {
          await fsImpl.rename(path.join(layout.parent, backupName), layout.currentDir);
        }
      }

      // This in-flight candidate is proven by the still-valid journal and
      // operation id, so a handled commit failure may remove it before the
      // journal is discarded. Journal-less discovery never makes this leap.
      if (await directoryExists(path.join(layout.parent, stagingName))) {
        await removeOwnedGeneration(
          path.join(layout.parent, stagingName),
          layout,
          fsImpl,
          STAGING_PATTERN,
        );
      }

      await discardJournalBestEffort();
    } catch {
      // Undo failed: leave the journal for deterministic recovery next open.
    }
  }

  async function restoreBackupOverInvalidActivation(
    backupName: string,
    stagingName: string,
    journal: ExampleLibraryOperationJournal,
  ): Promise<LibraryOutcome<ReadyExampleLibrary>> {
    void journal;
    const backupDir = path.join(layout.parent, backupName);
    if (!(await generationLayoutIsValid(backupDir))) {
      return failure(
        'io-error',
        'Activation produced an invalid example library and the preserved backup could not verify.',
        false,
      );
    }
    // Remove the invalid activation (journal-owned current), restore backup.
    await fsImpl.removeTree(layout.currentDir);
    await fsImpl.rename(backupDir, layout.currentDir);
    await removeOwnedGeneration(
      path.join(layout.parent, stagingName),
      layout,
      fsImpl,
      STAGING_PATTERN,
    ).catch(() => false);
    await discardJournalBestEffort();
    return failure(
      'io-error',
      'Activation failed final validation; the previous example library was restored intact.',
      true,
    );
  }

  function commitFailure(error: unknown): LibraryFailure {
    const message = messageOf(error);
    const errno = errnoOf(error);
    if (errno === 'ENOTEMPTY' || errno === 'EEXIST') {
      return failure('conflict', 'Another example-library change happened concurrently.', true);
    }
    if (errno === 'EACCES' || errno === 'EPERM') {
      return failure(
        'io-error',
        `Permission denied while activating the example library: ${message}`,
        true,
      );
    }
    return failure('io-error', `Could not activate the example library: ${message}`, true);
  }

  return {
    inspect,
    prepareInitialCopy,
    prepareUpdate,
    recordDeclinedRevision,
    commit,
    abort,
    recover,
    __layoutForTesting: layout,
  };
}

export type ExampleLibraryService = ReturnType<typeof createExampleLibraryService>;
