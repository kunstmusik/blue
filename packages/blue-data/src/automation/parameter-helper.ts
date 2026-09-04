/**
 * ParameterHelper — collects all automation parameters from arrangement and mixer.
 * Mirrors the Java ParameterHelper class.
 *
 * Parameters are collected from:
 * - Instruments in the arrangement (if they implement Automatable)
 * - Mixer source channels: effect parameters + channel volume + send amounts
 * - Mixer sub channels: effect parameters + channel volume
 * - Mixer master: channel volume
 */
import { Parameter } from '../automation/parameter';
import { Arrangement } from '../arrangement';
import { Mixer } from '../mixer/mixer';
import { Channel } from '../mixer/channel';
import { Effect } from '../mixer/effect';
import { Send } from '../mixer/send';
import { EffectsChain } from '../mixer/effects-chain';

/**
 * Get all parameters from arrangement and mixer.
 */
export function getAllParameters(arrangement: Arrangement, mixer: Mixer): Parameter[] {
  const parameters: Parameter[] = [];

  // Parameters from instruments in arrangement
  for (const ia of arrangement.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const instr = ia.instr as any;
    if (typeof instr.getParameters === 'function') {
      const instrParams = instr.getParameters();
      if (instrParams && Array.isArray(instrParams)) {
        parameters.push(...instrParams);
      }
    }
  }

  if (!mixer.isEnabled()) return parameters;

  // Parameters from mixer source channels
  for (const channel of mixer.getAllSourceChannels()) {
    collectChannelParameters(channel, parameters);
  }

  // Parameters from mixer sub channels
  for (const subChannel of mixer.getSubChannels()) {
    collectChannelParameters(subChannel, parameters);
  }

  // Master channel
  collectChannelParameters(mixer.getMaster(), parameters);

  return parameters;
}

/**
 * Collect parameters from a mixer channel: effects, volume, and sends.
 */
function collectChannelParameters(channel: Channel, parameters: Parameter[]): void {
  collectChainParameters(channel.getPreEffects(), parameters);
  collectChainParameters(channel.getPostEffects(), parameters);

  // Channel level parameter
  parameters.push(channel.getLevelParameter());
}

function collectChainParameters(chain: EffectsChain, parameters: Parameter[]): void {
  for (const item of chain) {
    if (item instanceof Effect || item instanceof Send) {
      parameters.push(...item.getParameters());
    }
  }
}

/**
 * Assign compilation variable names to parameters.
 * Names are: gk_blue_auto0, gk_blue_auto1, ...
 */
export function assignParameterNames(parameters: Parameter[]): void {
  for (let i = 0; i < parameters.length; i++) {
    parameters[i].setCompilationVarName(`gk_blue_auto${i}`);
  }
}

/**
 * Namespace export for convenient importing.
 * Usage: import { ParameterHelper } from '@blue/data';
 */
export const ParameterHelper = {
  getAllParameters,
  assignParameterNames,
};
