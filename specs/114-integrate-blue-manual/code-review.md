# Branch code review

Reviewed on 2026-09-30 against `7985f4e072aaacc4ff4d7e0450a9b302e6dc4213`
on `codex/integrate-manual`. The feature changes are currently uncommitted;
the scope includes tracked modifications and new implementation files.

## Findings and resolution

### Resolved P2 — PolyObject objective-duration measurement loses the project JavaScript session

Location: [score-object-test.ts](../../packages/blue-app/src/main/score-object-test.ts),
lines 116–125 and the new objective-duration generation path at lines 132–135.

The new command generates a selected PolyObject asynchronously, but
`usesJavaScript` only recognizes a directly selected JavaScriptObject or
JavaScript ObjectBuilder. Therefore the PolyObject's CompileData does not receive
the supplied project JavaScriptSession. JavaScript children execute in a fresh
context and cannot access variables/functions established by on-load scripts or
the project JavaScript console. Normal project generation uses that session.

Reproduced with the current built modules: initialize the project session with
`var sharedDuration = 6`, then measure a `TimeBehavior.NONE` PolyObject containing
a JavaScriptObject whose score is `"i1 0 " + sharedDuration + " 440"`.
`testScoreObject(..., { mode: 'objective-duration' }, { javaScriptSession })`
returns `ok: false` with `'sharedDuration' is not defined`. Generating the same
PolyObject with CompileData explicitly bound to the same session emits the
six-beat note. This prevents the command from working for otherwise valid
runtime-generated compositions; it does not commit an incorrect duration.

**Fixed on 2026-09-30:** Bind the supplied project JavaScriptSession to CompileData
regardless of the selected object type, and initialize JavaScript for PolyObject
generation so descendants can run when no session is supplied. The new
owner-boundary regression runs a real on-load script, then measures its six-beat
JavaScript child, verifies unchanged project XML and retained session ownership.
It failed before the repair with `'sharedDuration' is not defined` and passes
afterward. Java Blue's JavaScriptProxy likewise uses its current project engine
for score generation.

Follow-up validation: 160 tests passed across score-object testing, fenced
requests and real ProjectHistory round trips; main-process compilation, targeted
ESLint/Prettier and whitespace checks passed. A separate cold Node process also
measured a JavaScript child without a supplied session, initializing the runtime
once and returning six beats.

The initial review made no production changes; the user subsequently authorized
and received the repair above. No other actionable correctness findings were
identified in the reviewed changes. Platform and
runtime limitations below remain unverified or deliberately deferred.

## Summary of fixes already present

| Area | Changes |
| --- | --- |
| Manual delivery | Build and bundle the current offline Quarto book, require its index during packaging/smoke checks, and open it from **Help → Blue Manual**, after Window. Missing output produces a recoverable error. Disable remote theme fonts. |
| Quit and history lifecycle (M21–M23) | Wait for the Settings save/discard/cancel decision; keep library IPC available while windows close; register one history cleanup listener per WebContents. The originally reported Electron menu warning's cause remains unconfirmed. |
| Startup and Code Repository (M24, M26, M27) | Start library services before the first renderer, select the worker filename emitted by the active build, and clear stale migration diagnostics on retry. |
| Blue Live Repeat (M01) | Trigger enabled cells at the Tempo/Repeat interval; reconcile live setting changes; stop scheduling when disabled, gated, or stopped. |
| Live orchestra compilation (M28) | Preserve the running session during the temporary perform-thread join; publish a terminal failure if control-channel bindings cannot be rebuilt. |
| Java runtime dependencies (M29) | Include Clojure dependencies in readiness caching; recreate the helper after additions/removals, including Undo/Redo. |
| Unknown instruments (M30) | Preserve opaque vendor XML and independent copies; report the actual unsupported type during enabled generation instead of silently omitting it. |
| JavaScript Instruments (M02) | Evaluate scripts and emit their `instrument` string in synchronous and asynchronous CSD generation. |
| Instance placement (M08) | Normalize source notes, apply the Instance processor chain and Time Behavior, then add its placement start. |
| Selected ranges (M16, M19, M25) | Calculate AudioFile/Frozen seeks in seconds using the tempo map; support the documented bounded static linked-source case; filter nested PolyObject notes in local coordinates and rebase only at the outer container. |
| Score parsing (M17) | Raise a source-line error for malformed recognized `i` events while preserving supported shorthand. |
| Objective duration (M20) | Measure PolyObject output through asynchronous runtime generation, fence project revision/session, and commit measured durations through ProjectHistory. Preserve the project JavaScript session for children after the review repair above. |
| Time editors (M03, M04, M07, M14, M18) | Permit marker-only ruler conversion; use the full tempo map and selected SMPTE rate; format End Time in the selected base; label 29.97 as non-drop. |
| PatternObject (M05) | Retain the visible prefix on Beats resize, clear steps on subdivision changes, and prevent hidden out-of-grid triggers. Keep canonical patches and renderer previews aligned. |
| PianoRoll (M06, M15) | Preserve per-note template overrides in copy/paste; edit scale Base Frequency through a labeled history commit. |
| Editing (M13, M32, M33) | Settle instrument edits before Track object insertion; recognize submitted text acknowledgements without false draft conflicts; restore a cancelled Tracker cell's DOM value before blur. |
| Accurate controls and prompts (M09, M10, M12) | Hide inactive AudioFile behavior/processor controls and legacy external-play preferences; explain that project library deletion can be undone. |
| Build hygiene (M31, M34) | Exclude generated Quarto/native dependency output from lint; update pnpm CI setup/configuration for the repository's pinned version. |

The larger generation changes retain explicit limits rather than claiming a
general linked-source range contract. Project mutations use the existing
document/history bridge; added round-trip coverage exercises canonical values,
stable identities, dirty state, and generated output. Runtime and renderer
regressions exercise lifecycle and user behavior. The review follow-up adds the
previously omitted JavaScript container case above.

## Validation and remaining scope

Initial review validation, before the authorized P2 repair:

- `pnpm --filter @blue/app test`: 495 files, 5,293 tests passed; two tests skipped.
- `pnpm --filter @blue/data test`: 201 files, 2,063 tests passed; one file/test skipped.
- `pnpm --filter @blue/app build:main`: passed.
- `pnpm lint`: passed, including root formatting and package validation.
- `git diff --check`: passed.
- The standalone JavaScript-session reproduction failed on the review
  implementation, while generation bound to the supplied session succeeded.

Final acceptance after the repair: repository `pnpm test` passed (app 5,294,
data 2,063, existing skips retained), root `pnpm lint` and the main build passed.
Final convergence found no new implementation gaps in the accepted scope;
the three existing deferred validation tasks remain incomplete.

Previously recorded evidence remains in [manual-issues.md](manual-issues.md):
the macOS fresh clone/build/root test/lint run, native/Java checks, packaged
interactions, and offline manual/link checks. This review does not claim a new
Windows/Linux or physical MIDI pass.

- T122, T123 and T132 remain incomplete and are deferred by the user.
- Dynamic, nested, transformed and processor-bearing linked-source range
  semantics remain outside the bounded M16 implementation.
- Screenshot expansion is accepted for later work. The original 94 topics
  reference 96 distinct images across 56 topics; the current book has eight
  screenshots. Counts and the accepted reduction are recorded in
  [manual-changes.md](manual-changes.md).
- The first-project tutorial rewrite and online publication remain deferred.
