import { describe, expect, it } from 'vitest';
import { BlueData, BlueSynthBuilder, BSBHSlider, GenericInstrument } from '@blue/data';
import {
  transferProjectEditorIdentities,
  getBsbGestureTargetId,
} from '../shared/project-editor/identity';
import { transferHistoryNodeIds } from '../shared/project-editor/history-node-identity';
import {
  captureProjectGraphDelta,
  applyProjectGraphDelta,
  mergeProjectGraphDeltas,
  isNetZeroProjectGraphDelta,
  estimateProjectGraphDeltaBytes,
} from './project-history-graph';
function copy<T extends object>(value: T): T {
  const next = structuredClone(value);
  transferHistoryNodeIds(value, next, () => {});
  return next;
}
describe('isolated project graph deltas', () => {
  it('stores changed fields independently of unrelated project size', () => {
    const before = new BlueData();
    before.getGlobalOrcSco().setGlobalOrc('x'.repeat(1000000));
    const after = before.historyCopy();
    transferProjectEditorIdentities(before, after);
    after.getProjectProperties().title = 'new';
    const delta = captureProjectGraphDelta(before, after);
    expect(estimateProjectGraphDeltaBytes(delta)).toBeLessThan(4096);
    applyProjectGraphDelta(before, delta, 'after');
    expect(before.getProjectProperties().title).toBe('new');
    applyProjectGraphDelta(before, delta, 'before');
    expect(before.getProjectProperties().title).toBe('');
  });
  it('preserves aliases/cycles when deleting and recreating a subgraph', () => {
    const shared = { name: 'shared' };
    const child: { shared: typeof shared; self?: unknown } = { shared };
    child.self = child;
    const before: { shared: typeof shared; items: (typeof child)[] } = { shared, items: [child] };
    const after = copy(before);
    after.items.length = 0;
    const delta = captureProjectGraphDelta(before, after);
    applyProjectGraphDelta(before, delta, 'after');
    expect(before.items).toHaveLength(0);
    applyProjectGraphDelta(before, delta, 'before');
    expect(before.items[0]!.shared).toBe(shared);
    expect(before.items[0]!.self).toBe(before.items[0]);
  });
  it('preserves sparse arrays, reorders references and restores the same live objects', () => {
    const first = { name: 'first' },
      last = { name: 'last' };
    const items = [first, , last];
    const before = { items };
    const after = copy(before);
    after.items.reverse();
    const delta = captureProjectGraphDelta(before, after);
    applyProjectGraphDelta(before, delta, 'after');
    expect(items[0]).toBe(last);
    expect(1 in items).toBe(false);
    applyProjectGraphDelta(before, delta, 'before');
    expect(items[0]).toBe(first);
    expect(items[2]).toBe(last);
  });
  it('restores Map/Set entries with object keys and bigint values', () => {
    const key = { name: 'key' };
    const before = { key, map: new Map([[key, 1n]]), set: new Set([key]) };
    const after = copy(before);
    after.map.set(after.key, 2n);
    after.set.clear();
    const delta = captureProjectGraphDelta(before, after);
    applyProjectGraphDelta(before, delta, 'after');
    expect(before.map.get(key)).toBe(2n);
    expect(before.set.size).toBe(0);
    applyProjectGraphDelta(before, delta, 'before');
    expect(before.map.get(key)).toBe(1n);
    expect(before.set.has(key)).toBe(true);
  });
  it('recreates typed model prototypes and stable editor identities', () => {
    const before = new BlueData();
    const after = before.historyCopy();
    transferProjectEditorIdentities(before, after);
    const instrument = new BlueSynthBuilder();
    const slider = new BSBHSlider();
    slider.id = 'gain';
    slider.objectName = 'gain';
    instrument.getGraphicInterface().getRootGroup().addChild(slider);
    after.getArrangement().addInstrument(instrument, '6');
    const delta = captureProjectGraphDelta(before, after);
    const identity = getBsbGestureTargetId(slider);
    applyProjectGraphDelta(before, delta, 'after');
    const restored = before.getArrangement().getInstrumentById('6') as BlueSynthBuilder;
    expect(restored).toBeInstanceOf(BlueSynthBuilder);
    expect(restored.getGraphicInterface().findWidgetById('gain')).toBeInstanceOf(BSBHSlider);
    expect(getBsbGestureTargetId(restored.getGraphicInterface().findWidgetById('gain')!)).toBe(
      identity,
    );
    applyProjectGraphDelta(before, delta, 'before');
    expect(before.getArrangement().size()).toBe(0);
  });
  it('merges repeated field edits and detects net-zero without growing per update', () => {
    const original = { title: 'initial' };
    let prior = copy(original);
    let merged: ReturnType<typeof captureProjectGraphDelta> | undefined;
    for (let i = 0; i < 100; i++) {
      const after = copy(prior);
      after.title = String(i);
      const delta = captureProjectGraphDelta(prior, after);
      merged = merged ? mergeProjectGraphDeltas(merged, delta, after) : delta;
      prior = after;
    }
    expect(merged!.fields).toHaveLength(1);
    expect(estimateProjectGraphDeltaBytes(merged!)).toBeLessThan(2048);
    const end = copy(prior);
    end.title = 'initial';
    merged = mergeProjectGraphDeltas(merged!, captureProjectGraphDelta(prior, end), end);
    expect(isNetZeroProjectGraphDelta(merged)).toBe(true);
  });
  it('folds edits to a newly inserted node into the grouped postimage', () => {
    const before: { items: Array<{ name: string }> } = { items: [] };
    const added = copy(before);
    added.items.push({ name: 'first' });
    const changed = copy(added);
    changed.items[0]!.name = 'last';
    const delta = mergeProjectGraphDeltas(
      captureProjectGraphDelta(before, added),
      captureProjectGraphDelta(added, changed),
      changed,
    );
    applyProjectGraphDelta(before, delta, 'after');
    expect(before.items[0]!.name).toBe('last');
    applyProjectGraphDelta(before, delta, 'before');
    expect(before.items).toHaveLength(0);
  });
  it('retains the original state of a node changed and then removed within a group', () => {
    const before = { items: [{ name: 'initial' }] };
    const changed = copy(before);
    changed.items[0]!.name = 'changed';
    const removed = copy(changed);
    removed.items.length = 0;
    const delta = mergeProjectGraphDeltas(
      captureProjectGraphDelta(before, changed),
      captureProjectGraphDelta(changed, removed),
      removed,
    );
    applyProjectGraphDelta(before, delta, 'after');
    expect(before.items).toHaveLength(0);
    applyProjectGraphDelta(before, delta, 'before');
    expect(before.items[0]!.name).toBe('initial');
  });
  it('does not retain inserted subgraphs after a net-zero insertion/deletion group', () => {
    const before: { items: Array<{ text: string }> } = { items: [] };
    const added = copy(before);
    added.items.push({ text: 'large'.repeat(10000) });
    const removed = copy(added);
    removed.items.length = 0;
    const delta = mergeProjectGraphDeltas(
      captureProjectGraphDelta(before, added),
      captureProjectGraphDelta(added, removed),
      removed,
    );
    expect(isNetZeroProjectGraphDelta(delta)).toBe(true);
    expect(estimateProjectGraphDeltaBytes(delta)).toBeLessThan(2048);
  });
  it('rejects stale targets before changing any canonical field', () => {
    const before = { title: 'before', child: { value: 1 } };
    const after = copy(before);
    after.title = 'after';
    after.child.value = 2;
    const delta = captureProjectGraphDelta(before, after);
    before.child = { value: 9 };
    expect(() => applyProjectGraphDelta(before, delta, 'after')).toThrow('no longer exists');
    expect(before.title).toBe('before');
    expect(before.child.value).toBe(9);
  });
  it('keeps retained values detached from later edits', () => {
    const before = new BlueData();
    const after = before.historyCopy();
    transferProjectEditorIdentities(before, after);
    const instrument = new GenericInstrument();
    instrument.setText('retained');
    after.getArrangement().addInstrument(instrument, '1');
    const delta = captureProjectGraphDelta(before, after);
    instrument.setText('later');
    applyProjectGraphDelta(before, delta, 'after');
    expect((before.getArrangement().getInstrumentById('1') as GenericInstrument).getText()).toBe(
      'retained',
    );
  });
});
it('retains small reversible spans in large embedded XML/code strings and merges distant edits', () => {
  const before = { text: 'a'.repeat(1000000) };
  const first = copy(before);
  first.text = first.text.slice(0, 10) + 'X' + first.text.slice(11);
  const second = copy(first);
  second.text = second.text.slice(0, 900000) + 'Y' + second.text.slice(900001);
  const one = captureProjectGraphDelta(before, first);
  expect(estimateProjectGraphDeltaBytes(one)).toBeLessThan(4096);
  const merged = mergeProjectGraphDeltas(one, captureProjectGraphDelta(first, second), second);
  applyProjectGraphDelta(before, merged, 'after');
  expect(before.text).toBe(second.text);
  applyProjectGraphDelta(before, merged, 'before');
  expect(before.text).toBe('a'.repeat(1000000));
});
it.each(['move', 'insert'] as const)(
  'retains only a small %s when a setter replaces a large points array',
  (kind) => {
    const before = { points: Array.from({ length: 10000 }, (_, time) => ({ time, value: 0.2 })) };
    const after = copy(before);
    after.points = after.points.map((point) => ({ ...point }));
    if (kind === 'move') after.points[5000]!.value = 0.8;
    else after.points.unshift({ time: -1, value: 0.5 });
    const delta = captureProjectGraphDelta(before, after);
    expect(estimateProjectGraphDeltaBytes(delta)).toBeLessThan(8192);
    // Capture aligns replacement implementation containers; replay still preserves the authored values.
    applyProjectGraphDelta(before, delta, 'after');
    expect(before.points).toEqual(after.points);
    applyProjectGraphDelta(before, delta, 'before');
    expect(before.points).toHaveLength(10000);
    expect(before.points[5000]!.value).toBe(0.2);
  },
);
it('does not conflate distinct nodes when a replacement deliberately introduces an alias', () => {
  const before = { items: [{ value: 1 }, { value: 1 }] };
  const after = copy(before);
  const shared = { value: 2 };
  after.items = [shared, shared];
  const delta = captureProjectGraphDelta(before, after);
  applyProjectGraphDelta(before, delta, 'after');
  expect(before.items[0]).toBe(before.items[1]);
  applyProjectGraphDelta(before, delta, 'before');
  expect(before.items[0]).not.toBe(before.items[1]);
  expect(before.items.map((item) => item.value)).toEqual([1, 1]);
});
it('preserves immutable/typed values and never writes a frozen decimal in place', () => {
  const before = {
    value: Object.freeze({ coefficient: 123n as bigint, scale: 2 }),
    bytes: new Uint8Array([1, 2, 3]),
    date: new Date(100),
  };
  const after = copy(before);
  after.value = Object.freeze({ coefficient: 456n, scale: 2 });
  after.bytes[1] = 9;
  after.date.setTime(200);
  const delta = captureProjectGraphDelta(before, after);
  applyProjectGraphDelta(before, delta, 'after');
  expect(before.value.coefficient).toBe(456n);
  expect(before.bytes[1]).toBe(9);
  expect(before.date.getTime()).toBe(200);
  applyProjectGraphDelta(before, delta, 'before');
  expect(before.value.coefficient).toBe(123n);
  expect(Object.isFrozen(before.value)).toBe(true);
  expect(before.bytes[1]).toBe(2);
  expect(before.date.getTime()).toBe(100);
});
it('excludes large unchanged map values between multiple changed settings', () => {
  const before = {
    settings: new Map<string, string | number>([
      ['first', 1],
      ['large', 'x'.repeat(1000000)],
      ['last', 2],
    ]),
  };
  const after = copy(before);
  after.settings.set('first', 3);
  after.settings.set('last', 4);
  const delta = captureProjectGraphDelta(before, after);
  expect(estimateProjectGraphDeltaBytes(delta)).toBeLessThan(8192);
  applyProjectGraphDelta(before, delta, 'after');
  expect(before.settings.get('first')).toBe(3);
  expect(before.settings.get('last')).toBe(4);
  applyProjectGraphDelta(before, delta, 'before');
  expect(before.settings.get('first')).toBe(1);
  expect(before.settings.get('last')).toBe(2);
});
it('keeps shared backing buffers when recreating typed views', () => {
  const before: { items: Array<{ bytes: Uint8Array; view: DataView }> } = { items: [] };
  const after = copy(before);
  const buffer = new ArrayBuffer(16);
  const bytes = new Uint8Array(buffer, 4, 4);
  bytes[0] = 7;
  after.items.push({ bytes, view: new DataView(buffer, 2, 8) });
  const delta = captureProjectGraphDelta(before, after);
  applyProjectGraphDelta(before, delta, 'after');
  expect(before.items[0]!.bytes.buffer).toBe(before.items[0]!.view.buffer);
  expect(before.items[0]!.bytes.byteOffset).toBe(4);
  expect(before.items[0]!.view.getUint8(2)).toBe(7);
  applyProjectGraphDelta(before, delta, 'before');
  expect(before.items).toHaveLength(0);
});
it('rejects a frozen collection before writing any earlier field', () => {
  const before = { title: 'before', items: [1, 2] };
  const after = copy(before);
  after.title = 'after';
  after.items.push(3);
  const delta = captureProjectGraphDelta(before, after);
  Object.freeze(before.items);
  expect(() => applyProjectGraphDelta(before, delta, 'after')).toThrow('no longer writable');
  expect(before.title).toBe('before');
  expect(before.items).toEqual([1, 2]);
});
