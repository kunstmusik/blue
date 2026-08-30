/**
 * BlueX7 parameter catalog — the sole semantic mapping between BlueX7 voice
 * fields, Parameters, editor controls, automation targets, and the modern
 * Csound transport (Spec 092). Exactly 151 immutable descriptors: 145 voice
 * slots plus six operator-enable values. This module is code-owned schema
 * metadata; it is never serialized per instrument.
 *
 * Browser-safe: no host APIs, static imports only.
 */
import type { BlueX7Voice } from '../blue-x7';

export type BlueX7UpdateClass = 'active-note' | 'next-note';

export type BlueX7ParameterKind = 'continuous-integer' | 'boolean' | 'categorical';

export type BlueX7ParameterGroup =
  | 'Common'
  | 'LFO'
  | 'Pitch Envelope'
  | `Operator ${1 | 2 | 3 | 4 | 5 | 6}`;

export interface BlueX7ParameterDescriptor {
  /** Stable semantic name, independent of the instrument display name. */
  key: string;
  group: BlueX7ParameterGroup;
  label: string;
  minimum: number;
  maximum: number;
  resolution: '1';
  kind: BlueX7ParameterKind;
  /** Whether changes apply to sounding notes or from the next note. */
  updateClass: BlueX7UpdateClass;
  transport:
    | { kind: 'voice'; slot: number }
    | { kind: 'operator-enable'; operator: 1 | 2 | 3 | 4 | 5 | 6 };
}

interface BlueX7CatalogEntry extends BlueX7ParameterDescriptor {
  read(voice: BlueX7Voice): number;
  write(voice: BlueX7Voice, value: number): void;
}

const OPERATOR_KEYS = [1, 2, 3, 4, 5, 6] as const;

function clampToDomain(minimum: number, maximum: number, value: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Java HALF_UP snapping onto the integer grid: clamp first, then round
 * (value - minimum) half-up, then re-add minimum. Returns null for
 * non-finite input (rejected, never coerced).
 */
export function quantizeBlueX7DescriptorValue(
  descriptor: Pick<BlueX7ParameterDescriptor, 'minimum' | 'maximum'>,
  value: number,
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const clamped = clampToDomain(descriptor.minimum, descriptor.maximum, value);
  return Math.floor(clamped - descriptor.minimum + 0.5) + descriptor.minimum;
}

const entries: BlueX7CatalogEntry[] = [];

function addEntry(entry: BlueX7CatalogEntry): void {
  entries.push(entry);
}

// ---------------- Common (algorithm, feedback, transpose, shared sync) ------

addEntry({
  key: 'common.algorithm',
  group: 'Common',
  label: 'Algorithm',
  minimum: 1,
  maximum: 32,
  resolution: '1',
  kind: 'categorical',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 134 },
  read: (v) => v.common.algorithm,
  write: (v, value) => {
    v.common.algorithm = value;
  },
});

addEntry({
  key: 'common.feedback',
  group: 'Common',
  label: 'Feedback',
  minimum: 0,
  maximum: 7,
  resolution: '1',
  kind: 'continuous-integer',
  updateClass: 'active-note',
  transport: { kind: 'voice', slot: 135 },
  read: (v) => v.common.feedback,
  write: (v, value) => {
    v.common.feedback = value;
  },
});

addEntry({
  key: 'common.transpose',
  group: 'Common',
  label: 'Key Transpose',
  minimum: 0,
  maximum: 48,
  resolution: '1',
  kind: 'continuous-integer',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 144 },
  read: (v) => v.common.keyTranspose,
  write: (v, value) => {
    v.common.keyTranspose = value;
  },
});

addEntry({
  key: 'common.oscillatorKeySync',
  group: 'Common',
  label: 'Oscillator Key Sync',
  minimum: 0,
  maximum: 1,
  resolution: '1',
  kind: 'boolean',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 136 },
  // The shared control reads logical operator 1 and writes all six stored
  // values; mixed legacy XML stays untouched until an explicit shared edit.
  read: (v) => v.operators[0].sync,
  write: (v, value) => {
    for (const op of v.operators) {
      op.sync = value;
    }
  },
});

// ---------------- LFO ------------------------------------------------------

addEntry({
  key: 'lfo.speed',
  group: 'LFO',
  label: 'Speed',
  minimum: 0,
  maximum: 99,
  resolution: '1',
  kind: 'continuous-integer',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 137 },
  read: (v) => v.lfo.speed,
  write: (v, value) => {
    v.lfo.speed = value;
  },
});

addEntry({
  key: 'lfo.delay',
  group: 'LFO',
  label: 'Delay',
  minimum: 0,
  maximum: 99,
  resolution: '1',
  kind: 'continuous-integer',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 138 },
  read: (v) => v.lfo.delay,
  write: (v, value) => {
    v.lfo.delay = value;
  },
});

addEntry({
  key: 'lfo.pitchModulationDepth',
  group: 'LFO',
  label: 'Pitch Modulation Depth',
  minimum: 0,
  maximum: 99,
  resolution: '1',
  kind: 'continuous-integer',
  updateClass: 'active-note',
  transport: { kind: 'voice', slot: 139 },
  read: (v) => v.lfo.pitchModulationDepth,
  write: (v, value) => {
    v.lfo.pitchModulationDepth = value;
  },
});

addEntry({
  key: 'lfo.amplitudeModulationDepth',
  group: 'LFO',
  label: 'Amplitude Modulation Depth',
  minimum: 0,
  maximum: 99,
  resolution: '1',
  kind: 'continuous-integer',
  updateClass: 'active-note',
  transport: { kind: 'voice', slot: 140 },
  read: (v) => v.lfo.amplitudeModulationDepth,
  write: (v, value) => {
    v.lfo.amplitudeModulationDepth = value;
  },
});

addEntry({
  key: 'lfo.wave',
  group: 'LFO',
  label: 'Wave',
  minimum: 0,
  maximum: 5,
  resolution: '1',
  kind: 'categorical',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 142 },
  read: (v) => v.lfo.wave,
  write: (v, value) => {
    v.lfo.wave = value;
  },
});

addEntry({
  key: 'lfo.sync',
  group: 'LFO',
  label: 'Key Sync',
  minimum: 0,
  maximum: 1,
  resolution: '1',
  kind: 'boolean',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 141 },
  read: (v) => v.lfo.sync,
  write: (v, value) => {
    v.lfo.sync = value;
  },
});

addEntry({
  key: 'lfo.pitchModulationSensitivity',
  group: 'LFO',
  label: 'Pitch Modulation Sensitivity',
  minimum: 0,
  maximum: 7,
  resolution: '1',
  kind: 'continuous-integer',
  updateClass: 'next-note',
  transport: { kind: 'voice', slot: 143 },
  read: (v) => v.operators[0].modulationPitch,
  write: (v, value) => {
    for (const op of v.operators) {
      op.modulationPitch = value;
    }
  },
});

// ---------------- Pitch Envelope --------------------------------------------

for (const stage of [1, 2, 3, 4] as const) {
  addEntry({
    key: `pitchEnvelope.${stage}.rate`,
    group: 'Pitch Envelope',
    label: `Rate ${stage}`,
    minimum: 0,
    maximum: 99,
    resolution: '1',
    kind: 'continuous-integer',
    updateClass: 'next-note',
    transport: { kind: 'voice', slot: 125 + stage },
    read: (v) => v.pitchEnvelope[stage - 1].rate,
    write: (v, value) => {
      v.pitchEnvelope[stage - 1].rate = value;
    },
  });
  addEntry({
    key: `pitchEnvelope.${stage}.level`,
    group: 'Pitch Envelope',
    label: `Level ${stage}`,
    minimum: 0,
    maximum: 99,
    resolution: '1',
    kind: 'continuous-integer',
    updateClass: 'next-note',
    transport: { kind: 'voice', slot: 129 + stage },
    read: (v) => v.pitchEnvelope[stage - 1].level,
    write: (v, value) => {
      v.pitchEnvelope[stage - 1].level = value;
    },
  });
}

// ---------------- Operators 1..6 --------------------------------------------
// Voice transport blocks are stored operator 6 first: logical operator op
// occupies slots (6 - op) * 21 .. (6 - op) * 21 + 20, so entry order below
// walks offset 0..20 per operator.

interface OperatorFieldSpec {
  key: string;
  label: string;
  minimum: number;
  maximum: number;
  kind: BlueX7ParameterKind;
  offset: number;
  read(op: BlueX7Voice['operators'][number]): number;
  write(op: BlueX7Voice['operators'][number], value: number): void;
}

const OPERATOR_FIELD_SPECS: OperatorFieldSpec[] = [
  {
    key: 'envelope.1.rate', label: 'Envelope Rate 1', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 0,
    read: (op) => op.envelope[0].rate, write: (op, v) => { op.envelope[0].rate = v; },
  },
  {
    key: 'envelope.1.level', label: 'Envelope Level 1', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 4,
    read: (op) => op.envelope[0].level, write: (op, v) => { op.envelope[0].level = v; },
  },
  {
    key: 'envelope.2.rate', label: 'Envelope Rate 2', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 1,
    read: (op) => op.envelope[1].rate, write: (op, v) => { op.envelope[1].rate = v; },
  },
  {
    key: 'envelope.2.level', label: 'Envelope Level 2', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 5,
    read: (op) => op.envelope[1].level, write: (op, v) => { op.envelope[1].level = v; },
  },
  {
    key: 'envelope.3.rate', label: 'Envelope Rate 3', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 2,
    read: (op) => op.envelope[2].rate, write: (op, v) => { op.envelope[2].rate = v; },
  },
  {
    key: 'envelope.3.level', label: 'Envelope Level 3', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 6,
    read: (op) => op.envelope[2].level, write: (op, v) => { op.envelope[2].level = v; },
  },
  {
    key: 'envelope.4.rate', label: 'Envelope Rate 4', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 3,
    read: (op) => op.envelope[3].rate, write: (op, v) => { op.envelope[3].rate = v; },
  },
  {
    key: 'envelope.4.level', label: 'Envelope Level 4', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 7,
    read: (op) => op.envelope[3].level, write: (op, v) => { op.envelope[3].level = v; },
  },
  {
    key: 'breakpoint', label: 'Breakpoint', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 8,
    read: (op) => op.breakpoint, write: (op, v) => { op.breakpoint = v; },
  },
  {
    key: 'depthLeft', label: 'Depth Left', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 9,
    read: (op) => op.depthLeft, write: (op, v) => { op.depthLeft = v; },
  },
  {
    key: 'depthRight', label: 'Depth Right', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 10,
    read: (op) => op.depthRight, write: (op, v) => { op.depthRight = v; },
  },
  {
    key: 'curveLeft', label: 'Curve Left', minimum: 0, maximum: 3,
    kind: 'categorical', offset: 11,
    read: (op) => op.curveLeft, write: (op, v) => { op.curveLeft = v; },
  },
  {
    key: 'curveRight', label: 'Curve Right', minimum: 0, maximum: 3,
    kind: 'categorical', offset: 12,
    read: (op) => op.curveRight, write: (op, v) => { op.curveRight = v; },
  },
  {
    key: 'keyboardRateScaling', label: 'Keyboard Rate Scaling', minimum: 0, maximum: 7,
    kind: 'continuous-integer', offset: 13,
    read: (op) => op.keyboardRateScaling, write: (op, v) => { op.keyboardRateScaling = v; },
  },
  {
    key: 'amplitudeModulationSensitivity', label: 'Amplitude Modulation Sensitivity', minimum: 0, maximum: 3,
    kind: 'continuous-integer', offset: 14,
    read: (op) => op.modulationAmplitude, write: (op, v) => { op.modulationAmplitude = v; },
  },
  {
    key: 'velocitySensitivity', label: 'Velocity Sensitivity', minimum: 0, maximum: 7,
    kind: 'continuous-integer', offset: 15,
    read: (op) => op.velocitySensitivity, write: (op, v) => { op.velocitySensitivity = v; },
  },
  {
    key: 'outputLevel', label: 'Output Level', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 16,
    read: (op) => op.outputLevel, write: (op, v) => { op.outputLevel = v; },
  },
  {
    key: 'oscillatorMode', label: 'Oscillator Mode', minimum: 0, maximum: 1,
    kind: 'categorical', offset: 17,
    read: (op) => op.mode, write: (op, v) => { op.mode = v; },
  },
  {
    key: 'frequencyCoarse', label: 'Frequency Coarse', minimum: 0, maximum: 31,
    kind: 'continuous-integer', offset: 18,
    read: (op) => op.freqCoarse, write: (op, v) => { op.freqCoarse = v; },
  },
  {
    key: 'frequencyFine', label: 'Frequency Fine', minimum: 0, maximum: 99,
    kind: 'continuous-integer', offset: 19,
    read: (op) => op.freqFine, write: (op, v) => { op.freqFine = v; },
  },
  {
    key: 'detune', label: 'Detune', minimum: -7, maximum: 7,
    kind: 'continuous-integer', offset: 20,
    read: (op) => op.detune, write: (op, v) => { op.detune = v; },
  },
];

for (const operator of OPERATOR_KEYS) {
  for (const spec of OPERATOR_FIELD_SPECS) {
    addEntry({
      key: `operator.${operator}.${spec.key}`,
      group: `Operator ${operator}` as BlueX7ParameterGroup,
      label: spec.label,
      minimum: spec.minimum,
      maximum: spec.maximum,
      resolution: '1',
      kind: spec.kind,
      updateClass: spec.key === 'outputLevel' ? 'active-note' : 'next-note',
      transport: { kind: 'voice', slot: (6 - operator) * 21 + spec.offset },
      read: (v) => spec.read(v.operators[operator - 1]),
      write: (v, value) => {
        spec.write(v.operators[operator - 1], value);
      },
    });
  }
  addEntry({
    key: `operator.${operator}.enabled`,
    group: `Operator ${operator}` as BlueX7ParameterGroup,
    label: 'Operator Enabled',
    minimum: 0,
    maximum: 1,
    resolution: '1',
    kind: 'boolean',
    updateClass: 'active-note',
    transport: { kind: 'operator-enable', operator },
    read: (v) => (v.common.operatorEnabled[operator - 1] ? 1 : 0),
    write: (v, value) => {
      v.common.operatorEnabled[operator - 1] = value === 1;
    },
  });
}

/** Frozen public descriptors in fixed catalog order. */
export const BLUE_X7_PARAMETER_DESCRIPTORS: readonly BlueX7ParameterDescriptor[] =
  Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        key: entry.key,
        group: entry.group,
        label: entry.label,
        minimum: entry.minimum,
        maximum: entry.maximum,
        resolution: entry.resolution,
        kind: entry.kind,
        updateClass: entry.updateClass,
        transport: Object.freeze({ ...entry.transport }),
      }),
    ),
  );

const entriesByKey = new Map(entries.map((entry) => [entry.key, entry]));

export function getBlueX7Descriptor(key: string): BlueX7ParameterDescriptor | undefined {
  return entriesByKey.get(key);
}

/** Read one voice field by semantic key. Unknown keys return undefined. */
export function readBlueX7VoiceValue(voice: BlueX7Voice, key: string): number | undefined {
  const entry = entriesByKey.get(key);
  return entry ? entry.read(voice) : undefined;
}

/**
 * Write one voice field by semantic key with catalog validation. The value is
 * quantized to the descriptor domain; non-finite values and unknown keys fail
 * without mutation. Returns whether the write was applied.
 */
export function writeBlueX7VoiceValue(
  voice: BlueX7Voice,
  key: string,
  value: number,
): boolean {
  const entry = entriesByKey.get(key);
  if (!entry) {
    return false;
  }
  const quantized = quantizeBlueX7DescriptorValue(entry, value);
  if (quantized === null) {
    return false;
  }
  entry.write(voice, quantized);
  return true;
}
