# Contract: Playback Projection and Shortcut Ownership

**Requirements**: FR-001–FR-003, FR-009, FR-020–FR-024; SC-001, SC-005, SC-006.

## Shortcut boundary

Retain `isTextEditingTarget` and `useKeyboardShortcuts`; a small modal-inspection helper may be exported for tests. The handler checks already-handled events, active modal/alert-dialog surfaces in the event target's document, and popup target ancestry before workspace commands. Use structural cross-realm helpers; do not use module-realm instanceof Node.

A document-wide modal is `[aria-modal="true"]` or `[role="alertdialog"]`; a plain non-modal dialog only owns its own events. Do not globally disable keyboard transport for every focused button. Preserve existing Space, Escape, Follow, Open, Save and Save As mappings/conditions and text/repeat exclusions. Native Electron accelerators and adding popout-global transport forwarding are out of scope.

Active-gesture capture Escape cancels and consumes before the workspace bubble handler. Dialog controls, tracker cells and library tree items that handle a key do not also trigger transport. Idle/unclaimed Escape still stops playback.

## Store façade and internal authority

Retain all current `PlaybackState` fields and `PlaybackActions` methods consumed by renderer selectors. Internally, one lifecycle transition/projection pair produces coherent phase, mode, message, anchor and compatibility flags atomically. Do not use getters on Zustand state. Translate setPlaying into a coherent current-mode transition rather than writing a lone boolean.

| Event                                                             | Required result                                                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Local normal/audition start                                       | New attempt identity and starting mode; reset prior clock/display as appropriate                                                  |
| Duplicate/partial starting status for current attempt             | Preserve current attempt/mode/anchor and an already accepted current early clock; do not manufacture a second session             |
| First valid normal-start confirmation, host status or local reply | Playing, preserve early clock/anchor, apply follow-on-start once                                                                  |
| Local stop during starting                                        | Stopping with wasPlaying=false unless an authoritative event already confirmed activity; explicit stop clears audition indication |
| Local stop after playing                                          | Stopping with wasPlaying=true                                                                                                     |
| Host stopping                                                     | Authoritative evidence of previous host activity; isPlaying remains true while confirmation is pending                            |
| Partial non-terminal status                                       | Preserve omitted mode/anchor; explicit fields/actions may change them                                                             |
| Idle/stopped/error/reset                                          | Clear audition/anchor/clock/display; restore active follow from saved preference                                                  |
| Old local reply/error                                             | Ignore if its attempt was replaced, stopped, reset or invalidated                                                                 |

Clock and display are separate from lifecycle. Preserve configured ticker ref-counting/cadence, latency correction, interpolation, and display no-change thresholds. A display tick does not replace lifecycle identity or recompute status flags. Use a frozen shared idle display value and never mutate it.

## Clock and follow acceptance

- Accept valid clock frames in starting, playing and stopping, including before local start reply.
- Reject frames while terminal and frames from a retired/older clock session; sequences must not move backward within a session. Preserve a retired-session watermark across ordinary lifecycle resets while the same main engine authority remains alive.
- When a new session arrives, optional rate/ksmps fallback may use only that same session's known metadata, not the prior performance's values.
- Playing confirmation preserves an accepted starting clock and display reference until a real clock/display update is needed.
- Apply normal follow-on-start once per confirmed attempt, regardless of reply/status order. Repeated playing status, loop/seek position changes and display ticks do not reapply it.
- Terminal transitions restore the saved follow preference; hydrated saved settings and cadence remain independent of runtime reset. Existing preference persistence and menu mirroring remain in action side effects.

`EngineBridge` remains authoritative: it already increments playbackSessionId and emits an initial clock before playing. Keep current preload/status/clock fields; no new IPC discriminator, engine protocol, or main FSM is planned.

## Required oracles

Test modal buttons/checkboxes and late dialog listeners, handled Space in cells/tree, non-modal help visible with focus outside, ordinary toolbar Space, idle Escape and gesture Escape during active playback. For transport, cover both start-confirmation orders, early clocks, repeated starting/playing, partial audition/anchor fields, local and host stopping, late reply/error after a new attempt, terminal/retired clocks, rate fallback across sessions, stable idle/lifecycle references, and saved follow restoration. Existing follow and display cadence tests remain regression oracles.
