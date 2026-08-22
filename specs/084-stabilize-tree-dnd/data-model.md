# Data Model: Stabilize Tree Drag and Drop

All entities in this feature are renderer-session or derived live-layout state. No entity is written to `.blue` XML, library SQLite, generated CSD, or a new settings field.

## Drag Ownership Domain

Represents the one coordinated React DnD manager for a DOM document.

| Field | Type | Rules |
|---|---|---|
| `document` | `Document` | Identity key; exactly one live domain per document realm |
| `manager` | `DragDropManager` | Created with HTML5 backend rooted at `document` |
| `activeDrag` | derived monitor state | Never persisted; blocks/defers panel transitions while true |

Relationships:

- Owns zero or more participating `Tree Interaction Surface` instances.
- Is independent from every domain keyed by another `Document`.
- May be garbage-collected after its document and all surfaces become unreachable.

## Tree Interaction Surface

Represents one mounted tree.

| Field | Type | Rules |
|---|---|---|
| `surfaceId` | component/tree identity | Stable for the mounted tree session |
| `ownerDocument` | `Document` | Derived from the mounted DOM sentinel/container |
| `participation` | `coordinated` or `native` | Arborist trees are coordinated; Libraries is native |
| `manager` | `DragDropManager` or N/A | Coordinated surfaces use the domain manager for `ownerDocument` |

State transitions:

1. `unmounted -> resolving-document`
2. `resolving-document -> mounted` after the manager is available
3. `mounted -> resolving-document` if a portal remount changes documents
4. `mounted -> unmounted` with handlers unregistered and transient drag state cleared by React DnD

## Auxiliary Panel Session

Represents the existing live React/Dockview panel object and its transient state.

| Field | Owner | Preservation rule |
|---|---|---|
| Dockview panel object | Dockview | Reuse when the panel remains docked or moves between docked edges |
| selection/expansion/scroll | panel/tree implementation | Preserve by retaining the live panel session |
| focus | DOM/Dockview | Preserve for unaffected panels; explicitly restore desired active panel |
| initialization/subscriptions | panel implementation | Must not repeat for an unaffected session |
| presentation and size | workbench auxiliary state | Apply from desired layout without changing envelope meaning |

## Panel Placement Transition

Represents one transient request from a valid current layout to a desired layout.

| Field | Type | Rules |
|---|---|---|
| `current` | `AuxiliaryLayoutState` | Last successfully applied canonical state |
| `desired` | `AuxiliaryLayoutState` | Pure requested state from existing layout helpers |
| `preservedDockedSizes` | `AuxiliaryDockedSizeSnapshot` | Captured before live movement |
| `operations` | derived ordered operations | Add/move/close/activate/resize/maximize only where required |
| `status` | `applied`, `deferred`, or `failed` | Only `applied` may replace canonical store state |
| `state` | `AuxiliaryLayoutState` | Synced applied state or unchanged `current` on non-application |
| `reason` | optional enum/message | Diagnostic only; not persisted |

Validation rules:

- Every desired docked panel resolves through the panel registry before mutation.
- A panel appears in at most one desired docked edge/order.
- Existing stored layout normalization remains authoritative before transition planning.
- Active tree/auxiliary drag state produces `deferred` and no live mutation.
- Failure after partial mutation triggers best-effort reconciliation to `current` and returns `failed`.
- Unaffected panel object identities are equal before and after an applied transition.

## Persistence

`StoredWorkbenchLayout` version 7 and its migrations from versions 2-6 remain unchanged. Transitions update the same auxiliary placement, active-panel, presentation, and size meanings already serialized by the workbench store. Drag domains, managers, operation plans, statuses, and panel object identities are never serialized.
