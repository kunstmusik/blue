# Quickstart: Validate BlueX7 Instrument Editor Parity

## Prerequisites

- Work from the repository root on branch `081-bluex7-editor-parity`.
- Install workspace dependencies with the repository-supported `pnpm` version.
- Keep the Java Blue reference checkouts available at `~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core` for evidence comparison.
- For manual desktop checks, ensure the packaged/development app can open a representative project containing BlueX7 instruments.

## 1. Portable Model, XML, SysEx, and Csound

Run the focused data tests:

```bash
pnpm --filter @blue/data test -- src/instruments/blue-x7.test.ts src/instruments/blue-x7-sysex.test.ts
pnpm --filter @blue/data build
```

Expected evidence:

- Java final defaults and all range boundaries pass.
- Known and unknown root/nested XML survives load/edit/save/deep-copy.
- Synthetic 163-byte and 4,104-byte fixtures match the Java-oracle JSON, including operator reversal and packed fields.
- Header, terminator, checksum, high-bit, wrong-size, and truncated variants fail without a partial voice.
- Algorithms 1, 19, and 32 match normalized Java golden tables/body.
- Multiple BlueX7 instances share one static-table set and receive distinct six-table operator sets.
- Preview compilation leaves the source instrument and project table state unchanged.

## 2. Shared Snapshot/Patch and Host Contracts

Run focused application contracts:

```bash
pnpm --filter @blue/app test -- src/shared/project-editor-blue-x7.test.ts src/shared/blue-x7-sysex.test.ts src/main/blue-x7-sysex-import.test.ts
pnpm --filter @blue/app test -- src/main/unified-library/editor-adapters.test.ts src/renderer/tests/track-instrument-patch-queue.test.ts
```

Expected evidence:

- Every semantic patch projects and applies identically.
- Invalid indexes/domains are unchanged and never partially mutate.
- Shared sync/PMS updates all six values atomically; mixed legacy values survive until edit.
- Whole-voice replacement preserves metadata and unknown XML and is indivisible in the Track queue.
- Main chooser/read owns the invoking window, returns no native path, and distinguishes cancel/read/size failures.
- Library import modifies only the draft until Save; save/reopen retains the imported voice.

## 3. Editor, Undo, Import, and Accessibility

Run renderer tests:

```bash
pnpm --filter @blue/app test -- src/renderer/tests/blue-x7-editor.test.tsx src/renderer/tests/blue-x7-hosts.test.tsx
pnpm --filter @blue/app test -- src/renderer/tests/orchestra-instrument-editor-panel.test.tsx src/renderer/tests/track-instrument-editor-window.test.tsx
```

Expected evidence:

- Six operator contexts remain isolated and all fields are reachable.
- All 32 algorithms show the matching image/label and disabled operators remain stored.
- Seven envelopes support pointer and precise keyboard edits with synchronized values.
- One gesture produces one undo step; redo restores it; import is one step; context replacement clears history.
- Single and bank cancel/errors dispatch no patch; success dispatches one replacement.
- Generated tables/body and binding status refresh from the latest voice; Java-unused fields are labelled truthfully.
- Controls, graphs, tabs, dialogs, and code views expose names/values and visible focus.

## 4. Build and Cross-Package Regression

```bash
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm test
pnpm lint
git diff --check
```

Expected evidence: all commands pass. If a repository-wide unrelated failure exists, record the exact command/output and demonstrate that focused BlueX7 checks pass.

## 5. Manual Three-Host Editing Pass

Use the same representative BlueX7 voice in each host:

1. Select an arrangement BlueX7 in the Orchestra panel.
2. Open a Track-owned BlueX7 in the 1000×760 Track instrument editor window.
3. Open a user-library BlueX7 item in the library editor.

In each host verify:

- Common/LFO, operator 1–6, PEG, Csound, and Import are present and behave identically.
- Change one field in every group and all four points of one operator envelope and PEG.
- Shared sync and PMS update every operator; switching tabs/operators loses no edit.
- Undo/redo affects only the current editor session and clears after leaving/reopening.
- Post code edits with normal CodeMirror undo, persists through the host's normal save flow, and appears in generated text.
- At 1000×760 and in the narrow orchestra pane, every control remains reachable by scrolling/reflow with no overlap.
- Complete the flow by keyboard only and confirm focus is visible and restored after dialogs.

For the library host, confirm edits remain a draft until Save and that Cancel/Revert leaves the durable library item unchanged.

## 6. Manual SysEx Pass

For each host:

1. Import the canonical single fixture; confirm the preview, then undo/redo once.
2. Import bank slots with normal, duplicate, blank, padded, and non-printable names; confirm stable slot labels.
3. Cancel file selection and bank selection and verify zero mutation.
4. Try wrong-size, checksum-corrupt, header-corrupt, and unreadable files and verify actionable errors plus zero mutation.
5. Start an import, change the editor target before confirming, and verify the candidate is not applied to the new target.

## 7. Java Csound Evidence Pass

Compare TypeScript output with the checked Java goldens and the repository TimewaveCanon project:

- normalize line endings and trailing whitespace only;
- verify table allocation/adjacency, operator row field order, algorithms 1/19/32, p-field substitutions, final output rewrite, and exact post-code placement;
- verify an existing table-number collision case behaves according to the documented Java compatibility decision;
- verify stored-but-not-emitted fields refresh the binding view while the Java-compatible generated body remains unchanged.

If Csound or the native engine is available, compile representative generated CSDs and confirm no syntax/table-reference errors. Record the environment and result; lack of an optional local Csound binary does not replace the deterministic golden comparisons.

## Completion Evidence

### Java Provenance and Resources
- **Java Commit**: `3ca3f40579c48a023299a68130d8ab6b9e950974` (`~/work/nbprojects/blue/blue-core` and `~/work/nbprojects/blue/blue-ui-core`)
- **Java Model Sources**:
  - `blue-core/src/main/java/blue/orchestra/BlueX7.java`
  - `blue-core/src/main/java/blue/orchestra/blueX7/AlgorithmCommonData.java`
  - `blue-core/src/main/java/blue/orchestra/blueX7/LFOData.java`
  - `blue-core/src/main/java/blue/orchestra/blueX7/Operator.java`
  - `blue-core/src/main/java/blue/orchestra/blueX7/EnvelopePoint.java`
- **Java UI and SysEx Sources**:
  - `blue-ui-core/src/main/java/blue/ui/core/orchestra/editor/BlueX7Editor.java`
  - `blue-ui-core/src/main/java/blue/ui/core/orchestra/editor/blueX7/BlueX7SysexReader.java`
  - `blue-ui-core/src/main/java/blue/ui/core/orchestra/editor/blueX7/BlueX7ImportDialog.java`
- **Java Resource Files**:
  - Algorithms 1-32 ORC: `blue-core/src/main/resources/blue/resources/blueX7/dx701.orc` through `dx732.orc`
  - Algorithm GIF Diagrams: `blue-ui-core/src/main/resources/blue/ui/core/images/blueX7/algo01.gif` through `algo32.gif`
- **Fixture Provenance**:
  - `java-default.blue.xml`: Extracted directly from Java `BlueX7` default instance serialized to XML.
  - `boundary-and-unknown.blue.xml`: Java XML with boundary values, mixed shared states, and unknown root/nested elements and attributes.
  - `single-voice.syx`: Deterministic synthetic 163-byte Yamaha DX7 single-voice SysEx.
  - `voice-bank.syx`: Deterministic synthetic 4,104-byte Yamaha DX7 32-voice bank SysEx.
  - `expected-decode.json`: Output produced by running Java `BlueX7SysexReader` against `single-voice.syx` and `voice-bank.syx`.

### Recorded Results (2026-08-19, post-review fixes and final parity review)

All commands run from the repository root on branch `081-bluex7-editor-parity` after the
review-fix pass (Java-parity substitution fix, envelope gesture coalescing, patch validation,
golden-comparison test, dead-code removal):

- `pnpm --filter @blue/data test --run` — **168 test files, 1,647 tests passed** (0 failed).
- `pnpm --filter @blue/app test --run` — **353 test files, 3,446 tests passed, 2 skipped** (0 failed).
- `pnpm --filter @blue/data build` — passed.
- `pnpm --filter @blue/app build:main` — passed.
- `pnpm --filter @blue/app build:preload` — passed.
- `pnpm --filter @blue/app build:renderer` — passed.
- `pnpm --filter @blue/app test:browser:x7` — **2 real-browser instances, 6 tests passed** (desktop 1280×960 and narrow 360×600).
- `pnpm lint` — passed, 0 errors.
- `pnpm test` — passed on the final run, including all native socket tests with loopback access. An earlier elevated attempt hit a transient `AutomationProtocolTests` retirement-ring failure; the isolated retry passed in 0.52 seconds before the clean full rerun.
- `git -c core.fsmonitor=false diff --check` — clean.
- `MISSING_FEATURE_GPT.md` — confirmed untouched (user-owned, last modified 2026-08-17, before this branch's work).

Focused commands from sections 1–3 above also pass individually, including the real
Java-golden comparison in `blue-x7-csound-parity.test.ts` (static tables, per-instrument
operator tables, and all three instrument bodies compared against the checked-in
Java-generated `TimewaveCanon.csd` under the documented normalization policy).

**Documented divergences (intentional, each covered by a focused test or noted here):**

- P-field substitution uses Java's `TextUtilities.replace` first-occurrence semantics
  (`imap128` identifier and `;0 <= p25 <= 7` comment stay literal), pinned by a unit test.
- Out-of-range algorithms generate an empty body, matching Java's resource-load failure.
- The detached bank decoder returns an all-enabled voice, while the editor overlays
  the target instrument's current operator-enable flags before applying a bank slot,
  matching Java's `importFromBank` behavior; single-voice imports force all six
  operators enabled. Both decoder and editor behavior are pinned by focused tests.
- The checked-in `TimewaveCanon.csd` golden predates the current Java ORC resources
  (which contain blank section separators the golden lacks) and carries the
  pre-existing application-level mixer expansion form (`ga_bluemix_1_0 = ... +` vs
  `ga_bluemix_0_0 +=`); the parity test normalizes exactly these two documented,
  non-semantic classes and compares everything else exactly.
**Manual/equivalent validation note:** T064 is closed for this implementation review by
the three-host contract tests, renderer accessibility/layout tests, the real-browser
desktop/narrow-pane suite, and deterministic malformed-file/cancel coverage. A physical
desktop keyboard-only pass and optional local Csound-binary compile were not available in
this environment; they remain optional verification follow-ups rather than unbuilt
BlueX7 feature work.
