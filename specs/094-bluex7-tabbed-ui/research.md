# BlueX7 Tabbed UI Research

## Decision: Keep the renderer panels mounted and switch visibility at the tab-panel boundary

**Rationale:** The existing instrument editors already use a `relative min-h-0 flex-1` panel
stack with the active child rendered normally and inactive children positioned absolutely with
`aria-hidden`, `visibility: hidden`, and `pointer-events: none`. Reusing that pattern avoids
destroying the CodeMirror view or the local Csound/operator sub-tab state every time the user
changes the top-level view. The BlueX7 outer shell can therefore become a non-scrolling,
full-height flex column while each active panel owns any necessary inner scroll region.

The header, effective-value status, and top-level tab list will be `shrink-0`. The active
tabpanel will be `min-h-0 flex-1`; the Operators and Pitch Envelope content can scroll inside
that region if a dense panel exceeds the available height, while the Csound panel and its
Post Code editor use the full available height. This removes page-level scrolling through
unrelated sections while preserving a recoverable inner scroll path for narrow or short hosts.

**Alternatives considered:**

- Unmount inactive panels: rejected because it resets the Csound sub-tab/CodeMirror view and
  makes an in-flight envelope gesture harder to finalize before unmounting.
- Keep the entire original stack and add anchors: rejected because it does not meet the
  scroll-reduction goal or the full-height Csound requirement.
- Add a new global workbench/store tab state: rejected because the specification makes the
  state an editor-instance presentation concern and explicitly forbids persistence.

## Decision: Add one small reusable ARIA tab-list primitive for all BlueX7 tab levels

**Rationale:** The feature has three tab lists with the same requirements: the four top-level
views, six operator tabs, and three Csound sub-tabs. A local renderer primitive keeps the
`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex`, focus
movement, and Enter/Space activation behavior identical across all three. It does not add a
runtime dependency or cross package boundary.

The tab lists will use the manual-activation ARIA pattern required by the clarified behavior:
Left/Right moves focus within the horizontal list; click or Enter/Space activates the focused
tab; the initially selected tab is the tab with `tabIndex=0`, and arrow movement transfers that
roving focus slot to the focused candidate without changing `aria-selected`; normal Tab
traversal then enters the active tabpanel content. The top-level list remains a single horizontal row with horizontal
overflow at widths below 500px, and activation scrolls the selected tab into view.

**Alternatives considered:**

- Continue with plain buttons: rejected because the existing operator buttons and Csound
  buttons do not expose the complete tab contract required by FR-005.
- Use a third-party tabs package: rejected because the repository has no established package
  for this small behavior and a local primitive avoids styling/portal integration risk.
- Automatic activation on every arrow press: rejected because the clarified requirement
  distinguishes arrow navigation from Enter/Space activation.

## Decision: Derive effective-value requests from the active view and selected operator

**Rationale:** `BLUE_X7_PARAMETER_DESCRIPTORS` is the authoritative semantic catalog and the
existing editor already maps descriptor semantic keys to snapshot parameter IDs. The new
partition will be derived from that catalog rather than maintaining a second list of numeric
IDs:

| Active view | Effective-value semantic keys |
|---|---|
| Voice & Global | All `Common` and `LFO` descriptors, including shared oscillator sync and shared PMS, plus all six visible `operator.N.enabled` controls |
| Operators | The selected operator's descriptors, including its envelope and enable/muted indicator, plus the shared oscillator sync and shared PMS keys used by the workstation |
| Pitch Envelope | All `Pitch Envelope` descriptors |
| Csound & Code | No effective-value request; this view has generated/code diagnostics, not live parameter controls |

An optional host-supplied parameter allowlist, if present for compatibility, will only be
intersected with the active-view set; it can never reintroduce hidden-tab parameters. The
empty Csound set will be handled before the preload contract, which intentionally rejects empty
readback requests.

The polling hook will react to a parameter-set signature, not only the list length. A tab or
operator change clears the prior display snapshot, invalidates the prior request generation,
and starts the new set immediately. A late response from the previous set is discarded even
when the target and project session are unchanged. The existing one-request-in-flight rule and
20 Hz default remain intact, so the first active-view request is issued at activation and the
next scheduled request is no later than one 50 ms interval away.

**Alternatives considered:**

- Poll all 151 parameters and filter in each panel: rejected because it violates FR-007 and
  creates unnecessary IPC/engine work.
- Infer visibility by querying DOM nodes: rejected because it is brittle, not browser-safe for
  popouts, and couples runtime synchronization to presentation markup.
- Use only `parameterIds.length` as the hook dependency: rejected because Op 1 through Op 6
  have equal-sized sets and a same-length switch could retain stale request/display state.

## Decision: Cancel pending envelope gestures when a panel deactivates

**Rationale:** `OperatorPanel` and `PitchEnvelopePanel` already stage pointer-move changes in
refs/state and dispatch one patch on gesture commit. They will accept an `active` prop and
cancel staged state, reset child drag state, and release pointer capture when transitioning from
active to inactive. Pointer-cancel and unmount use the same fail-closed cleanup. This prevents a
late pointer-up from applying a hidden view's value to a newly selected operator while preserving
the existing single-patch behavior for a completed visible drag. Because panels remain mounted,
the cleanup can be deterministic without destroying editor state.

**Alternatives considered:**

- Dispatch every pointer move: rejected because it breaks atomic undo behavior.
- Silently discard every active gesture: rejected because it loses the user’s latest staged
  envelope value and provides no consistent completion rule.
- Leave the gesture alive while another top-level view is active: rejected because the user can
  no longer see the gesture target and a later pointer event could mutate a hidden view.

## Decision: Preserve existing mutation and runtime boundaries

**Rationale:** `BlueX7Editor` already owns editor-local history and turns UI actions into typed
`BlueX7Patch` intents. The main process remains the owner of `BlueData`; the renderer receives a
serializable `BlueX7InstrumentSnapshot` and uses the existing preload effective-value and SysEx
surfaces. Tab selection, focused tab index, operator selection, Csound sub-tab, and staged
gesture state remain renderer-local and are not added to `BlueX7Voice`, `InstrumentPatch`,
project XML, app settings, or the engine protocol.

No `@blue/data` production source, preload contract, main-process handler, parameter descriptor,
XML serializer, CSD generator, or SysEx parser needs to change. Existing data tests remain the
compatibility guard. The Java `BlueX7Editor` reference currently has an instrument scroll tab
and a Csound tab, while the renderer feature intentionally refines the instrument view into
Voice & Global, Operators, and Pitch Envelope plus the existing Csound workspace. That is a
presentation-only divergence named in the specification; Java-compatible voice values,
serialization, transport, and generated audio text remain out of scope.

**Alternatives considered:**

- Persisting selected tabs in `.blue` or app settings: rejected by FR-009 and the state-ownership
  rules.
- Changing the shared IPC request/response contract: rejected because the existing contract
  already accepts bounded visible-control subsets and is sufficient for this feature.
- Reworking the data model to mirror the view hierarchy: rejected because it would make a UI
  concern durable and threaten Java/XML compatibility.

## Evidence reviewed

- Current renderer composition: `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx`.
- Existing panels: `common-panel.tsx`, `lfo-panel.tsx`, `operator-panel.tsx`,
  `pitch-envelope-panel.tsx`, and `csound-panel.tsx` under
  `packages/blue-app/src/renderer/components/instruments/blue-x7/`.
- Existing keep-mounted tab pattern:
  `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`
  and `GenericInstrumentEditor.tsx`.
- Runtime contract and visible-request validation:
  `packages/blue-app/src/shared/project-editor/contract.ts`.
- Authoritative 151-entry catalog:
  `packages/blue-data/src/instruments/blue-x7/parameter-catalog.ts`.
- Java reference: `blue-ui-core/.../BlueX7Editor.java`, `CsoundCodePanel.java`, and
  `OperatorPanel.java` under `/Users/stevenyi/work/nbprojects/blue/`.
- Typography authority: `docs/typography.md`.
- Focused baseline: five BlueX7 renderer suites, 43 tests passed on 2026-09-01.
- Compatibility baseline: the focused `@blue/data` run passed 59/60 tests; the existing
  `modern-render.integration.test.ts` locked-hash assertion failed with expected
  `82012869f2451e4968a0646b5a9d4329cc0c89cbcac277f7c2fe8238453882c6` and received
  `0a385a4cbc4ff7da579f534429d25426738e0243859827e1ff91d767467e7854`. Only the untracked
  feature-spec artifacts are present in the worktree, so this is recorded as a pre-existing
  compatibility-gate item rather than attributed to the UI plan.
- Browser baseline: `pnpm --filter @blue/app test:browser:x7` could not start the configured
  Chrome process in this environment; Chrome exited with `SIGABRT` before any tests ran. The
  browser suite remains required for implementation validation on a functioning Chromium host.
