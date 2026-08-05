import { describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericScore,
  AudioClip,
  PianoRoll,
  TimeBehavior,
  TimeDuration,
  TimePosition,
  PolyObject,
  SoundLayer,
  TrackLayerGroup,
  TrackLayer,
  External,
  Track,
  TrackerObject,
} from '@blue/data';
import {
  createScoreObjectEditorDocument,
  createFallbackEditorDocument,
  createProjectEditorSnapshot,
  applyProjectDocumentPatch,
  type ScoreObjectEditorRequest,
  type ScoreObjectEditorTargetSnapshot,
} from '../../shared/project-editor';

function createDataWithGenericScore(): {
  data: BlueData;
  gs: GenericScore;
  target: ScoreObjectEditorTargetSnapshot;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const gs = new GenericScore();
  gs.setName('Test Score');
  gs.setScoreText('i1 0 2 440');
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

  return { data, gs, target };
}

function createDataWithPianoRoll(): {
  data: BlueData;
  pianoRoll: PianoRoll;
  target: ScoreObjectEditorTargetSnapshot;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const pianoRoll = new PianoRoll();
  pianoRoll.setName('Test PianoRoll');
  layer.push(pianoRoll);
  poly.push(layer);
  data.getScore().push(poly);

  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'PianoRoll',
    editorObjectType: 'PianoRoll',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };

  return { data, pianoRoll, target };
}

function createDataWithAudioClip(): {
  data: BlueData;
  clip: AudioClip;
  target: ScoreObjectEditorTargetSnapshot;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const alg = new TrackLayerGroup();
  const layer = new TrackLayer();
  const clip = new AudioClip();
  clip.setName('Test Clip');
  clip.setAudioFile('test.wav');
  layer.push(clip);
  alg.push(layer);
  data.getScore().push(alg);

  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: 'aclp-0-0',
    selectedObjectType: 'AudioClip',
    editorObjectType: 'AudioClip',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: false,
  };

  return { data, clip, target };
}

describe('createScoreObjectEditorDocument', () => {
  it('returns a code-backed editor document for a GenericScore with correct syntax, text, and shared properties', () => {
    const { data, gs, target } = createDataWithGenericScore();
    const doc = createScoreObjectEditorDocument(data, { target });

    expect(doc).not.toBeNull();
    expect(doc!.target).toBe(target);
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('csound-score');
      expect(doc!.editor.text).toBe('i1 0 2 440');
      expect(doc!.editor.target).toBe(target);
    }
    expect(doc!.shared.name).toBe('Test Score');
    expect(doc!.shared.backgroundColor).toBe(gs.getBackgroundColor());
    expect(doc!.shared.timeBehavior).toBe(gs.getTimeBehavior());
    expect(doc!.shared.startTime.timeBase).toBe('BEATS');
    expect(doc!.shared.subjectiveDuration.timeBase).toBe('BEATS');
  });

  it('returns an audioClip editor document for an AudioClip with correct fields', () => {
    const { data, clip, target } = createDataWithAudioClip();
    const doc = createScoreObjectEditorDocument(data, { target });

    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('audioClip');
    if (doc!.editor.kind === 'audioClip') {
      expect(doc!.editor.audioFile).toBe('test.wav');
      expect(doc!.editor.target).toBe(target);
    }
    expect(doc!.shared.name).toBe('Test Clip');
  });

  it('returns a fallback document for unsupported types', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    layer.push(gs);
    poly.push(layer);
    data.getScore().push(poly);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'FakeUnsupportedType',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('fallback');
    if (doc!.editor.kind === 'fallback') {
      expect(doc!.editor.reason).toBe('unsupported');
    }
  });
});

describe('createFallbackEditorDocument', () => {
  it('creates a proper fallback with the given reason and message', () => {
    const doc = createFallbackEditorDocument('no-selection', 'Nothing selected');

    expect(doc.editor.kind).toBe('fallback');
    if (doc.editor.kind === 'fallback') {
      expect(doc.editor.reason).toBe('no-selection');
      expect(doc.editor.message).toBe('Nothing selected');
    }
    expect(doc.target.selectionId).toBe('');
    expect(doc.target.ownerKind).toBe('timeline');
    expect(doc.shared.name).toBe('');
    expect(doc.shared.startTime.value).toBe(0);
    expect(doc.shared.subjectiveDuration.value).toBe(0);
    expect(doc.shared.backgroundColor).toBe(0);
  });
});

describe('Score patches — updateSharedProperties', () => {
  it('updates name, backgroundColor, startTime, and subjectiveDuration correctly on a GenericScore', () => {
    const { data, gs, target } = createDataWithGenericScore();

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSharedProperties',
          target,
          patch: {
            name: 'Renamed Score',
            backgroundColor: 0xff0000,
            startTime: { value: 5.0, timeBase: 'beats' },
            subjectiveDuration: { value: 8.0, timeBase: 'beats' },
          },
        },
      }),
    ).toBe(true);

    expect(gs.getName()).toBe('Renamed Score');
    expect(gs.getBackgroundColor()).toBe(0xff0000);
    const context = data.getScore().getTimeContext();
    expect(gs.getStartTime().toBeats(context)).toBeCloseTo(5.0);
    expect(gs.getSubjectiveDuration().toBeats(context)).toBeCloseTo(8.0);
  });
});

describe('Score patches — moveScoreObjects', () => {
  it('moves an existing object to another layer without recreating it', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const sourceLayer = new SoundLayer();
    const targetLayer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Movable Score');
    gs.setScoreText('i1 0 1 440');
    sourceLayer.push(gs);
    poly.push(sourceLayer);
    poly.push(targetLayer);
    data.getScore().push(poly);

    const snapshot = createProjectEditorSnapshot(data, null);
    const polyGroupIndex = snapshot.score.layerGroups.findIndex(
      (lg) => lg.groupType === 'polyObject' && lg.layerCount === 2,
    );
    const groupId = snapshot.score.layerGroups[polyGroupIndex].groupId;

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: polyGroupIndex, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'moveScoreObjects',
          moves: [{
            target,
            targetStartBeats: 4.5,
            targetLayerIndex: 1,
            targetGroupId: groupId,
          }],
        },
      }),
    ).toBe(true);

    expect(sourceLayer.length).toBe(0);
    expect(targetLayer.length).toBe(1);
    expect(targetLayer[0]).toBe(gs);
    const context = data.getScore().getTimeContext();
    expect(gs.getStartTime().toBeats(context)).toBeCloseTo(4.5);
  });
});

describe('Score patches — updateSoundObjectBehavior', () => {
  it('updates timeBehavior and repeatPoint', () => {
    const { data, gs, target } = createDataWithGenericScore();

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: 'REPEAT',
            repeatPoint: { value: 3.5, timeBase: 'beats' },
          },
        },
      }),
    ).toBe(true);

    expect(gs.getTimeBehavior()).toBe('REPEAT');
    const context = data.getScore().getTimeContext();
    expect(gs.getRepeatPoint()!.toBeats(context)).toBeCloseTo(3.5);
  });

  it('preserves repeatPoint when switching away from and back to repeat behaviors', () => {
    const { data, gs, target } = createDataWithGenericScore();

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: 'REPEAT',
            repeatPoint: { value: 3.5, timeBase: 'BEATS' },
          },
        },
      }),
    ).toBe(true);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: 'NONE',
          },
        },
      }),
    ).toBe(true);

    let context = data.getScore().getTimeContext();
    expect(gs.getTimeBehavior()).toBe('NONE');
    expect(gs.getRepeatPoint()!.toBeats(context)).toBeCloseTo(3.5);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: 'REPEAT_CLASSIC',
          },
        },
      }),
    ).toBe(true);

    context = data.getScore().getTimeContext();
    expect(gs.getTimeBehavior()).toBe('REPEAT_CLASSIC');
    expect(gs.getRepeatPoint()!.toBeats(context)).toBeCloseTo(3.5);
  });

  it('persists PianoRoll timeBehavior changes into a refreshed editor document', () => {
    const { data, pianoRoll, target } = createDataWithPianoRoll();

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSoundObjectBehavior',
          target,
          patch: {
            timeBehavior: TimeBehavior.REPEAT_CLASSIC,
            repeatPoint: { value: 2.25, timeBase: 'BEATS' },
          },
        },
      }),
    ).toBe(true);

    const context = data.getScore().getTimeContext();
    expect(pianoRoll.getTimeBehavior()).toBe(TimeBehavior.REPEAT_CLASSIC);
    expect(pianoRoll.getRepeatPoint()!.toBeats(context)).toBeCloseTo(2.25);

    const refreshedDoc = createScoreObjectEditorDocument(data, { target });
    expect(refreshedDoc).not.toBeNull();
    expect(refreshedDoc!.shared.timeBehavior).toBe(TimeBehavior.REPEAT_CLASSIC);
    expect(refreshedDoc!.shared.repeatPoint?.value).toBeCloseTo(2.25);
  });
});

describe('Score patches — updateTypeSpecificEditor', () => {
  it('updates code text for GenericScore', () => {
    const { data, gs, target } = createDataWithGenericScore();

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { text: 'i2 0 1 880' },
        },
      }),
    ).toBe(true);

    expect(gs.getScoreText()).toBe('i2 0 1 880');
  });

  it('updates External score text, command line, and syntax type', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const ext = new External();
    ext.setName('Ext');
    ext.setText('original text');
    ext.setCommandLine('old cmd');
    ext.setSyntaxType('Python');
    layer.push(ext);
    poly.push(layer);
    data.getScore().push(poly);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'External',
      editorObjectType: 'External',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { scoreText: 'new text', commandLine: 'new cmd', syntaxType: 'JavaScript' },
        },
      }),
    ).toBe(true);

    expect(ext.getText()).toBe('new text');
    expect(ext.getCommandLine()).toBe('new cmd');
    expect(ext.getSyntaxType()).toBe('JavaScript');
  });

  it('updates TrackerObject cell and adds track', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const to = new TrackerObject();
    to.setName('Tracker');
    to.getTracks().setSteps(2);
    to.getTracks().addTrack(new Track());
    layer.push(to);
    poly.push(layer);
    data.getScore().push(poly);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'TrackerObject',
      editorObjectType: 'TrackerObject',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 1, value: '8.07' } },
        },
      }),
    ).toBe(true);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { addTrack: true },
        },
      }),
    ).toBe(true);

    expect(to.getTracks().getTrack(0)?.getTrackerNote(1).getValue(1)).toBe('8.07');
    expect(to.getTracks().size()).toBe(2);
  });
});
