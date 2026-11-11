# Runtime work contracts

## Poll lifecycle

Idle + eligible tick → pending token/request. Pending + tick → no work. Pending +
current success/failure → handle/log as before, release own token. Any + clear/stop/
replace → invalidate token; late result → ignored. New generation may poll before old
transport completion. No old response may terminate or mutate the replacement session.

## History

Preparation mutates detached candidates only. A failed preparation leaves canonical XML,
identities, history cursor, dirty state and runtime unchanged. Deltas contain isolated
blueprints and IDs, no project roots. Identity remapping includes fields and collection
content for arrays/maps/sets/views, cycles and shared aliases. Replay validates preimages
before writes. Direct proposal matching is unchanged; normal edits need no fingerprint.

## Automation

Ordered lookup excludes point 0 from upper_bound search. Zero (including negative zero)
returns first value. Exact time returns last matching tail point without quantization.
Before-first evaluation extrapolates; completed/rewound behavior and exact-decimal
arithmetic are unchanged. Unordered and non-finite elapsed inputs use the prior scan.
No allocations, logging, locks or definition destruction enter audio lookup.

## Promoted follow-up contracts

Native definitions are shared immutably across list generations; unchanged point/segment
buffers retain identity. Runtime state matches numeric automation IDs, never retired
map-key pointers. Replacement creates a new ID and cannot inherit completion.

Library hooks keep one paginated refresh per effect generation and coalesce notifications
into one follow-up. Invalidated results stop further pages and cannot publish. Keep global
project revision invalidation: the user-database content revision is not a project key.

Fixed SQL browse/search shapes may be cached per repository connection. Search batches
breadcrumbs in one recursive query for the selected page, preserving root→item order,
counts, sorting and pagination. Close clears cached statements. No schema migration.

ScorePanel owns the visible horizontal interval, derived from measured client width,
synchronized scroll position and zoom, with 128 px overscan. Unknown width renders all.
Track canvases cull only bar rendering; full model rows/items retain hit testing,
marquee, navigation and drop geometry. Active gesture/selection and open context-menu
targets stay mounted. Escape/blur/unmount retain existing canonical history cancellation.
Piano-roll thumbnails keep the current rectangle geometry and colors, batching it into
one SVG path in CSS pixel coordinates; no oversized bitmap backing store or new animation.
