import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryMigrationStateStore, shouldRunAutomaticMigration } from './migration-state-store';

const directories: string[] = [];
function fixture(): LibraryMigrationStateStore {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-library-state-'));
  directories.push(directory);
  return new LibraryMigrationStateStore(path.join(directory, 'blue-libraries-state.json'));
}
afterEach(() => {
  for (const directory of directories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

describe('library migration state store', () => {
  it('persists never, in-progress, interrupted, completed, partial, skipped, and failed states atomically', () => {
    const store = fixture();
    expect(store.load().legacyMigrationState).toBe('never');
    store.beginAttempt('2026-07-15T00:00:00.000Z');
    expect(JSON.parse(fs.readFileSync(store.filePath, 'utf8')).attemptStatus).toBe('inProgress');
    expect(store.load().attemptStatus).toBe('interrupted');
    expect(
      store.finishAttempt({ state: 'completed', resultKind: 'partial', batchId: 'batch-1' }),
    ).toMatchObject({ legacyMigrationState: 'completed', lastResultKind: 'partial' });
    expect(
      store.finishAttempt({ state: 'skipped', resultKind: 'noSources', batchId: null }),
    ).toMatchObject({ legacyMigrationState: 'skipped' });
    expect(
      store.finishAttempt({
        state: 'failed',
        resultKind: 'pipelineFailure',
        batchId: null,
        error: 'disk',
      }),
    ).toMatchObject({ legacyMigrationState: 'failed', lastError: 'disk' });
    expect(fs.existsSync(`${store.filePath}.tmp`)).toBe(false);
  });

  it('suppresses automatic migration for nonempty stores and malformed state', () => {
    const store = fixture();
    expect(shouldRunAutomaticMigration(store.load(), 0)).toBe(true);
    expect(shouldRunAutomaticMigration(store.load(), 1)).toBe(false);
    fs.writeFileSync(store.filePath, '{broken', 'utf8');
    const safe = store.load();
    expect(safe.legacyMigrationState).toBe('failed');
    expect(shouldRunAutomaticMigration(safe, 0)).toBe(false);
  });
});
