import type { BlueData } from '../blue-data';
import { AudioClip } from '../score/audio/audio-clip';
import { Track } from '../score/track/track';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { Effect } from '../mixer/effect';
import type { Channel } from '../mixer/channel';
import type { MixerGateState } from '../mixer/mute-solo-policy';

export interface DiskPruningGateContext {
  readonly state: Pick<MixerGateState, 'acyclic' | 'hasUnresolvedRoutes' | 'channels'>;
  readonly orderedChannels: readonly Channel[];
}

const NO_PRUNING: ReadonlySet<string> = new Set();

export function isAudioClipOnlyTrack(track: Track): boolean {
  for (const item of track) {
    if (!(item instanceof AudioClip)) return false;
  }
  return track.length > 0;
}

/**
 * Effective track header authority (Spec 111): Event whenever the mixer is
 * disabled, otherwise the parsed project preference (invalid values already
 * parse as Event).
 */
export function getEffectiveTrackLayerMuteSoloMode(blueData: BlueData, mixerEnabled: boolean) {
  if (!mixerEnabled) return 'event' as const;
  return blueData.getScore().trackLayerMuteSoloMode;
}

/**
 * Certifies a project for disk event pruning. Only built-in AudioClip-only
 * Track projects qualify: no custom global orchestra/score, no project UDOs,
 * no score/track note processors, no enabled arrangement instruments, no
 * opaque enabled mixer effects, valid acyclic routing. Every uncertain case
 * disables pruning entirely and falls back to ordinary gated rendering.
 */
export function computeDiskPruningSet(
  blueData: BlueData,
  gateContext: DiskPruningGateContext,
): ReadonlySet<string> {
  if (!gateContext.state.acyclic || gateContext.state.hasUnresolvedRoutes) return NO_PRUNING;

  const globalOrcSco = blueData.getGlobalOrcSco();
  if ((globalOrcSco.getGlobalOrc() ?? '').trim().length > 0) return NO_PRUNING;
  if ((globalOrcSco.getGlobalSco() ?? '').trim().length > 0) return NO_PRUNING;
  if (blueData.getOpcodeList().getOpcodes().length > 0) return NO_PRUNING;

  const score = blueData.getScore();
  if (score.getNoteProcessorChain().getProcessors().length > 0) return NO_PRUNING;
  for (const group of score) {
    if (!(group instanceof TrackLayerGroup)) {
      return NO_PRUNING;
    }
    // Certification remains project-wide for supported executable content.
    for (const track of group as TrackLayerGroup & Track[]) {
      const t = track as Track;
      if (t.getNoteProcessorChain().getProcessors().length > 0) return NO_PRUNING;
      if (!isAudioClipOnlyTrack(t)) return NO_PRUNING;
      // An enabled track instrument can contribute opaque shared orchestra code.
      if (t.getInstrument()?.isEnabled()) return NO_PRUNING;
    }
  }
  for (const ia of blueData.getArrangement().getArrangement()) {
    if (ia.enabled && ia.instr) return NO_PRUNING;
  }

  // No enabled effect anywhere in the mixer: effects are opaque code whose
  // state or side effects cannot be proven irrelevant.
  const hasEnabledEffectInChain = (chain: Iterable<unknown>): boolean => {
    for (const item of chain) {
      if (item instanceof Effect && item.isEnabled()) return true;
    }
    return false;
  };
  const mixer = blueData.getMixer();
  for (const channel of mixer.getAllSourceChannels()) {
    if (
      hasEnabledEffectInChain(channel.getPreEffects()) ||
      hasEnabledEffectInChain(channel.getPostEffects())
    ) {
      return NO_PRUNING;
    }
  }
  for (const channel of mixer.getSubChannels()) {
    if (
      hasEnabledEffectInChain(channel.getPreEffects()) ||
      hasEnabledEffectInChain(channel.getPostEffects())
    ) {
      return NO_PRUNING;
    }
  }
  const master = mixer.getMaster();
  if (
    hasEnabledEffectInChain(master.getPreEffects()) ||
    hasEnabledEffectInChain(master.getPostEffects())
  ) {
    return NO_PRUNING;
  }

  const indicatorByOrdinal = new Map(
    gateContext.state.channels.map((candidate) => [candidate.ordinal, candidate] as const),
  );
  const audibilityByAssociation = new Map<string, boolean>();
  for (const [ordinal, channel] of gateContext.orderedChannels.entries()) {
    const association = channel.getAssociation();
    // Clip routing uses the first channel with a matching association.
    if (!association || audibilityByAssociation.has(association)) continue;
    audibilityByAssociation.set(
      association,
      indicatorByOrdinal.get(ordinal)?.reachesAudibleOutput ?? true,
    );
  }

  const prune = new Set<string>();
  for (const group of score) {
    if (!(group instanceof TrackLayerGroup)) continue;
    for (const track of group as TrackLayerGroup & Track[]) {
      const t = track as Track;
      if (!isAudioClipOnlyTrack(t)) continue;
      if (audibilityByAssociation.get(t.getUniqueId()) !== false) continue;
      prune.add(t.getUniqueId());
    }
  }
  return prune;
}
