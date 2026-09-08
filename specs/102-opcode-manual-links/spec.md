# Feature Specification: Context-Aware Opcode Completion and Manual Links

**Feature Branch**: `102-opcode-manual-links`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Review the settled opcode completion plan; add a program setting for the Csound manual, defaulting to https://csound.com/manual, support local file URLs, derive opcode-entry links from opcode identifiers, and fall back to Blue-generated documentation when an external manual entry cannot be found."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Insert a Valid Opcode Form (Priority: P1)

A user accepts an opcode completion and receives a useful call or statement that fits the code already written, without duplicated output variables, assignment operators, or documentation-only notation.

**Why this priority**: Current completion acceptance can insert invalid Csound text. Correct insertion is the central completion behavior and is valuable without any manual integration.

**Independent Test**: Accept representative opcode completions after an assignment, inside a call, after a classic-style output variable, and at an empty statement; confirm the resulting document is the expected editable Csound form.

**Acceptance Scenarios**:

1. **Given** a user has typed `a1 = osci`, **When** the user accepts `oscili`, **Then** the insertion supplies the callable opcode and required inputs without adding another output or assignment.
2. **Given** a user is writing an opcode inside another expression, **When** the user accepts a completion, **Then** the insertion uses an expression-compatible call form.
3. **Given** a user has already authored a classic-style output variable, **When** the user accepts a completion, **Then** the insertion preserves that style and does not rewrite or duplicate the authored output.
4. **Given** the caret is at an otherwise ambiguous statement start, **When** the user accepts an opcode with outputs, **Then** the insertion supplies an editable modern statement with the correct number of outputs and required inputs.
5. **Given** an opcode has no safe usable signature or represents a declaration boundary, **When** the user accepts it, **Then** only the opcode name is inserted.

---

### User Story 2 - Open the Matching Csound Manual Entry (Priority: P1)

A user can open the full manual entry for the opcode at the caret or in completion help, using a predictable link derived from the opcode's manual identifier.

**Why this priority**: Existing quick help exposes a source-relative path but provides no route to the complete manual entry.

**Independent Test**: With default settings, request the manual for `oscili` and verify that Blue opens `https://csound.com/manual/opcodes/oscili/`.

**Acceptance Scenarios**:

1. **Given** the default Csound manual setting and the `oscili` opcode, **When** the user chooses Open Manual, **Then** Blue opens `https://csound.com/manual/opcodes/oscili/`.
2. **Given** an opcode catalog entry whose display name and manual identifier differ, **When** the user opens its manual, **Then** Blue derives the entry location from the manual identifier rather than display text.
3. **Given** no recognized opcode at the invocation point, **When** the user requests the manual, **Then** Blue makes no external navigation and clearly reports that no manual entry is available.

---

### User Story 3 - Use a Downloaded Manual (Priority: P2)

A user can configure an app-wide Csound manual root as a local `file://` URL and open opcode entries without an internet connection.

**Why this priority**: Csound users may need offline documentation or may prefer a manual version matching their installed Csound release.

**Independent Test**: Point the program setting at a built local Csound 7 manual, disconnect networking, open the `oscili` entry, restart Blue, and confirm the same local entry opens.

**Acceptance Scenarios**:

1. **Given** a valid local manual root ending with or without `/`, **When** the user saves it and opens `oscili`, **Then** Blue opens the local `opcodes/oscili/` entry under that root.
2. **Given** a saved local manual root, **When** Blue restarts, **Then** the same app-wide value remains active and is not stored in any `.blue` project.
3. **Given** the user restores the setting to its default, **When** the reset is saved, **Then** subsequent manual actions use `https://csound.com/manual`.

---

### User Story 4 - Retain Help When the External Entry Is Unavailable (Priority: P2)

A user still receives useful opcode documentation when the configured online or local manual entry is missing, unreachable, or cannot be opened.

**Why this priority**: An external or user-managed manual is not reliable enough to be the only help source.

**Independent Test**: Configure a missing local entry and an unreachable web root in turn; request an opcode manual entry and confirm Blue presents its generated opcode help and identifies the failed external navigation without losing the editor context.

**Acceptance Scenarios**:

1. **Given** the configured manual entry does not exist, **When** the user chooses Open Manual, **Then** Blue does not launch a known-missing target and presents the generated in-app opcode documentation.
2. **Given** entry availability cannot be established or the operating system refuses to open it, **When** the attempt fails, **Then** Blue preserves or presents generated in-app opcode documentation and gives a recoverable failure notice.
3. **Given** the external entry is unavailable, **When** fallback help appears, **Then** it includes all available catalog summary, category, status, syntax, and example information without requiring a network connection.

### Edge Cases

- The configured root has trailing whitespace, a trailing slash, URL-encoded characters, spaces in a local path, or platform-specific file URL syntax.
- An opcode name is an alias, mixed case, deprecated, or lacks a manual identifier.
- An opcode identifier contains characters that require safe URL path encoding; it must not escape the configured manual root.
- The configured root uses an unsupported or malformed scheme, points to an ordinary source checkout rather than a built browsable manual, or is changed while an editor popout is open.
- A remote host is slow, redirects, denies an availability check, or becomes unavailable between validation and opening.
- Several manual actions occur close together; failures must not replace or corrupt editor content.
- Score-only editors do not advertise orchestra opcode completions; existing UDO completion behavior remains unchanged.

## Requirements *(mandatory)*

### Feature Scope

- This feature covers context-aware opcode insertion, compact generated opcode help, manual-entry navigation, and an app-wide manual-root setting.
- The external manual layout in scope is the Csound 7 built-manual convention `<manual-root>/opcodes/<manual-id>/`.
- A searchable or dockable full-manual browser, manual-content packaging, Csound 6 HTML filename mapping, syntax-style preferences, type-suffixed variants, and region-aware completion inside mixed CSD documents are outside this feature.

### Functional Requirements

- **FR-001**: Opcode completion acceptance MUST choose an insertion form from the document context at the time of acceptance, not only from the context present when suggestions first appeared.
- **FR-002**: An insertion MUST NOT duplicate an output variable or assignment already authored by the user and MUST NOT rewrite authored classic-style code.
- **FR-003**: Generated insertions MUST include editable placeholders for required outputs and inputs, omit documentation-only optional-argument markers, and fall back to name-only insertion when a safe form cannot be determined.
- **FR-004**: Statement-start insertion MUST distinguish output-producing, multiple-output, output-sink, and declaration-like entries sufficiently to produce a valid conservative form.
- **FR-005**: The completion list MUST match opcode prefixes without case sensitivity while preserving existing ordering and UDO de-duplication behavior.
- **FR-006**: Orchestra opcode completions MUST be suppressed in score-only editors, and existing name-only UDO completion behavior MUST remain unchanged.
- **FR-007**: Compact opcode help MUST show all available summary, category, deprecation/status, modern syntax, classic syntax, example, and manual-action information; unavailable fields MUST be omitted cleanly.
- **FR-008**: Users MUST be able to request Open Manual from completion help and from an opcode identified at the editor caret; the action MUST use the same resolution rules from every entry point.
- **FR-009**: Program Settings MUST expose one app-wide Csound Manual URL value with the default `https://csound.com/manual`.
- **FR-010**: The setting MUST accept only an absolute `https://` or `file://` URL, MUST normalize insignificant surrounding whitespace and trailing separators, and MUST reject malformed or unsupported values without replacing the last valid saved value.
- **FR-011**: For a catalog entry with a manual identifier, Blue MUST derive the external entry as `<configured-root>/opcodes/<encoded-manual-id>/`; the identifier MUST remain within the configured root.
- **FR-012**: Manual navigation MUST validate untrusted settings and catalog-derived targets at the host boundary and MUST fail closed rather than passing unsupported targets to the operating system.
- **FR-013**: Before or during navigation, Blue MUST distinguish a confirmed available entry from a confirmed missing entry for both supported URL schemes. A confirmed missing entry MUST go directly to generated in-app help.
- **FR-014**: If availability is indeterminate, Blue MAY attempt to open the validated entry; if validation or opening fails, it MUST retain or present generated in-app help and provide a non-blocking, recoverable notice.
- **FR-015**: Generated in-app help MUST be derived from the shipped opcode catalog, MUST remain available offline, and MUST NOT depend on the configured external manual.
- **FR-016**: Manual navigation MUST NOT allow external content to change project or editor content, and failure MUST leave the user's caret, selection, and document unchanged.
- **FR-017**: The manual setting MUST persist as application-wide program state, survive restart, participate in normal program-setting reset and validation behavior, and never enter `.blue` project data.
- **FR-018**: All completion and manual entry points MUST behave correctly from both the primary editor window and hosted editor popouts.
- **FR-019**: Automated coverage MUST include insertion results, URL derivation and encoding, setting default/validation/persistence/reset, supported and unsupported schemes, missing local and remote entries, indeterminate availability, open failure, fallback help, score gating, and unchanged UDO behavior.

### Existing Behavior & Data Compatibility

- **Reference Behavior**: Java Blue's user-selectable local manual location is the parity reference for offline/manual-version choice. The Electron design intentionally uses a URL root so the same setting supports both hosted and built local Csound 7 manuals.
- **Compatibility Requirements**: Existing `.blue` XML, generated CSD, engine behavior, editor content, program settings unrelated to this feature, opcode ordering, and UDO completion contracts must remain unchanged. Older program-settings documents must load with the default manual URL supplied automatically.
- **Intentional Divergences**: Unlike Java Blue's directory-oriented preference, this feature accepts an absolute `https://` or `file://` root. Unlike the settled research plan, it does not require a packaged manual bundle; shipped catalog help is the fallback. Csound 6's `<id>.html` layout requires a future mapping/template feature.
- **State Ownership**: The Csound Manual URL is app-wide program state owned and validated by the Electron host and persisted in the program-settings document. Opcode metadata and generated help are disposable shipped catalog data. Project state remains owned by `BlueData` and is not mutated.

### Key Entities

- **Csound Manual Root**: The validated app-wide absolute URL from which opcode entry locations are derived; default, scheme, normalization, and persistence are part of its contract.
- **Opcode Definition**: Catalog metadata for an opcode, including its name, safe insertion signatures, status, compact help fields, and optional manual identifier.
- **Opcode Entry Target**: A validated URL formed from the configured root and encoded manual identifier, with an availability outcome of available, missing, or indeterminate.
- **Generated Opcode Help**: Offline compact documentation derived from shipped opcode catalog metadata and used independently or as fallback.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the representative insertion matrix produces the expected complete document text without duplicate assignments, output variables, or optional-argument bracket notation.
- **SC-002**: With default settings, 100% of tested catalog entries that have manual identifiers resolve to the corresponding Csound 7 URL, including `oscili` resolving to `https://csound.com/manual/opcodes/oscili/`.
- **SC-003**: A user can configure, save, restart, and use a built local manual in under two minutes, with no network access required after configuration.
- **SC-004**: 100% of tested confirmed-missing, rejected, and failed-to-open targets leave editor content unchanged and provide generated in-app opcode help.
- **SC-005**: 100% of malformed and unsupported manual setting values are rejected without losing the last valid saved value.
- **SC-006**: The affected application tests and main-process build complete with zero newly introduced failures, and all changed files pass repository lint and whitespace checks.

## Assumptions

- The configurable root points to a browsable built Csound 7 manual whose opcode pages follow the hosted `opcodes/<manual-id>/` layout; a raw Markdown source checkout is not itself a browsable local manual.
- `https://` is sufficient for remote manuals; insecure `http://` and other external schemes are intentionally unsupported.
- When a remote server prevents a reliable availability check, attempting the validated URL and retaining the already available generated help is preferable to blocking navigation.
- The shipped opcode catalog is the source for fallback help; bundling or parsing complete manual pages is unnecessary for this feature.
- Existing program-settings default merging can introduce the new value for older settings documents without a destructive migration or settings-version change unless planning finds the current contract requires one.
- The existing compact help surface and host-window popup conventions will be reused; a new full manual panel is not required.
