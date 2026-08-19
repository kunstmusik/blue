# Implementation Plan: Deferred Project-Replacement Save Prompts

Branch: 080-defer-replacement-prompts
Date: 2026-08-18
Spec: specs/080-defer-replacement-prompts/spec.md

## Summary

Move project-save and library-draft replacement decisions to the commit boundary of
interactive replacement flows. Each flow will first collect and validate its complete
source/configuration choice, then perform the canonical same-file check, re-check
render safety, resolve save and library decisions, and only then install the prepared
project. The Electron main process remains the owner of project state and the existing
preload/IPC surface remains unchanged.

The implementation will split preparation from installation so invalid files and
cancelled choices do not trigger replacement prompts. A small main-process flow
coordinator will make the ordering and cancellation contract testable without loading
the Electron application singleton in unit tests.

## Technical Context

Language/Version: TypeScript 5.8 in Electron main/preload/renderer packages; Node.js
filesystem APIs are limited to the main process.

Primary Dependencies: Electron 35.7.5, @blue/data BlueData and CSD/ORC/SCO conversion
functions, Vitest 4, Node path/fs.

Storage: Existing .blue project files, current main-process BlueData state, recent-file
program settings, and the unified-library SQLite/draft state. No new persistence.

Testing: Vitest unit and main-process boundary tests, renderer store tests where entry
routing is affected, @blue/app main build, and repository lint/test checks.

Target Platform: Electron desktop on macOS, Windows, and Linux.

Project Type: Desktop application with an Electron main process, preload bridge, and
React renderer.

Performance Goals: Do not add a second project parse, project installation, dependency
scan, or lifecycle transition. Prompt timing changes must not delay already-completed
file chooser or import work beyond the existing validation cost.

Constraints: Electron main owns filesystem, dialogs, BlueData, Java/runtime, engine
shutdown, and project replacement. Renderer state and MIDI mapping UI remain transient.
Active render/freeze checks must run before chooser presentation and again at commit.
The existing coarse policy for save-prompt eligibility is preserved.

Scale/Scope: One active project session and its project-owned editors; affected flows
are Open Project, keyboard/preload open, recent projects, examples, CSD, ORC/SCO, MIDI,
and the existing no-picker New/Close/Revert/Quit routes.

## Constitution Check

### Pre-Research Gate

- Portable data core: PASS. The change is confined to the Electron app main process,
  preload routing, and tests. No Electron, Node, or UI dependency is added to
  @blue/data.
- Java and project compatibility: PASS. Java Blue action ordering is the behavioral
  reference. .blue XML, CSD/ORC/SCO conversion, MIDI mapping, project snapshots, and
  lifecycle payloads remain unchanged; only replacement-decision timing changes.
- Canonical ownership and contracts: PASS. The main process remains the canonical owner
  of currentData, currentFilePath, project session identity, and replacement lifecycle.
  Existing typed preload/IPC methods remain the boundary; transient flow state is not
  persisted.
- Runtime and engine isolation: PASS. Existing main-process render, Java, filesystem,
  and editor shutdown calls remain in main.ts. Renderer code continues to submit intents
  through preload.
- Host-path portability: PASS pending design confirmation. Same-file comparison will use
  a reusable main-process helper with platform-specific path resolution/normalization and
  Windows case rules. Native paths remain native for fs/path calls.
- Verification evidence: PASS pending design confirmation. The plan includes focused
  flow, path, save-failure, MIDI, renderer-routing, and quickstart coverage plus the
  affected package build/test checks.

## Research Decisions

Research findings are recorded in specs/080-defer-replacement-prompts/research.md.

1. Keep interactive replacement policy above the low-level disk loader. The existing
   loadProjectFromDisk path is also used by revert and packaged verification; placing a
   save dialog there would make non-user loads interactive.
2. Prepare candidate BlueData before replacement prompts. This makes invalid recent
   paths, malformed .blue files, failed CSD/ORC/SCO conversion, and failed MIDI
   configuration fail without prompting or mutating the current project.
3. Use a dependency-injected project-replacement-flow module for sequencing. The module
   owns preflight, preparation cancellation, no-op handling, commit re-check, prompt
   ordering, and commit callbacks; main.ts supplies Electron dialogs and lifecycle
   callbacks.
4. Add a platform-aware project path identity helper. It uses the platform path
   implementation with resolve/normalize and Windows case folding, but does not require
   realpath because the identity check must also handle a missing recent path before the
   later file-read error.
5. Make save success explicit for replacement. A Save or Save As result is usable as
   replacement consent only after the write succeeds; a cancelled Save As, overwrite
   decline, or write failure returns a blocked result and preserves the current session.
6. Preserve MIDI's pending-session model. File cancellation and mapping cancellation
   remain before replacement confirmation; the commit path revalidates the token after
   prompts and keeps the mapping dialog available when replacement is cancelled.

## Design

### Replacement stages

Interactive replacement requests follow this sequence:

1. Check active render/freeze state before presenting any chooser or import dialog.
2. Collect every cancelable source choice and parse/validate it into a prepared target.
3. Return immediately on chooser cancellation, import-mode cancellation, or preparation
   failure without showing project-save or library-draft decisions.
4. Compare a project target with currentFilePath using the shared canonical path helper.
   A same-file target is a no-op with no replacement prompts or project-loaded event.
5. Re-check active render/freeze state after preparation and immediately before the
   replacement decisions.
6. Resolve the project-save decision and related library-draft decision for the accepted
   target. A failed or cancelled save blocks the flow.
7. Commit the prepared target through the existing main-process lifecycle, editor
   shutdown, runtime cleanup, project session increment, recent-project, dependency,
   and project-loaded behavior.

The coordinator does not own BlueData, Electron dialogs, or persistence. It receives
callbacks for preparation, no-op detection, render checks, save/library decisions, and
installation so its ordering and failure semantics can be tested independently.

### Flow-specific behavior

- Regular Open Project and Open Example Project prepare the selected .blue before the
  replacement decisions. Native menu, keyboard/preload, recent, and example routes
  call the same accepted-target policy.
- Recent-project and open-file-path calls use the same policy but do not present a
  chooser. Same-file detection occurs before any replacement prompt.
- CSD gathers the CSD file and import mode, reads/converts it, then enters the accepted
  replacement policy.
- ORC/SCO gathers both files and the import mode, reads/converts the pair, then enters
  the accepted replacement policy. Cancelling either chooser exits before prompts.
- MIDI keeps its existing start/preview/mapping session. Its commit callback prepares
  the project before the accepted replacement policy and revalidates the pending token
  after decisions.
- New Project, Close Project, Revert, and Quit retain immediate confirmation because
  they do not require a source chooser. The new-file IPC route must use the same New
  Project confirmation wrapper as the native route.
- loadProjectFromDisk remains a non-interactive read/install path for revert and
  packaged verification. Interactive callers use prepared-target wrappers instead.

### Persistence and state boundaries

No new project XML or app persistence is introduced. The prepared target and prompt
outcome are in-memory main-process state. The current BlueData and current project
session remain canonical in main.ts. Renderer MIDI mapping state remains owned by the
renderer session plus the main-process MidiImportService token. Library drafts remain
owned by UnifiedLibraryService.

Save As must not publish a new currentFilePath until the write succeeds. This prevents
a failed replacement save from changing the current project's recovery path. Existing
successful save/reopen semantics remain unchanged.

### Error and recovery behavior

Preparation errors use the existing load/import error dialogs and leave currentData,
currentFilePath, session identity, editor windows, and pending MIDI configuration
unchanged. Replacement prompt cancellation leaves the prepared target disposable and
does not emit a successful project-loaded transition. Active-render rejection is
recoverable and happens both before chooser presentation and at commit.

## Project Structure

### Documentation

~~~
specs/080-defer-replacement-prompts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── replacement-flow.md
└── tasks.md
~~~

### Source Code

~~~
packages/blue-app/src/main/
├── main.ts
├── project-path.ts
├── project-path.test.ts
├── project-replacement-flow.ts
└── project-replacement-flow.test.ts

packages/blue-app/src/main/midi-import-service.ts
packages/blue-app/src/main/midi-import-service.test.ts
packages/blue-app/src/renderer/stores/project-store.ts
packages/blue-app/src/renderer/stores/settings-store.ts
packages/blue-app/src/renderer/tests/app.test.ts
packages/blue-app/src/renderer/tests/welcome-screen.test.tsx
packages/blue-app/src/preload/preload.ts
~~~

Structure Decision: Keep the feature in @blue/app. Add only two small, host-owned
main-process seams: project-path.ts for reusable project identity and
project-replacement-flow.ts for dependency-injected stage ordering. Keep actual
filesystem, Electron dialog, BlueData installation, runtime shutdown, and IPC wiring
in main.ts. Update existing renderer/preload files only where route behavior or return
semantics require verification.

## Constitution Check: Post-Design Gate

- Portable data core: PASS. All new abstractions are in packages/blue-app/src/main;
  @blue/data remains unchanged and host-neutral.
- Java and project compatibility: PASS. The prepared-target order matches Java's
  chooser-then-mode/import-then-install behavior. No XML or conversion output changes
  are planned; the intentional divergence is only deferred Electron confirmation.
- Canonical ownership and contracts: PASS. The coordinator is an in-memory policy seam,
  not a second project owner. main.ts still installs the only canonical BlueData. The
  existing preload channels remain serializable and explicit, and save failures return
  a blocking result to the main flow.
- Runtime and engine isolation: PASS. Runtime/editor/engine shutdown remains in the
  main-process commit callback. Renderer and @blue/data do not access host resources.
- Host-path portability: PASS. project-path.ts will use native path operations at the
  filesystem boundary, a named canonical identity form only for same-file comparison,
  and synthetic Windows fixtures.
- Verification evidence: PASS. Focused flow and path tests, source-specific import and
  MIDI regression tests, renderer route tests, quickstart manual checks, @blue/app
  tests, main build, lint, and repository checks are defined.

## Complexity Tracking

No constitution violations or new persistence layers are proposed. The two small
main-process seams are justified by the cross-entry-path ordering contract and the
need to test cancellation without importing Electron's application singleton.
