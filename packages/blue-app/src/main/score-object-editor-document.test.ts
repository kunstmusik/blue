import { describe, expect, it } from 'vitest';
import {
  BlueData,
  ClojureObject,
  ObjectBuilder,
  PolyObject,
  SoundLayer,
  GenericScore,
  PythonObject,
  JavaScriptObject,
  Comment,
  External,
  AudioFile,
  FrozenSoundObject,
  AudioClip,
  AudioLayerGroup,
  AudioLayer,
  Instance,
  SoundObjectLibrary,
  PatternObject,
  Sound,
  TrackerObject,
  Track,
} from '@blue/data';
import {
  createScoreObjectEditorDocument,
  type ScoreObjectEditorTargetSnapshot,
  type ScoreObjectLibraryEntryRef,
} from '../shared/project-editor';

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

describe('createScoreObjectEditorDocument — code-backed types', () => {
  it('returns code editor with csound-score syntax for GenericScore', () => {
    const gs = new GenericScore();
    gs.setName('My Score');
    gs.setScoreText('i1 0 1 440');
    const data = makeDataWithObject(gs);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('GenericScore') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('csound-score');
      expect(doc!.editor.text).toBe('i1 0 1 440');
    }
    expect(doc!.shared.name).toBe('My Score');
  });

  it('returns code editor with python syntax for PythonObject', () => {
    const po = new PythonObject();
    po.setName('PyObj');
    po.setPythonCode('print("hello")');
    const data = makeDataWithObject(po);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('PythonObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('python');
      expect(doc!.editor.text).toBe('print("hello")');
    }
  });

  it('returns code editor with javascript syntax for JavaScriptObject', () => {
    const js = new JavaScriptObject();
    js.setName('JSObj');
    js.setJavaScriptCode('console.log("hi")');
    const data = makeDataWithObject(js);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('JavaScriptObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('javascript');
      expect(doc!.editor.text).toBe('console.log("hi")');
    }
  });

  it('returns code editor for ClojureObject with on-load flags', () => {
    const clj = new ClojureObject();
    clj.setName('CljObj');
    clj.setClojureCode('(def score "i1 0 1 330")');
    clj.setOnLoadProcessable(true);
    const data = makeDataWithObject(clj);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('ClojureObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('text');
      expect(doc!.editor.text).toBe('(def score "i1 0 1 330")');
      expect(doc!.editor.auxiliaryFlags).toEqual({ onLoadProcessable: true });
    }
  });

  it('returns code editor for ObjectBuilder with python syntax and builder metadata', () => {
    const objectBuilder = new ObjectBuilder();
    objectBuilder.setName('Builder');
    objectBuilder.setCode('score = "i1 0 1 220"');
    objectBuilder.setCommandLine('render --fast');
    objectBuilder.setLanguageType('PYTHON');
    objectBuilder.setEditEnabled(false);
    const data = makeDataWithObject(objectBuilder);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('ObjectBuilder') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('python');
      expect(doc!.editor.text).toBe('score = "i1 0 1 220"');
      expect(doc!.editor.auxiliaryFlags).toEqual({
        commandLine: 'render --fast',
        languageType: 'PYTHON',
        editEnabled: false,
      });
    }
  });

  it('returns code editor with text syntax for Comment', () => {
    const c = new Comment();
    c.setName('Note');
    c.setText('remember this');
    const data = makeDataWithObject(c);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('Comment') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.syntax).toBe('text');
      expect(doc!.editor.text).toBe('remember this');
    }
  });

  it('returns external editor for External with command line and syntax type', () => {
    const ext = new External();
    ext.setName('ExtCmd');
    ext.setText('ls -la');
    ext.setCommandLine('python script.py');
    ext.setSyntaxType('Python');
    const data = makeDataWithObject(ext);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('External') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('external');
    if (doc!.editor.kind === 'external') {
      expect(doc!.editor.scoreText).toBe('ls -la');
      expect(doc!.editor.commandLine).toBe('python script.py');
      expect(doc!.editor.syntaxType).toBe('Python');
      expect(doc!.editor.canTest).toBe(true);
    }
  });
});

describe('createScoreObjectEditorDocument — file-backed types', () => {
  it('returns file editor for AudioFile', () => {
    const af = new AudioFile();
    af.setName('Sound File');
    const data = makeDataWithObject(af);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('AudioFile') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('file');
    if (doc!.editor.kind === 'file') {
      expect(doc!.editor.filePath).toBeDefined();
    }
  });

  it('returns file editor for FrozenSoundObject', () => {
    const fso = new FrozenSoundObject();
    fso.setName('Frozen');
    const data = makeDataWithObject(fso);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('FrozenSoundObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('file');
  });
});

describe('createScoreObjectEditorDocument — structured types', () => {
  it('returns structured editor for PatternObject', () => {
    const po = new PatternObject();
    po.setName('Pattern');
    const data = makeDataWithObject(po);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('PatternObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('structured');
    if (doc!.editor.kind === 'structured') {
      expect(doc!.editor.editorFamily).toBe('PatternObject');
    }
  });

  it('returns structured editor for Sound (BSB)', () => {
    const s = new Sound();
    s.setName('BSB Instrument');
    const data = makeDataWithObject(s);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('Sound') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('structured');
  });
});

describe('createScoreObjectEditorDocument — Tier 1: polyObject', () => {
  it('returns polyObject editor with child rows for nested PolyObject', () => {
    const outerPoly = new PolyObject();
    const outerLayer = new SoundLayer();
    outerLayer.setName('Outer Layer');
    const innerPoly = new PolyObject();
    innerPoly.setName('Inner Group');
    const innerLayer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Child Score');
    gs.setScoreText('i1 0 1 440');
    innerLayer.push(gs);
    innerPoly.push(innerLayer);
    outerLayer.push(innerPoly);
    outerPoly.push(outerLayer);
    const data = new BlueData();
    data.getScore().length = 0;
    data.getScore().push(outerPoly);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('PolyObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('polyObject');
    if (doc!.editor.kind === 'polyObject') {
      expect(doc!.editor.children.length).toBe(1);
      expect(doc!.editor.children[0].name).toBe('Child Score');
      expect(doc!.editor.children[0].objectType).toBe('GenericScore');
      expect(doc!.editor.children[0].layerLabel).toBe('');
      expect(doc!.editor.canOpenInScore).toBe(true);
      expect(doc!.editor.canTest).toBe(true);
    }
  });

  it('returns polyObject editor with empty children for empty PolyObject', () => {
    const outerPoly = new PolyObject();
    const outerLayer = new SoundLayer();
    const innerPoly = new PolyObject();
    innerPoly.setName('Empty Group');
    outerLayer.push(innerPoly);
    outerPoly.push(outerLayer);
    const data = new BlueData();
    data.getScore().length = 0;
    data.getScore().push(outerPoly);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('PolyObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('polyObject');
    if (doc!.editor.kind === 'polyObject') {
      expect(doc!.editor.children.length).toBe(0);
    }
  });
});
describe('createScoreObjectEditorDocument — Tier 1: tracker', () => {
  it('returns tracker editor with tracks and rows', () => {
    const to = new TrackerObject();
    to.setName('My Tracker');
    to.setStepsPerBeat(4);

    const tracks = to.getTracks();
    tracks.setSteps(4);
    const t1 = new Track();
    tracks.addTrack(t1);
    t1.getTrackerNote(0).setValue(1, 'i1');
    t1.getTrackerNote(1).setValue(1, 'i2');
    t1.getTrackerNote(2).setValue(1, 'i3');
    t1.getTrackerNote(3).setValue(1, 'i4');

    const t2 = new Track();
    tracks.addTrack(t2);
    t2.getTrackerNote(0).setValue(1, '440');
    t2.getTrackerNote(1).setValue(1, '880');
    t2.getTrackerNote(2).setValue(1, '660');
    t2.getTrackerNote(3).setValue(1, '220');

    const data = makeDataWithObject(to);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('TrackerObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('tracker');
    if (doc!.editor.kind === 'tracker') {
      expect(doc!.editor.tracks.length).toBe(2);
      expect(doc!.editor.tracks[0].trackName).toBe('Track 1');
      expect(doc!.editor.tracks[0].columns.length).toBe(2); // pch, db
      expect(doc!.editor.tracks[0].columns.map((col) => ({ name: col.name, type: col.type }))).toEqual([
        { name: 'pch', type: 0 },
        { name: 'db', type: 4 },
      ]);
      expect(doc!.editor.tracks[0].columns[0]?.scale?.scaleName).toBe('12TET');
      expect(doc!.editor.tracks[0].columns[1]?.rangeMax).toBe(90);
      expect(doc!.editor.tracks[0].instrumentId).toBe('1');
      expect(doc!.editor.steps).toBe(4);
      expect(doc!.editor.rows.length).toBe(4);
      expect(doc!.editor.rows[0]['track-0-status']).toBe('');
      expect(doc!.editor.rows[0]['track-0-col-0']).toBe('i1');
      expect(doc!.editor.rows[0]['track-1-col-0']).toBe('440');
    }
  });

  it('returns tracker editor with empty tracks for empty TrackerObject', () => {
    const to = new TrackerObject();
    to.setName('Empty Tracker');
    const data = makeDataWithObject(to);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('TrackerObject') });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('tracker');
    if (doc!.editor.kind === 'tracker') {
      expect(doc!.editor.tracks.length).toBe(0);
      expect(doc!.editor.rows.length).toBe(0);
    }
  });
});

describe('createScoreObjectEditorDocument — audioClip type', () => {
  it('returns audioClip editor with all fields', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const alg = new AudioLayerGroup();
    const layer = new AudioLayer();
    const clip = new AudioClip();
    clip.setName('My Clip');
    clip.setAudioFile('test.wav');
    clip.setFileStartTime(1.5);
    clip.setFadeIn(0.1);
    clip.setFadeOut(0.2);
    clip.setLooping(null, true);
    layer.push(clip);
    alg.push(layer);
    data.getScore().push(alg);

    const target = makeTimelineTarget('AudioClip', { supportsTimeBehavior: false, supportsRepeatPoint: false, supportsNoteProcessorChain: false });
    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('audioClip');
    if (doc!.editor.kind === 'audioClip') {
      expect(doc!.editor.audioFile).toBe('test.wav');
      expect(doc!.editor.fileStartTime).toBeCloseTo(1.5);
      expect(doc!.editor.fadeIn).toBeCloseTo(0.1);
      expect(doc!.editor.fadeOut).toBeCloseTo(0.2);
      expect(doc!.editor.looping).toBe(true);
    }
    expect(doc!.shared.timeBehavior).toBeUndefined();
    expect(doc!.shared.repeatPoint).toBeUndefined();
  });
});

describe('createScoreObjectEditorDocument — Instance and library-backed', () => {
  it('resolves Instance to underlying library object via library ID', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Library Item');
    gs.setScoreText('i1 0 1 440');
    const lib = data.getSoundObjectLibrary();
    const libId = addLibObject(lib, gs);
    const inst = new Instance();
    inst.setLibraryId(libId);
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
      library: makeLibRef(libId, 'GenericScore'),
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('code');
    if (doc!.editor.kind === 'code') {
      expect(doc!.editor.text).toBe('i1 0 1 440');
    }
    expect(doc!.shared.name).toBe('Library Item');
  });

  it('resolves Instance to underlying library object via sourceInstanceLocation', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setName('Lib Via Loc');
    gs.setScoreText('i1 0 2 330');
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
    expect(doc!.shared.name).toBe('Lib Via Loc');
  });
});

describe('createScoreObjectEditorDocument — removed target', () => {
  it('returns fallback with removed-target reason for stale location', () => {
    const data = new BlueData();
    const target = makeTimelineTarget('GenericScore');

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('fallback');
    if (doc!.editor.kind === 'fallback') {
      expect(doc!.editor.reason).toBe('removed-target');
    }
  });
});

describe('createScoreObjectEditorDocument — shared properties completeness', () => {
  it('includes timeBehavior and repeatPoint for sound objects', () => {
    const gs = new GenericScore();
    gs.setName('TB Test');
    gs.setScoreText('i1 0 1 440');
    const data = makeDataWithObject(gs);

    const doc = createScoreObjectEditorDocument(data, { target: makeTimelineTarget('GenericScore') });
    expect(doc!.shared.timeBehavior).toBeDefined();
    expect(doc!.shared.repeatPoint).toBeDefined();
    expect(doc!.shared.noteProcessorChain).toBeDefined();
  });

  it('omits timeBehavior and repeatPoint for non-sound-objects (AudioClip)', () => {
    const data = new BlueData();
    const alg = new AudioLayerGroup();
    const layer = new AudioLayer();
    const clip = new AudioClip();
    layer.push(clip);
    alg.push(layer);
    data.getScore().push(alg);

    const target = makeTimelineTarget('AudioClip', { supportsTimeBehavior: false, supportsRepeatPoint: false, supportsNoteProcessorChain: false });
    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc!.shared.timeBehavior).toBeUndefined();
    expect(doc!.shared.repeatPoint).toBeUndefined();
    expect(doc!.shared.noteProcessorChain).toBeUndefined();
  });
});
