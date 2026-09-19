# Project, UI, and Runtime Contract

This contract extends Spec 112's [project/runtime contract](../../112-mono-clip-panning/contracts/project-and-runtime.md). The canonical active `BlueData` document remains the only durable project owner.

## XML and copy

- `<mixer panningEnabled="true" panLawDb="-3" panOffCenterBoost="false">` stores the Mixer-owned panning choices. Allowed law values are exactly `0,-3,-4.5,-6`. Absent/invalid values resolve independently to the documented defaults; legacy `<score>` attributes migrate when Mixer attributes are absent.
- Each `<channel>` stores `stereoPanMode` (`balance|stereoPan|dualPan`), `panWidth`, `dualPanLeft`, and `dualPanRight`, alongside existing `pan`. Absent/invalid values resolve independently to Balance/1/0/1. New channels use these defaults.
- Width, Dual Left, and Dual Right each have their own stable `Parameter` identity for fixed value and automation. Load dispatch recognizes Volume, Pan, Width, Dual Left, and Dual Right by distinct names/IDs; an unknown Parameter must not overwrite a known one.
- Save/load, duplication copy, and history copy retain settings, automation, associations, and unknown unrelated project data. Existing Java/Spec 112 projects without new values load with the same effective audio. No old project is automatically switched to a true-stereo mode.

## Typed document operations

| Operation | Accepted value | History label | Runtime consequence |
| --- | --- | --- | --- |
| Mixer law update | One allowed dB choice | `Set Pan Law` | Update generation-scoped law control on each active performance |
| Mixer boost update | Boolean | `Set Off-center Boost` | Update generation-scoped boost control |
| Channel mode update | `balance|stereoPan|dualPan` | `Set Channel Pan Mode` | Update generation-scoped mode control |
| Channel Width update | Finite `[0,1]` | `Set Channel Pan Width` | Update Width Parameter binding |
| Channel Dual Left update | Finite `[0,1]` | `Set Channel Left Pan` | Update Left Parameter binding |
| Channel Dual Right update | Finite `[0,1]` | `Set Channel Right Pan` | Update Right Parameter binding |
| Existing Channel Pan | Finite `[0,1]` | Existing `Set Channel Pan` | Existing Pan Parameter binding; Balance or Stereo Position |

Typed snapshots expose the canonical Mixer choices, saved channel mode/values, and effective Mono Pan versus two-bus presentation separately. Do not reuse the current derived snapshot `positionMode: 'pan'|'balance'` as persisted mode. Patches validate the entire edit before history preparation. Unknown enum values, nonfinite/out-of-range scalars, and illegal companion fields reject the whole edit without dirtying the project. Each committed action supports one undo/redo and restores parameter identities, references, dirty state, publication, and audible reconciliation. A drag preview remains disposable; cancel restores canonical engine value without history.

## UI behavior

- Mixer Settings shows law and Off-center boost beside Enable Panning, with the −3/off default and a concise gain warning.
- A two-bus strip shows an accessible mode selector: Balance, Stereo Pan, Dual Pan. Balance uses the existing slider. Stereo Pan shows Position and Width. Dual Pan shows independently labeled Left and Right source position controls. Verified mono-only strips show Mono Pan and retain any stored stereo-mode values without exposing unusable stereo controls.
- All sliders are keyboard operable with range/center/side feedback. Selected mode, saved Width, and effective narrowing near position endpoints are discoverable. The two true-stereo modes preserve their documented source-summing behavior without a dedicated mixer-strip peak/summing disclosure; that UI treatment was explicitly rejected as unnecessary.
- Panning disabled or mixer bypass makes controls inactive with a clear reason and retains the saved settings. Mode switches are distinct edits and may change sound; switching back restores stored values.

## Compiled and running audio

- Enabled stereo CSD emits the [audio-panning matrix](audio-panning.md) at the existing pan stage after sends and before output gate/meter/parent route. Balance output remains byte/numerically compatible where current fixtures require it. Disabled panning emits the existing legacy route.
- Only an enabled mixer with enabled panning and stereo output exposes generation-scoped, validated control bindings for Mixer law/boost and channel mode. Main sends changes through the existing engine-client channel operation to every active timeline/BlueLive performance; stale generations are rejected. Channel mode bindings match the Channel runtime identity preserved by render copies, then register under the canonical editor owner ID; display names are never mode-binding aliases. A bypassed mixer exposes no panner bindings and law/boost edits remain future intent. No renderer or data model calls the engine directly.
- Width and dual positions join the existing mixer Parameter catalog, CSD variable binding, automation, runtime sync, and revision/generation-fenced preview paths. When automation is active, the runtime follows its curve rather than a stale fixed value.
- Update failures leave canonical project values intact, mark audio as unapplied, report the failure, and retry/reconcile from the current document. A panning-enabled or source-layout change can still follow Spec 112's safe recompile path. A law/boost/mode or scalar change on an otherwise stable graph updates without restarting score events or moving transport.
- Disk generation reads canonical values and automation; preview values never affect export. Static and dynamic CSD branches obey the same gain equations. Discrete pan-law selections may apply immediately without a coefficient ramp, as accepted by the project owner on 2026-09-19. Other rapid control changes retain the requirement to avoid clicks using existing channel update smoothing or a minimal coefficient ramp.

## Failure and boundary checks

- Missing/invalid XML resolves to defaults without producing NaN or mutating unrelated data.
- Engine rejection, generation replacement, and partial runtime availability report saved versus applied state and reconcile when possible.
- Mono project output ignores stereo gain stages. Unsupported wider layouts retain Spec 112's diagnostic and project metadata.
- A score with both timeline and BlueLive active receives updates in each supported performance; one failure does not falsely mark the other applied.
