# Contract: Maximum Freeze Jobs Setting

Settings-layer contract for `utility.freezeMaxJobs`. Field schema and lifecycle
follow the established bounded-numeric pattern in
`packages/blue-app/src/shared/program-settings.ts` (cf. `appSpecific.appZoomPercent`,
`general.directoryTempFileLimit`). Spec: [085-parallel-freeze](../spec.md).

## Field

| Property | Value |
|----------|-------|
| Snapshot path | `ProgramSettingsSnapshot.utility.freezeMaxJobs` |
| Type | integer |
| Default | 4 — `FREEZE_MAX_JOBS_DEFAULT` |
| Range | 1–32 inclusive — `FREEZE_MAX_JOBS_MIN`, `FREEZE_MAX_JOBS_MAX` |
| Panel | Utility (alongside Csound Executable and Freeze Flags) |
| Persistence | App-wide program-settings JSON via the existing atomic save path |
| Parity status | blue-electron extension; no Java Blue counterpart (Java freezes sequentially) — recorded in the program-settings usage/parity matrix |

## Normalization (`normalizeFreezeMaxJobs`)

Applied by `mergeWithDefaults` when loading settings:

- missing, `null`, non-finite, non-integer, below 1, or above 32 → 4 (FR-003: any invalid saved value loads as the default)
- The normalized value is used in memory; the file is rewritten only on the next explicit save.

## Validation (`validateProgramSettings`)

- Emits `{ path: 'utility.freezeMaxJobs', severity: 'error', message: 'Must be an integer between 1 and 32' }` for non-integer or out-of-range values.
- The settings save path blocks on error issues (existing behavior), so invalid UI input cannot persist.

## UI

- Numeric input in `UtilitySettings.tsx`: min 1, max 32. Valid integer drafts are stored as numbers; empty, fractional, out-of-range, and malformed drafts are preserved as raw UI values until the main-process validator rejects them with the actionable `utility.freezeMaxJobs` error. Invalid drafts must not be silently replaced with the previous valid value.
- Field description states it caps concurrent freeze renders.
- Panel reset restores 4 through `createDefaultUtilitySettings` (no special case).

## Consumers

- Freeze executor: read once per operation from `FreezeContext.utility.freezeMaxJobs`; bounds the render pool (see [freeze-parallel-execution.md](freeze-parallel-execution.md)).
- No renderer runtime consumer; the freeze dialog needs no knowledge of the cap.

## Compatibility

- Older settings files without the field load with 4 (merge default) — no migration.
- Newer files read by older builds: the extra field is ignored by the older merge (spread of `saved.utility`), and older executors simply run sequentially — downgrade-safe.
