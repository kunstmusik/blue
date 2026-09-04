import { describe, it, expect } from 'vitest';
import { MidiInputProcessor } from './midi-input-processor';
import { Scale } from '../sound-objects/piano-roll/scale';
import { mapMidiTrigger } from './midi-trigger-routing';

describe('mapMidiTrigger', () => {
  it('maps the default key and velocity modes by default', () => {
    const processor = new MidiInputProcessor();
    const result = mapMidiTrigger(processor, {
      midiNote: 60,
      velocity: 90,
      channel: 3,
    });

    expect(result).toEqual({
      originalMidiNote: 60,
      originalVelocity: 90,
      channel: 3,
      mappedPitchValue: '8.00',
      mappedAmplitudeValue: '90',
    });
  });

  it('maps pitch and velocity using Java-compatible tuning and amplitude modes', () => {
    const processor = new MidiInputProcessor();
    processor.setKeyMapping('TUNING_CPS');
    processor.setVelocityMapping('AMP_0DBFS');
    const scale = new Scale();
    scale.baseFrequency = 440;
    scale.octave = 2;
    scale.ratios = [1, 2];
    processor.setScale(scale);

    const result = mapMidiTrigger(processor, {
      midiNote: 61,
      velocity: 127,
      channel: 0,
    });

    expect(result.mappedPitchValue).toBe('880');
    expect(result.mappedAmplitudeValue).toBe('1.0');
  });

  it('preserves Java constant fallthrough behavior', () => {
    const processor = new MidiInputProcessor();
    processor.setKeyMapping('CONSTANT');
    processor.setPitchConstant('should-not-stick');
    processor.setVelocityMapping('CONSTANT');
    processor.setAmpConstant('amp-const');
    processor.setScale(null);

    const result = mapMidiTrigger(processor, {
      midiNote: 60,
      velocity: 100,
      channel: 1,
    });

    expect(result.mappedPitchValue).toBe('261.625565');
    expect(result.mappedAmplitudeValue).toBe('amp-const');
  });
});
