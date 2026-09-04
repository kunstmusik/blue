/**
 * Project parameter catalog — the one authoritative owner-aware enumeration
 * of every automatable Parameter in a project (Spec 092): enabled arrangement
 * instruments in arrangement order, Track-owned instruments in score/group/
 * Track order, then mixer Parameters in the established order. Consumers
 * route by `ownerIdentity + parameter.uniqueId`; ordering is used only for
 * deterministic compilation naming and presentation, never for routing.
 *
 * This closes the Track discovery gap where live score paths enumerated only
 * arrangement and mixer Parameters while compilation included Track
 * instruments.
 *
 * Browser-safe: no host APIs, static imports only.
 */
import { Parameter } from './parameter';
import { Arrangement } from '../arrangement';
import { Mixer } from '../mixer/mixer';
import { Channel } from '../mixer/channel';
import { Effect } from '../mixer/effect';
import { Send } from '../mixer/send';
import { EffectsChain } from '../mixer/effects-chain';
import { Score } from '../score/score';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import type { BlueData } from '../blue-data';

export type ProjectParameterOwnerKind = 'arrangement-instrument' | 'track-instrument' | 'mixer';

export interface ProjectParameterEntry {
  ownerKind: ProjectParameterOwnerKind;
  /** Stable location identity, never a display name. */
  ownerIdentity: string;
  /** Display only; same-named owners are disambiguated by location. */
  ownerLabel: string;
  parameter: Parameter;
  /** Automation chooser groups. */
  path: readonly string[];
}

function collectInstrumentParameters(instr: unknown): Parameter[] | null {
  if (instr && typeof (instr as { getParameters?: unknown }).getParameters === 'function') {
    const params = (instr as { getParameters: () => unknown }).getParameters();
    if (params && Array.isArray(params)) {
      return params as Parameter[];
    }
  }
  return null;
}

function collectChainParameters(chain: EffectsChain, parameters: Parameter[]): void {
  for (const item of chain) {
    if (item instanceof Effect || item instanceof Send) {
      parameters.push(...item.getParameters());
    }
  }
}

function collectChannelParameters(channel: Channel, parameters: Parameter[]): void {
  collectChainParameters(channel.getPreEffects(), parameters);
  collectChainParameters(channel.getPostEffects(), parameters);
  parameters.push(channel.getLevelParameter());
}

/** Mixer parameters in the established source/sub/master order. */
export function getMixerOwnerParameters(mixer: Mixer): Parameter[] {
  const parameters: Parameter[] = [];
  if (!mixer.isEnabled()) {
    return parameters;
  }
  for (const channel of mixer.getAllSourceChannels()) {
    collectChannelParameters(channel, parameters);
  }
  for (const subChannel of mixer.getSubChannels()) {
    collectChannelParameters(subChannel, parameters);
  }
  collectChannelParameters(mixer.getMaster(), parameters);
  return parameters;
}

/**
 * Enumerate arrangement instrument parameters with owner attribution.
 */
export function getArrangementOwnerParameters(arrangement: Arrangement): ProjectParameterEntry[] {
  const entries: ProjectParameterEntry[] = [];
  for (const ia of arrangement.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const params = collectInstrumentParameters(ia.instr);
    if (!params) continue;
    const ownerIdentity = `arrangement:${ia.arrangementId}`;
    const ownerLabel = `${ia.arrangementId}) ${ia.instr.getName()}`;
    for (const parameter of params) {
      entries.push({
        ownerKind: 'arrangement-instrument',
        ownerIdentity,
        ownerLabel,
        parameter,
        path: [ia.instr.getName()],
      });
    }
  }
  return entries;
}

/**
 * Enumerate Track-owned instrument parameters with owner attribution, in
 * score/group/Track order.
 */
export function getTrackOwnerParameters(score: Score): ProjectParameterEntry[] {
  const entries: ProjectParameterEntry[] = [];
  for (const layerGroup of score) {
    if (!(layerGroup instanceof TrackLayerGroup)) continue;
    for (const track of layerGroup) {
      const instrument = track.getInstrument();
      if (!instrument || !instrument.isEnabled()) continue;
      const params = collectInstrumentParameters(instrument);
      if (!params) continue;
      const ownerIdentity = `track:${layerGroup.getUniqueId()}:${track.getUniqueId()}`;
      const ownerLabel = `${layerGroup.getName()} / ${track.getName()}`;
      for (const parameter of params) {
        entries.push({
          ownerKind: 'track-instrument',
          ownerIdentity,
          ownerLabel,
          parameter,
          path: [layerGroup.getName(), track.getName()],
        });
      }
    }
  }
  return entries;
}

/**
 * The one authoritative project-wide Parameter catalog: arrangement
 * instruments, Track instruments, then mixer Parameters, in deterministic
 * order with stable owner identities.
 */
export function getProjectParameterCatalog(blueData: BlueData): ProjectParameterEntry[] {
  return [
    ...getArrangementOwnerParameters(blueData.getArrangement()),
    ...getTrackOwnerParameters(blueData.getScore()),
    ...getMixerOwnerParameters(blueData.getMixer()).map((parameter) => ({
      ownerKind: 'mixer' as const,
      ownerIdentity: 'mixer',
      ownerLabel: 'Mixer',
      parameter,
      path: ['Mixer'] as readonly string[],
    })),
  ];
}
