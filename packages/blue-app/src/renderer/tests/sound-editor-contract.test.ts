import { describe, expect, it } from 'vitest';
import { BlueData, PolyObject, SoundLayer, Sound } from '@blue/data';
import {
  createProjectEditorSnapshot,
  createScoreObjectEditorDocument,
  applyProjectDocumentPatch,
  type ScoreObjectEditorTargetSnapshot,
  type SoundEditorPayload,
  type SoundAutomationParameterSnapshot,
} from '../../shared/project-editor';

function createDataWithSound(bsbXml?: string): {
  data: BlueData;
  sound: Sound;
  target: ScoreObjectEditorTargetSnapshot;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const sound = new Sound();
  sound.setName('Test Sound');
  sound.setComment('Test comment');
  if (bsbXml) {
    sound.setBSBInstrumentText(bsbXml);
  }
  layer.push(sound);
  poly.push(layer);
  data.getScore().push(poly);

  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'Sound',
    editorObjectType: 'Sound',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: true,
  };

  return { data, sound, target };
}

const MINIMAL_BSB_XML = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>TestBSB</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>instr 1\n  out(oscili(&lt;knob1&gt;, 440))\nendin</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="knob1-id">
      <objectName>knob1</objectName>
      <x>0</x>
      <y>0</y>
      <automationAllowed>true</automationAllowed>
      <label>Knob 1</label>
      <value>0.5</value>
      <minimum>0</minimum>
      <maximum>1</maximum>
    </bsbObject>
  </graphicInterface>
  <parameterList>
    <parameter uniqueId="12345" name="knob1" label="Knob 1" min="0.0" max="1.0" resolution="0.001" version="2">
      <line>
        <linePoint x="0.0" y="0.5"/>
        <linePoint x="1.0" y="0.5"/>
      </line>
    </parameter>
  </parameterList>
  <opcodeList/>
</instrument>`;

const UNNAMED_AUTOMATABLE_BSB_XML = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>TestBSB</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>instr 1\n  out(oscili(0.5, 440))\nendin</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="knob1-id">
      <objectName></objectName>
      <x>0</x>
      <y>0</y>
      <automationAllowed>true</automationAllowed>
      <label>Knob 1</label>
      <value>0.5</value>
      <minimum>0</minimum>
      <maximum>1</maximum>
    </bsbObject>
  </graphicInterface>
  <parameterList/>
  <opcodeList/>
</instrument>`;

describe('Sound Score Object Editor', () => {
  describe('T004: SoundEditorSnapshot contract', () => {
    it('creates Sound editor document with full tabs and default BSB snapshot for empty BSB', () => {
      const { data, target } = createDataWithSound();
      const doc = createScoreObjectEditorDocument(data, { target });

      expect(doc.editor.kind).toBe('structured');
      if (doc.editor.kind !== 'structured') return;
      expect(doc.editor.editorFamily).toBe('Sound');

      const payload = doc.editor.payload as unknown as SoundEditorPayload;
      expect(payload.comment).toBe('Test comment');
      expect(payload.bsbInstrument).not.toBeNull();
      expect(payload.bsbInstrument!.type).toBe('blueSynthBuilder');
      expect(payload.bsbInstrument!.instrumentText).toBe('');
      expect(payload.automationParameters).toEqual([]);
      expect(payload.availableTabs).toEqual(['interface', 'automation', 'code', 'udo', 'comments']);
      expect(payload.testAvailable).toBe(false);
    });

    it('creates Sound editor document with full BSB snapshot when BSB text is present', () => {
      const { data, target } = createDataWithSound(MINIMAL_BSB_XML);
      const doc = createScoreObjectEditorDocument(data, { target });

      expect(doc.editor.kind).toBe('structured');
      if (doc.editor.kind !== 'structured') return;

      const payload = doc.editor.payload as unknown as SoundEditorPayload;
      expect(payload.comment).toBe('Test comment');
      expect(payload.bsbInstrument).not.toBeNull();
      expect(payload.bsbInstrument!.type).toBe('blueSynthBuilder');
      expect(payload.bsbInstrument!.instrumentText).toContain('oscili');
      expect(payload.bsbInstrument!.objectNames).toContain('knob1');
      expect(payload.availableTabs).toEqual(['interface', 'automation', 'code', 'udo', 'comments']);
    });

    it('pastes Sound score objects with embedded BSB widgets intact and rekeyed', () => {
      const { data, target } = createDataWithSound(MINIMAL_BSB_XML);
      const snapshot = createProjectEditorSnapshot(data, null);
      const group = snapshot.score.layerGroups[0];
      if (!group || group.groupType !== 'polyObject') {
        throw new Error('Expected root polyObject group');
      }
      const sourceItem = group.layers[0]?.items[0];
      if (!sourceItem?.serializedXml) {
        throw new Error('Expected copied score object XML');
      }

      const originalDoc = createScoreObjectEditorDocument(data, { target });
      const originalPayload = (originalDoc.editor as any).payload as SoundEditorPayload;
      const originalWidget = originalPayload.bsbInstrument?.widgetTree.children?.[0];

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'addScoreObjects',
          groupId: group.groupId,
          objects: [
            {
              layerIndex: 0,
              objectType: sourceItem.objectType,
              name: sourceItem.name,
              startBeats: 8,
              durationBeats: sourceItem.durationBeats,
              backgroundColor: sourceItem.backgroundColor,
              serializedXml: sourceItem.serializedXml,
            },
          ],
        },
      });

      expect(changed).toBe(true);

      const pastedTarget: ScoreObjectEditorTargetSnapshot = {
        ...target,
        selectionId: 'sobj-0-1',
        location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 1 },
      };
      const pastedDoc = createScoreObjectEditorDocument(data, { target: pastedTarget });
      const pastedPayload = (pastedDoc.editor as any).payload as SoundEditorPayload;
      const pastedWidget = pastedPayload.bsbInstrument?.widgetTree.children?.[0];

      expect(pastedPayload.bsbInstrument?.objectNames).toContain('knob1');
      expect(pastedWidget?.type).toBe('BSBKnob');
      expect(pastedWidget?.id).toBeTruthy();
      expect(pastedWidget?.id).not.toBe(originalWidget?.id);
    });

    it('extracts automation parameters from BSB', () => {
      const { data, target } = createDataWithSound(MINIMAL_BSB_XML);
      const doc = createScoreObjectEditorDocument(data, { target });

      const payload = (doc.editor as any).payload as SoundEditorPayload;
      expect(payload.automationParameters.length).toBe(1);
      const param = payload.automationParameters[0];
      expect(param.name).toBe('knob1');
      expect(param.label).toBe('Knob 1');
      expect(param.automationEnabled).toBe(false);
      expect(param.minimum).toBe(0);
      expect(param.maximum).toBe(1);
      expect(param.points.length).toBeGreaterThanOrEqual(2);
    });

    it('omits disabled parameters when automationAllowed is absent, matching Java parity', () => {
      const { data, target } = createDataWithSound(
        MINIMAL_BSB_XML.replace('      <automationAllowed>true</automationAllowed>\n', ''),
      );
      const doc = createScoreObjectEditorDocument(data, { target });

      const payload = (doc.editor as any).payload as SoundEditorPayload;
      expect(payload.automationParameters).toEqual([]);
    });
  });

  describe('Comment patch', () => {
    it('updates comment through updateTypeSpecificEditor patch', () => {
      const { data, target, sound } = createDataWithSound();
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { comment: 'Updated comment' },
        },
      });
      expect(changed).toBe(true);
      expect(sound.getComment()).toBe('Updated comment');
    });
  });

  describe('BSB interface patch', () => {
    it('applies BSB interface patch to Sound BSB instrument text', () => {
      const { data, target, sound } = createDataWithSound(MINIMAL_BSB_XML);
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: {
            bsbInterfacePatch: { type: 'setEditEnabled', value: false },
          },
        },
      });
      expect(changed).toBe(true);
      expect(sound.getBSBInstrumentText()).toContain('editEnabled="false"');
    });

    it('applies widget value update patch', () => {
      const { data, target, sound } = createDataWithSound(MINIMAL_BSB_XML);
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: {
            bsbInterfacePatch: {
              type: 'updateWidgetProperties',
              widgetId: 'knob1-id',
              properties: { value: 0.8 },
            },
          },
        },
      });
      expect(changed).toBe(true);
      expect(sound.getBSBInstrumentText()).toContain('knob1');
    });

    it('adds newly named automatable widgets to the Sound automation payload', () => {
      const { data, target, sound } = createDataWithSound(UNNAMED_AUTOMATABLE_BSB_XML);
      const initialDoc = createScoreObjectEditorDocument(data, { target });
      const widgetId = ((initialDoc.editor as any).payload as SoundEditorPayload).bsbInstrument
        ?.widgetTree.children?.[0]?.id;

      expect(widgetId).toBeTruthy();
      expect(widgetId).toBe('knob1-id');

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: {
            bsbInterfacePatch: {
              type: 'updateWidgetProperties',
              widgetId: widgetId ?? '',
              properties: { objectName: 'gain' },
            },
          },
        },
      });

      expect(changed).toBe(true);
      expect(sound.getBSBInstrumentText()).toContain('<objectName>gain</objectName>');

      const doc = createScoreObjectEditorDocument(data, { target });
      const payload = (doc.editor as any).payload as SoundEditorPayload;
      expect(payload.automationParameters).toHaveLength(1);
      expect(payload.automationParameters[0]?.name).toBe('gain');
      expect(payload.automationParameters[0]?.parameterId).toBeTruthy();
    });

    it('rescales Sound automation ranges and points when widget bounds change', () => {
      const { data, target, sound } = createDataWithSound(MINIMAL_BSB_XML);
      const initialDoc = createScoreObjectEditorDocument(data, { target });
      const widgetId = ((initialDoc.editor as any).payload as SoundEditorPayload).bsbInstrument
        ?.widgetTree.children?.[0]?.id;

      expect(widgetId).toBeTruthy();
      expect(widgetId).toBe('knob1-id');

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: {
            bsbInterfacePatch: {
              type: 'updateWidgetProperties',
              widgetId: widgetId ?? '',
              properties: { maximum: 10 },
            },
          },
        },
      });

      expect(changed).toBe(true);
      expect(sound.getBSBInstrumentText()).toContain('<maximum>10</maximum>');

      const doc = createScoreObjectEditorDocument(data, { target });
      const payload = (doc.editor as any).payload as SoundEditorPayload;
      const parameter = payload.automationParameters[0];

      expect(parameter?.maximum).toBe(10);
      expect(parameter?.value).toBe(5);
      expect(parameter?.points).toEqual([
        { x: 0, y: 5 },
        { x: 1, y: 5 },
      ]);
    });
  });

  describe('BSB code patch', () => {
    it('applies instrument text update through bsbCodePatch', () => {
      const { data, target, sound } = createDataWithSound(MINIMAL_BSB_XML);
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: {
            bsbCodePatch: { instrumentText: 'instr 1\n  out(a(0))\nendin' },
          },
        },
      });
      expect(changed).toBe(true);
      expect(sound.getBSBInstrumentText()).toContain('out(a(0))');
    });
  });

  describe('Automation patch', () => {
    it('updates automation enabled state', () => {
      const { data, target, sound } = createDataWithSound(MINIMAL_BSB_XML);
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: {
            automationPatch: { parameterId: 'knob1', automationEnabled: true },
          },
        },
      });
      expect(changed).toBe(true);
      expect(sound.getBSBInstrumentText()).toContain('knob1');
    });

    it('updates automation points', () => {
      const { data, target, sound } = createDataWithSound(MINIMAL_BSB_XML);
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: {
            automationPatch: {
              parameterId: '12345',
              points: [
                { x: 0, y: 0.2 },
                { x: 0.5, y: 0.8 },
                { x: 1, y: 0.3 },
              ],
            },
          },
        },
      });
      expect(changed).toBe(true);
    });
  });

  describe('Removed-target fallback', () => {
    it('returns fallback when Sound target does not exist', () => {
      const data = new BlueData();
      data.getScore().length = 0;
      const poly = new PolyObject();
      const layer = new SoundLayer();
      poly.push(layer);
      data.getScore().push(poly);

      const target: ScoreObjectEditorTargetSnapshot = {
        selectionId: 'sobj-0-0',
        selectedObjectType: 'Sound',
        editorObjectType: 'Sound',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
        supportsTimeBehavior: false,
        supportsRepeatPoint: false,
        supportsNoteProcessorChain: true,
      };

      const doc = createScoreObjectEditorDocument(data, { target });
      expect(doc.editor.kind).toBe('fallback');
      if (doc.editor.kind !== 'fallback') return;
      expect(doc.editor.reason).toBe('removed-target');
    });
  });
});
