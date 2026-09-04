import { describe, expect, it } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  AutomationCurve,
  BSBKnob,
  BlueX7,
  GenericInstrument,
  OpcodeDefinition,
  Preset,
  PresetGroup,
  TrackLayerGroup,
  UDOStyle,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createInstrumentSnapshot,
  createTrackInstrumentEditorSnapshot,
  type TrackRef,
} from './project-editor';

function createInstrumentProject(): { data: BlueData; ref: TrackRef } {
  const data = new BlueData();
  data.getScore().length = 0;
  const group = new TrackLayerGroup();
  group.setUniqueId('instrument-group');
  const track = group.newLayerAt(0);
  track.setUniqueId('instrument-track');
  data.getScore().push(group);
  return {
    data,
    ref: {
      rootGroupId: group.getUniqueId(),
      trackId: track.getUniqueId(),
      projectSessionId: 4,
      projectRevision: 2,
    },
  };
}

describe('Track instrument project patches', () => {
  it('creates a BlueX7 Track instrument with a complete editor snapshot', () => {
    const { data, ref } = createInstrumentProject();
    const context = { projectSessionId: 4, projectRevision: 2 };
    const track = data.getScore()[0]![0]!;

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'createTrackInstrument',
            track: ref,
            instrumentType: 'blueX7',
          },
        },
        context,
      ),
    ).toBe(true);

    const instrument = track.getInstrument();
    expect(instrument).toBeInstanceOf(BlueX7);
    const snapshot = createInstrumentSnapshot(track.getUniqueId(), instrument);
    expect(snapshot.type).toBe('blueX7');
    if (snapshot.type !== 'blueX7') throw new Error('expected a BlueX7 snapshot');
    expect(snapshot.voice.common.algorithm).toBe(19);
  });

  it('creates, replaces, updates, clears, and copies Track instruments independently', () => {
    const { data, ref } = createInstrumentProject();
    const context = { projectSessionId: 4, projectRevision: 2 };
    const track = data.getScore()[0]![0]!;

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'createTrackInstrument',
            track: { ...ref, ...context },
            instrumentType: 'generic',
          },
        },
        context,
      ),
    ).toBe(true);
    const created = track.getInstrument();
    expect(created).toBeInstanceOf(GenericInstrument);

    const source = new GenericInstrument();
    source.setName('Replacement');
    source.setText('outs a1, a1');
    const snapshot = createInstrumentSnapshot('source', source);
    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'replaceTrackInstrument',
            track: { ...ref, ...context },
            instrument: snapshot,
          },
        },
        context,
      ),
    ).toBe(true);
    expect(track.getInstrument()).not.toBe(source);
    expect(track.getInstrument()?.getName()).toBe('Replacement');

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'updateTrackInstrument',
            track: ref,
            patch: { name: 'Updated', text: 'out a1' },
          },
        },
        context,
      ),
    ).toBe(true);
    expect(track.getInstrument()?.getName()).toBe('Updated');
    expect((track.getInstrument() as GenericInstrument).getText()).toBe('out a1');

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'replaceTrackInstrument',
            track: { ...ref, rootGroupId: 'wrong-group' },
            instrument: snapshot,
          },
        },
        context,
      ),
    ).toBe(false);
    expect(track.getInstrument()?.getName()).toBe('Updated');

    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: { type: 'clearTrackInstrument', track: ref },
        },
        context,
      ),
    ).toBe(true);
    expect(track.getInstrument()).toBeNull();
  });

  it('reifies a copied BSB instrument with its interface, presets, UDOs, and replacements intact', () => {
    const { data, ref } = createInstrumentProject();
    const context = { projectSessionId: 4, projectRevision: 2 };
    const source = new BlueSynthBuilder();
    source.setName('Copy Source');
    source.setInstrumentText('aout oscili <gain>, 440\nouts aout, aout');

    const gain = source.getGraphicInterface().createWidgetByType('BSBKnob') as BSBKnob;
    gain.objectName = 'gain';
    gain.value = 0.25;
    gain.automationAllowed = true;
    source.getGraphicInterface().getRootGroup().addChild(gain);
    const sourceParameter = source.getParameters()[0]!;
    sourceParameter.setLabel('Gain automation');
    sourceParameter.setAutomationEnabled(true);
    sourceParameter.setCurve(AutomationCurve.STEP);
    sourceParameter.setPoints([
      { time: 0, value: 0.25 },
      { time: 1, value: 0.75 },
    ]);

    const preset = new Preset();
    preset.setPresetName('Loud');
    preset.setValue('gain', 'ver2:0.75');
    const presets = new PresetGroup();
    presets.presets.push(preset);
    presets.setCurrentPresetUniqueId(preset.getUniqueId());
    source.setPresetGroup(presets);

    const udo = new OpcodeDefinition();
    udo.setName('copyUdo');
    udo.setStyle(UDOStyle.CLASSIC);
    udo.setOutTypes('a');
    udo.setInTypes('a');
    udo.setCode('ain xin\nxout ain');
    source.getOpcodeList().addOpcode(udo);

    const snapshot = createInstrumentSnapshot('source', source);
    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: {
            type: 'replaceTrackInstrument',
            track: ref,
            instrument: snapshot,
          },
        },
        context,
      ),
    ).toBe(true);

    const copied = data.getScore()[0]![0]!.getInstrument();
    expect(copied).toBeInstanceOf(BlueSynthBuilder);
    const copiedBsb = copied as BlueSynthBuilder;
    const copiedWidget = copiedBsb.getGraphicInterface().getRootGroup().getChildren()[0]!;
    expect(copiedWidget.id).not.toBe(gain.id);
    const copiedParameter = copiedBsb
      .getParameters()
      .find((parameter) => parameter.getName() === 'gain')!;
    expect(copiedParameter.getUniqueId()).not.toBe(sourceParameter.getUniqueId());
    expect(copiedParameter.getLabel()).toBe('Gain automation');
    expect(copiedParameter.isAutomationEnabled()).toBe(true);
    expect(copiedParameter.getCurve()).toBe(AutomationCurve.STEP);
    expect(copiedParameter.getPoints()).toEqual(sourceParameter.getPoints());
    const copiedPresetGroup = copiedBsb.getPresetGroup()!;
    expect(copiedPresetGroup.getPresets()).toHaveLength(1);
    expect(copiedPresetGroup.getPresets()[0]!.getUniqueId()).not.toBe(preset.getUniqueId());
    expect(copiedPresetGroup.getCurrentPresetUniqueId()).toBe(
      copiedPresetGroup.getPresets()[0]!.getUniqueId(),
    );
    expect(copiedBsb.getOpcodeList().getOpcodes()).toHaveLength(1);
    expect(data.toCSD()).not.toContain('<gain>');
  });

  it('editor-open reads leave the canonical document and its .blue serialization untouched', () => {
    const { data, ref } = createInstrumentProject();
    const context = { projectSessionId: 4, projectRevision: 2 };
    expect(
      applyProjectDocumentPatch(
        data,
        {
          score: { type: 'createTrackInstrument', track: ref, instrumentType: 'blueX7' },
        },
        context,
      ),
    ).toBe(true);

    const beforeXml = data.saveToString();
    const beforeCsd = data.toCSD();

    const request = { track: { ...ref } };
    expect(createTrackInstrumentEditorSnapshot(data, request)).not.toBeNull();

    // Opening/focusing an editor is a read: the canonical project content,
    // its generated CSD, and its serialization must be byte-identical.
    expect(data.saveToString()).toBe(beforeXml);
    expect(data.toCSD()).toBe(beforeCsd);
  });
});
