# Contract: score-object document reducer (seam 4)

New renderer-local pure module:
`packages/blue-app/src/renderer/components/workbench/panels/score-object/score-object-document-reducer.ts`,
extracted verbatim from `ScoreObjectEditorPanel.tsx` (helper block + `applyPatchToDocument`).

## Public surface

```ts
export function applyPatchToDocument(
  doc: ScoreObjectEditorDocumentSnapshot,
  patch: ScorePatch,
): ScoreObjectEditorDocumentSnapshot;
```

`ScoreObjectEditorPanel.tsx` re-exports `applyPatchToDocument` so existing imports keep
working; the five test files that import it directly
(`score-object-editor-panel-tracker-patch.test.ts`,
`score-object-editor-panel-sound-patch.test.ts`, `jmask-editor-contract.test.tsx`,
`audioclip-score-object-editor.test.tsx`, `object-builder-editor-parity.test.tsx`) are
repointed to the new module in the same change.

## Dependencies of the extracted module (all existing, none new)

- Types + `applyJMaskPatchToPayload` / `createJMaskPayloadSummary` from
  `../../../../shared/project-editor` (stays the shared contract hub).
- `applyPianoRollPatchToPayload`, `PianoRollPayload` from `./editors/pianoroll/types`.
- `applyBsbInterfacePatchToSnapshot` from `../../../../stores/project-store`
  (interim — relocating it belongs to the project-store follow-up seam).
- `secondsToBeats` from `../../../../time/time-unit-logic`.

The module has no React, store, IPC, or DOM dependency; its only platform call is
`structuredClone`.

## Behavioral invariants

1. **Verbatim semantics** for every handled patch kind: `replaceAudioFileSource`,
   `updateAudioFilePostCode`, `updateTypeSpecificEditor` (`external`, `code`, `tracker`
   incl. all cell/action/track-property operations, `audioClip` incl. loop-off duration
   clamping, structured payloads: piano-roll, JMask, BSB interface/code/automation,
   generic scalar/pattern/trackData fields), `updateSharedProperties`; all other
   `ScorePatch` kinds return the document unchanged.
2. **Preserved aliasing subtlety** (load-bearing, pinned by
   `score-object-editor-panel-sound-patch.test.ts`): the structured BSB branch
   shallow-copies the instrument, then the mutating `applyBsbInterfacePatchToSnapshot`
   writes nested `widgetTree` nodes through shared references, and
   `buildSoundAutomationParametersFromSnapshot` reads the "previous" instrument through
   those mutated references. The extraction must NOT purify this (no `structuredClone`
   substitution, no deep copy) — identical outputs, including shared-reference effects.
3. The React component's behavior is unchanged: optimistic `setDocument` via
   `applyPatchToDocument` alongside the authoritative `applyProjectDocumentPatch` store
   call, and the audioClip-preview effect keep their current wiring.
4. Optimistic reducer state stays renderer session state; nothing here enters `.blue`
   XML (FR-006).

## Not part of this contract

- Purifying the BSB shared-reference mutation, decomposing the ~680-line tracker branch,
  or extracting `applyBsbInterfacePatchToSnapshot` from `project-store.ts` — all
  separately specified follow-ups (recorded in the deferred inventory).
