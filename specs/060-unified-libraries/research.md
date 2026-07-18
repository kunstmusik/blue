# Phase 0 Research: Unified Libraries

## Scope Audit

The design was checked against the current Electron app, the pure `@blue/data` model, prior Specs 021/026/029/034/035/037/054/055, and the Java Blue library implementations under `/Users/stevenyi/work/nbprojects/blue`.

Important current-state findings:

- `EffectLibraryModal` and `MixerEffectsLibrarySession` are intentionally session-only. They load `~/.blue/effectsLibrary.xml`, assign fresh runtime IDs, and lose changes on reload.
- Orchestra still contains `TemporaryInstrumentLibraryPanel`; the user UDO library was explicitly deferred; the existing `SoundObjectLibraryTopComponent` is a static auxiliary placeholder for project-shared objects.
- `App.tsx` unmounts `WorkbenchShell` when no project is open, so an app-wide dockable user library cannot work until the workbench becomes project-independent.
- Static workbench registration rejects unknown panel IDs. Multiple stable Library Item editors therefore need a dynamic Dockview component/parameter contract rather than one more static placeholder.
- Project Orchestra assignments and Project Shared SoundObjects have durable locators, but project UDO patches are index-based and require a safer session/persisted resolver before editor tabs can survive reorder or restore.
- The current TypeScript `InstrumentCategory.loadFromXML()` bypasses the instrument registry and loads every leaf as `GenericInstrument`. Known outer types may also contain unknown nested SoundObjects or BSB widgets that current loaders silently skip.

## Decision 1: Use Electron's Built-In SQLite Behind A Worker

**Decision**: Pin Electron to exactly 35.7.5 and use its bundled `node:sqlite` API. Production owns one `DatabaseSync` connection in a dedicated worker thread; Electron main talks to it through a typed Promise façade. Unit tests may instantiate the repository directly with `:memory:` or a temporary file.

**Rationale**: Electron 35.7.5 embeds Node 22.16.0 and SQLite 3.49.1. That Node release supplies `DatabaseSync`, busy timeout, transaction state, and online `backup()`. The installed Electron runtime was also verified to expose those APIs. Using the bundled runtime avoids a second native addon, Electron ABI rebuilds, per-platform prebuild coverage, and ASAR unpack rules. A worker keeps synchronous database work, import commits, and migration checks off Electron's UI/event loop while preserving one serialized writer.

The repository opens with foreign keys enabled, extensions disabled, and a 5-second busy timeout; asserts `PRAGMA foreign_keys=ON`; uses `journal_mode=WAL` and `synchronous=FULL`; and wraps compound writes in explicit `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`. `PRAGMA user_version` is the schema version. Before a destructive schema migration, the service pauses the queue, runs online `backup()`, opens and verifies the backup, then migrates.

`node:sqlite` is still Stability 1.1 and emits an experimental warning, and Electron 35 is end-of-life. The adapter therefore uses only the API verified in Node 22.16, includes an exact Electron runtime smoke test (important because the workspace's `@types/node` is newer), and makes a supported Electron upgrade a separately verified follow-up rather than floating the runtime under this feature.

**Primary sources**:

- [Electron 35.7.5 runtime versions](https://releases.electronjs.org/release/v35.7.5)
- [Node 22.16.0 SQLite API](https://nodejs.org/download/release/v22.16.0/docs/api/sqlite.html)
- [SQLite `user_version`](https://www.sqlite.org/pragma.html#pragma_user_version)
- [SQLite write-ahead logging](https://www.sqlite.org/wal.html)
- [Electron native-module rebuild requirements](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules/)
- [Electron ASAR native-module constraints](https://www.electronjs.org/docs/latest/tutorial/asar-archives)

**Alternatives considered**:

- **`better-sqlite3`**: credible fallback if the bundled Stability-1.1 API is rejected, but it adds a native binary, Electron rebuild/ABI checks, allowed-build changes, and ASAR packaging work.
- **`sqlite3`**: rejected because its repository is deprecated/unmaintained even though its API is asynchronous.
- **SQLite WASM or `sql.js`**: rejected because browser/OPFS or whole-database export persistence is a worse fit for an authoritative crash-safe Electron main-process store.
- **Run `DatabaseSync` directly on Electron main**: rejected because large imports, backups, or migrations could stall window and playback coordination.

## Decision 2: Normalize Organization, Preserve Complete Payloads

**Decision**: Store a normalized node tree, item metadata, revisions, and import provenance in `blue_libraries.sqlite`, while retaining complete `payload_xml` for every item. Four immutable root nodes are created once. Folder/item UUIDs live only in SQLite and never leak into Java XML.

**Rationale**: Stable identities, hierarchy operations, conditional import undo, lazy browsing, and case-insensitive name search need normalized records. Complete raw XML is still required for plugin-defined and nested-unsupported objects and remains useful for supported-item export. Keeping both in one transaction lets Save update payload, display/search metadata, hashes, preview information, timestamps, and revision as one atomic change.

The repository uses a single node ordering field with type policy:

- Instruments, UDOs, and Effects expose categories first, then leaves, preserving relative order within each Java-representable block.
- SoundObjects preserve one mixed folder/item child sequence.

Initial search uses a stored NFKC-normalized lowercase name and a bounded/paginated substring scan. At the required 10,000-item scale this is simpler and semantically closer than token-based FTS; payloads are never decoded for list/search queries.

**Alternatives considered**:

- **One XML blob per whole library**: rejected because stable node identity, partial organization edits, history, and search would require repeated full-document rewrites and fragile path identities.
- **A generic JSON payload only**: rejected because it cannot preserve exact unsupported XML or Java interchange.
- **SQLite FTS from the outset**: rejected because the required query is substring name search, not token search; add it later only if measured 10,000-item performance fails.

## Decision 3: Put Raw-First Java Codecs In Pure `@blue/data`

**Decision**: Add pure `@blue/data/src/libraries` codecs that parse the four Java library envelopes with `@rgrove/parse-xml` using node offsets and retain the input string. A single tested offset adapter converts the parser's source positions to JavaScript UTF-16 code-unit boundaries before envelope walking slices each leaf's exact XML; call sites never pass parser offsets directly to `String.slice()`. A payload enters a mutable `@blue/data` object only after recursive support checks and a safe round-trip comparison prove that no outer or nested content would be discarded.

**Rationale**: `@rgrove/parse-xml` can provide source positions, while the existing `Element.parse()` wrapper trims text, omits non-element nodes, and reserializes content. The parser documents byte offsets while its current scanner indexes a JavaScript source string, so direct scattered slicing would be too fragile around non-ASCII and surrogate pairs. Encapsulating and verifying offset conversion with Unicode before and inside every leaf preserves comments, CDATA, whitespace, entity spelling, plugin fields, and nested unknown content. Keeping this logic pure satisfies the data-first constitution and lets browser/Node tests share the same compatibility rules. Main remains responsible only for obtaining strings and writing results.

Support classification is conservative:

1. Validate the expected root and category structure without executing code or loading external entities.
2. Capture the leaf's original type, embedded name when safely available, and exact raw XML.
3. Check the complete recursive type/widget/object graph against supported registries and allowed schema.
4. Decode and serialize only a fully recognized candidate.
5. Compare canonical XML trees, with explicit tested Java-compatible normalization allowances.
6. Mark any mismatch or ignored unknown content `unsupported`; keep its raw XML authoritative and insertion disabled.

When a supported editor saves successfully, its validated serializer output atomically becomes the new authoritative payload. Until then, even supported imported items export from preserved payload XML.

**Alternatives considered**:

- **Use `InstrumentLibrary.loadFromXML()` and other current aggregate loaders**: rejected because the instrument aggregate currently coerces all leaves to `GenericInstrument`, and other registries can return `null` for unknown nested content.
- **Deserialize first and keep raw XML only on an exception**: rejected because silent dropping does not necessarily throw.
- **Keep codecs in Electron main**: rejected because XML/domain compatibility is portable business logic and belongs in `@blue/data`; filesystem boundaries alone belong in main.

## Decision 4: Match The Four Java Envelopes And Their Ordering

**Decision**: Implement one codec interface with four explicit format descriptors.

| Type | Root / category / leaf | Ordering |
|------|-------------------------|----------|
| Instrument | `instrumentLibrary` / `instrumentCategory` / `instrument` | subcategories first, then instruments |
| UDO | `udoLibrary` / `udoCategory` / `udo` | subcategories first, then UDOs |
| Effect | `effectsLibrary` / `effectCategory` / `effect` | subcategories first, then effects |
| SoundObject | `soundObjectLibrary` / `category` / polymorphic `soundObject` | exact mixed child sequence |

**Rationale**: These are the actual Java load/save contracts. Java Instrument/UDO/Effect categories use separate collections and cannot represent arbitrary mixed sibling order. Java's generic SoundObject `Library` keeps a single ordered child list. Export must reproduce those distinctions rather than flattening everything into one generic tree rule.

**Java anchors**:

- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/InstrumentLibrary.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/orchestra/InstrumentCategory.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/udo/UDOLibrary.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/udo/UDOCategory.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/EffectsLibrary.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/mixer/EffectCategory.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/library/Library.java`

**Alternatives considered**:

- **One universal mixed ordering rule**: rejected because three Java formats canonicalize categories before items.
- **One universal categories-first rule**: rejected because it would reorder SoundObject folders and objects.

## Decision 5: Keep Legacy Migration State Outside The Database

**Decision**: Store `never | completed | skipped | failed`, the last attempt summary, linked import-batch ID, and available pre-upgrade backup metadata in an atomic main-owned `blue-libraries-state.json` beside the database.

**Rationale**: The state must survive a missing or unusable database so Blue does not silently reimport Java libraries. It should also not be embedded in the current full `ProgramSettingsSnapshot`: the Settings window saves a whole snapshot and could overwrite a migration update it did not know about. A small dedicated app-settings file uses the existing temp-write/rename pattern, has a narrow schema, and can be recovered independently.

Startup first evaluates database usability/content and migration state, then follows the specification's state matrix. A non-empty library always suppresses automatic import. `skipped` and `failed` do not silently retry. A corrupt state file plus non-empty database defaults safe—do not import—and exposes repair/manual import.

**Alternatives considered**:

- **A table in `blue_libraries.sqlite`**: rejected because database loss would also erase the guard against repeated migration.
- **An ordinary program-settings field**: rejected because current full-snapshot saves can clobber main-owned concurrent state.
- **Infer migration from database existence**: rejected by FR-047 and unsafe after deletion/corruption.

## Decision 6: Use Per-Source Import Transactions And Staged Export

**Decision**: A main-owned operation lease prevents overlapping import/export. Preview parses files into inert plans with hashes. Apply verifies the source hashes again, creates one import-batch history record, and commits each recognized source file in its own `BEGIN IMMEDIATE` transaction. Multi-source success may be partial only at source boundaries and is reported explicitly.

Default manual conflict behavior is deterministic:

- exact canonical content in the same resolved type/folder is skipped and retains its stable identity;
- same-name/different-content is kept with a deterministic display alias and unchanged embedded payload;
- ambiguous duplicate folder paths require an explicit destination folder ID;
- replacement requires explicit selection and makes the batch non-undoable;
- batch undo is enabled only while every created node retains its recorded revision and every created folder contains no later content.

Export performs complete compatibility/overwrite preflight first. It writes and validates staged files in the destination filesystem, journals prior targets, atomically promotes all requested outputs, and restores prior files if any later promotion fails. Export All always includes four valid roots. Unsupported leaf slices are injected byte-for-byte; regenerated category wrappers and supported post-edit payloads follow Java canonical output.

**Rationale**: SQLite transactions provide repository atomicity but cannot make four destination files atomic by themselves. Source-level commits preserve three valid libraries when a fourth is corrupt. Destination-local staging plus rollback meets the all-new-or-all-prior requirement without continuous Java-file synchronization.

**Alternatives considered**:

- **One transaction for all source files**: rejected because FR-049 requires valid independent sources to survive a corrupt sibling.
- **Commit each item independently**: rejected because a failed source could leave a partial hierarchy.
- **Write export files directly in sequence**: rejected because a late failure could leave mixed old/new output.

## Decision 7: Compose Project Sources Through A Main Adapter

**Decision**: `UnifiedLibraryProjectAdapter` reads and mutates the current canonical `BlueData`, presents Project Orchestra, project UDOs, and Project Shared SoundObjects as project scopes, and treats Effect chains/Score positions as insertion targets rather than persisted scopes. Every request carries the expected project session plus a stable type-specific locator.

Locator policy:

- Instrument: persisted arrangement assignment identity.
- Project Shared SoundObject: make the existing Java-compatible `objRefId` stable across save/reorder by preserving/seeding it in `SoundObjectLibrary` and `ObjRefSaveMap`; pair it with a canonical fingerprint/name/type. Restore requires the ID and fingerprint to agree or exactly one fingerprint fallback candidate, otherwise it returns missing/ambiguous.
- Project UDO: main-session object identity plus a persisted content fingerprint/name resolver; restore binds only when the candidate is unique, otherwise it opens a missing/ambiguous state. It never trusts a saved list index alone.
- Effect target: project session, channel, pre/post chain, insertion index, and current target revision.
- Score target: project session, explicit group/container path, layer, time, and target revision.

Transfer behavior follows Java/current native rules: Instruments and UDOs deep-copy without replacing same-name project content; Effects deep-copy, clear library automation binding, enable the inserted copy, and target one exact chain position; user SoundObjects deep-copy and convert beat-based duration/time behavior into the destination context; Project Shared `Copy Instance` retains the shared reference while `Copy Independent` deep-copies. `Instance` is not generally portable as a user-library leaf.

**Rationale**: Project data must remain embedded in `.blue`, and current main process ownership already serializes project patches/revisions. The current save map can regenerate SoundObject reference IDs by encounter order, so the planned `@blue/data` change must retain loaded IDs and seed new stable IDs through the existing Java field before editor restoration can rely on them. The fingerprint fallback guarantees same-definition-or-safe-missing behavior for legacy/ambiguous projects. A dedicated adapter avoids duplicating domain semantics in the renderer and blocks stale targets before any partial project mutation.

**Alternatives considered**:

- **Copy project sources into SQLite**: rejected because it changes ownership and risks stale dual truth.
- **Let the renderer assemble XML and mutate stores optimistically**: rejected because project session/target validity and dependency checks require canonical main state.
- **Persist project UDO indexes in editor layouts**: rejected because reorder could silently rebind an editor.

## Decision 8: Main Owns Full Type-Specific Editor Sessions; Dockview Owns Preview/Pin Presentation

**Decision**: Selecting a supported item opens or updates a dynamic main-area `LibraryItemEditorPanel` titled `Library Item`. The panel retains the existing address/breadcrumb header and hosts the full native editor for its type; a generic raw XML textarea is not the supported-item fallback. Main owns one editor session per logical `(scope, stable locator)` with base revision/hash, draft payload, dirty/validation/conflict/missing state, project session, and usage/consequence data. Renderer owns one clean unpinned preview-tab slot, explicit pin display, focus, and editor widgets, but not the only copy of an unsaved draft.

**Rationale**: The auxiliary Libraries panel should remain a compact navigator, while full editing needs the width and familiar placement of Blue's main workspace. Preview-tab reuse makes ordinary browsing lightweight without introducing a separate viewer implementation. First-edit auto-pin and main-owned sessions ensure later selections cannot replace dirty work. Main ownership also guards native quit/project replacement and retains a draft when Save discovers a newer base. Closing or collapsing Libraries does not affect open editors.

Session rules:

- one clean unpinned preview tab may be reused;
- first edit auto-pins; dirty or explicitly pinned tabs are never replaced;
- Save compares the base revision/hash, validates the whole object, and offers Reload Latest, Cancel, or reviewed overwrite on conflict;
- Revert requires confirmation when dirty;
- external delete yields a read-only missing-item state rather than rebinding;
- user-item Save commits SQLite independently; project-item Save uses canonical project mutation and marks the project dirty;
- project close/switch and app quit collect dirty sessions and require Save, Discard, or Cancel.

**Alternatives considered**:

- **Renderer-only draft state**: rejected because main-driven quit/project lifecycle and multiple application windows could bypass or duplicate it.
- **One static editable panel reused regardless of dirty state**: rejected because selection could silently replace a draft and makes side-by-side or identity-safe editing impossible.
- **Separate full editors inside the Libraries panel**: rejected by the lightweight preview and workspace-editor requirements.

## Decision 9: Make The Workbench App-Wide And Preserve Dedicated Project Panels

**Decision**: Always mount `WorkbenchShell`, but preserve the standalone full-window Welcome screen over it until a project loads or the user explicitly opens an app-wide workbench panel. Welcome is not a Dockview panel. Add `LibrariesTopComponent` to the right `properties-main` auxiliary group, normally closed unless user/layout opens it. Preserve and register `SoundObjectLibraryTopComponent` as the separate, normally closed Project Shared SoundObject panel. The two IDs are valid simultaneously and must not be rewritten into one another.

The old native `open-effects-library` command may reveal/filter the same panel for compatibility, but destination-side Browse/Add-from-Library controls are removed rather than converted into insertion modes. `effects-library.main` and `orchestra.library` remain accepted during settings/layout migration but are no longer active UI regions after callers move. The valid remainder of a saved layout is preserved.

**Rationale**: A modal or project-only shell cannot satisfy app-wide user-library browse/edit/import/recovery. Java Blue already separates the project SoundObject library from user libraries, just as Project Orchestra and UDOs have dedicated editors. Preserving both panel identities restores that ownership distinction and lets saved layouts represent both surfaces without ambiguity.

**Alternatives considered**:

- **Keep Libraries as a global modal when no project is open**: rejected because it would create two logical experiences and break layout persistence.
- **Force Libraries open on every startup**: rejected because the spec preserves intentional user closure; only reset/default layout establishes the right-side home.

## Decision 10: Lazy Browse/Search And Cached Safe Navigation Metadata

**Decision**: Tree roots and children load on demand. List/search responses contain only node identity, type, scope, breadcrumb context, support status, display name, revision, and small navigation metadata. Full `payload_xml` is fetched only by the main-owned editor workflow and never returned for general search results. Results are bounded and cursor-paginated; project results are merged by the service using the same sort/result DTOs.

**Rationale**: This keeps 10,000-item open/search behavior predictable, avoids decoding polymorphic objects during navigation, and limits large/raw IPC payloads. Search/navigation projections are recomputed atomically on supported Save; the full native editor loads only the selected item session.

**Alternatives considered**:

- **Load the complete repository into Zustand**: rejected because raw XML and large editor payloads would inflate renderer memory and complicate cross-window consistency.
- **Decode every visible item for navigation fields**: rejected because unsupported/nested-unsupported objects should not enter mutable loaders and because it undermines responsiveness.

## Decision 11: Test A Compatibility And Failure Corpus Before UI Completion

**Decision**: Gate implementation on a corpus covering:

1. Empty and deeply nested roots for all four formats.
2. Duplicate, case-differing, Unicode names; category-first ordering for three types; mixed SoundObject ordering.
3. Every registered Instrument/SoundObject type, classic/modern UDOs, legacy Effect styles/parameter-list variants, and Rhino aliases.
4. Unknown outer classes and known objects containing unknown nested SoundObjects, BSB widgets, JMask/plugin fields, comments, CDATA, whitespace, and entity references.
5. External `DOCTYPE`/entity input proving no resolution or code execution.
6. Java canonical comparison for supported fixtures and byte-identical payload export for unsupported fixtures.
7. Exact duplicate, same-name/different-content, ambiguous folder, explicit replacement, conditional undo, and reimport identity cases.
8. Four project transfer modes, automation reset where required, shared-instance usage/delete behavior, and SoundObject time-base conversions.
9. Migration-state × database-state combinations, corrupt sibling sources, backup-only discovery, locks, version upgrades, and source immutability.
10. Export staging/overwrite/rollback interruption and repository transaction failure injection.
11. Clean preview-editor reuse, first-edit pinning, dynamic editor focus/conflict/missing restore, no-project use, and layout identifier migration across docked/minimized/floating/closed states.
12. A generated 10,000-item repository benchmark against SC-006.

**Rationale**: The dominant risks are silent data loss, stale-target mutation, and recovery behavior, not basic component rendering. Tests must prove those boundaries before legacy surfaces are retired.

**Alternatives considered**:

- **Rely on hand-created UI smoke data**: rejected because it cannot demonstrate lossless unsupported XML, transaction rollback, or deterministic conflict behavior.

## Decision 12: Use A Compact Navigator, Context Commands, And Typed Direct Manipulation

**Decision**: Libraries contains a compact search/type-filter control row, four collapsed user-library roots, and one vertical-ellipsis menu for panel-level Import and Export commands. It has no source filter, Current Project section, migration notice, migration report, or Import History UI. Repository recovery may still replace the tree because it is an exceptional blocking state. Tree rows contain no persistent CRUD or Insert buttons. Right-click and `Shift+F10`/Context Menu key expose scoped Duplicate, Cut, Copy, Paste, Delete, and folder commands. Double-clicking the visible name and `F2` enter inline rename; single selection opens or focuses the main type-specific editor.

Project placement uses a typed, opaque drag session from Libraries—or from the separate Project SoundObject Library—to exact Orchestra, project UDO, mixer-chain, and Score insertion geometry. The payload carries stable identity/type/scope/revision data, never XML. Valid targets show an insertion marker and invalid targets show rejection feedback. Browser-protected drag data may be unreadable during hover, so MIME presence enables provisional Score feedback and type is rechecked at drop/main validation. Drop revalidates the project session, item revision, destination revision, dependencies, and copy semantics in main before one atomic mutation. User-library-to-project drag always copies. Shared SoundObjects require an explicit instance-versus-independent choice; every single-mode transfer applies directly and reports by toast without publishing modal state. Context-menu Copy plus destination Paste is the keyboard-equivalent path and uses the same validation service.

**Rationale**: This matches established desktop tree behavior and keeps the panel focused on finding and selecting content. Direct manipulation makes the destination visible at the moment of placement instead of asking users to manage a hidden insertion mode. A typed internal clipboard and drag token preserve the existing safe project adapter while giving mouse and keyboard users equivalent outcomes. Removing the full-width migration/action header returns scarce vertical space to the hierarchy.

**Interaction details**:

- The ellipsis button has an accessible `Library actions` label, visible focus, and no tooltip-dependent meaning.
- Tree focus remains stable while the main editor preview updates; opening the editor must not interrupt multi-step keyboard organization.
- Delete and non-empty-folder delete retain revision-bound confirmation with affected counts; shared-definition delete retains linked-instance consequences.
- Cut is visually marked until Paste/cancel and is permitted only within the same user-library type/scope. Copy creates new stable identities; cut/move preserves them.
- Drag hover supports exact insertion markers, invalid cues, edge auto-scroll, and `Escape` cancellation. Drop dialogs appear only for shared-copy choices or unresolved disclosures, not for every valid transfer.
- Unsupported items remain selectable/viewable/organizable/exportable but are not draggable into project surfaces and cannot open a mutable editor.

**Alternatives considered**:

- **Persistent Insert and destination Browse buttons**: rejected because they duplicate navigation, obscure the actual destination, and create stale hidden target state.
- **Always-visible row command buttons**: rejected because they reduce scan density and repeat commands that belong to node context.
- **Raw XML as the supported-item editor**: rejected because it exposes storage representation instead of the existing type-specific musical editing interface.
- **Drag-and-drop without Paste**: rejected because it would make a core project-placement workflow pointer-only.

## Resolved Questions

All technical questions required for planning are resolved.
