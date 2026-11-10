import { describe, expect, it, vi } from 'vitest';
import {
  BSBHSlider,
  BSBHSliderBank,
  BSBXYController,
  BSBCheckBox,
  BSBDropdown,
  BSBTextField,
  BSBFileSelector,
  BlueData,
  BlueSynthBuilder,
  Effect,
  Parameter,
  Preset,
  PresetGroup,
  ScoreTrack,
  TrackLayerGroup,
} from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import {
  ProjectRuntimeReconciliation,
  type RuntimeWorkOperation,
} from './project-runtime-reconciliation';
import { MockHistoryContext } from './project-history-test-support';
import { getMixerEntrySnapshotId, getBsbGestureTargetId } from '../shared/project-editor/identity';
import { prepareTransaction } from './project-history-memento';
import type { BsbInterfacePatch, ProjectDocumentPatch } from '../shared/project-editor';

function setup(bytesLimit = 64 * 1024 * 1024) {
  const data = new BlueData();
  data.getGlobalOrcSco().setGlobalOrc('; unrelated project content\n'.repeat(40000));
  const instrument = new BlueSynthBuilder();
  const slider = new BSBHSlider();
  slider.id = 'gain-widget';
  slider.objectName = 'gain';
  slider.value = 0.2;
  instrument.getGraphicInterface().getRootGroup().addChild(slider);
  instrument.getParameters();
  const preset = new Preset();
  preset.setValue('gain', 'ver2:0.8');
  const group = new PresetGroup();
  group.presets.push(preset);
  instrument.setPresetGroup(group);
  data.getArrangement().addInstrument(instrument, '6');
  const session = new ProjectSession();
  session.replace(data);
  const reconciliation = {
    drainPreviews: vi.fn(async () => {}),
    reconcileCommit: vi.fn(async () => []),
  };
  const history = new ProjectHistory({
    session,
    retainedBytesLimit: bytesLimit,
    publishUpdated: () => {},
    reconciliation: reconciliation as unknown as ProjectRuntimeReconciliation,
  });
  history.checkpointSave();
  const context = new MockHistoryContext('compact');
  const commit = (patches: ProjectDocumentPatch[], overrides = {}) =>
    history.commit(
      context.nextCommitRequest(
        session.read().documentId!,
        session.read().revision,
        'BSB edit',
        patches,
        overrides,
      ),
    );
  const bsb = (patch: BsbInterfacePatch): ProjectDocumentPatch => ({
    orchestra: { type: 'updateInstrument', assignmentId: '6', patch: { bsbInterface: patch } },
  });
  const value = (v: number) =>
    bsb({ type: 'updateWidgetProperties', widgetId: slider.id, properties: { value: v } });
  return {
    data,
    instrument,
    slider,
    preset,
    group,
    session,
    history,
    context,
    commit,
    bsb,
    value,
    reconciliation,
  };
}

describe('compact history', () => {
  it('retains a slider edit independently of unrelated project size and restores canonical state', async () => {
    const f = setup();
    const before = f.data.saveToString();
    expect((await f.commit([f.value(0.5)])).status).toBe('committed');
    const after = f.session.read().data!.saveToString();
    expect(f.history.read().retainedBytes).toBeLessThan(8192);
    expect(
      (
        await f.history.undo(
          f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
        )
      ).status,
    ).toBe('committed');
    expect(f.session.read().data!.saveToString()).toBe(before);
    expect(f.history.isDirty()).toBe(false);
    await f.history.redo(
      f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.session.read().data!.saveToString()).toBe(after);
  });

  it('evicts ordinary old entries when the byte budget fills', async () => {
    const f = setup(6000);
    for (let i = 0; i < 12; i++) {
      expect(
        (await f.commit([{ projectProperties: { title: String(i).repeat(100) } }])).status,
      ).toBe('committed');
    }
    expect(f.history.read().retainedBytes).toBeLessThanOrEqual(6000);
    expect(f.history.read().length).toBeLessThan(12);
  });
});

describe('compact BSB lifecycle and owners', () => {
  it('preserves preset metadata, widget/parameter references and automation through undo/redo', async () => {
    const f = setup();
    const parameter = f.instrument.getParameters()[0]!;
    parameter.setAutomationEnabled(true);
    parameter.setPoints(Array.from({ length: 1000 }, (_, time) => ({ time, value: 0.3 })));
    const widgetIdentity = getBsbGestureTargetId(f.slider);
    const before = f.data.saveToString();
    await f.commit([f.bsb({ type: 'applyPreset', presetUniqueId: f.preset.getUniqueId() })]);
    const after = f.data.saveToString();
    expect(f.history.getEntries()[0]!.record.kind).toBe('bsb');
    expect(f.history.read().retainedBytes).toBeLessThan(8192);
    expect(f.group.currentPresetUniqueId).toBe(f.preset.getUniqueId());
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.data.saveToString()).toBe(before);
    expect(f.instrument.getGraphicInterface().findWidgetById(f.slider.id)).toBe(f.slider);
    expect(f.instrument.getParameters()[0]).toBe(parameter);
    expect(getBsbGestureTargetId(f.slider)).toBe(widgetIdentity);
    await f.history.redo(
      f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.data.saveToString()).toBe(after);
    expect(parameter.getPoints()).toHaveLength(1000);
  });

  it('keeps one bounded record and bounded replay patches for hundreds of drag updates', async () => {
    const f = setup();
    const before = f.data.saveToString();
    await f.commit([f.value(0.3)], { gestureId: 'drag', phase: 'begin' });
    const size = f.history.read().retainedBytes;
    for (let i = 0; i < 100; i++)
      await f.commit([f.value(0.4 + i / 1000)], { gestureId: 'drag', phase: 'update' });
    expect(f.history.read().length).toBe(1);
    expect(f.history.read().retainedBytes).toBeLessThan(size + 100);
    expect(f.history.getEntries()[0]!.forwardPatches).toHaveLength(1);
    expect(f.history.getEntries()[0]!.inversePatches).toHaveLength(1);
    await f.commit([], { gestureId: 'drag', phase: 'cancel' });
    expect(f.data.saveToString()).toBe(before);
    expect(f.history.read().length).toBe(0);
    expect(f.history.isDirty()).toBe(false);
  });

  it('restores prior redo history and dirty state on net-zero settlement', async () => {
    const f = setup();
    await f.commit([f.value(0.7)]);
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    const ledger = [...f.history.getEntries()];
    const baseline = f.session.read().stateId;
    await f.commit([f.value(0.4)], { gestureId: 'zero', phase: 'begin' });
    await f.commit([f.value(0.2)], { gestureId: 'zero', phase: 'update' });
    expect((await f.commit([], { gestureId: 'zero', phase: 'end' })).status).toBe('unchanged');
    expect(f.history.getEntries()).toEqual(ledger);
    expect(f.history.read().canRedo).toBe(true);
    expect(f.history.isDirty()).toBe(false);
    expect(f.session.read().stateId).toBe(baseline);
  });

  it('admits a live edit at the completed byte limit and restores evicted entries on cancel', async () => {
    const f = setup(6000);
    for (let i = 0; i < 12; i++)
      await f.commit([{ projectProperties: { title: String(i).repeat(100) } }]);
    const ledger = [...f.history.getEntries()];
    const baseline = f.data.saveToString();
    expect((await f.commit([f.value(0.5)], { gestureId: 'full', phase: 'begin' })).status).toBe(
      'committed',
    );
    expect(f.history.read().retainedBytes).toBeLessThanOrEqual(12000);
    await f.commit([], { gestureId: 'full', phase: 'cancel' });
    expect(f.history.getEntries()).toEqual(ledger);
    expect(f.data.saveToString()).toBe(baseline);
  });

  it.each(['scalar', 'structure'] as const)('restores a mixed compact/%s group', async (kind) => {
    const f = setup();
    const before = f.data.saveToString();
    await f.commit([f.value(0.5)], { gestureId: 'mixed', phase: 'begin' });
    const patch: ProjectDocumentPatch =
      kind === 'scalar'
        ? { projectProperties: { title: 'new' } }
        : {
            orchestra: { type: 'updateInstrument', assignmentId: '6', patch: { name: 'renamed' } },
          };
    await f.commit([patch], { gestureId: 'mixed', phase: 'update' });
    await f.commit([], { gestureId: 'mixed', phase: 'end' });
    const after = f.session.read().data!.saveToString();
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.session.read().data!.saveToString()).toBe(before);
    await f.history.redo(
      f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.session.read().data!.saveToString()).toBe(after);
  });

  it.each(['track', 'effect'] as const)('uses compact history for %s controls', async (kind) => {
    const f = setup();
    let patch: () => ProjectDocumentPatch;
    if (kind === 'track') {
      const group = new TrackLayerGroup();
      const track = new ScoreTrack();
      track.setInstrument(f.instrument.deepCopy('history'));
      group.push(track);
      f.data.getScore().push(group);
      patch = () => ({
        score: {
          type: 'updateTrackInstrument',
          track: {
            rootGroupId: group.getUniqueId(),
            trackId: track.getUniqueId(),
            projectSessionId: f.session.read().sessionId,
            projectRevision: f.session.read().revision,
          },
          patch: {
            bsbInterface: {
              type: 'updateWidgetProperties',
              widgetId: (track.getInstrument() as BlueSynthBuilder)
                .getGraphicInterface()
                .getRootGroup()
                .getChildren()[0]!.id,
              properties: { value: 0.6 },
            },
          },
        },
      });
    } else {
      const effect = new Effect();
      effect.getGraphicInterface().getRootGroup().addChild(f.slider.deepCopy('history'));
      const parameter = new Parameter();
      parameter.setName('gain');
      parameter.setFixedValue(0.2);
      effect.setParameters([parameter]);
      f.data.getMixer().getMaster().getPreEffects().push(effect);
      patch = () => ({
        mixer: {
          type: 'updateEffect',
          channelId: 'Master',
          chain: 'pre',
          entryId: getMixerEntrySnapshotId(effect),
          patch: {
            bsbInterface: {
              type: 'updateWidgetProperties',
              widgetId: f.slider.id,
              properties: { value: 0.6 },
            },
          },
        },
      });
    }
    const before = f.data.saveToString();
    const response = await f.commit([patch()]);
    if (response.status !== 'committed') throw new Error(JSON.stringify(response));
    expect(f.history.getEntries()[0]!.record.kind).toBe('bsb');
    expect(f.history.read().retainedBytes).toBeLessThan(8192);
    const after = f.data.saveToString();
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.data.saveToString()).toBe(before);
    await f.history.redo(
      f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.data.saveToString()).toBe(after);
  });

  it('rejects a failed batch without publishing any earlier widget change', async () => {
    const f = setup();
    const before = f.data.saveToString();
    const response = await f.commit([
      f.value(0.8),
      f.bsb({ type: 'updateWidgetProperties', widgetId: 'missing', properties: { value: 0.9 } }),
    ]);
    expect(response.status).toBe('invalid');
    expect(f.data.saveToString()).toBe(before);
    expect(f.history.read().length).toBe(0);
  });

  it.each(['undo', 'redo'] as const)(
    'leaves the cursor unchanged on failed %s target resolution',
    async (direction) => {
      const f = setup();
      await f.commit([f.value(0.5)]);
      if (direction === 'redo')
        await f.history.undo(
          f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
        );
      f.instrument.getGraphicInterface().removeWidget(f.slider.id);
      const cursor = f.history.getCursor();
      const stateId = f.session.read().stateId;
      const response =
        direction === 'undo'
          ? await f.history.undo(
              f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
            )
          : await f.history.redo(
              f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
            );
      expect(response.status).toBe('failed');
      expect(f.history.getCursor()).toBe(cursor);
      expect(f.session.read().stateId).toBe(stateId);
    },
  );

  it('compacts parameter-schema changes in the owner path', () => {
    const f = setup();
    const result = prepareTransaction(f.data, [
      f.bsb({
        type: 'updateWidgetProperties',
        widgetId: f.slider.id,
        properties: { objectName: 'new-name' },
      }),
    ]);
    expect(result.status).toBe('prepared');
    if (result.status === 'prepared') expect(result.transaction.kind).toBe('bsb');
  });

  it('reconciles final and baseline values for both running performances', async () => {
    const f = setup();
    const operations: RuntimeWorkOperation[] = [];
    const reconciliation = new ProjectRuntimeReconciliation();
    for (const kind of ['timeline', 'blueLive'] as const)
      reconciliation.registerPerformance(
        kind,
        1,
        {
          async applyOperation(operation) {
            operations.push(operation);
            return { status: 'applied' };
          },
        },
        new Map([['arrangement:6::bsb:gain-widget', { kind: 'channel', channel: 'gk_gain' }]]),
      );
    const history = new ProjectHistory({ session: f.session, reconciliation });
    const commit = (v: number, phase: 'begin' | 'update' | 'end' | 'cancel') =>
      history.commit(
        f.context.nextCommitRequest(
          f.session.read().documentId!,
          f.session.read().revision,
          'Drag gain',
          phase === 'cancel' || phase === 'end' ? [] : [f.value(v)],
          { gestureId: 'runtime', phase },
        ),
      );
    await commit(0.5, 'begin');
    await commit(0.9, 'update');
    await commit(0, 'end');
    operations.length = 0;
    await history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(operations).toEqual([
      expect.objectContaining({ kind: 'channel-value', value: 0.2 }),
      expect.objectContaining({ kind: 'channel-value', value: 0.2 }),
    ]);
    operations.length = 0;
    await history.redo(
      f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(operations).toEqual([
      expect.objectContaining({ value: 0.9 }),
      expect.objectContaining({ value: 0.9 }),
    ]);
    operations.length = 0;
    await commit(0.4, 'begin');
    await commit(0, 'cancel');
    expect(operations.slice(-2)).toEqual([
      expect.objectContaining({ value: 0.9 }),
      expect.objectContaining({ value: 0.9 }),
    ]);
  });
});

describe('compact BSB control shapes', () => {
  it('also compacts the legacy named-control patch path', async () => {
    const f = setup();
    const before = f.data.saveToString();
    await f.commit([
      {
        orchestra: {
          type: 'updateInstrument',
          assignmentId: '6',
          patch: { bsbWidgetValues: { gain: 0.8 } },
        },
      },
    ]);
    expect(f.history.getEntries()[0]!.record.kind).toBe('bsb');
    expect(f.history.read().retainedBytes).toBeLessThan(8192);
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.data.saveToString()).toBe(before);
  });

  it.each([
    [
      'bank',
      () => new BSBHSliderBank(),
      { type: 'updateSliderBankValue', sliderIndex: 0, value: 0.7 },
    ],
    [
      'XY',
      () => new BSBXYController(),
      { type: 'updateWidgetProperties', properties: { xValue: 0.4, yValue: 0.6 } },
    ],
    [
      'checkbox',
      () => new BSBCheckBox(),
      { type: 'updateWidgetProperties', properties: { selected: true } },
    ],
    [
      'dropdown',
      () => new BSBDropdown(),
      { type: 'updateWidgetProperties', properties: { selectedIndex: 1 } },
    ],
    [
      'text',
      () => new BSBTextField(),
      { type: 'updateWidgetProperties', properties: { textValue: 'new text' } },
    ],
    [
      'file',
      () => new BSBFileSelector(),
      { type: 'updateWidgetProperties', properties: { fileName: 'new file.wav' } },
    ],
  ] as const)(
    'restores %s values without retaining unrelated project content',
    async (_name, create, edit) => {
      const f = setup();
      const widget = create();
      widget.id = 'extra';
      widget.objectName = 'extra';
      if (widget instanceof BSBDropdown)
        widget.dropdownItems = [
          { name: 'a', value: '0', uniqueId: 'a' },
          { name: 'b', value: '1', uniqueId: 'b' },
        ];
      f.instrument.getGraphicInterface().getRootGroup().addChild(widget);
      f.instrument.getParameters();
      const before = f.data.saveToString();
      expect(
        (await f.commit([f.bsb({ ...edit, widgetId: widget.id } as BsbInterfacePatch)])).status,
      ).toBe('committed');
      expect(f.history.getEntries()[0]!.record.kind).toBe('bsb');
      expect(f.history.read().retainedBytes).toBeLessThan(12000);
      const after = f.data.saveToString();
      expect(after).not.toBe(before);
      await f.history.undo(
        f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
      );
      expect(f.data.saveToString()).toBe(before);
      await f.history.redo(
        f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
      );
      expect(f.data.saveToString()).toBe(after);
    },
  );

  it('retains earliest baseline for every widget in a grouped edit', async () => {
    const f = setup();
    const second = f.slider.deepCopy('history');
    second.id = 'second';
    second.objectName = 'second';
    second.value = 0.1;
    f.instrument.getGraphicInterface().getRootGroup().addChild(second);
    f.instrument.getParameters();
    const before = f.data.saveToString();
    await f.commit([f.value(0.5)], { gestureId: 'both', phase: 'begin' });
    await f.commit(
      [f.bsb({ type: 'updateWidgetProperties', widgetId: second.id, properties: { value: 0.7 } })],
      { gestureId: 'both', phase: 'update' },
    );
    await f.commit([f.value(0.9)], { gestureId: 'both', phase: 'end' });
    const after = f.data.saveToString();
    expect(f.history.getEntries()[0]!.inversePatches).toHaveLength(2);
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.data.saveToString()).toBe(before);
    await f.history.redo(
      f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.data.saveToString()).toBe(after);
  });

  it('keeps move/resize compact and restores geometry on cancel', async () => {
    const f = setup();
    const before = f.data.saveToString();
    await f.commit([f.bsb({ type: 'moveWidget', widgetId: f.slider.id, x: 20, y: 30 })], {
      gestureId: 'move',
      phase: 'begin',
    });
    expect(f.history.getEntries()[0]!.record.kind).toBe('bsb');
    await f.commit([f.bsb({ type: 'moveWidget', widgetId: f.slider.id, x: 50, y: 60 })], {
      gestureId: 'move',
      phase: 'update',
    });
    await f.commit(
      [
        f.bsb({
          type: 'updateWidgetProperties',
          widgetId: f.slider.id,
          properties: { sliderWidth: 250 },
        }),
      ],
      { gestureId: 'move', phase: 'update' },
    );
    expect(f.history.getEntries()[0]!.record.kind).toBe('bsb');
    await f.commit([], { gestureId: 'move', phase: 'cancel' });
    expect(f.data.saveToString()).toBe(before);
  });

  it('rejects a growing complete action before publication and reports its real size', async () => {
    const f = setup(6000);
    const widget = new BSBTextField();
    widget.id = 'text';
    widget.objectName = 'text';
    f.instrument.getGraphicInterface().getRootGroup().addChild(widget);
    f.instrument.getParameters();
    const before = f.data.saveToString();
    const patch = (length: number) =>
      f.bsb({
        type: 'updateWidgetProperties',
        widgetId: widget.id,
        properties: { textValue: 'x'.repeat(length) },
      });
    await f.commit([patch(20)], { gestureId: 'grow', phase: 'begin' });
    const result = await f.commit([patch(4000)], { gestureId: 'grow', phase: 'update' });
    expect(result.status).toBe('oversize');
    if (result.status === 'oversize') {
      expect(result.estimatedBytes).toBeGreaterThan(result.limitBytes);
      expect(result.explanation).toContain('per-action limit');
    }
    expect(f.data.saveToString()).toBe(before);
    expect(f.history.read().length).toBe(0);
  });
});

describe('compact widget references', () => {
  it('preserves unchanged dropdown items and edited bank slider objects', async () => {
    const f = setup();
    const dropdown = new BSBDropdown();
    dropdown.id = 'dropdown';
    dropdown.objectName = 'choice';
    dropdown.dropdownItems = [
      { name: 'a', value: '0', uniqueId: 'a' },
      { name: 'b', value: '1', uniqueId: 'b' },
    ];
    const bank = new BSBHSliderBank();
    bank.id = 'bank';
    bank.objectName = 'bank';
    f.instrument.getGraphicInterface().getRootGroup().addChild(dropdown);
    f.instrument.getGraphicInterface().getRootGroup().addChild(bank);
    f.instrument.getParameters();
    const item = dropdown.dropdownItems[0];
    const bankSlider = bank.sliders[0];
    await f.commit([
      f.bsb({
        type: 'updateWidgetProperties',
        widgetId: dropdown.id,
        properties: { selectedIndex: 1 },
      }),
      f.bsb({ type: 'updateSliderBankValue', widgetId: bank.id, sliderIndex: 0, value: 0.7 }),
    ]);
    expect(dropdown.dropdownItems[0]).toBe(item);
    expect(bank.sliders[0]).toBe(bankSlider);
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(dropdown.dropdownItems[0]).toBe(item);
    expect(bank.sliders[0]).toBe(bankSlider);
  });
});

it('preserves the current compiled string channel when replaying file controls', async () => {
  const f = setup();
  const file = new BSBFileSelector();
  file.id = 'file';
  file.objectName = 'file';
  f.instrument.getGraphicInterface().getRootGroup().addChild(file);
  f.instrument.getParameters();
  file.getStringChannel()!.channelName = 'gS_old';
  await f.commit([
    f.bsb({
      type: 'updateWidgetProperties',
      widgetId: file.id,
      properties: { fileName: 'new.wav' },
    }),
  ]);
  file.getStringChannel()!.channelName = 'gS_new';
  await f.history.undo(
    f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
  );
  expect(file.getStringChannel()!.channelName).toBe('gS_new');
  expect(file.getStringChannel()!.value).toBe('');
  await f.history.redo(
    f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
  );
  expect(file.getStringChannel()!.channelName).toBe('gS_new');
  expect(file.getStringChannel()!.value).toBe('new.wav');
});
