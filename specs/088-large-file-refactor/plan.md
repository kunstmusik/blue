# Implementation Plan: Large File Refactor — Project Store and Main Process

**Branch**: `088-large-file-refactor` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/088-large-file-refactor/spec.md`

## Summary

Refactor the renderer project store and Electron main-process orchestrator behind stable façades while preserving every existing user workflow, IPC/preload contract, state owner, and lifecycle guarantee. The renderer work proceeds through two demonstrated seams only: move the store-independent BSB optimistic snapshot logic behind a deep interface, then move the 100 ms patch queue/revision/dirty/refresh protocol into one injected coordinator. Other cross-domain optimistic reducers remain in `project-store.ts` until a narrow orchestration interface and focused cross-domain oracle exist.

The main-process work starts with a complete IPC and state-write inventory, then introduces a single `ProjectSession` owner for `BlueData`, native project path, revision, and session identity. Domain registrars use one registration scope that rejects duplicate initialization before side effects, rolls back partial registration, and returns an idempotent exact-listener disposer. `main.ts` remains the composition root, keeps pre-ready registration timing and the current explicit normal-shutdown order, and uses a separate reverse-order stack only for failed startup. Each seam is tested and delivered as an independently revertible change, and accepted/deferred decisions are recorded in `docs/modularization.md`.

## Technical Context

**Language/Version**: TypeScript `^5.8.0` in strict mode (workspace currently resolves 5.9.3), Node.js 22, pnpm 10. Electron main/preload compile to CommonJS; the renderer uses ESNext/Vite.

**Primary Dependencies**: Electron 35.7.5 for main lifecycle, windows, and IPC; React 19, Zustand 5, and Sonner 2 in the renderer; `@blue/data` for canonical project models; `@blue/engine-client`, `@blue/java-runtime`, ZeroMQ, and Node host APIs in Electron main. No new dependency is introduced.

**Storage**: No new persistence. `.blue` XML remains canonical and main-owned. Renderer snapshots and the pending-patch queue remain transient. Program settings, unified-library and code-repository SQLite databases, generated CSD/audio artifacts, and runtime sessions retain their existing independent owners and lifetimes.

**Testing**: Vitest 4.1.6 via `packages/blue-app/vitest.config.ts`, focused renderer/main contract suites, source-boundary audits, and `build:main`, `build:preload`, and `build:renderer`. Final gates are `pnpm --filter @blue/app test`, repository-wide `pnpm test`, `pnpm lint`, and `git diff --check`.

**Target Platform**: Electron desktop on macOS arm64, Windows x64, and Linux x64 in PR packaging CI; macOS x64 remains a supported local packaging target.

**Project Type**: pnpm monorepo desktop application; production-source changes are confined to `@blue/app`.

**Performance Goals**: Preserve the exact 100 ms trailing patch-batch delay, FIFO batch boundaries, single in-flight commit, canonical refresh ordering, renderer update timing, startup/shutdown order, and render/playback mutual exclusion. Pure moves add no IPC round trip, deep clone, lazy import, or hot-path wrapper allocation.

**Constraints**: Keep `project-store.ts` and `main.ts` as stable façades/composition points; preserve all channel names, payloads, return values, errors, events, and window targeting; create no second state owner or generic plugin framework; keep native paths native at host APIs; preserve explicit canonical-identity and BSB/external-text conversion boundaries; introduce no cycles.

**Scale/Scope**: Two target files totaling 9,933 lines (`project-store.ts`: 4,916; `main.ts`: 5,017). The process-wide inventory covers 177 IPC registrations/listeners: 112 currently declared by `main.ts` (including three loop-generated score-object test channels) and 65 already owned by unified-library, code-repository, workbench-window, and MIDI modules. The stable project-store specifier has broad renderer/test usage and is not migrated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-research check (2026-08-23): all six PASS, no violations.**

**Post-design re-check (2026-08-23): all six remain PASS, no violations.** The Phase 1 interfaces keep BSB logic renderer-local and host-free; make the patch queue the sole owner of transient batching/revision coordination; make `ProjectSession` the sole writer of active document/path/revision/session identity; preserve normal shutdown independently from reverse startup rollback; require exact listener removal and once-only disposers; and name every native-path, canonical-identity, and external-text conversion boundary. No unresolved clarification or complexity exception remains.

- **Portable data core**: PASS — `@blue/data` is not modified. The BSB snapshot module remains renderer-local and imports no Zustand, React, IPC, Electron, Node built-ins, or host adapters. Project-session and registrar modules stay in Electron main.
- **Java and project compatibility**: PASS — This is structural only. `.blue` loading/saving, raw migration, unknown-data preservation, CSD/render generation, and Java-compatible behavior remain behind the same main-owned `BlueData` document bridge. No intentional divergence or persistence shape change is permitted.
- **Canonical ownership and contracts**: PASS — `ProjectSession` is the single main-process owner of active `BlueData`, native file path, revision, and session identity. The renderer store remains a transient projection; the patch coordinator owns only queue/acknowledgement/dirty/flush state. Existing IPC/preload and renderer façade interfaces remain unchanged.
- **Runtime and engine isolation**: PASS — Filesystem, Electron, Java, process, engine, ZeroMQ, and window dependencies remain in Electron main and are injected at registrar/host-operation seams. The versioned engine client remains the engine boundary; no renderer or data module gains host ownership.
- **Host-path portability**: PASS — `ProjectSession` stores native paths. `project-path.ts` remains the reusable canonical identity seam; `normalizeBsbSelectedPath` remains the explicit forward-slash external-text boundary. Synthetic Windows/UNC path tests and Windows CI remain required; no global slash replacement is introduced.
- **Verification evidence**: PASS — Focused BSB identity/metadata, patch-queue fencing/failure, project-session transition, registrar rollback, startup order, project replacement, IPC, render/freeze, runtime, and shutdown tests run per seam. Main/preload/renderer builds prove typed façade compatibility; repository-wide tests/lint and whitespace checks gate completion.

## Project Structure

### Documentation (this feature)

```text
specs/088-large-file-refactor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── project-store-facade.md
│   ├── bsb-snapshot-reducer.md
│   ├── patch-queue-coordinator.md
│   ├── project-session.md
│   ├── ipc-domain-registrar.md
│   └── main-process-ipc-inventory.md
└── tasks.md                         # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
docs/
└── modularization.md                # Update with second-wave accepted/deferred maps and rollback units

packages/blue-app/src/renderer/
├── stores/
│   ├── project-store.ts             # Stable Zustand façade/composition; existing exports preserved
│   └── project-store/
│       ├── bsb-interface-snapshot.ts # BSB patch implementation + private metadata policy
│       └── project-patch-queue.ts     # Queue/revision/dirty/refresh/scheduling owner
├── components/workbench/panels/score-object/
│   └── score-object-document-reducer.ts # Repoint BSB leaf import; behavior unchanged
└── tests/
    ├── project-store.test.ts         # Retain façade integration; move queue contract cases to direct seam
    └── project-patch-queue.test.ts   # Injected commit/refresh/dirty adapters and fake timers

packages/blue-app/src/main/
├── main.ts                           # Composition root, verification branches, menu/window and explicit lifecycle order
├── project-session.ts                # Sole BlueData/path/revision/session writer
├── project-lifecycle.ts              # Open/new/save/revert/close host orchestration around ProjectSession
├── startup-lifecycle.ts              # Completed-stage rollback stack; not normal-shutdown policy
├── ipc/
│   ├── ipc-registration.ts           # Duplicate guard, partial rollback, exact listener ownership, idempotent disposer
│   ├── project-lifecycle-ipc.ts       # Project/file session + MIDI replacement + missing-audio channels
│   ├── project-artifacts-ipc.ts       # Import/export, CsoundRC, SoundFont, BSB/audio host-file channels
│   ├── playback-runtime-ipc.ts        # Playback/CSD/Blue Live/evaluation/REPL/realtime/render channels
│   ├── project-document-ipc.ts        # Canonical patches, editor windows/documents, score-object tools
│   └── application-ipc.ts             # Confirmation/settings/about/program settings/file manager/window layout
├── unified-library/ipc.ts             # Existing registrar; adopt shared registration scope without channel changes
├── code-repository/ipc.ts              # Existing registrar; adopt shared registration scope without channel changes
├── workbench-window-host.ts             # Preserve owner; registration enters shared lifecycle at composition seam
└── midi-input-coordinator.ts             # Preserve owner; registration enters shared lifecycle at composition seam

packages/blue-app/src/main/
├── project-session.test.ts
├── startup-lifecycle.test.ts
└── ipc/
    ├── ipc-registration.test.ts
    └── *-ipc.test.ts                   # Exact channel-set plus representative behavior/error/broadcast checks
```

**Structure Decision**: Use deep modules at demonstrated seams. `project-store.ts` keeps its import/export façade and delegates BSB transformation and queue coordination; other pure-ish reducer families remain in place because mixer↔track↔orchestra reconciliation does not yet have a narrow interface. `ProjectSession` owns only canonical document identity/fences, while `project-lifecycle.ts` coordinates runtime/editor cleanup around state transitions so the session does not become another god module. Five cohesive main-process registrars replace the current mega registration block without creating one shallow module per channel. All registrars share one internal registration implementation, remain pre-ready, and are invoked in the current global order. Startup rollback is reverse-order; successful normal shutdown retains its separately documented current order. Delivery order is inventory/baseline → BSB seam → patch queue → project session/lifecycle → registration scope/startup rollback → registrars in source order → composition/docs, with one independently revertible change per accepted seam.

## Complexity Tracking

> No constitution violations to justify. The design adds no public package interface, persistence store, dependency, renderer host access, or second lifecycle/state owner.
