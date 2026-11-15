import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useScoreViewportBounds } from '../score-viewport-scroll';
import {
  buildWaveformCacheKey,
  buildWaveformPathData,
  getWaveformCacheEntry,
  getWaveformCacheGeneration,
  requestWaveform,
  subscribeWaveformCacheEntry,
  subscribeWaveformCacheReset,
  type WaveformCacheEntry,
} from './waveform-cache';

interface Props {
  waveformKey: string;
  filePath: string;
  pixelSecond: number;
  pixelsPerBeat: number;
  timelineLeftPx?: number;
  width: number;
  height: number;
  color: string;
  startOffsetBeats?: number;
  looping?: boolean;
}

export default function WaveformBody({
  waveformKey,
  filePath,
  pixelSecond,
  pixelsPerBeat,
  timelineLeftPx,
  width,
  height,
  color,
  startOffsetBeats = 0,
  looping = false,
}: Props) {
  const cacheKey = buildWaveformCacheKey(waveformKey, pixelSecond);
  const cacheGeneration = useSyncExternalStore(
    subscribeWaveformCacheReset,
    getWaveformCacheGeneration,
    getWaveformCacheGeneration,
  );
  const [entry, setEntry] = useState<WaveformCacheEntry | undefined>(() =>
    getWaveformCacheEntry(cacheKey),
  );

  useEffect(() => {
    const requested = requestWaveform(waveformKey, filePath, pixelSecond);
    setEntry(requested);

    return subscribeWaveformCacheEntry(cacheKey, setEntry);
  }, [cacheKey, cacheGeneration, filePath, pixelSecond, waveformKey]);

  const { visibleStartBeats, visibleEndBeats } = useScoreViewportBounds(pixelsPerBeat);
  const waveformLeft = timelineLeftPx === undefined ? undefined : timelineLeftPx + 1;
  const clipStartPx =
    waveformLeft === undefined || visibleStartBeats === undefined
      ? 0
      : Math.max(0, visibleStartBeats * pixelsPerBeat - waveformLeft);
  const clipEndPx =
    waveformLeft === undefined || visibleEndBeats === undefined
      ? width
      : Math.min(width, visibleEndBeats * pixelsPerBeat - waveformLeft);

  const paths = useMemo(() => {
    if (!entry || entry.loading || entry.channels.length === 0) return [];
    return buildWaveformPathData(entry, {
      width,
      height,
      pixelsPerBeat,
      startOffsetBeats,
      looping,
      clipStartPx,
      clipEndPx,
    });
  }, [entry, width, height, pixelsPerBeat, startOffsetBeats, looping, clipStartPx, clipEndPx]);

  if (paths.length === 0) {
    return null;
  }

  return (
    <svg
      data-waveform-key={waveformKey}
      style={{
        position: 'absolute',
        top: 2,
        left: 1,
        width,
        height,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
      width={width}
      height={height}
      viewBox={`0 0 ${Math.max(1, width)} ${Math.max(1, height)}`}
      preserveAspectRatio="none"
    >
      {paths.map((path, index) => (
        <path
          key={`${cacheKey}-${index}`}
          d={path}
          stroke={color}
          strokeWidth={1}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
