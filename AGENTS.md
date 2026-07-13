# blue-electron Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-07-12

## Active Technologies
- React 19.x, Electron, dockview 5.2.0 + collapsed auxiliary-group planning for the workbench shell (013-collapsed-sidebar-research)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/store code + `dockview` 5.2.0 / `dockview-core` 5.2.0, Zustand 5.x, Vitest 4.x, existing workbench shell in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench` (014-window-system-parity)
- Renderer-side localStorage layout envelope for the parity slice, combining dockview JSON with supplemental minimized-edge metadata (014-window-system-parity)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/store code + `dockview` 5.2.0 / `dockview-core` 5.2.0, Zustand 5.x, Vitest 4.x, current workbench shell in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench` (015-left-edge-parity)
- Renderer-side localStorage layout envelope for the parity slice, migrated from version 4 to version 5 instance-based auxiliary state (015-left-edge-parity)
- Markdown planning documents derived from TypeScript 5.8.x renderer code and Java NetBeans sources + Java Blue `TopComponent` registrations and window-manager metadata, current React 19 / Electron 35 / Dockview 5.2.0 renderer implementation, candidate UI approaches under study: Radix primitives, shadcn/ui-style wrappers, and Electron-native menus (016-component-system-research)
- Repository documentation only (`specs/016-component-system-research/`) (016-component-system-research)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + `@blue/data`, React 19, Zustand 5.x, `dockview` 5.2.0, Vitest 4.x, existing Electron preload/main IPC bridge (017-global-project-editors)
- Main-process in-memory `currentData` plus `.blue` XML serialization through `@blue/data`; renderer mirrors an editable snapshot for the active projec (017-global-project-editors)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + `@blue/data`, React 19, Zustand 5.x, `dockview` 5.2.0, Vitest 4.x, CodeMirror 6 via `codemirror`, `@codemirror/autocomplete`, `@codemirror/state`, `@codemirror/view`, plus `@kunstmusik/codemirror-lang-csound`; Monaco and `tree-sitter-csound` are deferred fallback/research inputs (018-csound-editor-tooling)
- Main-process in-memory current project document plus existing `.blue` XML serialization through `@blue/data`; renderer edits flow through the existing project snapshot/store bridge (018-csound-editor-tooling)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages + CodeMirror 6 (`codemirror`, `@codemirror/view`, `@codemirror/state`, `@codemirror/autocomplete`), `@kunstmusik/codemirror-lang-csound`, Radix Context Menu already present in `@blue/app`, existing `@blue/data` project model (019-csound-editor-parity)
- Existing project snapshot and `.blue` XML serialization for Global Orchestra; optional code repository data remains read-only or deferred unless the Java-backed format can be safely ported in this slice (019-csound-editor-parity)
- 019-csound-editor-parity now includes a reusable `SelectedCodeEditor` surface with renderer-owned context menus, Java Blue-style completion sources, and deferred project-level UDO support
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + Electron `Menu`/`BrowserWindow`, Zustand 5.x stores, `@blue/data` time/tempo utilities, `dockview` 5.2.0 workbench state, `lucide-react` transport icons (020-main-toolbar-parity)
- Existing renderer Zustand stores plus project snapshot IPC; optional lightweight renderer preference persistence for toolbar-only toggles via existing local storage patterns (020-main-toolbar-parity)
- Existing renderer Zustand stores plus project snapshot IPC; fixed-per-performance playback clock metadata cached in the renderer playback store; optional lightweight renderer preference persistence for toolbar-only toggles via existing local storage patterns (020-main-toolbar-parity)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` + `@blue/data`, Zustand 5.x project store, Dockview 5.2.0 workbench panel registry, CodeMirror 6 editor surface from specs 018/019, Radix Context Menu, proposed `@tanstack/react-table` for arrangement table behavior, existing `@tanstack/react-virtual` if large table virtualization becomes necessary (021-orchestra-editor)
- Main-process in-memory `BlueData` remains canonical; renderer consumes serializable project/orchestra snapshots and sends explicit patch intents through the existing project document IPC bridge; `.blue` XML remains the persistence forma (021-orchestra-editor)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` + `@blue/data` `Tables`/`OpcodeList`/`OpcodeDefinition`/`BlueData.toCSD()`, Zustand 5.x project store, Dockview 5.2.0 panel registry, existing CodeMirror 6 `SelectedCodeEditor`, existing Java Blue-style Csound context menu/completion helpers, Radix Context Menu for renderer menus, Electron `Menu`/`dialog`/`BrowserWindow` for native menu and save/modal flows, Spec 021 BSB UDO components as reuse source (026-tables-udo-csd)
- Main-process in-memory `BlueData` remains canonical; renderer consumes serializable project snapshots and sends explicit project document patches; `.blue` XML remains persistence; generated `.csd` files are user-selected disk outputs only (026-tables-udo-csd)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` + `@blue/data` `BlueData`/`LiveData`/`LiveObject*`/CSD generation, `@blue/engine-client` ZMQ protocol, existing `EngineBridge`, Electron `Menu`/`BrowserWindow`/IPC, Zustand 5.x project/playback/workbench stores, Dockview 5.2.0 panel registry, CodeMirror 6 `SelectedCodeEditor`, existing Csound context menu/completion helpers, Radix Context Menu for renderer menus, existing Output window IPC (027-blue-live-part1)
- Main-process in-memory `BlueData` remains canonical; renderer consumes serializable LiveData snapshots and sends explicit project document patches; `.blue` XML remains persistence; Settings window categories are placeholders in this part and do not require durable settings storage (027-blue-live-part1)
- TypeScript 5.8.x, strict mode + `@rgrove/parse-xml`, existing `Element` wrapper utilities, Vitest, pure `@blue/data` classes (028-blue-data-xml-preservation)
- In-memory project model plus `.blue` XML round-trip through `BlueData.loadFromString()` and `saveToString()` (028-blue-data-xml-preservation)
- TypeScript 5.8.x, strict mode + existing `@blue/data` score, sound object, library, and XML utility classes; Vitest; pure XML parsing helpers (029-blue-data-score-library-parity)
- In-memory score graph and `.blue` XML round-trip through `@blue/data` (029-blue-data-score-library-parity)
- TypeScript 5.8.x, strict mode + existing `@blue/data` note, score utility, and note processor classes; Vitest; pure XML parsing helpers (030-blue-data-note-processing-parity)
- In-memory note lists and `.blue` XML round-trip through `@blue/data` (030-blue-data-note-processing-parity)
- TypeScript 5.8.x, strict mode + existing `@blue/data` render classes, arrangement models, mixer models, Vitest, pure XML/model helpers (031-blue-data-csd-render-parity)
- In-memory project model and generated CSD text from `@blue/data` (031-blue-data-csd-render-parity)
- TypeScript 5.8.x, strict mode + existing `@blue/data` instrument, mixer, automation, and time classes; Vitest; pure XML/model helpers (032-blue-data-runtime-model-parity)
- In-memory project model, generated orchestra fragments, and `.blue` XML round-trip through `@blue/data` (032-blue-data-runtime-model-parity)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + existing `@blue/data` score and time classes (`Score`, `PolyObject`, `AudioLayerGroup`, `PatternsLayerGroup`, `TimeContext`, `TimeState`, `MeterMap`, `TempoMap`, `MarkersList`), shared `ProjectEditorSnapshot`/`ProjectDocumentPatch`, Zustand 5.x renderer stores, Dockview 5.2.0 workbench shell, existing workbench panel routing, Vitest 4.x (036-score-editor-foundation)
- main-process in-memory `BlueData` remains canonical; renderer consumes serializable score shell snapshots and dispatches explicit `score` patches for canonical time-state updates; nested score-path session state remains renderer-local and is not persisted into the project documen (036-score-editor-foundation)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + existing `@blue/data` score and sound-object classes (`Score`, `PolyObject`, `AudioClip`, `SoundObjectLibrary`, `NoteProcessorChain`, `TimePosition`, `TimeDuration`, `TimeBehavior`), shared `ProjectEditorSnapshot` and `ProjectDocumentPatch`, Zustand 5.x renderer stores, Dockview 5.2.0 auxiliary workbench layout, existing CodeMirror `SelectedCodeEditor`, Vitest 4.x (037-score-object-editor-parity)
- main-process in-memory `BlueData` remains canonical; renderer reads score object editor documents on demand for the active selection and writes canonical mutations through shared score patches (037-score-object-editor-parity)
- TypeScript 5.8.x, strict mode + `@blue/data` BSB models, automation `Parameter`/`ParameterList`, `Sound`, `CopyBuffer`, pure XML helpers, Vitest 4.x (043-uuid-deepcopy-safety)
- In-memory `@blue/data` model plus `.blue` XML round-trip through `BlueData.loadFromString()` and `saveToString()`; `Sound` still stores embedded BSB XML text at this slice boundary (043-uuid-deepcopy-safety)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` for project mutation helpers + Electron `app`/`BrowserWindow`/IPC/settings window, existing `settings-window.ts`, preload `blueAPI`, Zustand 5.x where still useful for renderer-local app preferences, `@blue/data` `BlueData`/`ProjectProperties`/`TimeState`/`Mixer`/`UDOStyle`/`TimeBase`/`SnapValueName`, existing playback store and `EngineBridge`, existing CSD export/render-command helpers, Vitest 4.x (044-program-settings-parity)
- Main-process JSON settings file under the Electron user data area for Java-compatible program settings; existing renderer-persisted `blue-settings` values are migrated or retained as app-specific preferences; `.blue` project XML is only affected when Java Blue seeds new project-owned values from program settings (044-program-settings-parity)
- TypeScript 5.8.x, React 19.x, Electron 35.x + `@blue/data`, React 19 renderer components, Zustand 5.x project store, Dockview 5.2.0 score workbench shell, Vitest 4.x, existing Electron main/preload IPC only if waveform file access requires app-side file reads (047-score-object-bar-renderers)
- Existing in-memory `BlueData` project model and `.blue` XML; waveform cache data is derived app state only and is not persisted (047-score-object-bar-renderers)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + `@blue/data` note processors and score model, Electron main/preload IPC bridge, Zustand 5.x project store, React renderer components, Radix Context Menu, Vitest 4.x (048-note-processor-parity)
- Main-process in-memory `BlueData` remains canonical; `.blue` XML remains canonical persistence; renderer edits are transient snapshots and explicit project document patches (048-note-processor-parity)
- TypeScript 5.8.x, React 19.x, Electron 35.x, Java 17+ helper runtime target, Maven 3.x build + `@blue/data`, `@blue/app` Electron main/preload/renderer IPC, Node `zeromq` in Electron main, Java JeroMQ, Clojure 1.12.x, Pomegranate for Java Blue Clojure dependency metadata, Jackson or equivalent JSON binding inside the helper, Vitest 4.x, JUnit 5 (049-blue-java-runtime)
- `.blue` XML remains canonical project persistence; `BlueData` remains main-process canonical project document; Clojure project dependency metadata remains in `pluginData`; helper JAR is a build artifact copied into `packages/blue-app/assets/java/` (049-blue-java-runtime)
- TypeScript 5.8.x, React 19.x, Electron 35.x, Java 17+ helper runtime target, Maven 3.x, Jython 2.7.4 + Existing `@blue/data`, `@blue/app`, `@blue/java-runtime`, Node `zeromq`, Java JeroMQ, Jackson, Clojure 1.12.x from SPEC 049, `org.python:jython-standalone:2.7.4`, Java Blue `blue-ext-jython/src/main/release/pythonLib`, Vitest 4.x, JUnit 5 (050-jython-support)
- `.blue` XML remains canonical project persistence; helper runtime assets live under `packages/blue-app/assets/java/` as `blue-java.jar` plus packaged `pythonLib`; Jython interpreter state is transient project-session state; user Python library remains outside project XML (050-jython-support)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer code + Tailwind CSS v4 CSS-first theme tokens, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, Dockview 5.2.0, CodeMirror 6, Radix Context Menu, existing Vite/Vitest renderer tooling (051-theme-token-cleanup)
- N/A - renderer styling only; no project XML, localStorage, or settings persistence changes (051-theme-token-cleanup)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + `@blue/data` automation/score/mixer classes, `@blue/app` shared project-editor IPC model, Zustand 5.x stores, Dockview 5.2.0 workbench shell, Radix Context Menu, existing score timeline components, Vitest 4.x (052-score-timeline-automation)
- Main-process in-memory `BlueData` remains canonical; `.blue` XML remains canonical persistence. Layer automation assignments persist through Java-compatible `parameterId` entries, and line data persists on the underlying `Parameter` XML. Renderer state for current edit mode and active range selection is local UI state. (052-score-timeline-automation)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + `@blue/data`, Electron `dialog`/IPC, React renderer components, Zustand project store, Vitest 4.x, Node `fs`/`path` in Electron main only (053-missing-audio-assets)
- Main-process in-memory `BlueData` remains canonical; `.blue` XML format is unchanged; AudioFile replacement changes persist only when the user saves the project (053-missing-audio-assets)
- TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages + Existing `@blue/app` program settings store, Electron `BrowserWindow`/`screen`/IPC, preload `blueAPI`, React renderer, Zustand workbench/settings stores, Dockview 5.2.0, reusable `SplitPane`, Vitest 4.x (054-window-layout-persistence)
- Main-process app-wide `program-settings.json` under Electron user data; layout state lives under app-specific program settings; legacy renderer storage keys `blue-settings.windowBounds` and `blue-workbench-layout` migrate once; `.blue` project XML is unchanged (054-window-layout-persistence)
- TypeScript 5.8.x, React 19.x, Electron 35.x + Dockview 5.2.0 / dockview-core 5.2.0, Zustand 5.x, Radix Context Menu, Electron `BrowserWindow`/IPC/Menu, existing `@blue/data` project snapshot IPC (055-window-float-dock-parity)
- Existing app-wide `program-settings.json` window-layout settings; workbench layout stored as a serialized layout envelope under `appSpecific.windowLayout.workbench`; `.blue` project XML remains unchanged (055-window-float-dock-parity)
- TypeScript 5.8.x with strict mode; React 19.x; Electron 35.x; Node.js APIs in the Electron main process only + `@blue/data`, `@blue/java-runtime`, Electron `dialog`/`shell`/IPC, Node `child_process`/`fs`/`path`, existing program-settings store, existing project snapshot/patch bridge, Vitest 4.x (056-render-freeze-parity)
- `.blue` XML remains canonical project persistence; app-wide program settings remain in `program-settings.json`; generated freeze audio is project-relative derived data; temporary CSD files are main-process temporary artifacts (056-render-freeze-parity)
- TypeScript 5.8.x, strict mode + React 19.x, Electron 35.x, Lucide React, Web Audio API, Vitest 4.x (057-audio-file-player)
- Transient renderer player state; disk files remain user-selected or render-derived; no project XML changes (057-audio-file-player)

- TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` + `PresetGroup`/`Preset` BSB preset model, Zustand 5.x project store with BSB interface/opcode-list patch support, Dockview 5.2.0, CodeMirror 6, `BsbInterfacePatch` union type for structured BSB mutations (022-bsb-interface-parity)
- BSB Interface tab now renders an editable widget canvas with selection, property-sheet editing, grid settings, preset application, and Java-style split-view UDO editor (UDOTable + UDOEditor); snapshot contract extended with `widgetTree`, `gridSettings`, `editEnabled`, `presetGroup`, `opcodeListText`; widget-specific rendering (Slider, Knob, Toggle, etc.) deferred to SPEC 023 (022-bsb-interface-parity)

- TypeScript 5.x, strict mode + `@rgrove/parse-xml` (XML parsing), `vitest` (testing), `esbuild` (bundling for Electron)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x, strict mode: Follow standard conventions

<!-- MANUAL ADDITIONS START -->
## Java-First Debugging Guidance

- For behavior mismatches, render failures, XML-compatibility issues, or formatting/parity bugs in the TypeScript port, consult the Java implementation first before changing TypeScript code.
- Primary reference roots: `~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core`.
- When applicable, compare against Java-generated artifacts first, especially `~/work/blue/demo2026/01.csd`, and only keep a TypeScript-side divergence if it is intentional and documented.

## Constraints

- No `require()` or dynamic `import()` calls in `@blue/data` (esbuild bundle constraint).
- No Node.js built-ins in `@blue/data` — browser-safe and Node-safe library code only.
- Static ES `import` statements only — no `require()`, no dynamic `import()`, and no inline `import("...").Type` type annotations; use top-level static imports instead.
<!-- MANUAL ADDITIONS END -->

## Recent Changes
- 057-audio-file-player: Added TypeScript 5.8.x, strict mode + React 19.x, Electron 35.x, Lucide React, Web Audio API, Vitest 4.x
- 056-render-freeze-parity: Added TypeScript 5.8.x with strict mode; React 19.x; Electron 35.x; Node.js APIs in the Electron main process only + `@blue/data`, `@blue/java-runtime`, Electron `dialog`/`shell`/IPC, Node `child_process`/`fs`/`path`, existing program-settings store, existing project snapshot/patch bridge, Vitest 4.x
- 055-window-float-dock-parity: Added TypeScript 5.8.x, React 19.x, Electron 35.x + Dockview 5.2.0 / dockview-core 5.2.0, Zustand 5.x, Radix Context Menu, Electron `BrowserWindow`/IPC/Menu, existing `@blue/data` project snapshot IPC
