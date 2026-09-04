# Feature Specification: Validated Cleanup First Batch

**Feature Branch**: `098-cleanup-first-batch`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Apply the reviewed first cleanup batch: remove confirmed dead code and obsolete migration enforcement, migrate Tailwind CSS v4 to its Vite integration, remove unused dependencies, and establish an intentional Prettier workflow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preserve Blue While Removing Dead Code (Priority: P1)

As a Blue user, I continue to open, edit, play, render, save, and reopen projects with no behavior or data changes after obsolete components, observer infrastructure, data-model classes, and migration-only checks are removed.

**Why this priority**: Simplification is valuable only when established project behavior and compatibility remain intact.

**Independent Test**: Load representative current and legacy projects, exercise editing and playback workflows, save and reopen them, and confirm that project data, generated output, and visible behavior remain unchanged.

**Acceptance Scenarios**:

1. **Given** a representative current or legacy project, **When** a user opens, edits, saves, and reopens it, **Then** all modeled and unknown project data is preserved.
2. **Given** a project that uses score objects, automation, mixer data, or BlueSynthBuilder instruments, **When** the project is played or rendered, **Then** its observable output matches the pre-cleanup baseline.
3. **Given** the application test and verification suites, **When** they run after the cleanup, **Then** no remaining production or test code depends on the removed artifacts.

---

### User Story 2 - Use One Supported Styling Pipeline (Priority: P2)

As a maintainer, I have one clearly configured styling pipeline for the Vite-built renderer, without redundant CSS processors or unused integration packages.

**Why this priority**: A single supported integration reduces dependency and configuration ambiguity while retaining all application styling.

**Independent Test**: Build and package every renderer entry point and compare representative application windows against the pre-migration appearance and behavior.

**Acceptance Scenarios**:

1. **Given** the current application theme and component styles, **When** all renderer entry points are built through the Vite integration, **Then** required utilities, theme variables, third-party overrides, animations, scrollbars, and pseudo-elements remain present.
2. **Given** main, settings, editor, about, and popout windows, **When** each is opened from a production build, **Then** its layout, typography, colors, and interactive states show no material regression.
3. **Given** the application dependency manifest, **When** the styling migration is complete, **Then** only the selected Vite-based Tailwind integration and its required packages remain.

---

### User Story 3 - Make Formatting Intentional (Priority: P3)

As a contributor, I can format supported repository files and verify formatting consistently using documented project commands, while generated, vendored, fixture, and build-output content remains untouched.

**Why this priority**: Keeping a formatter is justified only when contributors and automation can use a predictable, bounded workflow.

**Independent Test**: Run the formatting check on a clean repository, introduce a deliberately misformatted supported file to confirm failure, then format it and confirm the check passes without modifying excluded content.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** a contributor runs the formatting check, **Then** it completes successfully without changing files.
2. **Given** a supported source or documentation file with formatting drift, **When** the formatting check runs, **Then** it reports the drift and exits unsuccessfully.
3. **Given** generated, vendored, fixture, release, or build-output content, **When** repository formatting runs, **Then** that content is excluded.

### Edge Cases

- A legacy project contains XML associated with a removed TypeScript model class; its data must not be silently discarded if another active model owns or preserves that XML.
- A supposedly dead component is still imported dynamically, referenced by a test fixture, or named by a source-audit script; all such references must be resolved deliberately rather than left broken.
- Score-object listener methods are part of a public contract even though no production listener subscribes; removal must cover implementations, interfaces, exports, and tests as one consistent change.
- Styling generated for secondary Electron windows differs from the main renderer entry point; every configured renderer entry must be checked.
- Formatting a repository for the first time could produce a large unrelated diff; formatter setup and repository-wide reformatting must remain separable and reviewable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST remove the unwired, machine-specific `test-csd.js` utility and update references that incorrectly present it as an active validation path.
- **FR-002**: The repository MUST remove the production-unconsumed `SnapGridOverlay`, `BSBWidgetEditor`, `ProjectTextEditorPanel`, `BSBOpcodeListEditor`, `ScorePathBar`, `InstrumentNameField`, and `DeferredOpcodeListPanel` components, together with references whose only purpose was to cover those obsolete surfaces.
- **FR-003**: The cleanup MUST NOT remove `EffectLibraryTree`, the workbench BlueX7 editor wrapper, or `NextNoteBadge` as part of this feature.
- **FR-004**: The repository MUST remove the unused score-object observer mechanism from every participating production implementation, public contract, export, and affected test while preserving all score-object mutation behavior.
- **FR-005**: The repository MUST remove the unused `ParameterNameManager`, `ParameterTimeManager`, `MixerNode`, and `EffectManager` model classes and their exports, tests, and misleading documentation references.
- **FR-006**: The cleanup MUST retain `GeneratorRegistry` and all active JMask generator behavior.
- **FR-007**: The permanent repository verifier MUST no longer scan for the completed track-runtime migration, while all unrelated release and repository checks remain active.
- **FR-008**: The repository MUST remove the no-op React Hooks lint rule stub without representing that removal as equivalent to adopting real React Hooks lint enforcement.
- **FR-009**: The renderer styling pipeline MUST use the supported Tailwind CSS v4 Vite integration as its sole Tailwind build integration.
- **FR-010**: The former Tailwind PostCSS integration, standalone PostCSS dependency, and standalone Autoprefixer dependency MUST be removed after equivalent styling output is verified.
- **FR-011**: The unused direct `ajv` dependency MUST be removed without disturbing transitive consumers that manage their own dependency.
- **FR-012**: Prettier MUST be retained as an intentional repository tool with one command that writes formatting changes and one command that checks formatting without writing.
- **FR-013**: The formatting workflow MUST exclude generated, vendored, fixture, dependency, build-output, coverage, release, and worktree content.
- **FR-014**: Initial repository-wide formatting MUST be isolated from behavioral cleanup so reviewers can distinguish formatting-only changes from functional changes.
- **FR-015**: The feature MUST preserve all supported application windows, application-owned styling, project serialization, generated CSD, playback, rendering, libraries, and public package behavior not explicitly identified for removal.
- **FR-016**: Validation MUST begin with affected package checks and include the full repository tests, lint checks, production renderer build, main-process build, packaging input checks, and whitespace validation before completion.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: The current `develop` behavior and its automated fixtures are the baseline. Java Blue remains the reference for `.blue` XML, generated CSD, score-object behavior, mixer semantics, and legacy project compatibility.
- **Compatibility Requirements**: Existing projects must load and save without loss; playback and rendered output must remain equivalent; every application window must retain its established visual presentation; public package behavior outside the explicitly removed unused exports must remain stable.
- **Intentional Divergences**: The named dead components, unused observer API, four unused data-model exports, completed migration check, no-op lint stub, obsolete build integration, and unused dependency are intentionally removed. No user-visible behavioral divergence is intended.
- **State Ownership**: `BlueData` remains the canonical in-memory project owner and `.blue` XML remains the canonical project format. The Electron main process continues to own active documents and host services. Styling and formatting configuration are repository tooling and do not enter project data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All seven named obsolete renderer components, the four named unused model classes, `test-csd.js`, and the unused observer mechanism have zero remaining production references after removal.
- **SC-002**: One Tailwind build integration remains, and the three superseded styling packages plus the unused direct `ajv` dependency are absent from direct dependency manifests and the regenerated lockfile except where required transitively.
- **SC-003**: All configured renderer windows complete a production-build smoke test with no material visual or interaction regression from the pre-migration baseline.
- **SC-004**: Representative current and legacy projects complete load, edit, save, reopen, playback, and render checks with zero lost project data and no changed generated output attributable to the cleanup.
- **SC-005**: The formatting check passes on the agreed baseline, detects a deliberately misformatted supported file, and ignores 100% of the excluded content categories.
- **SC-006**: All affected-package checks and the full repository verification suite complete successfully with zero new failures and zero whitespace errors.
- **SC-007**: Reviewers can inspect behavioral cleanup, styling-pipeline migration, formatter setup, and any repository-wide formatting as distinct change sets with no mixed mass-formatting noise in behavioral changes.

## Assumptions

- Static and dynamic reference searches confirm the named removal targets remain unused when implementation begins; any newly discovered active consumer removes that target from mechanical deletion until its behavior is understood.
- The existing test suite and representative project fixtures provide the baseline for project compatibility and generated output.
- The Tailwind Vite integration supports every renderer entry point configured by the application build.
- The first formatting baseline may require a repository-wide formatting change, but that change will not be mixed with functional cleanup.
- Adding genuine React Hooks lint enforcement is outside this feature; only the current no-op placeholder is removed.
- No broader component consolidation, store-action pruning, IPC redesign, worker removal, public barrel reduction, or typography-linter rewrite is included.
