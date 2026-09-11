import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHostDocument } from '../../../../hooks/use-host-document';
import { meterStore, MIN_DB, MAX_DB } from '../../../../stores/meter-store';
import { cn } from '../../../../lib/cn';

export interface MeterCanvasProps {
  stripId: string;
  isMaster?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

const DEFAULT_METER_WIDTH = 12;
const DEFAULT_METER_HEIGHT = 80;
const CLIP_BOX_Y = 3;
const CLIP_BOX_HEIGHT = 4;
const METER_TRACK_TOP = 10;
const METER_BOTTOM_PADDING = 10;
const BAR_GAP = 1;
const PADDING = 1;

export function MeterCanvas({
  stripId,
  isMaster = false,
  width = DEFAULT_METER_WIDTH,
  height: heightProp,
  className,
}: MeterCanvasProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostDocument = useHostDocument({ fallbackToGlobal: true });
  const hostWindow = hostDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null);

  const [measuredHeight, setMeasuredHeight] = useState(heightProp ?? DEFAULT_METER_HEIGHT);
  const height = heightProp ?? measuredHeight;

  useEffect(() => {
    if (heightProp !== undefined) return;
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!container) return;

    const updateHeight = () => {
      const nextH = Math.max(40, Math.round(container.getBoundingClientRect().height));
      setMeasuredHeight((cur) => (cur === nextH ? cur : nextH));
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, [heightProp]);

  const handleClick = useCallback(() => {
    meterStore.clearClip(stripId);
  }, [stripId]);

  useEffect(() => {
    if (!hostWindow) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let animFrameId: number | null = null;
    let wasParkedAtSilence = false;

    const draw = (nowMs: number) => {
      // Advance meterStore physics
      meterStore.update(nowMs);

      const stripState = meterStore.getStripState(stripId);
      const nchnls = stripState ? stripState.nchnls : 2;

      // Check if all channels are at silence floor and not clipped
      let isAllSilent = true;
      if (stripState) {
        for (let ch = 0; ch < nchnls; ch++) {
          if (
            (stripState.barLevels[ch] ?? -Infinity) > MIN_DB ||
            (stripState.peakHoldLevels[ch] ?? -Infinity) > MIN_DB ||
            stripState.clipFlags[ch]
          ) {
            isAllSilent = false;
            break;
          }
        }
      }

      // Optimize: If silent on previous frame and still silent, skip redundant repainting
      if (isAllSilent && wasParkedAtSilence) {
        animFrameId = hostWindow.requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = hostWindow.devicePixelRatio || 1;
        const targetW = Math.round(width * dpr);
        const targetH = Math.round(height * dpr);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        const meterTop = METER_TRACK_TOP;
        const meterHeight = Math.max(0, height - METER_TRACK_TOP - METER_BOTTOM_PADDING);

        // Compute bar width based on channel count
        const availableW = Math.max(0, width - 2 * PADDING - (nchnls - 1) * BAR_GAP);
        const barW = Math.max(2, Math.floor(availableW / nchnls));

        // Create linear gradient for dB scale
        const gradient = ctx.createLinearGradient(0, meterTop + meterHeight, 0, meterTop);
        gradient.addColorStop(0.0, '#22c55e');
        gradient.addColorStop(0.727, '#22c55e'); // -12 dB
        gradient.addColorStop(0.864, '#eab308'); // -3 dB
        gradient.addColorStop(0.909, '#f97316'); // 0 dB
        gradient.addColorStop(1.0, '#ef4444'); // +6 dB

        const dbRange = MAX_DB - MIN_DB;

        for (let ch = 0; ch < nchnls; ch++) {
          const x = PADDING + ch * (barW + BAR_GAP);

          // 1. Clip Box
          const isClipped = stripState?.clipFlags[ch] ?? false;
          ctx.fillStyle = isClipped ? '#ef4444' : '#27272a';
          ctx.fillRect(x, CLIP_BOX_Y, barW, CLIP_BOX_HEIGHT);

          // 2. Track background
          ctx.fillStyle = '#18181b';
          ctx.fillRect(x, meterTop, barW, meterHeight);

          // 3. Active RMS Bar
          const barDb = stripState?.barLevels[ch] ?? -Infinity;
          if (barDb > MIN_DB) {
            const frac = Math.max(0, Math.min(1, (barDb - MIN_DB) / dbRange));
            const activeH = Math.round(frac * meterHeight);
            const activeY = meterTop + meterHeight - activeH;
            ctx.fillStyle = gradient;
            ctx.fillRect(x, activeY, barW, activeH);
          }

          // 4. Peak Hold Marker
          const peakDb = stripState?.peakHoldLevels[ch] ?? -Infinity;
          if (peakDb > MIN_DB) {
            const peakFrac = Math.max(0, Math.min(1, (peakDb - MIN_DB) / dbRange));
            const peakY = Math.round(meterTop + meterHeight - peakFrac * meterHeight);
            const clampedY = Math.max(meterTop, Math.min(meterTop + meterHeight - 1, peakY));
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, clampedY, barW, 1.5);
          }
        }

        ctx.restore();
      }

      wasParkedAtSilence = isAllSilent;
      animFrameId = hostWindow.requestAnimationFrame(draw);
    };

    animFrameId = hostWindow.requestAnimationFrame(draw);

    return () => {
      if (animFrameId !== null) {
        hostWindow.cancelAnimationFrame(animFrameId);
      }
    };
  }, [hostWindow, stripId, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('block select-none cursor-pointer', className)}
      style={{ width, height }}
      onClick={handleClick}
      title="Level Meter (Click to clear clip)"
    />
  );
}
