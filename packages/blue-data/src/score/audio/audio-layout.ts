/**
 * Browser-safe, host-neutral audio layout manifest and effective layout contracts.
 * Defined in specs/112-mono-clip-panning/data-model.md.
 */

import { Effect } from '../../mixer/effect';

/** Audio source classifications supported by layout resolution. */
export type SourceChannelCount = 1 | 2 | 'unsupported';

/** Outcome of the host's audio metadata inspection. */
export type SourceObservationStatus = 'verified' | 'unreadable' | 'missing' | 'unsupported';

/** Host metadata and classification for one source audio file. */
export interface AudioFileLayoutObservation {
  /** Native path identifying the inspected source file. */
  readonly filePath: string;
  /** Observed channel count, or the unsupported-format sentinel. */
  readonly channels: SourceChannelCount;
  /** Outcome of the host's inspection. */
  readonly status: SourceObservationStatus;
  /** Sample rate in hertz when the host could determine it. */
  readonly sampleRate?: number;
  /** Source duration in seconds when available. */
  readonly duration?: number;
}

/** Host-supplied observations used to resolve channel layouts without file I/O in Blue Data. */
export interface AudioLayoutManifest {
  /** Host observations indexed by the source path used during layout resolution. */
  readonly observations: ReadonlyMap<string, AudioFileLayoutObservation>;
}

/** Indexes host-provided source metadata by file path for channel layout resolution. */
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

/** Resolved track layout, with stereo and uncertain sources treated conservatively. */
export type EffectiveTrackLayout = 'mono' | 'stereo-or-unknown';

/** Additional upstream constraints for resolving a track's channel layout. */
export interface EffectiveLayoutResolutionOptions {
  /** A stereo or unknown source requires conservative stereo routing. */
  readonly hasStereoOrUnclassifiedSource?: boolean;
  /** Upstream effects prevent the resolver from assuming a mono signal. */
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

/** Reports audio metadata that prevents resolution of a track's channel layout. */
export class AudioLayoutCompileError extends Error {
  /** Machine-readable layout diagnostic identifier. */
  readonly code: string;
  /** Path of the affected audio source, when available. */
  readonly filePath?: string;
  /** Number or classification of the input channels, when available. */
  readonly observedChannels?: number | 'unsupported';
  /** Output channel count associated with the rejected layout, when available. */
  readonly outputChannels?: number;

  /** Creates a compile error with optional source path and channel metadata. */
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
