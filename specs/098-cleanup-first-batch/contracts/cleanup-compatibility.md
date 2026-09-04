# Cleanup Compatibility Contract

## Removed Surface

Implementation may remove only the artifacts enumerated by FR-001, FR-002, FR-004, FR-005, FR-007, FR-008, FR-010, and FR-011 in [spec.md](../spec.md). Score-object observer removal is atomic across the interface, implementations, event definitions, and exports.

Unknown external consumers of the four explicitly unused `@blue/data` model exports and observer exports are not preserved by compatibility shims. No other `@blue/data` export may be removed under this feature.

## Preserved Surface

- `.blue` XML parsing, migration, unknown-data preservation, and serialization
- CSD generation, playback, rendering, automation, and mixer behavior
- Score-object property mutation, resizing, copying, and editor patch behavior
- Electron main ownership, IPC/preload contracts, Java runtime, engine-client protocol, worker boundaries, settings, and libraries
- Application-owned CSS, semantic typography roles, third-party overrides, all configured renderer windows, and Dockview popout styling
- `EffectLibraryTree`, workbench BlueX7 wrapper, `NextNoteBadge`, and `GeneratorRegistry`
- All permanent release and repository verification checks other than the completed track-runtime source scan

## Deletion Gate

Before each deletion group:

1. Search production, tests, exports, dynamic imports, source-audit reads, and current documentation.
2. Confirm no active consumer exists.
3. If an active consumer is found, defer that target rather than migrate or delete the consumer without a specification amendment.
4. Preserve behavior tests that cover active surfaces; retarget an audit only when the same requirement belongs to an active replacement.

## Styling Gate

- Exactly one Tailwind integration may be active after migration.
- The shared stylesheet import remains canonical.
- All six configured HTML outputs must exist after a production renderer build.
- Main and secondary application windows plus Dockview popouts must show no material styling regression.

## Formatting Gate

- Formatting setup and baseline output remain distinct from semantic cleanup.
- The check command is read-only and deterministic on supported platforms.
- Enforcement enters the existing lint gate only after the baseline passes.
- Excluded generated, vendored, fixture, example-project, output, release, worktree, and lockfile content must not change during formatting.

## Rollback

Each implementation slice must remain independently revertible: behavioral cleanup, styling/dependency migration, formatter setup/baseline, and enforcement. Reverting one slice must not require restoring unrelated deleted code or changing project data.
