import { useEffect, useState } from 'react';
import {
  buildWaveformCacheKey,
  buildWaveformPathData,
  getWaveformCacheEntry,
  requestWaveform,
  subscribeWaveformCacheEntry,
  type WaveformCacheEntry,
} from './waveform-cache';

interface Props {
  waveformKey: string;
  filePath: string;
  pixelSecond: number;
  pixelsPerBeat: number;
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
  width,
  height,
  color,
  startOffsetBeats = 0,
  looping = false,
}: Props) {
  const cacheKey = buildWaveformCacheKey(waveformKey, pixelSecond);
  const [entry, setEntry] = useState<WaveformCacheEntry | undefined>(() =>
    getWaveformCacheEntry(cacheKey),
  );

  useEffect(() => {
    const requested = requestWaveform(waveformKey, filePath, pixelSecond);
    setEntry(requested);

    return subscribeWaveformCacheEntry(cacheKey, () => {
      setEntry(getWaveformCacheEntry(cacheKey));
    });
  }, [cacheKey, filePath, pixelSecond, waveformKey]);

  if (!entry || entry.loading || entry.channels.length === 0) {
    return null;
  }

  const paths = buildWaveformPathData(entry, {
    width,
    height,
    pixelsPerBeat,
    startOffsetBeats,
    looping,
  });

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
