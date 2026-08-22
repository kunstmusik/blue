# Implementation Plan: Blue File Manager Panel

Branch: codex/076-file-manager-panel
Date: 2026-08-16
Spec: specs/076-file-manager-panel/spec.md

## Summary

Implement the registered BlueFileManagerTopComponent as a real on-demand
auxiliary panel. The panel will use a lazy, main-backed filesystem tree with
Java-compatible static and favorite roots, folder context actions, and a
copy-only regular-file drag source. A shared audio-source extension contract
will feed both File Manager node drags and single-file operating-system drops
into the existing Track audio-layer surface. Main will validate sources,
perform optional project-media copying, and commit the resulting AudioClip
through the canonical project document path so rejected or stale drops cannot
mutate project data.

## Technical Context

Language/Version: TypeScript 5.8.x strict mode; React 19.x; Electron 35.7.5 with Node 22 in main
Primary Dependencies: Existing @blue/app workbench, Dockview 5.2.0, react-arborist 3.5.x, Radix Context Menu, Lucide React, Zustand 5.x, @blue/data, Electron IPC/preload, Vitest 4.x
Storage: Main-process program-settings.json under appSpecific.fileManagerFavorites; live roots/listings are derived filesystem state; dropped clips use existing .blue project XML/save flow; no File Manager state is added to .blue
Testing: Vitest shared/main/renderer unit and component tests, program-settings migration tests, project-patch/drop contract tests, pnpm --filter @blue/app test, pnpm --filter @blue/app build, and manual Electron drag/drop smoke checks
Target Platform: Electron desktop on macOS, Windows, and Linux; platform roots and file:// decoding must be tested for POSIX and Windows path forms
Project Type: TypeScript Electron desktop application in a monorepo
Performance Goals: Never scan a root recursively; list only direct children on expansion/refresh; keep a 1,000-entry directory responsive with virtualized rows and bounded renderer state; open the panel without blocking on child enumeration
Constraints: Context isolation and disabled renderer Node integration; filesystem and media-copy APIs remain in main; no Node built-ins or dynamic imports in @blue/data; static imports only; no generic file-operation suite; do not trust renderer drop paths without main revalidation
Scale/Scope: One workbench panel, one lazy filesystem service, one app-settings field, typed preload methods, one shared drop contract, one Track audio-layer target, and SoundFont Viewer compatibility coverage

## Constitution Check

Gate: PASS before Phase 0 research. Re-check after Phase 1 design.

| Principle | Result | Evidence |
|---|---|---|
| I. Portable data core and strict boundaries | PASS | Filesystem access, path normalization, settings persistence, and media copying stay in @blue/app main code. Shared contracts contain serializable values and pure suffix/URI helpers only; @blue/data remains Node- and UI-free. |
| II. Java-compatible behavior and lossless project data | PASS | Research uses the Java File Manager, FileNode, FileManagerRoots, AudioLayersDropTargetListener, and embedded SoundFont FileTree as references. Favorites remain outside .blue; clips use the existing AudioClip XML path. The shared extension filter and directory-only action presentation are documented intentional divergences. |
| III. Canonical ownership and typed contracts | PASS | Main owns program-settings.json, filesystem truth, import side effects, and canonical BlueData. Renderer receives serializable snapshots and submits typed settings/drop requests through preload IPC. |
| IV. Host-owned runtimes and engine isolation | PASS | No JVM, Csound engine, or runtime protocol is replaced. The drop operation only creates an existing project AudioClip; engine execution remains unchanged. |
| V. Evidence-driven parity and regression safety | PASS | Java source findings, current Electron seams, Csound 7 help output, libsndfile 1.2.2 headers/FAQ, and existing tests are captured in research.md; focused tests cover roots, actions, transfer parsing, settings, and canonical commit rejection. |

Pre-research gate: PASS. The feature has a bounded Electron-only
implementation surface and a known Java reference. No unresolved requirement
is being deferred to coding.

## Phase 0: Research

Research decisions and evidence are captured in research.md. The research
resolves the three material design questions:

- Implement the registered panel rather than retire the registry entry.
- Persist favorites in app-wide settings while keeping filesystem browsing
  derived and lazy.
- Use one capability-derived audio extension allowlist for File Manager node
  drags and external single-file drops, with the allowlist limited to formats
  that the default Csound diskin2/libsndfile path can consume rather than
  copying the broader browser-player list.

## Phase 1: Design and Contracts

The design artifacts are:

- data-model.md: roots, nodes, favorites, transfer payloads, drop results, and
  state ownership.
- contracts/file-manager-ipc.md: typed main/preload/renderer boundary for
  roots, directory listings, validation, and existing settings persistence.
- contracts/audio-file-drop.md: internal File Manager drag payload, external
  OS file/URI parsing, target mapping, allowlist, atomic import/commit behavior,
  and rejection matrix.
- quickstart.md: automated checks and manual parity workflow.

### Implementation approach

1. Shared contracts and settings

Extend packages/blue-app/src/shared/program-settings.ts with an additive
fileManagerFavorites: string[] field. Add pure File Manager/drop types, path
display helpers, the shared case-insensitive Csound audio-source allowlist,
and transfer parsing helpers under packages/blue-app/src/shared/. Preserve old
settings files through default merge; no project XML or @blue/data
serialization change is needed.

2. Main filesystem and import service

Add a main-only File Manager service that derives platform roots and home,
loads only valid favorite directories, de-duplicates root identities, and
lists direct children with dot-prefixed entries omitted and deterministic name
ordering. Use fs.promises.stat/readdir with recoverable typed errors; do not
expose raw fs or arbitrary directory handles to the renderer.

Refactor the reusable portion of
packages/blue-app/src/main/score-object-file-operations.ts into a source-path
import preparation step. The new audio-drop handler will revalidate the
regular file and extension in main, reuse collision-safe media-folder copying
and project-relative path normalization, construct an AudioClip transfer, and
invoke the existing canonical project patch and broadcast/save state path. If
a prepared copy is no longer usable because the target revision is stale,
clean up only a file created by that request.

3. Preload and File Manager panel

Add typed IPC exposure in preload.ts and renderer/types/global.d.ts. Route
BlueFileManagerTopComponent in WorkbenchPanelContent.tsx to a new
FileManagerPanel. Use the existing react-arborist dependency for virtualized
rows and lazy child loading; render Radix context menus for the Java action
matrix. File rows write a versioned custom drag payload with copy semantics;
directory rows are not audio drag sources. Favorite actions read the latest
settings snapshot and call the existing typed getProgramSettings and
saveProgramSettings bridge, updating the tree only after a successful save.

4. Track audio-layer drop target

Extend TrackLayerGroupCanvas.tsx, which already owns exact track layer
geometry and project/revision refs, to accept the two source classes from the
shared contract. Map pointer coordinates through the existing local coordinate
and snap helpers, then call the typed main audio-drop commit. Do not add File
Manager node handling to the main score ScoreTimeCanvas, File Manager tree, or
SoundFont Viewer. Preserve the SoundFont panel's existing OS-drop behavior and
.sf2 validation.

5. Verification and parity evidence

Add shared tests for settings merge, path/URI parsing, suffix matching, and
action eligibility; main tests for roots, unreadable directories, favorite
filtering, copy failure, and stale-target rejection; renderer tests for lazy
expansion, action menus, drag payloads, external drops, target coordinates,
and panel routing. Run the package test/build commands and record manual
cross-platform path checks in the quickstart evidence table.

## Project Structure

### Documentation

~~~text
specs/076-file-manager-panel/
├── checklists/requirements.md
├── contracts/
│   ├── audio-file-drop.md
│   └── file-manager-ipc.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
~~~

### Source Code

~~~text
packages/blue-app/src/
├── shared/
│   ├── file-manager.ts
│   ├── file-manager.test.ts
│   ├── program-settings.ts
│   └── project-editor.ts
├── main/
│   ├── file-manager-service.ts
│   ├── file-manager-service.test.ts
│   ├── main.ts
│   └── score-object-file-operations.ts
├── preload/
│   └── preload.ts
└── renderer/
    ├── types/global.d.ts
    ├── components/workbench/WorkbenchPanelContent.tsx
    ├── components/workbench/panels/tools/FileManagerPanel.tsx
    ├── components/workbench/panels/tools/file-manager/
    │   ├── FileManagerTree.tsx
    │   └── file-manager-drag-drop.ts
    ├── components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx
    └── tests/
        ├── file-manager-panel.test.tsx
        ├── file-manager-routing.test.tsx
        └── track-layer-audio-drop.test.tsx
~~~

Structure Decision: Keep the feature inside the existing @blue/app
main/preload/renderer/shared boundaries. The File Manager UI is a workbench
panel, not a new package. Filesystem enumeration and media-copy side effects
are main-owned; renderer code consumes serializable snapshots and submits
typed intents. The existing @blue/data model and XML serializer are reused
without adding host APIs or File Manager state to the data core.

## Post-design Constitution Check

| Principle | Result | Post-design evidence |
|---|---|---|
| I. Portable data core and strict boundaries | PASS | New shared code is serializable/pure; Node fs, os, and path are confined to main. No @blue/data change is required. |
| II. Java-compatible behavior and lossless project data | PASS | Static/favorite roots, hidden entries, sorted direct children, action matrix, node-copy semantics, external file drops, and SoundFont separation are explicit. Existing AudioClip XML is the only project mutation. |
| III. Canonical ownership and typed contracts | PASS | Settings and BlueData remain main-owned. The typed preload contract validates all root/drop requests; renderer does not write settings files or mutate project data directly. |
| IV. Host-owned runtimes and engine isolation | PASS | The feature neither embeds a new runtime nor changes engine protocols; Csound is used only as the format-capability reference and existing project render path. |
| V. Evidence-driven parity and regression safety | PASS | Research records Java and local Csound/libSndFile evidence; verification covers positive and negative DnD paths, settings migration, stale files, and existing SoundFont behavior. |

No constitution violation or complexity exception is required.

## Implementation close-out (2026-08-17)

The planned boundaries and verification strategy were implemented. Manual
parity testing was user-confirmed as passing; the automated baseline and final
review notes are recorded in `quickstart.md`. The review kept the changes
surgical and added normalized path-identity handling so expandable symlink
directories cannot recurse through an ancestor cycle.
