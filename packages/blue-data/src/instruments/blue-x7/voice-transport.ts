/**
 * BlueX7 voice transport — the pure, validated mapping from one BlueX7 voice
 * to the modern renderer's 155-value unpacked DX7 table plus the six-bit
 * operator mask (Spec 092). This builder has no engine or UI dependency and
 * is the test oracle for static CSD generation and live transport.
 *
 * Browser-safe: no host APIs, static imports only.
 */
import type { BlueX7Voice } from '../blue-x7';
import {
  BLUE_X7_PARAMETER_DESCRIPTORS,
  quantizeBlueX7DescriptorValue,
  readBlueX7VoiceValue,
} from './parameter-catalog';

export interface BlueX7VoiceTransport {
  /** Length 155; slots 0..144 are synthesized, 145..154 are name bytes. */
  voice: readonly number[];
  /** Six bits; bit 0 = logical operator 1. */
  operatorMask: number;
}

/**
 * Build the engine-facing transport snapshot for one voice. Values are
 * clamped/quantized by the parameter catalog, algorithm is stored 0-based,
 * and detune carries the +7 center offset at this boundary. Name bytes
 * 145..154 stay deterministically zero and are never synthesized.
 */
export function buildBlueX7VoiceTransport(
  voice: BlueX7Voice,
  operatorEnabled: readonly boolean[],
): BlueX7VoiceTransport {
  const transport = new Array<number>(155).fill(0);

  for (const descriptor of BLUE_X7_PARAMETER_DESCRIPTORS) {
    if (descriptor.transport.kind !== 'voice') {
      continue;
    }
    const slot = descriptor.transport.slot;
    const quantized = quantizeBlueX7DescriptorValue(
      descriptor,
      readBlueX7VoiceValue(voice, descriptor.key) ?? Number.NaN,
    );
    // A non-finite canonical value (corrupt XML) degrades to the neutral
    // zero slot instead of poisoning generated Csound text with NaN.
    if (quantized === null) {
      continue;
    }
    let value = quantized;
    if (slot === 134) {
      value = quantized - 1; // algorithm: renderer expects 0-based
    } else if (slot < 126 && slot % 21 === 20) {
      value = quantized + 7; // detune: 7 = center
    }
    transport[slot] = value;
  }

  let operatorMask = 0;
  for (let op = 1; op <= 6; op++) {
    if (operatorEnabled[op - 1]) {
      operatorMask |= 1 << (op - 1);
    }
  }

  return { voice: transport, operatorMask };
}
