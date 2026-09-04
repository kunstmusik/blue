import { describe, expect, it } from 'vitest';
import { BlueData, PolyObject, Sound, SoundLayer } from '@blue/data';
import {
  createScoreObjectEditorDocument,
  type ScoreObjectEditorTargetSnapshot,
  type SoundEditorPayload,
} from '../../shared/project-editor';
import { applyPatchToDocument } from '../components/workbench/panels/score-object/score-object-document-reducer';

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
      <x>10</x>
      <y>12</y>
      <width>60</width>
      <height>60</height>
      <automationAllowed>true</automationAllowed>
      <label>Knob 1</label>
      <value>0.5</value>
      <minimum>0</minimum>
      <maximum>1</maximum>
    </bsbObject>
  </graphicInterface>
  <parameterList>
    <parameter uniqueId="knob1-param" name="knob1" label="Knob 1" min="0.0" max="1.0" automationEnabled="true" value="0.5">
      <line>
        <linePoint x="0.0" y="0.5"/>
        <linePoint x="1.0" y="0.5"/>
      </line>
    </parameter>
  </parameterList>
  <opcodeList/>
</instrument>`;

const UNNAMED_BSB_XML = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>TestBSB</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>instr 1\n  out(oscili(0.5, 440))\nendin</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="knob1-id">
      <objectName></objectName>
      <x>10</x>
      <y>12</y>
      <width>60</width>
      <height>60</height>
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

const UUID_STYLE_BSB_XML = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>UuidBSB</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>instr 1\n  out(oscili(&lt;uuidGain&gt;, 440))\nendin</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="w-123e4567-e89b-12d3-a456-426614174000">
      <objectName>uuidGain</objectName>
      <x>10</x>
      <y>12</y>
      <width>60</width>
      <height>60</height>
      <automationAllowed>true</automationAllowed>
      <label>UUID Gain</label>
      <value>0.5</value>
      <minimum>0</minimum>
      <maximum>1</maximum>
    </bsbObject>
  </graphicInterface>
  <parameterList>
    <parameter uniqueId="param-123e4567-e89b-12d3-a456-426614174000" name="uuidGain" label="UUID Gain" min="0.0" max="1.0" automationEnabled="true" value="0.5">
      <line>
        <linePoint x="0.0" y="0.5"/>
      </line>
    </parameter>
  </parameterList>
  <opcodeList/>
</instrument>`;

const SLIDER_BANK_BSB_XML = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>SliderBankBSB</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>instr 1\n  out(oscili(&lt;bank_0&gt;, 440))\nendin</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank" uniqueId="bank-id">
      <objectName>bank</objectName>
      <x>10</x>
      <y>12</y>
      <automationAllowed>true</automationAllowed>
      <minimum>0</minimum>
      <maximum>1</maximum>
      <sliderWidth>120</sliderWidth>
      <gap>5</gap>
      <bdresolution>-1</bdresolution>
      <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
        <objectName>bank_0</objectName>
        <value>0.5</value>
      </bsbObject>
    </bsbObject>
  </graphicInterface>
  <parameterList/>
  <opcodeList/>
</instrument>`;

function makeSoundTarget(): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'Sound',
    editorObjectType: 'Sound',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function makeSoundDocument(xml: string = MINIMAL_BSB_XML) {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const sound = new Sound();
  sound.setBSBInstrumentText(xml);
  layer.push(sound);
  poly.push(layer);
  data.getScore().push(poly);

  const doc = createScoreObjectEditorDocument(data, { target: makeSoundTarget() });
  if (!doc || doc.editor.kind !== 'structured' || doc.editor.editorFamily !== 'Sound') {
    throw new Error('Expected Sound structured editor document');
  }
  return doc;
}

function getPayload(doc: ReturnType<typeof makeSoundDocument>): SoundEditorPayload {
  return doc.editor.payload as unknown as SoundEditorPayload;
}

function findWidgetById(
  children: SoundEditorPayload['bsbInstrument']['widgetTree']['children'] | undefined,
  widgetId: string,
): SoundEditorPayload['bsbInstrument']['widgetTree']['children'][number] | null {
  for (const child of children ?? []) {
    if (child.id === widgetId) {
      return child;
    }
    const nested = findWidgetById(child.children, widgetId);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function findWidgetByType(
  children: SoundEditorPayload['bsbInstrument']['widgetTree']['children'] | undefined,
  widgetType: string,
): SoundEditorPayload['bsbInstrument']['widgetTree']['children'][number] | null {
  for (const child of children ?? []) {
    if (child.type === widgetType) {
      return child;
    }
    const nested = findWidgetByType(child.children, widgetType);
    if (nested) {
      return nested;
    }
  }
  return null;
}

describe('ScoreObjectEditorPanel Sound optimistic patching', () => {
  it('updates top-level widget fields and object indexes for Sound BSB patches', () => {
    const doc = makeSoundDocument();
    const sourcePayload = getPayload(doc);
    const sourceWidget = findWidgetByType(
      sourcePayload.bsbInstrument?.widgetTree.children,
      'BSBKnob',
    );

    if (!sourceWidget?.id) {
      throw new Error('Expected Sound snapshot to contain a BSBKnob widget with an id');
    }

    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'updateWidgetProperties',
          widgetId: sourceWidget.id,
          properties: {
            objectName: 'gain',
            x: 48,
            y: 52,
            width: 72,
            height: 72,
            minimum: 0.1,
            maximum: 0.9,
            value: 0.75,
          },
        },
      },
    });

    expect(next.editor.kind).toBe('structured');
    if (next.editor.kind !== 'structured') return;

    const payload = getPayload(next as ReturnType<typeof makeSoundDocument>);
    const widget = findWidgetById(payload.bsbInstrument?.widgetTree.children, sourceWidget.id);

    expect(widget?.objectName).toBe('gain');
    expect(widget?.x).toBe(48);
    expect(widget?.y).toBe(52);
    expect(widget?.width).toBe(72);
    expect(widget?.height).toBe(72);
    expect(widget?.minimum).toBe(0.1);
    expect(widget?.maximum).toBe(0.9);
    expect(widget?.value).toBe(0.75);
    expect(payload.bsbInstrument?.objectNames).toEqual(['gain']);
    expect(payload.bsbInstrument?.widgets).toEqual([
      {
        objectName: 'gain',
        widgetType: 'BSBKnob',
        value: 0.75,
        minimum: 0.1,
        maximum: 0.9,
      },
    ]);
  });

  it('treats UUID-style widget ids as opaque keys for Sound BSB patches', () => {
    const widgetId = 'w-123e4567-e89b-12d3-a456-426614174000';
    const doc = makeSoundDocument(UUID_STYLE_BSB_XML);

    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'updateWidgetProperties',
          widgetId,
          properties: {
            objectName: 'uuidGainEdited',
            value: 0.25,
          },
        },
      },
    });

    expect(next.editor.kind).toBe('structured');
    if (next.editor.kind !== 'structured') return;

    const payload = getPayload(next as ReturnType<typeof makeSoundDocument>);
    const widget = findWidgetById(payload.bsbInstrument?.widgetTree.children, widgetId);

    expect(widget?.objectName).toBe('uuidGainEdited');
    expect(widget?.value).toBe(0.25);
    expect(payload.bsbInstrument?.objectNames).toEqual(['uuidGainEdited']);
  });

  it('adds and removes Sound BSB widgets optimistically', () => {
    const doc = makeSoundDocument();
    const originalPayload = getPayload(doc);
    const originalWidget = findWidgetByType(
      originalPayload.bsbInstrument?.widgetTree.children,
      'BSBKnob',
    );

    if (!originalWidget?.id) {
      throw new Error('Expected Sound snapshot to contain a BSBKnob widget with an id');
    }

    const withAddedWidget = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'addWidget',
          widgetType: 'BSBLabel',
          x: 120,
          y: 80,
        },
      },
    });

    expect(withAddedWidget.editor.kind).toBe('structured');
    if (withAddedWidget.editor.kind !== 'structured') return;

    const addedPayload = getPayload(withAddedWidget as ReturnType<typeof makeSoundDocument>);
    const addedWidget = findWidgetByType(
      addedPayload.bsbInstrument?.widgetTree.children,
      'BSBLabel',
    );

    expect(addedPayload.bsbInstrument?.widgetTree.children).toHaveLength(2);
    expect(addedWidget?.type).toBe('BSBLabel');
    expect(addedWidget?.x).toBe(120);
    expect(addedWidget?.y).toBe(80);
    expect(addedWidget?.id).toBeTruthy();

    const withRemovedWidget = applyPatchToDocument(withAddedWidget, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'removeWidget',
          widgetId: addedWidget?.id ?? '',
        },
      },
    });

    expect(withRemovedWidget.editor.kind).toBe('structured');
    if (withRemovedWidget.editor.kind !== 'structured') return;

    const removedPayload = getPayload(withRemovedWidget as ReturnType<typeof makeSoundDocument>);
    expect(removedPayload.bsbInstrument?.widgetTree.children).toHaveLength(1);
    expect(
      findWidgetByType(removedPayload.bsbInstrument?.widgetTree.children, 'BSBLabel'),
    ).toBeNull();
    expect(
      findWidgetById(removedPayload.bsbInstrument?.widgetTree.children, originalWidget.id),
    ).not.toBeNull();
  });

  it('adds a new automation parameter immediately when an automatable widget gets an object name', () => {
    const doc = makeSoundDocument(UNNAMED_BSB_XML);
    const sourcePayload = getPayload(doc);
    const sourceWidget = findWidgetByType(
      sourcePayload.bsbInstrument?.widgetTree.children,
      'BSBKnob',
    );

    if (!sourceWidget?.id) {
      throw new Error('Expected Sound snapshot to contain a BSBKnob widget with an id');
    }

    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'updateWidgetProperties',
          widgetId: sourceWidget.id,
          properties: {
            objectName: 'gain',
          },
        },
      },
    });

    expect(next.editor.kind).toBe('structured');
    if (next.editor.kind !== 'structured') return;

    const payload = getPayload(next as ReturnType<typeof makeSoundDocument>);
    expect(payload.automationParameters).toEqual([
      expect.objectContaining({
        parameterId: 'gain',
        name: 'gain',
        minimum: 0,
        maximum: 1,
        value: 0.5,
      }),
    ]);
  });

  it('rescales Sound automation points immediately when widget bounds change', () => {
    const doc = makeSoundDocument();
    const sourcePayload = getPayload(doc);
    const sourceWidget = findWidgetByType(
      sourcePayload.bsbInstrument?.widgetTree.children,
      'BSBKnob',
    );

    if (!sourceWidget?.id) {
      throw new Error('Expected Sound snapshot to contain a BSBKnob widget with an id');
    }

    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'updateWidgetProperties',
          widgetId: sourceWidget.id,
          properties: {
            maximum: 10,
          },
        },
      },
    });

    expect(next.editor.kind).toBe('structured');
    if (next.editor.kind !== 'structured') return;

    const payload = getPayload(next as ReturnType<typeof makeSoundDocument>);
    const widget = findWidgetById(payload.bsbInstrument?.widgetTree.children, sourceWidget.id);

    expect(widget?.maximum).toBe(10);
    expect(widget?.value).toBe(5);
    expect(payload.automationParameters).toEqual([
      expect.objectContaining({
        parameterId: 'knob1-param',
        name: 'knob1',
        maximum: 10,
        value: 5,
        points: [
          { x: 0, y: 5 },
          { x: 1, y: 5 },
        ],
      }),
    ]);
  });

  it('keeps slider bank property ranges synchronized during optimistic bound changes', () => {
    const doc = makeSoundDocument(SLIDER_BANK_BSB_XML);
    const sourcePayload = getPayload(doc);
    const sourceWidget = findWidgetByType(
      sourcePayload.bsbInstrument?.widgetTree.children,
      'BSBHSliderBank',
    );

    if (!sourceWidget?.id) {
      throw new Error('Expected Sound snapshot to contain a BSBHSliderBank widget with an id');
    }

    const withMinimum = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'updateWidgetProperties',
          widgetId: sourceWidget.id,
          properties: {
            minimum: -1,
          },
        },
      },
    });

    expect(withMinimum.editor.kind).toBe('structured');
    if (withMinimum.editor.kind !== 'structured') return;

    const minimumPayload = getPayload(withMinimum as ReturnType<typeof makeSoundDocument>);
    const minimumWidget = findWidgetById(
      minimumPayload.bsbInstrument?.widgetTree.children,
      sourceWidget.id,
    );
    const minimumSliders = minimumWidget?.properties.sliders as
      | Array<{ value?: number }>
      | undefined;

    expect(minimumWidget?.minimum).toBe(-1);
    expect(minimumWidget?.properties.minimum).toBe(-1);
    expect(minimumSliders?.[0]?.value).toBe(0);

    const withMaximum = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target: doc.target,
      patch: {
        bsbInterfacePatch: {
          type: 'updateWidgetProperties',
          widgetId: sourceWidget.id,
          properties: {
            maximum: 10,
          },
        },
      },
    });

    expect(withMaximum.editor.kind).toBe('structured');
    if (withMaximum.editor.kind !== 'structured') return;

    const maximumPayload = getPayload(withMaximum as ReturnType<typeof makeSoundDocument>);
    const maximumWidget = findWidgetById(
      maximumPayload.bsbInstrument?.widgetTree.children,
      sourceWidget.id,
    );
    const maximumSliders = maximumWidget?.properties.sliders as
      | Array<{ value?: number }>
      | undefined;

    expect(maximumWidget?.maximum).toBe(10);
    expect(maximumWidget?.properties.maximum).toBe(10);
    expect(maximumSliders?.[0]?.value).toBe(5);
  });
});
