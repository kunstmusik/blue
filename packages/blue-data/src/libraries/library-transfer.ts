import type { Instrument } from '../instruments/instrument';
import { Effect } from '../mixer/effect';
import { OpcodeDefinition } from '../opcodes/opcode-definition';
import { Instance } from '../sound-objects/instance';
import type { SoundObject } from '../sound-objects/sound-object';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';

export interface LibraryDependencyDescriptor {
  readonly itemOwned: readonly string[];
  readonly unresolvedExternal: readonly string[];
}

export function copyInstrumentForProject(instrument: Instrument): Instrument {
  return instrument.deepCopy();
}

export function copyUdoForProject(opcode: OpcodeDefinition): OpcodeDefinition {
  return opcode.deepCopy() as OpcodeDefinition;
}

export function copyEffectForProject(effect: Effect): Effect {
  const copy = effect.deepCopy() as Effect;
  copy.setEnabled(true);
  return copy;
}

export function copySoundObjectForProject(soundObject: SoundObject): SoundObject {
  return soundObject.deepCopy();
}

export function createSharedSoundObjectInstance(
  definition: SoundObject,
  libraryId: string,
): Instance {
  const instance = new Instance();
  instance.setSoundObject(definition);
  instance.setLibraryId(libraryId);
  instance.setSubjectiveDuration(definition.getSubjectiveDuration());
  return instance;
}

export function transferSoundObjectTiming(
  soundObject: SoundObject,
  destinationStartBeats: number,
  durationBeats: number,
): void {
  soundObject.setStartTime(TimePosition.beats(Math.max(0, destinationStartBeats)));
  soundObject.setSubjectiveDuration(TimeDuration.beats(Math.max(0, durationBeats)));
}
