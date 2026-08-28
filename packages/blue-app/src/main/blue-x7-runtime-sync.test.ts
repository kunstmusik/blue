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

  it('applies whole-voice batches in hold -> values -> release order', async () => {
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
    expect(env.writeLog).toHaveLength(3);
    expect(env.writeLog[0]).toHaveLength(1);
    expect(env.writeLog[0][0].value).toBe(1); // hold
    expect(env.writeLog[1]).toHaveLength(151); // complete validated snapshot
    expect(env.writeLog[2][0].value).toBe(0); // release
    const holdChannel = bindings.get('arrangement:1')!.holdChannel;
    expect(env.writeLog[0][0].name).toBe(holdChannel);
    expect(env.writeLog[2][0].name).toBe(holdChannel);
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

  it('clears the hold when a staged batch write fails mid-flight', async () => {
    const env = createEnvironment({
      data,
      bindings,
      sessionId: 7,
      failWritesFor: ['gk_blue_auto5'],
    });
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
    // hold, values (failed), then the best-effort hold clear
    expect(env.writeLog).toHaveLength(2);
    const holdChannel = bindings.get('arrangement:1')!.holdChannel;
    expect(env.writeLog[1][0].name).toBe(holdChannel);
    expect(env.writeLog[1][0].value).toBe(0);
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
  });
});
