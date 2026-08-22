// Failure classification and backup verification for the Code Repository.
// Mirrors the unified-library recovery helpers, which the service uses to turn
// thrown database errors into a typed failure snapshot.

import * as fs from 'node:fs';
import { backup, DatabaseSync } from 'node:sqlite';

export interface CodeRepositoryFailureSnapshot {
  readonly kind: 'version' | 'integrity' | 'lock' | 'worker' | 'open';
  readonly message: string;
  readonly retryable: boolean;
}

export function classifyCodeRepositoryFailure(error: unknown): CodeRepositoryFailureSnapshot {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  const lower = message.toLocaleLowerCase();
  const kind: CodeRepositoryFailureSnapshot['kind'] =
    lower.includes('newer') || lower.includes('user_version')
      ? 'version'
      : lower.includes('malformed') ||
          lower.includes('integrity') ||
          lower.includes('not a database')
        ? 'integrity'
        : lower.includes('locked') || lower.includes('busy')
          ? 'lock'
          : lower.includes('worker')
            ? 'worker'
            : 'open';
  return { kind, message, retryable: kind !== 'version' };
}

export async function verifyCodeRepositoryBackup(backupPath: string): Promise<boolean> {
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

export async function createVerifiedCodeRepositoryBackup(
  databasePath: string,
  backupPath: string,
): Promise<void> {
  const source = new DatabaseSync(databasePath, { readOnly: true });
  try {
    await backup(source, backupPath);
  } finally {
    source.close();
  }
  if (!(await verifyCodeRepositoryBackup(backupPath))) {
    throw new Error('Code Repository backup failed integrity verification');
  }
}
