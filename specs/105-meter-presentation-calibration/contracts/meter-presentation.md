# Contract: Meter Presentation and Calibration

## Stable identity contract

The persisted and transported identity is one of:

```text
peak-rms-linear-plus-6
peak-rms-mixing-plus-6
k20-rms-peak
k14-rms-peak
k12-rms-peak
```

Human-readable labels are resolved from the key only at presentation time. No XML element, typed
patch, snapshot, history record, or runtime selection may use a visual label as identity.

## Project XML contract

Newly saved mixer data contains:

```xml
<mixer>
  <enabled>true</enabled>
  <enableMeters>true</enableMeters>
  <meterProfile>peak-rms-mixing-plus-6</meterProfile>
  <!-- existing mixer children remain in canonical order -->
</mixer>
```

Load rules:

- `<enableMeters>true|false</enableMeters>` loads that explicit boolean.
- Missing `enableMeters` loads false.
- A recognized `<meterProfile>` loads the exact stable key.
- Missing, empty, or unrecognized `meterProfile` uses `peak-rms-linear-plus-6`.
- Existing mixer and unknown project content remains preserved according to current XML policy.

Save rules:

- Canonical values are written, never visual labels.
- Settings are placed under `<mixer>` and do not change CSD generation.
- Re-saving a loaded project does not alter unrelated mixer values or identities.

## Project editor contract

Snapshot extension:

```ts
interface MixerSnapshot {
  enableMeters: boolean;
  meterProfileKey: MeterProfileKey;
  // existing fields unchanged
}
```

Patch extension:

```ts
type MixerPatch =
  | { type: 'setMeterEnabled'; value: boolean }
  | { type: 'setMeterProfile'; value: MeterProfileKey }
  // existing variants unchanged
```

Behavior:

- Patches target the active canonical project.
- Same-value patches return unchanged and create no history entry.
- Semantic labels are `Enable Meters`, `Disable Meters`, and `Set Meter Profile`.
- Both variants use scalar history preparation and restore exact before and after values.
- Profile labels never cross the contract.

## Profile rendering contract

For every supported key, the renderer registry supplies:

1. One current label and accessible description.
2. A finite, monotonic, clamped dB-to-fraction mapping.
3. Display floor and ceiling with aligned major and minor ticks.
4. Ordered color and reference thresholds.
5. RMS as the moving bar and absolute sample peak as marker and readout.

Required mappings:

- `peak-rms-linear-plus-6`: uniform mapping over -60..+6 dBFS.
- `peak-rms-mixing-plus-6`: piecewise mapping over -70..+6 dBFS using the reviewed
  Ardour-style breakpoints and allocating about 56.5% of height to -20..+6 dBFS.
- `k20-rms-peak`, `k14-rms-peak`, and `k12-rms-peak`: displayed zero reference aligns to
  -20, -14, or -12 dBFS RMS respectively; numeric peak remains absolute dBFS.

All mappings clamp under-range, over-range, NaN, and infinities to safe drawing behavior. The
intentional silence readout is the string `-inf`.

## Clear contract

Clicking either a strip's meter or numeric peak readout invokes the same action. It clears every
output channel's held sample peak, decaying peak marker, and clip flag for that strip in one
synchronous store mutation. It does not clear other strips and creates no project history.

## Mixer Settings UI contract

- A button named `Mixer Settings` with a gear icon appears at the far right of the mixer toolbar,
  separated from Add Subchannel by flexible space. This is the preferred location because it stays
  visible independently of channel-strip scrolling.
- Activation opens a modal dialog in the invoking view's host document, including detached views.
- Initial dialog contents are a title, short project-ownership explanation, `Enable Meters`
  checkbox, and close action. No profile control is placed in this dialog in this phase.
- Checkbox changes dispatch `setMeterEnabled` immediately; closing is not a commit action.
- The meter-area selector dispatches `setMeterProfile`.
- Every control has an accessible name, keyboard operation, visible focus, and
  non-color-dependent state.

## Runtime and multi-view contract

- All docked and detached mixer views derive visibility and profile from `MixerSnapshot`.
- Disabling meters unmounts or stops meter rendering and clears transient state.
- Profile changes update every visible mixer without restarting playback.
- Existing RMS/peak telemetry and engine protocol remain unchanged.
- Profile and visibility changes do not affect channel gain, automation, routing, CSD, realtime
  audio, or offline render output.
