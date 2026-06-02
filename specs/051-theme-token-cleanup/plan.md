# Implementation Plan: Centralized Renderer Theming

**Branch**: `051-theme-token-cleanup` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/051-theme-token-cleanup/spec.md`

**Note**: This plan incorporates the three concurrent styling reports plus an independent review of the current worktree after GPT54's changes.

## Summary

Centralize renderer theming around a single CSS-first Tailwind theme vocabulary, migrate static renderer colors to named roles, keep utility-first component styling as the default, and document the limited custom CSS/editor boundaries that remain necessary. GPT54 already moved the settings subsystem and generic buttons toward this model; this feature completes the broader renderer migration and adds repeatable audits so future styling drift is caught early.

Current verified review highlights:

- `STYLING_GPT54.md` reflects changes already present in the worktree: settings inline palette styles removed, shared `cn()` helper added, `tailwind.config.mjs` reduced to content only, and generic `.btn` helpers removed.
- `STYLING_REPORT_GLM.md` and `STYLING_REPORT_MIMO.md` correctly identify the remaining renderer-wide drift, but several settings/button findings are stale because they predate GPT54's changes.
- Independent review of the current tree found 208 arbitrary color utility uses in renderer components, 131 raw color literals in `packages/blue-app/src/renderer/styles/index.css`, 213 inline style attributes in renderer components with 46 containing static color-like values, heavy Blue Live inline style usage, and many `text-blue-text` uses without a current `--color-blue-text` alias.
- Custom CSS is not inherently wrong here. Dockview, CodeMirror, Radix attribute selectors, scrollbars, pseudo-elements, workbench rails, mixer/output chrome, BSB tooltips, and animation hooks should keep custom selectors where necessary, but their static palette values should come from named tokens.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer code  
**Primary Dependencies**: Tailwind CSS v4 CSS-first theme tokens, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, Dockview 5.2.0, CodeMirror 6, Radix Context Menu, existing Vite/Vitest renderer tooling  
**Storage**: N/A - renderer styling only; no project XML, localStorage, or settings persistence changes  
**Testing**: Vitest 4.x, `pnpm --filter @blue/app build`, targeted renderer tests where touched, new static theme audit script/check  
**Target Platform**: Electron renderer on desktop  
**Project Type**: Desktop app renderer refactor  
**Performance Goals**: No measurable runtime slowdown; styling migration must not add render-time theme computation in hot score, BSB, mixer, or editor paths  
**Constraints**: Preserve current dark visual identity; avoid behavior changes; keep `@blue/data` untouched and browser-safe; do not introduce light/dark mode; keep dynamic geometry and project-data styles inline where appropriate; preserve Java Blue parity colors unless classified as app chrome  
**Scale/Scope**: Renderer styling surfaces under `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer`, focused on app chrome, panels, dialogs, editor chrome, Blue Live, mixer/output, score/orchestra/BSB UI wrappers, and entry-point shared UI styles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Data-First, UI-Separated**: PASS. This feature is renderer-only and does not move business logic into UI code.
- **Backwards-Compatible Serialization**: PASS. No `.blue` XML, `@blue/data`, or persistence changes are planned.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Java/Jython/Clojure runtime behavior is untouched.
- **Engine as External Process**: PASS. Engine protocol and playback/rendering behavior are untouched.
- **Test-First for Serialization**: N/A. No serialization feature is being ported.
- **Additional constraints**: PASS. No `@blue/data` imports, Node built-ins, dynamic imports, or browser-safety changes are introduced.

## Project Structure

### Documentation (this feature)

```text
specs/051-theme-token-cleanup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── theme-audit-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/
├── packages/blue-app/
│   ├── src/renderer/
│   │   ├── styles/index.css
│   │   ├── lib/cn.ts
│   │   ├── lib/
│   │   ├── main.tsx
│   │   ├── effect-editor.tsx
│   │   └── components/
│   │       ├── settings/
│   │       ├── workbench/
│   │       ├── effect-editor/
│   │       ├── notifications/
│   │       └── welcome/
│   ├── tailwind.config.mjs
│   └── package.json
├── scripts/
└── specs/051-theme-token-cleanup/
```

**Structure Decision**: Keep the implementation in `packages/blue-app` because the feature affects only Electron renderer styling. Add any reusable audit tooling under `/Users/stevenyi/work/blue-electron/scripts` or `packages/blue-app` package scripts, and keep the exception record with the feature documentation unless the implementation promotes it to a long-lived repo policy file.

## Phase 0: Research

Research is complete in [research.md](./research.md). The key decision is to preserve Tailwind v4 `@theme` in `index.css` as the canonical token source, expand it with missing roles, and treat custom CSS as allowed only for documented integration/selector cases with token-backed palette values.

## Phase 1: Design

Design artifacts:

- [data-model.md](./data-model.md) defines Theme Role, Styling Surface, Exception Record, and Validation Check.
- [contracts/theme-audit-contract.md](./contracts/theme-audit-contract.md) defines the audit result and exception-record shape expected from implementation.
- [quickstart.md](./quickstart.md) defines the migration validation workflow.

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. New entities are documentation/audit concepts, not `@blue/data` models.
- **Backwards-Compatible Serialization**: PASS. No serialization artifacts are touched.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Runtime bridge behavior remains unchanged.
- **Engine as External Process**: PASS. No engine integration changes.
- **Test-First for Serialization**: N/A.
- **Additional constraints**: PASS. The implementation remains in renderer and scripts only.

## Complexity Tracking

No constitution violations or extra architectural complexity are required.
