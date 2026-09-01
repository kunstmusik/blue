/**
 * BlueX7 runtime synchronization (Spec 092, US2/US4).
 *
 * Routes live BlueX7 control intents and complete whole-voice batches, and
 * effective-value readback to exactly one arrangement or Track owner while
 * keeping BlueData canonical and automation authoritative. Every step is
 * fail-closed: a stale session, removed owner, missing binding, ID/key
 * mismatch, or unavailable channel writes nothing and reports a safe
 * diagnostic. No resolver falls back to a same-named instrument, ordinal
 * position, or another owner.
 *
 * All IO (owner resolution against the live project, channel writes/reads,
 * playback state) is injected through BlueX7RuntimeEnvironment so the sync
 * logic is host-neutral and directly testable.
 */
import type {
  BlueX7EffectiveValuesRequest,
  BlueX7EffectiveValuesResult,
  BlueX7RealtimeControlUpdate,
  BlueX7RuntimeTarget,
  BlueX7RuntimeUpdateBatch,
} from '../shared/project-editor/contract';
import type { CompiledBlueX7Binding, Parameter } from '@blue/data';
import { getBlueX7Descriptor, quantizeBlueX7DescriptorValue } from '@blue/data';

export interface BlueX7OwnerResolution {
  ownerIdentity: string;
  /** The live canonical instrument for the owner. */
  getParameters(): Parameter[];
}

export interface BlueX7RuntimeEnvironment {
  currentProjectSessionId(): number | null;
  currentProjectRevision?(): number | undefined;
  isPlaying(): boolean;
  resolveOwner(target: BlueX7RuntimeTarget): BlueX7OwnerResolution | null;
  getBinding(ownerIdentity: string): CompiledBlueX7Binding | undefined;
  writeChannels(
    entries: readonly { name: string; value: number }[],
  ): Promise<{ ok: boolean; message: string }>;
  readChannels(
    names: readonly string[],
  ): Promise<{ ok: true; values: number[] } | { ok: false; message: string }>;
  nextEngineSequence(): number;
}

export type BlueX7LiveWritePlan =
  | {
      status: 'ok';
      binding: CompiledBlueX7Binding;
      entries: { name: string; value: number }[];
    }
  | {
      status: 'skip';
      reason:
        | 'stale-session'
        | 'stale-revision'
        | 'owner-not-found'
        | 'automation-authority'
        | 'not-playing';
      message?: string;
    }
  | {
      status: 'error';
      reason:
        | 'invalid-target'
        | 'invalid-value'
        | 'id-key-mismatch'
        | 'unknown-key'
        | 'binding-not-found'
        | 'channel-unavailable';
      message: string;
    };

function sessionMatches(
  env: BlueX7RuntimeEnvironment,
  projectSessionId: number,
): boolean {
  return projectSessionId === env.currentProjectSessionId();
}

function revisionMatches(
  env: BlueX7RuntimeEnvironment,
  expected: number | undefined,
): boolean {
  if (expected === undefined) {
    return true;
  }
  return expected === env.currentProjectRevision?.();
}

/**
 * Resolve one single-control live edit into the channel entries to write,
 * applying the authority matrix: while automation owns the parameter during
 * playback, no direct effective write is issued (the durable edit still
 * updates the canonical voice and fixed fallback); while stopped, no engine
 * write happens at all.
 */
export function planBlueX7LiveWrite(
  env: BlueX7RuntimeEnvironment,
  update: BlueX7RealtimeControlUpdate,
): BlueX7LiveWritePlan {
  if (
    (update.target.assignmentId === undefined) === (update.target.track === undefined)
  ) {
    return { status: 'error', reason: 'invalid-target', message: 'target must have exactly one owner branch' };
  }
  if (!sessionMatches(env, update.projectSessionId)) {
    return { status: 'skip', reason: 'stale-session' };
  }
  if (!revisionMatches(env, update.expectedProjectRevision)) {
    return { status: 'skip', reason: 'stale-revision' };
  }
  const owner = env.resolveOwner(update.target);
  if (!owner) {
    return { status: 'skip', reason: 'owner-not-found' };
  }

  const descriptor = getBlueX7Descriptor(update.semanticKey);
  if (!descriptor) {
    return { status: 'error', reason: 'unknown-key', message: `unknown semantic key: ${update.semanticKey}` };
  }
  const parameter = owner
    .getParameters()
    .find((candidate) => candidate.getUniqueId() === update.parameterId);
  if (!parameter || parameter.getName() !== update.semanticKey) {
    return {
      status: 'error',
      reason: 'id-key-mismatch',
      message: 'parameter id and semantic key must refer to the same descriptor',
    };
  }
  if (!Number.isFinite(update.value)) {
    return { status: 'error', reason: 'invalid-value', message: 'value must be finite' };
  }

  // Authority matrix (runtime contract): automation remains the effective
  // authority while enabled during playback; stopped playback never writes.
  if (!env.isPlaying()) {
    return { status: 'skip', reason: 'not-playing' };
  }
  if (parameter.isEnabled()) {
    return { status: 'skip', reason: 'automation-authority' };
  }

  const binding = env.getBinding(owner.ownerIdentity);
  if (!binding) {
    return { status: 'error', reason: 'binding-not-found', message: `no compiled binding for ${owner.ownerIdentity}` };
  }
  const channel = binding.parameterChannels.get(parameter.getName());
  if (!channel) {
    return {
      status: 'error',
      reason: 'channel-unavailable',
      message: `parameter ${update.parameterId} has no compiled channel`,
    };
  }
  const quantized = quantizeBlueX7DescriptorValue(descriptor, update.value);
  if (quantized === null) {
    return { status: 'error', reason: 'invalid-value', message: 'value rejected by the descriptor domain' };
  }
  return {
    status: 'ok',
    binding,
    entries: [{ name: channel, value: quantized }],
  };
}

/** Plan, then write, one single-control live edit. */
export async function applyBlueX7LiveUpdate(
  env: BlueX7RuntimeEnvironment,
  update: BlueX7RealtimeControlUpdate,
): Promise<BlueX7LiveWritePlan> {
  const plan = planBlueX7LiveWrite(env, update);
  if (plan.status !== 'ok') {
    return plan;
  }
  const result = await env.writeChannels(plan.entries);
  if (!result.ok) {
    return {
      status: 'error',
      reason: 'channel-unavailable',
      message: result.message,
    };
  }
  return plan;
}

export interface BlueX7CompleteVoiceStep {
  label: 'batch';
  entries: { name: string; value: number }[];
}

/**
 * Plan one complete whole-voice update. The canonical project mutation must
 * already have succeeded before this plans anything; the engine validates and
 * enqueues the complete set as one performance-thread batch, so no Csound
 * reader can observe a partially published voice.
 */
export function planBlueX7CompleteVoiceBatch(
  env: BlueX7RuntimeEnvironment,
  batch: BlueX7RuntimeUpdateBatch,
): { status: 'ok'; ownerIdentity: string; steps: BlueX7CompleteVoiceStep[] } | { status: 'error'; reason: string; message: string } {
  if (!sessionMatches(env, batch.projectSessionId)) {
    return { status: 'error', reason: 'stale-session', message: 'project session no longer current' };
  }
  if (!revisionMatches(env, batch.expectedProjectRevision)) {
    return { status: 'error', reason: 'stale-revision', message: 'project revision moved' };
  }
  const owner = env.resolveOwner(batch.owner);
  if (!owner) {
    return { status: 'error', reason: 'owner-not-found', message: 'owner removed or replaced' };
  }
  const binding = env.getBinding(owner.ownerIdentity);
  if (!binding) {
    return { status: 'error', reason: 'binding-not-found', message: `no compiled binding for ${owner.ownerIdentity}` };
  }
  if (batch.mode !== 'complete-voice') {
    return { status: 'error', reason: 'invalid-mode', message: 'complete-voice batches only' };
  }

  const parameters = owner.getParameters();
  if (batch.values.length !== parameters.length) {
    return {
      status: 'error',
      reason: 'incomplete-snapshot',
      message: `complete-voice batch must carry all ${parameters.length} values`,
    };
  }
  const valueByParameterId = new Map(
    batch.values.map((entry) => [entry.parameterId, entry.value]),
  );
  const channelEntries: { name: string; value: number }[] = [];
  for (const parameter of parameters) {
    const raw = valueByParameterId.get(parameter.getUniqueId());
    if (raw === undefined || !Number.isFinite(raw)) {
      return {
        status: 'error',
        reason: 'invalid-value',
        message: `missing or non-finite value for ${parameter.getName()}`,
      };
    }
    const descriptor = getBlueX7Descriptor(parameter.getName());
    if (!descriptor) {
      return {
        status: 'error',
        reason: 'unknown-key',
        message: `parameter name does not match the catalog: ${parameter.getName()}`,
      };
    }
    const channel = binding.parameterChannels.get(parameter.getName());
    if (!channel) {
      return {
        status: 'error',
        reason: 'channel-unavailable',
        message: `parameter ${parameter.getName()} has no compiled channel`,
      };
    }
    const quantized = quantizeBlueX7DescriptorValue(descriptor, raw);
    if (quantized === null) {
      return {
        status: 'error',
        reason: 'invalid-value',
        message: `value rejected for ${parameter.getName()}`,
      };
    }
    channelEntries.push({ name: channel, value: quantized });
  }

  return {
    status: 'ok',
    ownerIdentity: owner.ownerIdentity,
    steps: [{ label: 'batch', entries: channelEntries }],
  };
}

/**
 * Apply a complete whole-voice batch with one engine request. If the request
 * is rejected, no channel is changed; canonical project data is never rolled
 * back because the engine state is disposable.
 */
export async function applyBlueX7CompleteVoiceBatch(
  env: BlueX7RuntimeEnvironment,
  batch: BlueX7RuntimeUpdateBatch,
): Promise<{ ok: true; ownerIdentity: string } | { ok: false; reason: string; message: string }> {
  const plan = planBlueX7CompleteVoiceBatch(env, batch);
  if (plan.status !== 'ok') {
    return { ok: false, reason: plan.reason, message: plan.message };
  }
  const { steps, ownerIdentity } = plan;
  const result = await env.writeChannels(steps[0].entries);
  if (!result.ok) {
    return { ok: false, reason: 'engine-write-failed', message: result.message };
  }
  return { ok: true, ownerIdentity };
}

/**
 * Effective-value readback for one open editor: visible controls only,
 * request order preserved, session/owner-tagged. Stale sessions, stopped
 * playback, removed owners, missing bindings, and unavailable channels
 * return an explicit unavailable result and never substitute another
 * instance's values.
 */
export async function requestBlueX7EffectiveValues(
  env: BlueX7RuntimeEnvironment,
  request: BlueX7EffectiveValuesRequest,
): Promise<BlueX7EffectiveValuesResult> {
  if (!sessionMatches(env, request.projectSessionId)) {
    return { ok: false, reason: 'stale-session' };
  }
  if (!env.isPlaying()) {
    return { ok: false, reason: 'not-playing' };
  }
  const owner = env.resolveOwner(request.target);
  if (!owner) {
    return { ok: false, reason: 'owner-not-found' };
  }
  const binding = env.getBinding(owner.ownerIdentity);
  if (!binding) {
    return { ok: false, reason: 'binding-not-found' };
  }

  const parameters = owner.getParameters();
  const channelNames: string[] = [];
  const channelByParameterId = new Map<string, string>();
  for (const parameterId of request.parameterIds) {
    const parameter = parameters.find(
      (candidate) => candidate.getUniqueId() === parameterId,
    );
    // The owner exists: an unknown id means that control has no channel here.
    if (!parameter) {
      return { ok: false, reason: 'channel-unavailable' };
    }
    const channel = binding.parameterChannels.get(parameter.getName());
    if (!channel) {
      return { ok: false, reason: 'channel-unavailable' };
    }
    channelNames.push(channel);
    channelByParameterId.set(parameterId, channel);
  }

  const result = await env.readChannels(channelNames);
  if (!result.ok) {
    return { ok: false, reason: 'channel-unavailable' };
  }

  if (
    result.values.length !== channelNames.length
    || result.values.some((value) => !Number.isFinite(value))
  ) {
    return { ok: false, reason: 'channel-unavailable' };
  }

  // The response order is the request order; reattach parameter ids.
  const values = request.parameterIds.map((parameterId, index) => ({
    parameterId,
    value: result.values[index],
  }));

  return {
    ok: true,
    projectSessionId: request.projectSessionId,
    ownerIdentity: owner.ownerIdentity,
    engineSequence: env.nextEngineSequence(),
    values,
  };
}
