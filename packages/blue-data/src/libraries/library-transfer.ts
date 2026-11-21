import type { Instrument } from '../instruments/instrument';
import { Effect } from '../mixer/effect';
import { OpcodeDefinition } from '../opcodes/opcode-definition';
import { Instance } from '../sound-objects/instance';
import type { SoundObject } from '../sound-objects/sound-object';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';

/** Library-owned dependencies and unresolved references outside a library item. */
export interface LibraryDependencyDescriptor {
  /** Dependencies owned and carried by the resource itself. */
  readonly itemOwned: readonly string[];
  /** References that must be resolved outside the library item. */
  readonly unresolvedExternal: readonly string[];
}

/** Creates a project-owned copy of an instrument library item. */
export function copyInstrumentForProject(instrument: Instrument): Instrument {
  return instrument.deepCopy();
}

/** Creates a project-owned copy of a user-defined opcode. */
export function copyUdoForProject(opcode: OpcodeDefinition): OpcodeDefinition {
  return opcode.deepCopy() as OpcodeDefinition;
}

/** Creates a project-owned copy of the effect and its editable state. */
export function copyEffectForProject(effect: Effect): Effect {
  const copy = effect.deepCopy() as Effect;
  copy.setEnabled(true);
  return copy;
}

/** Creates a project-owned copy of a library sound object. */
export function copySoundObjectForProject(soundObject: SoundObject): SoundObject {
  return soundObject.deepCopy();
}

/** Creates an Instance that refers to the supplied shared sound object. */
export function createSharedSoundObjectInstance(
  definition: SoundObject,
  libraryId: string,
): Instance {
  const instance = new Instance();
  instance.setSoundObject(definition);
  instance.setName(definition.getName());
  instance.setBackgroundColor(definition.getBackgroundColor());
  instance.setLibraryId(libraryId);
  instance.setSubjectiveDuration(definition.getSubjectiveDuration());
  return instance;
}

/** Transfers the timeline placement settings between sound objects. */
export function transferSoundObjectTiming(
  soundObject: SoundObject,
  destinationStartBeats: number,
  durationBeats: number,
): void {
  soundObject.setStartTime(TimePosition.beats(Math.max(0, destinationStartBeats)));
  soundObject.setSubjectiveDuration(TimeDuration.beats(Math.max(0, durationBeats)));
}
