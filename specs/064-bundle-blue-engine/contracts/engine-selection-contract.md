# Contract: Engine Selection, Probe IPC, and Session Startup

## Selection Precedence

Electron main resolves an executable in this order:

1. Non-empty `BLUE_ENGINE_PATH` environment override for development/test use
2. Absolute `program-settings.json` `appSpecific.enginePath` when it is neither empty nor the legacy sentinel `blue-engine`
3. Installed application resource `resources/assets/engine/blue-engine[.exe]`
4. Monorepo development artifact `native/blue-engine/dist/<platform>-<arch>/blue-engine[.exe]`

There is no implicit executable search-path or `/usr/local/bin` fallback. Every selected path is absolute before spawn.

Selection validation checks regular-file status, platform executable suffix, Unix execute permission, artifact metadata when present, and current process architecture. Invalid explicit overrides produce a recoverable error and are never silently replaced by the bundled engine for that request.

## Development Startup Contract

`pnpm --filter @blue/app run dev` uses the development selection above when there is no explicit override. The command MUST have a build dependency on the current-platform `@blue/engine-native` artifact, and the resolver MUST select:

```text
native/blue-engine/dist/<platform>-<arch>/blue-engine[.exe]
```

The development application remains independent of system installation state. Tests run with `blue-engine` absent from `/usr/local/bin` and removed from the test `PATH`; they fail if resolution attempts an executable-search-path fallback. If the workspace artifact is absent or invalid, startup or the first engine-backed operation reports an actionable workspace-build error.

## Existing Setting Compatibility

`appSpecific.enginePath` remains the durable override field:

- `""` and `"blue-engine"` mean “use bundled/default”.
- An absolute path means “use this external engine”.
- A relative non-sentinel path is invalid.

No program-settings version bump is required. Existing `"blue-engine"` values migrate semantically through normalization at read/use time; the stored file need not be rewritten.

## Main Runtime Service

`packages/blue-app/src/main/engine-runtime.ts` owns:

- selection resolution
- artifact validation
- probe subprocess execution and timeout
- protocol comparison
- current immutable selection supplied to realtime and Blue Live sessions
- structured error mapping

It does not own project data and does not persist probe results.

## Probe IPC

Channel:

```text
engine-runtime:probe
```

Request:

```ts
interface EngineProbeRequest {
  enginePathOverride?: string | null;
  csoundLibraryPath?: string | null;
}
```

Response:

```ts
interface EngineProbeResult {
  ok: boolean;
  selection: {
    source: 'environment-override' | 'settings-override' | 'bundled' | 'development';
    executablePath: string;
  } | null;
  report: EngineCompatibilityReport | null;
  errorCode:
    | 'ENGINE_NOT_FOUND'
    | 'ENGINE_NOT_EXECUTABLE'
    | 'ENGINE_ARCH_MISMATCH'
    | 'ENGINE_PROBE_TIMEOUT'
    | 'ENGINE_PROBE_FAILED'
    | 'ENGINE_PROBE_INVALID_JSON'
    | 'ENGINE_PROTOCOL_MISMATCH'
    | 'CSOUND_UNAVAILABLE'
    | null;
  message: string;
  durationMs: number;
}
```

Preload exposes:

```ts
probeEngineRuntime(request?: EngineProbeRequest): Promise<EngineProbeResult>
```

Validation:

- Main accepts only null/undefined or trimmed strings.
- An override must be absolute.
- A Csound library override must be absolute.
- Probe timeout is 3000 ms and terminates the child.
- stdout size is bounded and must decode as exactly one report object.
- stderr is bounded and included only in sanitized diagnostics.

## Session Startup

Realtime and Blue Live receive the same resolver/service dependency but maintain separate engine processes, endpoints, and process-registry records.

For each new process:

1. Resolve or use the current immutable selection.
2. Probe when there is no current successful report for the same executable hash/path, or when the user explicitly requests retry.
3. Spawn the selected engine with an absolute path.
4. Connect `EngineClient`.
5. Request `GET_CAPABILITIES`.
6. Reject and tear down on protocol mismatch.
7. Continue existing create/compile/start behavior.

Failures emit the existing playback/Blue Live error status with the structured diagnostic message. They do not close, mutate, or save the project.

## Settings UI

The Realtime Render settings panel displays:

- “Bundled Blue Engine” when the durable path is empty or `blue-engine`
- an external path field for an explicit override
- a “Check Engine and Csound” action
- the selected source, engine/protocol version, Csound path/version, and structured error
- a retry action that always launches a fresh probe

Changing the path follows the existing Apply/Cancel program-settings workflow. Probe reports are local component state and are not saved.
