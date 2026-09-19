import { Parameter } from './parameter';
import { Channel } from '../mixer/channel';
import { Effect } from '../mixer/effect';
import { EffectsChain } from '../mixer/effects-chain';
import { Send } from '../mixer/send';

export function getMixerChannelParameters(channel: Channel, includePan: boolean): Parameter[] {
  const parameters: Parameter[] = [];
  appendEffectsChainParameters(channel.getPreEffects(), parameters);
  appendEffectsChainParameters(channel.getPostEffects(), parameters);
  parameters.push(channel.getLevelParameter());
  if (includePan) {
    parameters.push(
      channel.getPanParameter(),
      channel.getPanWidthParameter(),
      channel.getDualPanLeftParameter(),
      channel.getDualPanRightParameter(),
    );
  }
  return parameters;
}

function appendEffectsChainParameters(chain: EffectsChain, parameters: Parameter[]): void {
  for (const item of chain) {
    if (item instanceof Effect || item instanceof Send) {
      parameters.push(...item.getParameters());
    }
  }
}
