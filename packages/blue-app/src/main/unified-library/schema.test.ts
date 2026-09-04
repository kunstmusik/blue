import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createUnifiedLibraryTestDirectory } from './test-helpers';
import {
  CURRENT_LIBRARY_SCHEMA_VERSION,
  initializeUnifiedLibrarySchema,
  readUnifiedLibraryPragmas,
} from './schema';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

describe('Unified Library schema', () => {
  it('creates exactly four immutable roots and the normalized tables', () => {
    const database = new DatabaseSync(':memory:');
    cleanups.push(() => database.close());

    initializeUnifiedLibrarySchema(database, { fileBacked: false });

    const roots = database
      .prepare(
        "SELECT library_type, node_kind, parent_id FROM library_nodes WHERE node_kind = 'root' ORDER BY library_type",
      )
      .all();
    expect(roots).toEqual([
      { library_type: 'effect', node_kind: 'root', parent_id: null },
      { library_type: 'instrument', node_kind: 'root', parent_id: null },
      { library_type: 'soundObject', node_kind: 'root', parent_id: null },
      { library_type: 'udo', node_kind: 'root', parent_id: null },
    ]);

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name));
    expect(tables).toEqual(
      expect.arrayContaining([
        'import_batches',
        'import_changes',
        'import_sources',
        'library_item_payloads',
        'library_nodes',
        'library_store_state',
      ]),
    );

    expect(
      database
        .prepare('SELECT content_revision FROM library_store_state WHERE singleton_id = 1')
        .get(),
    ).toEqual({ content_revision: 0 });
    const indexes = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((row) => String(row.name));
    expect(indexes).toEqual(
      expect.arrayContaining([
        'import_batches_started_idx',
        'import_changes_source_idx',
        'import_sources_batch_idx',
        'library_nodes_one_root_per_type_idx',
        'library_nodes_parent_order_idx',
        'library_nodes_type_search_idx',
        'library_payload_duplicate_idx',
      ]),
    );
    expect(() =>
      database.exec(
        "INSERT INTO library_nodes (id, library_type, node_kind, parent_id, display_name, search_name, sort_index, revision, created_at, updated_at) VALUES ('bad', 'instrument', 'item', 'missing', 'Bad', 'bad', 0, 1, 'now', 'now')",
      ),
    ).toThrow();
  });

  it('enables required safety pragmas and schema version for a file database', () => {
    const directory = createUnifiedLibraryTestDirectory();
    const database = new DatabaseSync(directory.databasePath);
    cleanups.push(() => database.close(), directory.cleanup);

    initializeUnifiedLibrarySchema(database, { fileBacked: true });

    expect(readUnifiedLibraryPragmas(database)).toEqual({
      busyTimeout: 5000,
      foreignKeys: true,
      journalMode: 'wal',
      synchronous: 2,
      userVersion: CURRENT_LIBRARY_SCHEMA_VERSION,
    });
  });
});
