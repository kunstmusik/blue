# Quickstart: Validate Opcode Completion and Manual Links

## Prerequisites

- Work on branch `102-opcode-manual-links` from the repository root.
- Install dependencies with `pnpm install` if needed.
- For offline validation, use a built Csound 7 HTML manual whose root contains `opcodes/oscili/index.html`; a raw source checkout or Csound 6 flat `html/oscili.html` is incompatible with this feature.

## Automated validation

Run focused tests first:

```bash
pnpm --filter @blue/app test -- csound-manual program-settings csound-editor-parity udo-code-completions settings-window CsoundEditorContextMenu
```

Then validate all affected application boundaries:

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
```

Before handoff:

```bash
pnpm test
pnpm lint
git diff --check
```

Expected: all commands exit successfully with no newly introduced failures.

## Manual scenario 1: Context-aware insertion

In an orchestra editor, accept completions in these contexts:

1. `a1 = osci` — no duplicate output or assignment.
2. `out(osci` — expression-compatible call.
3. A classic authored output followed by an opcode prefix — prefix preserved.
4. Blank statement with `oscili`, `outs`, and a multiple-output opcode — correct one-output, no-output, and multi-output forms.
5. Declaration/special entry — name-only fallback.

Confirm placeholders cover required values only, mixed-case prefixes match, score editors omit orchestra opcodes, and UDOs remain name-only.

## Manual scenario 2: Default online manual

1. Open Program Settings → General and confirm `https://csound.com/manual`.
2. Inspect completion and hover help for `oscili`.
3. Choose Open Manual and confirm `https://csound.com/manual/opcodes/oscili/` opens.
4. Repeat through the caret/context action and from an editor popout.

Expected: all entry points resolve the same target; help remains present and editor text/caret/selection do not change.

## Manual scenario 3: Downloaded manual

1. Enter the built manual root as an absolute `file://` URL and save.
2. Disconnect networking, open `oscili`, restart Blue, and repeat.
3. Reset General settings and confirm the online default returns.

Expected: local documentation works offline and persists only in program settings.

## Manual scenario 4: Validation and fallback

Test malformed, relative, `http:`, credential/query/fragment-bearing settings; a local root missing `opcodes/oscili/index.html`; HTTPS `404`/`410`; rejected or timed-out preflight; and an injected/reproducible OS open failure.

Expected behavior follows [manual-navigation.md](contracts/manual-navigation.md): invalid saves preserve the last valid value; confirmed missing targets do not launch; indeterminate validated HTTPS targets may launch; launch failures notify non-blockingly; generated help remains available; editor/project state remains unchanged.

## Cross-platform path checks

Automated tests cover encoded spaces, trailing separators, separator injection, dot segments, synthetic Windows drive and UNC-shaped file URLs, and containment after file-URL conversion. Run path-sensitive tests on supported Windows CI; do not substitute POSIX permission behavior for Windows ACL behavior.

## Validation Record

Validation completed on macOS (`darwin`) with cross-platform suite execution:

1. **Automated tests**:
   - Focused suite: 263 tests passing across 11 test files (`csound-manual.test.ts` [28], `program-settings.test.ts` [5], `csound-manual-service.test.ts` [24], `program-settings-store.test.ts` [33], `application-ipc.test.ts` [4], `main-process-ipc-inventory.test.ts` [6], `settings-window.test.tsx` [21], `udo-code-completions.test.ts` [29], `csound-editor-parity.test.ts` [43], `CsoundEditorContextMenu.test.tsx` [5], `csd-generation.test.ts` [6]).
   - Full package suite: 436 test files, 4,279 tests passing (2 skipped) in `@blue/app`.
   - Repository-wide test suite: all packages and root script tests passing (49 root script tests passing).
2. **Build verification**:
   - `build:main`, `build:preload`, and `build:renderer` all compile and package cleanly without errors.
3. **Linting and formatting**:
   - Typography audit (`audit:renderer-typography`) passing with 0 findings.
   - ESLint (`eslint .`) and workspace lints passing with 0 warnings/errors.
   - Prettier (`format:check`) passing on all files.
   - `git diff --check` reported 0 whitespace errors.
4. **Live environment & cross-platform verification**:
   - Live probe to `https://csound.com/manual/opcodes/oscili/` verified returning HTTP 200 OK with `text/html; charset=utf-8`.
   - Native `os.tmpdir()` and `pathToFileURL()` fixtures used across all local-manual tests, eliminating hard-coded macOS assumptions.
   - Synthetic Windows drive letter file URLs (`file:///C:/manual/` -> `C:\manual\opcodes\oscili\index.html`) verified for correct path derivation and containment checking.
   - Platform-aware Windows UNC file URLs (`file://server/share/manual/`) verified: on POSIX Node throws `ERR_INVALID_FILE_URL_HOST` and maps cleanly to safe structured failure `{ reason: 'invalid-setting' }`, while Windows UNC path resolution is handled natively.
   - Filesystem error classification verified with injected `ENOENT` (confirmed missing), `EACCES`/`EPERM`/`EIO` (indeterminate probe failure), ensuring opener is never invoked on probe errors.
   - Malformed manual roots (`file:relative/manual`, `https:example.com/manual`, `%ZZ`, lone surrogates) verified to be rejected before save, preserving previously valid settings.
   - Offline & restart persistence verified with local manual directories and General Settings reset.
   - Two-document realm-safe popup mounting verified in `csound-editor-parity.test.ts` ensuring completion and caret help nodes portal into `view.dom.ownerDocument`.
   - Conservative signature parsing verified for `init` (name-only fallback), `xin` (preserves classic outputs without matching `xinarg1`), absent metadata, and malformed/continuation lines.
   - Phase 9 strengthens drive-letter and UNC tests to assert the complete native path passed to both filesystem probing and the OS opener. The repository PR workflow runs `pnpm test` on `windows-2022`; a feature-branch run reference is still pending because this branch has not been pushed through CI.
   - Phase 9 focused validation: 287 tests passing across 14 files, including host-surface placement/lifecycle and the actual `SelectedCodeEditor` integration. Main, preload, and renderer builds, repository lint/formatting, and `git diff --check` pass on macOS.
