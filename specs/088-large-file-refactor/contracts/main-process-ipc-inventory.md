# Contract: Main-Process IPC Inventory

## Baseline and counting rule

The pre-move process registered **177 inbound IPC endpoints**:

- **112** registrations declared directly in `main.ts`: 109 invoke handlers and 3 event listeners. The 109 handlers include the three channels installed by the score-object test loop.
- **44** unified-library invoke handlers.
- **11** code-repository invoke handlers.
- **5** workbench-window registrations: 4 invoke handlers and 1 event listener.
- **5** MIDI-input registrations: 3 invoke handlers and 2 event listeners.

Outbound-only event constants are not counted. Each channel below inherits the classification of its row in the ownership matrix; exceptions and listener modes are written explicitly. This makes every inbound registration owned and gives implementation a count/checklist oracle.

After the registrar move, `main.ts` retains the handler declarations behind a collector, while
the five domain registrar modules perform the 112 real Electron registrations. The channel sets,
listener modes, and process-wide count remain unchanged; the collector is not an additional IPC
owner or endpoint source.

## Ownership and compatibility matrix

| Group | Count | Accepted owner | Canonical state read/write | Side effects and lifecycle | Error/event contract | Verification target |
|---|---:|---|---|---|---|---|
| Project lifecycle and file session | 17 | `project-lifecycle-ipc.ts` delegating to `project-lifecycle.ts` and `ProjectSession` | Active `BlueData`, native path, revision/session via `ProjectSession`; existing recent-file, MIDI-import, missing-audio owners | Dialogs/files, project replace/save, runtime/editor fencing, recent-file events; pre-ready registration | Preserve existing null/status/error returns and project snapshot/path broadcast sequence | Open/new/save/revert/replacement, MIDI import, missing-audio, BSB path, recent-file tests |
| Project artifacts | 15 | `project-artifacts-ipc.ts` | Project reads through `ProjectSession`; artifact text remains request/response data | Native dialogs/files, SoundFont inspection, import/export, CsoundRC | Preserve cancellation null/void/status envelopes, validation throws, and owner-window selection | Import/export and host-path tests; representative cancellation/error cases |
| Playback and CSD | 9 | `playback-runtime-ipc.ts` | Project read via `ProjectSession`; playback state remains engine/playback owner | Engine start/stop/audition, CSD generation, two renderer-sync listeners | Preserve mutual exclusion, completion/errors, sender authorization, follow/audition events | Playback, audition, CSD, engine boundary, listener-target tests |
| Blue Live | 7 | `playback-runtime-ipc.ts` | Project read via `ProjectSession`; `BlueLiveSession` remains owner | Runtime start/stop/recompile/notes/object triggers | Preserve idle/error result envelopes and status events | Existing Blue Live session/controller tests |
| Confirmation/settings/about | 6 | `application-ipc.ts` | Settings/about window modules remain owners | Native confirmation and window operations; one response listener | Preserve fail-closed confirmation and exact requesting/owning window | Native confirmation, settings close, about metadata/window tests |
| Program/runtime settings and OSC | 9 | `application-ipc.ts` | Program-settings store and OSC service remain owners | Settings persistence, runtime probes, OSC reconfiguration | Preserve validation/result types and settings/OSC notifications | Program settings, engine runtime IPC/source audit, OSC tests |
| File manager | 4 | `application-ipc.ts` | Settings roots and active project read through owners | Native directory enumeration/validation and audio-drop commit | Preserve native path validation and existing result envelopes | File manager and audio-drop tests including Windows paths |
| Window layout | 4 | `application-ipc.ts` | Window-layout settings module | Display enumeration and layout persistence | Preserve snapshots/results and layout-reset event targeting | Window layout and multi-window tests |
| Project editor windows | 9 | `project-document-ipc.ts` | Editor hosts remain owners; project identity via `ProjectSession` | Open/focus/get/update effect and track-instrument editors | Preserve stale-session checks, unavailable/null results, and broadcasts | Shared project-editor/effect/track window tests |
| Evaluate code | 1 | `playback-runtime-ipc.ts` | Engine/runtime owners; project read via `ProjectSession` | Runtime evaluation | Preserve empty-input and unavailable/error result behavior | Engine evaluate and runtime tests |
| Canonical project document bridge | 3 | `project-document-ipc.ts` | `ProjectSession` sole identity/revision writer | Snapshot reads, patch commits, broadcasts | Preserve patch validation, changed receipts, revision/session fences, event ordering | Project-document and project-replacement tests |
| Audio and score-object tools | 15 | `project-document-ipc.ts` | Project read via `ProjectSession`; audio authorization and runtime owners retained | Audio reads/dialogs/stats, editor snapshots, frozen-copy save, score-object/script tests | Preserve null/status/error forms, path authorization, owner window, and test outputs | Audio protocol, score-object editor/test/freeze, runtime tests |
| Script runtimes and REPL | 7 | `playback-runtime-ipc.ts` | Java/JavaScript/REPL managers remain owners | Open/evaluate/reinitialize/close runtime sessions | Preserve result envelopes, project-on-load behavior, and unavailable errors | REPL, Java/JavaScript runtime and shutdown tests |
| Realtime controls | 3 | `playback-runtime-ipc.ts` | Active project read; engine owns live runtime | Engine channel/control writes while playing | Preserve validation and ignored/unavailable behavior | Realtime control and engine tests |
| Render/freeze | 3 | `playback-runtime-ipc.ts` | Render manager remains owner; project via `ProjectSession` | Render/freeze/cancel, temp files, engine/process activity | Preserve single-active-operation, cancellation, status and cleanup | Render/freeze contract and shutdown tests |
| Unified library | 44 | Existing `unified-library/ipc.ts`, hardened with shared registration lease | Unified library service/database and its existing project adapters | Database, dialogs, editor sessions, broadcasts; register/start in current `whenReady` stage | Preserve validated result envelopes and changed/snapshot events | Existing unified-library IPC/service/recovery tests plus exact set/disposer |
| Code repository | 11 | Existing `code-repository/ipc.ts`, hardened with shared registration lease | Code repository service/database | Database, dialogs, all-window changed broadcasts; register/start after unified library | Preserve uniform result/error envelope | Existing code-repository IPC/service tests plus exact set/disposer |
| Workbench windows | 5 | Existing `workbench-window-host.ts`, lifecycle through shared lease | Workbench window registry | Window ownership, reveal/close/dock; initialized during current window startup sequence | Duplicate now fails before side effects; exact ownership listener removal; response contracts unchanged | Workbench host/manager and registration lifecycle tests |
| MIDI input | 5 | Existing `midi-input-coordinator.ts`, lifecycle through shared lease | MIDI coordinator cache/commands | Primary-renderer handshake, observer broadcasts, shutdown command | Duplicate now fails before side effects; sender checks and response shapes unchanged | MIDI coordinator behavior plus registration/shutdown tests |

## Domain registrar checklist: exact 112-channel surface

The numeric bands are the baseline source-registration ordinals. Within each accepted registrar,
the channel order remains source-relative. Registrars remain in the pre-ready registration phase;
the inventory oracle asserts the grouped channel sets and required invoke/listen modes.

### Project lifecycle and file session — 17

Current ordinals 1–14, 24, and 27–28:

- `open-file`
- `start-midi-import`
- `cancel-midi-import`
- `commit-midi-import`
- `open-file-path`
- `new-file`
- `missing-audio-assets:choose-replacement`
- `missing-audio-assets:resolve`
- `missing-audio-assets:dismiss`
- `open-bsb-file-selector`
- `set-bsb-file-selector-path`
- `copy-bsb-file-selector-to-media-folder`
- `save-file`
- `save-file-as`
- `get-project-info`
- `set-recent-files`
- `get-recent-files`

### Playback and CSD — 9

Current ordinals 15–23. The two named `sync-*` channels are listener registrations; the rest are invoke handlers.

- `toggle-play`
- `restart-playback`
- `stop-playback`
- `audition-score-objects`
- `sync-audition-score-object-availability` — listener, accepts only the main renderer sender
- `sync-follow-playback-state` — listener, accepts only the main renderer sender
- `generate-csd-to-screen`
- `generate-realtime-csd-to-screen`
- `generate-csd-to-disk`

### Project artifacts — 15

Current ordinals 25–26 and 29–41:

- `select-soundfont-file`
- `inspect-soundfont`
- `import-blue-udo`
- `import-arrangement-instrument`
- `import-csound-udo`
- `import-preset-file`
- `blue-x7:import-sysex`
- `import-score-object`
- `read-csoundrc`
- `write-csoundrc`
- `export-blue-udo`
- `export-arrangement-instrument`
- `export-csound-udo`
- `export-preset-file`
- `export-score-object`

### Blue Live — 7

Current ordinals 42–48:

- `blue-live:toggle`
- `blue-live:stop`
- `blue-live:recompile`
- `blue-live:all-notes-off`
- `blue-live:trigger-note`
- `blue-live:trigger-objects`
- `blue-live:get-status`

### Confirmation, settings, and about — 6

Current ordinals 49–54. `settings:close-response` is an event listener.

- `blue:native-confirmation:show`
- `settings:confirm-close`
- `settings:close-response` — listener
- `settings:open`
- `app-metadata:get`
- `about:close`

### Program/runtime settings and OSC — 9

Current ordinals 55–63:

- `program-settings:get`
- `program-settings:save`
- `engine-runtime:probe`
- `engine-runtime:query-csound-io`
- `program-settings:reset-panel`
- `osc-control:get-snapshot`
- `program-settings:usage-matrix`
- `program-settings:sync-legacy-renderer-settings`
- `program-settings:update-playback-preferences`

### File manager — 4

Current ordinals 64–67:

- `file-manager:get-roots`
- `file-manager:list-directory`
- `file-manager:validate-directory`
- `commit-audio-file-drop`

### Window layout — 4

Current ordinals 68–71:

- `window-layout:get`
- `window-layout:get-display-work-areas`
- `window-layout:update`
- `window-layout:reset`

### Project editor windows — 9

Current ordinals 72–80:

- `open-effect-editor`
- `open-effect-interface`
- `get-effect-editor-document`
- `update-effect-editor-document`
- `focus-effect-editor`
- `open-track-instrument-editor`
- `focus-track-instrument-editor`
- `get-track-instrument-editor-document`
- `update-track-instrument-editor-document`

### Evaluate code — 1

Current ordinal 81:

- `engine:evaluate-code`

### Canonical project document bridge — 3

Current ordinals 82–83 and 109:

- `get-project-document`
- `commit-project-document-patches`
- `update-project-document`

### Audio and score-object tools — 15

Current ordinals 84–98. The three `test-*sound-object` entries are the loop-generated handlers included in the baseline count.

- `read-audio-file-bytes`
- `read-authorized-audio-file-bytes`
- `open-audio-file`
- `authorize-audio-file`
- `get-audio-file-stat`
- `get-score-object-editor-document`
- `select-score-object-audio-file`
- `save-frozen-sound-object-copy`
- `get-named-chain-names`
- `get-named-chain`
- `get-nested-poly-object-snapshot`
- `test-score-object`
- `test-external-sound-object`
- `test-javascript-sound-object`
- `test-python-instrument`

### Script runtimes and REPL — 7

Current ordinals 99–105:

- `repl-console:open`
- `repl-console:evaluate`
- `repl-console:reinitialize`
- `repl-console:close`
- `javascript-runtime:reinitialize`
- `java-runtime:reinitialize`
- `java-runtime:reinitialize-jython`

### Realtime controls — 3

Current ordinals 106–108:

- `send-bsb-realtime-control-update`
- `send-mixer-realtime-level-update`
- `send-effect-realtime-update`

### Render/freeze — 3

Current ordinals 110–112:

- `render-to-disk`
- `freeze-score-objects`
- `cancel-render-operation`

## Existing registrar registrations: exact 65-channel checklist

### Unified library — 44 invoke handlers

- `unified-library:get-snapshot`
- `unified-library:browse`
- `unified-library:search`
- `unified-library:preview`
- `unified-library:begin-drag`
- `unified-library:cancel-drag`
- `unified-library:preview-transfer`
- `unified-library:apply-transfer`
- `unified-library:set-context`
- `unified-library:clear-target`
- `unified-library:preview-insertion`
- `unified-library:apply-insertion`
- `unified-library:mutate`
- `unified-library:prepare-mutation`
- `unified-library:cut-to-clipboard`
- `unified-library:set-clipboard`
- `unified-library:set-bsb-clipboard`
- `unified-library:capture-score-sound-object`
- `unified-library:capture-track-instrument`
- `unified-library:capture-blue-live-sound-object`
- `unified-library:add-score-sound-object`
- `unified-library:editor-open`
- `unified-library:editor-get`
- `unified-library:editor-patch`
- `unified-library:editor-save`
- `unified-library:editor-revert`
- `unified-library:editor-resolve-conflict`
- `unified-library:editor-close`
- `unified-library:draft-shutdown`
- `unified-library:draft-resolve`
- `unified-library:project-usage`
- `unified-library:project-delete-preview`
- `unified-library:project-delete`
- `unified-library:transfer-to-user`
- `unified-library:import-instrument`
- `unified-library:export-instrument`
- `unified-library:import-select`
- `unified-library:import-directory`
- `unified-library:import-execute`
- `unified-library:export-current`
- `unified-library:export-all`
- `unified-library:recovery-retry`
- `unified-library:recovery-restore`
- `unified-library:recovery-fresh`

### Code repository — 11 invoke handlers

- `code-repository:get-snapshot`
- `code-repository:get-status`
- `code-repository:commit-draft`
- `code-repository:create-group`
- `code-repository:create-snippet`
- `code-repository:move-node`
- `code-repository:update-node`
- `code-repository:delete-node`
- `code-repository:import-file`
- `code-repository:retry`
- `code-repository:export-xml`

### Workbench windows — 5 registrations

- `workbench-window:register` — invoke handler
- `workbench-window:update-ownership` — listener
- `workbench-window:reveal-panel` — invoke handler
- `workbench-window:request-close` — invoke handler
- `workbench-window:dock-group` — invoke handler

### MIDI input — 5 registrations

- `midi-input:initialize-service` — invoke handler
- `midi-input:report-snapshot` — listener
- `midi-input:command-ack` — listener
- `midi-input:get-snapshot` — invoke handler
- `midi-input:request-rescan` — invoke handler

## Registration and lifecycle order

1. Keep protocol verification, source/runtime verification branches, and all collected handler declarations/domain registrations in the current pre-ready region.
2. `registerBlueAudioScheme` remains a process-lifetime pre-ready registration with no fake disposer.
3. In `app.whenReady`, retain the current order: protocol/external-executor setup and verification; workbench host; stale temporary cleanup; dock/zoom/follow state; primary-window creation (including MIDI, engine, Blue Live, Java, and menu wiring); unified-library registration/start; code-repository registration/start; OSC; popout/activation hooks.
4. On startup failure, the failing registration transaction cleans itself, then completed reversible stages unwind in reverse order.
5. On normal shutdown, retain the explicit order: OSC; unified-library unregister/stop; code-repository unregister/stop; MIDI; Blue Live; engine; Java; JavaScript; editor windows; project state; temporary cleanup; `app.quit`.

## Inventory verification oracle

Before and after each registrar move, a fake `IpcMain` capture must assert:

- total inbound count remains 177;
- domain registrar checklist remains 112;
- every exact channel appears once in its required invoke/listen mode;
- listener function identity is available for exact teardown;
- the captured compatibility sequence matches the recorded current ordinals/phase ordering;
- no outbound-only event is accidentally registered inbound.

## Baseline reconciliation — 2026-08-23

The baseline source was reconciled before extraction:

- `main.ts` contains 107 direct `ipcMain.handle` call sites and 3 direct
  `ipcMain.on` call sites. One handle call is a loop that installs the three named
  score-object test channels, so the direct total is 109 invoke handlers + 3
  listeners = 112 inbound endpoints.
- `unified-library/ipc.ts` contains 44 invoke handlers.
- `code-repository/ipc.ts` contains 11 invoke handlers.
- `workbench-window-host.ts` contains 4 invoke handlers + 1 listener.
- `midi-input-coordinator.ts` contains 3 invoke handlers + 2 listeners.
- Existing registrars therefore contribute 44 + 11 + 5 + 5 = 65 endpoints;
  the process-wide total is 112 + 65 = 177.
- The direct registration source order remains the ordinal sequence in this
  contract: project lifecycle 1–14, playback/CSD 15–23, artifacts 24–41,
  Blue Live 42–48, confirmation/settings/about 49–54, program/runtime settings
  55–63, file manager 64–67, window layout 68–71, editor windows 72–80,
  evaluation 81, document bridge 82–83 and 109, audio/score-object tools
  84–98, script runtimes 99–105, realtime controls 106–108, and render/freeze
  110–112.
- The three loop-generated handlers are `test-score-object`,
  `test-external-sound-object`, and `test-javascript-sound-object`; they are
  counted individually by the oracle.

Any post-move oracle must capture actual channel strings and listener function
identity rather than relying only on static call-site counts.

## Post-move reconciliation — 2026-08-23

- `main.ts` contains 110 collected declaration sites: 107 invoke declarations and 3 listener
  declarations. The score-object loop expands one invoke declaration into three channels, so the
  collector represents 112 domain endpoints without directly touching Electron.
- `project-lifecycle-ipc.ts`, `project-artifacts-ipc.ts`, `playback-runtime-ipc.ts`,
  `project-document-ipc.ts`, and `application-ipc.ts` expose unique channel arrays totaling 112;
  the two playback sync channels and settings close response retain listener mode.
- The existing unified-library, code-repository, workbench, and MIDI registrars retain 65
  endpoints. The process-wide endpoint count therefore remains 112 + 65 = 177.
- `main.ts` retains one ordered 112-endpoint domain disposer. Failed startup composes that pre-ready
  lease with workbench, application-shell/MIDI, unified-library, code-repository, OSC, and window
  hook stages and unwinds completed reversible stages in reverse order; normal shutdown retains its
  separately documented explicit order.
