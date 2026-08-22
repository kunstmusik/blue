# Engine Recovery and UX Contract

Electron main owns failure classification, eligibility, retry budgets, native actions, and diagnostics. The renderer receives validated status without PID or kill capabilities.

## Recovery status

```text
EngineRecoveryStatus {
  operationId: bounded non-empty string
  sessionKind: "realtime" | "blue-live"
  phase: "recovering" | "recovered" | "failed"
  attempt: 1
  message: bounded display string
  failureCategory?: "engine-unavailable" | "runtime-unavailable" |
    "address-contention" | "readiness-timeout" |
    "session-unresponsive" | "cleanup-failed" | "unexpected"
}
```

The shared decoder rejects unknown values, empty IDs, invalid attempts, oversized text, and process-control fields. `recovering` creates a keyed loading toast; `recovered`/`failed` resolve it. Existing playback status remains canonical. Duplicates are idempotent by operation and phase.

## Automatic recovery

1. Classify the first recoverable failure.
2. Publish recovering and append lifecycle diagnostics.
3. Perform ownership-safe cleanup and await it.
4. Allocate fresh endpoints and retry once.
5. On success publish recovered and continue the original request.
6. On failure publish failed and offer manual actions.

Unrecoverable executable/runtime/configuration failures or unverifiable foreign processes may fail directly.

## Manual actions

- **Restart Audio Engine**: clean current-owner and verified orphan sessions, then attempt once; never target a live other owner or executable-name match.
- **Show Diagnostics**: focus existing Csound output and mutate no process.
- **Cancel**: stop without another retry. Closing the dialog equals Cancel.

Reports include lifecycle identity, transport category, classified failure, elapsed actions, exit, and outcome. They exclude project/CSD content, environment dumps, user paths, and unbounded output.

## Required evidence

One first retry completes the original request; second failure does not loop and offers all actions; toast transitions are keyed; restart preserves other owners; diagnostics focus/output/privacy and strict decoding are tested.
