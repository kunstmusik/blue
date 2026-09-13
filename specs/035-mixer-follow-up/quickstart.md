# Quickstart: Mixer Follow-Up

## Purpose

Manual verification flow for advanced mixer editing and no-save library workflow polish after Spec 034 is in place. Playback-aware and windowing-polish scenarios are intentionally excluded; later specifications own those concerns.

## Preconditions

1. Spec 034 is implemented and the Mixer panel, effects library, and effect editor windows are working.
2. A project is loaded with enough channels and subchannels to exercise routing changes.
3. The effects library session is available from `~/.blue/effectsLibrary.xml` or a supported test fixture override.

## Manual Verification Flow

### 1. Routing validation and advanced chain editing

1. Open the Mixer panel.
2. Attempt to route a channel or send to an invalid self-target.
3. Confirm the UI blocks or warns as designed.
4. Duplicate, copy, paste, and reorder chain entries.
5. Move a compatible entry to another valid strip position.
6. Confirm the resulting chain is correct and invalid moves are rejected cleanly.

### 2. Effects library workflow polish

1. Open the effects library modal.
2. Reorganize categories or effects with drag/drop.
3. Copy or duplicate a selected effect.
4. Import an effect file.
5. Export an effect file.
6. Trigger reload and confirm the app explains that session-local changes will be discarded.
7. Confirm none of these operations implicitly save back to `~/.blue`.

## Suggested Validation Commands

```bash
./.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks
git diff --check
pnpm --filter @blue/app test
pnpm --filter @blue/app build
```

Run `pnpm --filter @blue/data test` if routing validation or clipboard serialization helpers land in `@blue/data`.
