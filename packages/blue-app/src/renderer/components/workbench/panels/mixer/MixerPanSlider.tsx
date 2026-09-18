import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { calculateStereoPanEffectiveSpread, type StereoPanMode } from '@blue/data';
import type { ChannelPositionMode } from '../../../../../shared/project-editor';
import { PopoutTooltipPortal } from '../../../../hooks/host-portals';
import { cn } from '../../../../lib/cn';

export interface MixerPanSliderProps {
  channelName?: string;
  pan: number; // 0..1, default 0.5
  /** Selects the audible law disclosed by the control's accessible name and tooltip. */
  positionMode?: ChannelPositionMode;
  /** Stored stereo mode for two-bus channels: 'balance' | 'stereoPan' | 'dualPan' */
  stereoPanMode?: StereoPanMode;
  panWidth?: number; // 0..1, default 1.0
  dualPanLeft?: number; // 0..1, default 0.0
  dualPanRight?: number; // 0..1, default 1.0
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  onModeChange?: (mode: StereoPanMode) => void;
  // Position / Balance / Mono Pan
  onPreview?: (pan: number) => void;
  onCommit?: (pan: number) => void;
  onCancel?: () => void;
  onDoubleClickReset?: () => void;
  // Width
  onPreviewWidth?: (width: number) => void;
  onCommitWidth?: (width: number) => void;
  onCancelWidth?: () => void;
  onDoubleClickResetWidth?: () => void;
  // Dual Left
  onPreviewDualLeft?: (left: number) => void;
  onCommitDualLeft?: (left: number) => void;
  onCancelDualLeft?: () => void;
  onDoubleClickResetDualLeft?: () => void;
  // Dual Right
  onPreviewDualRight?: (right: number) => void;
  onCommitDualRight?: (right: number) => void;
  onCancelDualRight?: () => void;
  onDoubleClickResetDualRight?: () => void;
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

interface SliderGesture {
  pointerId: number;
  startVal: number;
  currentVal: number;
  hasMoved: boolean;
  ownerWindow: Window;
  onWindowBlur: () => void;
}

interface SingleSliderProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  disabled?: boolean;
  accessibleName: string;
  accessibleValueText: string;
  title: string;
  tooltipText?: string;
  formatTooltip?: (val: number) => string;
  centerNotch?: boolean;
  onPreview?: (val: number) => void;
  onCommit?: (val: number) => void;
  onCancel?: () => void;
  onDoubleClickReset?: () => void;
}

const SingleSlider = React.memo(function SingleSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue = 0.5,
  disabled = false,
  accessibleName,
  accessibleValueText,
  title,
  tooltipText,
  formatTooltip,
  centerNotch = false,
  onPreview,
  onCommit,
  onCancel,
  onDoubleClickReset,
}: SingleSliderProps): React.ReactElement {
  const [draftVal, setDraftVal] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const displayedVal = clamp(draftVal ?? value, min, max);
  const dragSessionRef = useRef<SliderGesture | null>(null);

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
    setDraftVal(null);
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
      const startVal = clamp(value, min, max);
      const onWindowBlur = () => cancelDrag();

      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback in test or detached environments.
      }

      dragSessionRef.current = {
        pointerId: e.pointerId,
        startVal,
        currentVal: startVal,
        hasMoved: false,
        ownerWindow,
        onWindowBlur,
      };
      ownerWindow.addEventListener('blur', onWindowBlur, { once: true });
      setIsDragging(true);
    },
    [cancelDrag, disabled, max, min, value],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextVal = roundToPlaces(clamp(Number(e.currentTarget.value), min, max), 2);
      const session = dragSessionRef.current;
      if (!session) {
        onCommit?.(nextVal);
        return;
      }

      session.hasMoved = session.hasMoved || nextVal !== session.startVal;
      session.currentVal = nextVal;
      setDraftVal(nextVal);
      onPreview?.(nextVal);
    },
    [max, min, onCommit, onPreview],
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

      const finalVal = session.currentVal;
      const shouldCommit = session.hasMoved && finalVal !== session.startVal;
      setDraftVal(null);
      setIsDragging(false);
      if (shouldCommit) {
        onCommit?.(finalVal);
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
      setDraftVal(null);
      if (onDoubleClickReset) {
        onDoubleClickReset();
      } else {
        onCommit?.(defaultValue);
      }
    },
    [defaultValue, disabled, onCommit, onDoubleClickReset],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      let nextVal = displayedVal;
      const stepVal = e.shiftKey ? 0.05 : 0.01;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        nextVal = clamp(displayedVal - stepVal, min, max);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        nextVal = clamp(displayedVal + stepVal, min, max);
      } else if (e.key === 'Home') {
        nextVal = min;
      } else if (e.key === 'End') {
        nextVal = max;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelDrag();
        return;
      } else {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const rounded = roundToPlaces(nextVal, 2);
      setDraftVal(null);
      onCommit?.(rounded);
    },
    [cancelDrag, disabled, displayedVal, max, min, onCommit],
  );

  const tooltipOpen = !disabled && (isHovered || isDragging);

  return (
    <div className="flex w-full items-center gap-1">
      {label && (
        <span className="text-role-subheadline font-mono text-app-text-muted select-none w-3.5 shrink-0 text-center">
          {label}
        </span>
      )}
      <Tooltip.Root open={tooltipOpen}>
        <Tooltip.Trigger asChild>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={displayedVal}
            disabled={disabled}
            aria-label={accessibleName}
            aria-valuetext={accessibleValueText}
            title={title}
            className={cn(
              'mixer-pan-track relative w-full h-4 appearance-none rounded border border-app-border/40 bg-app-surface/80 cursor-pointer touch-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-hidden',
              '[&::-webkit-slider-runnable-track]:h-4 [&::-webkit-slider-runnable-track]:bg-transparent',
              '[&::-webkit-slider-thumb]:mt-0.5 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-xs [&::-webkit-slider-thumb]:bg-app-accent [&::-webkit-slider-thumb]:shadow-xs',
              '[&::-moz-range-track]:h-4 [&::-moz-range-track]:bg-transparent',
              '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:rounded-xs [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-app-accent [&::-moz-range-thumb]:shadow-xs',
              disabled && 'cursor-not-allowed',
            )}
            style={
              centerNotch
                ? {
                    backgroundImage:
                      'linear-gradient(to right, transparent calc(50% - 0.5px), var(--color-app-border) calc(50% - 0.5px), var(--color-app-border) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                  }
                : undefined
            }
            onChange={handleChange}
            onInput={handleChange}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handleLostPointerCapture}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
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
            {formatTooltip ? formatTooltip(displayedVal) : tooltipText}
            <Tooltip.Arrow className="bsb-tooltip-arrow" width={10} height={5} />
          </Tooltip.Content>
        </PopoutTooltipPortal>
      </Tooltip.Root>
    </div>
  );
});

export const MixerPanSlider = React.memo(function MixerPanSlider({
  channelName = 'Channel',
  pan = 0.5,
  positionMode = 'balance',
  stereoPanMode = 'balance',
  panWidth = 1.0,
  dualPanLeft = 0.0,
  dualPanRight = 1.0,
  disabled = false,
  disabledReason,
  className,
  onModeChange,
  onPreview,
  onCommit,
  onCancel,
  onDoubleClickReset,
  onPreviewWidth,
  onCommitWidth,
  onCancelWidth,
  onDoubleClickResetWidth,
  onPreviewDualLeft,
  onCommitDualLeft,
  onCancelDualLeft,
  onDoubleClickResetDualLeft,
  onPreviewDualRight,
  onCommitDualRight,
  onCancelDualRight,
  onDoubleClickResetDualRight,
}: MixerPanSliderProps): React.ReactElement {
  const isMonoOnly = positionMode === 'pan';

  const effectiveSpread = calculateStereoPanEffectiveSpread(pan, panWidth);
  const effectiveWidth = 2.0 * effectiveSpread;
  const isNearEndpoint =
    stereoPanMode === 'stereoPan' && (pan < 0.1 || pan > 0.9 || effectiveWidth < panWidth - 0.01);

  return (
    <Tooltip.Provider delayDuration={0} skipDelayDuration={0}>
      <div
        className={cn(
          'mixer-pan-section flex flex-col items-center gap-1 px-1 py-1 select-none w-full',
          disabled && 'opacity-40 pointer-events-none',
          className,
        )}
      >
        {isMonoOnly || !onModeChange ? (
          <>
            <div className="flex w-full items-center justify-center text-role-caption text-app-text-muted px-0.5">
              <span className="font-semibold">Pan</span>
            </div>
            <SingleSlider
              value={pan}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.5}
              disabled={disabled}
              accessibleName={
                isMonoOnly ? `${channelName} Mono Pan` : `${channelName} Stereo Balance`
              }
              accessibleValueText={
                isMonoOnly
                  ? `Mono Pan ${formatPanDisplay(pan)} (${pan.toFixed(2)})`
                  : `Stereo Balance ${formatPanDisplay(pan)} (${pan.toFixed(2)})`
              }
              title={isMonoOnly ? 'Mono Pan control' : 'Stereo Balance control'}
              formatTooltip={(val) =>
                isMonoOnly
                  ? `Mono Pan: ${formatPanDisplay(val)} (${val.toFixed(2)})`
                  : `Stereo Balance: ${formatPanDisplay(val)} (${val.toFixed(2)})`
              }
              centerNotch={true}
              onPreview={onPreview}
              onCommit={onCommit}
              onCancel={onCancel}
              onDoubleClickReset={onDoubleClickReset}
            />
          </>
        ) : (
          <>
            <select
              aria-label={`${channelName} Pan Mode`}
              value={stereoPanMode}
              disabled={disabled}
              className={cn(
                'mixer-pan-mode-select w-full text-role-subheadline h-5 rounded border border-app-border/40 bg-app-surface/80 text-app-text px-1 outline-none cursor-pointer',
                'focus-visible:ring-1 focus-visible:ring-app-focus',
                disabled && 'cursor-not-allowed opacity-50',
              )}
              onChange={(e) => onModeChange?.(e.target.value as StereoPanMode)}
            >
              <option value="balance">Balance</option>
              <option value="stereoPan">Stereo Pan</option>
              <option value="dualPan">Dual Pan</option>
            </select>

            {stereoPanMode === 'balance' && (
              <SingleSlider
                value={pan}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.5}
                disabled={disabled}
                accessibleName={`${channelName} Stereo Balance`}
                accessibleValueText={`Stereo Balance ${formatPanDisplay(pan)} (${pan.toFixed(2)})`}
                title="Stereo Balance control"
                formatTooltip={(val) =>
                  `Stereo Balance: ${formatPanDisplay(val)} (${val.toFixed(2)})`
                }
                centerNotch={true}
                onPreview={onPreview}
                onCommit={onCommit}
                onCancel={onCancel}
                onDoubleClickReset={onDoubleClickReset}
              />
            )}

            {stereoPanMode === 'stereoPan' && (
              <>
                <SingleSlider
                  label="P"
                  value={pan}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.5}
                  disabled={disabled}
                  accessibleName={`${channelName} Stereo Pan Position`}
                  accessibleValueText={`Stereo Pan Position ${formatPanDisplay(pan)} (${pan.toFixed(2)})`}
                  title="Stereo Pan Position control"
                  formatTooltip={(val) =>
                    `Stereo Pan Position: ${formatPanDisplay(val)} (${val.toFixed(2)})`
                  }
                  centerNotch={true}
                  onPreview={onPreview}
                  onCommit={onCommit}
                  onCancel={onCancel}
                  onDoubleClickReset={onDoubleClickReset}
                />
                <SingleSlider
                  label="W"
                  value={panWidth}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={1.0}
                  disabled={disabled}
                  accessibleName={`${channelName} Stereo Pan Width`}
                  accessibleValueText={`Stereo Pan Width ${Math.round(panWidth * 100)}% (${panWidth.toFixed(2)})`}
                  title="Stereo Pan Width control"
                  formatTooltip={(val) =>
                    `Stereo Pan Width: ${Math.round(val * 100)}% (${val.toFixed(2)})`
                  }
                  centerNotch={false}
                  onPreview={onPreviewWidth}
                  onCommit={onCommitWidth}
                  onCancel={onCancelWidth}
                  onDoubleClickReset={onDoubleClickResetWidth}
                />
                {isNearEndpoint && (
                  <div
                    role="note"
                    aria-label={`${channelName} Effective Width`}
                    className="text-role-subheadline text-app-text-muted text-center"
                  >
                    Effective width: {Math.round(effectiveWidth * 100)}%
                  </div>
                )}
                <div
                  role="status"
                  aria-label="Peak warning"
                  className="text-role-subheadline text-amber-500/90 text-center truncate w-full"
                  title="Stereo Pan can sum signals and raise peaks"
                >
                  Stereo Pan can sum signals and raise peaks
                </div>
              </>
            )}

            {stereoPanMode === 'dualPan' && (
              <>
                <SingleSlider
                  label="L"
                  value={dualPanLeft}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.0}
                  disabled={disabled}
                  accessibleName={`${channelName} Dual Pan Left`}
                  accessibleValueText={`Dual Pan Left ${formatPanDisplay(dualPanLeft)} (${dualPanLeft.toFixed(2)})`}
                  title="Dual Pan Left control"
                  formatTooltip={(val) =>
                    `Dual Pan Left: ${formatPanDisplay(val)} (${val.toFixed(2)})`
                  }
                  centerNotch={true}
                  onPreview={onPreviewDualLeft}
                  onCommit={onCommitDualLeft}
                  onCancel={onCancelDualLeft}
                  onDoubleClickReset={onDoubleClickResetDualLeft}
                />
                <SingleSlider
                  label="R"
                  value={dualPanRight}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={1.0}
                  disabled={disabled}
                  accessibleName={`${channelName} Dual Pan Right`}
                  accessibleValueText={`Dual Pan Right ${formatPanDisplay(dualPanRight)} (${dualPanRight.toFixed(2)})`}
                  title="Dual Pan Right control"
                  formatTooltip={(val) =>
                    `Dual Pan Right: ${formatPanDisplay(val)} (${val.toFixed(2)})`
                  }
                  centerNotch={true}
                  onPreview={onPreviewDualRight}
                  onCommit={onCommitDualRight}
                  onCancel={onCancelDualRight}
                  onDoubleClickReset={onDoubleClickResetDualRight}
                />
                <div
                  role="status"
                  aria-label="Peak warning"
                  className="text-role-subheadline text-amber-500/90 text-center truncate w-full"
                  title="Dual Pan can sum signals and raise peaks"
                >
                  Dual Pan can sum signals and raise peaks
                </div>
              </>
            )}
          </>
        )}

        {disabled && disabledReason && (
          <div
            role="note"
            aria-label="Disabled reason"
            className="text-role-subheadline text-app-text-muted text-center"
          >
            {disabledReason}
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
});
