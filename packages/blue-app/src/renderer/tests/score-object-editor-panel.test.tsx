import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericScore,
  PythonObject,
  JavaScriptObject,
  Comment,
  External,
  AudioClip,
  AudioLayerGroup,
  AudioLayer,
  PolyObject,
  SoundLayer,
  Instance,
  SoundObjectLibrary,
  PatternObject,
  Sound,
  AudioFile,
  FrozenSoundObject,
  LineObject,
  ZakLineObject,
  PianoRoll,
  PianoNote,
  TrackerObject,
  NotationObject,
  JMask,
  FadeType,
  TimeBase,
  TimeBehavior,
  TimeDuration,
  NoteProcessorChain,
} from '@blue/data';
import {
  createScoreObjectEditorDocument,
  applyProjectDocumentPatch,
  type ScoreObjectEditorTargetSnapshot,
  type ScoreObjectLibraryEntryRef,
  type BlueSynthBuilderInstrumentSnapshot,
  type UdoDefinitionSnapshot,
  type ScoreObjectEditorDocumentSnapshot,
  type ScorePatch,
} from '../../shared/project-editor';
import AudioClipScoreObjectEditor from '../components/workbench/panels/score-object/editors/AudioClipScoreObjectEditor';
import SoundEditor from '../components/workbench/panels/score-object/editors/SoundEditor';

function udoSnapshot(name: string): UdoDefinitionSnapshot {
  return {
    name,
    style: 'CLASSIC',
    outTypes: 'a',
    inTypes: 'a',
    inputArguments: '',
    code: '',
    comments: '',
  };
}

function makeBsbInstrument(udoNames: string[] = []): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: 'sound-bsb',
    type: 'blueSynthBuilder',
    name: 'Sound BSB',
    enabled: true,
    comment: '',
    instrumentText: 'aout oscili <amp>, <freq>',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: ['amp', 'freq'],
    widgets: [],
    editEnabled: true,
    gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10 },
    widgetTree: {
      id: 'root', type: 'BSBRootGroup', objectName: '',
      x: 0, y: 0, width: 0, height: 0,
      value: 0, minimum: 0, maximum: 0,
      editable: true, properties: {},
      children: [],
    },
    udolist: udoNames.map(udoSnapshot),
  };
}

function makeLibRef(libId: string, objectType: string, index: number = 0): ScoreObjectLibraryEntryRef {
  return { libraryId: libId, libraryIndex: index, objectType };
}

function addLibObject(lib: SoundObjectLibrary, obj: any): string {
  return lib.addObject(obj);
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

describe('Code-backed editor document creation (T026)', () => {
  it('GenericScore produces code editor with csound-score syntax and editable text', () => {
    const gs = new GenericScore();
    gs.setName('Score');
    gs.setScoreText('i1 0 1 440');
    const data = makeDataWithObject(gs);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('GenericScore') });
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('csound-score');
      expect(doc!.editor.text).toBe('i1 0 1 440');
    }
  });

  it('PythonObject produces code editor with python syntax', () => {
    const po = new PythonObject();
    po.setPythonCode('print("test")');
    const data = makeDataWithObject(po);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('PythonObject') });
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('python');
    }
  });

  it('JavaScriptObject produces code editor with javascript syntax', () => {
    const js = new JavaScriptObject();
    js.setJavaScriptCode('console.log("test");');
    const data = makeDataWithObject(js);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('JavaScriptObject') });
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('javascript');
    }
  });

  it('Comment produces code editor with text syntax', () => {
    const c = new Comment();
    c.setText('A comment');
    const data = makeDataWithObject(c);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('Comment') });
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('text');
    }
  });

  it('External produces code editor with text syntax', () => {
    const ext = new External();
    ext.setText('external command text');
    const data = makeDataWithObject(ext);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('External') });
    expect(doc!.editor.kind).toBe('external');
    if (doc!.editor.kind === 'external') {
      expect(doc!.editor.scoreText).toBe('external command text');
    }
  });
});

describe('AudioClip editor document creation and mutation (T026)', () => {
  function makeAudioClipData() {
    const data = new BlueData();
    data.getScore().length = 0;
    const alg = new AudioLayerGroup();
    const layer = new AudioLayer();
    const clip = new AudioClip();
    clip.setName('Test Clip');
    clip.setAudioFile('sound.wav');
    clip.setFileStartTime(0.5);
    clip.setFadeIn(0.1);
    clip.setFadeInType(FadeType.CONSTANT_POWER);
    clip.setFadeOut(0.2);
    clip.setFadeOutType(FadeType.SLOW);
    clip.setLooping(null, true);
    layer.push(clip);
    alg.push(layer);
    data.getScore().push(alg);

    const target = makeTimelineTarget('AudioClip', {
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    });

    return { data, clip, target };
  }

  it('creates audioClip editor document with all fields', () => {
    const { data, target } = makeAudioClipData();
    const doc = createScoreObjectEditorDocument(data, { target });

    expect(doc!.editor.kind).toBe('audioClip');
    if (doc!.editor.kind === 'audioClip') {
      expect(doc!.editor.audioFile).toBe('sound.wav');
      expect(doc!.editor.fileStartTime).toBeCloseTo(0.5);
      expect(doc!.editor.fadeIn).toBeCloseTo(0.1);
      expect(doc!.editor.fadeInType).toBe('CONSTANT_POWER');
      expect(doc!.editor.fadeOut).toBeCloseTo(0.2);
      expect(doc!.editor.fadeOutType).toBe('SLOW');
      expect(doc!.editor.looping).toBe(true);
    }
  });

  it('renders the audio clip editor in a scrollable container', () => {
    const { data, target } = makeAudioClipData();
    const doc = createScoreObjectEditorDocument(data, { target });

    const html = renderToStaticMarkup(
      <AudioClipScoreObjectEditor document={doc!} onPatch={() => undefined} />,
    );

    expect(html).toContain('h-full overflow-y-auto py-2');
    expect(html).toContain('value="0:00:00.500"');
  });

  it('applies updateTypeSpecificEditor patch for audioFile', () => {
    const { data, clip, target } = makeAudioClipData();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: { audioFile: 'new-sound.wav' },
      },
    });

    expect(clip.getAudioFile()).toBe('new-sound.wav');
  });

  it('applies updateTypeSpecificEditor patch for fade values', () => {
    const { data, clip, target } = makeAudioClipData();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: { fadeIn: 0.5, fadeOut: 0.8 },
      },
    });

    expect(clip.getFadeIn()).toBeCloseTo(0.5);
    expect(clip.getFadeOut()).toBeCloseTo(0.8);
  });

  it('applies updateTypeSpecificEditor patch for looping', () => {
    const { data, clip, target } = makeAudioClipData();
    expect(clip.isLooping()).toBe(true);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: { looping: false },
      },
    });

    expect(clip.isLooping()).toBe(false);
  });

  it('applies updateTypeSpecificEditor patch for fade types', () => {
    const { data, clip, target } = makeAudioClipData();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: { fadeInType: 'FAST', fadeOutType: 'LINEAR' },
      },
    });

    expect(String(clip.getFadeInType())).toBe('Fast');
    expect(String(clip.getFadeOutType())).toBe('Linear');
  });
});

describe('Instance and library-backed routing (T027)', () => {
  it('resolves Instance to underlying library GenericScore', () => {
    const data = new BlueData();
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Lib Score');
    gs.setScoreText('i1 0 1 440');
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
      library: makeLibRef(libId, 'GenericScore', 0),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.text).toBe('i1 0 1 440');
      expect(doc!.editor.syntax).toBe('csound-score');
    }
    expect(doc!.shared.name).toBe('Lib Score');
  });

  it('mutates library-backed object via updateSharedProperties patch', () => {
    const data = new BlueData();
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Original');
    gs.setScoreText('i1 0 1 440');
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
      library: makeLibRef(libId, 'GenericScore', 0),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateSharedProperties',
        target,
        patch: { name: 'Renamed Library Score' },
      },
    });

    expect(gs.getName()).toBe('Renamed Library Score');
  });

  it('returns fallback when library ID is invalid', () => {
    const data = new BlueData();
    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Instance',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'instance',
      library: { libraryId: 'nonexistent-id' },
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

describe('PianoRoll editor document and mutation', () => {
  function makePianoRollData() {
    const pr = new PianoRoll();
    const note = new PianoNote();
    note.initFields(pr.getFieldDefinitions());
    note.setStart(1);
    note.setDuration(2);
    note.setOctave(8);
    note.setScaleDegree(7);
    note.getFields()[0]!.setValue(0.5);
    pr.addNote(note);

    const data = makeDataWithObject(pr);
    const target = makeTimelineTarget('PianoRoll');
    return { data, pr, target };
  }

  it('creates PianoRoll editor payload with snap, ruler, and note data', () => {
    const { data, target } = makePianoRollData();
    const doc = createScoreObjectEditorDocument(data, { target });

    expect(doc!.editor.kind).toBe('structured');
    if (doc!.editor.kind === 'structured') {
      expect(doc!.editor.payload.snapValue).toBe('SIXTEENTH');
      expect(doc!.editor.payload.primaryTimeDisplay).toBe(TimeBase.BBF);
      expect(doc!.editor.payload.secondaryTimeDisplay).toBe(TimeBase.TIME);
      expect(doc!.editor.payload.capabilities).toMatchObject({
        fieldEditor: true,
        clipboard: true,
        undo: true,
        noteTemplateOverride: true,
      });
      expect(doc!.editor.payload.deferredCapabilities).toEqual([]);
      expect(doc!.editor.payload.notes).toMatchObject([
        { start: 1, duration: 2, octave: 8, scaleDegree: 7, fieldValues: [0.5] },
      ]);
    }
  });

  it('applies PianoRoll snap, ruler, and field value patches', () => {
    const { data, pr, target } = makePianoRollData();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: {
          snapValue: 'EIGHTH',
          useGlobalRuler: true,
          primaryTimeDisplay: TimeBase.BEATS,
          secondaryRulerEnabled: true,
          secondaryTimeDisplay: TimeBase.SMPTE,
          pianoRollNoteBatch: {
            operations: [{
              kind: 'update',
              noteIndex: 0,
              note: { octave: 8, scaleDegree: 7, start: 1, duration: 2, fieldValues: [0.75], noteTemplate: 'i1 0 1 440' },
            }],
          },
        },
      },
    });

    expect(pr.getSnapValueEnum()).toBe('EIGHTH');
    expect(pr.isUseGlobalRuler()).toBe(true);
    expect(pr.getPrimaryTimeDisplay()).toBe(TimeBase.BEATS);
    expect(pr.isSecondaryRulerEnabled()).toBe(true);
    expect(pr.getSecondaryTimeDisplay()).toBe(TimeBase.SMPTE);
    expect(pr.getNotes()[0]!.getFields()[0]!.getValue()).toBeCloseTo(0.75);
    expect(pr.getNotes()[0]!.getNoteTemplate()).toBe('i1 0 1 440');
  });

  it('applies PianoRoll scale and field-definition patches canonically', () => {
    const { data, pr, target } = makePianoRollData();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: {
          scale: {
            scaleName: 'Modified',
            baseFrequency: 440,
            octave: 2,
            ratios: [1, 1.5],
          },
          addFieldDef: {
            fieldName: 'PAN',
            fieldType: 'DISCRETE',
            minValue: 0,
            maxValue: 8,
            defaultValue: 5,
          },
          updateFieldDef: {
            index: 1,
            fieldName: 'PAN2',
            defaultValue: 6,
          },
          removeFieldDef: 0,
        },
      },
    });

    expect(pr.getScale().scaleName).toBe('Modified');
    expect(pr.getScale().baseFrequency).toBeCloseTo(440);
    expect(pr.getFieldDefinitions()).toHaveLength(1);
    expect(pr.getFieldDefinitions()[0]!.getFieldName()).toBe('PAN2');
    expect(pr.getFieldDefinitions()[0]!.getDefaultValue()).toBeCloseTo(6);
    expect(pr.getNotes()[0]!.getFields()).toHaveLength(1);
    expect(pr.getNotes()[0]!.getFields()[0]!.getValue()).toBe(5);
  });
});

describe('Sound object UDO completion scope (US1, T010)', () => {
  function makeSoundDocument(udolist: UdoDefinitionSnapshot[]): ScoreObjectEditorDocumentSnapshot {
    return {
      shared: {
        name: 'Sound',
        comment: '',
        startTime: { value: 0, unit: 'BEATS' },
        subjectiveDuration: { value: 4, unit: 'BEATS' },
        timeBehavior: TimeBehavior.SCORE,
        repeatPoint: null,
        noteProcessorChain: { chains: [], selectedId: null },
        target: makeTimelineTarget('Sound'),
      },
      editor: {
        kind: 'structured',
        editorFamily: 'Sound',
        payload: {
          comment: '',
          bsbInstrument: makeBsbInstrument(udolist.map((u) => u.name)),
          automationParameters: [],
          availableTabs: ['code', 'interface', 'udo', 'comments'],
          testAvailable: false,
          deferredCapabilities: [],
        },
      },
    } as unknown as ScoreObjectEditorDocumentSnapshot;
  }

  it('project Sound BlueSynthBuilder orchestra fields receive owner-plus-project scope', () => {
    const document = makeSoundDocument([udoSnapshot('OwnerUDO')]);
    const html = renderToStaticMarkup(
      React.createElement(SoundEditor, {
        document,
        projectUdos: [udoSnapshot('ProjectUDO')],
        onPatch: ((_patch: ScorePatch) => {}) as (patch: ScorePatch) => void,
      }),
    );

    // The Sound code tab (active first) renders the BSB code editor; owner (1)
    // plus project (1) UDOs are supplied to its orchestra fields.
    const scopes = [...html.matchAll(/data-udo-scope="([^"]+)"/g)].map((m) => m[1]);
    expect(scopes.filter((scope) => scope === '1:1').length).toBe(3);
  });
});
