import { describe, expect, it } from 'vitest';

import { BlueData } from './blue-data';
import { FrozenSoundObject } from './sound-objects/frozen-sound-object';
import { GenericScore } from './sound-objects/generic-score';
import { PolyObject } from './sound-objects/poly-object';
import { TimeDuration } from './time/time-duration';
import { TimePosition } from './time/time-position';

describe('BlueData frozen SoundObject persistence', () => {
  it('preserves relative artifact metadata and nested source across a project save/reopen', () => {
    const data = new BlueData();
    const source = new GenericScore();
    source.setName('Original Score');
    source.setStartTime(TimePosition.beats(4));
    source.setSubjectiveDuration(TimeDuration.beats(2));

    const frozen = new FrozenSoundObject();
    frozen.setName('F: Original Score');
    frozen.setFrozenSoundObject(source);
    frozen.setFrozenWaveFileName('freeze7.wav');
    frozen.setNumChannels(2);
    frozen.setStartTime(TimePosition.beats(4));
    frozen.setSubjectiveDuration(TimeDuration.beats(2));
    ((data.getScore()[0] as PolyObject)[0]).push(frozen);

    const reopened = BlueData.loadFromString(data.saveToString());
    const restored = ((reopened.getScore()[0] as PolyObject)[0][0]) as FrozenSoundObject;

    expect(restored).toBeInstanceOf(FrozenSoundObject);
    expect(restored.getFrozenWaveFileName()).toBe('freeze7.wav');
    expect(restored.getNumChannels()).toBe(2);
    expect(restored.getFrozenSoundObject()).toBeInstanceOf(GenericScore);
    expect(restored.getFrozenSoundObject()?.getName()).toBe('Original Score');
  });
});
