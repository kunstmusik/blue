import { describe, expect, it } from 'vitest';
import {
  AddProcessor,
  BlueData,
  GenericScore,
  MultiplyProcessor,
  NoteProcessorChain,
  PolyObject,
  SoundLayer,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createNestedPolyObjectSnapshot,
  createScoreObjectEditorDocument,
  type ScoreObjectEditorTargetSnapshot,
} from '../shared/project-editor';

function buildNestedGenericScoreData(): {
  data: BlueData;
  target: ScoreObjectEditorTargetSnapshot;
} {
  const data = new BlueData();
  const rootGroup = data.getScore()[0];
  if (!(rootGroup instanceof PolyObject)) {
    throw new Error('Expected root score group to be PolyObject');
  }
  const rootLayer = rootGroup[0];
  const nestedPoly = new PolyObject();
  const nestedLayer = new SoundLayer();
  const score = new GenericScore();
  score.setName('Nested Generic Score');
  score.setScoreText('i1 0 1 440');

  nestedLayer.push(score);
  nestedPoly.push(nestedLayer);
  rootLayer.push(nestedPoly);

  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'GenericScore',
    editorObjectType: 'GenericScore',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: {
      rootGroupIndex: 0,
      containerPath: [{ layerIndex: 0, objectIndex: 0 }],
      layerIndex: 0,
      objectIndex: 0,
    },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };

  return { data, target };
}

describe('Nested score object target resolution', () => {
  it('resolves containerPath locations for nested score-object documents', () => {
    const { data, target } = buildNestedGenericScoreData();

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.shared.name).toBe('Nested Generic Score');
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.text).toBe('i1 0 1 440');
      expect(doc!.editor.syntax).toBe('csound-score');
    }
  });

  it('removes nested score objects by target', () => {
    const { data, target } = buildNestedGenericScoreData();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'removeScoreObjects',
        targets: [target],
      },
    });

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('fallback');
    if (doc!.editor.kind === 'fallback') {
      expect(doc!.editor.reason).toBe('removed-target');
    }
  });

  it('snapshots nested PolyObject metadata and scoped chains', () => {
    const { data } = buildNestedGenericScoreData();
    const rootGroup = data.getScore()[0] as PolyObject;
    const nestedPoly = rootGroup[0]![0] as PolyObject;
    nestedPoly.setName('Nested Container');

    const groupChain = new NoteProcessorChain();
    groupChain.addProcessor(new AddProcessor());
    nestedPoly.setNoteProcessorChain(groupChain);

    const layerChain = new NoteProcessorChain();
    layerChain.addProcessor(new MultiplyProcessor());
    nestedPoly[0]!.setNoteProcessorChain(layerChain);

    const snapshot = createNestedPolyObjectSnapshot(data, {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot!.name).toBe('Nested Container');
    expect(snapshot!.layerCount).toBe(1);
    expect(snapshot!.noteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(snapshot!.layers[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
      'MultiplyProcessor',
    );
  });
});
