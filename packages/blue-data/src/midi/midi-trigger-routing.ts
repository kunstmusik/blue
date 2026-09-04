import { Scale } from '../sound-objects/piano-roll/scale';
import { formatBlueNumber, formatJavaDouble } from '../utilities/number-format';
import { MidiInputProcessor } from './midi-input-processor';

export interface MidiTriggerMappingInput {
  midiNote: number;
  velocity: number;
  channel: number;
}

export interface MidiTriggerMappingResult {
  originalMidiNote: number;
  originalVelocity: number;
  channel: number;
  mappedPitchValue: string;
  mappedAmplitudeValue: string;
}

function clampMidiValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(127, Math.max(0, Math.trunc(value)));
}

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(15, Math.max(0, Math.trunc(value)));
}

function convertPch(midiKey: number): string {
  const oct = Math.trunc(midiKey / 12) + 3;
  const key = midiKey % 12;

  return `${oct}.${key < 10 ? `0${key}` : key}`;
}

function convertOct(midiKey: number): string {
  return formatBlueNumber(midiKey / 12.0 + 3.0);
}

function processKey(processor: MidiInputProcessor, key: number): string {
  const scale = processor.getScale() ?? new Scale();

  switch (processor.getKeyMapping()) {
    case 'MIDI':
      return key.toString();
    case 'PCH':
      return convertPch(key);
    case 'OCT':
      return convertOct(key);
    case 'CONSTANT':
    case 'TUNING_CPS': {
      const numScaleDegrees = scale.getNumScaleDegrees();
      const temp = key - 60;
      let octave = 8 + Math.trunc(temp / numScaleDegrees);
      let scaleDegree = temp % numScaleDegrees;

      if (scaleDegree < 0) {
        octave -= 1;
        scaleDegree = numScaleDegrees + scaleDegree;
      }

      return formatBlueNumber(scale.getFrequency(octave, scaleDegree));
    }
    case 'TUNING_BLUE_PCH': {
      const numScaleDegrees = scale.getNumScaleDegrees();
      const temp = key - 60;
      let octave = 8 + Math.trunc(temp / numScaleDegrees);
      let scaleDegree = temp % numScaleDegrees;

      if (scaleDegree < 0) {
        octave -= 1;
        scaleDegree = numScaleDegrees + scaleDegree;
      }

      return `${octave}.${scaleDegree}`;
    }
    default:
      return key.toString();
  }
}

function processVelocity(processor: MidiInputProcessor, velocity: number): string {
  switch (processor.getVelocityMapping()) {
    case 'MIDI':
      return velocity.toString();
    case 'CONSTANT':
      return processor.getAmpConstant();
    case 'AMP':
      return formatJavaDouble(((velocity * velocity) / 16129.0) * 30000);
    case 'AMP_0DBFS':
      return formatJavaDouble((velocity * velocity) / 16129.0);
    default:
      return velocity.toString();
  }
}

export function mapMidiTrigger(
  processor: MidiInputProcessor,
  input: MidiTriggerMappingInput,
): MidiTriggerMappingResult {
  const midiNote = clampMidiValue(input.midiNote);
  const velocity = clampMidiValue(input.velocity);

  return {
    originalMidiNote: midiNote,
    originalVelocity: velocity,
    channel: clampChannel(input.channel),
    mappedPitchValue: processKey(processor, midiNote),
    mappedAmplitudeValue: processVelocity(processor, velocity),
  };
}
