import { useEffect, type RefObject } from 'react';
import {
  usePlaybackStore,
  type PlaybackClockState,
  type PlaybackStatus,
  type PlaybackTransportAnchor,
} from '../../../../stores/playback-store';
import { useProjectStore } from '../../../../stores/project-store';
import type { ToolbarProjectTransportSnapshot } from '../../../../../shared/project-editor';
import { secondsToBeats as tempoMapSecondsToBeats } from './tempo-map-utils';
import { getFollowScrollTarget } from './follow-playback';

export function computeTimePointerBeats(
  playbackStatus: PlaybackStatus,
  playbackClock: PlaybackClockState | null,
  clockElapsed: number,
  transportAnchor: PlaybackTransportAnchor | null,
  fallbackTransport: ToolbarProjectTransportSnapshot,
): number | null {
  const livePlayheadTransport = transportAnchor ?? fallbackTransport;
  const hasLivePlaybackClock =
    playbackClock !== null && (playbackStatus === 'playing' || playbackStatus === 'stopping');
  return hasLivePlaybackClock && clockElapsed >= 0
    ? livePlayheadTransport.renderStartTime +
        tempoMapSecondsToBeats(clockElapsed, livePlayheadTransport.tempoMap)
    : null;
}

export function useLiveTimePointerBeats(overrideTimePointerBeats?: number | null): number | null {
  const hasOverride = overrideTimePointerBeats !== undefined;
  const playbackStatus = usePlaybackStore((s) => (hasOverride ? 'idle' : s.status));
  const playbackClock = usePlaybackStore((s) => (hasOverride ? null : s.clock));
  const clockElapsed = usePlaybackStore((s) => (hasOverride ? 0 : s.display.elapsedSeconds));
  const transportAnchor = usePlaybackStore((s) => (hasOverride ? null : s.transportAnchor));
  const projectTransport = useProjectStore((s) => s.transport);

  if (hasOverride) {
    return overrideTimePointerBeats ?? null;
  }

  return computeTimePointerBeats(
    playbackStatus,
    playbackClock,
    clockElapsed,
    transportAnchor,
    projectTransport,
  );
}

interface ScorePlaybackAutoFollowProps {
  isRootTimeline: boolean;
  pixelsPerBeat: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  applyProgrammaticHorizontalScroll: (nextScrollLeft: number) => void;
}

/**
 * Isolated leaf subscriber for follow-playback page jumping (Java
 * ScoreTopComponent parity) so 30 Hz playhead clock ticks never re-render
 * ScorePanel or LayerPanel.
 */
export function ScorePlaybackAutoFollow({
  isRootTimeline,
  pixelsPerBeat,
  scrollContainerRef,
  applyProgrammaticHorizontalScroll,
}: ScorePlaybackAutoFollowProps): null {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const followPlayback = usePlaybackStore((s) => s.followPlayback);
  const timePointerBeats = useLiveTimePointerBeats();

  useEffect(() => {
    if (!isRootTimeline || timePointerBeats == null) {
      return;
    }

    const timeline = scrollContainerRef.current;
    if (!timeline) {
      return;
    }

    const pointerPixel = timePointerBeats * pixelsPerBeat;
    const targetScrollLeft = getFollowScrollTarget({
      isPlaybackActive: isPlaying,
      isFollowEnabled: followPlayback,
      pointerPixel,
      scrollLeft: timeline.scrollLeft,
      clientWidth: timeline.clientWidth,
      scrollWidth: timeline.scrollWidth,
    });

    if (targetScrollLeft === null || targetScrollLeft === timeline.scrollLeft) {
      return;
    }

    applyProgrammaticHorizontalScroll(targetScrollLeft);
  }, [
    followPlayback,
    isPlaying,
    isRootTimeline,
    timePointerBeats,
    pixelsPerBeat,
    scrollContainerRef,
    applyProgrammaticHorizontalScroll,
  ]);

  return null;
}
