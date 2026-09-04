# Data and Configuration Model: Validated Cleanup First Batch

This feature introduces no new project data entity, persistence format, database table, or runtime state. Its relevant model is repository configuration and compatibility boundaries.

## Cleanup Target

- **Identity**: Exact tracked file, exported symbol, or contract member approved for removal.
- **Category**: Manual script, renderer component, observer API, data model, migration guard, lint placeholder, or direct dependency.
- **Consumer state**: Must have zero active production consumers when implementation begins.
- **Compatibility disposition**: Removed intentionally, retained as protected behavior, or deferred after discovering a consumer.

### Validation rules

- A target is deleted only after production, test, dynamic-import, barrel-export, source-audit, and current-documentation references are classified.
- Discovery of an active consumer moves the target to deferred; the implementation must not silently broaden into migrating that consumer.
- Historical specifications may retain references as historical evidence unless they instruct maintainers to use a retired workflow today.

### State transitions

`candidate` → `verified unused` → `removed` → `validated`

`candidate` → `active consumer found` → `deferred`

## Styling Pipeline

- **CSS source**: The existing shared renderer stylesheet and application-owned theme/override rules.
- **Build integration**: Exactly one Tailwind integration, owned by the renderer's Vite configuration.
- **Renderer consumers**: Main, settings, effect editor, track instrument editor, about, and Dockview popout surfaces.
- **Dependencies**: Tailwind and its Vite integration remain direct; the former PostCSS integration and standalone processor/prefixer are removed.

### Validation rules

- Every configured renderer output must build.
- Application-owned CSS and semantic typography roles must remain available.
- Secondary windows and inherited popout styling must be validated, not inferred from the main window.

## Formatting Policy

- **Supported corpus**: Application-owned source, scripts, active documentation, and configuration not covered by exclusions.
- **Excluded corpus**: Dependencies, generated files, fixtures, vendored assets, example projects, build outputs, coverage, releases, worktrees, package-manager lockfiles, and historical research/specification archives.
- **Write operation**: Applies the repository formatting policy to the supported corpus.
- **Check operation**: Reports drift without modifying files.
- **Enforcement state**: `configured` → `baseline established` → `lint-gated`.

### Validation rules

- The check operation must be read-only and fail on a deliberately malformed supported file.
- Both operations must ignore every excluded category.
- The baseline formatting change must contain no intentional semantic edits.

## Compatibility Ownership

- `BlueData` remains the canonical in-memory owner of project state.
- `.blue` XML remains the canonical persisted project format.
- Electron main retains ownership of active documents, filesystem/process work, and external runtimes.
- Renderer styling and repository formatting remain disposable build/development concerns and never enter project data.
