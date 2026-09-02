# Quickstart: Validating Codebase Simplification

This guide provides runnable commands and validation scenarios to verify each phase of the simplification effort.

---

## Prerequisites

Ensure all workspace dependencies are installed and built:

```bash
pnpm install
pnpm build
```

---

## Validation Scenarios

### 1. Validate Phase 1 (Dead Code & Java Parity Cleanup in `@blue/data`)

Verify that `@blue/data` builds cleanly without the dead Java Swing listeners, provider classes, empty marker interfaces, and `CopyBuffer`:

```bash
# Build @blue/data package
pnpm --filter @blue/data build

# Run all unit and integration tests in @blue/data
pnpm --filter @blue/data test

# Verify XML roundtrip and pattern layer preservation
pnpm --filter @blue/data test tests/integration/pattern-layer-roundtrip.test.ts
```

**Expected Outcome**: All `@blue/data` test suites pass. No compilation errors occur due to missing types.

---

### 2. Validate Phase 2 (Platform & Standard Library Modernization)

Verify that UUID generation and math utilities produce expected results, and that the settings dropdown renders correctly using `@floating-ui/dom`:

```bash
# Verify UUID format and uniqueness
pnpm --filter @blue/data test src/utilities/uuid.test.ts

# Build main process
pnpm --filter @blue/app build:main

# Run app tests covering settings and host surfaces
pnpm --filter @blue/app test src/renderer/components/settings/RuntimeDeviceField.test.tsx
pnpm --filter @blue/app test src/renderer/components/host-surface/use-host-surface.test.ts
```

**Expected Outcome**: UUIDs conform to RFC 4122 v4 format; `RuntimeDeviceField` dropdown positions accurately without `floating-position-utils.ts`.

---

### 3. Validate Phase 3 (Main Process Architectural Pruning)

Verify that removing Spec 093 diagnostics and flattening domain IPC registration does not break any IPC channels or editor open behavior:

```bash
# Verify main process build
pnpm --filter @blue/app build:main

# Run main process IPC tests
pnpm --filter @blue/app test src/main/ipc/

# Run editor window tests
pnpm --filter @blue/app test src/main/editor-windows/
```

**Expected Outcome**: All main process IPC channels register and dispatch without errors; editor windows open and close cleanly.

---

### 4. Full Repository Regression Validation

Before completing the feature, run the standard repository-wide verification suite:

```bash
# Run all tests across the repository
pnpm test

# Run linter
pnpm lint

# Check for whitespace errors
git diff --check
```

**Expected Outcome**: All tests pass across `@blue/data`, `@blue/app`, `blue-cli`, and `@blue/engine-client`. Zero lint or whitespace errors.
