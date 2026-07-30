# Project Status - blue-electron

**Date**: 2026-07-29
**Branch**: `064-bundle-blue-engine`
**Current Focus**: Spec 064 Closed

## Summary

Spec 064 is closed. Blue Engine is now ordinary source in the monorepo, built
through the root pnpm graph, and bundled with development and packaged
applications. Csound 7 remains runtime-loaded so Blue can start, open, edit,
and save projects without Csound or a system-installed Blue Engine.

Key outcomes:

- **Atomic source and build**: `native/blue-engine` is a private pnpm workspace
  package with pinned vcpkg inputs and a deterministic verified artifact.
- **Static native dependencies**: ZeroMQ and libsodium are linked into the
  engine; only documented operating-system runtimes remain load-time
  dependencies. Csound is the deliberate runtime-loaded exception.
- **Deterministic resolution**: packaged applications use
  `resources/assets/engine`, while
  `pnpm --filter @blue/app run dev` uses the verified current-checkout artifact
  without searching `PATH`.
- **Recoverable compatibility**: a side-effect-free probe and protocol
  capability handshake report missing, unsupported, or mismatched engine and
  Csound states without mutating the project.
- **Cross-platform packaging**: macOS arm64, Windows x64, and Linux x64 package
  jobs pass; one AppImage also passes Debian Bookworm, Arch Linux, and Fedora
  41 direct/extracted verification without FUSE 2.

## Current Artifacts

- `.specify/feature.json` points to `specs/064-bundle-blue-engine`.
- `specs/064-bundle-blue-engine/spec.md` is closed.
- `specs/064-bundle-blue-engine/plan.md`, `research.md`, `data-model.md`, and
  `contracts/` record the implemented design and runtime boundaries.
- `specs/064-bundle-blue-engine/tasks.md` has all 60 tasks marked complete.
- `specs/064-bundle-blue-engine/quickstart.md` records local, hosted
  cross-platform, AppImage, and scoped release-gate evidence.
- `AGENTS.md`, `README.md`, `docs/release-guide.md`, and
  `native/blue-engine/README.md` describe monorepo ownership and release use.

## Validation Performed

- Root `pnpm build`, test, lint, verify, package-input, and release-manifest
  gates pass.
- Native Release and Debug builds pass all non-Csound CTest cases; profiling
  is verified as fully compiled out of the default build.
- macOS arm64 Csound 7 probe, null-audio integration, packaged no-Csound
  project safety, static dependency closure, and shared-memory boundary checks
  pass.
- [PR run 30510157369](https://github.com/kunstmusik/blue-electron-poc/actions/runs/30510157369)
  passes macOS arm64, Windows x64, and Linux x64 build/test/package/smoke jobs
  at `0627b172eb0962b9455c2c61a7cb0c2030d25df7`.
- [AppImage Compatibility run 30510157344](https://github.com/kunstmusik/blue-electron-poc/actions/runs/30510157344)
  passes Debian, Arch, and Fedora jobs for the same Linux artifact.

## Release Gates

- Current PR, develop, and stable workflows intentionally produce unsigned
  artifacts. If signing is enabled in a future release, validate the nested
  engine entitlement in the signed/notarized macOS package.
- Run clean-machine Csound 7 playback checks on matching Windows and Linux
  release candidates before announcing a stable release.
- macOS x64 remains a future matrix addition; the source, triplet, and
  packaging layout support adding it without restructuring.

## Next Recommended Step

Merge Spec 064 after review. Treat signing/notarization and clean-machine
release playback as release-candidate validation, not remaining feature
implementation.
