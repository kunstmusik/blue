# Contract: Main-Owned Csound Runtime and Caller Adapters

## EngineRuntimeService Surface

The existing main-owned `EngineRuntimeService` gains two deep operations in addition to `resolve()` and `probe()`:

```ts
queryCsoundIo(request?: CsoundIoQueryRequest): Promise<CsoundIoQueryResult>

executeCsound(
  request: CsoundExecutionRequest,
  hooks?: {
    signal?: AbortSignal;
    onOutput?: (text: string, source: 'stdout' | 'stderr') => void;
  },
): Promise<CsoundExecutionResult>
```

The public surface does not accept an engine executable. Resolution is always internal and follows existing precedence:

1. `BLUE_ENGINE_PATH` environment override;
2. explicit/saved absolute external-engine override;
3. packaged engine artifact; or
4. current workspace artifact in development.

The optional Csound library path comes from a request override or saved `appSpecific.csoundLibraryPath`, and must be absolute.

## Execution Dispatch

`CsoundExecutionRequest` is the discriminated union in [data-model.md](../data-model.md).

| Kind | Required capability | Native mode |
|---|---|---|
| `utility` | `csound-utility-v1` | `--run-utility <name> ... -- <args>` |
| `performance` | `csound-performance-v1` | `--run-csound ... -- <args>` |

Rules:

- Resolve and capability-check before spawning the execution child.
- Use `spawn` with `shell: false`, `windowsHide: true`, explicit absolute `cwd`, ignored stdin, and piped stdout/stderr.
- Stream chunks immediately to `onOutput`.
- Retain at most 1 MiB per output stream for the terminal result; append a truncation diagnostic when exceeded.
- Abort terminates only the matching child and makes `cancelled` authoritative even if close races with exit code zero.
- Process start errors, signals, and nonzero exits become typed terminal results; no raw process error crosses IPC.
- Each call uses a distinct child and listeners are removed after completion.

## Caller Execution Seam

Existing focused callers keep an injectable seam with no executable argument:

```ts
interface CsoundPerformanceSeam {
  runCsound(
    args: string[],
    cwd: string,
    onProgress?: (progress: number) => void,
    totalDuration?: number,
  ): Promise<{ exitCode: number; stderr: string; stdout: string; cancelled: boolean }>;
}
```

The production adapter calls `executeCsound({ kind: 'performance', ... })`. Unit tests continue to inject an in-memory fake.

## Disk Render Migration

- `DiskCommandPlan` retains `mode`, `args`, and `outputPath`; `executable` is removed.
- Complete-override tokenization, output extraction, format/message flags, project advanced options, generated CSD path, progress parsing, output existence checks, and post-render play/open behavior remain unchanged.
- `createCsoundExecutionSeam` is replaced by an engine-runtime adapter. `activeRenderProcess` becomes an operation-owned abort controller/cancel function rather than a raw child process.
- Cancellation followed by an exit code of zero still returns cancelled; output validation cannot change it to completed.

## Freeze Migration

- `FreezeCommandInputs` removes `csoundExecutable`; `freezeFlags`, output path, and CSD path remain separate arguments.
- Existing project-save requirement, filename allocation, staged project mutation, cleanup, audio metadata/format validation, and reference-count deletion remain unchanged.
- Failure or cancellation removes the candidate output and does not replace the source object.

## SoundFont Migration

- `inspectSoundFont()` removes the executable parameter and “set Utility executable” validation.
- The generated probe CSD and its Csound-embedded SoundFont path normalization remain unchanged.
- `['-n', csdPath]` executes through the performance service in the temporary directory.
- Csound messages may arrive on stderr; the parser continues to consume the combined bounded output.
- Temporary directories are removed on success, failure, and cancellation.

## Utility Service Contract

No initial renderer UI is required. Trusted main workflows may execute:

```ts
executeCsound({
  kind: 'utility',
  operationId,
  utilityName,
  args,
  cwd,
  csoundLibraryPath,
})
```

This contract is the only supported way to add future Csound utility-backed features. New direct `spawn(csoundExecutable, ...)`, shell `-U`, or raw renderer execution IPC violates the feature contract.

## Program Settings Contract

- `PROGRAM_SETTINGS_VERSION` becomes `3`.
- `appSpecific.csoundLibraryPath` is `""` for auto-detect or an absolute path.
- Version-2 migration preserves all prior fields and adds only the new default.
- Legacy Csound executable and render-method fields remain serialized/merged for downgrade safety but are hidden and unused.
- Usage matrix entries identify the old fields as retained rather than blocked/active; the new library path and runtime module/device consumers are marked used.

## Concurrency and Ownership

- Existing realtime and Blue Live engine processes continue through their separate ZMQ sessions.
- The existing render/freeze mutual exclusion remains in main.
- SoundFont and future utilities have their own operation identities; cancellation never uses a global “kill any engine” action.
- App shutdown may terminate all main-owned child operations through the existing process cleanup path.
- No runtime result is persisted to `.blue` XML or written into canonical `BlueData`.

## Regression Boundary

Completion requires evidence that production paths contain no direct Csound executable launch for:

- disk rendering;
- score-object freezing;
- SoundFont inspection; or
- Csound utilities.

External play/open commands after disk rendering are intentionally not Csound operations and remain outside this prohibition.
