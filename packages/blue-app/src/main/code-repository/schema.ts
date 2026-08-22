import { DatabaseSync } from 'node:sqlite';
import { CODE_REPOSITORY_ROOT_ID } from '@blue/data';

/** Forward-only schema version for the Code Repository database. */
export const CURRENT_CODE_REPOSITORY_SCHEMA_VERSION = 1;

/** Stable, protected root id for the single repository tree. */
export const CODE_REPOSITORY_DB_ROOT_ID = CODE_REPOSITORY_ROOT_ID;

export interface CodeRepositoryPragmas {
  readonly busyTimeout: number;
  readonly foreignKeys: boolean;
  readonly journalMode: string;
  readonly synchronous: number;
  readonly userVersion: number;
}

function readPragmaValue(database: DatabaseSync, pragma: string): unknown {
  const row = database.prepare(`PRAGMA ${pragma}`).get();
  return row ? Object.values(row)[0] : undefined;
}

export function readCodeRepositoryPragmas(database: DatabaseSync): CodeRepositoryPragmas {
  return {
    busyTimeout: Number(readPragmaValue(database, 'busy_timeout')),
    foreignKeys: Number(readPragmaValue(database, 'foreign_keys')) === 1,
    journalMode: String(readPragmaValue(database, 'journal_mode')).toLowerCase(),
    synchronous: Number(readPragmaValue(database, 'synchronous')),
    userVersion: Number(readPragmaValue(database, 'user_version')),
  };
}

/**
 * Initialize the Code Repository schema and seed the protected root. Mirrors
 * the unified-library schema pattern: forward-only `user_version`, pragmas,
 * `CREATE TABLE IF NOT EXISTS`, and `INSERT OR IGNORE` for the singleton root.
 */
export function initializeCodeRepositorySchema(
  database: DatabaseSync,
  options: { readonly fileBacked: boolean },
): void {
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec('PRAGMA synchronous = FULL');
  database.exec('PRAGMA trusted_schema = OFF');
  if (options.fileBacked) database.exec('PRAGMA journal_mode = WAL');

  const existingVersion = Number(readPragmaValue(database, 'user_version'));
  if (existingVersion > CURRENT_CODE_REPOSITORY_SCHEMA_VERSION) {
    throw new Error(`Unsupported newer Code Repository schema version: ${existingVersion}`);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS code_repository_nodes (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES code_repository_nodes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('root', 'group', 'snippet')),
      display_name TEXT NOT NULL,
      code_text TEXT,
      sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK ((kind = 'root' AND parent_id IS NULL AND code_text IS NULL)
             OR (kind = 'group' AND parent_id IS NOT NULL AND code_text IS NULL)
             OR (kind = 'snippet' AND parent_id IS NOT NULL AND code_text IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS code_repository_state (
      singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
      content_revision INTEGER NOT NULL CHECK(content_revision >= 0),
      initialized INTEGER NOT NULL CHECK(initialized IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS code_repository_imports (
      id TEXT PRIMARY KEY,
      source_path TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      source_kind TEXT NOT NULL CHECK(source_kind IN ('automatic', 'explicit', 'defaultSeed')),
      status TEXT NOT NULL CHECK(status IN ('succeeded', 'failed', 'skipped')),
      node_count INTEGER,
      diagnostics TEXT,
      imported_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS code_repository_nodes_parent_order_idx
      ON code_repository_nodes(parent_id, sort_order, id);
    DROP INDEX IF EXISTS code_repository_one_root_idx;
    CREATE UNIQUE INDEX code_repository_one_root_idx
      ON code_repository_nodes(kind) WHERE kind = 'root';
    CREATE INDEX IF NOT EXISTS code_repository_imports_hash_idx
      ON code_repository_imports(source_hash, status);
  `);

  const now = Date.now();
  database
    .prepare(
      `INSERT OR IGNORE INTO code_repository_nodes (
        id, parent_id, kind, display_name, code_text, sort_order, created_at, updated_at
      ) VALUES (?, NULL, 'root', 'Code Repository', NULL, 0, ?, ?)`,
    )
    .run(CODE_REPOSITORY_DB_ROOT_ID, now, now);
  database
    .prepare(
      `INSERT OR IGNORE INTO code_repository_state (
        singleton_id, content_revision, initialized, created_at, updated_at
      ) VALUES (1, 0, 0, ?, ?)`,
    )
    .run(now, now);
  database.exec(`PRAGMA user_version = ${CURRENT_CODE_REPOSITORY_SCHEMA_VERSION}`);

  const pragmas = readCodeRepositoryPragmas(database);
  if (!pragmas.foreignKeys) {
    throw new Error('Code Repository foreign keys are disabled');
  }
}
