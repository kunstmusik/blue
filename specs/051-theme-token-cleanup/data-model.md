# Data Model: Centralized Renderer Theming

This feature has no persisted application data model. The entities below describe the implementation and audit concepts needed to keep renderer styling consistent.

## Theme Role

**Purpose**: A named semantic color role consumed by renderer app chrome and components.

**Fields**:

- `name`: Stable token name, such as `app-menu` or `app-text-muted`.
- `value`: Current color value.
- `purpose`: Human-readable intended usage.
- `legacyAliases`: Existing names that map to the role during migration.
- `status`: `active`, `alias-only`, or `deprecated`.

**Validation Rules**:

- Every static app palette role must have one clear purpose.
- A legacy alias must resolve to exactly one active role.
- Role names must describe UI purpose rather than raw hue.

## Styling Surface

**Purpose**: A renderer surface that consumes theme roles.

**Fields**:

- `name`: Surface name, such as Settings, Workbench Shell, CodeMirror, Score, Blue Live, Mixer, Output, BSB Interface, Effect Editor, or Toasts.
- `paths`: Source files or CSS sections included in the surface.
- `stylingPath`: `utility`, `custom-css`, `third-party-theme-api`, `inline-dynamic`, or `data-driven`.
- `themeCoverage`: `complete`, `partial`, or `exception-only`.
- `visualChecks`: Manual or automated validation points for the surface.

**Validation Rules**:

- Static app chrome colors should have `themeCoverage: complete`.
- Custom CSS surfaces must identify why utilities are insufficient.
- Data-driven surfaces must distinguish project data colors from app chrome.

## Exception Record

**Purpose**: A documented literal color or style that remains after migration.

**Fields**:

- `path`: Source file path.
- `value`: Literal value or pattern.
- `kind`: `data-driven`, `java-blue-parity`, `syntax-palette`, `dynamic-geometry`, `third-party-required`, or `temporary`.
- `reason`: Short explanation.
- `ownerSurface`: Related Styling Surface.
- `reviewBy`: Date or feature milestone when temporary exceptions must be revisited.

**Validation Rules**:

- Each exception must have a non-empty reason.
- Temporary exceptions must have a revisit target.
- App chrome palette values should not be approved as permanent exceptions.

## Validation Check

**Purpose**: A repeatable audit step that reports theme drift.

**Fields**:

- `name`: Check name.
- `scope`: File glob or source section.
- `detects`: Drift category detected by the check.
- `allowlistSource`: Exception records used to suppress approved findings.
- `passCriteria`: Objective pass/fail rule.

**Validation Rules**:

- Checks must fail on unapproved static palette values.
- Checks must report enough path/value context for follow-up.
- Checks must not fail on dynamic geometry-only inline styles.
