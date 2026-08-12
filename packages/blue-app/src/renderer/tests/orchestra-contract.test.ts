import { describe, expect, it } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  GenericInstrument,
  JavaScriptInstrument,
  PresetGroup,
  Preset,
  Element,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  type BlueSynthBuilderInstrumentSnapshot,
} from '../../shared/project-editor';

function createProjectWithGenericInstrument(): BlueData {
  const data = new BlueData();
  const instrument = new GenericInstrument();
  instrument.setName('Lead');
  instrument.setComment('lead comment');
  instrument.setText('aout oscili p4, p5');
  data.getArrangement().addInstrument(instrument, '1');
  return data;
}

describe('Orchestra project document contract', () => {
  it('serializes arrangement rows and instrument editor state into project snapshots', () => {
    const data = createProjectWithGenericInstrument();
    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');

    expect(snapshot.orchestra.loaded).toBe(true);
    expect(snapshot.orchestra.arrangement.rows).toContainEqual(
      expect.objectContaining({
        assignmentId: '1',
        enabled: true,
        instrumentName: 'Lead',
        instrumentType: 'generic',
      }),
    );
    expect(snapshot.orchestra.instruments[0]).toEqual(
      expect.objectContaining({
        assignmentId: '1',
        type: 'generic',
        name: 'Lead',
        comment: 'lead comment',
        text: 'aout oscili p4, p5',
      }),
    );
  });

  it('applies orchestra patch intents to the canonical BlueData document', () => {
    const data = createProjectWithGenericInstrument();

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'updateInstrumentComment',
          assignmentId: '1',
          comment: 'edited comment',
        },
      }),
    ).toBe(true);
    expect(data.getArrangement().getInstrumentById('1')?.getComment()).toBe(
      'edited comment',
    );

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'replaceInstrument',
          assignmentId: '1',
          instrumentType: 'javascript',
        },
      }),
    ).toBe(true);
    expect(data.getArrangement().getInstrumentById('1')).toBeInstanceOf(
      JavaScriptInstrument,
    );
  });

  it('converts GenericInstrument assignments to BlueSynthBuilder assignments', () => {
    const data = createProjectWithGenericInstrument();

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'convertGenericToBsb',
          assignmentId: '1',
        },
      }),
    ).toBe(true);

    const instrument = data.getArrangement().getInstrumentById('1');
    expect(instrument).toBeInstanceOf(BlueSynthBuilder);
    expect((instrument as BlueSynthBuilder).getInstrumentText()).toContain('oscili');
  });

  it('duplicates arrangement assignments with deep-copied instruments', () => {
    const data = createProjectWithGenericInstrument();

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'duplicateAssignment',
          sourceAssignmentId: '1',
        },
      }),
    ).toBe(true);

    const assignments = data.getArrangement().getArrangement();
    expect(assignments).toHaveLength(2);
    expect(assignments[0]!.instr).not.toBe(assignments[1]!.instr);
    expect(assignments[1]!.instr.getName()).toBe('Lead');
  });

  it('pastes serializable instrument snapshots as new assignments', () => {
    const data = createProjectWithGenericInstrument();
    const snapshot = createProjectEditorSnapshot(data, null).orchestra.instruments[0]!;

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'pasteInstrument',
          instrument: {
            ...snapshot,
            name: 'Pasted Lead',
          },
        },
      }),
    ).toBe(true);

    const assignments = data.getArrangement().getArrangement();
    expect(assignments).toHaveLength(2);
    expect(assignments[1]!.instr.getName()).toBe('Pasted Lead');
  });

  it('inserts imported instrument snapshots after the selected assignment', () => {
    const data = createProjectWithGenericInstrument();
    const second = new GenericInstrument();
    second.setName('Second');
    data.getArrangement().addInstrument(second, '2');
    const snapshot = createProjectEditorSnapshot(data, null).orchestra.instruments[0]!;

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'pasteInstrument',
          instrument: snapshot,
          insertAfterAssignmentId: '1',
        },
      }),
    ).toBe(true);

    expect(data.getArrangement().getArrangement().map((assignment) => assignment.arrangementId)).toEqual([
      '1', '3', '2',
    ]);
  });
});

function createProjectWithBSBInstrument(): BlueData {
  const data = new BlueData();
  const bsb = new BlueSynthBuilder();
  bsb.setName('BSB Test');
  bsb.setInstrumentText('aout oscili <amp>, 440');
  const gi = bsb.getGraphicInterface();
  const giXml = `<graphicInterface editEnabled="true">
    <gridSettings><width>10</width><height>10</height><gridStyle>DOT</gridStyle><snapGridEnabled>true</snapGridEnabled></gridSettings>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
      <objectName>amp</objectName>
      <x>10</x><y>20</y>
      <value>0.5</value>
      <minimum>0</minimum><maximum>1</maximum>
      <knobWidth>60</knobWidth>
    </bsbObject>
  </graphicInterface>`;
  gi.loadFromXML(Element.parse(giXml));
  bsb.setGraphicInterface(gi);

  const presetGroup = new PresetGroup();
  const preset = new Preset();
  preset.presetName = 'Default';
  preset.uniqueId = 'p1';
  preset.setValue('amp', 'ver2:0.75');
  presetGroup.presets.push(preset);
  bsb.setPresetGroup(presetGroup);

  data.getArrangement().addInstrument(bsb, '1');
  return data;
}

describe('BSB Interface Parity contract', () => {
  it('populates widgetTree, gridSettings, editEnabled, and presetGroup in BSB snapshots', () => {
    const data = createProjectWithBSBInstrument();
    const snapshot = createProjectEditorSnapshot(data, '/tmp/bsb.blue');
    const bsb = snapshot.orchestra.instruments[0] as BlueSynthBuilderInstrumentSnapshot;

    expect(bsb.type).toBe('blueSynthBuilder');
    expect(bsb.editEnabled).toBe(true);
    expect(bsb.gridSettings).toEqual({ enabled: true, snapEnabled: true, width: 10, height: 10, gridStyle: 'DOT' });
    expect(bsb.widgetTree).not.toBeNull();
    expect(bsb.widgetTree!.children).toHaveLength(1);
    expect(bsb.widgetTree!.children![0].objectName).toBe('amp');
    expect(bsb.widgetTree!.children![0].type).toBe('BSBKnob');
    expect(bsb.widgetTree!.children![0].width).toBe(60);
    expect(bsb.presetGroup).toBeDefined();
    expect(bsb.presetGroup!.presets).toHaveLength(1);
    expect(bsb.presetGroup!.presets[0].name).toBe('Default');
  });

  it('applies BSB interface patches through the updateInstrument contract', () => {
    const data = createProjectWithBSBInstrument();

    const changed = applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          bsbInterface: { type: 'setEditEnabled', value: false },
        },
      },
    });
    expect(changed).toBe(true);

    const bsb = data.getArrangement().getInstrumentById('1') as BlueSynthBuilder;
    expect(bsb.getGraphicInterface().isEditEnabled()).toBe(false);
  });

  it('updates widget properties via BSB interface patches', () => {
    const data = createProjectWithBSBInstrument();
    const snapshot = createProjectEditorSnapshot(data, null);
    const bsb = snapshot.orchestra.instruments[0] as BlueSynthBuilderInstrumentSnapshot;
    const widgetId = bsb.widgetTree!.children![0].id;

    const changed = applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId,
            properties: { objectName: 'gain', x: 50 },
          },
        },
      },
    });
    expect(changed).toBe(true);

    const after = createProjectEditorSnapshot(data, null);
    const afterBsb = after.orchestra.instruments[0] as BlueSynthBuilderInstrumentSnapshot;
    expect(afterBsb.widgetTree!.children![0].objectName).toBe('gain');
    expect(afterBsb.widgetTree!.children![0].x).toBe(50);
  });

  it('applies presets via BSB interface patches', () => {
    const data = createProjectWithBSBInstrument();

    const changed = applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          bsbInterface: { type: 'applyPreset', presetUniqueId: 'p1' },
        },
      },
    });
    expect(changed).toBe(true);

    const bsb = data.getArrangement().getInstrumentById('1') as BlueSynthBuilder;
    const snapshot = createProjectEditorSnapshot(data, null);
    const bsbSnap = snapshot.orchestra.instruments[0] as BlueSynthBuilderInstrumentSnapshot;
    expect(bsbSnap.presetGroup!.currentPresetUniqueId).toBe('p1');
  });
});
