import { describe, expect, test } from 'vitest';
import { PolyObject } from './poly-object';
import { SoundLayer } from './sound-layer';
import { GenericScore } from './generic-score';
import { Instance } from './instance';
import { SoundObjectLibrary, collectInstanceSoundObjects } from './sound-object-library';
import { TimeContext } from '../time/time-context';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';

describe('PolyObject normalization and instance registration', () => {
  const context = new TimeContext();

  test('normalizeSoundObjects shifts child sound objects relative to 0.0 beats and sets subjectiveDuration', () => {
    const pObj = new PolyObject(false);
    const layer1 = new SoundLayer();
    const layer2 = new SoundLayer();

    const obj1 = new GenericScore();
    obj1.setStartTime(TimePosition.beats(2.5));
    obj1.setSubjectiveDuration(TimeDuration.beats(3.0));

    const obj2 = new GenericScore();
    obj2.setStartTime(TimePosition.beats(4.0));
    obj2.setSubjectiveDuration(TimeDuration.beats(2.0));

    layer1.push(obj1);
    layer2.push(obj2);

    pObj.push(layer1);
    pObj.push(layer2);

    pObj.normalizeSoundObjects(context);

    // obj1 original start 2.5 -> shifted by -2.5 = 0.0
    expect(obj1.getStartTime().toBeats(context)).toBeCloseTo(0.0);
    // obj2 original start 4.0 -> shifted by -2.5 = 1.5
    expect(obj2.getStartTime().toBeats(context)).toBeCloseTo(1.5);

    // Max duration: obj1 end = 0.0 + 3.0 = 3.0; obj2 end = 1.5 + 2.0 = 3.5
    expect(pObj.getSubjectiveDuration().toBeats(context)).toBeCloseTo(3.5);
  });

  test('normalizeSoundObjects does nothing on empty PolyObject', () => {
    const pObj = new PolyObject(false);
    const layer = new SoundLayer();
    pObj.push(layer);

    pObj.setSubjectiveDuration(TimeDuration.beats(4.0));
    pObj.normalizeSoundObjects(context);

    expect(pObj.getSubjectiveDuration().toBeats(context)).toBeCloseTo(4.0);
  });

  test('checkAndAddInstanceSoundObjects adds unregistered instances to SoundObjectLibrary', () => {
    const lib = new SoundObjectLibrary();
    const targetObj = new GenericScore();
    targetObj.setName('Shared Target');

    const instance1 = new Instance();
    instance1.setSoundObject(targetObj);

    const instance2 = new Instance();
    instance2.setSoundObject(targetObj);

    expect(lib.containsObject(targetObj)).toBe(false);

    const instances = collectInstanceSoundObjects([instance1, instance2]);
    expect(instances).toHaveLength(2);

    lib.checkAndAddInstanceSoundObjects(instances);

    // targetObj copy should now be in library
    expect(lib.size()).toBe(1);
    const libObj = lib.getObject(0);
    expect(libObj?.getName()).toBe('Shared Target');
    const libraryId = lib.findIdForObject(libObj!);
    expect(libraryId).toBeTruthy();

    // Both instances should now point to the library copy
    expect(instance1.getSoundObject()).toBe(libObj);
    expect(instance2.getSoundObject()).toBe(libObj);
    expect(instance1.getLibraryId()).toBe(libraryId);
    expect(instance2.getLibraryId()).toBe(libraryId);
  });
});
