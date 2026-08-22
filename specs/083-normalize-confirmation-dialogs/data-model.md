# Data Model: Confirmation Dialog Normalization

All entities are transient TypeScript values. Nothing in this model is stored in project XML, CSD, settings, or library files.

## Native confirmation request

| Field | Shape | Rules |
|---|---|---|
| `id` | string | Stable flow identifier for diagnostics/tests; non-empty |
| `type` | `none \| info \| error \| question \| warning` | Maps to Electron message-box tone |
| `title` | string | Non-empty accessible/window title |
| `message` | string | Non-empty primary decision statement |
| `detail` | string, optional | Consequence/resource context; bounded serializable text |
| `actions` | `NativeConfirmationAction[]` | At least one; unique semantic IDs and non-empty labels |
| `defaultActionId` | string | Must name one declared action |
| `cancelActionId` | string | Must name one declared safe action |
| `noLink` | boolean, optional | Platform presentation hint only |
| `checkbox` | object, optional | Label and initial checked state |

`NativeConfirmationAction` contains a semantic `id`, user-visible `label`, and role (`accept`, `cancel`, `destructive`, `secondary`, or platform role where required). Array order remains the flow's declared display order; callers never interpret response indexes.

## Native confirmation result

| Field | Shape | Rules |
|---|---|---|
| `actionId` | string | Always a declared semantic ID; dismissal/failure resolves to `cancelActionId` |
| `checkboxChecked` | boolean, optional | Present only when the request declared a checkbox |
| `outcome` | `selected \| dismissed \| owner-unavailable \| failed` | Supports diagnostics and fail-closed tests; only `selected` with the required action permits mutation |

## In-app confirmation action

| Field | Shape | Rules |
|---|---|---|
| `id` | string | Unique semantic ID |
| `label` | string | Explicit user-visible verb/choice |
| `intent` | `cancel \| secondary \| primary \| destructive` | Controls semantics and existing styling role |
| `disabled` | boolean, optional | Disabled actions cannot resolve the decision |

## In-app confirmation state

| Field | Shape | Rules |
|---|---|---|
| `open` | boolean | Owned by the invoking renderer workflow |
| `title` / `description` | string | Supply accessible name and consequence description |
| `actions` | action array | Unique IDs; exactly one declared cancel action |
| `cancelActionId` | string | Used by Escape/dismissal |
| `initialFocusActionId` | string, optional | Defaults to cancel when any action is destructive; override requires docs rationale |
| `resolved` | internal boolean/ref | Transitions once from false to true; prevents duplicate callback delivery |
| `opener` | internal element ref | Restores focus after close when still connected |

## Pending operation target

A caller-owned snapshot of the resource/revision/selection/preview/token guarded by a request. It is not passed as privileged state through a generic callback. The caller captures it before opening, then revalidates it after acceptance and immediately before the existing mutation API.

State transitions:

```text
idle -> requested -> awaiting-decision
awaiting-decision -> cancelled                         (dismiss/cancel/owner loss/failure)
awaiting-decision -> accepted -> validating-target
validating-target -> cancelled                         (stale/invalid/expired)
validating-target -> mutating -> completed | failed
```

Only `validating-target -> mutating` may invoke the guarded operation. A confirmation result never itself mutates project or library state.

## Confirmation policy entry

The durable documentation record for each flow contains: flow ID/name, owner, native or in-app surface, initiating window, semantic actions and order, default/cancel behavior, stale-target rule, implementation location, verification reference, and exception/override rationale if any.
