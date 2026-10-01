import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { formatForBase, parseForBase } from '../time/time-unit-logic';
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
  AudioFile,
  FrozenSoundObject,
  PatternObject,
  Pattern,
  TempoPoint,
  CurveType,
  PianoNote,
} from '@blue/data';
import { ProjectHistory } from '../../main/project-history';
import { ProjectSession } from '../../main/project-session';
import { applyPatchToDocument } from '../components/workbench/panels/score-object/score-object-document-reducer';
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
  it('carries later project tempo points into Score Object time entry', () => {
    const { data, target } = createDataWithGenericScore();
    const tempoMap = data.getScore().getTimeContext().getTempoMap();
    tempoMap.addTempoPoint(new TempoPoint(4, 120, CurveType.CONSTANT));
    tempoMap.setEnabled(true);
    const doc = createScoreObjectEditorDocument(data, { target })!;

    expect(formatForBase(8, 'SECONDS', doc.timeContext, false)).toBe('6');
    expect(parseForBase('6', 'SECONDS', doc.timeContext, false)).toBe(8);
  });

  it('uses the project SMPTE frame rate for Score Object time entry', () => {
    const { data, target } = createDataWithGenericScore();
    data.getScore().getTimeState().setSmpteFrameRate(30);
    const doc = createScoreObjectEditorDocument(data, { target })!;

    expect(formatForBase(1.5, 'SMPTE', doc.timeContext, false)).toBe('00:00:01:15');
    expect(parseForBase('00:00:01:15', 'SMPTE', doc.timeContext, false)).toBeCloseTo(1.5);
  });

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
      location: {
        rootGroupIndex: polyGroupIndex,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
      },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'moveScoreObjects',
          moves: [
            {
              target,
              targetStartBeats: 4.5,
              targetLayerIndex: 1,
              targetGroupId: groupId,
            },
          ],
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
  it('commits PianoRoll Base Frequency through ProjectHistory with undo and redo', async () => {
    const { data, pianoRoll, target } = createDataWithPianoRoll();
    const note = new PianoNote();
    note.setStart(1);
    note.setDuration(2);
    note.setOctave(8);
    note.setScaleDegree(7);
    pianoRoll.addNote(note);

    const session = new ProjectSession();
    session.replace(data, join(tmpdir(), 'piano-roll-base-frequency.blue'));
    const documentId = session.read().documentId!;
    const history = new ProjectHistory({ session });
    history.markClean();
    const baseFrequencyPatch = {
      score: {
        type: 'updateTypeSpecificEditor' as const,
        target,
        patch: {
          scale: {
            scaleName: '12TET',
            baseFrequency: 440,
            octave: 2,
            ratios: [1, 1.5],
          },
        },
      },
    };
    const currentPianoRoll = () =>
      (session.read().data!.getScore()[0] as PolyObject)[0]![0] as PianoRoll;
    const assertEditorTargetAndNotes = () => {
      const document = createScoreObjectEditorDocument(session.read().data!, { target });
      expect(document?.target.selectionId).toBe(target.selectionId);
      expect(document?.editor.kind).toBe('structured');
      expect(currentPianoRoll().getNotes()).toMatchObject([
        { start: 1, duration: 2, octave: 8, scaleDegree: 7 },
      ]);
    };

    const commit = await history.commit({
      documentId,
      operationId: 'base-frequency-commit',
      expectedRevision: 0,
      contextSequence: 0,
      label: 'Set PianoRoll Base Frequency',
      patches: [baseFrequencyPatch],
    });

    expect(commit.status).toBe('committed');
    expect(history.read().undoLabel).toBe('Set PianoRoll Base Frequency');
    expect(history.isDirty()).toBe(true);
    expect(currentPianoRoll().getScale().baseFrequency).toBeCloseTo(440);
    assertEditorTargetAndNotes();

    const undo = await history.undo({
      documentId,
      operationId: 'base-frequency-undo',
      expectedRevision: session.read().revision,
      contextSequence: 1,
    });
    expect(undo.status).toBe('committed');
    expect(history.isDirty()).toBe(false);
    expect(currentPianoRoll().getScale().baseFrequency).toBeCloseTo(261.625565);
    assertEditorTargetAndNotes();

    const redo = await history.redo({
      documentId,
      operationId: 'base-frequency-redo',
      expectedRevision: session.read().revision,
      contextSequence: 2,
    });
    expect(redo.status).toBe('committed');
    expect(history.isDirty()).toBe(true);
    expect(currentPianoRoll().getScale().baseFrequency).toBeCloseTo(440);
    assertEditorTargetAndNotes();
  });

  it('keeps PatternObject preview and canonical grid aligned after a beat resize', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const patternObject = new PatternObject();
    const row = new Pattern(16);
    row.values[2] = true;
    row.values[14] = true;
    patternObject.addPattern(row);
    layer.push(patternObject);
    poly.push(layer);
    data.getScore().push(poly);
    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'PatternObject',
      editorObjectType: 'PatternObject',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
    const patch = { type: 'updateTypeSpecificEditor' as const, target, patch: { beats: 2 } };
    const before = createScoreObjectEditorDocument(data, { target })!;
    const preview = applyPatchToDocument(before, patch);

    expect(applyProjectDocumentPatch(data, { score: patch })).toBe(true);
    expect(patternObject.getPattern(0).values).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    const after = createScoreObjectEditorDocument(data, { target })!;
    if (preview.editor.kind !== 'structured' || after.editor.kind !== 'structured') {
      throw new Error('Expected structured PatternObject editors');
    }
    expect(preview.editor.payload.patterns).toEqual(after.editor.payload.patterns);
  });

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
          patch: {
            updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 1, value: '8.07' },
          },
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

  it('handles AudioFile document creation and patches', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const af = new AudioFile();
    af.setName('Old Name');
    af.setSoundFileName('old_path.wav');
    af.setCsoundPostCode('; initial post code');
    layer.push(af);
    poly.push(layer);
    data.getScore().push(poly);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'AudioFile',
      editorObjectType: 'AudioFile',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('audioFile');
    if (doc!.editor.kind === 'audioFile') {
      expect(doc!.editor.filePath).toBe('old_path.wav');
      expect(doc!.editor.csoundPostCode).toBe('; initial post code');
      expect(doc!.editor.canChooseFile).toBe(true);
    }

    // replaceAudioFileSource patch
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceAudioFileSource',
          target,
          filePath: 'media/new_track.wav',
          name: 'new_track.wav',
        },
      }),
    ).toBe(true);
    expect(af.getSoundFileName()).toBe('media/new_track.wav');
    expect(af.getName()).toBe('new_track.wav');

    // updateAudioFilePostCode patch
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateAudioFilePostCode',
          target,
          csoundPostCode: 'aChannel1 = aChannel1 * 0.8',
        },
      }),
    ).toBe(true);
    expect(af.getCsoundPostCode()).toBe('aChannel1 = aChannel1 * 0.8');
  });

  it('handles FrozenSoundObject document creation and rejects file path edits', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const inner = new GenericScore();
    inner.setName('Source Score');
    const fso = new FrozenSoundObject();
    fso.setFrozenSoundObject(inner);
    fso.setFrozenWaveFileName('freeze0.wav');
    fso.setNumChannels(2);
    layer.push(fso);
    poly.push(layer);
    data.getScore().push(poly);

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'FrozenSoundObject',
      editorObjectType: 'FrozenSoundObject',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('frozenSoundObject');
    if (doc!.editor.kind === 'frozenSoundObject') {
      expect(doc!.editor.frozenWaveFileName).toBe('freeze0.wav');
      expect(doc!.editor.sourceName).toBe('Source Score');
      expect(doc!.editor.sourceType).toBe('GenericScore');
      expect(doc!.editor.numChannels).toBe(2);
      expect(doc!.editor.canSaveCopy).toBe(true);
    }

    // Attempting to mutate file path is rejected
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { filePath: 'arbitrary.wav' },
        },
      }),
    ).toBe(false);
    expect(fso.getFrozenWaveFileName()).toBe('freeze0.wav');
  });
});

it('provides the project DF mode and preceding tempo points to position and duration editors', () => {
  const { data, target } = createDataWithGenericScore();
  const state = data.getScore().getTimeState();
  state.setSmpteFrameRate(29.97);
  state.setSmpteDropFrame(true);
  const tempo = data.getScore().getTimeContext().getTempoMap();
  tempo.setEnabled(true);
  tempo.addTempoPoint(new TempoPoint(30, 120, CurveType.CONSTANT));
  const doc = createScoreObjectEditorDocument(data, { target })!;
  expect(doc.timeContext.smpteDropFrame).toBe(true);
  expect(formatForBase(90.12, 'SMPTE', doc.timeContext, false)).toBe('00:01:00;02');
  expect(parseForBase('00:01:00;02', 'SMPTE', doc.timeContext, true)).toBeCloseTo(90.12, 12);
});
