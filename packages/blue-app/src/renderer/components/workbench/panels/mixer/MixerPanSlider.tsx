import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ChannelPositionMode } from '../../../../../shared/project-editor';
import { PopoutTooltipPortal } from '../../../../hooks/host-portals';
import { cn } from '../../../../lib/cn';

export interface MixerPanSliderProps {
  channelName?: string;
  pan: number; // 0..1, default 0.5
  /** Selects the audible law disclosed by the control's accessible name and tooltip. */
  positionMode?: ChannelPositionMode;
  disabled?: boolean;
  className?: string;
  onPreview?: (pan: number) => void;
  onCommit?: (pan: number) => void;
  onCancel?: () => void;
  onDoubleClickReset?: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToPlaces(val: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(val * factor) / factor;
}

export function formatPanDisplay(pan: number): string {
  const rounded = roundToPlaces(pan, 2);
  if (Math.abs(rounded - 0.5) < 0.005) return 'C';
  if (rounded < 0.5) {
    return `L${Math.round((0.5 - rounded) * 200)}`;
  }
  return `R${Math.round((rounded - 0.5) * 200)}`;
}

interface PanGesture {
  pointerId: number;
  startPan: number;
  currentPan: number;
  hasMoved: boolean;
  ownerWindow: Window;
  onWindowBlur: () => void;
}

export const MixerPanSlider = React.memo(function MixerPanSlider({
  channelName = 'Channel',
  pan = 0.5,
  positionMode = 'balance',
  disabled = false,
  className,
  onPreview,
  onCommit,
  onCancel,
  onDoubleClickReset,
}: MixerPanSliderProps): React.ReactElement {
  const [draftPan, setDraftPan] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const displayedPan = clamp(draftPan ?? pan, 0, 1);
  const displayValue = formatPanDisplay(displayedPan);
  const positionLaw = positionMode === 'pan' ? 'Mono Pan' : 'Stereo Balance';

  const dragSessionRef = useRef<PanGesture | null>(null);

  const removeWindowBlurListener = useCallback(
    (session: NonNullable<typeof dragSessionRef.current>) => {
      session.ownerWindow.removeEventListener('blur', session.onWindowBlur);
    },
    [],
  );

  const cancelDrag = useCallback(() => {
    const session = dragSessionRef.current;
    if (!session) return;
    removeWindowBlurListener(session);
    dragSessionRef.current = null;
    setDraftPan(null);
    setIsDragging(false);
    onCancel?.();
  }, [onCancel, removeWindowBlurListener]);

  useEffect(() => {
    return () => {
      if (dragSessionRef.current) {
        cancelDrag();
      }
    };
  }, [cancelDrag]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      if (disabled || e.button !== 0) return;
      if (dragSessionRef.current) return;

      e.stopPropagation();

      const target = e.currentTarget;
      const ownerDocument = target.ownerDocument || document;
      const ownerWindow = ownerDocument.defaultView || window;
      const startPan = clamp(pan, 0, 1);
      const onWindowBlur = () => cancelDrag();

      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback in test or detached environments.
      }

      dragSessionRef.current = {
        pointerId: e.pointerId,
        startPan,
        currentPan: startPan,
        hasMoved: false,
        ownerWindow,
        onWindowBlur,
      };
      ownerWindow.addEventListener('blur', onWindowBlur, { once: true });

      setIsDragging(true);
    },
    [cancelDrag, disabled, pan],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextPan = roundToPlaces(clamp(Number(e.currentTarget.value), 0, 1), 2);
      const session = dragSessionRef.current;
      if (!session) {
        onCommit?.(nextPan);
        return;
      }

      session.hasMoved = session.hasMoved || nextPan !== session.startPan;
      session.currentPan = nextPan;
      setDraftPan(nextPan);
      onPreview?.(nextPan);
    },
    [onCommit, onPreview],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      dragSessionRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback in test or detached environments.
      }
      removeWindowBlurListener(session);

      const finalPan = session.currentPan;
      const shouldCommit = session.hasMoved && finalPan !== session.startPan;
      setDraftPan(null);
      setIsDragging(false);
      if (shouldCommit) {
        onCommit?.(finalPan);
      } else {
        onCancel?.();
      }
    },
    [onCancel, onCommit, removeWindowBlurListener],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      cancelDrag();
    },
    [cancelDrag],
  );

  const handleLostPointerCapture = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      cancelDrag();
    },
    [cancelDrag],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDraftPan(null);
      if (onDoubleClickReset) {
        onDoubleClickReset();
      } else {
        onCommit?.(0.5);
      }
    },
    [disabled, onDoubleClickReset, onCommit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      let nextPan = displayedPan;
      const step = e.shiftKey ? 0.05 : 0.01;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        nextPan = clamp(displayedPan - step, 0, 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        nextPan = clamp(displayedPan + step, 0, 1);
      } else if (e.key === 'Home') {
        nextPan = 0;
      } else if (e.key === 'End') {
        nextPan = 1;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelDrag();
        return;
      } else {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const rounded = roundToPlaces(nextPan, 2);
      setDraftPan(null);
      onCommit?.(rounded);
    },
    [cancelDrag, disabled, displayedPan, onCommit],
  );

  const tooltipOpen = !disabled && (isHovered || isFocused || isDragging);

  return (
    <Tooltip.Provider delayDuration={0} skipDelayDuration={0}>
      <div
        className={cn(
          'mixer-pan-section flex flex-col items-center gap-0.5 px-1 py-1 select-none',
          disabled && 'opacity-40 pointer-events-none',
          className,
        )}
      >
        <Tooltip.Root open={tooltipOpen}>
          <div className="flex w-full items-center justify-center text-role-caption text-app-text-muted px-0.5">
            <span className="font-semibold">Pan</span>
          </div>
          <Tooltip.Trigger asChild>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={displayedPan}
              disabled={disabled}
              aria-label={`${channelName} ${positionLaw}`}
              aria-valuetext={`${positionLaw} ${displayValue} (${displayedPan.toFixed(2)})`}
              title={`${positionLaw} control`}
              className={cn(
                'mixer-pan-track relative w-full h-4 appearance-none rounded border border-app-border/40 bg-app-surface/80 cursor-pointer touch-none outline-none',
                'focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-hidden',
                '[&::-webkit-slider-runnable-track]:h-4 [&::-webkit-slider-runnable-track]:bg-transparent',
                '[&::-webkit-slider-thumb]:mt-0.5 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-xs [&::-webkit-slider-thumb]:bg-app-accent [&::-webkit-slider-thumb]:shadow-xs',
                '[&::-moz-range-track]:h-4 [&::-moz-range-track]:bg-transparent',
                '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:rounded-xs [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-app-accent [&::-moz-range-thumb]:shadow-xs',
                disabled && 'cursor-not-allowed',
              )}
              style={{
                backgroundImage:
                  'linear-gradient(to right, transparent calc(50% - 0.5px), var(--color-app-border) calc(50% - 0.5px), var(--color-app-border) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
              }}
              onChange={handleChange}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onLostPointerCapture={handleLostPointerCapture}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              onPointerEnter={() => setIsHovered(true)}
              onPointerOver={() => setIsHovered(true)}
              onPointerLeave={() => setIsHovered(false)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          </Tooltip.Trigger>
          <PopoutTooltipPortal>
            <Tooltip.Content
              className="bsb-tooltip-content"
              side="top"
              sideOffset={4}
              align="center"
              role="tooltip"
            >
              {positionLaw}: {displayValue} ({displayedPan.toFixed(2)})
              <Tooltip.Arrow className="bsb-tooltip-arrow" width={10} height={5} />
            </Tooltip.Content>
          </PopoutTooltipPortal>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  );
});
