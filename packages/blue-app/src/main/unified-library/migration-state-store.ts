import * as fs from 'node:fs';
import * as path from 'node:path';

export type LegacyMigrationState = 'never' | 'completed' | 'skipped' | 'failed';
export type LibraryMigrationResultKind =
  | 'none'
  | 'complete'
  | 'partial'
  | 'noSources'
  | 'pipelineFailure';

export interface LibraryBackupDescriptor {
  readonly id: string;
  readonly fileName: string;
  readonly createdAt: string;
  readonly reason: 'schemaUpgrade';
  readonly sourceUserVersion: number;
  readonly integrityVerified: boolean;
}

export interface LibraryMigrationStateDocument {
  readonly version: 1;
  readonly legacyMigrationState: LegacyMigrationState;
  readonly attemptStatus: 'idle' | 'inProgress' | 'interrupted';
  readonly lastAttemptAt: string | null;
  readonly lastImportBatchId: string | null;
  readonly lastResultKind: LibraryMigrationResultKind;
  readonly lastError: string | null;
  readonly knownBackups: readonly LibraryBackupDescriptor[];
}

export const DEFAULT_LIBRARY_MIGRATION_STATE: LibraryMigrationStateDocument = {
  version: 1,
  legacyMigrationState: 'never',
  attemptStatus: 'idle',
  lastAttemptAt: null,
  lastImportBatchId: null,
  lastResultKind: 'none',
  lastError: null,
  knownBackups: [],
};

function isDocument(value: unknown): value is LibraryMigrationStateDocument {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LibraryMigrationStateDocument>;
  return (
    candidate.version === 1 &&
    ['never', 'completed', 'skipped', 'failed'].includes(String(candidate.legacyMigrationState)) &&
    ['idle', 'inProgress', 'interrupted'].includes(String(candidate.attemptStatus)) &&
    ['none', 'complete', 'partial', 'noSources', 'pipelineFailure'].includes(
      String(candidate.lastResultKind),
    ) &&
    (candidate.lastAttemptAt === null || typeof candidate.lastAttemptAt === 'string') &&
    (candidate.lastImportBatchId === null || typeof candidate.lastImportBatchId === 'string') &&
    (candidate.lastError === null || typeof candidate.lastError === 'string') &&
    Array.isArray(candidate.knownBackups)
  );
}

export function shouldRunAutomaticMigration(
  document: LibraryMigrationStateDocument,
  itemCount: number,
): boolean {
  return (
    itemCount === 0 &&
    document.legacyMigrationState === 'never' &&
    document.attemptStatus === 'idle'
  );
}

export class LibraryMigrationStateStore {
  constructor(readonly filePath: string) {}

  load(): LibraryMigrationStateDocument {
    if (!fs.existsSync(this.filePath)) return { ...DEFAULT_LIBRARY_MIGRATION_STATE };
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!isDocument(parsed)) throw new Error('Unsupported migration state document');
      return parsed.attemptStatus === 'inProgress'
        ? { ...parsed, attemptStatus: 'interrupted' }
        : parsed;
    } catch (error) {
      return {
        ...DEFAULT_LIBRARY_MIGRATION_STATE,
        legacyMigrationState: 'failed',
        lastResultKind: 'pipelineFailure',
        lastError:
          `Migration state is unreadable: ${error instanceof Error ? error.message : String(error)}`.slice(
            0,
            1000,
          ),
      };
    }
  }

  write(document: LibraryMigrationStateDocument): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    const descriptor = fs.openSync(temporaryPath, 'w', 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryPath, this.filePath);
    try {
      const directory = fs.openSync(path.dirname(this.filePath), 'r');
      try {
        fs.fsyncSync(directory);
      } finally {
        fs.closeSync(directory);
      }
    } catch {
      // Some supported filesystems do not allow syncing a directory handle.
    }
  }

  beginAttempt(at = new Date().toISOString()): LibraryMigrationStateDocument {
    const next = {
      ...this.load(),
      attemptStatus: 'inProgress' as const,
      lastAttemptAt: at,
      lastError: null,
    };
    this.write(next);
    return next;
  }

  finishAttempt(input: {
    state: Exclude<LegacyMigrationState, 'never'>;
    resultKind: Exclude<LibraryMigrationResultKind, 'none'>;
    batchId: string | null;
    error?: string | null;
    at?: string;
  }): LibraryMigrationStateDocument {
    const next: LibraryMigrationStateDocument = {
      ...this.load(),
      legacyMigrationState: input.state,
      attemptStatus: 'idle',
      lastAttemptAt: input.at ?? new Date().toISOString(),
      lastImportBatchId: input.batchId,
      lastResultKind: input.resultKind,
      lastError: input.error?.slice(0, 1000) ?? null,
    };
    this.write(next);
    return next;
  }
}
