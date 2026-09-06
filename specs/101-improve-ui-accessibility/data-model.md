# Data Model: Improve UI Accessibility

This feature introduces no persisted domain data, migration, IPC payload, or `.blue` XML change. The following are validation concepts owned by renderer styling/documentation and audit tooling.

## Semantic Color Role

Represents an application-owned visual purpose rather than a raw color.

- **name**: stable role identifier
- **purpose**: text, surface, control boundary, focus, accent fill, on-fill foreground, or status
- **allowed contexts**: backgrounds or states where the role may appear
- **contrast floor**: 4.5:1 for normal text, 3:1 for qualifying large text or applicable non-text information, or documented non-essential/decorative exemption
- **ownership**: application-owned or project-authored

Validation rules:

- An application-owned role referenced by production UI must be defined.
- A foreground role must pass against every governed background in its allowed contexts.
- Fill roles that contain text must declare an allowed on-fill foreground.
- Project-authored roles/values are preserved and excluded from token normalization.

## Governed Contrast Pair

Represents a foreground/background usage that must be measured together.

- **foreground role/value**
- **background role/value**
- **usage**: normal text, large text, essential boundary, graphical state, or focus indicator
- **minimum ratio**
- **representative surfaces**
- **exception reference**, if any

Validation rules:

- Ratios are evaluated without rounding a failing result upward.
- Alpha colors are composited over their declared background before measurement.
- Hover, focus, pressed, selected, and error combinations are separate pairs when colors change.

## Accessible Control Contract

Represents the observable accessibility state of an application-owned control.

- **accessible name**
- **semantic role**
- **value/range**, when applicable
- **pressed/selected/expanded state**, when applicable
- **keyboard operations**
- **visible focus treatment**
- **non-color cue**

## Modal Classification

Classifies a candidate overlay before remediation.

- **kind**: true modal, non-modal surface, wrapper/helper, or native host dialog
- **accessible title source**
- **initial focus target**
- **dismissal policy**
- **focus containment**
- **focus restoration target**
- **host document/window**
- **confirmation owner**: native host confirmation, contextual application confirmation, or non-confirmation modal

State transitions for a true modal:

1. Closed → Opening: capture opener and resolve the host document.
2. Opening → Open: expose dialog semantics and place focus at the deterministic target.
3. Open → Open: cycle Tab/Shift+Tab within current focusable descendants.
4. Open → Closing: resolve an explicit decision or safe cancellation.
5. Closing → Closed: remove modal semantics and restore focus to the connected opener.

## Accessibility Exception

Represents an explicit exclusion from application-owned color governance.

- **path and exact value/pattern**
- **owner surface**
- **reason**
- **category**: project-authored, syntax/data visualization, decorative, inactive, or platform-native
- **verification**
- **review policy**

Exceptions must be exact, auditable, and must not exempt enabled information-bearing application text or essential control state.

## Keyboard Value Step

Represents the deterministic adjustment unit for an in-scope value control.

- **authored minimum and maximum**
- **authored resolution**, when present
- **effective step**: authored resolution, otherwise 1% of the authored range
- **page step**: ten effective steps
- **axis/handle name** for XY and bank controls

All changes clamp to the authored range and remain renderer interaction state; no new value representation is persisted.
