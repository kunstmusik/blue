import { describe, it, expect, vi } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  BSBHSlider,
  BSBDropdown,
  BSBGroup,
  BSBCheckBox,
  BSBHSliderBank,
  BSBXYController,
  BSBLabel,
  Preset,
  PresetGroup,
  Sound,
  TrackLayerGroup,
} from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { MockHistoryContext } from './project-history-test-support';
import type {
  BsbInterfacePatch,
  ProjectDocumentPatch,
  ScoreObjectEditorTargetSnapshot,
} from '../shared/project-editor';
import {
  assignExplicitScoreObjectId,
  getBsbGestureTargetId,
} from '../shared/project-editor/identity';
import { createDefaultBsbWidgetSnapshot } from '../shared/project-editor/bsb-widgets';
import { reconcileMixerWithArrangement } from '../shared/project-editor/snapshot-mixer-orchestra';

function setup(soundOwned = false) {
  const data = new BlueData();
  data.getGlobalOrcSco().setGlobalOrc('; unrelated\n'.repeat(15000));
  const instrument = new BlueSynthBuilder();
  instrument.setInstrumentText('; unchanged instrument code\n'.repeat(5000));
  const slider = new BSBHSlider();
  slider.id = 'gain';
  slider.objectName = 'gain';
  slider.value = 0.2;
  const dropdown = new BSBDropdown();
  dropdown.id = 'choice';
  dropdown.objectName = 'choice';
  dropdown.dropdownItems = [
    { name: 'a', value: '0', uniqueId: 'a' },
    { name: 'b', value: '1', uniqueId: 'b' },
  ];
  const bank = new BSBHSliderBank();
  bank.id = 'bank';
  bank.objectName = 'bank';
  const xy = new BSBXYController();
  xy.id = 'xy';
  xy.objectName = 'xy';
  const label = new BSBLabel();
  label.id = 'label';
  const nested = new BSBGroup();
  nested.id = 'nested';
  const check = new BSBCheckBox();
  check.id = 'check';
  check.objectName = 'check';
  nested.addChild(check);
  const root = instrument.getGraphicInterface().getRootGroup();
  [slider, dropdown, bank, xy, label, nested].forEach((w) => root.addChild(w));
  instrument.getParameters();
  const presets = new PresetGroup();
  const preset = new Preset();
  preset.uniqueId = 'preset';
  preset.setPresetName('before');
  preset.setValue('gain', 'ver2:0.8');
  preset.setValue('obsolete', 'old');
  presets.presets.push(preset);
  const folder = new PresetGroup();
  folder.presetGroupName = 'folder';
  const other = new PresetGroup();
  other.presetGroupName = 'other';
  presets.subGroups.push(folder, other);
  instrument.setPresetGroup(presets);
  instrument.addUdo();
  instrument.addUdo();
  instrument.updateUdo(0, { name: 'first' });
  instrument.updateUdo(1, { name: 'second' });
  data.getArrangement().addInstrument(instrument, '6');
  reconcileMixerWithArrangement(data);
  const sound = new Sound();
  sound.setBSBInstrumentText(instrument.saveAsXML().toXml());
  if (soundOwned) {
    const group = new TrackLayerGroup();
    group.newLayerAt(0).push(sound);
    data.getScore().length = 0;
    data.getScore().push(group);
    assignExplicitScoreObjectId(sound, 'sound');
  }
  const session = new ProjectSession();
  session.replace(data);
  const history = new ProjectHistory({ session });
  history.checkpointSave();
  const context = new MockHistoryContext('all-bsb');
  const wrap = (bsbInterface: BsbInterfacePatch): ProjectDocumentPatch =>
    soundOwned
      ? {
          score: {
            type: 'updateTypeSpecificEditor',
            target: {
              selectionId: 'sound',
              selectedObjectType: 'Sound',
              editorObjectType: 'Sound',
              ownerKind: 'timeline',
              displayContext: 'timeline',
              supportsTimeBehavior: true,
              supportsRepeatPoint: true,
              supportsNoteProcessorChain: true,
              location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
            } satisfies ScoreObjectEditorTargetSnapshot,
            patch: { bsbInterfacePatch: bsbInterface },
          },
        }
      : { orchestra: { type: 'updateInstrument', assignmentId: '6', patch: { bsbInterface } } };
  const commit = (patch: BsbInterfacePatch, metadata = {}) =>
    history.commit(
      context.nextCommitRequest(
        session.read().documentId!,
        session.read().revision,
        patch.type,
        [wrap(patch)],
        metadata,
      ),
    );
  const fingerprints = () => {
    const owner = session.read().data!.getArrangement().getInstrumentById('6') as BlueSynthBuilder;
    const values: Array<[string, string]> = [];
    const walk = (w: BSBHSlider | BSBGroup | object): void => {
      if ('id' in w) values.push([String(w.id), getBsbGestureTargetId(w)]);
      if (w instanceof BSBGroup) w.getChildren().forEach(walk);
    };
    walk(owner.getGraphicInterface().getRootGroup());
    return {
      widgets: values,
      parameters: owner.getParameters().map((p) => [p.getUniqueId(), p.getName()]),
    };
  };
  return {
    data,
    instrument,
    session,
    history,
    context,
    commit,
    wrap,
    slider,
    dropdown,
    nested,
    bank,
    xy,
    presets,
    fingerprints,
  };
}
type Fixture = ReturnType<typeof setup>;
const cases: Record<BsbInterfacePatch['type'], (f: Fixture) => BsbInterfacePatch> = {
  setEditEnabled: () => ({ type: 'setEditEnabled', value: false }),
  selectWidget: () => ({ type: 'selectWidget', widgetId: 'gain' }),
  updateWidgetProperties: () => ({
    type: 'updateWidgetProperties',
    widgetId: 'gain',
    properties: { comment: 'new comment' },
  }),
  updateSliderBankValue: () => ({
    type: 'updateSliderBankValue',
    widgetId: 'bank',
    sliderIndex: 0,
    value: 0.7,
  }),
  moveWidget: () => ({ type: 'moveWidget', widgetId: 'gain', x: 20, y: 30 }),
  resizeWidget: () => ({ type: 'resizeWidget', widgetId: 'xy', width: 400, height: 300 }),
  addWidget: () => ({
    type: 'addWidget',
    widgetType: 'BSBHSlider',
    widgetId: 'new-widget',
    x: 10,
    y: 20,
  }),
  removeWidget: () => ({ type: 'removeWidget', widgetId: 'gain' }),
  updateGridSettings: () => ({ type: 'updateGridSettings', patch: { width: 37 } }),
  applyPreset: () => ({ type: 'applyPreset', presetUniqueId: 'preset' }),
  updatePreset: () => ({ type: 'updatePreset', presetUniqueId: 'preset' }),
  addPreset: () => ({ type: 'addPreset', presetName: 'new' }),
  addPresetGroup: () => ({ type: 'addPresetGroup', groupName: 'new folder' }),
  addPresetFromSnapshot: () => ({
    type: 'addPresetFromSnapshot',
    parentGroupPath: [0],
    preset: { uniqueId: 'inserted', name: 'inserted', values: { gain: 'ver2:0.6' } },
  }),
  addPresetGroupFromSnapshot: () => ({
    type: 'addPresetGroupFromSnapshot',
    parentGroupPath: [],
    group: {
      name: 'imported',
      currentPresetModified: false,
      subGroups: [],
      presets: [{ uniqueId: 'imported-preset', name: 'imported', values: { gain: 'ver2:0.6' } }],
    },
  }),
  renamePreset: () => ({ type: 'renamePreset', presetUniqueId: 'preset', name: 'renamed' }),
  renamePresetGroup: () => ({ type: 'renamePresetGroup', groupPath: [0], name: 'renamed' }),
  removePreset: () => ({ type: 'removePreset', presetUniqueId: 'preset' }),
  removePresetGroup: () => ({ type: 'removePresetGroup', groupPath: [0] }),
  movePreset: () => ({
    type: 'movePreset',
    presetUniqueId: 'preset',
    parentGroupPath: [0],
    targetIndex: 0,
  }),
  movePresetGroup: () => ({
    type: 'movePresetGroup',
    groupPath: [0],
    parentGroupPath: [],
    targetIndex: 2,
  }),
  synchronizePresets: () => ({ type: 'synchronizePresets' }),
  updateEmbeddedOpcodeList: () => ({
    type: 'updateEmbeddedOpcodeList',
    opcodeList: 'opcode changed, a, 0\naout init 0\nxout aout\nendop',
  }),
  addUdo: () => ({ type: 'addUdo' }),
  removeUdo: () => ({ type: 'removeUdo', index: 0 }),
  updateUdo: () => ({ type: 'updateUdo', index: 0, patch: { comments: 'changed' } }),
  convertUdoStyle: () => ({ type: 'convertUdoStyle', index: 0, style: 'MODERN' }),
  reorderUdo: () => ({ type: 'reorderUdo', from: 0, to: 1 }),
  randomize: () => ({ type: 'randomize' }),
  makeGroup: () => ({
    type: 'makeGroup',
    widgetId: 'created-group',
    widgetIds: ['gain', 'choice'],
  }),
  breakGroup: () => ({ type: 'breakGroup', widgetId: 'nested' }),
  pasteWidgets: () => ({
    type: 'pasteWidgets',
    widgetData: JSON.stringify([createDefaultBsbWidgetSnapshot('BSBHSlider')]),
  }),
};

describe.each([false, true])('every BSB action, Sound-owned=%s', (soundOwned) => {
  it.each(Object.entries(cases))(
    '%s retains only the edit and round-trips canonical state',
    async (name, makePatch) => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.75);
      try {
        const f = setup(soundOwned);
        const beforeIds = f.fingerprints(),
          before = f.data.saveToString();
        const result = await f.commit(makePatch(f));
        if (name === 'selectWidget') {
          expect(result.status).toBe('unchanged');
          expect(f.history.read().length).toBe(0);
          return;
        }
        expect(result.status, JSON.stringify(result)).toBe('committed');
        const after = f.session.read().data!.saveToString(),
          afterIds = f.fingerprints();
        expect(after, name).not.toBe(before);
        expect(f.history.read().retainedBytes, name).toBeLessThan(64000);
        expect(
          (
            await f.history.undo(
              f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
            )
          ).status,
        ).toBe('committed');
        expect(f.session.read().data!.saveToString(), name).toBe(before);
        expect(f.fingerprints()).toEqual(beforeIds);
        expect(f.history.isDirty()).toBe(false);
        expect(
          (
            await f.history.redo(
              f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
            )
          ).status,
        ).toBe('committed');
        expect(f.session.read().data!.saveToString(), name).toBe(after);
        expect(f.fingerprints()).toEqual(afterIds);
      } finally {
        random.mockRestore();
      }
    },
  );
});

describe('all BSB property/configuration families', () => {
  it.each([
    ['gain', { objectName: 'renamed' }],
    ['gain', { minimum: -1 }],
    ['gain', { maximum: 2 }],
    ['gain', { resolutionDecimal: '0.001' }],
    ['gain', { automationAllowed: false }],
    ['gain', { randomizable: false }],
    ['gain', { valueDisplayEnabled: false }],
    ['gain', { comment: 'new' }],
    ['choice', { dropdownItems: [{ name: 'c', value: '3', uniqueId: 'c' }] }],
    ['choice', { fontSize: 20 }],
    ['bank', { numberOfSliders: 3 }],
    ['label', { label: 'new label' }],
    ['label', { 'font.name': 'Serif', 'font.size': 24, 'font.style': 1 }],
    ['nested', { groupName: 'renamed group', x: 50, y: 60 }],
  ] as const)(
    '%s %j remains compact with stable canonical round trips',
    async (widgetId, properties) => {
      const f = setup();
      const before = f.data.saveToString();
      const response = await f.commit({
        type: 'updateWidgetProperties',
        widgetId,
        properties: { ...properties },
      });
      expect(response.status, JSON.stringify(response)).toBe('committed');
      const after = f.session.read().data!.saveToString();
      expect(after).not.toBe(before);
      expect(f.history.read().retainedBytes).toBeLessThan(64000);
      await f.history.undo(
        f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
      );
      expect(f.session.read().data!.saveToString()).toBe(before);
      await f.history.redo(
        f.context.nextRedoRequest(f.session.read().documentId!, f.session.read().revision),
      );
      expect(f.session.read().data!.saveToString()).toBe(after);
    },
  );
  it('bounds a grouped appearance drag and restores the full baseline on cancel', async () => {
    const f = setup();
    const before = f.data.saveToString();
    for (let i = 0; i < 100; i++)
      await f.commit(
        { type: 'updateWidgetProperties', widgetId: 'gain', properties: { comment: String(i) } },
        { gestureId: 'appearance', phase: i === 0 ? 'begin' : 'update' },
      );
    expect(f.history.read().length).toBe(1);
    expect(f.history.read().retainedBytes).toBeLessThan(8000);
    expect(f.history.getEntries()[0]!.forwardPatches).toHaveLength(1);
    await f.history.commit(
      f.context.nextCommitRequest(
        f.session.read().documentId!,
        f.session.read().revision,
        'cancel',
        [],
        { gestureId: 'appearance', phase: 'cancel' },
      ),
    );
    expect(f.session.read().data!.saveToString()).toBe(before);
    expect(f.history.read().length).toBe(0);
  });
  it('stores small spans when editing large global code through the scalar entry point', async () => {
    const f = setup();
    const before = f.data.saveToString();
    const original = f.data.getGlobalOrcSco().getGlobalOrc();
    await f.history.commit(
      f.context.nextCommitRequest(f.session.read().documentId!, f.session.read().revision, 'code', [
        { globalOrc: original + '; appended' },
      ]),
    );
    expect(f.history.read().retainedBytes).toBeLessThan(8000);
    await f.history.undo(
      f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
    );
    expect(f.session.read().data!.saveToString()).toBe(before);
  });
});
it('compacts detached direct host actions with unrelated large project content', async () => {
  const f = setup();
  const before = f.data.saveToString();
  const response = await f.history.commitDirectMutation({
    label: 'host edit',
    mutator: (candidate) => {
      candidate.getProjectProperties().title = 'host title';
      return true;
    },
  });
  expect(response.changed).toBe(true);
  expect(f.history.read().retainedBytes).toBeLessThan(8192);
  await f.history.undo(
    f.context.nextUndoRequest(f.session.read().documentId!, f.session.read().revision),
  );
  expect(f.data.saveToString()).toBe(before);
});
