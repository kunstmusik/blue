/**
 * BlueX7 patch -> runtime intent mapping (Spec 092).
 *
 * Pure derivation of the semantic parameter changes an already-validated
 * BlueX7Patch produced, used by the main process to accelerate already-applied
 * canonical edits to a running engine. The durable project patch remains the
 * authority; this mapping only describes what became effective.
 */
import type { BlueX7Patch } from './project-editor/contract';

export interface BlueX7SemanticChange {
  semanticKey: string;
  /** Canonical post-patch value; quantization happens in the runtime sync. */
  value: number;
}

export type BlueX7PatchRuntimeIntent =
  | { kind: 'none' }
  | { kind: 'fixed-delta'; changes: BlueX7SemanticChange[] }
  | { kind: 'complete-voice' };

const COMMON_FIELD_KEYS: Record<string, string> = {
  algorithm: 'common.algorithm',
  feedback: 'common.feedback',
  keyTranspose: 'common.transpose',
};

const LFO_FIELD_KEYS: Record<string, string> = {
  speed: 'lfo.speed',
  delay: 'lfo.delay',
  pitchModulationDepth: 'lfo.pitchModulationDepth',
  amplitudeModulationDepth: 'lfo.amplitudeModulationDepth',
  wave: 'lfo.wave',
  sync: 'lfo.sync',
};

const OPERATOR_FIELD_KEYS: Record<string, string> = {
  mode: 'oscillatorMode',
  sync: 'common.oscillatorKeySync',
  freqCoarse: 'frequencyCoarse',
  freqFine: 'frequencyFine',
  detune: 'detune',
  breakpoint: 'breakpoint',
  curveLeft: 'curveLeft',
  curveRight: 'curveRight',
  depthLeft: 'depthLeft',
  depthRight: 'depthRight',
  keyboardRateScaling: 'keyboardRateScaling',
  outputLevel: 'outputLevel',
  velocitySensitivity: 'velocitySensitivity',
  modulationAmplitude: 'amplitudeModulationSensitivity',
  modulationPitch: 'lfo.pitchModulationSensitivity',
};

/**
 * Map one BlueX7Patch to its runtime intent. Shared controls map to the one
 * shared parameter (logical operator 1 is the effective source); envelope
 * point patches map to both the rate and the level key; whole-voice
 * replacement maps to the complete-voice intent; post-code edits carry no
 * parameter change.
 */
export function blueX7PatchToRuntimeIntent(patch: BlueX7Patch): BlueX7PatchRuntimeIntent {
  switch (patch.type) {
    case 'setCommonField': {
      if (patch.field === 'operatorEnabled') {
        return Array.isArray(patch.value)
          && patch.value.length === 6
          && patch.value.every((value) => typeof value === 'boolean')
          ? { kind: 'complete-voice' }
          : { kind: 'none' };
      }
      const key = COMMON_FIELD_KEYS[patch.field];
      const value = patch.value;
      return typeof key === 'string' && typeof value === 'number'
        ? { kind: 'fixed-delta', changes: [{ semanticKey: key, value }] }
        : { kind: 'none' };
    }
    case 'setOperatorEnabled':
      return {
        kind: 'fixed-delta',
        changes: [
          {
            semanticKey: `operator.${patch.operatorIndex + 1}.enabled`,
            value: patch.enabled ? 1 : 0,
          },
        ],
      };
    case 'setLfoField': {
      const key = LFO_FIELD_KEYS[patch.field];
      const value = patch.value;
      return typeof key === 'string' && typeof value === 'number'
        ? { kind: 'fixed-delta', changes: [{ semanticKey: key, value }] }
        : { kind: 'none' };
    }
    case 'setOperatorField': {
      const suffix = OPERATOR_FIELD_KEYS[patch.field];
      const value = patch.value;
      if (typeof suffix !== 'string' || typeof value !== 'number') {
        return { kind: 'none' };
      }
      const semanticKey = suffix.includes('.')
        ? suffix
        : `operator.${patch.operatorIndex + 1}.${suffix}`;
      return { kind: 'fixed-delta', changes: [{ semanticKey, value }] };
    }
    case 'setSharedOscillatorSync':
      return {
        kind: 'fixed-delta',
        changes: [{ semanticKey: 'common.oscillatorKeySync', value: patch.value }],
      };
    case 'setSharedPitchModulationSensitivity':
      return {
        kind: 'fixed-delta',
        changes: [
          { semanticKey: 'lfo.pitchModulationSensitivity', value: patch.value },
        ],
      };
    case 'setOperatorEnvelopePoint':
      return {
        kind: 'fixed-delta',
        changes: [
          {
            semanticKey: `operator.${patch.operatorIndex + 1}.envelope.${patch.stageIndex + 1}.rate`,
            value: patch.point.rate,
          },
          {
            semanticKey: `operator.${patch.operatorIndex + 1}.envelope.${patch.stageIndex + 1}.level`,
            value: patch.point.level,
          },
        ],
      };
    case 'setPitchEnvelopePoint':
      return {
        kind: 'fixed-delta',
        changes: [
          { semanticKey: `pitchEnvelope.${patch.stageIndex + 1}.rate`, value: patch.point.rate },
          { semanticKey: `pitchEnvelope.${patch.stageIndex + 1}.level`, value: patch.point.level },
        ],
      };
    case 'replaceVoice':
      return { kind: 'complete-voice' };
    case 'setCsoundPostCode':
      return { kind: 'none' };
    default:
      return { kind: 'none' };
  }
}
