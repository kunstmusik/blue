# Status: Score Timeline Automation Editing

**Date**: 2026-06-30
**Branch**: `052-score-timeline-automation`
**State**: Closed and validated

## Completed Artifacts

- [spec.md](spec.md): Closed user stories and requirements for A button assignment, single-line editing, multi-line editing, persistence, and playback/export.
- [research.md](research.md): Java Blue review for soundObject and audio timeline automation.
- [plan.md](plan.md): Implementation approach and component reuse decisions.
- [data-model.md](data-model.md): Canonical layer assignment, parameter line, target menu, edit mode, and patch entities.
- [contracts/score-timeline-automation-surface.md](contracts/score-timeline-automation-surface.md): Shared snapshot and patch surface, updated to match the implemented nested target-group contract.
- [quickstart.md](quickstart.md): Manual validation scenarios and test commands.
- [tasks.md](tasks.md): 99 completed implementation tasks.
- [checklists/requirements.md](checklists/requirements.md): Requirements quality checklist.

## Delivered Scope

- Implemented Java Blue-style timeline automation assignment for soundObject and audio layers through layer-header A button menus.
- Added shared score snapshot and patch support for assignment ownership, selected parameters, target menus, stale-target cleanup, line colors, point edits, and range transforms.
- Added reusable renderer automation components for headers, menus, overlays, single-line interactions, multi-line selections, and range editing.
- Persisted assigned automation parameter ids, selected layer parameters, line colors, and edited automation points through project save/reload.
- Routed timeline automation edits through the existing project model so playback, render, and export consume the edited parameter lines.

## Review Fixes Applied

- Selected automation line persistence now round-trips for both `SoundLayer` and `AudioLayer` using `automationSelectedIndex` attributes while retaining Java-compatible `parameterId` child entries.
- Canonical `scaleAutomationRange` patches now abort before line mutation when selected score objects or audio clips partially overlap the scaled range boundary, matching Java Blue's multi-line scale guard.
- Positive scale tests now keep selected objects fully contained in the range; crossing-edge behavior is covered by a regression test.
- Contract docs now match the implemented automation target shape: target groups include `subGroups`, and targets do not carry a redundant `path` field.

## Multi-Line Parity Review Fixes

- **Duration scaling** (FR-014): `scaleAutomationRange` scales both start and subjective duration of score objects / audio clips, matching `MultiLineScaleMouseListener.java:185-194`.
- **Layer span**: Multi-line selection includes all polyObject/audio layers in the vertical drag span, not only layers with assigned parameters.
- **Shift-gated object selection**: Score objects / audio clips move or scale only when explicitly selected via shift-drag; `objectIds` carries the explicit selection.
- **Scale overlap-abort**: Scaling aborts if any selected object straddles the selection boundary.
- **Scale minimum-edge clamp**: Selection edges cannot collapse below the Java-style 5px minimum.
- **Ctrl/Cmd snap bypass**: Multi-line move/scale bypasses snap when Ctrl/Cmd is held.
- **Line boundary anchor points**: `Line.processLineForSelectionDrag/Scale` behavior is ported through shared `automation-range-math.ts`.
- **Auto-scroll**: Multi-line drag auto-scrolls near viewport edges.
- **Prev/next wraps**: Parameter selector cycling wraps around.
- **A button gated**: A button renders only on layers that support automation.

## Deferred Items

These Java Blue behaviors are documented for a future slice because they were not required by Spec 052 acceptance scenarios:

- Multi-line copy/cut/delete/paste clipboard operations.
- Single-line alt-click insert on curve value.
- Single-line Ctrl/Cmd+click paste.
- Single-line `EditPointsPopup` context menu with Select Parameter, Edit Points, Reset Line, and BPF import/export actions.

## Validation

- `./.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks` - pass.
- `pnpm --filter @blue/data test -- src/sound-objects/sound-layer-automation.test.ts src/score/audio/audio-layer-automation.test.ts` - pass (`127` files, `1213` tests).
- `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/shared/score-timeline-automation-patches.test.ts src/renderer/tests/score-timeline-automation-multi-line.test.tsx` - pass (`2` files, `34` tests).
- `pnpm test` - pass.
- `pnpm lint` - pass.
- `git diff --cached --check` - pass.
