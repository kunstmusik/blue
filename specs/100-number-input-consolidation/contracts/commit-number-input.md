# CommitNumberInput UI and Component Contract

**Scope**: Renderer-only shared primitive; no IPC or persistence API changes.
**Module**: `packages/blue-app/src/renderer/components/CommitNumberInput.tsx`.
**Exports**: Default `CommitNumberInput`, plus named `LiveNumberInput`, `DraftNumberInput`, and `CommitNumberField`.

## Component surface

Expose one named interface for each editing contract rather than a public mode flag:

| Export              | Value and notification                                             | Finish ownership                                                             |
| ------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `CommitNumberInput` | `value: number`, `onChange(number)`                                | Field commits on blur/Enter and cancels on Escape                            |
| `LiveNumberInput`   | `value: number or null`, `onChange(number)`; null represents mixed | Accepted edits notify immediately; finish never duplicates an edit           |
| `DraftNumberInput`  | `value: string`, `onChange(string)`, finite `stepBase`             | Caller owns text; optional row finish/cancel callbacks opt into field keys   |

Numeric modes accept an optional pure `resolveValue(text): number or null`. It replaces default finite parsing and min/max clamping when a field has different parsing, empty, rounding, or rejection rules. Null means reject, never a numeric commit. A mixed live value also supplies a finite stepBase for the first step.

`DraftNumberInput` accepts optional pure `resolveStep(text): number or null` for step candidate validation; default is finite parsing plus step bounds. `stepBase` supplies the latest accepted domain value when draft text cannot be used. `onFinish(text)` opts into field-owned Enter/blur finishing; `onCancel()` opts into field-owned Escape cancellation. Dialog and settings drafts omit these callbacks, so Enter/Escape bubble to their transaction owner. Row editors share a pure domain validator between `resolveStep` and `onFinish` so a rejected step cannot install a false accepted baseline. An optional numeric `onInvalid(text)` supports existing inline validation messages; it is called only for an actual finish rejection, never while probing step candidates.

Common attributes:

- Forward input ref and native id, name, aria attributes, placeholder, inputMode, title, data attributes, autoFocus, disabled, readOnly, min, max, step, style, and caller focus/click/key handlers.
- Keep `type="number"` fixed. Exclude controlled value/onChange/defaultValue/type from the generic native attribute bag.
- Preserve existing default step 0.1 for existing jmask consumers. Every migrated native input that formerly omitted step passes step 1 explicitly; preserve every explicit fractional step or `"any"`.
- Run a supplied `onKeyDown` first and respect `preventDefault`. `CommitNumberInput` and `LiveNumberInput` own Enter/Escape. `DraftNumberInput` handles Enter only when `onFinish` exists and Escape only when `onCancel` exists; otherwise each key bubbles without internal prevention or blur.
- `className` and `style` continue to target the actual input. Compose classes with `cn(BASE, ..., className)` and keep caller precedence. A `containerClassName` applies layout to the required stepper wrapper; migrate flex/grid/width positioning deliberately so the wrapper does not enlarge or shrink the field unexpectedly.
- Preserve CommitNumberField label association; supply stable input ids/accessibility names and link SettingsField labels to their numeric input. Errors and suffixes stay in caller markup; no error/suffix/size framework.

This is a design contract, not an implementation listing. Keep helpers and types in the component module until a demonstrated second consumer needs them.

## Stepping algorithm

1. Read the current draft and latest policy synchronously. Ignore disabled/read-only controls and composing text. Never infer step intent from the next input/change event.
2. Check raw text first: empty, native badInput, or text that is not a complete finite number uses the last accepted value, before any custom resolver or empty fallback runs. Otherwise resolve the draft under its field policy; rejection also falls back to last accepted. Caller stepBase supplies an initially mixed/invalid field’s base. Do not notify the owner for this intermediate value. For example, accepted FPS 30 with empty draft steps to 31, not to fallback 24 plus 1.
3. Calculate one directional step with native stepUp/stepDown on a detached number input created from the actual input's ownerDocument. Preserve the effective min/max/step and stable native step-base rules, including the value content attribute when it is the base. Do not reset that base to each changing draft. Use no global document or cross-realm instanceof checks.
4. For visible step `"any"`, preserve that attribute and use increment 1 for the detached step calculation, anchored at the chosen value so fractional input is not snapped to an integer. Existing numeric steps retain native directional grid snapping.
5. Run candidate through the field's current resolver/validation, including paired-value constraints. Reject non-finite results. If the operation cannot change the chosen base or resolves to the already accepted value, emit nothing and leave subsequent text handling unchanged.
6. Set the accepted/draft/settled refs before calling the owner. Numeric interfaces notify once with the accepted number; `DraftNumberInput` notifies once with the new text and invokes configured row finish once. Dialog draft stepping never persists to the project.
7. Keep focused display current; Escape in `CommitNumberInput` returns to the last accepted value. Subsequent owner snapshots reconcile accepted display without overwriting a dirty draft mid-edit.

Guard invalid/contradictory bounds without exceptions escaping into React; treat impossible steps as no-ops. Do not impose global decimal rounding or safe-integer narrowing on float fields. A custom resolver may reproduce existing parseInt/Math.round behavior where documented.

## Mouse, keyboard, focus, and host window

- Render two explicit `type="button"` controls, with accessible Increase/Decrease names associated with the field. Hide only native spinner pseudo-elements through component Tailwind selectors or a narrowly scoped permitted pseudo-element override. Keep ordinary number-input accessibility semantics.
- Button pointer-down prevents focus transfer, so clicking a step cannot first blur-commit an unstepped draft. Activate once on click, including assistive activation. No custom press-and-hold timer; repeated clicks and keyboard repeat each step once.
- Keep the input as the normal tab stop; ArrowUp/ArrowDown provide equivalent keyboard access. Disable button actions for disabled/read-only states; do not trap other editing keys.
- Arrow keys prevent native stepping and route to the same operation. Do not depend on keyup to clear a mutable 'next event is step' flag. Suppress incidental native wheel stepping while focused without inventing a new wheel interaction.
- Field Enter finishes once, marks the following blur as settled, and prevents a second finish. Field Escape marks cancellation before blur, and that blur never invokes finish. Draft keys without the corresponding callback bubble to the dialog transaction owner.
- Draft text notifications occur on every edit. OK/Apply callbacks consume caller state; row onFinish receives the latest text argument directly, avoiding stale state after setState. Any delayed snapshot handling uses refs only as synchronous bookkeeping, not a new store.
- No portal is needed for inline steppers. Existing dialogs/popovers retain the hosting-window conventions. Focus, detached arithmetic input, and any event listeners use ownerDocument/defaultView so floating panels work after adoption into another window.

## Migration policy matrix

All native number sites in research.md migrate. Default numeric empty text reverts; field-specific existing defaults override it. Native range attributes control stepping independently of custom typed policies.

| Family                                            | Input / policy                                                               | Required preservation                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Existing jmask                                    | `CommitNumberInput`; existing float/clamp                                     | Default step 0.1; caller classes; Escape after step                                             |
| Playback/General/Realtime settings                | `SettingsNumberField`; existing parseInt/parseFloat and fallback values      | Disabled buffers; Apply persistence; attributes-only bounds stay attributes-only for typing     |
| OSC / Utility settings                            | `SettingsDraftNumberField`                                                   | Empty port→0 remains invalid; freeze invalid text retained; existing validator messages         |
| Effect numIns/numOuts, BSB grid                   | `CommitNumberInput`; existing parseInt and zero/default fallbacks            | Preserve existing typed-domain handling, not merely native min attributes                       |
| Virtual keyboard                                  | `CommitNumberInput`; integer policies                                        | MIDI ±1 transform outside input; disabled velocity; existing setter clamps                      |
| Mixer / BlueLive                                  | `CommitNumberInput`; finite resolver, empty revert                           | Avoid Number('') writes; preserve float-vs-integer parsing and current domain validation        |
| blue-x7                                           | `LiveNumberInput`; existing integer/domain resolvers                         | Undo granularity, invalid-input behavior, mixed placeholders, transpose offset and gesture refs |
| TempoPoint / Shift / MeterEntry                   | `DraftNumberInput`; dialog keys                                              | Current OK validation/clamp; exactly one patch; Cancel none; select-on-mount                    |
| FontChooser / tracker range modal                 | `DraftNumberInput`; dialog keys                                              | Current confirm-time rounding/validation and latest draft; no duplicate confirm                 |
| TempoMap / MeterMap rows                          | `DraftNumberInput` with finish/cancel callbacks where applicable             | Existing error visibility, per-row normalization/rejection, disabled first rows                 |
| EditableLineCanvas                                | `CommitNumberInput` with pure current-neighbor clamp/reject                  | Read-only endpoints, point identity, x clamp and y rejection                                    |
| LineDefinitionTable                               | `CommitNumberInput` with pair validation                                     | Strict min<max rule; reject invalid pair, no silent policy change                               |
| Tracker / Pattern / pianoroll / BSB property rows | `CommitNumberInput`; existing per-field parser/default/reject                | Integer truncation vs float domains, conditional any steps, existing out-of-range behavior      |

Add `SettingsNumberField` and `SettingsDraftNumberField` exports sharing `SettingsField`'s label/description scaffold. Existing `SettingsField` remains for nonnumeric inputs. These are label adapters, not independent native number implementations.

## Acceptance obligations

Tests must assert notifications and authoritative values for both user-accepted clarifications, all three named interfaces, step no-ops, rejected candidates, rapid steps before rerender, exact-once Enter/blur finishing, Escape without blur-finishing, unchanged/changed external snapshots, disabled/readOnly, mixed start, and `step="any"`. Integration tests must prove preserved domain and transaction rules. A static check counts migrated source sites separately from DOM input implementations and fails independent native numeric implementations outside this module.
