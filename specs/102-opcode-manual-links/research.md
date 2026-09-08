# Phase 0 Research: Opcode Completion and Manual Links

## Decision 1: Reuse General program settings

**Decision**: Add `general.csoundManualUrl`, defaulting to `https://csound.com/manual`, and reuse the existing whole-snapshot get/save/reset flow.

**Rationale**: The existing General settings contract already provides default merge, validation, atomic storage, and panel reset. Missing values in older settings documents can be supplied without a settings-version bump; the next ordinary save persists the value.

**Alternatives considered**: A new settings panel or standalone store adds no user value. `appSpecific` is less appropriate because this is visible user configuration. A version bump and eager rewrite are unnecessary unless implementation discovers an incompatible migration requirement.

## Decision 2: Normalize a URL root, not a path or arbitrary template

**Decision**: Accept absolute `https:` and `file:` roots only; trim surrounding whitespace, remove insignificant trailing path separators, reject credentials/query/hash and malformed or unsupported URLs, and derive `opcodes/<encoded-manual-id>/` as fixed path structure.

**Rationale**: One URL representation supports hosted and downloaded built Csound 7 manuals. URL parsing and file-URL conversion handle spaces and platform syntax more safely than string concatenation. Treating `manualId` as one validated, encoded segment prevents it from escaping the root.

**Alternatives considered**: A free-form `{opcode}` template would support Csound 6 but exposes more validation surface than requested. A native directory setting cannot express online manuals. Java's historical concatenation depended on trailing separators and flat `.html` pages.

## Decision 3: Main owns derivation, probing, and opening

**Decision**: The renderer sends `{ manualId }` only. Electron main reloads the setting, validates both values, derives the entry, probes it, invokes the appropriate host opener, and returns a typed result.

**Rationale**: Renderer-provided arbitrary URLs would widen the shell boundary. Main already owns program settings, filesystem, Electron networking, and OS integration. A narrow request is easy to validate and test.

**Alternatives considered**: Renderer anchors or `window.open` conflict with the application's deny-by-default window policy. Sending a complete URL makes renderer compromise more consequential. Rendering external HTML inside Blue adds an unnecessary security surface.

## Decision 4: Three-state availability

**Decision**: Classify entries as `available`, `missing`, or `indeterminate`. For a built local manual, require the expected page to be readable. For HTTPS, use a bounded preflight: success/redirect is available; `404`/`410` is missing; method rejection, authentication, server failure, network failure, or timeout is indeterminate. Open available or indeterminate validated targets; never open confirmed missing or invalid targets.

**Rationale**: Local presence is deterministic. Remote `HEAD` is not universally supported, and an OS external-open result cannot prove that a browser later rendered a valid page. Generated help remains visible, so uncertain navigation never removes fallback.

**Alternatives considered**: Treating every failed preflight as missing blocks valid manuals. Full `GET` costs more and still cannot guarantee later navigation. Omitting preflight prevents direct fallback for known remote absence.

## Decision 5: Catalog-generated help is the fallback

**Decision**: Expand existing completion/hover information from shipped rich-catalog fields and keep it present while Open Manual is attempted. Do not bundle a separate manual asset.

**Rationale**: The catalog already supplies offline summary, syntax, category, examples/status, and identifiers where available. It meets the fallback need without a 31–61 MB manual or a new viewer/parser/licensing pipeline.

**Alternatives considered**: Bundled full HTML duplicates packaging work. A compressed extraction still needs provenance, licensing, sanitization, rendering, and updates. A searchable manual panel is a separate product surface.

## Decision 6: One apply-time insertion resolver

**Decision**: Introduce one pure renderer resolver that consumes document text, caret offset, and normalized opcode metadata and returns an insertion plan. Both autocomplete and the opcode menu call it at application time.

**Rationale**: `csound-java-blue-completions.ts` and `csound-opcode-menu.ts` contain different context-blind selection logic and insert documentation syntax literally. A shared resolver fixes the root cause, observes late edits, and supports document-result tests.

**Alternatives considered**: Selecting the first modern line still duplicates assignments. Patching both call sites preserves divergence. Full parsing of every incomplete edit is unnecessary initially; conservative lexical classification plus name-only fallback is smaller and safer.

## Decision 7: Upstream owns authoritative syntax styles

**Decision**: Prefer a release of `@kunstmusik/codemirror-lang-csound` that exposes separate modern/classic syntax and entry kind. Until available, isolate a conservative conversion of current syntax lines in one Blue adapter and fixture known artifacts.

**Rationale**: The upstream generator reads the Csound manual and is the correct place to fix continuation fragments, missing style rows, and provenance. Blue should not maintain a hand-edited opcode database.

**Alternatives considered**: A permanent heuristic distributed across Blue is brittle. A Blue-owned generated index is acceptable only if the upstream release blocks delivery.

## Decision 8: Follow Java's intent, not obsolete URL mechanics

**Decision**: Preserve Java Blue's app-wide/offline documentation goal and intentionally diverge to a Csound 7 URL root plus catalog fallback.

**Rationale**: Historical Java `csoundDocRoot` opened `<root><word>.html`; current Java bundles Csound 6.18 flat HTML and embeds refentry content in completion docs. The local checkout likewise contains flat `html/oscili.html`, while no built Csound 7 directory site was found. This scope therefore requires a built Csound 7 root and defers Csound 6 mapping.

**Alternatives considered**: Reproducing Java's flat-page rule conflicts with the requested canonical Csound 7 URL. Supporting both layouts now needs an explicit layout selector or template.

## Decision 9: Popout-safe help UI

**Decision**: Disable the upstream non-actionable hover renderer, reuse its exported catalog lookup where useful, and build Blue's interactive completion/hover nodes in the editor's hosting document. Route context menus through existing host-window portals.

**Rationale**: Editors can live in Dockview popouts. Global DOM access creates nodes and listeners in the wrong realm. A shared Blue help renderer also keeps completion and hover content consistent.

**Alternatives considered**: Plain-string help cannot expose an action. Patching `node_modules` is not maintainable. A new React manual panel is unnecessary.
