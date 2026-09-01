import { describe, expect, it } from 'vitest';
import type {
  BlueX7RealtimeControlUpdate,
  BlueX7RuntimeTarget,
  BlueX7RuntimeUpdateBatch,
} from '../shared/project-editor/contract';
import {
  applyBlueX7CompleteVoiceBatch,
  applyBlueX7LiveUpdate,
  planBlueX7CompleteVoiceBatch,
  planBlueX7LiveWrite,
  requestBlueX7EffectiveValues,
  type BlueX7RuntimeEnvironment,
} from './blue-x7-runtime-sync';
import {
  BlueData,
  BlueX7,
  compileBlueX7ProjectFixtures,
} from './blue-x7-runtime-sync-test-support';
import type { CompiledBlueX7Binding } from '@blue/data';
import {
  clearActiveBlueX7Bindings,
  getActiveBlueX7Binding,
  invalidateActiveBlueX7Binding,
  setActiveBlueX7Bindings,
} from './blue-x7-engine-sync';

/** Duck-typed parameter access for instruments stored as base `Instrument`. */
function instrParameters(instr: unknown): import('@blue/data').Parameter[] {
  const candidate = instr as { getParameters?: () => unknown };
  const params = candidate.getParameters?.();
  return Array.isArray(params) ? (params as import('@blue/data').Parameter[]) : [];
}

const assignmentTarget = (id: string): BlueX7RuntimeTarget => ({ assignmentId: id });
const trackTarget = (session: number, group: string, track: string): BlueX7RuntimeTarget => ({
  track: { projectSessionId: session, rootGroupId: group, trackId: track },
});

/**
 * In-memory environment wired against real BlueX7 instruments and real
 * compiled bindings produced by the @blue/data compile path.
 */
function createEnvironment(options: {
  data: BlueData;
  bindings: Map<string, CompiledBlueX7Binding>;
  sessionId: number;
  playing?: boolean;
  revision?: number;
  writeLog?: { name: string; value: number }[][];
  failWritesFor?: string[];
  readValues?: Map<string, number>;
}): BlueX7RuntimeEnvironment & {
  writeLog: { name: string; value: number }[][];
} {
  const { data, bindings, sessionId } = options;
  const writeLog = options.writeLog ?? [];
  return {
    writeLog,
    currentProjectSessionId: () => sessionId,
    currentProjectRevision: () => options.revision,
    isPlaying: () => options.playing ?? true,
    resolveOwner: (target) => {
      if (target.assignmentId !== undefined) {
        const ia = data
          .getArrangement()
          .getArrangement()
          .find((entry) => entry.arrangementId === target.assignmentId && entry.enabled && entry.instr);
        if (!ia || !(ia.instr instanceof BlueX7)) return null;
        return { ownerIdentity: `arrangement:${target.assignmentId}`, getParameters: () => instrParameters(ia.instr) };
      }
      const group = data
        .getScore()
        .find(
          (layerGroup) =>
            (layerGroup as unknown as { getUniqueId?: () => string }).getUniqueId?.() ===
            target.track!.rootGroupId,
        ) as unknown as { find: (cb: (entry: unknown) => boolean) => unknown } | undefined;
      if (!group) return null;
      const track = group.find(
        (entry) =>
          (entry as unknown as { getUniqueId?: () => string }).getUniqueId?.() ===
          target.track!.trackId,
      ) as unknown as { getInstrument?: () => unknown } | undefined;
      const instrument = track?.getInstrument?.();
      if (!track || !(instrument instanceof BlueX7)) return null;
      return {
        ownerIdentity: `track:${target.track!.rootGroupId}:${target.track!.trackId}`,
        getParameters: () => instrParameters(instrument),
      };
    },
    getBinding: (ownerIdentity) => bindings.get(ownerIdentity),
    writeChannels: async (entries) => {
      if (options.failWritesFor?.some((name) => entries.some((entry) => entry.name === name))) {
        return { ok: false, message: `engine write failed on ${entries[0]?.name}` };
      }
      writeLog.push([...entries]);
      return { ok: true, message: '' };
    },
    readChannels: async (names) => {
      const values = options.readValues;
      if (!values || names.some((name) => !values.has(name))) {
        return { ok: false, message: 'channel unavailable' };
      }
      return { ok: true, values: names.map((name) => values.get(name) ?? 0) };
    },
    nextEngineSequence: (() => {
      let sequence = 0;
      return () => ++sequence;
    })(),
  };
}

/** The live project's parameter uniqueId for a semantic key on owner `1`. */
function liveParameterId(fixtureData: BlueData, semanticKey: string, assignmentId = '1'): string {
  const ia = fixtureData
    .getArrangement()
    .getArrangement()
    .find((entry) => entry.arrangementId === assignmentId)!;
  return instrParameters(ia.instr).find((parameter) => parameter.getName() === semanticKey)!.getUniqueId();
}

function liveUpdate(overrides: Partial<BlueX7RealtimeControlUpdate> & { target: BlueX7RuntimeTarget }): BlueX7RealtimeControlUpdate {
  return {
    projectSessionId: 7,
    parameterId: 'param-unused',
    semanticKey: 'common.feedback',
    value: 5,
    ...overrides,
  };
}

describe('BlueX7 runtime sync (Spec 092)', () => {
  const fixture = compileBlueX7ProjectFixtures();
  const data = fixture.data;
  const bindings = fixture.bindings;

  it('invalidates delete/disable/replacement owners without disturbing peers and replaces on rebuild', () => {
    const fourOwner = compileBlueX7ProjectFixtures({ arrangementInstruments: 2, trackInstruments: 2 });
    setActiveBlueX7Bindings([...fourOwner.bindings.values()]);
    invalidateActiveBlueX7Binding('arrangement:1');
    expect(getActiveBlueX7Binding('arrangement:1')).toBeUndefined();
    expect(getActiveBlueX7Binding('arrangement:2')).toBeDefined();
    expect(getActiveBlueX7Binding(
      `track:${fourOwner.rootGroupIds[0]}:${fourOwner.trackIds[0]}`,
    )).toBeDefined();

    setActiveBlueX7Bindings([...fourOwner.bindings.values()]);
    expect(getActiveBlueX7Binding('arrangement:1')).toBeDefined();
    clearActiveBlueX7Bindings();
    expect([...fourOwner.bindings.keys()].every(
      (ownerIdentity) => getActiveBlueX7Binding(ownerIdentity) === undefined,
    )).toBe(true);
  });

  it('resolves arrangement and Track owners by identity even with duplicate names', () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    const arrangementOwner = env.resolveOwner(assignmentTarget('1'));
    const trackOwner = env.resolveOwner(trackTarget(7, fixture.rootGroupId, fixture.trackId));
    expect(arrangementOwner?.ownerIdentity).toBe('arrangement:1');
    expect(trackOwner?.ownerIdentity).toBe(`track:${fixture.rootGroupId}:${fixture.trackId}`);
    expect(arrangementOwner?.getParameters()).toHaveLength(151);
  });

  it('writes the quantized single edit to exactly the owner channel when automation does not own it', async () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    const plan = planBlueX7LiveWrite(
      env,
      liveUpdate({ target: assignmentTarget('1'), parameterId: liveParameterId(data, 'common.feedback') }),
    );
    expect(plan.status).toBe('ok');
    if (plan.status !== 'ok') return;
    expect(plan.entries).toHaveLength(1);
    expect(plan.binding.ownerIdentity).toBe('arrangement:1');
    expect(env.writeLog).toHaveLength(0); // planning performs no IO
    const applied = await applyBlueX7LiveUpdate(
      env,
      liveUpdate({ target: assignmentTarget('1'), parameterId: liveParameterId(data, 'common.feedback') }),
    );
    expect(applied.status).toBe('ok');
    expect(env.writeLog).toHaveLength(1);
  });

  it('fails closed on stale session, stale revision, removed owner, malformed target, and ID/key mismatch', async () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    expect((await applyBlueX7LiveUpdate(env, liveUpdate({ target: assignmentTarget('1'), projectSessionId: 6 }))).status).toBe('skip');
    expect(
      (await applyBlueX7LiveUpdate(env, liveUpdate({ target: assignmentTarget('1'), expectedProjectRevision: 3 })))
        .status,
    ).toBe('skip');
    expect((await applyBlueX7LiveUpdate(env, liveUpdate({ target: assignmentTarget('99') }))).status).toBe('skip');
    expect(
      (await applyBlueX7LiveUpdate(env, liveUpdate({ target: { assignmentId: '1', track: undefined } as never })))
        .status,
    ).toBe('error');
    const mismatch = await applyBlueX7LiveUpdate(
      env,
      liveUpdate({ target: assignmentTarget('1'), semanticKey: 'lfo.speed' }),
    );
    expect(mismatch.status).toBe('error');
    expect((mismatch as { reason: string }).reason).toBe('id-key-mismatch');
    expect(env.writeLog).toHaveLength(0);
  });

  it('fails closed with a recoverable diagnostic and zero writes when no compiled binding exists (FR-023)', async () => {
    // Owner and parameters resolve, but the engine holds no compiled binding
    // for the owner (for example an edit racing an engine rebuild). Every
    // entry point must refuse with a recoverable diagnostic and write nothing.
    const env = createEnvironment({ data, bindings: new Map(), sessionId: 7 });

    const live = await applyBlueX7LiveUpdate(
      env,
      liveUpdate({ target: assignmentTarget('1'), parameterId: liveParameterId(data, 'common.feedback') }),
    );
    expect(live.status).toBe('error');
    if (live.status === 'error') {
      expect(live.reason).toBe('binding-not-found');
      expect(live.message).toContain('arrangement:1');
    }
    expect(env.writeLog).toHaveLength(0);

    const owner = env.resolveOwner(assignmentTarget('1'))!;
    const batch: BlueX7RuntimeUpdateBatch = {
      projectSessionId: 7,
      owner: assignmentTarget('1'),
      mode: 'complete-voice',
      values: owner.getParameters().map((parameter) => ({
        parameterId: parameter.getUniqueId(),
        value: parameter.getValue(0),
      })),
    };
    const applied = await applyBlueX7CompleteVoiceBatch(env, batch);
    expect(applied.ok).toBe(false);
    if (!applied.ok) {
      expect(applied.reason).toBe('binding-not-found');
      expect(applied.message).toContain('arrangement:1');
    }
    expect(env.writeLog).toHaveLength(0);

    // Effective-value readback for an open editor fails closed the same way.
    const readback = await requestBlueX7EffectiveValues(env, {
      target: assignmentTarget('1'),
      projectSessionId: 7,
      parameterIds: [liveParameterId(data, 'common.feedback')],
    });
    expect(readback.ok).toBe(false);
    if (!readback.ok) {
      expect(readback.reason).toBe('binding-not-found');
    }
    expect(env.writeLog).toHaveLength(0);
  });

  it('keeps automation authoritative during playback and skips engine writes while stopped', async () => {
    const feedbackParam = instrParameters(
      data.getArrangement().getArrangement()[0].instr,
    ).find((parameter) => parameter.getName() === 'common.feedback')!;
    feedbackParam.setAutomationEnabled(true);

    const env = createEnvironment({ data, bindings, sessionId: 7, playing: true });
    const automated = await applyBlueX7LiveUpdate(
      env,
      liveUpdate({ target: assignmentTarget('1'), parameterId: liveParameterId(data, 'common.feedback') }),
    );
    expect(automated.status).toBe('skip');
    expect((automated as { reason: string }).reason).toBe('automation-authority');
    expect(env.writeLog).toHaveLength(0);

    feedbackParam.setAutomationEnabled(false);
    const stopped = createEnvironment({ data, bindings, sessionId: 7, playing: false });
    const stoppedPlan = await applyBlueX7LiveUpdate(
      stopped,
      liveUpdate({ target: assignmentTarget('1'), parameterId: liveParameterId(data, 'common.feedback') }),
    );
    expect(stoppedPlan.status).toBe('skip');
    expect((stoppedPlan as { reason: string }).reason).toBe('not-playing');
    expect(stopped.writeLog).toHaveLength(0);
  });

  it('applies whole-voice batches as one complete engine request', async () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    const owner = env.resolveOwner(assignmentTarget('1'))!;
    const parameters = owner.getParameters();
    const batch: BlueX7RuntimeUpdateBatch = {
      projectSessionId: 7,
      owner: assignmentTarget('1'),
      mode: 'complete-voice',
      values: parameters.map((parameter) => ({
        parameterId: parameter.getUniqueId(),
        value: parameter.getFixedValue(),
      })),
    };

    const applied = await applyBlueX7CompleteVoiceBatch(env, batch);
    expect(applied.ok).toBe(true);
    expect(env.writeLog).toHaveLength(1);
    expect(env.writeLog[0]).toHaveLength(151);
    expect(env.writeLog[0].every((entry) => entry.name.startsWith('gk_blue_auto'))).toBe(true);
  });

  it('exposes only old or new complete snapshots across 100 whole-voice operations', async () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    const owner = env.resolveOwner(assignmentTarget('1'))!;
    const parameters = owner.getParameters();
    const binding = bindings.get('arrangement:1')!;
    const channelState = new Map(
      parameters.map((parameter) => [
        binding.parameterChannels.get(parameter.getName())!,
        parameter.getFixedValue(),
      ]),
    );
    const oldSnapshot = parameters.map((parameter) => parameter.getFixedValue());
    const newSnapshot = [...oldSnapshot];
    const feedbackIndex = parameters.findIndex((parameter) => parameter.getName() === 'common.feedback');
    newSnapshot[feedbackIndex] = oldSnapshot[feedbackIndex] === 7 ? 0 : 7;
    const observations: number[][] = [oldSnapshot];
    env.writeChannels = async (entries) => {
      for (const entry of entries) {
        channelState.set(entry.name, entry.value);
      }
      observations.push(parameters.map((parameter) => (
        channelState.get(binding.parameterChannels.get(parameter.getName())!)!
      )));
      return { ok: true, message: '' };
    };

    for (let operation = 0; operation < 100; operation += 1) {
      const expected = operation % 2 === 0 ? newSnapshot : oldSnapshot;
      const result = await applyBlueX7CompleteVoiceBatch(env, {
        projectSessionId: 7,
        owner: assignmentTarget('1'),
        mode: 'complete-voice',
        values: parameters.map((parameter, index) => ({
          parameterId: parameter.getUniqueId(),
          value: expected[index]!,
        })),
      });
      expect(result.ok).toBe(true);
    }

    expect(observations).toHaveLength(101);
    for (const observed of observations) {
      expect(observed).toEqual(
        observed[feedbackIndex] === oldSnapshot[feedbackIndex] ? oldSnapshot : newSnapshot,
      );
    }
  });

  it('rejects incomplete or invalid whole-voice batches without writing', async () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    const owner = env.resolveOwner(assignmentTarget('1'))!;
    const parameters = owner.getParameters();
    const values = parameters.map((parameter) => ({
      parameterId: parameter.getUniqueId(),
      value: parameter.getFixedValue(),
    }));

    const incomplete = await applyBlueX7CompleteVoiceBatch(env, {
      projectSessionId: 7,
      owner: assignmentTarget('1'),
      mode: 'complete-voice',
      values: values.slice(1),
    });
    expect(incomplete.ok).toBe(false);

    const stale = await applyBlueX7CompleteVoiceBatch(env, {
      projectSessionId: 8,
      owner: assignmentTarget('1'),
      mode: 'complete-voice',
      values,
    });
    expect(stale.ok).toBe(false);
    expect((stale as { reason: string }).reason).toBe('stale-session');
    expect(env.writeLog).toHaveLength(0);
  });

  it('keeps the previous voice observable when the atomic batch is rejected', async () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    const binding = bindings.get('arrangement:1')!;
    env.writeChannels = async (entries) => {
      env.writeLog.push([...entries]);
      if (entries.length === 151) {
        return { ok: false, message: 'engine rejected the complete batch' };
      }
      return { ok: true, message: '' };
    };
    const owner = env.resolveOwner(assignmentTarget('1'))!;
    const parameters = owner.getParameters();
    const result = await applyBlueX7CompleteVoiceBatch(env, {
      projectSessionId: 7,
      owner: assignmentTarget('1'),
      mode: 'complete-voice',
      values: parameters.map((parameter) => ({
        parameterId: parameter.getUniqueId(),
        value: parameter.getFixedValue(),
      })),
    });
    expect(result.ok).toBe(false);
    // The engine sees one immutable request; no hold/release cleanup can
    // expose a hybrid snapshot after the request is rejected.
    expect(env.writeLog).toHaveLength(1);
    expect(env.writeLog[0]).toHaveLength(151);
    expect(env.writeLog[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: binding.parameterChannels.get('common.algorithm') }),
    ]));
  });

  it('returns explicit unavailable readback results and never crosses owners', async () => {
    const binding = bindings.get('arrangement:1')!;
    const feedbackChannel = [...binding.parameterChannels.entries()].find(
      ([, channel]) => channel === 'gk_blue_auto0',
    )?.[0];
    const parameterId = liveParameterId(data, 'common.feedback');

    const readValues = new Map<string, number>();
    for (const channel of binding.parameterChannels.values()) {
      readValues.set(channel, 42);
    }
    const env = createEnvironment({ data, bindings, sessionId: 7, readValues });

    const ok = await requestBlueX7EffectiveValues(env, {
      target: assignmentTarget('1'),
      projectSessionId: 7,
      parameterIds: [parameterId],
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.ownerIdentity).toBe('arrangement:1');
      expect(ok.values).toEqual([{ parameterId, value: 42 }]);
      expect(ok.engineSequence).toBeGreaterThan(0);
    }
    void feedbackChannel;

    const notPlaying = createEnvironment({ data, bindings, sessionId: 7, playing: false });
    expect(
      (await requestBlueX7EffectiveValues(notPlaying, {
        target: assignmentTarget('1'),
        projectSessionId: 7,
        parameterIds: [parameterId],
      })),
    ).toEqual({ ok: false, reason: 'not-playing' });

    expect(
      (await requestBlueX7EffectiveValues(env, {
        target: assignmentTarget('1'),
        projectSessionId: 9,
        parameterIds: [parameterId],
      })),
    ).toEqual({ ok: false, reason: 'stale-session' });

    expect(
      (await requestBlueX7EffectiveValues(env, {
        target: assignmentTarget('404'),
        projectSessionId: 7,
        parameterIds: [parameterId],
      })),
    ).toEqual({ ok: false, reason: 'owner-not-found' });

    expect(
      (await requestBlueX7EffectiveValues(env, {
        target: assignmentTarget('1'),
        projectSessionId: 7,
        parameterIds: ['missing-parameter'],
      })),
    ).toEqual({ ok: false, reason: 'channel-unavailable' });
  });

  it('fails closed on short or non-finite channel readbacks', async () => {
    const env = createEnvironment({ data, bindings, sessionId: 7 });
    const parameterIds = [
      liveParameterId(data, 'common.feedback'),
      liveParameterId(data, 'common.algorithm'),
    ];

    env.readChannels = async () => ({ ok: true, values: [42] });
    await expect(requestBlueX7EffectiveValues(env, {
      target: assignmentTarget('1'),
      projectSessionId: 7,
      parameterIds,
    })).resolves.toEqual({ ok: false, reason: 'channel-unavailable' });

    env.readChannels = async () => ({ ok: true, values: [Number.NaN, 12] });
    await expect(requestBlueX7EffectiveValues(env, {
      target: assignmentTarget('1'),
      projectSessionId: 7,
      parameterIds,
    })).resolves.toEqual({ ok: false, reason: 'channel-unavailable' });
  });

  it('routes four owners through disjoint channel sets with no cross-writes', async () => {
    const fourOwner = compileBlueX7ProjectFixtures({ arrangementInstruments: 2, trackInstruments: 2 });
    const env = createEnvironment({
      data: fourOwner.data,
      bindings: fourOwner.bindings,
      sessionId: 3,
    });
    const owners = ['1', '2'].map((id) => env.resolveOwner(assignmentTarget(id))!);
    const trackOwners = [
      env.resolveOwner(trackTarget(3, fourOwner.rootGroupIds[0], fourOwner.trackIds[0]))!,
      env.resolveOwner(trackTarget(3, fourOwner.rootGroupIds[1], fourOwner.trackIds[1]))!,
    ];
    expect([...owners, ...trackOwners]).toHaveLength(4);

    const channelSets = [...owners, ...trackOwners].map((owner) => {
      const binding = fourOwner.bindings.get(owner.ownerIdentity)!;
      return new Set<string>(binding.parameterChannels.values());
    });
    // no channel overlap across the four owners
    const allChannels = channelSets.flatMap((set) => [...set]);
    expect(new Set(allChannels).size).toBe(allChannels.length);

    // a write to owner one never touches another owner's channels
    const env2 = createEnvironment({
      data: fourOwner.data,
      bindings: fourOwner.bindings,
      sessionId: 3,
    });
    await applyBlueX7LiveUpdate(
      env2,
      liveUpdate({
        target: assignmentTarget('1'),
        projectSessionId: 3,
        parameterId: liveParameterId(fourOwner.data, 'common.feedback'),
      }),
    );
    expect(env2.writeLog).toHaveLength(1);
    const written = new Set(env2.writeLog[0].map((entry) => entry.name));
    for (const set of channelSets.slice(1)) {
      for (const channel of set) {
        expect(written.has(channel)).toBe(false);
      }
    }

    const ownerTargets = [
      assignmentTarget('1'),
      assignmentTarget('2'),
      trackTarget(3, fourOwner.rootGroupIds[0], fourOwner.trackIds[0]),
      trackTarget(3, fourOwner.rootGroupIds[1], fourOwner.trackIds[1]),
    ];
    const resolvedOwners = ownerTargets.map((target) => env2.resolveOwner(target)!);
    for (const owner of resolvedOwners) {
      owner.getParameters().find((parameter) => parameter.getName() === 'common.feedback')!
        .setAutomationEnabled(true);
    }
    env2.writeLog.length = 0;
    for (let index = 0; index < 600; index += 1) {
      const ownerIndex = index % 4;
      const owner = resolvedOwners[ownerIndex]!;
      const automated = index % 10 === 0;
      const semanticKey = automated ? 'common.feedback' : 'lfo.speed';
      const parameter = owner.getParameters().find((candidate) => candidate.getName() === semanticKey)!;
      const result = await applyBlueX7LiveUpdate(env2, liveUpdate({
        target: ownerTargets[ownerIndex]!,
        projectSessionId: 3,
        parameterId: parameter.getUniqueId(),
        semanticKey,
        value: index % 100,
      }));
      expect(result.status).toBe(automated ? 'skip' : 'ok');
      if (!automated) {
        const expectedChannel = fourOwner.bindings.get(owner.ownerIdentity)!
          .parameterChannels.get(semanticKey)!;
        expect(env2.writeLog.at(-1)).toEqual([{ name: expectedChannel, value: index % 100 }]);
      }
    }
    expect(env2.writeLog).toHaveLength(540);

    const readValues = new Map<string, number>();
    resolvedOwners.forEach((owner, index) => {
      const channel = fourOwner.bindings.get(owner.ownerIdentity)!.parameterChannels.get('common.feedback')!;
      readValues.set(channel, 20 + index);
    });
    const readEnv = createEnvironment({
      data: fourOwner.data,
      bindings: fourOwner.bindings,
      sessionId: 3,
      readValues,
    });
    for (let index = 0; index < resolvedOwners.length; index += 1) {
      const parameter = resolvedOwners[index]!.getParameters().find(
        (candidate) => candidate.getName() === 'common.feedback',
      )!;
      const result = await requestBlueX7EffectiveValues(readEnv, {
        target: ownerTargets[index]!,
        projectSessionId: 3,
        parameterIds: [parameter.getUniqueId()],
      });
      expect(result.ok && result.values[0]!.value).toBe(20 + index);
    }
  });
});
