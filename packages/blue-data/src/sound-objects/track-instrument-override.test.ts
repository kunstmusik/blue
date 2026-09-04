import { describe, expect, it } from 'vitest';
import './register-sound-object-types';
import {
  createSoundObject,
  getAllSoundObjectTypeDescriptors,
  getTrackPlacementForSoundObject,
} from './sound-object-registry';
import { Track } from '../score/track/track';
import { CompileData } from '../compile-data';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { GenericScore } from './generic-score';
import { Instance } from './instance';
import { Sound } from './sound';

describe('Track instrument target policy', () => {
  it('covers every built-in registration with an explicit target behavior', () => {
    const descriptors = new Map(
      getAllSoundObjectTypeDescriptors().map((descriptor) => [descriptor.typeName, descriptor]),
    );

    const expected: Record<string, string> = {
      GenericScore: 'assignable',
      PolyObject: 'none',
      PythonObject: 'assignable',
      ClojureObject: 'assignable',
      JavaScriptObject: 'assignable',
      CSDSoundObject: 'preserve',
      Comment: 'none',
      AudioFile: 'none',
      Sound: 'preserve',
      External: 'assignable',
      Instance: 'propagated',
      LineObject: 'assignable',
      ZakLineObject: 'assignable',
      PatternObject: 'assignable',
      PianoRoll: 'assignable',
      JMask: 'assignable',
      TrackerObject: 'assignable',
      FrozenSoundObject: 'preserve',
      ObjectBuilder: 'assignable',
    };

    for (const [typeName, behavior] of Object.entries(expected)) {
      expect(descriptors.get(typeName)?.instrumentTargetBehavior).toBe(behavior);
      expect(createSoundObject(typeName)).not.toBeNull();
    }
  });

  it('rejects PolyObject placement while keeping supported container and special-event policies explicit', () => {
    const track = new Track();
    const polyObject = createSoundObject('PolyObject');
    const instance = createSoundObject('Instance');
    const frozen = createSoundObject('FrozenSoundObject');
    const audioFile = createSoundObject('AudioFile');

    expect(polyObject && track.accepts(polyObject)).toBe(false);
    expect(instance && track.accepts(instance)).toBe(true);
    expect(getTrackPlacementForSoundObject(polyObject!).reason).toContain('PolyObject');
    expect(getTrackPlacementForSoundObject(instance!).descriptor?.instrumentTargetBehavior).toBe(
      'propagated',
    );
    expect(getTrackPlacementForSoundObject(frozen!).descriptor?.instrumentTargetBehavior).toBe(
      'preserve',
    );
    expect(audioFile && track.accepts(audioFile)).toBe(false);
  });

  it('rejects an Instance that indirectly references a PolyObject', () => {
    const track = new Track();
    const instance = new Instance();
    instance.setSoundObject(createSoundObject('PolyObject')!);

    expect(track.accepts(instance)).toBe(false);
    expect(getTrackPlacementForSoundObject(instance).reason).toContain('PolyObject');
  });

  it('propagates Instance descendant ownership without retargeting self-instrumented Sound events', () => {
    const context = new TimeContext();
    const track = new Track();
    track.setUniqueId('instance-track');
    const compileData = new CompileData();
    compileData.setTrackInstrumentId(track.getUniqueId(), 99);

    const sound = new Sound();
    sound.setSubjectiveDuration(TimeDuration.beats(1));
    const soundInstance = new Instance();
    soundInstance.setSoundObject(sound);
    soundInstance.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(soundInstance);

    const preserved = track.generateForCSD(context, compileData, 0, -1).getNote(0);
    expect(preserved.getPField(1)).not.toBe('99');
    expect(preserved.getTrackInstrumentTarget()).toBe('preserve');

    track.length = 0;
    const score = new GenericScore();
    score.setScoreText('i1 0 1 60');
    score.setSubjectiveDuration(TimeDuration.beats(1));
    const scoreInstance = new Instance();
    scoreInstance.setSoundObject(score);
    scoreInstance.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(scoreInstance);

    const assigned = track.generateForCSD(context, compileData, 0, -1).getNote(0);
    expect(assigned.getPField(1)).toBe('99');
    expect(assigned.getTrackInstrumentTarget()).toBe('assignable');
  });
});
