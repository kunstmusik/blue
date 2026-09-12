# Data Model: Meter Presentation and Calibration

## MeterProfileKey

A closed, stable string identity for a project-wide meter profile.

| Key | Initial resolved label | Primary display |
|-----|------------------------|-----------------|
| `peak-rms-linear-plus-6` | Peak/RMS Linear (+6 dBFS) | RMS bar plus sample-peak marker/readout on uniform dB mapping |
| `peak-rms-mixing-plus-6` | Peak/RMS (+6 dBFS) | RMS bar plus sample-peak marker/readout on mixing-focused mapping |
| `k20-rms-peak` | K20 (RMS + Peak) | RMS with K-20 reference plus absolute sample peak |
| `k14-rms-peak` | K14 (RMS + Peak) | RMS with K-14 reference plus absolute sample peak |
| `k12-rms-peak` | K12 (RMS + Peak) | RMS with K-12 reference plus absolute sample peak |

Validation rules:

- Keys are exact, case-sensitive ASCII values.
- Only keys are persisted and carried through project contracts.
- Unknown, empty, or malformed loaded keys resolve safely to `peak-rms-linear-plus-6`.
- Labels are renderer metadata and may change or be localized without data migration.

## Mixer presentation fields

The existing canonical `Mixer` gains:

| Field | Type | New-project default | Missing-on-load default | Persistence |
|-------|------|---------------------|-------------------------|-------------|
| `enableMeters` | boolean | `true` | `false` | `<enableMeters>` under `<mixer>` |
| `meterProfileKey` | `MeterProfileKey` | `peak-rms-mixing-plus-6` | `peak-rms-linear-plus-6` | `<meterProfile>` under `<mixer>` |

Rules:

- Constructor defaults describe genuinely new projects.
- `loadFromXML()` treats absent fields as legacy independently of constructor defaults.
- Explicit serialized true/false and valid key values override missing-field defaults.
- Deep copy and history copy preserve both fields.
- These fields never affect channels, routing, gain, automation, CSD, or audio.

## MeterProfileDefinition

Renderer-owned immutable presentation metadata selected by `MeterProfileKey`:

- `key`: stable lookup identity matching the project value.
- `label`: replaceable or localizable visual text.
- `description`: concise behavior and K-calibration disclaimer where applicable.
- `minimumDb` and `maximumDb`: display bounds.
- `dbToFraction(db)`: finite, clamped, monotonic mapping to `[0,1]`.
- `majorTicks` and `minorTicks`: dB values and optional display labels.
- `colorStops`: ordered presentation thresholds.
- `barMeasurement`: RMS for the approved five profiles.
- `secondaryMeasurement`: held sample peak in absolute dBFS.

The registry contains exactly one complete definition for every supported stable key.

## MixerSnapshot additions

- `enableMeters: boolean`
- `meterProfileKey: MeterProfileKey`

Snapshots contain no visual label and no transient meter state.

## MixerPatch additions

- `{ type: 'setMeterEnabled'; value: boolean }`
- `{ type: 'setMeterProfile'; value: MeterProfileKey }`

Both are scalar patches. Applying the current value is a no-op. Invalid keys are rejected at the
typed/runtime validation boundary rather than entering canonical state.

## HeldPeakState

Disposable renderer state associated with a strip:

- Per-output sample peak levels in absolute dBFS.
- Per-output peak-hold levels in absolute dBFS.
- Per-output clip flags.
- Derived `numericPeak`: maximum finite held sample peak across outputs, otherwise `-inf`.

Atomic clear transition:

```text
current holds and clip flags
  -- click strip meter or readout -->
all holds = -Infinity and all clips = false
```

Disable transition:

```text
enableMeters=true
  -- project patch --> false
  --> meter UI unmounted or stopped
  --> all disposable holds and clip flags cleared
```

Re-enable begins from silence and accepts subsequent telemetry; stale state never reappears.

## MixerSettingsDialogState

Transient view state:

- `open: boolean`
- Checkbox value read from the current canonical or optimistic `MixerSnapshot`.

Opening and closing create no project history. Checkbox changes dispatch exactly one scalar project
patch. Undo and redo update an open dialog because it renders snapshot state rather than a local
durable copy.
