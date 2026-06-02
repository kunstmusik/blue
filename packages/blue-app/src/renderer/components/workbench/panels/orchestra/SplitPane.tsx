import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const HANDLE_SIZE = 12;
const KEYBOARD_STEP_PX = 24;

type SplitOrientation = 'horizontal' | 'vertical';

interface SplitPaneProps {
  orientation: SplitOrientation;
  first: React.ReactNode;
  second: React.ReactNode;
  ariaLabel: string;
  className?: string;
  firstClassName?: string;
  secondClassName?: string;
  initialSplit?: number;
  minFirstSize?: number;
  minSecondSize?: number;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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
  initialSplit = 0.5,
  minFirstSize = 240,
  minSecondSize = 240,
}: SplitPaneProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [containerSize, setContainerSize] = useState(0);
  const [splitRatio, setSplitRatio] = useState(() => clamp(initialSplit, 0.1, 0.9));

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
    },
    [],
  );

  const availableSize = Math.max(containerSize - HANDLE_SIZE, 0);
  const maxFirstSize = Math.max(0, availableSize - minSecondSize);
  const minFirstBound = Math.max(0, Math.min(minFirstSize, maxFirstSize));
  const firstSize =
    availableSize > 0 ? clamp(availableSize * splitRatio, minFirstBound, maxFirstSize) : 0;

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
      const nextFirstSize = clamp(pointerOffset, nextMinFirstSize, nextMaxFirstSize);

      setSplitRatio(nextFirstSize / available);
    };

    dragCleanupRef.current = stopDragging;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (availableSize <= 0) return;

    const stepRatio = (event.shiftKey ? KEYBOARD_STEP_PX * 4 : KEYBOARD_STEP_PX) / availableSize;
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
    setSplitRatio(clamp(nextRatio, minFirstBound / availableSize, maxFirstSize / availableSize));
  };

  const containerClasses = [
    'flex h-full min-h-0 w-full overflow-hidden',
    orientation === 'horizontal' ? 'flex-row' : 'flex-col',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const paneClasses = 'min-h-0 min-w-0 overflow-hidden';
  const firstPaneStyle =
    orientation === 'horizontal'
      ? { width: `${firstSize}px` }
      : { height: `${firstSize}px` };

  const handleClasses = [
    'group flex flex-none items-center justify-center border-blue-border bg-app-surface-strong transition-colors hover:bg-app-hover',
    orientation === 'horizontal' ? 'h-full w-3 cursor-col-resize' : 'h-3 w-full cursor-row-resize',
  ]
    .filter(Boolean)
    .join(' ');

  const handleGripClasses = [
    'rounded-full bg-blue-border/80 transition-colors group-hover:bg-blue-accent',
    orientation === 'horizontal' ? 'h-10 w-px' : 'h-px w-10',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className={containerClasses}>
      <div className={[paneClasses, 'flex-none', firstClassName].filter(Boolean).join(' ')} style={firstPaneStyle}>
        {first}
      </div>
      <button
        type="button"
        role="separator"
        aria-label={ariaLabel}
        aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
        className={handleClasses}
        onKeyDown={handleKeyDown}
        onPointerDown={startDrag}
      >
        <div className={handleGripClasses} />
      </button>
      <div className={[paneClasses, 'flex-1', secondClassName].filter(Boolean).join(' ')}>
        {second}
      </div>
    </div>
  );
}