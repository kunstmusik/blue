import { describe, expect, it } from 'vitest';
import {
  Effect,
  GenericInstrument,
  GenericScore,
  Instance,
  OpcodeDefinition,
  TimeDuration,
  TimePosition,
} from '../index';
import {
  copyEffectForProject,
  copyInstrumentForProject,
  copySoundObjectForProject,
  copyUdoForProject,
  createSharedSoundObjectInstance,
  transferSoundObjectTiming,
} from './library-transfer';

describe('library transfer helpers', () => {
  it('creates independent deep copies for each portable library type', () => {
    const instrument = new GenericInstrument();
    instrument.setName('Pad');
    const udo = new OpcodeDefinition();
    udo.setName('fx');
    const effect = new Effect();
    effect.setName('Echo');
    const soundObject = new GenericScore();
    soundObject.setName('Motif');

    const copies = [
      copyInstrumentForProject(instrument),
      copyUdoForProject(udo),
      copyEffectForProject(effect),
      copySoundObjectForProject(soundObject),
    ];
    expect(copies[0]).not.toBe(instrument);
    expect(copies[1]).not.toBe(udo);
    expect(copies[2]).not.toBe(effect);
    expect(copies[3]).not.toBe(soundObject);
    expect(copies.map((copy) => copy instanceof Object)).toEqual([true, true, true, true]);
  });

  it('creates an explicit shared instance without cloning its definition', () => {
    const definition = new GenericScore();
    definition.setName('Shared');
    const instance = createSharedSoundObjectInstance(definition, 'lib_9');
    expect(instance).toBeInstanceOf(Instance);
    expect(instance.getSoundObject()).toBe(definition);
    expect(instance.getLibraryId()).toBe('lib_9');
  });

  it('moves a portable SoundObject to a destination beat without changing duration', () => {
    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(2));
    source.setSubjectiveDuration(TimeDuration.beats(6));
    const copy = copySoundObjectForProject(source);
    transferSoundObjectTiming(copy, 12, 6);
    expect(copy.getStartTime().getValue()).toBe(12);
    expect(copy.getSubjectiveDuration().getValue()).toBe(6);
  });
});
