---

description: "Dependency-ordered implementation tasks for Complete Stereo Mixer Panning"
---

# Tasks: Complete Stereo Mixer Panning

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/113-pan-laws-configuration/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Status**: Implemented — automated and review validation complete; remaining manual acceptance is documented in `quickstart.md`

**Verification**: Every durable Mixer/channel change below includes serialization, typed-boundary,
ProjectHistory commit→undo→redo, runtime, UI, and quickstart coverage where applicable. Static CSD,
automated/live output, disk export, Java/Spec 112 compatibility, and failure recovery are verified
at the lowest practical boundary. No renderer or `@blue/data` code may call engine-native APIs.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested
independently after the shared panner contracts are available.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase once its stated inputs exist
- **[Story]**: The user story that owns the task; setup, foundation, and polish tasks have no story label
- Every task names exact repository paths and is marked complete only after implementation or explicit rejection

## Path Conventions

- Portable score/mixer model and CSD generation: `packages/blue-data/src/` with co-located `*.test.ts`
- Electron main/preload/renderer: `packages/blue-app/src/main/`, `packages/blue-app/src/preload/`, and `packages/blue-app/src/renderer/`
- Shared serializable project-editor contracts: `packages/blue-app/src/shared/project-editor/`
- Native filesystem paths remain native; this feature adds no new path format or path-normalization boundary

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish parity evidence, deterministic audio fixtures, and baseline assertions before
changing the pan law or stereo route.

- [X] T001 [P] Compare Java Blue and Spec 112 mixer behavior, generated CSD, default `-3 dB` Mono Pan, Balance attenuation, send taps, gate/meter order, and disabled routing; record only intentional TypeScript-only divergence in `specs/113-pan-laws-configuration/research.md` and `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`.
- [X] T002 [P] Add deterministic left-only, right-only, correlated stereo, mixed mono/stereo, and mono-only PCM fixtures with expected per-speaker gains for center, three intermediate positions, and endpoints in `packages/blue-data/src/score/audio/mono-clip-panning-fixtures.test.ts` and `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`.
- [X] T003 [P] Capture pre-feature static/automated CSD assertions for Spec 112 Mono Pan, Balance, sends, gates, meters, subchannels, master routing, and disabled panning so regressions can be compared in `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`, `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`, and `packages/blue-data/src/blue-data-csd-parity.test.ts`.


---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared value vocabulary, serializable ownership boundaries, and
generation-scoped runtime seams required by every user story.

**⚠️ CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T004 [P] Define shared pan-law, stereo-mode, range-validation, default-value, and stable-parameter-name constants in `packages/blue-data/src/mixer/channel-pan.ts`, `packages/blue-data/src/score/score.ts`, and `packages/blue-data/src/mixer/channel.ts`; encode the exact constraints “law values are `0, -3, -4.5, -6`”, “mode is `balance|stereoPan|dualPan`”, and every position/width scalar is finite in `[0,1]`.
- [X] T005 [P] Add disposable generation-scoped panner-control metadata to `packages/blue-data/src/compile-data.ts` and `packages/blue-data/src/blue-data/csd-policy.ts` for Mixer law, boost, channel mode, Width, Dual Left, and Dual Right; document that these bindings are compiled/runtime state only and never serialized into `.blue` XML.
- [X] T006 [P] Extend the serializable ownership contract in `packages/blue-app/src/shared/project-editor/contract.ts` for Mixer law/boost, stored channel mode/values, and separate derived Mono Pan versus two-bus presentation; ensure snapshots contain primitives only and do not make renderer state or applied runtime state canonical.
- [X] T007 [P] Extend the generation-fenced runtime seams in `packages/blue-app/src/main/project-runtime-reconciliation.ts` and `packages/blue-app/src/main/runtime-parameter-sync.ts` to represent validated panner controls, stale-generation rejection, and saved-versus-applied failure outcomes without bypassing the existing engine-client boundary.
- [X] T008 [P] Add focused boundary fixtures and guard assertions for Mixer/channel defaults, invalid values, unknown parameter names, detached copies, and nonfinite runtime values in `packages/blue-data/src/mixer/channel-pan.test.ts`, `packages/blue-app/src/shared/project-editor/score-panning-contract.test.ts`, and `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`.

**Checkpoint**: The feature has one portable value vocabulary, one canonical document owner, explicit
snapshot/patch shapes, and a generation-scoped runtime seam; no new package dependency is required.

---

## Phase 3: User Story 1 - Choose a Consistent Pan Law (Priority: P1) 🎯 MVP

**Goal**: The Mixer owns one validated center-depth law and optional off-center boost, and every
eligible Mono Pan source uses the same symmetric law while Balance remains unchanged.

**Independent Test**: With panning enabled, pan two mono-only channels at `0`, `0.25`, `0.5`,
`0.75`, and `1` under `0`, `-3`, `-4.5`, and `-6 dB`, with boost off/on; compare measured gains
to `contracts/audio-panning.md`, verify mirrored positions, endpoint silence/unity or boost gain,
and confirm the Mixer Settings controls are accessible.

### Verification for User Story 1

- [X] T009 [P] [US1] Extend the host-neutral pan math tests for all four laws, boost behavior, center calibration, endpoint behavior, symmetry, continuity, finite validation, `0 dB` boost no-op, and exact Spec 112 `-3 dB`/unboosted numeric parity in `packages/blue-data/src/mixer/channel-pan.test.ts`.
- [X] T010 [P] [US1] Add Score model tests for new-score `-3 dB`/boost-off defaults, deep-copy preservation, exact XML attributes, independent missing/invalid fallback, and preservation when `panningEnabled` is false in `packages/blue-data/src/score/score-panning.test.ts`.
- [X] T011 [P] [US1] Add CSD and float-output regressions for every law/boost pair across Mono Pan center/intermediate/endpoint positions, static versus automated values, disabled panning, mono output, Balance invariance, send feed points, and gate/meter placement in `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`, `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`, and `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`.
- [X] T012 [P] [US1] Extend browser coverage for Mixer Settings law choices, Off-center boost, default values, accessible descriptions of affected channels and clipping risk, keyboard selection, and future-intent behavior while panning is disabled in `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx`.

### Implementation for User Story 1

- [X] T013 [US1] Add Mixer-owned `panLawDb` and `panOffCenterBoost` fields with the exact defaults “new Mixer `-3`; boost `false`”, independent invalid-value fallback, deep-copy behavior, and `<mixer panLawDb="..." panOffCenterBoost="...">` serialization in `packages/blue-data/src/mixer/mixer.ts`.
- [X] T014 [US1] Implement the four continuous source-leg gain functions, optional off-center boost, law/position validation, and the default Spec 112 cosine/sine branch in `packages/blue-data/src/mixer/channel-pan.ts`; keep all outputs finite and keep Balance math separate.
- [X] T015 [US1] Thread Mixer law/boost through static and automated pan generation after post-effects/sends and before output gates/meters in `packages/blue-data/src/blue-data/csd-policy.ts` and `packages/blue-data/src/compile-data.ts`; preserve the disabled route, mono-output behavior, unsupported-layout diagnostics, exact `-3 dB` default CSD, and law-independent Balance.
- [X] T016 [US1] Add typed Mixer snapshots, Mixer law/boost patches, whole-edit validation, preparation classification, canonical patch application, and renderer projection in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`, `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, `packages/blue-app/src/shared/project-editor/patch-document.ts`, and `packages/blue-app/src/renderer/stores/project-store.ts`.
- [X] T017 [US1] Add Mixer Settings law and Off-center boost controls beside Enable Panning, including selected/default state, keyboard operation, disabled explanation, and gain warning, then wire the controls to typed document patches through `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerSettingsDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/MixerPanel.tsx`, and `packages/blue-app/src/renderer/stores/project-store.ts`.
- [X] T018 [US1] Compare static CSD, realtime playback, BlueLive, and disk-render coefficients for the same Mixer law/boost values and update the focused parity assertions in `packages/blue-data/src/blue-data-csd-parity.test.ts`, `packages/blue-app/src/main/csd-generation.test.ts`, and `packages/blue-app/src/main/csd-export.test.ts`.

**Checkpoint**: A Mixer-wide law is persisted and visible, all eligible Mono Pan source legs use it,
Balance is unchanged, and the law matrix passes independently without requiring stereo-mode work.

---

## Phase 4: User Story 2 - Position a Stereo Image (Priority: P1)

**Goal**: Stereo, mixed, and unknown-layout channels expose Balance, Stereo Pan with Position/Width,
and Dual Pan with independent source-side positions, while verified mono-only channels retain Mono Pan.

**Independent Test**: Send distinct left/right impulses through one two-bus channel; verify Balance
has no crossfeed, Stereo Pan center/full-width is identity, Width zero co-locates both sides, endpoint
Position narrows effective width without changing saved Width, and Dual Pan moves only the selected side.

### Verification for User Story 2

- [X] T019 [P] [US2] Add Channel persistence and copy tests for the exact defaults “Balance, Width `1`, Dual Left `0`, Dual Right `1`”, finite `[0,1]` validation, invalid XML fallback, mode-switch preservation, stable Parameter identities, and explicit known-parameter dispatch in `packages/blue-data/src/mixer/channel.test.ts`.
- [X] T020 [P] [US2] Add true-stereo matrix and CSD stage-order tests for left-only/right-only/correlated/mixed signals, all laws/boost states, Stereo Pan width/endpoint narrowing, Dual Pan crossing/coincidence, no normalization, Balance invariance, sends, gates, meters, subchannels, and master in `packages/blue-data/src/blue-data/mono-clip-panning.test.ts` and `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`.
- [X] T021 [P] [US2] Add automation catalog tests proving Pan, Width, Dual Left, and Dual Right are each enumerated once with distinct stable names/IDs, deterministic compilation variables, and correct source/sub/master ownership in `packages/blue-data/src/automation/parameter-helper.test.ts` and `packages/blue-data/src/automation/project-parameter-catalog.test.ts`.
- [X] T022 [P] [US2] Extend browser/component coverage for the Balance/Stereo Pan/Dual Pan selector, Position/Width/Left/Right labels, keyboard-operable ranges, effective-width disclosure near endpoints, absence of a dedicated true-stereo peak/summing disclosure, and Mono Pan-only presentation for verified mono channels in `packages/blue-app/src/renderer/browser/channel-strip-layout.browser.test.tsx`, `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`.

### Implementation for User Story 2

- [X] T023 [US2] Extend `Channel` with stored `stereoPanMode`, `panWidth`, `dualPanLeft`, and `dualPanRight`, each with the exact constraints “finite `[0,1]`” and defaults “Balance, `1`, `0`, `1`”; create distinct Width/Dual Left/Dual Right Parameters, synchronize fixed values only when automation is off, dispatch known names explicitly on XML load, and preserve history/duplication identities in `packages/blue-data/src/mixer/channel.ts` and `packages/blue-data/src/automation/parameter-helper.ts`.
- [X] T024 [US2] Implement Stereo Pan effective spread `d = width * min(position, 1-position)`, Dual Pan independent source positions, and the 2×2 gain matrix in `packages/blue-data/src/mixer/channel-pan.ts` and `packages/blue-data/src/blue-data/csd-policy.ts`; keep Mono Pan layout classification, Balance no-crossfeed behavior, saved Width at endpoints, and existing send/gate/meter ordering.
- [X] T025 [US2] Extend mixer snapshots and arrangement/layout reconciliation to publish stored mode/Width/dual values separately from derived `positionMode`, use Mono Pan only for verified mono-only channels, and keep stereo settings dormant but intact across source-layout changes in `packages/blue-app/src/shared/project-editor/contract.ts` and `packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts`.
- [X] T026 [US2] Extend typed mixer channel patches, whole-patch finite/enum validation, canonical application, preparation classification, and semantic action labels for mode, Width, Dual Left, and Dual Right in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`, and `packages/blue-app/src/shared/project-editor/patch-document.ts`.
- [X] T027 [US2] Implement mode-aware mixer controls with shared Position, Width, Left, and Right gestures, saved-value preservation on mode switches, effective-width feedback, accessible labels, and clear inactive reasons; do not add a dedicated true-stereo peak/summing disclosure in `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerPanSlider.tsx`.
- [X] T028 [US2] Bind Width and Dual parameters through the existing automation catalog and CSD variable path, and verify fixed, automated, timeline, BlueLive, and disk values use the same true-stereo equations without rewriting automation points in `packages/blue-data/src/automation/parameter-helper.ts`, `packages/blue-data/src/compile-data.ts`, `packages/blue-data/src/blue-data/csd-policy.ts`, and `packages/blue-app/src/main/runtime-parameter-sync.ts`.

**Checkpoint**: Two-bus channels have independently testable Balance, Stereo Pan, and Dual Pan modes;
verified mono channels still show Mono Pan; all stored stereo controls survive mode/layout changes.

---

## Phase 5: User Story 3 - Preserve and Reverse Mix Decisions (Priority: P1)

**Goal**: Law, boost, mode, Position, Width, and Dual Pan edits are canonical history actions that
reconcile running performances, preserve identity/dirty state, and survive save/reopen with matching audio.

**Independent Test**: During timeline and BlueLive playback, change every durable panner control, verify
one semantic history entry, undo/redo, save/reopen, compare disk output, cancel a drag, and inject engine
rejection and generation replacement while checking saved versus applied state.

### Verification for User Story 3

- [X] T029 [P] [US3] Add project-editor contract tests for Mixer/channel snapshot round-trips, accepted and rejected enum/range edits, semantic labels, illegal companion-field rejection, and no dirty-state mutation on invalid patches in `packages/blue-app/src/shared/project-editor/score-panning-contract.test.ts` and `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.test.ts`.
- [X] T030 [P] [US3] Add commit→undo→redo coverage for Mixer law/boost and every channel panner writer, asserting canonical values, stable channel/Parameter identities and references, dirty state, published snapshots, one action per completed drag, and no history entry for cancellation in `packages/blue-app/src/main/project-history-roundtrip.test.ts`, `packages/blue-app/src/main/global-project-history.test.ts`, and `packages/blue-app/src/shared/project-history.test.ts`.
- [X] T031 [P] [US3] Add runtime reconciliation tests for law/boost/mode/scalar success, engine rejection, partial timeline/BlueLive availability, stale generation replacement, timeout, canonical recovery, and saved-versus-applied reporting in `packages/blue-app/src/main/project-runtime-reconciliation.test.ts`, `packages/blue-app/src/main/runtime-parameter-sync.test.ts`, and `packages/blue-app/src/main/runtime-channel-sync.test.ts`.
- [X] T032 [P] [US3] Add integration coverage for live/export parity, no score-event retrigger or transport movement on stable graphs, automation following current law, and both timeline and BlueLive recipients in `packages/blue-app/src/main/mono-clip-panning.integration.test.ts`, `packages/blue-app/src/main/csd-generation.test.ts`, and `packages/blue-app/src/main/engine-runtime.test.ts`.

### Implementation for User Story 3

- [X] T033 [US3] Route Mixer and channel panner edits through the canonical `ProjectHistory` preparation/commit path with semantic labels `Set Pan Law`, `Set Pan Boost`, `Set Channel Pan Mode`, `Set Channel Pan Width`, `Set Channel Left Pan`, and `Set Channel Right Pan`; preserve expected-revision handling, dirty state, publication, and identity-safe undo/redo in `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/main/project-history.ts`, `packages/blue-app/src/shared/project-editor/patch-document.ts`, and `packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts`.
- [X] T034 [US3] Emit and resolve generation-scoped numeric engine bindings for Mixer law/boost and channel mode, validate all runtime values, fan updates to every active performance through the existing engine-client operation, fence stale generations, and report failed application without overwriting canonical state in `packages/blue-data/src/compile-data.ts`, `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-app/src/main/project-runtime-reconciliation.ts`, `packages/blue-app/src/main/runtime-parameter-sync.ts`, and `packages/blue-app/src/main/runtime-channel-sync.ts`.
- [X] T035 [US3] Extend the revision/generation-fenced mixer preview adapter and renderer gestures to preview Position, Width, Dual Left, and Dual Right, restore canonical runtime values on cancel, commit exactly one history patch on finish, and recover from rejected finish operations in `packages/blue-app/src/main/mixer-gain-preview.ts`, `packages/blue-app/src/main/mixer-gain-preview.test.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`.
- [X] T036 [US3] Keep automated Pan/Width/Dual curves authoritative over fixed values, make law/boost changes affect the current coefficient evaluation without rewriting points, and compare generated static, automated, realtime, BlueLive, and disk branches in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/automation/csd-parameter-automation.ts`, `packages/blue-app/src/main/runtime-parameter-sync.ts`, and `packages/blue-data/src/blue-data-csd-parity.test.ts`.
- [X] T037 [US3] Surface applied/failed runtime status and clear recovery feedback in the renderer while keeping canonical snapshots authoritative, including panning-disabled future intent and mixer bypass behavior, in `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerSettingsDialog.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx`.

**Checkpoint**: Every durable panner decision is reversible and portable, live updates are fenced and
recoverable, previews remain disposable, and export matches accepted playback configuration.

---

## Phase 6: User Story 4 - Keep Existing Scores Predictable (Priority: P2)

**Goal**: Java, legacy, and Spec 112 projects retain their established routing and sound unless a
composer explicitly chooses the new law or stereo mode; malformed new fields fall back safely.

**Independent Test**: Open enabled Spec 112, disabled legacy, Java-authored, missing/invalid score-field,
and missing/invalid channel-field fixtures; compare audio before/after save/reopen and assert unknown data,
dirty state, history, and stable identities are preserved.

### Verification for User Story 4

- [X] T038 [P] [US4] Add Java/legacy XML fixtures covering absent `<score>`, missing/invalid `panLawDb` and boost, missing/invalid channel mode/scalars, Java volume-only Parameters, and unrelated unknown project data in `packages/blue-data/src/blue-data/xml-policy.test.ts`, `packages/blue-data/src/score/score-panning.test.ts`, `packages/blue-data/src/mixer/channel.test.ts`, and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`.
- [X] T039 [P] [US4] Add compatibility CSD/audio tests proving enabled Spec 112 defaults remain `-3 dB`/unboosted Mono Pan, missing `panningEnabled` preserves legacy-disabled routing, Balance remains unchanged, disabled panning and mixer bypass keep saved intent inaudible, mono output gets no stereo-law stage, and wider layouts retain diagnostics in `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`, `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`, and `packages/blue-data/src/blue-data/csd-policy.test.ts`.
- [X] T040 [P] [US4] Add copy/history and unknown-parameter regressions proving defaults are resolved without raw-presence shadow state, unrelated XML survives load/save/copy, stable Parameter identities remain correct, and unchanged opening/saving creates no history entry in `packages/blue-data/src/blue-data-history-copy.test.ts`, `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`, and `packages/blue-app/src/main/project-history-roundtrip.test.ts`.
- [X] T041 [P] [US4] Add browser compatibility coverage for Balance as the stored default, Mono Pan-only presentation for verified mono channels, preserved inactive controls when panning is disabled or mixer bypassed, and clear fallback/status explanations in `packages/blue-app/src/renderer/browser/channel-strip-layout.browser.test.tsx` and `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx`.

### Implementation for User Story 4

- [X] T042 [US4] Implement independent safe-load fallbacks for Mixer law/boost and channel mode/Width/dual values, explicit known Parameter-name dispatch, unrelated-data preservation, Java-compatible known XML loading, and no automatic switch to true stereo in `packages/blue-data/src/score/score.ts`, `packages/blue-data/src/mixer/mixer.ts`, `packages/blue-data/src/mixer/channel.ts`, and `packages/blue-data/src/blue-data/xml-policy.ts`.
- [X] T043 [US4] Preserve the established disabled/legacy CSD route, Balance path, mono-output route, send semantics, gate/meter order, and wider-layout diagnostic while retaining new saved intent for later enablement in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/blue-data.ts`, and `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`.
- [X] T044 [US4] Compare representative TypeScript output and Java-generated artifacts for legacy and new-field projects, document any intentional TypeScript-only divergence, and verify save/reopen does not silently lose unknown data in `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`, `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`, and `specs/113-pan-laws-configuration/research.md`.

**Checkpoint**: Pre-feature and Java-authored scores remain predictable, malformed extensions never
produce invalid gains, and compatibility data is preserved without hidden state.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close accessibility, performance, portability, documentation, and repository validation gaps.

- [X] T045 [P] Recheck Java parity, Spec 112 exact default output, static/dynamic CSD determinism, and post-send/pre-gate placement; update intentional-divergence notes in `specs/113-pan-laws-configuration/research.md`, `packages/blue-data/src/blue-data/blue-data-csd-parity.test.ts`, and `packages/blue-data/src/blue-data-csd-determinism.test.ts`.
- [X] T046 [P] Audit the legacy Score Settings shell to confirm panning controls are absent, then audit Mixer Settings and mixer panner controls for accessible names, selected mode, range/center/side value text, keyboard focus order, disabled-state reasons, effective-width disclosure, and the Mixer Settings gain warning while confirming that channel strips do not add a dedicated true-stereo peak/summing disclosure in `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreSettingsDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerSettingsDialog.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/mixer/MixerPanSlider.tsx`, and `packages/blue-app/src/renderer/browser/mono-clip-panning.browser.test.tsx`.
- [X] T047 [P] Verify panner coefficient generation adds only fixed gain math per two-bus channel, remains deterministic, avoids per-sample unbounded work, and does not introduce a new dependency in `packages/blue-data/src/mixer/channel-pan.ts`, `packages/blue-data/src/blue-data/csd-policy.ts`, and `packages/blue-data/src/blue-data-csd-determinism.test.ts`.
- [X] T048 [P] Audit the feature for native host-path preservation and boundary discipline, add synthetic Windows-path coverage only where existing audio/Csound fixtures cross a boundary, and record native Windows validation prerequisites/results in `packages/blue-app/src/main/mono-clip-panning.integration.test.ts` and `specs/113-pan-laws-configuration/quickstart.md`.
- [X] T049 Update `specs/113-pan-laws-configuration/quickstart.md` with final fixture IDs, expected gain tolerances, live/export/history/recovery results, UI accessibility checks, platform/engine versions, and explicitly unrun physical-output or native-Windows checks.

- [X] T050 Run affected-package validation and repository gates from `/Users/stevenyi/work/blue-electron`: `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:renderer`, `pnpm test`, `pnpm lint`, and `git diff --check`; record scoped failures and their prerequisites in `specs/113-pan-laws-configuration/quickstart.md`.

## Phase 8: Convergence

- [X] T051 [US3] Complete the generation-scoped live runtime path for Mixer `panLawDb`/`panOffCenterBoost` and channel `stereoPanMode`: declare and initialize stable exported Csound control channels, consume them in the live panner graph for law/boost coefficient selection and mode routing, handle panning-disabled future intent without unresolved live writes, and add integration coverage proving actual law/boost/mode audio changes, no transport restart, stale-generation fencing, and rejection recovery in `packages/blue-data/src/blue-data/csd-policy.ts`, `packages/blue-data/src/compile-data.ts`, `packages/blue-app/src/main/runtime-parameter-sync.ts`, `packages/blue-app/src/main/project-runtime-reconciliation.ts`, and `packages/blue-app/src/main/mono-clip-panning.integration.test.ts` per FR-006, FR-010, US3/AC3, and T034 (partial).
- [X] T052 [US3] Extend the typed realtime contract, preload bridge, main preview adapter, and `ChannelStrip` gesture wiring so Width, Dual Left, and Dual Right support disposable preview/cancel, restore canonical runtime values on cancellation or rejection, and commit exactly one history patch on finish; add focused adapter and browser tests in `packages/blue-app/src/shared/project-editor/contract.ts`, `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/main/mixer-gain-preview.ts`, `packages/blue-app/src/main/mixer-gain-preview.test.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/mixer/ChannelStrip.tsx` per FR-008, FR-016, US3/AC2, and T035 (partial).
- [X] T053 [P] [US2] REJECTED — The user explicitly rejected a dedicated Stereo Pan/Dual Pan peak/summing disclosure as unnecessary UI. Preserve the audio contract's source-summing/no-normalization behavior without adding a MixerPanSlider disclosure; browser coverage requires its absence.
- [X] T054 [P] [US4] Replace permissive numeric XML parsing for Mixer pan law and channel pan/scalar fields with full-token finite-number validation so malformed values fall back independently without accepting trailing garbage, and add regression fixtures in `packages/blue-data/src/score/score.ts`, `packages/blue-data/src/mixer/channel.ts`, `packages/blue-data/src/score/score-panning.test.ts`, and `packages/blue-data/src/mixer/channel.test.ts` per FR-009 and T042 (partial).

## Phase 9: Convergence

- [X] T055 [P] [US2] REJECTED — The user explicitly rejected replacing the removed orange Stereo Pan/Dual Pan peak-warning panel with any compact non-panel disclosure because it still alters the mixer-strip UI. No Stereo Pan/Dual Pan peak disclosure is rendered; browser assertions require its absence.
- [X] T056 [P] [US2] Add deterministic rendered true-stereo verification for Stereo Pan and Dual Pan across all four laws, both boost states, center/intermediate/endpoint positions, width endpoint narrowing, zero width, independent/crossed/coincident positions, and realtime/BlueLive/disk parity in `packages/blue-data/src/mixer/channel-pan.test.ts`, `packages/blue-data/src/blue-data/mono-clip-panning.test.ts`, `packages/blue-data/src/blue-data-csd-parity.test.ts`, and `packages/blue-app/src/main/mono-clip-panning.integration.test.ts` per FR-011, SC-001, SC-002, SC-007, T020, and T032 (partial).

## Phase 10: Review corrections

- [X] T057 Bind channel modes by preserved runtime identity and canonical editor owner ID; cover a subchannel name colliding with an instrument association in timeline, asynchronous timeline, and BlueLive generation.
- [X] T058 Omit panner bindings for bypassed mixers in every live CSD generation path; verify law, boost, and mode bindings are absent.
- [X] T059 Correct Off-center boost help: endpoint gain rises while center attenuation remains unchanged.
- [X] T060 Record project-owner acceptance of discontinuities for discrete pan-law selection changes; do not add law-selection smoothing.
- [X] T061 Run the real Chrome panning suite outside the sandbox; fix the disabled-input guard exposed by its existing regression (14/14 passed).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; parity review and fixture/baseline work can start immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks user-story implementation because it defines the shared value vocabulary, ownership contract, and runtime seams.
- **User Story 1 (Phase 3)**: Depends on Foundation and is the MVP; it establishes Mixer law/boost and eligible Mono Pan behavior.
- **User Story 2 (Phase 4)**: Depends on Foundation and can proceed in parallel with US1 after the shared contracts exist; its CSD work consumes the score-law vocabulary.
- **User Story 3 (Phase 5)**: Depends on the Mixer and channel contracts from US1 and US2 before integrating history, preview, and live runtime reconciliation.
- **User Story 4 (Phase 6)**: Depends on the implemented model/CSD paths from US1 and US2; compatibility tests may begin earlier, but the final checkpoint requires both stories.
- **Polish (Phase 7)**: Depends on all desired stories and their focused validation.
- **Convergence (Phases 8–9)**: Depends on the implemented stories and polish evidence; closes the remaining runtime, preview, validation, and explicitly rejected UI work recorded during convergence.
- **Review corrections (Phase 10)**: Depends on convergence; records the accepted runtime identity, bypass, help-text, pan-law transition, and real-browser corrections.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundation; no dependency on US2 for the law/Mono Pan increment.
- **US2 (P1)**: Starts after Foundation; uses the shared law functions but is independently testable with stereo fixtures.
- **US3 (P1)**: Depends on US1 and US2 for the complete set of durable writers and runtime bindings.
- **US4 (P2)**: Depends on US1 and US2 for the final fallback/compatibility route, while legacy fixture tests can run in parallel.

### Within Each User Story

- Verification tasks precede the implementation they protect, especially for CSD/audio and compatibility regressions.
- Portable model and coefficient work precede CSD generation; CSD/runtime bindings precede main publication; typed publication precedes renderer feedback.
- Every durable Mixer/channel mutation uses `ProjectHistory` with a semantic label and commit→undo→redo coverage for canonical state, identities, dirty state, publication, and runtime reconciliation.
- Preview, effective layout, and applied-runtime state are disposable; cancelling a preview restores canonical document/runtime values and creates no history entry.
- Models and parameters precede services/bindings; services/bindings precede UI integration; each story must pass its independent test criteria before the next priority increment.

### Parallel Opportunities

- Setup T001–T003 can run in parallel.
- Foundation T004–T008 can be staffed independently because they touch separate seams; integrate before story work.
- US1 verification T009–T012 can run in parallel; T013/T014 can then be split between model and math, followed by T015–T018 integration.
- US2 verification T019–T022 can run in parallel; T023/T024 can be split between model/parameters and DSP, followed by T025–T028 bridge/UI integration.
- US3 verification T029–T032 can run in parallel; T033/T034 can be split between history and runtime, with T035–T037 following their contracts.
- US4 verification T038–T041 can run in parallel; T042/T043 can be split between XML/model compatibility and CSD routing, followed by T044 parity evidence.
- Polish T045–T048 can run in parallel; T049–T050 are final documentation and validation gates.

## Parallel Example: User Story 1

```text
# After Phase 2:
Workstream A: T009 -> T014 (pan-law math and numeric fixtures)
Workstream B: T010 -> T013 (Score model/XML)
Workstream C: T011 -> T015 -> T018 (CSD and render parity)
Workstream D: T012 -> T016 -> T017 (typed Mixer Settings bridge and UI)
Integrator: T018 and the independent-test checkpoint
```

## Parallel Example: User Story 2

```text
# After Phase 2 and alongside US1 if desired:
Workstream A: T019 -> T023 (Channel persistence and Parameter identities)
Workstream B: T020 -> T024 (true-stereo matrix and CSD)
Workstream C: T021 -> T028 (automation catalog and compiled variables)
Workstream D: T022 -> T025 -> T027 (snapshot and accessible controls)
Integrator: T026 (typed patch validation) before the story checkpoint
```

## Parallel Example: User Story 3

```text
# After US1 and US2 contracts are available:
Workstream A: T029 -> T033 (patch guards and ProjectHistory writers)
Workstream B: T030 -> T033 (round-trip identity/dirty/history evidence)
Workstream C: T031 -> T034 (generation-scoped runtime publication and failure recovery)
Workstream D: T032 -> T036 (live/export/automation parity)
Integrator: T035 -> T037 (preview cancellation and renderer status)
```

## Parallel Example: User Story 4

```text
# After the model/CSD paths exist:
Workstream A: T038 -> T042 (XML defaults and unknown-data preservation)
Workstream B: T039 -> T043 (legacy/disabled/unsupported routing)
Workstream C: T040 -> T044 (copy/history/Java parity)
Workstream D: T041 (compatibility UI behavior)
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational; this blocks story implementation.
3. Complete Phase 3: User Story 1.
4. Stop and validate the full law/boost matrix independently, including static and automated output.
5. Demo or deliver the Mixer-wide law increment only after the focused package tests pass.

### Incremental Delivery

1. Complete Setup + Foundation → shared panner contracts ready.
2. Add US1 → Mixer law/boost and Mono Pan MVP → validate independently.
3. Add US2 → complete stereo modes → validate left/right, mixed, sends, gates, and automation.
4. Add US3 → history, previews, live reconciliation, and export parity → validate failure recovery.
5. Add US4 → legacy/Java compatibility and malformed-value safety → validate save/reopen.
6. Run Polish → quickstart evidence, package builds, repository tests/lint, and platform notes.
7. Run Convergence and Review corrections → close runtime/preview gaps, preserve explicit UI rejections, and record the remaining manual acceptance items honestly.

### Parallel Team Strategy

1. Team completes Setup + Foundation together.
2. After Foundation, one workstream can implement US1 while another implements US2.
3. Once both canonical model/patch contracts are stable, split US3 between history/runtime and UI/export verification.
4. Run US4 compatibility work against every completed model/CSD increment so regressions are caught before Polish.

## Notes

- `[P]` means separate files and no dependency on incomplete work in the same phase.
- `[Story]` maps a task to a specific user story; setup, foundation, and polish tasks intentionally have no story label.
- New fields are canonical project content; renderer snapshots, previews, effective layout, and applied runtime state are derived/disposable.
- The feature does not add per-channel law overrides, send panners, per-clip pan, Mid/Side, surround, or automatic normalization/limiting.
- Record physical-output latency and native-Windows evidence honestly; neither is proven by an engine acknowledgement alone.
