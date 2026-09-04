# Research: Validated Cleanup First Batch

## Dead Renderer and Script Scope

**Decision**: Delete only `test-csd.js` and the seven renderer components named in the specification. Remove the `BSBWidgetEditor` assertions from the typography source audit while retaining assertions for active BSB surfaces. Preserve historical specs as historical records, but correct current documentation that presents deleted artifacts as active workflows.

**Rationale**: Production reference searches found no consumers of the seven components. `test-csd.js` is absent from package scripts, requires built output directly, invokes a host Csound installation, and hard-codes user and temporary paths. Maintained package tests and fixtures provide portable replacement evidence.

**Alternatives considered**:

- Delete every test-only component found by the original audit: rejected because `EffectLibraryTree`, the workbench BlueX7 wrapper, and `NextNoteBadge` still carry focused behavior coverage and are explicitly protected by the specification.
- Rewrite historical specifications to erase old references: rejected because those files record completed work; only misleading current-workflow claims need correction or a retirement note.

## Score-Object Observer Contract

**Decision**: Remove `score-object-event.ts`, its barrel exports, listener methods from `ScoreObject`, and listener state/firing from `AbstractSoundObject`, `AudioClip`, and `PolyObject` as one atomic contract change. Retain ordinary property assignment, resize, copying, XML, and CSD behavior. Retain unrelated `AudioClip` property-name constants.

**Rationale**: No production or test subscriber calls `addScoreObjectListener`. `AbstractSoundObject` and `AudioClip` fire into empty arrays; `PolyObject` stores listeners but never fires them. The renderer observes canonical snapshots and patches rather than Java Swing listeners.

**Alternatives considered**:

- Keep the public methods as no-ops: rejected because this preserves a misleading contract and dead API.
- Replace the observer mechanism with a new event system: rejected because there is no consumer or requirement.
- Remove adjacent `AudioClip` property constants: deferred because they represent a different unported Java change mechanism and are not necessary to complete this scope.

## Unused Data Models and Public Exports

**Decision**: Delete `ParameterNameManager`, `ParameterTimeManager`, `MixerNode`, and `EffectManager`, remove their `@blue/data` barrel exports, and correct the current README surface list. Retain `GeneratorRegistry` and JMask behavior.

**Rationale**: The four classes have no imports, construction, deserialization ownership, or active production behavior outside their own definitions and barrel exports. Removal intentionally narrows an unused portion of the package surface without changing project persistence.

**Alternatives considered**:

- Keep unused Java mirrors for possible future parity: rejected as speculative maintenance.
- Delete `GeneratorRegistry` by the same name-count heuristic: rejected because the feature explicitly protects it and its surrounding JMask module implements active generator behavior.

## Completed Migration Guard and No-op Lint Stub

**Decision**: Remove only the track-runtime source scanner and its now-unused imports from `scripts/verify.mjs`; preserve all release checks. Remove only the fake `react-hooks` plugin object from `eslint.config.mjs` and do not add a replacement in this feature.

**Rationale**: The scanner enforces a completed migration in every permanent verification run. The lint plugin's sole rule returns an empty visitor and provides no enforcement.

**Alternatives considered**:

- Retain the scanner forever: rejected because it adds permanent repository traversal for a closed migration.
- Adopt the genuine React Hooks plugin now: deferred because it changes lint policy and may create unrelated remediation work.

## Tailwind Vite Integration

**Decision**: Register the already-installed `@tailwindcss/vite` plugin in `packages/blue-app/vite.config.ts`; retain `tailwindcss` and `@import "tailwindcss"`; delete `postcss.config.mjs`; remove direct `@tailwindcss/postcss`, `postcss`, and `autoprefixer` dependencies. Delete the inert content-only `tailwind.config.mjs`, because Tailwind v4 does not auto-detect JavaScript configuration and Vite performs source detection.

**Rationale**: Tailwind's official Vite path uses `tailwindcss` and `@tailwindcss/vite`; v4 handles imports and vendor prefixing through its built-in engine. Keeping the PostCSS file would let Vite discover a second integration and would reference removed dependencies. The current CSS entry and application-owned CSS need no rewrite. See [Tailwind's Vite installation guide](https://tailwindcss.com/docs/installation/using-vite) and [Tailwind CSS v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4).

**Alternatives considered**:

- Keep PostCSS as the active path: valid but rejected in favor of committing to the repository's Vite-native future.
- Run PostCSS and Vite integrations together: rejected as redundant and ambiguous.
- Add an explicit `@config` reference for the legacy content-only configuration: rejected because automatic source detection covers its only purpose.

## Renderer and Package Validation

**Decision**: Verify all six Vite HTML outputs after the renderer build and smoke the main, settings, effect editor, track instrument editor, about, and Dockview popout paths. Keep package-input verifier expansion out of scope unless implementation proves the existing build/quickstart checks cannot reliably cover these outputs.

**Rationale**: Five renderer bootstraps import the shared stylesheet directly; Dockview popouts inherit live panel stylesheets at runtime. A successful main-window build alone is insufficient evidence, but a new permanent verifier is not required to validate a one-time pipeline migration.

**Alternatives considered**:

- Expand `verify-package-inputs.mjs` to require all six renderer outputs: useful future hardening, but deferred to avoid adding permanent machinery during a deletion-focused feature.
- Check only `dist/renderer/index.html`: rejected because it misses secondary entry points and popout behavior.

## AJV Dependency

**Decision**: Remove only the direct `ajv` development dependency from `@blue/app` and regenerate the lockfile. Permit AJV 8 and AJV 6 to remain transitively where Electron Builder and ESLint own them.

**Rationale**: No application source or configuration imports the direct dependency. Removing transitive copies would break tool-owned dependency graphs and is not a meaningful goal.

**Alternatives considered**:

- Force all AJV versions out of the lockfile: rejected because active build and lint tools require them.

## Prettier Workflow and Baseline

**Decision**: Keep Prettier 3; add root `format` and `format:check` commands, stable explicit formatting options, and exclusions for dependency/build outputs, generated content, fixtures, vendored assets, worktrees, release artifacts, and package-manager lockfiles. Correct the README command. Establish formatting in a dedicated baseline change, then add `format:check` to the existing root `lint` command so current PR/develop CI gates it without workflow duplication.

**Rationale**: Prettier is installed but has no repository command, configuration, ignore file, or CI enforcement. A trial check found roughly 2,019 files with drift, proving that setup, baseline formatting, and enforcement must be reviewable separately. Reusing root lint is the smallest cross-platform enforcement path.

**Alternatives considered**:

- Remove Prettier: rejected because the user chose an intentional formatting workflow.
- Add a new CI job or repeat a formatting step in each platform matrix: rejected because existing lint jobs already provide the gate.
- Enable the gate before establishing a baseline: rejected because it knowingly creates an intermediate permanently failing state.
- Format generated, vendored, fixture, example-project, historical research, and dependency output: rejected because these are not application-owned formatting surfaces and would create noisy or unsafe changes.
