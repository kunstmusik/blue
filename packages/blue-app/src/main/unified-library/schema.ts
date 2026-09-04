import { DatabaseSync } from 'node:sqlite';
import type { LibraryType } from '../../shared/unified-library';

export const CURRENT_LIBRARY_SCHEMA_VERSION = 1;

const ROOT_IDS: Readonly<Record<LibraryType, string>> = {
  instrument: '10000000-0000-4000-8000-000000000001',
  udo: '10000000-0000-4000-8000-000000000002',
  soundObject: '10000000-0000-4000-8000-000000000003',
  effect: '10000000-0000-4000-8000-000000000004',
};

const ROOT_NAMES: Readonly<Record<LibraryType, string>> = {
  instrument: 'Instrument Library',
  udo: 'UDO Library',
  soundObject: 'SoundObject Library',
  effect: 'Effect Library',
};

export interface UnifiedLibraryPragmas {
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

export function readUnifiedLibraryPragmas(database: DatabaseSync): UnifiedLibraryPragmas {
  return {
    busyTimeout: Number(readPragmaValue(database, 'busy_timeout')),
    foreignKeys: Number(readPragmaValue(database, 'foreign_keys')) === 1,
    journalMode: String(readPragmaValue(database, 'journal_mode')).toLowerCase(),
    synchronous: Number(readPragmaValue(database, 'synchronous')),
    userVersion: Number(readPragmaValue(database, 'user_version')),
  };
}

export function initializeUnifiedLibrarySchema(
  database: DatabaseSync,
  options: { readonly fileBacked: boolean },
): void {
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec('PRAGMA synchronous = FULL');
  database.exec('PRAGMA trusted_schema = OFF');
  if (options.fileBacked) database.exec('PRAGMA journal_mode = WAL');

  const existingVersion = Number(readPragmaValue(database, 'user_version'));
  if (existingVersion > CURRENT_LIBRARY_SCHEMA_VERSION) {
    throw new Error(`Unsupported newer Unified Library schema version: ${existingVersion}`);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('automatic', 'manualJavaFolder', 'manualXmlFiles')),
      status TEXT NOT NULL CHECK (status IN ('previewed', 'running', 'completed', 'partial', 'failed', 'undone')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
      counts_json TEXT NOT NULL DEFAULT '{}',
      report_json TEXT NOT NULL DEFAULT '{}',
      undo_eligible INTEGER NOT NULL DEFAULT 0 CHECK (undo_eligible IN (0, 1)),
      undo_blocked_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS library_nodes (
      id TEXT PRIMARY KEY,
      library_type TEXT NOT NULL CHECK (library_type IN ('instrument', 'udo', 'soundObject', 'effect')),
      node_kind TEXT NOT NULL CHECK (node_kind IN ('root', 'folder', 'item')),
      parent_id TEXT REFERENCES library_nodes(id) ON DELETE RESTRICT,
      display_name TEXT NOT NULL,
      search_name TEXT NOT NULL,
      sort_index INTEGER NOT NULL CHECK (sort_index >= 0),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by_import_batch_id TEXT REFERENCES import_batches(id),
      CHECK ((node_kind = 'root' AND parent_id IS NULL) OR (node_kind <> 'root' AND parent_id IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS library_item_payloads (
      node_id TEXT PRIMARY KEY REFERENCES library_nodes(id) ON DELETE CASCADE,
      embedded_name TEXT,
      object_type TEXT NOT NULL,
      support_status TEXT NOT NULL CHECK (support_status IN ('supported', 'unsupported')),
      support_reason_code TEXT,
      support_message TEXT,
      payload_xml TEXT NOT NULL,
      raw_hash TEXT NOT NULL,
      canonical_content_hash TEXT NOT NULL,
      serializer_revision TEXT,
      preview_json TEXT NOT NULL,
      dependency_json TEXT NOT NULL,
      metadata_revision INTEGER NOT NULL CHECK (metadata_revision > 0)
    );

    CREATE TABLE IF NOT EXISTS library_store_state (
      singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
      content_revision INTEGER NOT NULL CHECK (content_revision >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_sources (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
      library_type TEXT CHECK (library_type IN ('instrument', 'udo', 'soundObject', 'effect')),
      source_kind TEXT NOT NULL CHECK (source_kind IN ('primary', 'backupCandidate', 'selectedFile')),
      source_path TEXT NOT NULL,
      source_raw_hash TEXT,
      status TEXT NOT NULL CHECK (status IN ('recognized', 'imported', 'skipped', 'failed', 'backupOffered')),
      counts_json TEXT NOT NULL DEFAULT '{}',
      diagnostics_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS import_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE,
      node_id TEXT REFERENCES library_nodes(id) ON DELETE SET NULL,
      action TEXT NOT NULL CHECK (action IN ('created', 'exactDuplicateSkipped', 'aliasedConflictCreated', 'replaced', 'validationSkipped')),
      recorded_revision INTEGER,
      detail_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS library_nodes_parent_order_idx
      ON library_nodes(parent_id, library_type, node_kind, sort_index, id);
    CREATE INDEX IF NOT EXISTS library_nodes_type_search_idx
      ON library_nodes(library_type, search_name, id);
    CREATE INDEX IF NOT EXISTS library_payload_duplicate_idx
      ON library_item_payloads(canonical_content_hash, object_type, node_id);
    CREATE INDEX IF NOT EXISTS import_batches_started_idx
      ON import_batches(started_at DESC, id);
    CREATE INDEX IF NOT EXISTS import_sources_batch_idx
      ON import_sources(batch_id, id);
    CREATE INDEX IF NOT EXISTS import_changes_source_idx
      ON import_changes(source_id, id);
    CREATE UNIQUE INDEX IF NOT EXISTS library_nodes_one_root_per_type_idx
      ON library_nodes(library_type) WHERE node_kind = 'root';
  `);

  const now = new Date().toISOString();
  const insertRoot = database.prepare(`
    INSERT OR IGNORE INTO library_nodes (
      id, library_type, node_kind, parent_id, display_name, search_name,
      sort_index, revision, created_at, updated_at, created_by_import_batch_id
    ) VALUES (?, ?, 'root', NULL, ?, ?, 0, 1, ?, ?, NULL)
  `);
  for (const libraryType of Object.keys(ROOT_IDS) as LibraryType[]) {
    insertRoot.run(
      ROOT_IDS[libraryType],
      libraryType,
      ROOT_NAMES[libraryType],
      ROOT_NAMES[libraryType].normalize('NFKC').toLocaleLowerCase(),
      now,
      now,
    );
  }
  database
    .prepare(
      `
      INSERT OR IGNORE INTO library_store_state (
        singleton_id, content_revision, created_at, updated_at
      ) VALUES (1, 0, ?, ?)
    `,
    )
    .run(now, now);
  database.exec(`PRAGMA user_version = ${CURRENT_LIBRARY_SCHEMA_VERSION}`);

  const pragmas = readUnifiedLibraryPragmas(database);
  if (!pragmas.foreignKeys) throw new Error('Unified Library foreign keys are disabled');
}

export function getUnifiedLibraryRootId(libraryType: LibraryType): string {
  return ROOT_IDS[libraryType];
}
