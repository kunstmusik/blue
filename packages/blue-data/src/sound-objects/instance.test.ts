import { beforeAll, describe, it, expect } from 'vitest';
import { Instance } from './instance';
import { GenericScore } from './generic-score';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';

import { JavaScriptObject } from './javascript-object';

import { CompileData } from '../compile-data';

import { TimeContext } from '../time/time-context';

import { TimePosition } from '../time/time-position';

import { TimeDuration } from '../time/time-duration';

import { TimeBehavior } from './time-behavior';

import { initializeJavaScriptRuntime } from '../javascript-runtime';

describe('Instance', () => {
  beforeAll(initializeJavaScriptRuntime);
  it('repeats linked source notes within its own duration at its Score start', async () => {
    const context = new TimeContext();
    const source = new GenericScore();
    source.setScoreText('i1 2 1 440');
    source.setTimeBehavior(TimeBehavior.NONE);
    const instance = new Instance();
    instance.setSoundObject(source);
    instance.setStartTime(TimePosition.beats(10));
    instance.setSubjectiveDuration(TimeDuration.beats(4));
    instance.setTimeBehavior(TimeBehavior.REPEAT);

    const expected = [10, 11, 12, 13];
    expect(
      Array.from(instance.generateForCSD(context, new CompileData(), 0, -1), (note) =>
        note.getStartTime(),
      ),
    ).toEqual(expected);
    expect(
      Array.from(await instance.generateForCSDAsync(context, new CompileData(), 0, -1), (note) =>
        note.getStartTime(),
      ),
    ).toEqual(expected);

    const generated = new JavaScriptObject();
    generated.setJavaScriptCode('score = "i1 2 1 440";');
    generated.setTimeBehavior(TimeBehavior.NONE);
    instance.setSoundObject(generated);
    expect(
      Array.from(await instance.generateForCSDAsync(context, new CompileData(), 0, -1), (note) =>
        note.getStartTime(),
      ),
    ).toEqual(expected);
  });

  describe('default state', () => {
    it('has no sound object', () => {
      const inst = new Instance();
      expect(inst.getSoundObject()).toBeNull();
    });

    it('has empty library id', () => {
      const inst = new Instance();
      expect(inst.getLibraryId()).toBe('');
    });
  });

  describe('library binding', () => {
    it('stores library id when objRefMap does not have the reference', () => {
      const xml = `<soundObject type="Instance">
        <name>My Instance</name>
        <soundObjectReference soundObjectLibraryID="lib_0"/>
      </soundObject>`;
      const elem = Element.parse(xml);
      const inst = Instance.loadFromXML(elem);
      expect(inst.getLibraryId()).toBe('lib_0');
      expect(inst.getSoundObject()).toBeNull();
    });

    it('resolves library reference when objRefMap has the object', () => {
      const libObj = new GenericScore();
      libObj.setName('Library Score');

      const objRefMap = new ObjRefLoadMap();
      objRefMap.register('lib_0', libObj);

      const xml = `<soundObject type="Instance">
        <name>My Instance</name>
        <soundObjectReference soundObjectLibraryID="lib_0"/>
      </soundObject>`;
      const elem = Element.parse(xml);
      const inst = Instance.loadFromXML(elem, objRefMap);
      expect(inst.getSoundObject()).toBe(libObj);
      expect(inst.getLibraryId()).toBe('lib_0');
    });

    it('handles null reference safely', () => {
      const xml = `<soundObject type="Instance">
        <name>My Instance</name>
        <soundObjectReference soundObjectLibraryID="null"/>
      </soundObject>`;
      const elem = Element.parse(xml);
      const inst = Instance.loadFromXML(elem);
      expect(inst.getSoundObject()).toBeNull();
      expect(inst.getLibraryId()).toBe('');
    });
  });

  describe('saveAsXML', () => {
    it('saves soundObjectReference with library id', () => {
      const inst = new Instance();
      inst.setName('Test Instance');
      const libObj = new GenericScore();
      libObj.setName('Lib Score');
      inst.setSoundObject(libObj);

      const objRefMap = new ObjRefSaveMap();
      const xml = inst.saveAsXML(objRefMap);
      expect(xml.getAttribute('type')).toBe('blue.soundObject.Instance');

      const refElem = xml.getElement('soundObjectReference');
      expect(refElem).not.toBeNull();
      expect(refElem!.getAttribute('soundObjectLibraryID')).toBeTruthy();
    });
  });

  describe('deepCopy', () => {
    it('copies library id and shared sound object reference', () => {
      const original = new Instance();
      original.setName('Original');
      original.setLibraryId('lib_0');
      const libObj = new GenericScore();
      original.setSoundObject(libObj);

      const copy = original.deepCopy() as Instance;
      expect(copy.getLibraryId()).toBe('lib_0');
      // Java semantics: sound object reference is shared, not deep-copied
      expect(copy.getSoundObject()).toBe(libObj);
    });
  });
});
