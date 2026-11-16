import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useScoreViewportBounds } from '../score-viewport-scroll';
import {
  buildWaveformCacheKey,
  buildWaveformSegments,
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

  const geometry = useMemo(() => {
    if (!entry || entry.loading || entry.channels.length === 0) return null;
    return buildWaveformSegments(entry, {
      width,
      height,
      pixelsPerBeat,
      startOffsetBeats,
      looping,
      clipStartPx,
      clipEndPx,
    });
  }, [entry, width, height, pixelsPerBeat, startOffsetBeats, looping, clipStartPx, clipEndPx]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const view = canvas?.ownerDocument.defaultView;
    if (!canvas || !geometry || !view?.CanvasRenderingContext2D) return;
    const ratio = view.devicePixelRatio || 1;
    const width = Math.ceil(geometry.width * ratio);
    const height = Math.ceil(geometry.height * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, geometry.width, geometry.height);
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    const { segments } = geometry;
    for (let index = 0; index < segments.length; index += 3) {
      const x = segments[index]!;
      context.moveTo(x, segments[index + 1]!);
      context.lineTo(x, segments[index + 2]!);
    }
    context.stroke();
  }, [color, geometry]);

  if (!geometry) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-waveform-key={waveformKey}
      width={geometry.width}
      height={geometry.height}
      style={{
        position: 'absolute',
        top: 2,
        left: geometry.left + 1,
        width: geometry.width,
        height: geometry.height,
        pointerEvents: 'none',
      }}
    />
  );
}
