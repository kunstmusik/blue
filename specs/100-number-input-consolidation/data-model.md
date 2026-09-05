# Data Model: Number Input Consolidation

No persistent entity or serialization change is introduced. All types below are renderer-only concepts; existing BlueData, settings snapshots, and patch contracts remain canonical.

## Entities and ownership

| Entity                  | Fields / meaning                                                                                     | Owner and lifetime                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Numeric value           | Finite number in display units; nullable only for mixed display                                      | Caller owns value; component observes it and sends accepted numeric edits    |
| Input edit session      | Draft text, dirty/focused status, latest accepted numeric value, finish-settled marker               | Commit/live input implementation; lifetime ends on unmount or entity change  |
| Caller text draft       | String including empty/invalid states; latest accepted step base                                     | Dialog/settings/row owns text; component immediately forwards edits          |
| Field policy            | Step/bounds; pure normalization; optional domain finish action                                       | Caller supplies domain policy; primitive supplies default finite parse/clamp |
| Numeric inventory entry | Source site, domain, editing interface, normalization, empty behavior, validation owner, status      | `research.md`; design/implementation record, never application state         |

Each input is keyed by the edited entity when selection changes. A draft for one row, parameter, or project must never carry into another entity. Numeric-to-text conversions for MIDI channels and transpose remain at callers; the component only sees display units.

## Editing state transitions

| Event                       | Deferred numeric                                                                   | Live numeric                                                                                                   | Caller draft                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Type/paste                  | Store draft only                                                                   | Resolve and notify accepted edits with existing undo semantics; rejected text follows live controlled behavior | Immediately send current text to caller; preserve invalid states                    |
| Blur                        | Resolve once, accept or revert                                                     | Do not re-emit last live edit                                                                                  | No normalization by default; optional row finish action receives current text       |
| Enter                       | Finish once, settle before blur                                                    | Settle without duplicate edit                                                                                  | `onFinish` handles once; otherwise the key bubbles                                  |
| Escape                      | Settle cancellation before blur; restore latest accepted/authoritative value       | Cannot undo already notified edits                                                                             | `onCancel` handles without finish; otherwise the key bubbles                        |
| Step                        | Valid draft or last accepted base → one normalized candidate → notify immediately  | Same numeric operation                                                                                         | Update caller draft immediately; optional row finish commits its domain action once |
| Bound no-op / rejected step | No notification; preserve draft and next typing behavior                           | Same                                                                                                           | Same; do not erase an invalid draft merely by attempting a no-op                    |
| External value update       | Keep dirty draft while focused; use latest bounds and owner value on finish/cancel | Follow controlled live display when not holding a deferred draft                                               | Caller is authoritative at every render                                             |
| Disabled/read-only          | No new edits or notifications                                                      | Same                                                                                                           | Same                                                                                |
| Unmount/entity switch       | Discard transient state without commit                                             | Same                                                                                                           | Caller handles its own transaction lifetime                                         |

A synchronous accepted-value ref supports rapid steps before React rerenders. It is transient notification bookkeeping, not a second project owner. Prop changes reconcile the baseline to the current caller value; dirty deferred text is protected until finish. Validation rejection happens before notification, so a rejected value is never installed as the accepted baseline. Caller-side asynchronous patch errors continue to use existing document error handling and authoritative snapshot resynchronization.

## Validation and value rules

- Default numeric policy: empty/unparseable/non-finite text rejects; finite numbers clamp to declared bounds. A custom pure resolver replaces this default and preserves existing integer truncation, rounding, defaults, rejection, and attributes-only bounds.
- Distinguish normalization from validation-draft storage. An invalid string in Utility settings remains a draft; no non-finite number is emitted through the numeric callback.
- Native `step=1` is not integer enforcement. Existing parseInt sites keep integer semantics through their resolver; float fields with integer step remain float-capable when their existing parser permits it.
- Before choosing a step base, reject raw empty/native badInput/unparseable/non-finite draft text; do not invoke finish-time empty fallback for this check. A step starts from the current draft only when it is a complete finite numeric text and resolves under the field policy. Otherwise use the last accepted number. For an initially mixed/invalid field with no prior accepted value, the caller supplies an explicit finite initial step base derived from its domain (minimum when defined, otherwise zero); do not invent a persistent value until the user actually steps.
- Native stepping uses the latest min/max/step and stable step base. `step="any"` preserves arbitrary typed decimals and uses increment 1 for buttons/keys, anchored at the chosen draft/base so 1.25 becomes 2.25.
- Revalidate the candidate against cross-field constraints before emission. Keep paired-line rejection and dynamic neighbor clamps at their existing owner.
- No-op stepping at a bound differs from typing a changed valid value at that bound and later finishing. The no-op never silently commits that draft.
- Default numeric empty handling is revert unless an existing field policy specifies a default. Mixer and BlueLive use revert on empty/non-finite text; clearing must not commit zero merely through Number('') coercion.

## Persistence and compatibility

No new storage, migrations, identities, or IPC messages. Dialog steps update dialog drafts; OK performs its existing single patch, Cancel performs none. Settings edits update the settings draft; Apply retains existing validation and persistence. blue-x7 accepted live edits retain their existing project patches and undo descriptions. Deferred typing intentionally differs from Java ConstantEditor's live document updates as recorded in the spec.
