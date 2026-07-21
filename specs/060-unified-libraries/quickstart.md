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

Implement the shell/layout migration before direct-manipulation routes:

1. Always mount `WorkbenchShell`; render Welcome as the standalone full-window surface outside Dockview when no project is open.
2. Add one static user-only `LibrariesTopComponent` plus a separate project `SoundObjectLibraryTopComponent` in the right properties group.
3. Bump/migrate the workbench envelope across Dockview, auxiliary, minimized, slide-out, floating, and closed-origin state.
4. Add one transient dynamic `libraryItemEditor` panel titled `Library Item`, with the existing address/breadcrumb header, native type-specific bodies, and retained dirty/pinned sessions that reopen by item identity. Remove session-bound panels during saved-layout restoration.
5. Add library/view stores for complete cursor-drained user hierarchy, type filtering, search, selection, transient typed clipboard state, stale-response protection, and one compact vertical-ellipsis import/export menu. Keep Project SoundObjects in their separate panel and project UDOs in the reusable UDO workspace.
6. Use one reusable accessible `LibraryTree` for every Unified Libraries root and project SoundObject collection; keep the legacy Effects tree isolated until its remaining non-library editor callers retire.
7. Add controlled Instrument/UDO/Effect/SoundObject editor bodies and remove the supported-item raw XML textarea.
8. Add inline double-click/F2 rename and scoped right-click/keyboard context menus; remove persistent row CRUD and Insert controls.

Renderer acceptance tests:

- no-project browse/search/edit/import/export/recovery without project-source chrome;
- All and four type filters; case-insensitive substring search; duplicate-name disambiguation;
- unsupported warning/read-only behavior without default raw XML display;
- supported selections render the full native type editor under the address header;
- one clean preview tab may be replaced; dirty/explicitly pinned tabs never are;
- first edit pins automatically; duplicate open focuses existing tab;
- closing Libraries leaves editor sessions unchanged;
- tree rows have no persistent Rename/Duplicate/Delete/Insert buttons; context menus have mouse/keyboard parity;
- stale or invalid project targets reject drop/Paste with exact feedback and zero mutation;
- Save/Revert/conflict/missing states mirror main snapshots;
- accessible `Library actions` ellipsis menu contains Import XML, Import Java Configuration Directory, Export Current, and Export All, excludes migration/history commands, and is the only persistent action affordance in the healthy header;
- expanding a user folder or paged project collection drains every cursor page and shows every child exactly once in stable order;

## Phase 8: Direct Placement And Legacy Retirement

Route typed drag/drop and destination Paste through the existing main preview/apply service:

- Orchestra accepts Instruments at exact table row/end boundaries;
- project UDO editor accepts UDOs at exact table row/end boundaries;
- mixer pre/post chains accept Effects at exact insertion gaps;
- Score accepts SoundObjects at explicit path/layer/time coordinates;
- shared SoundObjects require the existing explicit instance/independent choice;
- legacy Effects Library menu reveals Effects with no fabricated target;
- Window menu focuses/reveals current Libraries placement.

After callers migrate and tests pass:

- remove `EffectLibraryModal` and `effectsLibraryOpen/effectsLibraryTarget` renderer state;
- remove the session-only Effects repository as source of truth;
- remove `TemporaryInstrumentLibraryPanel` and its active split region;
- remove embedded mixer category menus that bypass the centralized target workflow;
- remove `Browse Instruments`, `Browse UDO Library`, `Browse SoundObjects`, and `Add Effect from Library…` controls;
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

1. Start with `never` + no database + four valid Java files; confirm silent healthy migration, populated user roots, internal audit data, and unchanged source hashes.
2. Repeat with one corrupt file and three valid files; confirm partial success and normal app use.
3. Start with no Java files; confirm empty usable store, `skipped`, and no scan on restart.
4. Browse/edit a user item with no project; restart and confirm identity/content.
5. Retain two pinned/dirty native editor sessions while switching the single visible `Library Item` tab through 100 selections; confirm every protected session reappears by identity and no supported item uses a raw XML textarea.
6. Create an external edit conflict and exercise all three choices.
7. Drop and keyboard-Paste each type into an exact valid project target, save, hide/remove the user database, reopen the project, and verify independent/shared behavior; repeat with stale/invalid targets and verify zero mutation.
8. Delete a shared SoundObject definition with linked instances and confirm counts/removal.
9. Export all four formats, import them into an empty disposable store, and compare hierarchy/order/content/reports.
10. Inject export replacement failure and verify every prior destination file.
11. Corrupt/lock the database; confirm recovery choices and continued project work.
12. Restore layouts containing `LibrariesTopComponent` and `SoundObjectLibraryTopComponent` in docked, minimized, floating, and closed states; confirm both identities survive and remain independently revealable.
13. Verify the healthy Libraries panel has collapsed user roots and no source filter, Current Project section, no-project text, migration/history UI, persistent action banner, row CRUD buttons, Browse buttons, or Insert button; exercise all node operations by right-click and `Shift+F10`/Context Menu key, including Paste on an item targeting its parent and Move Up/Down ordering.
14. Verify a normal Instrument and user SoundObject transfer shows only its result toast, a Project Shared SoundObject still offers the real copy-choice dialog, and a SoundObject drag whose custom data is protected during hover still inserts at the exact Score target after drop validation.
15. Import both selected XML files and a selected Java configuration directory; resolve duplicate-folder candidates by breadcrumb and stable identity; then verify a canceled overwrite changes no export destination.
16. Expand a folder and Project SoundObject/UDO collection containing more than 500 entries and verify the last child appears once, in repository order, without resetting scroll state.

## Verification Record — Corrective UX, 2026-07-16

The corrective renderer, direct-placement, organization, editor-session, migration, interchange, and recovery slices were verified against disposable in-memory/on-disk databases and headless DOM workbench fixtures. No real Java Blue configuration or Electron user-data directory was modified.

| Corrective acceptance coverage | Verification evidence |
|-------------------------------|-----------------------|
| Compact healthy Libraries panel, one labeled ellipsis, no persistent banner/action row/embedded preview/row CRUD/Insert controls | `libraries-panel.test.tsx`, `library-interchange.test.tsx` |
| Standalone full-window Welcome and explicit no-project Libraries reveal | `unified-library-workbench.test.tsx`, `failure-isolation.test.ts` |
| One generic `Library Item` workbench tab, retained address header, session switching, first-edit pinning, and hidden dirty/pinned draft protection | `library-editor-workbench.test.tsx`, `workbench-store.test.ts`, `editor-session-service.test.ts`, `editor-lifecycle.test.ts` |
| Native controlled Instrument, UDO, Effect, and SoundObject editors; unsupported read-only fallback; no supported-item XML textarea | `editor-adapters.test.ts`, `library-editing.test.tsx`, `library-editor-workbench.test.tsx` |
| Name-only inline rename, `F2`/Enter/Escape, right-click/`Shift+F10`, capability-scoped commands, revision-bound copy/cut/Paste | `library-editing.test.tsx`, `library-store.test.ts`, `repository-mutations.test.ts` |
| Affected-count deletion, dirty Save/Discard/Cancel, editor closure, clipboard clearing, and shared-project consequences | `library-mutation-preview.test.ts`, `library-store.test.ts`, `project-item-editing.test.ts` |
| Opaque expiring drag sessions with no XML, one-time consumption, cancellation, and source revision revalidation | `drag-session-service.test.ts`, `unified-library.test.ts` |
| Exact Orchestra row/end, UDO row/end, mixer pre/post gap, and nested Score path/layer/time drop and keyboard-Paste placement | `orchestra-library-drop.test.tsx`, `udo-library-drop.test.tsx`, `mixer-library-drop.test.tsx`, `score-library-drop.test.tsx`, `project-transfer.test.ts` |
| Incompatible/stale transfer feedback and zero mutation; shared SoundObject independent/instance choice | `library-target-routing.test.tsx`, `project-transfer.test.ts`, `libraries-panel.test.tsx`, `library-editing.test.tsx` |
| Silent healthy migration with internal audit/provenance; compact interchange menu without migration/history presentation | `library-interchange.test.tsx`, `automatic-migration.test.ts` |
| Recovery-only replacement, preserved originals, no destructive default, continued non-library work, compact restoration | `library-recovery.test.tsx`, `failure-isolation.test.ts`, `service-recovery.test.ts` |
| Lazy 10,000-item browse/search does not decode payloads or open editor sessions before selection | `performance.test.ts` |

Commands and results:

```text
pnpm --filter @blue/app test
  PASS — 223 files; 2,053 passed / 2 skipped
pnpm test
  PASS — @blue/data 1,267; @blue/app 2,053 passed / 2 skipped;
         @blue/engine-client 18; blue-cli 5; Java Maven suite passed
pnpm --filter @blue/data build
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
  PASS — data, Electron main/preload, repository worker emission, and Vite renderer
pnpm build
  PASS — all workspace packages
pnpm lint
  PASS — all configured workspace lint targets
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/unified-library/performance.test.ts
  PASS — 10,000-item lazy browse/search/preview regression; test body 573 ms
git diff --check
  PASS
```

### Live Electron corrective acceptance

> Historical 2026-07-16 record: the migration notice, source filter, and SoundObject-to-Libraries layout rewrite described below were subsequently removed by the 2026-07-18 correction. The current automated verification record follows this historical section.

The production build was launched on macOS against disposable `HOME` and Electron user-data directories. Four copied Java Blue library files were migrated into a new database; SHA-256 checks confirmed every source file remained byte-for-byte unchanged. The live pass verified:

- standalone full-window Welcome before any panel reveal, normal no-project Libraries access, and a non-blocking migration-complete notice;
- the compact docked panel plus a 900×650 narrow workbench with non-overlapping search, type, source, and ellipsis controls;
- a separate Electron/Dockview Libraries popout containing the same compact navigator and action menu;
- opaque pointer and `Shift+F10` context menus, inline double-click rename with Escape cancellation, no persistent row CRUD/Insert/Browse controls, and stable scroll position;
- native Instrument, UDO, Effect, and SoundObject editors in the central editor group with the address header and without a supported-item raw-XML textarea;
- 100 rapid selection changes resulting in one clean preview tab and one selected tree item, including the concurrent-open regression path;
- copy/Paste and drag/drop for Instrument → Orchestra, UDO → project UDOs, Effect → mixer chain, and SoundObject → exact Score layer/time, with each destination count increasing exactly once per operation;
- an incompatible UDO → Orchestra Paste leaving the Orchestra count unchanged;
- corrupt-database recovery isolated to Libraries while a disposable project still opened; `Create Fresh` returned the service to ready and preserved the failed database beside the replacement.

A regression-specific packaged-app rerun then verified that Java-qualified `blue.soundObject.Sound` entries such as XlooperSolo are promoted from the preserved unsupported state without changing their XML, a real pointer drag adds an Instrument to Orchestra (5 → 6), and a real pointer drag adds an Effect to a mixer pre-effects chain (6 → 7). The destination menus now expose one context-sensitive `Paste` command instead of separate project and Library Paste labels.

The live screenshots were visually inspected for Welcome, docked, narrow, floating, central editor, transfer, recovery, and post-recovery states. Copied fixtures, temporary databases, projects, screenshots, and probe scripts were removed or left only in operating-system temporary storage; no real Java configuration or Electron user data was changed.

The Vite large-chunk notice and Node's experimental `node:sqlite` notice remain informational; the exact Electron/Node/SQLite runtime is pinned and covered by `sqlite-runtime.test.ts` and the CI packaged smoke matrix.

## Verification Record — User-Only Libraries And Project SoundObjects, 2026-07-18

This corrective pass was verified with headless renderer tests, main/preload type builds, the full application suite, and workspace-wide gates. It did not modify a real Electron user-data directory or Java Blue configuration.

| Corrective acceptance coverage | Verification evidence |
|-------------------------------|-----------------------|
| Single-mode Instrument/user SoundObject transfers apply without publishing modal state; shared SoundObjects retain the explicit copy choice | `library-store.test.ts`, `library-target-routing.test.tsx` |
| Score accepts protected-mode SoundObject hover and revalidates type/source at drop | `score-library-drop.test.tsx` |
| Libraries browses/searches user sources only, has no source/project/no-project/migration/history chrome, and starts with all user roots collapsed | `libraries-panel.test.tsx`, `library-interchange.test.tsx` |
| Project SoundObjects use the separate `SoundObject Library` panel with stable-key editor, drag, shared typed Copy/Cut/Paste, and guarded delete | `project-sound-object-library.test.tsx`, `library-store.test.ts` |
| `LibrariesTopComponent` and `SoundObjectLibraryTopComponent` coexist and survive layout parsing as distinct identities | `unified-library-workbench.test.tsx` |
| Project UDOs remain on the reusable UDO list/editor with a typed project drop target | `user-defined-opcode-panel.test.tsx`, `udo-library-drop.test.tsx` |
| Instrument, UDO, Effect, and SoundObject destination drop/Paste routes remain operational | `orchestra-library-drop.test.tsx`, `udo-library-drop.test.tsx`, `mixer-library-drop.test.tsx`, `score-library-drop.test.tsx` |
| Migration/history renderer, preload, and IPC presentation paths are absent while internal migration state/provenance and recovery remain | `library-interchange.test.tsx`, `automatic-migration.test.ts`, `service-recovery.test.ts` |

Commands and results:

```text
Focused corrective suites
  PASS — 7 files; 23 passed
Cross-destination transfer/clipboard suites
  PASS — 7 files; 24 passed
pnpm --filter @blue/app test
  PASS — 224 files; 2,058 passed / 2 skipped
pnpm --filter @blue/app build
  PASS — Java runtime, @blue/data, Electron main/preload, repository worker, renderer
pnpm test
  PASS — @blue/data 1,267; @blue/app 2,058 passed / 2 skipped;
         @blue/engine-client 18; blue-cli 5; Java Maven suite passed
pnpm build
  PASS — all configured workspace packages
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
git diff --cached --check
  PASS
```

The Vite large-chunk notice, Node's experimental `node:sqlite` notice, and expected jsdom canvas diagnostics remain informational and unchanged.

## Verification Record — Hierarchy And Interchange Audit, 2026-07-18

The post-implementation audit closed the remaining hierarchy, organization, async-state, project-copy, import/export, test-coverage, and artifact-consistency findings. No real Electron user-data directory or Java Blue configuration directory was modified.

| Audit acceptance coverage | Verification evidence |
|---------------------------|-----------------------|
| User folders drain every cursor page, retain stable order, deduplicate node IDs, reject repeated cursors, include child 1,205, and enumerate a 10,000-item root within the performance budget | `library-store.test.ts`, `performance.test.ts` |
| Project SoundObjects and project UDO lookup drain collections beyond 500 entries | `project-sound-object-library.test.tsx`, `library-store.test.ts` |
| Slower stale search responses cannot replace a newer query; browse failures remain visible | `library-store.test.ts` |
| Folder/item Cut and Copy, Paste-on-item-parent, Move Up/Down, root protection, and affected-count delete are wired contextually | `library-editing.test.tsx`, `library-store.test.ts`, `repository-mutations.test.ts` |
| Item/search rows remain name-only while native tooltips expose full item addresses and folder names | `libraries-panel.test.tsx`, `library-editing.test.tsx` |
| Project Instruments, UDOs, Effects, and Project Shared SoundObjects use the same Copy/Cut/Paste buffer and opaque drag path as user items; no special Copy-to-user command remains | `orchestra-library-drop.test.tsx`, `udo-library-drop.test.tsx`, `mixer-library-drop.test.tsx`, `project-sound-object-library.test.tsx`, `library-store.test.ts`, `library-transfer-service.test.ts` |
| Manual import supports XML files and a Java configuration directory; ambiguous duplicate folders require a stable breadcrumbed selection | `library-interchange.test.tsx`, `manual-import-preview.test.ts` |
| Export Current/All share one lease, fully preflight compatibility before approval, report preserved unsupported items and overwrites, cancel without writes, and retain atomic rollback | `export-compatibility.test.ts`, `export-transaction.test.ts` |
| Spec, plan, tasks, contracts, quickstart, and checklist use the corrected user-only/silent-migration/complete-hierarchy model | Spec Kit analysis: 77 requirements, 13 criteria, 6 stories, 83 completed tasks, no critical issues |

Commands and results:

```text
Focused audit suites
  PASS — 11 files; 46 passed
10,000-item complete browse/search/preview regression
  PASS — complete 20-page browse plus indexed search and preview; test body 980 ms
pnpm --filter @blue/app test
  PASS — 224 files; 2,072 passed / 2 skipped
pnpm --filter @blue/app build
  PASS — Java runtime, @blue/data, Electron main/preload, repository worker, renderer
pnpm test
  PASS — @blue/data 1,267; @blue/app 2,072 passed / 2 skipped;
         @blue/engine-client 18; blue-cli 5; Java Maven suite passed
pnpm build
  PASS — all configured workspace packages
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

The Vite large-chunk notice, Node's experimental `node:sqlite` notice, expected jsdom canvas diagnostics, and the intentional nonexistent-command failure fixture remain informational and unchanged.

## Verification Record — Insertion Clarity Corrections, 2026-07-18

The latest UX corrections restrict Orchestra insertion to numerically valid boundaries, assign the available gap identity, keep Library rows name-only with address tooltips, accept Effect drops into empty chains, and remove whole-channel mixer hover recoloring.

```text
Focused Orchestra, mixer, Library tree, shared-contract, and project-transfer suites
  PASS — 6 files; 35 passed
pnpm --filter @blue/app test
  PASS — 224 files; 2,074 passed / 2 skipped
pnpm --filter @blue/app build
  PASS — Java runtime, @blue/data, Electron main/preload, repository worker, renderer
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

## Verification Record — Shared Project/User Transfer Buffer, 2026-07-18

The final correction removes the dedicated project-copy IPC/UI path and uses one revision-bound typed buffer for Copy and Cut across user and project Instruments, UDOs, Effects, and SoundObjects. Cross-owner Cut commits the destination before guarded source removal; a failed or declined removal keeps the source and buffer. In-project movement remains on identity-safe native controls. Project rows also use the opaque drag service in reverse, including protected-hover handling, while mixer Effects use one selection and exact internal move patches.

This historical destination-first Cut record is superseded by the 2026-07-19 immediate detached Cut verification below.

```text
Focused shared-contract, store, service, project-panel, and reverse-drag suites
  PASS — 12 files; 71 passed
pnpm --filter @blue/app test
  PASS — 224 files; 2,086 passed / 2 skipped
pnpm --filter @blue/app build
  PASS — Java runtime, @blue/data, Electron main/preload, repository worker, renderer
pnpm test
  PASS — @blue/data 1,267; @blue/app 2,085 passed / 2 skipped;
         @blue/engine-client 18; blue-cli 5; Java Maven suite passed
pnpm build
  PASS — all configured workspace packages
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

The existing Vite large-chunk notice, Node `node:sqlite` experimental notice, jsdom canvas diagnostics, and intentional nonexistent-command fixture remain informational.

## Verification Record — Folder And Docked Interaction Regressions, 2026-07-18

The final manual-acceptance corrections replace Electron's unsupported browser prompt with a validated in-app folder form, use defined opaque Library dialog/panel surfaces, reset insertion feedback even when Mixer internal moves consume the drop event, and reserve the intended 200-pixel table area in an empty UDO workspace at a representative 390-pixel docked height.

```text
Focused folder/dialog, Mixer drop-state, and empty-UDO suites
  PASS — 3 files; 16 passed
10,000-item complete browse/search/preview regression (isolated)
  PASS — 1 file; 1 passed; test body 1.11 s
pnpm --filter @blue/app test
  PASS — 225 files; 2,089 passed / 2 skipped
pnpm test
  PASS — @blue/data 1,267; @blue/app 2,089 passed / 2 skipped;
         @blue/engine-client 18; blue-cli 5; Java Maven suite passed
pnpm --filter @blue/app build
  PASS — Java runtime, @blue/data, Electron main/preload, repository worker, renderer
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

The first workspace-wide test attempt ran packages concurrently and pushed only the 10,000-item timing fixture to 2.52 s against its 2.0 s bound; all functional tests passed in that run, the same fixture passed immediately in isolation at 1.11 s, and the complete workspace gate passed on retry. The existing Vite large-chunk notice, Node `node:sqlite` experimental notice, jsdom canvas diagnostics, and intentional nonexistent-command fixture remain informational.

## Verification Record — Instrument-Local UDO Transfer And Folder Disclosure, 2026-07-19

The Instrument UDO tabs now identify both the owning Instrument assignment and the selected UDO session object. That address is used consistently by browse, preview, edit, delete, Copy/Cut, opaque drag, and exact insertion, so a transfer cannot fall back to the top-level project list or another Instrument. Empty folders and roots render disclosure from node kind rather than current child count, using the same large white chevron as populated folders.

```text
Focused shared-contract, adapter, transfer-service, UDO-workspace, and tree suites
  PASS — 7 files; 38 passed
10,000-item complete browse/search/preview regression (isolated)
  PASS — 1 file; 1 passed
pnpm --filter @blue/app test
  PASS — 225 files; 2,094 passed / 2 skipped
pnpm --filter @blue/app build
  PASS — Java runtime, @blue/data, Electron main/preload, repository worker, renderer
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

The first full application run pushed only the existing 10,000-item timing fixture to 2.698 s against its 2.0 s bound while all 2,093 functional assertions passed. The fixture passed immediately in isolation, and the complete 225-file application suite then passed on retry. The existing Vite large-chunk notice, Node `node:sqlite` experimental notice, jsdom canvas diagnostics, and intentional nonexistent-command fixture remain informational.

## Verification Record — List Remainder Drop Geometry And Mixer Minimum Sizing, 2026-07-19

UDO tables and Mixer Effect bins now stretch their existing guarded end-insertion marker through all unused list space. A compatible drag highlights that full remainder and resolves to the same exact end index used by keyboard Paste; no new inferred target or service path was added. Mixer channel content has a readable 300-pixel strip floor, the level region retains 96 pixels for its fixed slider/value content, and a shorter Mixer body scrolls vertically instead of allowing adjacent regions to overlap. Folder disclosure remains high contrast at the user-selected 14-pixel size.

```text
Focused disclosure, UDO-drop, Effect-drop, Mixer panel, and Mixer CSS suites
  PASS — 5 files; 28 passed
pnpm --filter @blue/app test
  PASS — 226 files; 2,096 passed / 2 skipped
pnpm --filter @blue/app build:renderer
  PASS — renderer plus configured Electron main/preload Vite emissions
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

The existing Vite large-chunk notice, Node `node:sqlite` experimental notice, jsdom canvas diagnostics, and intentional nonexistent-command fixture remain informational.

## Verification Record — Single Library Item Tab, Immediate Detached Cut, And Folder Drag, 2026-07-19

The workbench now maintains one visible `Library Item` tab even across rapid selections and saved-layout restoration while retaining protected editor sessions by stable identity. Copy keeps its revision-bound live reference. Cut instead captures the selected typed item or complete folder subtree into a main-owned detached buffer and removes the source atomically during the Cut command. Paste always creates an independent copy and leaves that buffer reusable. Dirty, declined, stale, invalid, or failed Cut requests preserve the source and the prior buffer. User folders and items can also be moved directly into compatible user folders by drag-and-drop, with repository-authoritative cycle, type, root, and revision validation. Folder disclosure remains at the user-selected 14-pixel size.

```text
Atomic Cut repository and service regressions
  PASS — 2 files; 9 passed
Library store and tree interaction regressions
  PASS — 2 files; 27 passed
Project panel transfer regressions
  PASS — 3 files; 14 passed
Single-Library-Item workbench regressions
  PASS
pnpm --filter @blue/app test
  PASS — 226 files; 2,103 passed / 2 skipped
pnpm --filter @blue/app build
  PASS — Java runtime, @blue/data, Electron main/preload, repository worker, renderer
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

The existing Vite large-chunk notice, Node `node:sqlite` experimental notice, jsdom canvas diagnostics, and intentional nonexistent-command fixture remain informational.

## Verification Record — Shared SoundObject Instance Editing Parity, 2026-07-20

Instance type editors now resolve the canonical Project Shared SoundObject by stable library ID, while the Score Object Properties panel targets the selected Instance wrapper as in Java Blue. Replacing a library definition relinks every matching Instance in the timeline, nested PolyObjects, and other project-library definitions. Clean parallel Library Item sessions refresh to canonical changes; dirty drafts remain intact and enter conflict. Structurally unchanged editor targets no longer reload merely because a project snapshot was rehydrated.

```text
Focused adapter, session, routing, and Properties-panel regressions
  PASS — 4 files; 43 passed
pnpm --filter @blue/app test
  PASS — 226 files; 2,115 passed / 2 skipped
pnpm --filter @blue/app build:main
  PASS — Electron main TypeScript build
pnpm --filter @blue/app build:renderer
  PASS — renderer plus configured Electron main/preload Vite emissions
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
  PASS
```

The score-generation regression renders the complete project after a saved shared-definition edit and also exercises direct generation through timeline, nested timeline, and project-library-nested Instances. The existing Vite large-chunk notice, jsdom canvas diagnostics, and intentional nonexistent-command fixture remain informational.

## Verification Record — Completion Review, 2026-07-21

The final review traced all 78 functional requirements and all 13 success criteria to implementation and verification evidence. It found no blocking behavior or reliability defect. The review added the previously missing exact SC-007 durability regression, strengthened SC-006 to sample 20 browse pages and 20 indexed searches, and replaced the feature's inline/child-process CommonJS type/runtime imports with top-level static ESM imports.

```text
Focused repository, identity, and 10,000-item performance regressions
  PASS — 4 files; 11 passed
Electron SQLite ESM runtime probe
  PASS — 1 file; 1 passed
Playwright/Vitest browser regressions
  PASS — 2 files; 5 passed
pnpm test
  PASS — @blue/data 1,267; @blue/app 2,117 passed / 2 skipped;
         @blue/engine-client 18; blue-cli 5; Java Maven suite passed
pnpm build
  PASS — all workspace packages, Electron main/preload, repository worker, and renderer
pnpm lint
  PASS — all configured workspace lint targets
git diff --check
git diff --check ec14e07c
  PASS — worktree and complete Spec 060 feature diff
```

The build retains the existing informational Vite chunk-size notice. The normal test run also retains the known Node `node:sqlite` experimental notice, jsdom canvas diagnostics, and intentional nonexistent-command fixture. None represents a Spec 060 failure. The external multi-participant usability outcome in SC-001 is not asserted as an automated result; the documented live/manual acceptance pass remains its implementation proxy.

## Completion Gate

The feature is ready for closeout only when:

- all 78 functional requirements and 13 success criteria map to automated or documented manual verification;
- the four-format compatibility corpus passes;
- no unsupported payload is silently changed, omitted, or made insertable;
- repository/import/export/upgrade failure injection leaves prior data complete or recoverable;
- every project insertion passes stale-target and portability tests;
- no dirty/pinned editor loses or silently overwrites a draft;
- the 10,000-item benchmark meets SC-006;
- Java source files and backups remain byte-for-byte unchanged;
- no duplicate legacy library surface remains.
