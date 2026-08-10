import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import {
  DEFAULT_CODE_REPOSITORY_MIGRATION_STATE,
  CodeRepositoryMigrationStateStore,
  shouldRunAutomaticMigration,
} from './migration-state-store';
import { createCodeRepositoryTestDirectory } from './test-helpers';

describe('CodeRepositoryMigrationStateStore', () => {
  it('returns the default document when no state file exists', () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const store = new CodeRepositoryMigrationStateStore(dir.statePath);
      expect(store.load()).toEqual(DEFAULT_CODE_REPOSITORY_MIGRATION_STATE);
    } finally {
      dir.cleanup();
    }
  });

  it('persists a finished attempt and re-reads it', () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const store = new CodeRepositoryMigrationStateStore(dir.statePath);
      store.beginAttempt();
      const finished = store.finishAttempt({
        state: 'succeeded',
        sourcePath: '/legacy/codeRepository.xml',
        sourceHash: 'abc',
        sourceKind: 'automatic',
      });
      expect(finished.migrationState).toBe('succeeded');
      expect(finished.sourceHash).toBe('abc');

      const reopened = new CodeRepositoryMigrationStateStore(dir.statePath);
      const loaded = reopened.load();
      expect(loaded.migrationState).toBe('succeeded');
      expect(loaded.sourcePath).toBe('/legacy/codeRepository.xml');
    } finally {
      dir.cleanup();
    }
  });

  it('retains historical default-seed provenance across later attempts', () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const store = new CodeRepositoryMigrationStateStore(dir.statePath);
      store.finishAttempt({
        state: 'skipped',
        sourceKind: 'defaultSeed',
        seededDefault: true,
      });
      const later = store.finishAttempt({
        state: 'failed',
        sourceKind: 'explicit',
        error: 'invalid XML',
      });
      expect(later.seededDefault).toBe(true);
    } finally {
      dir.cleanup();
    }
  });

  it('downgrades an interrupted inProgress attempt on read', () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      const store = new CodeRepositoryMigrationStateStore(dir.statePath);
      store.beginAttempt();
      // Simulate a crash: reopen without finishing.
      const reopened = new CodeRepositoryMigrationStateStore(dir.statePath);
      expect(reopened.load().attemptStatus).toBe('interrupted');
    } finally {
      dir.cleanup();
    }
  });

  it('reports a failed document when the state file is corrupt', () => {
    const dir = createCodeRepositoryTestDirectory();
    try {
      fs.writeFileSync(dir.statePath, '{ not valid json', 'utf8');
      const store = new CodeRepositoryMigrationStateStore(dir.statePath);
      const loaded = store.load();
      expect(loaded.migrationState).toBe('failed');
      expect(loaded.lastError).toContain('unreadable');
    } finally {
      dir.cleanup();
    }
  });

  it('shouldRunAutomaticMigration is true only for idle not-started state', () => {
    expect(shouldRunAutomaticMigration(DEFAULT_CODE_REPOSITORY_MIGRATION_STATE)).toBe(true);
    expect(
      shouldRunAutomaticMigration({
        ...DEFAULT_CODE_REPOSITORY_MIGRATION_STATE,
        attemptStatus: 'interrupted',
      }),
    ).toBe(false);
    expect(
      shouldRunAutomaticMigration({
        ...DEFAULT_CODE_REPOSITORY_MIGRATION_STATE,
        migrationState: 'succeeded',
      }),
    ).toBe(false);
  });
});
