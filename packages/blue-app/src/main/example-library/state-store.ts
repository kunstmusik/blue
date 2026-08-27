import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  ExamplePathError,
  parsePortableExamplePath,
} from './path-boundary';

/**
 * Durable provenance state for the user-owned example library
 * (`state.json`) plus the transient operation journal (`operation.json`).
 * Both live beside the user copy — never in `.blue` XML or program settings
 * (contracts/example-library-state.md).
 */

export const USER_LIBRARY_STATE_SCHEMA_VERSION = 1;
export const OPERATION_JOURNAL_SCHEMA_VERSION = 1;

const HEX_64 = /^[0-9a-f]{64}$/;
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export interface FactoryBaselineRecord {
  relativePath: string;
  /** Most recently processed installed bytes for this path. */
  factorySha256: string;
  factorySize: number;
  /** `false` marks a tombstone for content removed from the factory. */
  factoryPresent: boolean;
}

export interface UserLibraryState {
  schemaVersion: number;
  acceptedFactoryRevision: string;
  declinedFactoryRevision: string | null;
  baselines: FactoryBaselineRecord[];
  lastCompletedAt: string;
}

export type OperationKind = 'initialize' | 'update';
export type OperationPhase = 'prepared' | 'backup-created' | 'activated';

export interface ExampleLibraryOperationJournal {
  schemaVersion: number;
  operationId: string;
  kind: OperationKind;
  phase: OperationPhase;
  stagingDirectoryName: string;
  backupDirectoryName: string | null;
  sourceUserRevision: string | null;
  targetFactoryRevision: string;
  startedAt: string;
}

export type ParsedSidecar<T> =
  | { kind: 'loaded'; value: T }
  | { kind: 'absent' }
  | { kind: 'invalid'; reasons: string[] };

export class ExampleLibraryStateError extends Error {
  readonly reasons: string[];

  constructor(message: string, reasons: string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join('; ')}` : message);
    this.name = 'ExampleLibraryStateError';
    this.reasons = reasons;
  }
}

/** Canonical revision derived from present baselines (empty set included). */
export function deriveRevisionFromBaselines(
  baselines: readonly FactoryBaselineRecord[],
): string {
  const present = baselines
    .filter((baseline) => baseline.factoryPresent)
    .map((baseline) => [baseline.relativePath, baseline.factorySha256, baseline.factorySize]);
  // The empty content set derives deterministically as well, mirroring the
  // manifest payload shape so fully-removed upstream content stays writable.
  return `sha256:${createHash('sha256').update(JSON.stringify(present)).digest('hex')}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRevision(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('sha256:')
    && HEX_64.test(value.slice('sha256:'.length));
}

function requireTimestamp(value: unknown, label: string, errors: string[]): void {
  if (typeof value !== 'string' || !ISO_8601_PATTERN.test(value)) {
    errors.push(`${label} must be an ISO-8601 timestamp`);
  }
}

/** Validate a decoded `state.json` payload against every documented rule. */
export function validateUserLibraryState(raw: unknown): { state: UserLibraryState } | { invalid: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { invalid: ['State document must be a JSON object'] };
  }

  if (raw.schemaVersion !== USER_LIBRARY_STATE_SCHEMA_VERSION) {
    // Unknown future versions block mutation rather than being replaced with
    // defaults over existing content.
    errors.push(`Unsupported schemaVersion ${String(raw.schemaVersion)}`);
  }
  if (!isValidRevision(raw.acceptedFactoryRevision)) {
    errors.push('acceptedFactoryRevision must be a sha256 revision');
  }
  if (raw.declinedFactoryRevision !== null && !isValidRevision(raw.declinedFactoryRevision)) {
    errors.push('declinedFactoryRevision must be null or a sha256 revision');
  }
  requireTimestamp(raw.lastCompletedAt, 'lastCompletedAt', errors);

  if (!Array.isArray(raw.baselines)) {
    return { invalid: [...errors, 'baselines must be an array'] };
  }

  const baselines: FactoryBaselineRecord[] = [];
  let previousPath = '';
  let sorted = true;

  raw.baselines.forEach((entryRaw, index) => {
    if (!isPlainObject(entryRaw)) {
      errors.push(`baseline at index ${index} must be an object`);
      return;
    }

    let relativePath: string;
    try {
      relativePath = parsePortableExamplePath(entryRaw.relativePath);
    } catch (err) {
      errors.push(
        err instanceof ExamplePathError
          ? `baseline at index ${index}: ${err.message}`
          : `baseline at index ${index} has an invalid relativePath`,
      );
      return;
    }

    if (relativePath < previousPath) {
      sorted = false;
    } else {
      previousPath = relativePath;
    }

    if (baselines.some((existing) => existing.relativePath === relativePath)) {
      errors.push(`duplicate baseline path: ${relativePath}`);
      return;
    }
    if (
      typeof entryRaw.factorySha256 !== 'string'
      || !HEX_64.test(entryRaw.factorySha256)
    ) {
      errors.push(`baseline ${relativePath} has a malformed factorySha256`);
    }
    if (
      typeof entryRaw.factorySize !== 'number'
      || !Number.isSafeInteger(entryRaw.factorySize)
      || entryRaw.factorySize < 0
    ) {
      errors.push(`baseline ${relativePath} has an invalid factorySize`);
    }
    if (typeof entryRaw.factoryPresent !== 'boolean') {
      errors.push(`baseline ${relativePath} needs boolean factoryPresent`);
    }
    baselines.push({
      relativePath,
      factorySha256: typeof entryRaw.factorySha256 === 'string' ? entryRaw.factorySha256 : '',
      factorySize: typeof entryRaw.factorySize === 'number' ? entryRaw.factorySize : -1,
      factoryPresent: entryRaw.factoryPresent === true,
    });
  });

  if (!sorted) {
    errors.push('baselines must be sorted by relativePath');
  }

  // Accepted-revision invariant (contract rule 2). Rejected states never
  // reach callers as valid documents.
  const recomputed = deriveRevisionFromBaselines(baselines);
  if (errors.length > 0 || recomputed !== raw.acceptedFactoryRevision) {
    if (recomputed !== raw.acceptedFactoryRevision) {
      errors.push(
        'acceptedFactoryRevision does not match the revision derived from present baselines',
      );
    }
    return { invalid: errors };
  }

  return {
    state: {
      schemaVersion: raw.schemaVersion as number,
      acceptedFactoryRevision: raw.acceptedFactoryRevision as string,
      declinedFactoryRevision:
        raw.declinedFactoryRevision === undefined ? null : (raw.declinedFactoryRevision as string | null),
      baselines,
      lastCompletedAt: String(raw.lastCompletedAt),
    },
  };
}

/**
 * Serialize a validated state document. Declined revisions equal to the
 * accepted revision are normalized to `null` on write (contract rule 4), and
 * baselines are written sorted.
 */
export function serializeUserLibraryState(state: UserLibraryState): string {
  const baselines = [...state.baselines].sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );
  const declined =
    state.declinedFactoryRevision !== null
    && state.declinedFactoryRevision !== state.acceptedFactoryRevision
      ? state.declinedFactoryRevision
      : null;

  const normalized: Record<string, unknown> = {
    schemaVersion: USER_LIBRARY_STATE_SCHEMA_VERSION,
    acceptedFactoryRevision: state.acceptedFactoryRevision,
    declinedFactoryRevision: declined,
    baselines,
    lastCompletedAt: state.lastCompletedAt,
  };

  const check = validateUserLibraryState(normalized);
  if ('invalid' in check) {
    throw new ExampleLibraryStateError('Refusing to serialize invalid state', check.invalid);
  }

  return `${JSON.stringify(normalized, null, 2)}\n`;
}

/** Parse `state.json` contents into loaded/absent/invalid outcomes. */
export function parseUserLibraryStateText(text: string | null | undefined): ParsedSidecar<UserLibraryState> {
  if (text === null || text === undefined || text.trim() === '') {
    return { kind: 'absent' };
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reasons: ['State file is not valid JSON'] };
  }
  const result = validateUserLibraryState(decoded);
  return 'state' in result ? { kind: 'loaded', value: result.state } : { kind: 'invalid', reasons: result.invalid };
}

function requireSafeSegmentPair(operationId: unknown, directoryName: unknown, prefix: 'staging' | 'backup', errors: string[]): void {
  if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(operationId)) {
    errors.push('operationId must be safe path-segment text');
    return;
  }
  if (typeof directoryName !== 'string' || directoryName !== `${prefix}-${operationId}`) {
    errors.push(`${prefix}DirectoryName must equal ${prefix}-<operationId>`);
  }
}

/** Validate a decoded `operation.json` payload. */
export function validateOperationJournal(raw: unknown): { journal: ExampleLibraryOperationJournal } | { invalid: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { invalid: ['Journal document must be a JSON object'] };
  }
  if (raw.schemaVersion !== OPERATION_JOURNAL_SCHEMA_VERSION) {
    errors.push(`Unsupported journal schemaVersion ${String(raw.schemaVersion)}`);
  }
  requireSafeSegmentPair(raw.operationId, raw.stagingDirectoryName, 'staging', errors);
  if (raw.kind !== 'initialize' && raw.kind !== 'update') {
    errors.push('kind must be initialize or update');
  }
  if (raw.phase !== 'prepared' && raw.phase !== 'backup-created' && raw.phase !== 'activated') {
    errors.push('phase is not a valid commit phase');
  }
  if (raw.backupDirectoryName !== null && raw.backupDirectoryName !== undefined) {
    if (typeof raw.operationId === 'string') {
      requireSafeSegmentPair(raw.operationId, raw.backupDirectoryName, 'backup', errors);
    } else {
      errors.push('backupDirectoryName must equal backup-<operationId> or be null');
    }
  }
  if (raw.sourceUserRevision !== null && !isValidRevision(raw.sourceUserRevision)) {
    errors.push('sourceUserRevision must be null or a sha256 revision');
  }
  if (!isValidRevision(raw.targetFactoryRevision)) {
    errors.push('targetFactoryRevision must be a sha256 revision');
  }
  requireTimestamp(raw.startedAt, 'startedAt', errors);

  if (errors.length > 0 || typeof raw.operationId !== 'string') {
    if (typeof raw.operationId !== 'string') {
      return { invalid: errors.length > 0 ? errors : ['operationId must be safe path-segment text'] };
    }
    return { invalid: errors };
  }

  return {
    journal: {
      schemaVersion: OPERATION_JOURNAL_SCHEMA_VERSION,
      operationId: raw.operationId,
      kind: raw.kind as OperationKind,
      phase: raw.phase as OperationPhase,
      stagingDirectoryName: String(raw.stagingDirectoryName),
      backupDirectoryName:
        typeof raw.backupDirectoryName === 'string' ? raw.backupDirectoryName : null,
      sourceUserRevision: raw.sourceUserRevision === null ? null : String(raw.sourceUserRevision),
      targetFactoryRevision: String(raw.targetFactoryRevision),
      startedAt: String(raw.startedAt),
    },
  };
}

export function serializeOperationJournal(journal: ExampleLibraryOperationJournal): string {
  const check = validateOperationJournal(journal);
  if ('invalid' in check) {
    throw new ExampleLibraryStateError('Refusing to serialize invalid journal', check.invalid);
  }
  return `${JSON.stringify(check.journal, null, 2)}\n`;
}

export function parseOperationJournalText(text: string | null | undefined): ParsedSidecar<ExampleLibraryOperationJournal> {
  if (text === null || text === undefined || text.trim() === '') {
    return { kind: 'absent' };
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reasons: ['Journal file is not valid JSON'] };
  }
  const result = validateOperationJournal(decoded);
  return 'journal' in result
    ? { kind: 'loaded', value: result.journal }
    : { kind: 'invalid', reasons: result.invalid };
}

export interface AtomicWriteFileHandle {
  writeAll(contents: string): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

/** Injectable filesystem primitives for durable writes. */
export interface AtomicWriteSeams {
  open(targetPath: string): Promise<AtomicWriteFileHandle>;
  rename(fromPath: string, toPath: string): Promise<void>;
  /** Best-effort parent flush; absence or rejection is tolerated. */
  fsyncDirectory?(dirPath: string): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  uniqueSuffix?(): string;
}

let nextUniqueCounter = 0;

function defaultWriteSeams(seams?: AtomicWriteSeams): Required<AtomicWriteSeams> {
  const adaptedOpen = async (filePath: string): Promise<AtomicWriteFileHandle> => {
    const handle = await fs.promises.open(filePath, 'w', 0o600);
    return {
      async writeAll(contents: string): Promise<void> {
        await handle.write(Buffer.from(contents, 'utf8'));
      },
      sync: () => handle.sync(),
      close: () => handle.close(),
    };
  };

  return {
    open: seams?.open ?? adaptedOpen,
    rename: seams?.rename ?? ((fromPath, toPath) => fs.promises.rename(fromPath, toPath)),
    fsyncDirectory:
      seams?.fsyncDirectory
      ?? (async (dirPath) => {
        const dirFd = await fs.promises.open(dirPath, 'r');
        try {
          await dirFd.sync();
        } finally {
          await dirFd.close();
        }
      }),
    mkdir:
      seams?.mkdir
      ?? (async (dirPath) => {
        await fs.promises.mkdir(dirPath, { recursive: true });
      }),
    uniqueSuffix: seams?.uniqueSuffix ?? (() => `${Date.now().toString(36)}-${nextUniqueCounter++}`),
  };
}

/**
 * Atomic sidecar write per the contract: create parent when inside the
 * resolved library root, write a uniquely named temp sibling, flush, close,
 * rename over the target, then best-effort flush the parent directory.
 * Failures leave the previous valid target untouched.
 */
export async function writeJsonAtomically(
  targetPath: string,
  contents: string,
  options: { libraryRoot?: string; seams?: AtomicWriteSeams } = {},
): Promise<void> {
  const seams = defaultWriteSeams(options.seams);
  const parentDir = path.dirname(targetPath);

  if (options.libraryRoot !== undefined) {
    const relative = path.relative(options.libraryRoot, parentDir);
    if (relative.startsWith('..') && !path.isAbsolute(relative)) {
      throw new ExampleLibraryStateError(
        `Refusing to write outside the example-library root: ${targetPath}`,
      );
    }
  }
  await seams.mkdir(parentDir);

  const fileName = path.basename(targetPath);
  const tempPath = path.join(parentDir, `.${fileName}.${seams.uniqueSuffix()}.tmp`);

  const handle = await seams.open(tempPath);
  try {
    await handle.writeAll(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await seams.rename(tempPath, targetPath);
  } catch (err) {
    // The previous valid target remains; remove the orphan temp best-effort.
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // cleanup is best effort by contract
    }
    throw err;
  }

  try {
    await seams.fsyncDirectory(parentDir);
  } catch {
    // Platforms/filesystems rejecting directory fsync remain supported.
  }
}
