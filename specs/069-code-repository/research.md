# Research: Java-Compatible Code Repository Library

## Decision 1: Make the repository user-global and project-facing in v1

**Decision**: The repository is available to every project but is not owned by an individual
project and is not serialized into `.blue`.

**Rationale**: Java Blue resolves one repository from the configured user directory, defaults to
`~/.blue/codeRepository.xml`, loads it in every Csound editor, and exposes it from the Tools menu.
The repository is a reusable user catalog; its relationship to a project is usage context only.
This avoids unresolved semantics for unsaved projects, Save As, project copying, and project
portability.

**Java evidence**:

- `blue-core/.../blue/BlueSystem.java` resolves the user configuration directory and copies the
  packaged repository default when the directory is first created.
- `blue-ui-core/.../tools/codeRepository/CodeRepositoryManager.java` loads and saves the entire
  tree through `BlueSystem.getCodeRepository()`.
- `blue-ui-core/.../tools/CodeRepositoryMenu.java` builds the editor popup menu from that tree.
- `blue-ui-core/.../tools/AddToCodeRepositoryAction.java` writes selected editor text to the same
  user repository.

**Alternatives considered**:

- Embed snippets in `.blue`: rejected because it diverges from Java behavior and makes snippets
  unavailable across projects.
- Store a project sidecar database: deferred; it requires explicit project lifecycle, Save As,
  portability, and global-versus-local precedence rules.

## Decision 2: Use a dedicated SQLite file outside the unified-library database

**Decision**: Store the repository in `blue_code_repository.sqlite` under Electron's user-data
directory, with its own schema version, worker/service boundary, backup/recovery state, and
migration state file.

**Rationale**: The unified-library design in `specs/060-unified-libraries/` defines
`blue_libraries.sqlite` around four typed user libraries. Code Repository is an ordered tree of
plain text snippets, not a `LibraryType` with XML payloads. A separate file gives it independent
failure recovery and prevents a malformed repository migration from making instruments, UDOs,
effects, or sound objects unavailable. The two databases still share the established
`node:sqlite`, worker, health-check, and backup conventions.

**Alternatives considered**:

- Add separate tables to `blue_libraries.sqlite`: technically viable and slightly simpler to
  package, but couples schema migrations, `user_version`, backup/restore, and corruption impact;
  it also weakens the explicit unified-library boundary.
- Continue writing XML: rejected because SQLite is the requested canonical store and XML is only a
  legacy interchange source after migration.

## Decision 3: Use a normalized ordered tree, not a generic library payload

**Decision**: Persist stable node IDs, parent relationships, node kind, display name, sibling
order, and snippet code text. Keep one protected root and permit groups to contain both groups and
snippets.

**Rationale**: Java's XML allows mixed children and preserves order. Stable IDs are needed for
renderer selection, drag/drop, optimistic saves, and future import/export without exposing IDs in
the XML format.

**Alternatives considered**:

- Store one opaque XML blob: rejected because CRUD, search, ordering, and revision checks would
  require reparsing and rewriting the whole document for every operation.
- Reuse unified-library `library_nodes` and `payload_xml`: rejected because snippets have no typed
  payload contract, no library-type semantics, and different root/ordering behavior.

## Decision 4: Put the portable XML codec in `@blue/data`

**Decision**: Add pure Code Repository types and XML parse/serialize/validation functions to
`@blue/data`; keep paths, file reads, SQLite, and Electron APIs in `@blue/app` main.

**Rationale**: This follows the constitution and existing `@rgrove/parse-xml` utilities. It makes
legacy fixtures deterministic and keeps the codec reusable from tests and future import/export
surfaces.

**Unknown XML policy**: Reject the complete import with diagnostics when unsupported or malformed
content is encountered. Never silently drop unknown data or partially replace an existing tree;
the original source remains untouched and can be retried or manually inspected.

## Decision 5: Migrate once, preserve the source, and initialize an empty repository without a seed file

**Decision**: On first initialization, check `~/.blue/codeRepository.xml`. Import it in one
transaction if valid. If absent, commit an empty protected root programmatically. Support explicit
file import for historical `custom.xml` and export to Java-compatible XML; do not package a default
repository XML resource.

**Rationale**: Java's current path is discoverable; historical `conf/custom.xml` paths are not
reliably discoverable from a modern Electron installation. Hashes and migration status prevent
duplicate imports. The XML source is never deleted or rewritten, protecting users from migration
failures. TS Blue's empty first-run behavior avoids silently adding opinionated snippets to new
installations while preserving Java XML compatibility at the import/export boundary.

**Recovery**: Record source path, hash, counts, diagnostics, and status both in the repository's
provenance records and in a separate `blue-code-repository-state.json`. If the source is invalid,
do not replace it or silently fall back; report the error and provide explicit import/recovery.

## Decision 6: Preserve Java save/menu semantics while adding revision safety

**Decision**: The manager loads a draft snapshot, edits locally, and commits atomically on Save;
Cancel discards the draft. Context-menu Add-to-Repository uses an atomic single-node mutation.
Commits include an expected revision and return a conflict rather than overwriting newer data.

**Rationale**: This matches Java's OK/Cancel dialog behavior while protecting against multiple
windows or a context-menu mutation racing with a dirty manager dialog.

## Decision 7: Reuse existing renderer seams and keep `.binstr` separate

**Decision**: Use the existing Tools-menu callback/event pattern, `react-arborist` tree patterns,
`SelectedCodeEditor`, and Csound context-menu types. Treat Arrangement `.binstr` import/export as
a separate feature.

**Rationale**: Existing code already has the correct seams, and the current `.binstr` placeholders
refer to Arrangement instrument files rather than Code Repository snippets. Coupling them would
expand scope without improving repository behavior.

## Relevant repository references

- `NOT_IMPLEMENTED_ACTIONS.md` — Code Repository Editor entry and deferred editor-menu actions.
- `specs/060-unified-libraries/design-constraints.md` — unified database and migration boundaries.
- `packages/blue-app/src/main/unified-library/` — existing SQLite worker, recovery, and migration
  patterns to adapt without making Code Repository a unified `LibraryType`.
- `packages/blue-app/src/renderer/components/workbench/panels/editors/csound-editor-menu.ts` —
  current disabled Custom and Add-to-Repository entries.
- `packages/blue-app/src/renderer/components/workbench/panels/editors/CsoundEditorContextMenu.tsx` —
  existing menu rendering and insertion seam.
