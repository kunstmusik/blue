import { describe, expect, it } from 'vitest';
import {
  isBlueX7EffectiveValuesRequest,
  isBlueX7RealtimeControlUpdate,
  isBlueX7RuntimeTarget,
  type BlueX7EffectiveValuesResult,
  type BlueX7RuntimeTarget,
  type BlueX7RuntimeUpdateBatch,
} from './project-editor/contract';

const assignmentTarget: BlueX7RuntimeTarget = { assignmentId: 'arr-1' };
const trackTarget: BlueX7RuntimeTarget = {
  track: { projectSessionId: 1, rootGroupId: 'group-1', trackId: 'track-1' },
};

describe('BlueX7 runtime target contract', () => {
  it('accepts exactly-one-branch arrangement and Track targets', () => {
    expect(isBlueX7RuntimeTarget(assignmentTarget)).toBe(true);
    expect(isBlueX7RuntimeTarget(trackTarget)).toBe(true);
  });

  it('rejects targets with both, neither, or malformed branches', () => {
    expect(isBlueX7RuntimeTarget({})).toBe(false);
    expect(
      isBlueX7RuntimeTarget({
        assignmentId: 'arr-1',
        track: { projectSessionId: 1, rootGroupId: 'g', trackId: 't' },
      }),
    ).toBe(false);
    expect(isBlueX7RuntimeTarget({ assignmentId: '' })).toBe(false);
    expect(isBlueX7RuntimeTarget({ assignmentId: 42 })).toBe(false);
    expect(isBlueX7RuntimeTarget({ track: { projectSessionId: 1, rootGroupId: 'g' } })).toBe(false);
    expect(isBlueX7RuntimeTarget({ track: { rootGroupId: 'g', trackId: 't' } })).toBe(false);
    expect(
      isBlueX7RuntimeTarget({
        track: { projectSessionId: 1.5, rootGroupId: 'g', trackId: 't' },
      }),
    ).toBe(false);
    expect(
      isBlueX7RuntimeTarget({
        track: { projectSessionId: -1, rootGroupId: 'g', trackId: 't' },
      }),
    ).toBe(false);
    expect(isBlueX7RuntimeTarget('arr-1')).toBe(false);
    expect(isBlueX7RuntimeTarget(null)).toBe(false);
    expect(isBlueX7RuntimeTarget(undefined)).toBe(false);
  });
});

describe('BlueX7 realtime control update contract', () => {
  const base = {
    target: assignmentTarget,
    projectSessionId: 1,
    parameterId: 'param-1',
    semanticKey: 'common.feedback',
    value: 3,
  };

  it('accepts a well-formed update with and without a revision', () => {
    expect(isBlueX7RealtimeControlUpdate(base)).toBe(true);
    expect(isBlueX7RealtimeControlUpdate({ ...base, expectedProjectRevision: 7 })).toBe(true);
    expect(isBlueX7RealtimeControlUpdate({ ...base, target: trackTarget })).toBe(true);
  });

  it('rejects malformed updates without partial acceptance', () => {
    expect(isBlueX7RealtimeControlUpdate({ ...base, value: Number.NaN })).toBe(false);
    expect(isBlueX7RealtimeControlUpdate({ ...base, value: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isBlueX7RealtimeControlUpdate({ ...base, parameterId: '' })).toBe(false);
    expect(isBlueX7RealtimeControlUpdate({ ...base, semanticKey: '' })).toBe(false);
    expect(isBlueX7RealtimeControlUpdate({ ...base, projectSessionId: 'one' })).toBe(false);
    expect(isBlueX7RealtimeControlUpdate({ ...base, expectedProjectRevision: 1.5 })).toBe(false);
    expect(isBlueX7RealtimeControlUpdate({ ...base, target: { assignmentId: '' } })).toBe(false);
    expect(isBlueX7RealtimeControlUpdate(null)).toBe(false);
  });
});

describe('BlueX7 effective-values request contract', () => {
  const base = {
    target: trackTarget,
    projectSessionId: 1,
    parameterIds: ['param-1', 'param-2'],
  };

  it('accepts bounded visible-control requests', () => {
    expect(isBlueX7EffectiveValuesRequest(base)).toBe(true);
    expect(isBlueX7EffectiveValuesRequest({ ...base, target: assignmentTarget })).toBe(true);
    expect(isBlueX7EffectiveValuesRequest({ ...base, projectSessionId: 0 })).toBe(true);
    expect(
      isBlueX7EffectiveValuesRequest({
        ...base,
        parameterIds: ['single-param'],
      }),
    ).toBe(true);
    expect(
      isBlueX7EffectiveValuesRequest({
        ...base,
        parameterIds: Array.from({ length: 151 }, (_, i) => `param-${i}`),
      }),
    ).toBe(true);
  });

  it('rejects empty, oversized, or malformed requests', () => {
    expect(isBlueX7EffectiveValuesRequest({ ...base, parameterIds: [] })).toBe(false);
    expect(
      isBlueX7EffectiveValuesRequest({
        ...base,
        parameterIds: Array.from({ length: 152 }, (_, i) => `param-${i}`),
      }),
    ).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, parameterIds: ['ok', ''] })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, parameterIds: ['ok', null as unknown as string] })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, parameterIds: ['ok', 123 as unknown as string] })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, parameterIds: null as unknown as string[] })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, parameterIds: 'param-1' as unknown as string[] })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, target: {} })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, target: { assignmentId: '' } })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, projectSessionId: -3 })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, projectSessionId: 1.5 })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, projectSessionId: Number.NaN })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, projectSessionId: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest({ ...base, projectSessionId: '1' as unknown as number })).toBe(false);
    expect(isBlueX7EffectiveValuesRequest(null)).toBe(false);
    expect(isBlueX7EffectiveValuesRequest(undefined)).toBe(false);
    expect(isBlueX7EffectiveValuesRequest('request')).toBe(false);
  });
});

describe('BlueX7 runtime result unions', () => {
  it('represent success and every documented stale failure reason', () => {
    const success: BlueX7EffectiveValuesResult = {
      ok: true,
      projectSessionId: 1,
      ownerIdentity: 'track:g1:t1',
      engineSequence: 12,
      values: [{ parameterId: 'param-1', value: 42 }],
    };
    expect(success.ok).toBe(true);

    for (const reason of [
      'not-playing',
      'stale-session',
      'owner-not-found',
      'binding-not-found',
      'channel-unavailable',
    ] as const) {
      const failure: BlueX7EffectiveValuesResult = { ok: false, reason };
      expect(failure).toEqual({ ok: false, reason });
    }
  });

  it('represent fixed-delta and complete-voice batches serializably', () => {
    const delta: BlueX7RuntimeUpdateBatch = {
      projectSessionId: 1,
      owner: assignmentTarget,
      mode: 'fixed-delta',
      values: [{ parameterId: 'param-1', value: 5 }],
    };
    const whole: BlueX7RuntimeUpdateBatch = {
      projectSessionId: 1,
      owner: trackTarget,
      expectedProjectRevision: 3,
      mode: 'complete-voice',
      values: Array.from({ length: 151 }, (_, i) => ({
        parameterId: `param-${i}`,
        value: i,
      })),
    };
    expect(delta.values).toHaveLength(1);
    expect(whole.values).toHaveLength(151);
    // serializable through structured clone (no maps, symbols, or functions)
    expect(JSON.parse(JSON.stringify(whole))).toEqual(whole);
  });
});
