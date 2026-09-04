import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BlueData, JMask, PolyObject, SoundLayer, TimeDuration } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createScoreObjectEditorDocument,
  type JMaskEditorPayload,
  type ScoreObjectEditorDocumentSnapshot,
  type ScoreObjectEditorTargetSnapshot,
} from '../../shared/project-editor';
import { applyPatchToDocument } from '../components/workbench/panels/score-object/score-object-document-reducer';
import JMaskEditor from '../components/workbench/panels/score-object/editors/JMaskEditor';
import {
  createDefaultGeneratorSnapshot,
  createDefaultParameterSnapshot,
  type FieldSnapshot,
  type ParameterSnapshot,
} from '../components/workbench/panels/score-object/editors/jmask/jmask-utils';

function makeTimelineTarget(): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'JMask',
    editorObjectType: 'JMask',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function makeJMaskDocument(): {
  data: BlueData;
  jmask: JMask;
  target: ScoreObjectEditorTargetSnapshot;
  doc: ScoreObjectEditorDocumentSnapshot;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const jmask = new JMask();
  jmask.setName('JMask');
  jmask.setSubjectiveDuration(TimeDuration.beats(6));
  layer.push(jmask);
  poly.push(layer);
  data.getScore().push(poly);

  const target = makeTimelineTarget();
  const doc = createScoreObjectEditorDocument(data, { target });
  if (!doc || doc.editor.kind !== 'structured' || doc.editor.editorFamily !== 'JMask') {
    throw new Error('Expected JMask structured editor document');
  }

  return { data, jmask, target, doc };
}

function makeFieldSnapshot(parameters: ParameterSnapshot[]): FieldSnapshot {
  return {
    kind: 'Field',
    parameters,
  };
}

describe('JMask editor contract and renderer helpers', () => {
  it('creates Item List defaults from both Java registry label and snapshot kind', () => {
    expect(createDefaultGeneratorSnapshot('Item List')).toMatchObject({ kind: 'ItemList' });
    expect(createDefaultGeneratorSnapshot('ItemList')).toMatchObject({ kind: 'ItemList' });

    const randomParameter = createDefaultParameterSnapshot('Random');
    expect(randomParameter.generator).toMatchObject({ kind: 'Random' });
    expect(randomParameter.mask).toBeNull();
    expect(randomParameter.quantizer).toMatchObject({ kind: 'Quantizer', enabled: false });
    expect(randomParameter.accumulator).toMatchObject({ kind: 'Accumulator', enabled: false });

    const probabilityParameter = createDefaultParameterSnapshot('Probability');
    expect(probabilityParameter.mask).toMatchObject({ kind: 'Mask', enabled: false });
    expect(probabilityParameter.quantizer).toMatchObject({ kind: 'Quantizer', enabled: false });
    expect(probabilityParameter.accumulator).toMatchObject({ kind: 'Accumulator', enabled: false });
  });

  it('creates a Java-style JMask editor payload and renders the top bar plus parameter rows', () => {
    const { doc } = makeJMaskDocument();
    const payload = doc.editor.payload as JMaskEditorPayload;

    expect(payload.seedUsed).toBe(false);
    expect(payload.seed).toBe(0);
    expect(payload.field.kind).toBe('Field');
    expect((payload.field.parameters as ParameterSnapshot[]).map((p) => p.name)).toEqual([
      'Instrument ID',
      'Start',
      'Duration',
    ]);
    expect(doc.editor.payloadSummary).toBe('random; 3 params');

    const html = renderToStaticMarkup(<JMaskEditor document={doc} onPatch={vi.fn()} />);
    expect(html).toContain('JMask');
    expect(html).toContain('Seed');
    expect(html).toContain('Test');
    expect(html).toContain('p1 - Instrument ID');
    expect(html).toContain('p2 - Start');
    expect(html).toContain('p3 - Duration');
    expect(html).toContain('Constant');
  });

  it('applies JMask optimistic field patches without dropping nested modifier defaults', () => {
    const { doc, target } = makeJMaskDocument();
    const p1 = createDefaultParameterSnapshot('Constant');
    p1.name = 'Instrument ID';
    const p2 = createDefaultParameterSnapshot('Constant');
    p2.name = 'Start';
    const p3 = createDefaultParameterSnapshot('Item List');
    p3.name = 'Duration';

    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target,
      patch: {
        seedUsed: true,
        seed: 77,
        field: makeFieldSnapshot([p1, p2, p3]),
      },
    });

    expect(next.editor.kind).toBe('structured');
    if (next.editor.kind !== 'structured') return;
    const payload = next.editor.payload as JMaskEditorPayload;
    const parameters = payload.field.parameters as ParameterSnapshot[];
    expect(next.editor.payloadSummary).toBe('seed: 77; 3 params');
    expect(parameters[2]!.generator).toMatchObject({ kind: 'ItemList' });
    expect(parameters[2]!.accumulator).toMatchObject({ kind: 'Accumulator', enabled: false });
  });

  it('applies JMask field patches canonically through the project document patch bridge', () => {
    const { data, jmask, target } = makeJMaskDocument();
    const p1 = createDefaultParameterSnapshot('Constant');
    p1.name = 'Instrument ID';
    const p2 = createDefaultParameterSnapshot('Constant');
    p2.name = 'Start';
    const p3 = createDefaultParameterSnapshot('Item List');
    p3.name = 'Duration';

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: {
          seedUsed: true,
          seed: 99,
          field: makeFieldSnapshot([p1, p2, p3]),
        },
      },
    });

    expect(jmask.isSeedUsed()).toBe(true);
    expect(jmask.getSeed()).toBe(99);
    const xml = jmask.saveAsXML().toXml();
    expect(xml).toContain('<generator type="blue.soundObject.jmask.ItemList">');
    expect(xml).toContain('<accumulator>');
  });
});
