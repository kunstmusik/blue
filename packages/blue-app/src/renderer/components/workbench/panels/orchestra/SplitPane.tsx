import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clampSplitSizePx,
  type SplitControlledPane,
  type SplitId,
  type SplitOrientation,
} from '../../../../../shared/window-layout-settings';
import { useLayoutSettingsStore } from '../../../../stores/layout-settings-store';
import { cn } from '../../../../lib/cn';

const HANDLE_SIZE = 12;
const KEYBOARD_STEP_PX = 24;

interface SplitPaneProps {
  orientation: SplitOrientation;
  first: React.ReactNode;
  second: React.ReactNode;
  ariaLabel: string;
  className?: string;
  firstClassName?: string;
  secondClassName?: string;
  separatorClassName?: string;
  separatorProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  /**
   * Legacy ratio-based initial split (0..1). Ignored when `splitId` is set.
   */
  initialSplit?: number;
  minFirstSize?: number;
  minSecondSize?: number;
  /**
   * Stable split identity. When set, the controlled-pane pixel size is
   * persisted and restored from the app-wide layout settings store instead of
   * local ratio state.
   */
  splitId?: SplitId;
  /**
   * Which pane the saved `sizePx` describes. Defaults to `first` to match the
   * Java Blue `setDividerLocation(200)` convention.
   */
  controlledPane?: SplitControlledPane;
  /**
   * Pixel size used when no saved value exists. Defaults to 200 to match the
   * Java Blue side/bottom 200px split defaults.
   */
  defaultSizePx?: number;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function getMainAxisSize(rect: DOMRectReadOnly, orientation: SplitOrientation): number {
  return orientation === 'horizontal' ? rect.width : rect.height;
}

function getPointerOffset(
  event: PointerEvent,
  rect: DOMRectReadOnly,
  orientation: SplitOrientation,
): number {
  return orientation === 'horizontal' ? event.clientX - rect.left : event.clientY - rect.top;
}

export default function SplitPane({
  orientation,
  first,
  second,
  ariaLabel,
  className,
  firstClassName,
  secondClassName,
  separatorClassName,
  separatorProps,
  initialSplit = 0.5,
  minFirstSize = 240,
  minSecondSize = 240,
  splitId,
  controlledPane = 'first',
  defaultSizePx = 200,
}: SplitPaneProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [containerSize, setContainerSize] = useState(0);

  const savedSplitLocation = useLayoutSettingsStore((s) =>
    splitId ? s.layout?.splits?.[splitId] : undefined,
  );

  const persistedSizePx =
    savedSplitLocation && Number.isFinite(savedSplitLocation.sizePx)
      ? savedSplitLocation.sizePx
      : defaultSizePx;

  const [controlledSizePx, setControlledSizePx] = useState<number>(persistedSizePx);
  const [splitRatio, setSplitRatio] = useState(() => {
    const ratio = initialSplit;
    if (ratio < 0.1) return 0.1;
    if (ratio > 0.9) return 0.9;
    return ratio;
  });

  // When the saved size changes (load/reset), update the local state.
  useEffect(() => {
    if (splitId && Number.isFinite(persistedSizePx)) {
      setControlledSizePx(persistedSizePx);
    }
  }, [splitId, persistedSizePx]);

  useIsomorphicLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setContainerSize(getMainAxisSize(rect, orientation));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [orientation]);

  useEffect(
    () => () => {
      dragCleanupRef.current?.();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    },
    [],
  );

  const availableSize = Math.max(containerSize - HANDLE_SIZE, 0);
  const maxFirstSize = Math.max(0, availableSize - minSecondSize);
  const minFirstBound = Math.max(0, Math.min(minFirstSize, maxFirstSize));
  const controlledMin =
    controlledPane === 'first'
      ? minFirstBound
      : Math.max(0, availableSize - maxFirstSize);
  const controlledMax =
    controlledPane === 'first'
      ? maxFirstSize
      : Math.max(0, availableSize - minFirstSize);

  // Choose the rendered first-pane size:
  //  - When splitId is set, derive from the persisted controlled-pane size and
  //    clamp for display only. Clamping never rewrites the saved value.
  //  - Otherwise fall back to the legacy ratio behavior.
  let firstSize: number;
  if (splitId) {
    const clampedControlled = clampSplitSizePx(controlledSizePx, controlledMin, controlledMax);
    firstSize =
      controlledPane === 'first'
        ? clampedControlled
        : Math.max(0, availableSize - clampedControlled);
    if (availableSize <= 0) firstSize = 0;
  } else {
    firstSize =
      availableSize > 0
        ? Math.min(Math.max(availableSize * splitRatio, minFirstBound), maxFirstSize)
        : 0;
  }

  const persistControlledSize = (nextControlledSize: number) => {
    if (!splitId) return;
    if (!Number.isFinite(nextControlledSize) || nextControlledSize <= 0) return;

    // Debounce so drag updates don't flood the main process.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void useLayoutSettingsStore.getState().updateSplitLocation(splitId, {
        orientation,
        controlledPane,
        sizePx: Math.round(nextControlledSize),
      });
      saveTimerRef.current = null;
    }, 150);
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!containerRef.current || dragCleanupRef.current) return;

    event.preventDefault();
    event.currentTarget.focus();

    const pointerId = event.pointerId;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    let onPointerMove: (moveEvent: PointerEvent) => void = () => {};

    const stopDragging = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      dragCleanupRef.current = null;
    };

    onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const element = containerRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const available = Math.max(getMainAxisSize(rect, orientation) - HANDLE_SIZE, 0);
      if (available <= 0) return;

      const pointerOffset = getPointerOffset(moveEvent, rect, orientation);
      const nextMaxFirstSize = Math.max(0, available - minSecondSize);
      const nextMinFirstSize = Math.max(0, Math.min(minFirstSize, nextMaxFirstSize));
      const nextFirstSize = Math.min(
        Math.max(pointerOffset, nextMinFirstSize),
        nextMaxFirstSize,
      );

      if (splitId) {
        const nextControlled =
          controlledPane === 'first'
            ? nextFirstSize
            : Math.max(0, available - nextFirstSize);
        setControlledSizePx(nextControlled);
        persistControlledSize(nextControlled);
      } else {
        setSplitRatio(nextFirstSize / available);
      }
    };

    dragCleanupRef.current = stopDragging;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (availableSize <= 0) return;

    const stepPx = event.shiftKey ? KEYBOARD_STEP_PX * 4 : KEYBOARD_STEP_PX;
    if (splitId) {
      let nextFirstSize: number | null = null;
      if (orientation === 'horizontal') {
        if (event.key === 'ArrowLeft') nextFirstSize = firstSize - stepPx;
        else if (event.key === 'ArrowRight') nextFirstSize = firstSize + stepPx;
      } else {
        if (event.key === 'ArrowUp') nextFirstSize = firstSize - stepPx;
        else if (event.key === 'ArrowDown') nextFirstSize = firstSize + stepPx;
      }
      if (event.key === 'Home') nextFirstSize = minFirstBound;
      if (event.key === 'End') nextFirstSize = maxFirstSize;
      if (nextFirstSize === null || !Number.isFinite(nextFirstSize)) return;

      const clampedFirstSize = clampSplitSizePx(nextFirstSize, minFirstBound, maxFirstSize);
      const nextControlled =
        controlledPane === 'first' ? clampedFirstSize : Math.max(0, availableSize - clampedFirstSize);
      const clampedControlledSize = clampSplitSizePx(nextControlled, controlledMin, controlledMax);
      setControlledSizePx(clampedControlledSize);
      persistControlledSize(clampedControlledSize);
      event.preventDefault();
      return;
    }

    const stepRatio = stepPx / availableSize;
    const nextRatio = (() => {
      if (orientation === 'horizontal') {
        if (event.key === 'ArrowLeft') return splitRatio - stepRatio;
        if (event.key === 'ArrowRight') return splitRatio + stepRatio;
      } else {
        if (event.key === 'ArrowUp') return splitRatio - stepRatio;
        if (event.key === 'ArrowDown') return splitRatio + stepRatio;
      }

      if (event.key === 'Home') return minFirstBound / availableSize;
      if (event.key === 'End') return maxFirstSize / availableSize;
      return null;
    })();

    if (nextRatio === null) return;

    event.preventDefault();
    setSplitRatio(Math.min(Math.max(nextRatio, minFirstBound / availableSize), maxFirstSize / availableSize));
  };

  const containerClasses = cn(
    'flex h-full min-h-0 w-full overflow-hidden',
    orientation === 'horizontal' ? 'flex-row' : 'flex-col',
    className
  );

  const accessibleControlledSize =
    controlledPane === 'first' ? firstSize : Math.max(0, availableSize - firstSize);
  const accessibleControlledMin = Math.min(controlledMin, controlledMax);
  const accessibleControlledMax = Math.max(controlledMin, controlledMax);

  const paneClasses = 'min-h-0 min-w-0 overflow-hidden';
  const firstPaneStyle =
    orientation === 'horizontal'
      ? { width: `${firstSize}px` }
      : { height: `${firstSize}px` };

  const handleClasses = cn(
    'group flex flex-none items-center justify-center border-blue-border bg-app-surface-strong transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent',
    orientation === 'horizontal' ? 'h-full w-3 cursor-col-resize' : 'h-3 w-full cursor-row-resize'
  );

  const handleGripClasses = cn(
    'rounded-full bg-blue-border/80 transition-colors group-hover:bg-blue-accent',
    orientation === 'horizontal' ? 'h-10 w-px' : 'h-px w-10'
  );

  const firstPaneDataset = splitId
    ? { 'data-split-pane': 'first', 'data-split-id': splitId }
    : { 'data-split-pane': 'first' };

  return (
    <div ref={containerRef} className={containerClasses}>
      <div
        className={cn(paneClasses, 'flex-none', firstClassName)}
        style={firstPaneStyle}
        {...firstPaneDataset}
      >
        {first}
      </div>
      <button
        {...separatorProps}
        type="button"
        role="separator"
        aria-label={ariaLabel}
        aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
        aria-valuemin={Math.round(accessibleControlledMin)}
        aria-valuemax={Math.round(accessibleControlledMax)}
        aria-valuenow={Math.round(accessibleControlledSize)}
        className={cn(handleClasses, separatorClassName)}
        onKeyDown={handleKeyDown}
        onPointerDown={startDrag}
      >
        <div className={handleGripClasses} />
      </button>
      <div className={cn(paneClasses, 'flex-1', secondClassName)}>
        {second}
      </div>
    </div>
  );
}
