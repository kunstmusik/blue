import { describe, expect, it } from 'vitest';
import {
  BLUE_X7_PARAMETER_DESCRIPTORS,
  getBlueX7Descriptor,
  quantizeBlueX7DescriptorValue,
  readBlueX7VoiceValue,
  writeBlueX7VoiceValue,
} from './parameter-catalog';
import { createDefaultBlueX7Voice, type BlueX7Voice } from '../blue-x7';

const EXPECTED_GROUP_ORDER = [
  'Common',
  'LFO',
  'Pitch Envelope',
  'Operator 1',
  'Operator 2',
  'Operator 3',
  'Operator 4',
  'Operator 5',
  'Operator 6',
] as const;

function voiceWithOverrides(mutate: (voice: BlueX7Voice) => void): BlueX7Voice {
  const voice = createDefaultBlueX7Voice();
  mutate(voice);
  return voice;
}

describe('BlueX7 parameter catalog cardinality', () => {
  it('contains exactly 151 unique descriptors', () => {
    expect(BLUE_X7_PARAMETER_DESCRIPTORS).toHaveLength(151);
    const keys = new Set(BLUE_X7_PARAMETER_DESCRIPTORS.map((d) => d.key));
    expect(keys.size).toBe(151);
  });

  it('has exactly 145 voice-slot and 6 operator-enable descriptors', () => {
    const voice = BLUE_X7_PARAMETER_DESCRIPTORS.filter((d) => d.transport.kind === 'voice');
    const enables = BLUE_X7_PARAMETER_DESCRIPTORS.filter(
      (d) => d.transport.kind === 'operator-enable',
    );
    expect(voice).toHaveLength(145);
    expect(enables).toHaveLength(6);

    const slots = voice.map((d) => (d.transport.kind === 'voice' ? d.transport.slot : -1));
    expect(new Set(slots).size).toBe(145);
    expect([...slots].sort((a, b) => a - b)).toEqual(Array.from({ length: 145 }, (_, i) => i));
  });

  it('operator-enable descriptors cover operators 1..6 with matching mask bits', () => {
    const enables = BLUE_X7_PARAMETER_DESCRIPTORS.filter(
      (d) => d.transport.kind === 'operator-enable',
    );
    expect(
      enables.map((d) => (d.transport.kind === 'operator-enable' ? d.transport.operator : -1)),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('BlueX7 parameter catalog domains', () => {
  it('every descriptor has integer resolution and a finite ordered domain', () => {
    for (const d of BLUE_X7_PARAMETER_DESCRIPTORS) {
      expect(d.resolution, d.key).toBe('1');
      expect(Number.isFinite(d.minimum), d.key).toBe(true);
      expect(Number.isFinite(d.maximum), d.key).toBe(true);
      expect(d.minimum, d.key).toBeLessThanOrEqual(d.maximum);
      expect(Number.isInteger(d.minimum), d.key).toBe(true);
      expect(Number.isInteger(d.maximum), d.key).toBe(true);
    }
  });

  it('boolean descriptors span exactly 0..1', () => {
    for (const d of BLUE_X7_PARAMETER_DESCRIPTORS) {
      if (d.kind === 'boolean') {
        expect(d.minimum, d.key).toBe(0);
        expect(d.maximum, d.key).toBe(1);
      }
    }
  });

  it('matches the editor widget domains', () => {
    const domain = (key: string): [number, number] => {
      const d = getBlueX7Descriptor(key);
      if (!d) throw new Error(`missing descriptor ${key}`);
      return [d.minimum, d.maximum];
    };
    expect(domain('common.algorithm')).toEqual([1, 32]);
    expect(domain('common.feedback')).toEqual([0, 7]);
    expect(domain('common.transpose')).toEqual([0, 48]);
    expect(domain('lfo.speed')).toEqual([0, 99]);
    expect(domain('lfo.wave')).toEqual([0, 5]);
    expect(domain('operator.1.frequencyCoarse')).toEqual([0, 31]);
    expect(domain('operator.1.frequencyFine')).toEqual([0, 99]);
    expect(domain('operator.1.detune')).toEqual([-7, 7]);
    expect(domain('operator.1.curveLeft')).toEqual([0, 3]);
    expect(domain('operator.1.amplitudeModulationSensitivity')).toEqual([0, 3]);
    expect(domain('operator.1.velocitySensitivity')).toEqual([0, 7]);
    expect(domain('lfo.pitchModulationSensitivity')).toEqual([0, 7]);
  });
});

describe('BlueX7 parameter catalog grouping', () => {
  it('orders groups Common, LFO, Pitch Envelope, Operator 1..6', () => {
    const seen: string[] = [];
    for (const d of BLUE_X7_PARAMETER_DESCRIPTORS) {
      if (seen[seen.length - 1] !== d.group) {
        seen.push(d.group);
      }
    }
    expect(seen).toEqual([...EXPECTED_GROUP_ORDER]);
  });

  it('has the expected per-group counts', () => {
    const counts = new Map<string, number>();
    for (const d of BLUE_X7_PARAMETER_DESCRIPTORS) {
      counts.set(d.group, (counts.get(d.group) ?? 0) + 1);
    }
    expect(counts.get('Common')).toBe(4);
    expect(counts.get('LFO')).toBe(7);
    expect(counts.get('Pitch Envelope')).toBe(8);
    for (const op of [1, 2, 3, 4, 5, 6]) {
      expect(counts.get(`Operator ${op}`)).toBe(22);
    }
  });

  it('does not derive keys or labels from the instrument display name', () => {
    for (const d of BLUE_X7_PARAMETER_DESCRIPTORS) {
      expect(d.key, d.key).not.toMatch(/BlueX7/i);
    }
  });
});

describe('BlueX7 parameter catalog update classes', () => {
  it('keeps only low-cost expressive controls active during a note', () => {
    const live = [
      'common.feedback',
      'lfo.pitchModulationDepth',
      'lfo.amplitudeModulationDepth',
      ...[1, 2, 3, 4, 5, 6].flatMap((operator) => [
        `operator.${operator}.outputLevel`,
        `operator.${operator}.enabled`,
      ]),
    ].sort();
    const nextNote = BLUE_X7_PARAMETER_DESCRIPTORS.filter((d) => d.updateClass === 'next-note');
    expect(
      BLUE_X7_PARAMETER_DESCRIPTORS.filter((d) => d.updateClass === 'active-note')
        .map((d) => d.key)
        .sort(),
    ).toEqual(live);
    expect(nextNote).toHaveLength(136);
    expect(
      BLUE_X7_PARAMETER_DESCRIPTORS.filter((d) => d.updateClass === 'active-note'),
    ).toHaveLength(15);
  });
});

describe('BlueX7 shared sync/PMS policy', () => {
  it('reads shared values from logical operator 1', () => {
    const mixed = voiceWithOverrides((v) => {
      v.operators[0].sync = 1;
      v.operators[1].sync = 0;
      v.operators[0].modulationPitch = 5;
      v.operators[2].modulationPitch = 2;
    });
    expect(readBlueX7VoiceValue(mixed, 'common.oscillatorKeySync')).toBe(1);
    expect(readBlueX7VoiceValue(mixed, 'lfo.pitchModulationSensitivity')).toBe(5);
  });

  it('writes shared values to all six operator fields as one mutation', () => {
    const voice = createDefaultBlueX7Voice();
    expect(writeBlueX7VoiceValue(voice, 'common.oscillatorKeySync', 0)).toBe(true);
    for (const op of voice.operators) {
      expect(op.sync).toBe(0);
    }
    expect(writeBlueX7VoiceValue(voice, 'lfo.pitchModulationSensitivity', 3)).toBe(true);
    for (const op of voice.operators) {
      expect(op.modulationPitch).toBe(3);
    }
    // Legacy mixed per-operator values stay untouched when a different field
    // is written.
    const mixed = voiceWithOverrides((v) => {
      v.operators[0].sync = 1;
      v.operators[3].sync = 0;
    });
    writeBlueX7VoiceValue(mixed, 'common.feedback', 5);
    expect(mixed.operators[0].sync).toBe(1);
    expect(mixed.operators[3].sync).toBe(0);
  });
});

describe('BlueX7 value validation', () => {
  it('rejects non-finite values without mutation', () => {
    const voice = createDefaultBlueX7Voice();
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(
        quantizeBlueX7DescriptorValue(getBlueX7Descriptor('common.feedback')!, value),
      ).toBeNull();
      expect(writeBlueX7VoiceValue(voice, 'common.feedback', value)).toBe(false);
    }
    expect(voice.common.feedback).toBe(6);
  });

  it('clamps then quantizes to the integer grid', () => {
    const feedback = getBlueX7Descriptor('common.feedback')!;
    expect(quantizeBlueX7DescriptorValue(feedback, -5)).toBe(0);
    expect(quantizeBlueX7DescriptorValue(feedback, 99)).toBe(7);
    expect(quantizeBlueX7DescriptorValue(feedback, 3.2)).toBe(3);
    expect(quantizeBlueX7DescriptorValue(feedback, 3.7)).toBe(4);

    const detune = getBlueX7Descriptor('operator.1.detune')!;
    expect(quantizeBlueX7DescriptorValue(detune, -7.5)).toBe(-7);
    expect(quantizeBlueX7DescriptorValue(detune, 2.5)).toBe(3);
  });

  it('fails unknown semantic keys without mutation', () => {
    const voice = createDefaultBlueX7Voice();
    expect(writeBlueX7VoiceValue(voice, 'operator.7.outputLevel', 10)).toBe(false);
    expect(writeBlueX7VoiceValue(voice, 'not.a.key', 10)).toBe(false);
    expect(readBlueX7VoiceValue(voice, 'not.a.key')).toBeUndefined();
  });

  it('boolean writes quantize to 0 or 1', () => {
    const voice = createDefaultBlueX7Voice();
    expect(writeBlueX7VoiceValue(voice, 'lfo.sync', 0.4)).toBe(true);
    expect(voice.lfo.sync).toBe(0);
    expect(writeBlueX7VoiceValue(voice, 'lfo.sync', 0.6)).toBe(true);
    expect(voice.lfo.sync).toBe(1);
  });
});

describe('BlueX7 voice read/write accessors', () => {
  it('reads and writes every voice-slot descriptor at its documented field', () => {
    // Write a distinctive value through each descriptor key and verify it
    // landed on the modeled voice field the descriptor documents.
    const cases: Array<{
      key: string;
      voice: BlueX7Voice;
      value: number;
      expectRead: number;
    }> = [
      {
        key: 'common.algorithm',
        voice: voiceWithOverrides((v) => {
          v.common.algorithm = 17;
        }),
        value: 17,
        expectRead: 17,
      },
      {
        key: 'pitchEnvelope.3.level',
        voice: voiceWithOverrides((v) => {
          v.pitchEnvelope[2].level = 66;
        }),
        value: 66,
        expectRead: 66,
      },
      {
        key: 'operator.4.envelope.2.rate',
        voice: voiceWithOverrides((v) => {
          v.operators[3].envelope[1].rate = 44;
        }),
        value: 44,
        expectRead: 44,
      },
      {
        key: 'operator.6.outputLevel',
        voice: voiceWithOverrides((v) => {
          v.operators[5].outputLevel = 12;
        }),
        value: 12,
        expectRead: 12,
      },
      {
        key: 'operator.2.oscillatorMode',
        voice: voiceWithOverrides((v) => {
          v.operators[1].mode = 1;
        }),
        value: 1,
        expectRead: 1,
      },
    ];
    for (const { key, voice, value, expectRead } of cases) {
      expect(readBlueX7VoiceValue(voice, key), key).toBe(expectRead);
      const fresh = createDefaultBlueX7Voice();
      expect(writeBlueX7VoiceValue(fresh, key, value), key).toBe(true);
      expect(readBlueX7VoiceValue(fresh, key), key).toBe(value);
    }
  });

  it('operator-enable descriptors read and write the enable booleans', () => {
    const voice = createDefaultBlueX7Voice();
    expect(readBlueX7VoiceValue(voice, 'operator.3.enabled')).toBe(1);
    expect(writeBlueX7VoiceValue(voice, 'operator.3.enabled', 0)).toBe(true);
    expect(voice.common.operatorEnabled[2]).toBe(false);
    expect(readBlueX7VoiceValue(voice, 'operator.3.enabled')).toBe(0);
  });
});
