// Migration/recovery state for the Code Repository, stored in a JSON sidecar
// (`blue-code-repository-state.json`) separate from the SQLite database. Mirrors
// the unified-library migration-state-store: a crashed `inProgress` attempt is
// downgraded to `interrupted` on read, and an unreadable file never silently
// re-runs migration.

import * as fs from 'node:fs';
import * as path from 'node:path';

export type CodeRepositoryMigrationState = 'not-started' | 'succeeded' | 'failed' | 'skipped';

export interface CodeRepositoryMigrationStateDocument {
  readonly version: 1;
  readonly migrationState: CodeRepositoryMigrationState;
  readonly attemptStatus: 'idle' | 'inProgress' | 'interrupted';
  readonly lastAttemptAt: string | null;
  readonly sourcePath: string | null;
  readonly sourceHash: string | null;
  /** Includes `defaultSeed` only for state files written by earlier builds. */
  readonly sourceKind: 'automatic' | 'explicit' | 'defaultSeed' | null;
  readonly lastError: string | null;
  /** Historical seed marker retained so older state files remain readable. */
  readonly seededDefault: boolean;
}

export const DEFAULT_CODE_REPOSITORY_MIGRATION_STATE: CodeRepositoryMigrationStateDocument = {
  version: 1,
  migrationState: 'not-started',
  attemptStatus: 'idle',
  lastAttemptAt: null,
  sourcePath: null,
  sourceHash: null,
  sourceKind: null,
  lastError: null,
  seededDefault: false,
};

function isDocument(value: unknown): value is CodeRepositoryMigrationStateDocument {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CodeRepositoryMigrationStateDocument>;
  return (
    candidate.version === 1 &&
    ['not-started', 'succeeded', 'failed', 'skipped'].includes(String(candidate.migrationState)) &&
    ['idle', 'inProgress', 'interrupted'].includes(String(candidate.attemptStatus)) &&
    (candidate.lastAttemptAt === null || typeof candidate.lastAttemptAt === 'string') &&
    (candidate.sourcePath === null || typeof candidate.sourcePath === 'string') &&
    (candidate.sourceHash === null || typeof candidate.sourceHash === 'string') &&
    (candidate.sourceKind === null ||
      ['automatic', 'explicit', 'defaultSeed'].includes(String(candidate.sourceKind))) &&
    (candidate.lastError === null || typeof candidate.lastError === 'string') &&
    typeof candidate.seededDefault === 'boolean'
  );
}

export function shouldRunAutomaticMigration(
  document: CodeRepositoryMigrationStateDocument,
): boolean {
  return document.migrationState === 'not-started' && document.attemptStatus === 'idle';
}

export class CodeRepositoryMigrationStateStore {
  constructor(readonly filePath: string) {}

  load(): CodeRepositoryMigrationStateDocument {
    if (!fs.existsSync(this.filePath)) {
      return { ...DEFAULT_CODE_REPOSITORY_MIGRATION_STATE };
    }
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!isDocument(parsed)) throw new Error('Unsupported migration state document');
      return parsed.attemptStatus === 'inProgress'
        ? { ...parsed, attemptStatus: 'interrupted' }
        : parsed;
    } catch {
      return {
        ...DEFAULT_CODE_REPOSITORY_MIGRATION_STATE,
        migrationState: 'failed',
        lastError: 'Code Repository migration state is unreadable.',
      };
    }
  }

  write(document: CodeRepositoryMigrationStateDocument): void {
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

  beginAttempt(at = new Date().toISOString()): CodeRepositoryMigrationStateDocument {
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
    state: Exclude<CodeRepositoryMigrationState, 'not-started'>;
    sourcePath?: string | null;
    sourceHash?: string | null;
    sourceKind?: 'automatic' | 'explicit' | 'defaultSeed' | null;
    error?: string | null;
    seededDefault?: boolean;
    at?: string;
  }): CodeRepositoryMigrationStateDocument {
    const current = this.load();
    const next: CodeRepositoryMigrationStateDocument = {
      ...current,
      migrationState: input.state,
      attemptStatus: 'idle',
      lastAttemptAt: input.at ?? new Date().toISOString(),
      sourcePath: input.sourcePath ?? null,
      sourceHash: input.sourceHash ?? null,
      sourceKind: input.sourceKind ?? null,
      lastError: input.error?.slice(0, 1000) ?? null,
      seededDefault: input.seededDefault ?? current.seededDefault,
    };
    this.write(next);
    return next;
  }
}
