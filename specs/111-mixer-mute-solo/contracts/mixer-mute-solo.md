# Mixer Mute/Solo Contracts

## Editor and XML

- Reuse mixer.updateChannel with muted and non-master solo fields. Determine master by canonical identity/kind, not display name. Reject an entire patch attempting master solo before committing any companion fields.
- Audio header actions resolve Track.uniqueId association; Event actions retain layer-state patches. Use canonical ProjectHistory and revision guards. Main checks expected header mode and association before accepting the domain-specific action.
- Add trackLayerMuteSoloMode: audio/event to project-properties patches/snapshots. Reject invalid edits. For loaded invalid XML, retain raw text, use Event and expose a diagnostic.
- XML element is `<trackLayerMuteSoloMode>audio</trackLayerMuteSoloMode>` or event inside projectProperties. New projects write Audio. Untouched legacy omission stays omitted; missing properties block also loads Event. Copy/save/load retain raw/presence metadata.
- Master solo remains serializable compatibility data but has no active control. Capability and effective state are separate so an old true value never becomes an enabled Solo button.
- Ordinary score-layer event solo scope stays unchanged. Audio-mode Track groups opt out of event-solo discovery/filtering; mixer bypass restores their legacy participation.

## Route policy

Input is detached nodes, ordered output/send edges, explicit flags and mixer enable. Output is a complete deterministic gate vector and per-channel indicators. No canonical writes, no host/renderer dependencies. Unresolved routing is never considered safe for pruning.

| Selection | Included routes | Excluded routes |
| --- | --- | --- |
| None | All enabled routes | None from solo |
| Solo A | A→M, A→R, R→M | B→M, B→R |
| Solo R | A→R, B→R, R→M | A→M, B→M |
| Solo A and R | Union of preceding rows | Unrelated source/return paths |
| Solo A, mute A | No new A contribution | All A output; B stays excluded |
| Solo A, mute M | No final mixer output | M output and M sends |
| Legacy solo M only | Same as None | None from master flag |

Here A/B feed return R and master M. If sources have already mixed into an intermediate bus X, permitted X outputs carry that combined signal. Policy does not reconstruct individual sources or shared historical tails.

## Render contract

Extend RenderCsdResult with optional mixerGateBindings, absent/empty when mixer disabled. Include gate ordinals, deterministic numeric runtime symbols, two banks, initial targets, commit/applied token names and compile topology locators. Main attaches canonical ownership from the same pre-clone compile snapshot. Never map delayed live edits by names or fresh clone IDs.

All realtime generation paths, including BlueLive and sync/async standard CSD, emit every route gate and initialize before playback. Audio-muted events remain executable. Disk uses the same policy with fixed gates and conservative pruning. Existing low-level score-generation callers without context retain legacy Event behavior.

## Live work and transport

Add internal RuntimeWorkOperation kind mixer-gates with binding signature and detached ordered target vector. RuntimeWorkPlan already provides documentId, revision, performanceKind and generation. Renderer cannot supply runtime symbols. Combined structural/live patches remain restart-required when topology changes.

Use existing batch-channels transport; at most 256 unique-name entries per request, finite 0/1 gates and exactly representable integer tokens. Reserve generated symbol prefix gk_blue_mixgate_ and numeric suffixes; these controls are not automation parameters.

1. Validate capability, document, generation, routing signature and revision ordering.
2. Stage a complete vector in the inactive bank in bounded batches. Never overwrite the active bank.
3. Publish increasing commit token after successful staging; BlueMixer samples once per cycle, selects token modulo two and echoes applied token after selection.
4. Read applied token before acknowledging audible application or reusing old bank. Small stage+commit may share a batch if within the limit.
5. On failure/staleness, report existing runtime outcome and reconcile latest canonical intent; uncertain commit is resolved by token observation. No silent per-channel fallback, no automatic restart for M/S.

Initialize both banks before start. A shared 5 ms transition ramp ends at exact target; initial gate values bypass the ramp to prevent startup leakage. Both performances have separate catalogs/acknowledgments. One successful performance cannot hide failure in another.

## Disk eligibility

Certify only built-in AudioClip-only generation, no opaque code/effects/score processors or unknown influences, and valid acyclic routing. Prune a candidate only if no surviving output path exists. Preserve an unpruned duration bound using shared scheduling/window/tempo rules, including all-pruned output and extra render time. Keep effects/mixer gates. Internal test-only pruning disable supplies a reference render; no new user preference.

## UI

Non-master M/S, master M: accessible names/pressed states, keyboard operation, no master Solo action. Mixer-disabled strips show inactive controls and headers show Event override. Audio headers/strips share state; Event flags remain separate. Wet-only feeders distinguish output exclusion from send inclusion. The Audio/Event mode selector lives in the Score Settings modal opened by the Score toolbar gear beside Ruler, explains independent saved states, and is absent from Project Information. Existing runtime outcomes show when saved intent is not yet applied. No confirmation dialog per toggle.
