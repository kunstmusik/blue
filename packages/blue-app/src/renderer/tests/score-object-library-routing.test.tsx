import { describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericScore,
  PolyObject,
  SoundLayer,
  Instance,
  SoundObjectLibrary,
} from '@blue/data';
import {
  createScoreObjectEditorDocument,
  createScoreObjectPropertiesTarget,
  createScoreDocumentSnapshot,
  applyProjectDocumentPatch,
  type ScoreObjectEditorTargetSnapshot,
  type ScoreObjectLibraryEntryRef,
} from '../../shared/project-editor';

function makeLibRef(libId: string, objectType: string, index: number = 0): ScoreObjectLibraryEntryRef {
  return { libraryId: libId, libraryIndex: index, objectType };
}

function addLibObject(lib: SoundObjectLibrary, obj: any): string {
  return lib.addObject(obj);
}

function makeInstanceData() {
  const data = new BlueData();
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const gs = new GenericScore();
  gs.setName('Library Object');
  gs.setScoreText('i1 0 2 440');
  const lib = data.getSoundObjectLibrary();
  const libId = addLibObject(lib, gs);
  const inst = new Instance();
  inst.setLibraryId(libId);
  inst.setSoundObject(gs);
  layer.push(inst);
  poly.push(layer);
  data.getScore().push(poly);
  return { data, gs, inst, libId, lib };
}

describe('Library-context labeling (T036)', () => {
  it('includes the stable library ID in runtime Instance editor targets', () => {
    const { data, libId } = makeInstanceData();
    const row = createScoreDocumentSnapshot(data).layerGroups
      .flatMap((group) => group.layers)
      .flatMap((layer) => layer.items)
      .find((item) => item.objectType === 'Instance')!;

    expect(row.editorTarget).toMatchObject({
      selectedObjectType: 'Instance',
      ownerKind: 'library',
      displayContext: 'instance',
      library: { libraryId: libId, objectType: 'GenericScore' },
    });
  });

  it('sets displayContext to instance for Instance targets', () => {
    const { data, libId } = makeInstanceData();

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      library: makeLibRef(libId, 'GenericScore'),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc!.target.displayContext).toBe('instance');
    expect(doc!.target.ownerKind).toBe('library');
    expect(doc!.target.selectedObjectType).toBe('Instance');
    expect(doc!.target.editorObjectType).toBe('GenericScore');
  });

  it('keeps the type editor on the shared definition and properties on the Instance wrapper', () => {
    const { data, inst } = makeInstanceData();
    inst.setName('Instance Label');
    const target = createScoreDocumentSnapshot(data).layerGroups
      .flatMap((group) => group.layers)
      .flatMap((layer) => layer.items)
      .find((item) => item.objectType === 'Instance')!.editorTarget!;

    const typeDocument = createScoreObjectEditorDocument(data, { target });
    const propertiesTarget = createScoreObjectPropertiesTarget(target);
    const propertiesDocument = createScoreObjectEditorDocument(data, { target: propertiesTarget });

    expect(typeDocument?.shared.name).toBe('Library Object');
    expect(propertiesDocument?.shared.name).toBe('Instance Label');
    expect(propertiesTarget).toMatchObject({
      selectedObjectType: 'Instance',
      editorObjectType: 'Instance',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: target.sourceInstanceLocation,
    });
    expect(propertiesTarget.library).toBeUndefined();
  });

  it('sets displayContext to timeline for direct timeline objects', () => {
    const data = new BlueData();
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Timeline Object');
    layer.push(gs);
    poly.push(layer);
    data.getScore().push(poly);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc!.target.displayContext).toBe('timeline');
    expect(doc!.target.ownerKind).toBe('timeline');
  });
});

describe('Stale selection refresh (T036)', () => {
  it('editor document reflects library object state at fetch time', () => {
    const { data, gs, libId } = makeInstanceData();

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      library: makeLibRef(libId, 'GenericScore'),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc1 = createScoreObjectEditorDocument(data, { target });
    expect(doc1!.shared.name).toBe('Library Object');

    gs.setName('Updated Library Object');

    const doc2 = createScoreObjectEditorDocument(data, { target });
    expect(doc2!.shared.name).toBe('Updated Library Object');
  });

  it('editor document shows removed-target after library entry is deleted', () => {
    const { data, libId, lib } = makeInstanceData();

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      library: makeLibRef(libId, 'GenericScore'),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc1 = createScoreObjectEditorDocument(data, { target });
    expect(doc1!.editor.kind).toBe('code');

    lib.removeObject(0);

    const doc2 = createScoreObjectEditorDocument(data, { target });
    expect(doc2!.editor.kind).toBe('fallback');
    if (doc2!.editor.kind === 'fallback') {
      expect(doc2!.editor.reason).toBe('removed-target');
    }
  });

  it('mutation on library-backed target updates the library object', () => {
    const { data, gs, libId } = makeInstanceData();

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      library: makeLibRef(libId, 'GenericScore'),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateSharedProperties',
        target,
        patch: { name: 'Mutated Library Object' },
      },
    });

    expect(gs.getName()).toBe('Mutated Library Object');
  });

  it('mutation on library-backed type-specific editor updates the library object', () => {
    const { data, gs, libId } = makeInstanceData();

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      library: makeLibRef(libId, 'GenericScore'),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: { text: 'i2 0 4 880' },
      },
    });

    expect(gs.getScoreText()).toBe('i2 0 4 880');
  });
});
