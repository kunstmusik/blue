import { useEffect, useRef, useState, type RefObject } from "react";
import { summarizeWaveformChannels } from "../score/bar-renderers/waveform-cache";

interface AudioPlayerWaveformProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  filePath: string | null;
  duration: number;
  onSeek: (timeSeconds: number) => void;
}

interface Peaks {
  min: number[];
  max: number[];
}

export interface WaveformEnvelopePoint {
  x: number;
  yTop: number;
  yBottom: number;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  return (
    globalThis.AudioContext ??
    (
      globalThis as typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext ??
    null
  );
}

const PEAK_COLOR = "rgb(99 140 255)";
const PEAK_FILL_COLOR = "rgba(99, 140, 255, 0.32)";
const ZERO_LINE_COLOR = "rgba(120, 150, 210, 0.22)";
const PLAYHEAD_COLOR = "rgb(239 68 68)";
const PLACEHOLDER_COLOR = "rgba(120, 140, 170, 0.25)";

export function buildWaveformEnvelope(
  peaks: Peaks,
  width: number,
  height: number,
): WaveformEnvelopePoint[] {
  const bucketCount = Math.min(peaks.min.length, peaks.max.length);
  if (bucketCount === 0 || width <= 0 || height <= 0) return [];

  const mid = height / 2;
  const amplitude = Math.max(0, mid - 2);
  const xStep = bucketCount > 1 ? width / (bucketCount - 1) : 0;
  const clampSample = (sample: number) => Math.max(-1, Math.min(1, sample));

  return Array.from({ length: bucketCount }, (_, index) => {
    const min = clampSample(peaks.min[index] ?? 0);
    const max = clampSample(peaks.max[index] ?? 0);
    return {
      x: bucketCount > 1 ? index * xStep : width / 2,
      yTop: mid - Math.max(min, max) * amplitude,
      yBottom: mid - Math.min(min, max) * amplitude,
    };
  });
}

export function drawWaveformEnvelope(
  context: CanvasRenderingContext2D,
  peaks: Peaks,
  width: number,
  height: number,
): boolean {
  const envelope = buildWaveformEnvelope(peaks, width, height);
  const first = envelope[0];
  if (!first) return false;

  context.beginPath();
  context.moveTo(first.x, first.yTop);
  for (let i = 1; i < envelope.length; i += 1) {
    const point = envelope[i];
    if (point) context.lineTo(point.x, point.yTop);
  }
  for (let i = envelope.length - 1; i >= 0; i -= 1) {
    const point = envelope[i];
    if (point) context.lineTo(point.x, point.yBottom);
  }
  context.closePath();
  context.fillStyle = PEAK_FILL_COLOR;
  context.fill();
  context.strokeStyle = PEAK_COLOR;
  context.lineWidth = 1;
  context.lineJoin = "round";
  context.stroke();
  return true;
}

export default function AudioPlayerWaveform({
  audioRef,
  filePath,
  duration,
  onSeek,
}: AudioPlayerWaveformProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<Peaks | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    peaksRef.current = peaks;
  }, [peaks]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setWidth(container.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!filePath || width <= 0) {
      setPeaks(null);
      setStatus(null);
      return;
    }

    let cancelled = false;
    setStatus(null);
    setPeaks(null);

    (async () => {
      const bytes = await window.blueAPI.readAuthorizedAudioFileBytes(filePath);
      if (cancelled || !bytes) {
        if (!cancelled) setStatus("Unable to read audio file.");
        return;
      }

      const AudioContextCtor = getAudioContextCtor();
      if (!AudioContextCtor) {
        setStatus("Audio decoding is unavailable in this environment.");
        return;
      }

      const ctx = new AudioContextCtor();
      try {
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        if (cancelled) return;
        const channelData = Array.from(
          { length: decoded.numberOfChannels },
          (_, index) => decoded.getChannelData(index),
        );
        const sampleCount = channelData[0]?.length ?? 0;
        const samplesPerBucket = Math.max(
          1,
          Math.ceil(sampleCount / Math.max(1, width)),
        );
        const pixelSecond = decoded.sampleRate / samplesPerBucket;
        const channels = summarizeWaveformChannels(
          channelData,
          decoded.sampleRate,
          pixelSecond,
        );
        const first = channels[0];
        if (first) {
          setPeaks({ min: first.min, max: first.max });
        } else {
          setStatus("No waveform data.");
        }
      } catch {
        if (!cancelled)
          setStatus("Could not decode this audio format for waveform display.");
      } finally {
        void ctx.close().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath, width]);

  useEffect(() => {
    if (!filePath) return;

    let rafId = 0;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas || width <= 0) return;
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) return;

      const dpr = window.devicePixelRatio || 1;
      const cssWidth = width;
      const cssHeight = canvas.clientHeight || 64;
      const backingWidth = Math.round(cssWidth * dpr);
      const backingHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;

      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, cssWidth, cssHeight);

      const currentPeaks = peaksRef.current;
      const mid = cssHeight / 2;
      if (currentPeaks && currentPeaks.min.length > 0) {
        ctx2d.strokeStyle = ZERO_LINE_COLOR;
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        ctx2d.moveTo(0, mid + 0.5);
        ctx2d.lineTo(cssWidth, mid + 0.5);
        ctx2d.stroke();
        drawWaveformEnvelope(ctx2d, currentPeaks, cssWidth, cssHeight);
      } else {
        ctx2d.fillStyle = PLACEHOLDER_COLOR;
        ctx2d.fillRect(0, mid - 1, cssWidth, 2);
      }

      const audio = audioRef.current;
      const dur = duration > 0 ? duration : (audio?.duration ?? 0);
      const current = audio?.currentTime ?? 0;
      if (dur > 0) {
        const ratio = Math.max(0, Math.min(1, current / dur));
        const x = ratio * cssWidth;
        ctx2d.strokeStyle = PLAYHEAD_COLOR;
        ctx2d.lineWidth = 1.5;
        ctx2d.beginPath();
        ctx2d.moveTo(x, 0);
        ctx2d.lineTo(x, cssHeight);
        ctx2d.stroke();
      }
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [filePath, width, duration, audioRef]);

  const seekFromClientX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const audio = audioRef.current;
    const dur = duration > 0 ? duration : (audio?.duration ?? 0);
    if (dur > 0) {
      onSeek(ratio * dur);
    }
  };

  const hasFile = Boolean(filePath);

  return (
    <div
      ref={containerRef}
      className="relative h-16 w-full select-none overflow-hidden rounded-sm border border-blue-border bg-black"
    >
      {hasFile ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ cursor: duration > 0 ? "pointer" : "default" }}
          onPointerDown={(event) => {
            if (duration <= 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            seekFromClientX(event.clientX);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-role-body text-blue-muted">
          No File Selected
        </div>
      )}
      {status && (
        <div className="absolute inset-0 flex items-center justify-center text-role-body text-amber-600">
          {status}
        </div>
      )}
    </div>
  );
}
