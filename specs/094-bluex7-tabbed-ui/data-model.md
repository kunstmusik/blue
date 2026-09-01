# BlueX7 Tabbed UI Data Model

This feature adds presentation state around the existing BlueX7 snapshot. It does not change
the canonical `BlueX7Voice`, parameter catalog, patch union, or project XML model.

## `BlueX7Tab`

Renderer-local top-level presentation state:

```text
'global' | 'operators' | 'pitch' | 'csound'
```

| Field | Type | Rules |
|---|---|---|
| active tab | `BlueX7Tab` | Defaults to `global` on `BlueX7Editor` mount; changes only from the tab list; never serialized or patched |
| tab order | fixed tuple | `global`, `operators`, `pitch`, `csound`; labels are Voice & Global, Operators, Pitch Envelope, Csound & Code |
| panel identity | generated string | Unique per editor instance so `aria-controls`/`aria-labelledby` do not collide between editors or popouts |

The state lifetime is the mounted editor instance. Closing/reopening the editor creates a new
state value and returns to Voice & Global.

## `BlueX7OperatorSelection`

Renderer-local selected operator index:

```text
0 | 1 | 2 | 3 | 4 | 5
```

It defaults to `0` (Op 1) when the operator panel mounts. The selected tab labels Op 1 through
Op 6 and display a muted indicator from the canonical `voice.common.operatorEnabled` value.
Changing the selection changes which operator fields are rendered in the active workstation
and which operator parameter IDs are eligible for effective-value readback. It does not change
the voice or emit a patch.

## `BlueX7CsoundTab`

The existing Csound panel's local sub-tab state remains:

```text
'postCode' | 'preview' | 'bindings'
```

It defaults to `postCode` on Csound panel mount and is kept mounted across top-level tab
switches. The sub-tabs control the Csound Post Code editor, Generated Preview, and Parameter
Bindings & Diagnostics views. The authored post-code value remains `voice.csoundPostCode` and
is changed only through the existing `setCsoundPostCode` patch.

## `BlueX7Voice` (canonical, unchanged)

The existing `BlueX7Voice` remains the durable model:

```text
common: algorithm, keyTranspose, feedback, operatorEnabled[6]
lfo: speed, delay, pitchModulationDepth, amplitudeModulationDepth, wave, sync
operators[6]: mode, sync, frequency fields, sensitivities, keyboard scaling, envelope[4]
pitchEnvelope[4]: rate, level
csoundPostCode: string
```

`BlueX7Editor` reads this through `BlueX7InstrumentSnapshot.voice`. All edits continue to use
the existing `BlueX7Patch` variants and `useBlueX7History`; no tab action is a patch.

## `BlueX7EffectiveValueScope` (derived, disposable)

The renderer derives a set of parameter IDs from the active top-level tab, selected operator,
and the snapshot's existing `parameters` list. The semantic-key partition is:

| Scope | Descriptor selection |
|---|---|
| `global` | descriptor group `Common` or `LFO`, plus `operator.1..6.enabled` for the visible Global enable controls |
| `operators(op)` | group `Operator ${op + 1}` plus `common.oscillatorKeySync` and `lfo.pitchModulationSensitivity` |
| `pitch` | descriptor group `Pitch Envelope` |
| `csound` | empty set |

The selected operator group includes the operator enable descriptor so the scope remains
catalog-complete; if a control does not render a live badge, its value is still harmlessly
discardable display state. An optional host allowlist is intersected after this partition.
Unknown semantic keys or missing parameter records are ignored.

The resulting request is disposable and renderer-to-preload only:

```text
{ target, projectSessionId, parameterIds: activeScopeIds }
```

No empty request is sent because the existing preload contract intentionally rejects an empty
`parameterIds` array. Csound & Code therefore clears the effective display state and makes no
readback request.

## State transitions and invariants

1. Mount: `activeTab = global`, `selectedOperator = 0`, Csound sub-tab = `postCode`.
2. Tab click or Enter/Space: the focused tab becomes active; the previous active panel is
   deactivated and any staged envelope gesture is canceled with pointer capture released.
3. Left/Right in a tab list: focus moves with wraparound; it does not mutate voice state or
   activate a different panel until the focused tab is activated.
4. Operator selection: selected index changes locally; a pending gesture is canceled as in the
   existing operator-panel behavior; the new operator's effective scope becomes current.
5. Voice edit/import: existing patch/history behavior is unchanged and all mounted panels read
   the new canonical snapshot. The active presentation state is not persisted or overwritten.
6. Close/unmount: all presentation, effective-value, preview, and gesture state is disposed.

Invariant: no presentation-state transition changes `BlueX7Voice`, `BlueX7InstrumentSnapshot`,
project revision, undo/redo stacks, project XML, app settings, or Csound generation.
