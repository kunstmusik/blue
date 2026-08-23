import { describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericScore,
  PolyObject,
  SoundLayer,
  Instance,
  SoundObjectLibrary,
  AudioClip,
  AudioFile,
  FrozenSoundObject,
} from '@blue/data';
import {
  createScoreObjectEditorDocument,
  createFallbackEditorDocument,
  createProjectEditorSnapshot,
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

function makeDataWithObject(obj: any): BlueData {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  layer.push(obj);
  poly.push(layer);
  data.getScore().push(poly);
  return data;
}

function makeTimelineTarget(
  objectType: string,
  overrides?: Partial<ScoreObjectEditorTargetSnapshot>,
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-0-0',
    selectedObjectType: objectType,
    editorObjectType: objectType,
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
    ...overrides,
  };
}

describe('Fallback for unsupported types (T035)', () => {
  it('keeps supported file-backed types on their dedicated editor routes', () => {
    const audioFile = new AudioFile();
    const frozen = new FrozenSoundObject();

    const audioDoc = createScoreObjectEditorDocument(makeDataWithObject(audioFile), {
      target: makeTimelineTarget('AudioFile'),
    });
    const frozenDoc = createScoreObjectEditorDocument(makeDataWithObject(frozen), {
      target: makeTimelineTarget('FrozenSoundObject'),
    });

    expect(audioDoc?.editor.kind).toBe('audioFile');
    expect(frozenDoc?.editor.kind).toBe('frozenSoundObject');
  });

  it('returns fallback with unsupported reason for unknown object type', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    layer.push(gs);
    poly.push(layer);
    data.getScore().push(poly);

    const target = makeTimelineTarget('FakeType');
    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('fallback');
    if (doc!.editor.kind === 'fallback') {
      expect(doc!.editor.reason).toBe('unsupported');
    }
  });

  it('returns fallback with removed-target reason for out-of-bounds location', () => {
    const data = new BlueData();
    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-99-99',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 99, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('fallback');
    if (doc!.editor.kind === 'fallback') {
      expect(doc!.editor.reason).toBe('removed-target');
      expect(doc!.editor.message).toContain('no longer exists');
    }
  });

  it('resolves a temporarily stale drag location by stable selection identity', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const sourceLayer = new SoundLayer();
    const targetLayer = new SoundLayer();
    const score = new GenericScore();
    score.setName('Dragged score');
    sourceLayer.push(score);
    poly.push(sourceLayer, targetLayer);
    data.getScore().push(poly);

    const snapshot = createProjectEditorSnapshot(data, null);
    const originalTarget = snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!.editorTarget!;
    const provisionalTarget: ScoreObjectEditorTargetSnapshot = {
      ...originalTarget,
      location: {
        ...originalTarget.location!,
        layerIndex: 1,
        objectIndex: 0,
      },
    };

    const doc = createScoreObjectEditorDocument(data, { target: provisionalTarget });
    expect(doc?.editor.kind).toBe('code');
    expect(doc?.shared.name).toBe('Dragged score');
  });

  it('returns fallback when target has no location', () => {
    const data = new BlueData();
    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('fallback');
    if (doc!.editor.kind === 'fallback') {
      expect(doc!.editor.reason).toBe('removed-target');
    }
  });
});

describe('createFallbackEditorDocument — explicit fallback states (T035)', () => {
  it('creates no-selection fallback', () => {
    const doc = createFallbackEditorDocument('no-selection', 'No score object selected');
    expect(doc.editor.kind).toBe('fallback');
    if (doc.editor.kind === 'fallback') {
      expect(doc.editor.reason).toBe('no-selection');
      expect(doc.editor.message).toBe('No score object selected');
    }
    expect(doc.shared.name).toBe('');
  });

  it('creates multiple-selection fallback', () => {
    const doc = createFallbackEditorDocument('multiple-selection', 'Multiple objects selected');
    expect(doc.editor.kind).toBe('fallback');
    if (doc.editor.kind === 'fallback') {
      expect(doc.editor.reason).toBe('multiple-selection');
    }
  });

  it('creates unsupported fallback', () => {
    const doc = createFallbackEditorDocument('unsupported', 'Type not supported');
    expect(doc.editor.kind).toBe('fallback');
    if (doc.editor.kind === 'fallback') {
      expect(doc.editor.reason).toBe('unsupported');
    }
  });

  it('creates removed-target fallback', () => {
    const doc = createFallbackEditorDocument('removed-target', 'Object was deleted');
    expect(doc.editor.kind).toBe('fallback');
    if (doc.editor.kind === 'fallback') {
      expect(doc.editor.reason).toBe('removed-target');
    }
  });

  it('fallback document has safe empty defaults for shared properties', () => {
    const doc = createFallbackEditorDocument('no-selection', 'None');
    expect(doc.shared.name).toBe('');
    expect(doc.shared.startTime.value).toBe(0);
    expect(doc.shared.subjectiveDuration.value).toBe(0);
    expect(doc.shared.backgroundColor).toBe(0);
    expect(doc.target.selectionId).toBe('');
  });
});

describe('Patch application on removed targets (T035)', () => {
  it('updateSharedProperties returns false for missing target without crashing', () => {
    const data = new BlueData();
    const target = makeTimelineTarget('GenericScore');

    const result = applyProjectDocumentPatch(data, {
      score: {
        type: 'updateSharedProperties',
        target,
        patch: { name: 'Should Not Apply' },
      },
    });

    expect(result).toBe(false);
  });

  it('updateTypeSpecificEditor returns false for missing target without crashing', () => {
    const data = new BlueData();
    const target = makeTimelineTarget('GenericScore');

    const result = applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: { text: 'should not apply' },
      },
    });

    expect(result).toBe(false);
  });
});

describe('Library-context stale selection (T036)', () => {
  it('returns fallback when library entry has been removed', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Will Be Removed');
    const lib = data.getSoundObjectLibrary();
    const libId = addLibObject(lib, gs);
    const entryId = libId;

    const inst = new Instance();
    inst.setLibraryId(entryId);
    layer.push(inst);
    poly.push(layer);
    data.getScore().push(poly);

    lib.removeObject(0);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      library: makeLibRef(entryId, 'GenericScore'),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('fallback');
    if (doc!.editor.kind === 'fallback') {
      expect(doc!.editor.reason).toBe('removed-target');
    }
  });

  it('resolves via sourceInstanceLocation when library field is absent', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Resolved By Loc');
    gs.setScoreText('i1 0 1 220');
    const lib = data.getSoundObjectLibrary();
    const libId = addLibObject(lib, gs);
    const inst = new Instance();
    inst.setLibraryId(libId);
    inst.setSoundObject(gs);
    layer.push(inst);
    poly.push(layer);
    data.getScore().push(poly);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      sourceInstanceLocation: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.shared.name).toBe('Resolved By Loc');
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.text).toBe('i1 0 1 220');
    }
  });
});
