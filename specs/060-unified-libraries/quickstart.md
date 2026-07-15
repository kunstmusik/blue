# Quickstart: Implement And Verify Unified Libraries

## Goal

Implement Unified Libraries without changing `.blue` ownership/serialization, mutating Java Blue source libraries, or allowing unsupported XML to pass through lossy editors. Work in the dependency order below; do not start by replacing UI surfaces.

## Baseline Checks

From `/Users/stevenyi/work/blue-electron`:

```bash
git branch --show-current
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/app build
```

Expected branch: `060-unified-libraries`.

Before relying on the built-in database API, add an automated runtime smoke check equivalent to running the pinned Electron binary as Node and asserting:

- Electron `35.7.5`;
- Node `22.16.0` or the separately approved compatible replacement;
- `node:sqlite.DatabaseSync` exists;
- `node:sqlite.backup` exists;
- SQLite reports the expected bundled runtime.

The smoke must fail loudly if a dependency upgrade changes that surface. Keep the Electron version exact until a separately verified upgrade.

## Phase 1: Build The Compatibility Corpus First

Add fixtures/tests before codec implementation for:

- all four empty and nested roots;
- duplicate/case-different/Unicode category and item names;
- category-first Instrument/UDO/Effect ordering and mixed SoundObject ordering;
- every registered Instrument and SoundObject type;
- classic/modern UDOs, legacy Effect style/parameter-list variants, and Rhino aliases;
- unknown outer classes;
- known types containing unknown nested SoundObjects, BSB widgets, JMask/plugin/future fields;
- CDATA, comments, whitespace, entity spelling, and disallowed/external document types;
- malformed/truncated sources and a corrupt file beside three valid files;
- SoundObject portable time conversion, independent copies, shared instances, and non-portable Instance cases.

Required assertions:

- supported fixtures match Java load→save canonical behavior and reload to equivalent state;
- unsupported leaf payloads are byte-identical after parse, move, duplicate, restart simulation, and export;
- offset extraction remains exact with BMP/non-BMP Unicode before and inside leaves and never feeds documented byte offsets directly to `String.slice()`;
- no parse/preview path evaluates code, starts a process, reads a referenced path, or makes a network request;
- source XML and `~` backup hashes remain unchanged.

Run frequently:

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/data build
```

Do not mark an object supported merely because its outer loader succeeds. Recursive unknown content or canonical round-trip mismatch makes the whole item unsupported.

## Phase 2: Implement Pure `@blue/data` Codecs And Transfers

Implement:

1. pure library types and format descriptors;
2. offset-based raw envelope parsing with `@rgrove/parse-xml`;
3. recursive payload support classification;
4. safe preview/dependency extraction with explicit unavailable values;
5. validated supported serialization;
6. Java envelope export with type-specific ordering;
7. Instrument/UDO/Effect/SoundObject independent-copy helpers and SoundObject time conversion.

Fix the existing Instrument category loader/registry path under test; do not import every concrete Instrument as `GenericInstrument`.

`@blue/data` must still contain no `fs`, `path`, `child_process`, `Buffer`, `node:sqlite`, UI dependency, `require()`, dynamic import, or inline `import("...").Type` annotation.

## Phase 3: Repository And Migration-State Tests

Write repository tests against `:memory:` and temporary on-disk databases before wiring IPC.

Cover:

- schema creation and exactly four stable roots;
- `PRAGMA foreign_keys=ON`, WAL for file-backed databases, `synchronous=FULL`, busy timeout, and expected `user_version`;
- UUID stability across reopen/rename/move and new UUIDs for duplication;
- root/cycle/cross-type/name validation;
- ordering policies;
- payload/metadata/hash/revision atomic Save;
- every compound mutation rollback on injected failure;
- lazy child listing and paginated substring search at 10,000 items;
- import history/provenance and exact conditional undo;
- lock, corruption, unknown-newer-version, and migration failures;
- online pre-upgrade backup, integrity verification, and original preservation.

Implement production access through one `DatabaseSync` worker and Promise client. Repository tests may exercise the class in-process; add worker request-order/error/shutdown tests separately.

Test the dedicated state JSON across the full matrix:

```text
never/completed/skipped/failed
  × missing/empty/non-empty/corrupt/newer/locked database
```

Safety assertions:

- non-empty content never triggers automatic import;
- skipped/failed never silently retries;
- missing/corrupt database never erases the migration guard;
- malformed state plus non-empty database defaults to no automatic import;
- fresh creation is always confirmed after preserving the failed original.

## Phase 4: Import, Export, And Recovery Service

Use filesystem seams/fakes to test without touching a real `~/.blue` folder.

### Import

- Automatic migration scans four primary names only under the injected/default configuration directory.
- A `~` backup is offered/reported, never substituted silently.
- Manual Java-folder and XML-file imports always preview.
- Preview includes counts, unsupported items, exact duplicates, conflicts, ambiguous folders, and proposed behavior.
- Apply verifies source hashes and destination revisions again.
- One source equals one database transaction.
- A corrupt source leaves its hierarchy absent while valid siblings commit and appear in a partial report.
- Exact reimport creates zero nodes and retains identity.
- Same-name/different-content creates a deterministic display alias without changing raw embedded name.
- Replacement is explicit and makes undo unavailable.
- Import/import and import/export overlap is rejected by the service operation lease.

### Export

- Current-type export accepts one user type and proposes the traditional filename.
- Export All produces all four files, including empty roots.
- Preflight occurs before any write and discloses unrepresentable/subset content and overwrites.
- Unsupported payload XML remains byte-identical.
- Inject a failure after each promotion step and verify every prior destination is restored.
- Detect/recover an interrupted destination journal before allowing the next export.
- Export never writes to the imported Java source path unless the user explicitly selects it as a destination and confirms overwrite.

### Recovery

- Library failure leaves non-library project work usable.
- Retry, verified backup restore, confirmed fresh creation, and explicit Java import are offered only when applicable.
- No recovery action is silent or default-destructive.

## Phase 5: Project Adapter And Canonical Mutation Integration

Add focused main/shared tests for project browsing and transfer before renderer routing.

Verify:

| Source/action | Expected project result |
|---------------|-------------------------|
| User Instrument insert | independent deep copy, new non-colliding assignment, no overwrite |
| User UDO insert | independent new list entry, same-name entry retained |
| User Effect insert | independent enabled copy at exact validated chain position, automation/library binding detached |
| User SoundObject insert | independent Score copy at explicit path/layer/time with intended duration preserved |
| Shared SoundObject Copy Instance | new `Instance` linked to the same definition |
| Shared SoundObject Copy Independent | unlinked deep copy |

Also test:

- stale project session, channel, chain index, Score path, layer, or time-context revision produces zero mutation;
- unresolved dependencies block insertion and identify the problem;
- inserted independent objects survive project save/reopen with the user database unavailable;
- Project Shared usage counts traverse nested score containers correctly;
- deleting a shared definition removes linked instances according to the native rule in one project change;
- project UDO reorder preserves live editor identity; restart restore binds only a unique fingerprint and otherwise shows missing/ambiguous;
- Project Shared SoundObject `objRefId` values survive save/reopen/reorder through a seeded save map, while legacy/mismatched IDs use only a unique fingerprint fallback;
- every successful project operation uses the canonical revision/dirty/broadcast path.

## Phase 6: Main-Owned Editor Sessions

Test the service independently of React:

- duplicate opens return one logical session;
- base revision/hash updates only after successful Save;
- full validation failure retains saved value and draft;
- external source change returns Reload Latest / Cancel / reviewed overwrite and performs no implicit choice;
- dirty Revert requires confirmation;
- external rename/move updates identity/breadcrumb metadata;
- external delete retains a read-only missing session and draft;
- dirty delete requires Save/Discard/Cancel;
- quit and project close/switch aggregate affected sessions and Cancel blocks the outer action;
- user-item Save persists independently of project state;
- project-item Save marks project dirty and uses its native consequence;
- shared SoundObject Save reports and affects the current linked-instance count.

Then adapt existing controlled editor bodies. Avoid creating parallel type-specific persistence paths.

## Phase 7: Workbench And Renderer

Implement the shell/layout migration before contextual routes:

1. Always mount `WorkbenchShell`; render Welcome as a central panel with no project.
2. Add one static `LibrariesTopComponent` in the right properties group.
3. Bump/migrate the workbench envelope across Dockview, auxiliary, minimized, slide-out, floating, and closed-origin state.
4. Add dynamic `libraryItemEditor` panels with stable persisted parameters and missing-item restore.
5. Add library/view stores for lazy hierarchy, filters, search, selection, target banner, and actions.
6. Reuse/generalize the existing Effects tree behavior rather than maintaining two trees.
7. Add controlled Instrument/UDO/Effect/SoundObject editor bodies.

Renderer acceptance tests:

- no-project browse/search/preview/edit/import/export/history/recovery;
- All and four type filters; case-insensitive substring search; duplicate-name disambiguation;
- explicit unavailable preview fields and unsupported warning/read-only behavior;
- one clean preview tab may be replaced; dirty/explicitly pinned tabs never are;
- first edit pins automatically; duplicate open focuses existing tab;
- closing Libraries leaves editor sessions unchanged;
- stale target disables Insert and explains why;
- Save/Revert/conflict/missing states mirror main snapshots;
- accessible `Library Actions` menu contains all required commands.

## Phase 8: Contextual Routes And Legacy Retirement

Route all entry points to the same panel:

- Orchestra → Instruments + Project Orchestra target;
- project UDO editor → UDOs + project UDO target;
- mixer chain → Effects + exact chain position;
- Score → SoundObjects + explicit path/layer/time;
- legacy Effects Library menu → Effects with no fabricated target;
- Window menu → focus/reveal current Libraries placement.

After callers migrate and tests pass:

- remove `EffectLibraryModal` and `effectsLibraryOpen/effectsLibraryTarget` renderer state;
- remove the session-only Effects repository as source of truth;
- remove `TemporaryInstrumentLibraryPanel` and its active split region;
- remove embedded mixer category menus that bypass the centralized target workflow;
- retain only intentionally needed project Effect editor windows and reusable editor bodies.

## Full Verification

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/app build
pnpm test
pnpm build
git diff --check
```

Add platform/package smoke coverage for macOS arm64/x64, Windows x64, and Linux x64 before release. Verify the built application opens the user-data database through bundled `node:sqlite`, performs one transaction, runs backup, and reloads the result.

## Manual Acceptance Pass

Use a disposable Electron user-data directory and copied Java fixtures; never point destructive tests at the real configuration.

1. Start with `never` + no database + four valid Java files; confirm per-type migration summary and unchanged source hashes.
2. Repeat with one corrupt file and three valid files; confirm partial success and normal app use.
3. Start with no Java files; confirm empty usable store, `skipped`, and no scan on restart.
4. Browse/edit a user item with no project; restart and confirm identity/content.
5. Open two pinned item editors plus a clean preview; change selection 100 times and confirm no pinned/dirty replacement.
6. Create an external edit conflict and exercise all three choices.
7. Insert each type into a valid project target, save, hide/remove the user database, reopen the project, and verify independent/shared behavior.
8. Delete a shared SoundObject definition with linked instances and confirm counts/removal.
9. Export all four formats, import them into an empty disposable store, and compare hierarchy/order/content/reports.
10. Inject export replacement failure and verify every prior destination file.
11. Corrupt/lock the database; confirm recovery choices and continued project work.
12. Restore layouts from legacy versions containing the old SoundObject panel in docked, minimized, floating, and closed states; confirm exactly one Libraries panel.

## Verification Record — 2026-07-15

No acceptance expectations changed during implementation.

The full acceptance matrix was executed against disposable temporary databases, copied XML fixtures, and headless DOM workbench fixtures. No real Java Blue configuration or user-data directory was used.

| Matrix coverage | Verification evidence |
|-----------------|-----------------------|
| Four valid first-run sources, partial migration with one corrupt source, no-source skip, unchanged source bytes | `automatic-migration.test.ts`, `automatic-migration-recovery.test.ts`, `migration-state-store.test.ts` |
| No-project browse/search/preview/edit and restart-stable identity | `browse-search.test.ts`, `repository.test.ts`, `library-store.test.ts`, `libraries-panel.test.tsx` |
| Two pinned editors, one clean preview, and 100 selection changes | `editor-session-service.test.ts` |
| Reload Latest, reviewed Overwrite, and Cancel conflict choices | `editor-session-service.test.ts`, `library-editing.test.tsx` |
| Instrument, UDO, Effect, independent SoundObject, and shared SoundObject insertion plus stale-target rejection and reopen portability | `project-transfer.test.ts`, `library-transfer.test.ts`, `library-target-routing.test.tsx` |
| Shared SoundObject usage counting and guarded definition/instance deletion | `project-item-editing.test.ts` |
| Four-format Export All, import/reimport, exact duplicate handling, history, and conditional undo | `export-compatibility.test.ts`, `manual-import-preview.test.ts`, `manual-import-execution.test.ts`, `library-interchange.test.tsx` |
| Atomic export rollback restores every prior destination | `export-transaction.test.ts` |
| Corrupt, locked, newer-version, backup, fresh-store, and non-library failure isolation choices | `repository-recovery.test.ts`, `schema-upgrade.test.ts`, `service-recovery.test.ts`, `failure-isolation.test.ts`, `library-recovery.test.tsx` |
| Accessible actions/tree/dialogs and legacy docked/minimized/floating/closed layout convergence | `libraries-panel.test.tsx`, `library-editing.test.tsx`, `unified-library-workbench.test.tsx`, `workbench-auxiliary.test.ts`, `workbench-store.test.ts` |

Commands and results:

```text
pnpm test
  PASS — @blue/data 1,266; @blue/app 2,010 passed / 2 skipped;
         @blue/engine-client 18; blue-cli 5; Java Maven suite passed
pnpm build
  PASS — all workspace packages, Electron main/preload, and Vite renderer
pnpm lint
  PASS — all configured workspace lint targets
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/unified-library/performance.test.ts --reporter=verbose
  PASS — 10,000-item browse/search/preview/pagination test in 575 ms
git diff --check
  PASS
```

The Vite large-chunk notice and Node's experimental `node:sqlite` notice remain informational; the exact Electron/Node/SQLite runtime is pinned and covered by `sqlite-runtime.test.ts` and the CI packaged smoke matrix.

## Completion Gate

The feature is ready for closeout only when:

- all 73 functional requirements and 13 success criteria map to automated or documented manual verification;
- the four-format compatibility corpus passes;
- no unsupported payload is silently changed, omitted, or made insertable;
- repository/import/export/upgrade failure injection leaves prior data complete or recoverable;
- every project insertion passes stale-target and portability tests;
- no dirty/pinned editor loses or silently overwrites a draft;
- the 10,000-item benchmark meets SC-006;
- Java source files and backups remain byte-for-byte unchanged;
- no duplicate legacy library surface remains.
