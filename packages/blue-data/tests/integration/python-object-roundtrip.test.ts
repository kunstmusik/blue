import { beforeAll, describe, it, expect } from 'vitest';
import { PythonObject } from '../../src/sound-objects/python-object';
import { JavaScriptObject } from '../../src/sound-objects/javascript-object';
import { CSDSoundObject } from '../../src/sound-objects/csd-sound-object';
import { Comment } from '../../src/sound-objects/comment';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { PolyObject } from '../../src/sound-objects/poly-object';
import { CompileData } from '../../src/compile-data';
import {
  disposeJavaScriptCompileState,
  initializeJavaScriptRuntime,
} from '../../src/javascript-runtime';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { TimeContext } from '../../src/time/time-context';
import { loadSoundObjectFromXML } from '../../src/sound-objects/sound-object-registry';
import { Element } from '../../src/serialization/xml-reader';
import '../../src/sound-objects/register-sound-object-types';

beforeAll(async () => {
  await initializeJavaScriptRuntime();
});

describe('PythonObject', () => {
  it('creates with defaults', () => {
    const obj = new PythonObject();
    expect(obj.getName()).toBe('PythonObject');
    expect(obj.getPythonCode()).toBe('score = "i1 0 2 3 4 5"');
    expect(obj.isOnLoadProcessable()).toBe(false);
  });

  it('sets and gets properties', () => {
    const obj = new PythonObject();
    obj.setName('My Python');
    obj.setPythonCode('score = "i1 0 2 440"');
    obj.setOnLoadProcessable(true);

    expect(obj.getName()).toBe('My Python');
    expect(obj.getPythonCode()).toBe('score = "i1 0 2 440"');
    expect(obj.isOnLoadProcessable()).toBe(true);
  });

  it('generateForCSD returns empty (JVM-dependent)', () => {
    const obj = new PythonObject();
    obj.setPythonCode('score = "i1 0 2"');
    const context = new TimeContext();
    const notes = obj.generateForCSD(context, {} as any, 0, -1);
    expect(notes.length).toBe(0);
  });

  it('round-trips through XML', () => {
    const obj = new PythonObject();
    obj.setName('Test Python');
    obj.setPythonCode('score = "i1 0 2 440 0.5"');
    obj.setOnLoadProcessable(true);
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));

    const xml = obj.saveAsXML();
    const reloaded = PythonObject.loadFromXML(xml);

    expect(reloaded.getName()).toBe('Test Python');
    expect(reloaded.getPythonCode()).toBe('score = "i1 0 2 440 0.5"');
    expect(reloaded.isOnLoadProcessable()).toBe(true);
  });

  it('loads via registry', () => {
    const obj = new PythonObject();
    obj.setPythonCode('score = "i1 0 2"');
    const xml = obj.saveAsXML();

    const reloaded = loadSoundObjectFromXML(xml);
    expect(reloaded).toBeInstanceOf(PythonObject);
    expect((reloaded as PythonObject).getPythonCode()).toBe('score = "i1 0 2"');
  });
});

describe('JavaScriptObject', () => {
  it('creates with defaults', () => {
    const obj = new JavaScriptObject();
    expect(obj.getName()).toBe('javaScriptObject');
    expect(obj.getJavaScriptCode()).toBe('score = "i1 0 2 3 4 5";');
  });

  it('sets and gets properties', () => {
    const obj = new JavaScriptObject();
    obj.setName('My JS');
    obj.setJavaScriptCode('score = "i1 0 2 440";');

    expect(obj.getName()).toBe('My JS');
    expect(obj.getJavaScriptCode()).toBe('score = "i1 0 2 440";');
  });

  it('generates notes from JS code', () => {
    const obj = new JavaScriptObject();
    obj.setJavaScriptCode('score = "i1 0 2 440 0.5\\ni2 3 1 880 0.3";');
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));

    const context = new TimeContext();
    const compileData = new CompileData();

    try {
      const notes = obj.generateForCSD(context, compileData, 0, -1);

      expect(notes.length).toBe(2);
      expect(notes.getNote(0).getStartTime()).toBe(0);
      expect(notes.getNote(0).getSubjectiveDuration()).toBe(2);
      expect(notes.getNote(1).getStartTime()).toBe(3);
      expect(notes.getNote(1).getSubjectiveDuration()).toBe(1);
    } finally {
      disposeJavaScriptCompileState(compileData);
    }
  });

  it('shares globals across objects in one compile pass', () => {
    const first = new JavaScriptObject();
    first.setJavaScriptCode('globalThis.sharedSeed = 41; score = "";');

    const second = new JavaScriptObject();
    second.setJavaScriptCode('score = "i1 0 1 " + (globalThis.sharedSeed + 1);');

    const context = new TimeContext();
    const compileData = new CompileData();

    try {
      first.generateForCSD(context, compileData, 0, -1);
      const notes = second.generateForCSD(context, compileData, 0, -1);

      expect(notes.length).toBe(1);
      expect(notes.getNote(0).getPField(4)).toBe('42');
    } finally {
      disposeJavaScriptCompileState(compileData);
    }
  });

  it('wraps QuickJS errors in SoundObjectException', () => {
    const obj = new JavaScriptObject();
    obj.setJavaScriptCode('throw new Error("boom");');

    const compileData = new CompileData();

    try {
      expect(() => obj.generateForCSD(new TimeContext(), compileData, 0, -1)).toThrow(
        'JavaScript execution error: boom',
      );
    } finally {
      disposeJavaScriptCompileState(compileData);
    }
  });

  it('round-trips through XML', () => {
    const obj = new JavaScriptObject();
    obj.setName('Test JS');
    obj.setJavaScriptCode('score = "i1 0 2";');
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));

    const xml = obj.saveAsXML();
    const reloaded = JavaScriptObject.loadFromXML(xml);

    expect(reloaded.getName()).toBe('Test JS');
    expect(reloaded.getJavaScriptCode()).toBe('score = "i1 0 2";');
  });

  it('loads via registry', () => {
    const obj = new JavaScriptObject();
    obj.setJavaScriptCode('score = "i1 0 2";');
    const xml = obj.saveAsXML();

    const reloaded = loadSoundObjectFromXML(xml);
    expect(reloaded).toBeInstanceOf(JavaScriptObject);
    expect((reloaded as JavaScriptObject).getJavaScriptCode()).toBe('score = "i1 0 2";');
  });
});

describe('CSDSoundObject', () => {
  it('creates with defaults', () => {
    const obj = new CSDSoundObject();
    expect(obj.getCsdText()).toBe('');
  });

  it('sets and gets CSD text', () => {
    const obj = new CSDSoundObject();
    obj.setCsdText('<CsoundSynthesizer><CsOptions></CsOptions></CsoundSynthesizer>');
    expect(obj.getCsdText()).toContain('<CsoundSynthesizer>');
  });

  it('round-trips through XML', () => {
    const obj = new CSDSoundObject();
    obj.setName('Test CSD');
    obj.setCsdText('<CSD>test</CSD>');
    obj.setStartTime(TimePosition.beats(0));
    obj.setSubjectiveDuration(TimeDuration.beats(4));

    const xml = obj.saveAsXML();
    const reloaded = CSDSoundObject.loadFromXML(xml);

    expect(reloaded.getName()).toBe('Test CSD');
    expect(reloaded.getCsdText()).toBe('<CSD>test</CSD>');
  });

  it('loads via registry', () => {
    const obj = new CSDSoundObject();
    obj.setCsdText('<CSD/>');
    const xml = obj.saveAsXML();

    const reloaded = loadSoundObjectFromXML(xml);
    expect(reloaded).toBeInstanceOf(CSDSoundObject);
  });
});

describe('Comment', () => {
  it('creates with defaults', () => {
    const obj = new Comment();
    expect(obj.getText()).toBe('');
  });

  it('sets and gets text', () => {
    const obj = new Comment();
    obj.setText('This is a comment');
    expect(obj.getText()).toBe('This is a comment');
  });

  it('generateForCSD returns empty', () => {
    const obj = new Comment();
    obj.setText('Some comment');
    const context = new TimeContext();
    const notes = obj.generateForCSD(context, {} as any, 0, -1);
    expect(notes.length).toBe(0);
  });

  it('round-trips through XML', () => {
    const obj = new Comment();
    obj.setName('My Comment');
    obj.setText('This is important');

    const xml = obj.saveAsXML();
    const reloaded = Comment.loadFromXML(xml);

    expect(reloaded.getName()).toBe('My Comment');
    expect(reloaded.getText()).toBe('This is important');
  });

  it('loads via registry', () => {
    const obj = new Comment();
    obj.setText('Registry test');
    const xml = obj.saveAsXML();

    const reloaded = loadSoundObjectFromXML(xml);
    expect(reloaded).toBeInstanceOf(Comment);
    expect((reloaded as Comment).getText()).toBe('Registry test');
  });
});

describe('SoundObjectRegistry', () => {
  it('dispatches GenericScore via registry', () => {
    const gs = new GenericScore();
    gs.setScoreText('i1 0 2');
    const xml = gs.saveAsXML();

    const reloaded = loadSoundObjectFromXML(xml);
    expect(reloaded).toBeInstanceOf(GenericScore);
    expect((reloaded as GenericScore).getScoreText()).toBe('i1 0 2');
  });

  it('dispatches PolyObject via registry', () => {
    const pObj = new PolyObject();
    pObj.setName('Registry Test');
    const xml = pObj.saveAsXML();

    const reloaded = loadSoundObjectFromXML(xml);
    expect(reloaded).toBeInstanceOf(PolyObject);
    expect((reloaded as PolyObject).getName()).toBe('Registry Test');
  });

  it('returns null for unknown type', () => {
    const elem = new Element('soundObject');
    elem.setAttribute('type', 'UnknownType');
    elem.addElement('name').setText('Test');

    const reloaded = loadSoundObjectFromXML(elem);
    expect(reloaded).toBeNull();
  });
});
