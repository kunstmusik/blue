/**
 * Browser-safe, host-neutral audio layout manifest and effective layout contracts.
 * Defined in specs/112-mono-clip-panning/data-model.md.
 */

import { Effect } from '../../mixer/effect';

export type SourceChannelCount = 1 | 2 | 'unsupported';

export type SourceObservationStatus = 'verified' | 'unreadable' | 'missing' | 'unsupported';

export interface AudioFileLayoutObservation {
  readonly filePath: string;
  readonly channels: SourceChannelCount;
  readonly status: SourceObservationStatus;
  readonly sampleRate?: number;
  readonly duration?: number;
}

export interface AudioLayoutManifest {
  readonly observations: ReadonlyMap<string, AudioFileLayoutObservation>;
}

export function createAudioLayoutManifest(
  entries?:
    | Iterable<[string, AudioFileLayoutObservation]>
    | Record<string, AudioFileLayoutObservation>
    | Map<string, AudioFileLayoutObservation>,
): AudioLayoutManifest {
  if (!entries) {
    return { observations: new Map() };
  }
  if (entries instanceof Map) {
    return { observations: new Map(entries) };
  }
  if (typeof entries === 'object' && Symbol.iterator in entries) {
    return { observations: new Map(entries as Iterable<[string, AudioFileLayoutObservation]>) };
  }
  return { observations: new Map(Object.entries(entries)) };
}

export type EffectiveTrackLayout = 'mono' | 'stereo-or-unknown';

export interface EffectiveLayoutResolutionOptions {
  readonly hasStereoOrUnclassifiedSource?: boolean;
  readonly hasUpstreamEffects?: boolean;
}

/**
 * An enabled mixer Effect can make a source channel's left/right buses differ.
 * Sends are deliberately excluded: they tap the source but do not change the
 * source channel's own layout before its position stage.
 */
export function hasEnabledStereoGeneratingEffect(entries: readonly unknown[]): boolean {
  return entries.some((entry) => entry instanceof Effect && entry.isEnabled());
}

/**
 * Resolves the effective layout of a track or channel.
 *
 * All-mono ('mono') requires:
 * 1. At least one clip and ALL clips on the track must have verified mono (1 channel) observations.
 * 2. No unclassified or non-clip instrument source.
 * 3. No upstream effects that could alter left/right bus correlation.
 *
 * Otherwise, resolves to 'stereo-or-unknown' (using stereo balance).
 */
export function resolveEffectiveTrackLayout(
  clipPaths: readonly string[],
  manifest?: AudioLayoutManifest | null,
  options?: EffectiveLayoutResolutionOptions,
): EffectiveTrackLayout {
  if (options?.hasStereoOrUnclassifiedSource || options?.hasUpstreamEffects) {
    return 'stereo-or-unknown';
  }

  if (clipPaths.length === 0 || !manifest) {
    return 'stereo-or-unknown';
  }

  for (const rawPath of clipPaths) {
    // Check direct path or normalized path
    const observation =
      manifest.observations.get(rawPath) ??
      manifest.observations.get(rawPath.replace(/\\/g, '/')) ??
      manifest.observations.get(rawPath.replace(/\//g, '\\'));

    if (!observation || observation.status !== 'verified' || observation.channels !== 1) {
      return 'stereo-or-unknown';
    }
  }

  return 'mono';
}

export class AudioLayoutCompileError extends Error {
  readonly code: string;
  readonly filePath?: string;
  readonly observedChannels?: number | 'unsupported';
  readonly outputChannels?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      filePath?: string;
      observedChannels?: number | 'unsupported';
      outputChannels?: number;
    },
  ) {
    super(message);
    this.name = 'AudioLayoutCompileError';
    this.code = options?.code ?? 'MISSING_AUDIO_LAYOUT';
    this.filePath = options?.filePath;
    this.observedChannels = options?.observedChannels;
    this.outputChannels = options?.outputChannels;
  }
}
