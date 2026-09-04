/**
 * BlueX7 engine synchronization adapter (Spec 092 US2).
 *
 * Bridges the host-neutral runtime-sync logic to the Electron main process:
 * it owns the render-scoped compiled bindings captured at playback start,
 * resolves live owners against the current canonical project, and routes
 * already-applied BlueX7 patches to the running engine without ever rolling
 * canonical project data back on engine failure.
 */
import type { BlueData, CompiledBlueX7Binding, Parameter } from '@blue/data';
import { BlueX7 } from '@blue/data';
import type { TrackLayerGroup } from '@blue/data';
import type { BlueX7RuntimeTarget } from '../shared/project-editor/contract';
import type { BlueX7RuntimeEnvironment } from './blue-x7-runtime-sync';
import { applyBlueX7CompleteVoiceBatch, applyBlueX7LiveUpdate } from './blue-x7-runtime-sync';
import { blueX7PatchToRuntimeIntent } from '../shared/blue-x7-patch-intents';
import type { InstrumentPatch } from '../shared/project-editor';

export interface BlueX7EngineSyncDeps {
  getData(): BlueData | null;
  getSessionId(): number | null;
  getRevision(): number | undefined;
  isPlaying(): boolean;
  writeChannels(
    entries: readonly { name: string; value: number }[],
  ): Promise<{ ok: boolean; message: string }>;
  readChannels(
    names: readonly string[],
  ): Promise<{ ok: true; values: number[] } | { ok: false; message: string }>;
}

let activeBindings = new Map<string, CompiledBlueX7Binding>();
let engineSequence = 0;

/** Capture the compiled bindings of the render that just started. */
export function setActiveBlueX7Bindings(
  bindings: readonly CompiledBlueX7Binding[] | undefined,
): void {
  activeBindings = new Map(bindings?.map((binding) => [binding.ownerIdentity, binding]) ?? []);
}

/** Forget the render-scoped bindings (stop, rebuild, project close). */
export function clearActiveBlueX7Bindings(): void {
  activeBindings = new Map();
}

/** Invalidate one owner without disturbing independent live bindings. */
export function invalidateActiveBlueX7Binding(ownerIdentity: string): void {
  activeBindings.delete(ownerIdentity);
}

export function getActiveBlueX7Binding(ownerIdentity: string): CompiledBlueX7Binding | undefined {
  return activeBindings.get(ownerIdentity);
}

/** Resolve a live runtime target against the current canonical project. */
export function resolveBlueX7OwnerFromData(
  data: BlueData | null,
  target: BlueX7RuntimeTarget,
  sessionId: number | null,
): { ownerIdentity: string; getParameters(): Parameter[] } | null {
  if (!data) return null;
  if (target.assignmentId !== undefined) {
    const ia = data
      .getArrangement()
      .getArrangement()
      .find((entry) => entry.arrangementId === target.assignmentId && entry.enabled && entry.instr);
    if (!ia || !(ia.instr instanceof BlueX7)) return null;
    const instrument = ia.instr;
    return {
      ownerIdentity: `arrangement:${target.assignmentId}`,
      getParameters: () => instrument.getParameters(),
    };
  }
  if (target.track.projectSessionId !== sessionId) return null;
  const group = data
    .getScore()
    .find(
      (candidate): candidate is TrackLayerGroup =>
        (candidate as unknown as { getUniqueId?: () => string }).getUniqueId?.() ===
        target.track.rootGroupId,
    );
  const track = group?.find((candidate) => candidate.getUniqueId() === target.track.trackId);
  const instrument = track?.getInstrument();
  if (!track || !(instrument instanceof BlueX7) || !instrument.isEnabled()) return null;
  return {
    ownerIdentity: `track:${target.track.rootGroupId}:${target.track.trackId}`,
    getParameters: () => instrument.getParameters(),
  };
}

export function createBlueX7RuntimeEnvironment(
  deps: BlueX7EngineSyncDeps,
): BlueX7RuntimeEnvironment {
  return {
    currentProjectSessionId: deps.getSessionId,
    currentProjectRevision: deps.getRevision,
    isPlaying: deps.isPlaying,
    resolveOwner: (target) =>
      resolveBlueX7OwnerFromData(deps.getData(), target, deps.getSessionId()),
    getBinding: getActiveBlueX7Binding,
    writeChannels: deps.writeChannels,
    readChannels: deps.readChannels,
    nextEngineSequence: () => ++engineSequence,
  };
}

function findBlueX7InstrumentByOwner(data: BlueData, ownerIdentity: string): BlueX7 | null {
  if (ownerIdentity.startsWith('arrangement:')) {
    const assignmentId = ownerIdentity.slice('arrangement:'.length);
    const ia = data
      .getArrangement()
      .getArrangement()
      .find((entry) => entry.arrangementId === assignmentId && entry.enabled && entry.instr);
    return ia && ia.instr instanceof BlueX7 ? ia.instr : null;
  }
  if (ownerIdentity.startsWith('track:')) {
    const [, rootGroupId, trackId] = ownerIdentity.split(':');
    const group = data
      .getScore()
      .find(
        (candidate): candidate is TrackLayerGroup =>
          (candidate as unknown as { getUniqueId?: () => string }).getUniqueId?.() === rootGroupId,
      );
    const track = group?.find((candidate) => candidate.getUniqueId() === trackId);
    const instrument = track?.getInstrument();
    return instrument instanceof BlueX7 && instrument.isEnabled() ? instrument : null;
  }
  return null;
}

function targetForOwner(
  data: BlueData,
  ownerIdentity: string,
  sessionId: number | null,
): BlueX7RuntimeTarget | null {
  if (ownerIdentity.startsWith('arrangement:')) {
    return { assignmentId: ownerIdentity.slice('arrangement:'.length) };
  }
  const [, rootGroupId, trackId] = ownerIdentity.split(':');
  if (!rootGroupId || !trackId) return null;
  return { track: { projectSessionId: sessionId ?? -1, rootGroupId, trackId } };
}

/**
 * Route an already-applied arrangement or Track BlueX7 instrument patch to
 * the running engine. Fixed deltas go through the authority-checked live
 * write; whole-voice replacement goes through one complete performance-thread
 * batch. Engine failures are logged, never rolled back into canonical data.
 */
export async function syncBlueX7InstrumentPatchToRuntime(
  deps: BlueX7EngineSyncDeps,
  data: BlueData | null,
  ownerIdentity: string,
  patch: InstrumentPatch,
): Promise<void> {
  if (!data || !patch.blueX7 || !deps.isPlaying()) return;
  const instrument = findBlueX7InstrumentByOwner(data, ownerIdentity);
  if (!instrument) return;
  const target = targetForOwner(data, ownerIdentity, deps.getSessionId());
  if (!target) return;

  const env = createBlueX7RuntimeEnvironment(deps);
  const intent = blueX7PatchToRuntimeIntent(patch.blueX7);

  if (intent.kind === 'none') return;

  if (intent.kind === 'complete-voice') {
    const parameters = instrument.getParameters();
    const result = await applyBlueX7CompleteVoiceBatch(env, {
      projectSessionId: deps.getSessionId() ?? -1,
      owner: target,
      mode: 'complete-voice',
      values: parameters.map((parameter) => ({
        parameterId: parameter.getUniqueId(),
        value: parameter.getFixedValue(),
      })),
    });
    if (!result.ok) {
      console.warn(`[BlueX7] complete-voice runtime sync failed: ${result.message}`);
    }
    return;
  }

  const parameters = instrument.getParameters();
  for (const change of intent.changes) {
    const parameter = parameters.find((candidate) => candidate.getName() === change.semanticKey);
    if (!parameter) continue;
    const result = await applyBlueX7LiveUpdate(env, {
      target,
      projectSessionId: deps.getSessionId() ?? -1,
      parameterId: parameter.getUniqueId(),
      semanticKey: change.semanticKey,
      value: change.value,
    });
    if (result.status === 'error') {
      console.warn(`[BlueX7] live update ${change.semanticKey} failed: ${result.message}`);
    }
  }
}
