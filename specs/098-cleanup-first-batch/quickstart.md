# Quickstart: Validate the Cleanup First Batch

Run commands from the repository root on branch `098-cleanup-first-batch`.

## 1. Install and Inspect Dependencies

```bash
pnpm install --frozen-lockfile
pnpm --filter @blue/app why ajv
pnpm why ajv
```

Expected:

- The app importer has no direct `ajv`, `@tailwindcss/postcss`, `postcss`, or `autoprefixer` dependency.
- `tailwindcss` and `@tailwindcss/vite` remain direct app development dependencies.
- Tool-owned transitive AJV versions may remain.

## 2. Verify Removal and Protection Boundaries

```bash
rg -n "ScoreObjectListener|ScoreObjectEvent|ScoreEventType|addScoreObjectListener|removeScoreObjectListener|ParameterNameManager|ParameterTimeManager|MixerNode|EffectManager" packages
rg -n "SnapGridOverlay|BSBWidgetEditor|ProjectTextEditorPanel|BSBOpcodeListEditor|ScorePathBar|InstrumentNameField|DeferredOpcodeListPanel" packages
test ! -e test-csd.js
test -e packages/blue-app/src/renderer/components/workbench/panels/effects-library/EffectLibraryTree.tsx
test -e packages/blue-app/src/renderer/components/workbench/panels/orchestra/BlueX7Editor.tsx
test -e packages/blue-app/src/renderer/components/instruments/blue-x7/next-note-badge.tsx
rg -n "class GeneratorRegistry" packages/blue-data/src/sound-objects/jmask-support.ts
```

Expected: removal searches have no active package hits; each protected artifact remains. Historical `specs/` and `research/` references are not deletion failures.

## 3. Run Focused Compatibility Checks

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/data build
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:renderer
```

Expected: all commands pass. Maintained round-trip, Track/AudioClip, score-object, mixer, automation, and CSD tests remain the compatibility evidence replacing `test-csd.js`.

## 4. Inspect Renderer Outputs

```bash
for entry in index settings effect-editor track-instrument-editor about popout; do
  test -f "packages/blue-app/dist/renderer/${entry}.html"
done
find packages/blue-app/dist/renderer -type f -name '*.css' -print
```

Expected: all six HTML files and generated CSS exist.

From the production build, smoke-test:

- Main workbench
- Settings window
- Effect editor
- Track instrument editor
- About window
- Dockview popout containing a styled panel and popup interaction

Confirm layout, semantic typography, theme variables, third-party overrides, interactive states, and popout styling match the pre-migration baseline.

## 5. Verify Formatting Behavior

```bash
pnpm format:check
```

Expected: the clean baseline passes without modifying files.

To validate failure and recovery, create one temporary malformed supported text file, confirm `pnpm format:check` fails, run `pnpm format`, and confirm the check passes. Remove the temporary file afterward. Repeat with a temporary file under one excluded fixture/generated directory and confirm formatting leaves it untouched.

Inspect the dedicated baseline commit:

```bash
git show --stat --oneline HEAD
git diff HEAD^ -- . ':!*.md'
```

Expected: the formatting baseline is isolated from intentional behavioral or dependency edits.

## 6. Run Full Repository Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm verify
git diff --check
```

Expected: all required checks pass with no new failures or whitespace errors. Cross-platform PR packaging must subsequently pass on macOS arm64, Windows x64, and Linux x64.
