import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../../../lib/cn';
import {
  fractionToGainDb,
  gainDbToFraction,
  MAX_GAIN_DB,
  MIN_GAIN_DB,
  UNITY_GAIN_DB,
  UNITY_TRAVEL_FRACTION,
} from './fader-taper';

export interface MixerLevelSliderProps {
  channelName?: string;
  levelDb: number;
  sliderHeight?: number;
  disabled?: boolean;
  className?: string;
  onPreview?: (levelDb: number) => void;
  onCommit?: (levelDb: number) => void;
  onCancel?: () => void;
  onDoubleClickReset?: () => void;
}

const MIN_CONTROL_HEIGHT = 60;
const FADER_WIDTH = 24;
const CAP_WIDTH = 22;
const CAP_HEIGHT = 10;
const CAP_CENTER_INSET = 12;

function roundToPlaces(val: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(val * factor) / factor;
}

function normalizeKeyboardStep(current: number, step: number): number {
  const raw = current + step;
  const clamped = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, raw));
  return roundToPlaces(clamped, 4);
}

export const MixerLevelSlider = React.memo(function MixerLevelSlider({
  channelName,
  levelDb,
  sliderHeight = MIN_CONTROL_HEIGHT,
  disabled = false,
  className,
  onPreview,
  onCommit,
  onCancel,
  onDoubleClickReset,
}: MixerLevelSliderProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const effectiveHeight = Math.max(MIN_CONTROL_HEIGHT, sliderHeight);
  const usableTravel = Math.max(1, effectiveHeight - 2 * CAP_CENTER_INSET);

  // Local draft state for active dragging
  const [draftGainDb, setDraftGainDb] = useState<number | null>(null);

  // Drag session ref to track pointer gesture
  const dragSessionRef = useRef<{
    pointerId: number;
    startY: number;
    startFraction: number;
    startGainDb: number;
    currentGainDb: number;
    initialHeight: number;
    hasMoved: boolean;
    ownerDocument: Document;
    ownerWindow: Window;
  } | null>(null);

  const displayedGainDb = draftGainDb ?? levelDb;
  const currentFraction = gainDbToFraction(displayedGainDb);
  const capCenterY = CAP_CENTER_INSET + (1 - currentFraction) * usableTravel;
  const unityCenterY = CAP_CENTER_INSET + (1 - UNITY_TRAVEL_FRACTION) * usableTravel;

  const cancelDrag = useCallback(() => {
    const session = dragSessionRef.current;
    if (!session) return;
    dragSessionRef.current = null;
    setDraftGainDb(null);
    onCancel?.();
  }, [onCancel]);

  // Cancel drag if height changes during active drag
  useEffect(() => {
    const session = dragSessionRef.current;
    if (session && session.initialHeight !== effectiveHeight) {
      cancelDrag();
    }
  }, [effectiveHeight, cancelDrag]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragSessionRef.current) {
        cancelDrag();
      }
    };
  }, [cancelDrag]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      if (dragSessionRef.current) return; // Ignore second pointer

      e.preventDefault();
      const target = e.currentTarget;
      target.focus();

      const ownerDocument = target.ownerDocument || document;
      const ownerWindow = ownerDocument.defaultView || window;

      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback in test or detached environment
      }

      dragSessionRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startFraction: gainDbToFraction(levelDb),
        startGainDb: levelDb,
        currentGainDb: levelDb,
        initialHeight: effectiveHeight,
        hasMoved: false,
        ownerDocument,
        ownerWindow,
      };

      setDraftGainDb(levelDb);

      const onWindowBlur = () => {
        cancelDrag();
      };
      ownerWindow.addEventListener('blur', onWindowBlur, { once: true });
    },
    [disabled, levelDb, effectiveHeight, cancelDrag],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dy = session.startY - e.clientY;
      if (dy === 0) {
        session.currentGainDb = session.startGainDb;
        setDraftGainDb(session.startGainDb);
        onPreview?.(session.startGainDb);
        return;
      }

      session.hasMoved = true;
      const candidateFraction = Math.max(0, Math.min(1, session.startFraction + dy / usableTravel));
      const rawDb = fractionToGainDb(candidateFraction);
      const candidateDb = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, roundToPlaces(rawDb, 2)));

      session.currentGainDb = candidateDb;
      setDraftGainDb(candidateDb);
      onPreview?.(candidateDb);
    },
    [usableTravel, onPreview],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }

      dragSessionRef.current = null;
      setDraftGainDb(null);

      if (session.hasMoved && session.currentGainDb !== session.startGainDb) {
        onCommit?.(session.currentGainDb);
      } else {
        onCancel?.();
      }
    },
    [onCommit, onCancel],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      cancelDrag();
    },
    [cancelDrag],
  );

  const handleLostPointerCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      cancelDrag();
    },
    [cancelDrag],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      if (e.key === 'Escape') {
        if (dragSessionRef.current) {
          e.preventDefault();
          cancelDrag();
        }
        return;
      }

      let step = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        step = e.shiftKey ? 1.0 : 0.1;
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        step = e.shiftKey ? -1.0 : -0.1;
      } else if (e.key === 'PageUp') {
        step = 1.0;
      } else if (e.key === 'PageDown') {
        step = -1.0;
      } else if (e.key === 'Home') {
        e.preventDefault();
        onCommit?.(MIN_GAIN_DB);
        return;
      } else if (e.key === 'End') {
        e.preventDefault();
        onCommit?.(MAX_GAIN_DB);
        return;
      }

      if (step !== 0) {
        e.preventDefault();
        e.stopPropagation();
        const nextVal = normalizeKeyboardStep(levelDb, step);
        if (nextVal !== levelDb) {
          onCommit?.(nextVal);
        }
      }
    },
    [disabled, levelDb, cancelDrag, onCommit],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      if (onDoubleClickReset) {
        onDoubleClickReset();
      } else {
        onCommit?.(UNITY_GAIN_DB);
      }
    },
    [disabled, onDoubleClickReset, onCommit],
  );

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={channelName ? `Gain for ${channelName}` : 'Gain'}
      aria-orientation="vertical"
      aria-valuemin={MIN_GAIN_DB}
      aria-valuemax={MAX_GAIN_DB}
      aria-valuenow={displayedGainDb}
      aria-valuetext={`${displayedGainDb.toFixed(2)} dB`}
      aria-disabled={disabled ? 'true' : undefined}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'mixer-level-slider-wrapper relative select-none outline-none cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
      style={{
        width: FADER_WIDTH,
        minWidth: FADER_WIDTH,
        maxWidth: FADER_WIDTH,
        height: effectiveHeight,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
    >
      <svg
        width={FADER_WIDTH}
        height={effectiveHeight}
        className="overflow-visible pointer-events-none"
      >
        <defs>
          <linearGradient id="mixer-fader-cap-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-app-text-bright)" />
            <stop offset="35%" stopColor="var(--color-app-text-soft)" />
            <stop offset="100%" stopColor="var(--color-app-text-muted)" />
          </linearGradient>
        </defs>

        {/* Fader Track Line */}
        <line
          x1={FADER_WIDTH / 2}
          y1={CAP_CENTER_INSET}
          x2={FADER_WIDTH / 2}
          y2={effectiveHeight - CAP_CENTER_INSET}
          stroke="currentColor"
          className="text-blue-border/70"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Unity Tick (0 dB) */}
        <line
          x1={FADER_WIDTH / 2 - 5}
          y1={unityCenterY}
          x2={FADER_WIDTH / 2 + 5}
          y2={unityCenterY}
          stroke="currentColor"
          className="mixer-fader-unity-tick"
          strokeWidth={1}
        />

        {/* Rectangular Fader Cap */}
        <rect
          x={(FADER_WIDTH - CAP_WIDTH) / 2}
          y={capCenterY - CAP_HEIGHT / 2}
          width={CAP_WIDTH}
          height={CAP_HEIGHT}
          rx={1.5}
          className="mixer-fader-cap"
          strokeWidth={1}
        />

        {/* Center Line on Cap */}
        <line
          x1={(FADER_WIDTH - CAP_WIDTH) / 2 + 2}
          y1={capCenterY}
          x2={(FADER_WIDTH + CAP_WIDTH) / 2 - 2}
          y2={capCenterY}
          stroke="currentColor"
          className="mixer-fader-cap-line"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
});
