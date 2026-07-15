import * as fs from 'node:fs';
import { backup, DatabaseSync } from 'node:sqlite';
import type { LibraryFailureSnapshot } from '../../shared/unified-library';

export function classifyRepositoryFailure(error: unknown): LibraryFailureSnapshot {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  const lower = message.toLocaleLowerCase();
  const kind: LibraryFailureSnapshot['kind'] = lower.includes('newer') || lower.includes('user_version')
    ? 'version'
    : lower.includes('malformed') || lower.includes('integrity') || lower.includes('not a database')
      ? 'integrity'
      : lower.includes('locked') || lower.includes('busy')
        ? 'lock'
        : lower.includes('worker')
          ? 'worker'
          : lower.includes('upgrade')
            ? 'upgrade'
            : 'open';
  return { kind, message, retryable: kind !== 'version' };
}

export async function verifyRepositoryBackup(backupPath: string): Promise<boolean> {
  if (!fs.existsSync(backupPath)) return false;
  let database: DatabaseSync | null = null;
  try {
    database = new DatabaseSync(backupPath, { readOnly: true });
    const row = database.prepare('PRAGMA integrity_check').get();
    return String(row ? Object.values(row)[0] : '') === 'ok';
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

export async function createVerifiedRepositoryBackup(
  databasePath: string,
  backupPath: string,
): Promise<void> {
  const source = new DatabaseSync(databasePath, { readOnly: true });
  try {
    await backup(source, backupPath);
  } finally {
    source.close();
  }
  if (!(await verifyRepositoryBackup(backupPath))) {
    throw new Error('Repository backup failed integrity verification');
  }
}
