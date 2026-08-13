# Contract: Csound Runtime Discovery IPC

Only runtime I/O discovery crosses renderer IPC. Utility and performance execution remain private Electron-main interfaces.

## Channel

```text
engine-runtime:query-csound-io
```

Preload method:

```ts
queryCsoundIo(request?: CsoundIoQueryRequest): Promise<CsoundIoQueryResult>
```

## Request

```ts
interface CsoundIoQueryRequest {
  enginePathOverride?: string | null;
  csoundLibraryPath?: string | null;
  audioModule?: string | null;
  midiModule?: string | null;
}
```

Normalization:

- missing/null request becomes `{}`;
- whitespace-only values become null;
- engine and Csound library overrides must be absolute when present;
- module names are trimmed, NUL-free, and bounded to the native module field size;
- unknown properties are ignored by normalization and never forwarded as CLI options.

## Result

```ts
type CsoundIoQueryErrorCode =
  | EngineProbeErrorCode
  | 'ENGINE_CAPABILITY_MISSING'
  | 'CSOUND_IO_QUERY_TIMEOUT'
  | 'CSOUND_IO_QUERY_FAILED'
  | 'CSOUND_IO_QUERY_INVALID_JSON'
  | 'CSOUND_MODULE_UNAVAILABLE';

interface CsoundIoQueryResult {
  ok: boolean;
  selection: EngineSelection | null;
  report: CsoundIoReport | null;
  errorCode: CsoundIoQueryErrorCode | null;
  message: string;
  durationMs: number;
}
```

`CsoundIoReport`, modules, devices, and diagnostics follow [data-model.md](../data-model.md).

Consistency rules:

- `ok: true` requires a non-null report, ready Csound status, matching protocol, `csound-io-v1`, and no failing diagnostic for a requested scope.
- `ok: false` may retain a valid report so the UI can show discovered modules alongside a scoped error.
- Empty device arrays with no failing diagnostic are successful.
- Decoder rejects wrong schema, wrong kinds/directions, inconsistent selected modules, invalid channel counts, malformed compatibility reports, and missing required capability.
- Error messages pass through the established bounded/NUL-free diagnostic helper.

## Main Handler

Electron main:

1. normalizes the request;
2. resolves the bundled/development/explicit engine through `EngineRuntimeService`;
3. probes or reuses the matching compatibility report;
4. requires `csound-io-v1`;
5. invokes `--list-io --json` with only validated options;
6. enforces the 3-second deadline and bounded stdout/stderr;
7. strictly decodes stdout;
8. maps exit/report state to `CsoundIoQueryResult`.

No handler mutation touches project state or saves program settings. Saving remains the existing explicit Settings Apply operation.

## Settings Close Confirmation

The native Settings window close event is intercepted while the renderer owns a dirty draft. Main sends `settings:close-request`; the renderer invokes `settings:confirm-close` and resolves the request through `settings:close-response`:

- `yes` applies the current draft and closes only after a successful save;
- `no` closes without saving the draft;
- `cancel` leaves the window open, including when applying the draft fails.

Clean settings close without a dirty draft bypasses the confirmation dialog and resolves as `allow` immediately.

## Renderer Behavior

- Initial “Check Engine and Csound” may request modules without selected device scans.
- Audio refresh sends only `audioModule`; MIDI refresh sends only `midiModule`. The settings page starts one request per selected module, repeats only the affected request after a module change, and maps each rescan button to the corresponding request.
- The UI ignores a response whose selected module no longer matches the current pending settings edit.
- Runtime choices retain exact names as values. Known identifiers may be displayed as a friendly label followed by `(exact-id)` (for example `CoreAudio (auhal)`); unknown identifiers remain raw. If the saved module is not returned, it remains as a clearly marked saved/custom choice.
- New settings use Csound's platform default module, and the selected/default module is listed first even when the runtime returns modules in another order.
- Device controls remain editable and offer discovered entries. Choosing an entry stores `deviceId`, not its display label.
- Failed/empty/stale states are visually distinct and accessible through status text.

## Security Boundary

- Preload exposes no `runUtility`, `runCsound`, executable name, raw CLI flag list, working-directory selector, or process cancellation primitive.
- Renderer strings can select only engine/Csound paths already supported by settings and audio/MIDI module names.
- Electron main builds the final argument array and always uses a non-shell process API.

## Verification

- Shared decoder/normalizer unit tests cover malformed values and zero/error distinctions.
- Preload and main handler tests assert exact channel and argument arrays.
- React tests cover selected-only automatic refreshes, manual rescans, stale response suppression, saved unavailable values, exact identifier selection, empty arrays, and retry after failure.
- A synthetic `C:\Users\Blue User\CsoundLib64.dll` override remains one argument with native separators.
