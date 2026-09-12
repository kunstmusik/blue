import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHostDocument } from '../../../../hooks/use-host-document';
import { meterStore, MIN_DB, MAX_DB } from '../../../../stores/meter-store';
import { cn } from '../../../../lib/cn';
import type { MeterProfileKey } from '@blue/data';
import { getMeterProfile } from './meter-profiles';
import { getMeterTrackGeometry } from './meter-layout';

export interface MeterCanvasProps {
  stripId: string;
  isMaster?: boolean;
  channelCount?: number;
  width?: number;
  height?: number;
  className?: string;
  profileKey?: MeterProfileKey;
}

export const DEFAULT_METER_WIDTH = 12;
export const DEFAULT_METER_HEIGHT = 80;
const CLIP_BOX_Y = 3;
const CLIP_BOX_HEIGHT = 4;
const BAR_GAP = 1;
const PADDING = 1;

export function getMeterWidth(nchnls: number): number {
  if (nchnls <= 1) return 10;
  if (nchnls === 2) return 12;
  return Math.min(36, Math.max(12, 2 * PADDING + nchnls * 3 + (nchnls - 1) * BAR_GAP));
}

export const MeterCanvas = React.memo(function MeterCanvas({
  stripId,
  isMaster = false,
  channelCount: channelCountProp,
  width: widthProp,
  height: heightProp,
  className,
  profileKey,
}: MeterCanvasProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostDocument = useHostDocument({ fallbackToGlobal: true });
  const hostWindow = hostDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null);

  const [storeNchnls, setStoreNchnls] = useState(
    () => meterStore.getStripState(stripId)?.nchnls ?? channelCountProp ?? 2,
  );

  useEffect(() => {
    return meterStore.onBindingMapChange(() => {
      const currentNchnls = meterStore.getStripState(stripId)?.nchnls ?? 2;
      setStoreNchnls((prev) => (prev === currentNchnls ? prev : currentNchnls));
    });
  }, [stripId]);

  const width = widthProp ?? getMeterWidth(storeNchnls);
  const [measuredHeight, setMeasuredHeight] = useState(heightProp ?? DEFAULT_METER_HEIGHT);
  const height = heightProp ?? measuredHeight;

  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        isVisibleRef.current = entry.isIntersecting;
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

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
    meterStore.clearStrip(stripId);
  }, [stripId]);

  useEffect(() => {
    if (!hostWindow) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const profile = getMeterProfile(profileKey);
    const { trackTop: meterTop, trackHeight: meterHeight } = getMeterTrackGeometry(height);
    const minorTickFractions = profile.minorTicks
      .map((t) => profile.dbToFraction(t.db))
      .filter((f) => f > 0 && f < 1);
    const majorTickFractions = profile.majorTicks
      .map((t) => profile.dbToFraction(t.db))
      .filter((f) => f > 0 && f < 1);
    const zeroRefFraction =
      profile.zeroReferenceDb !== 0 ? profile.dbToFraction(profile.zeroReferenceDb) : null;

    let cachedGradient: CanvasGradient | null = null;
    let animFrameId: number | null = null;
    let wasParkedAtSilence = false;

    const draw = (nowMs: number) => {
      // Advance meterStore physics (guarded to run at most once per frame)
      meterStore.update(nowMs);

      // Skip off-screen rendering
      if (!isVisibleRef.current) {
        animFrameId = hostWindow.requestAnimationFrame(draw);
        return;
      }

      const stripState = meterStore.getStripState(stripId);
      const nchnls = stripState ? stripState.nchnls : storeNchnls;

      // Check if all channels are at silence floor and not clipped
      let isAllSilent = true;
      if (stripState) {
        for (let ch = 0; ch < nchnls; ch++) {
          if (
            (stripState.barLevels[ch] ?? -Infinity) > profile.minimumDb ||
            (stripState.peakHoldLevels[ch] ?? -Infinity) > profile.minimumDb ||
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
          cachedGradient = null;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        // Compute bar width and gap based on channel count and available width
        // Support subpixel bars so every channel fits strictly inside [PADDING, width - PADDING] without clipping
        let barGap = nchnls > 1 ? BAR_GAP : 0;
        let availableW = width - 2 * PADDING - (nchnls - 1) * barGap;

        if (availableW < nchnls * 1 && nchnls > 1) {
          barGap = Math.max(0, ((width - 2 * PADDING) * 0.1) / (nchnls - 1));
          availableW = width - 2 * PADDING - (nchnls - 1) * barGap;
        }

        const barW = Math.max(0.5, availableW / nchnls);

        // Create linear gradient from profile color stops
        if (!cachedGradient) {
          const gradient = ctx.createLinearGradient(0, meterTop + meterHeight, 0, meterTop);
          for (const stop of profile.colorStops) {
            gradient.addColorStop(stop.fraction, stop.color);
          }
          cachedGradient = gradient;
        }

        for (let ch = 0; ch < nchnls; ch++) {
          const x = PADDING + ch * (barW + barGap);

          // 1. Clip Box
          const isClipped = stripState?.clipFlags[ch] ?? false;
          ctx.fillStyle = isClipped ? '#ef4444' : '#27272a';
          ctx.fillRect(x, CLIP_BOX_Y, barW, CLIP_BOX_HEIGHT);

          // Non-color overload indicator: white notch inside clip box
          if (isClipped) {
            ctx.fillStyle = '#ffffff';
            const notchW = Math.max(1, Math.min(2, barW - 2));
            const notchX = x + Math.floor((barW - notchW) / 2);
            ctx.fillRect(notchX, CLIP_BOX_Y + 1, notchW, CLIP_BOX_HEIGHT - 2);
          }

          // 2. Track background
          ctx.fillStyle = '#18181b';
          ctx.fillRect(x, meterTop, barW, meterHeight);

          // 3. Ticks on track background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          for (const frac of minorTickFractions) {
            const tickY = Math.round(meterTop + meterHeight - frac * meterHeight);
            ctx.fillRect(x, tickY, barW, 1);
          }

          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          for (const frac of majorTickFractions) {
            const tickY = Math.round(meterTop + meterHeight - frac * meterHeight);
            ctx.fillRect(x, tickY, barW, 1);
          }

          // Reference mark highlight for K-systems
          if (zeroRefFraction !== null && zeroRefFraction > 0 && zeroRefFraction < 1) {
            const refY = Math.round(meterTop + meterHeight - zeroRefFraction * meterHeight);
            ctx.fillStyle = '#eab308';
            ctx.fillRect(x, refY, barW, 1.5);
          }

          // 4. Active RMS Bar
          const barDb = stripState?.barLevels[ch] ?? -Infinity;
          const barFrac = profile.dbToFraction(barDb);
          if (barFrac > 0) {
            const activeH = Math.round(barFrac * meterHeight);
            const activeY = meterTop + meterHeight - activeH;
            ctx.fillStyle = cachedGradient;
            ctx.fillRect(x, activeY, barW, activeH);
          }

          // 5. Peak Hold Marker
          const peakDb = stripState?.peakHoldLevels[ch] ?? -Infinity;
          const peakFrac = profile.dbToFraction(peakDb);
          if (peakFrac > 0) {
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
  }, [hostWindow, stripId, width, height, storeNchnls, profileKey]);

  const stripState = meterStore.getStripState(stripId);
  const isClipped = stripState?.clipFlags.some(Boolean) ?? false;

  return (
    <canvas
      ref={canvasRef}
      className={cn('meter-canvas block select-none cursor-pointer', className)}
      data-profile={profileKey}
      style={{ width, height }}
      onClick={handleClick}
      title={isClipped ? 'Level Meter (Clipped - click to clear)' : 'Level Meter (Click to clear)'}
      aria-label={`Level meter for ${stripId}${isClipped ? ', overload clipped' : ''}`}
    />
  );
});
