import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export interface ScoreViewportPixelRange {
  startPx: number;
  endPx: number;
}

export interface ScoreViewportBeatBounds {
  visibleStartBeats?: number;
  visibleEndBeats?: number;
}

const DEFAULT_VIEWPORT_OVERSCAN_PX = 256;
const DEFAULT_VIEWPORT_HYSTERESIS_PX = 64;

/**
 * Imperative horizontal scroll and quantized viewport-range store used by ScorePanel
 * so scroll events move overlay lines and lazily update culled timeline children
 * without forcing top-level React state updates on every scroll frame.
 */
export interface ScoreViewportScrollStore {
  getScrollLeft: () => number;
  getViewportPixelRange: () => ScoreViewportPixelRange | null;
  setScrollLeft: (nextScrollLeft: number) => void;
  setContainerWidth: (nextContainerWidth: number) => void;
  subscribeScrollLeft: (listener: () => void) => () => void;
  subscribeViewportRange: (listener: () => void) => () => void;
}

function computeViewportPixelRange(
  scrollLeft: number,
  containerWidth: number,
  overscanPx: number,
): ScoreViewportPixelRange {
  const safeScrollLeft = Math.max(0, scrollLeft);
  return {
    startPx: safeScrollLeft - overscanPx,
    endPx: safeScrollLeft + containerWidth + overscanPx,
  };
}

/**
 * Create a per-panel store tracking exact horizontal scroll offset alongside a
 * buffered pixel range with hysteresis to avoid re-rendering culled canvases
 * during small continuous scrolls.
 */
export function createScoreViewportScrollStore(
  overscanPx = DEFAULT_VIEWPORT_OVERSCAN_PX,
  hysteresisPx = DEFAULT_VIEWPORT_HYSTERESIS_PX,
): ScoreViewportScrollStore {
  let scrollLeft = 0;
  let containerWidth = 0;
  let viewportPixelRange: ScoreViewportPixelRange | null = null;
  let lastRangeContainerWidth = 0;

  const scrollListeners = new Set<() => void>();
  const rangeListeners = new Set<() => void>();

  const notifyScroll = () => {
    for (const listener of scrollListeners) {
      listener();
    }
  };

  const notifyRange = () => {
    for (const listener of rangeListeners) {
      listener();
    }
  };

  const syncViewportRange = () => {
    if (containerWidth <= 0) {
      if (viewportPixelRange !== null) {
        viewportPixelRange = null;
        lastRangeContainerWidth = 0;
        notifyRange();
      }
      return;
    }

    const safeScrollLeft = Math.max(0, scrollLeft);
    const shouldRecompute =
      viewportPixelRange === null ||
      safeScrollLeft < viewportPixelRange.startPx + hysteresisPx ||
      safeScrollLeft + containerWidth > viewportPixelRange.endPx - hysteresisPx ||
      Math.abs(containerWidth - lastRangeContainerWidth) >= hysteresisPx;

    if (!shouldRecompute) {
      return;
    }

    viewportPixelRange = computeViewportPixelRange(safeScrollLeft, containerWidth, overscanPx);
    lastRangeContainerWidth = containerWidth;
    notifyRange();
  };

  return {
    getScrollLeft: () => scrollLeft,
    getViewportPixelRange: () => viewportPixelRange,
    setScrollLeft: (nextScrollLeft: number) => {
      const normalized = Number.isFinite(nextScrollLeft) ? nextScrollLeft : 0;
      if (normalized === scrollLeft) {
        return;
      }
      scrollLeft = normalized;
      notifyScroll();
      syncViewportRange();
    },
    setContainerWidth: (nextContainerWidth: number) => {
      const normalized =
        Number.isFinite(nextContainerWidth) && nextContainerWidth > 0 ? nextContainerWidth : 0;
      if (normalized === containerWidth) {
        return;
      }
      containerWidth = normalized;
      syncViewportRange();
    },
    subscribeScrollLeft: (listener: () => void) => {
      scrollListeners.add(listener);
      return () => {
        scrollListeners.delete(listener);
      };
    },
    subscribeViewportRange: (listener: () => void) => {
      rangeListeners.add(listener);
      return () => {
        rangeListeners.delete(listener);
      };
    },
  };
}

const ScoreViewportScrollContext = createContext<ScoreViewportScrollStore | null>(null);

const NOOP_SUBSCRIBE = () => () => {};
const ZERO_SCROLL = () => 0;
const NULL_RANGE = (): ScoreViewportPixelRange | null => null;

/** Provide a ScoreViewportScrollStore to leaf overlays and culled timeline canvases. */
export function ScoreViewportScrollProvider({
  store,
  children,
}: {
  store: ScoreViewportScrollStore;
  children: ReactNode;
}) {
  return createElement(ScoreViewportScrollContext.Provider, { value: store }, children);
}

/**
 * Subscribe to exact horizontal scroll offset unless an explicit `scrollLeft` prop
 * is supplied by the caller or test harness.
 */
export function useScoreViewportScrollLeft(explicitScrollLeft?: number): number {
  const store = useContext(ScoreViewportScrollContext);
  const useExternalStore = explicitScrollLeft === undefined && store !== null;
  const subscribedScrollLeft = useSyncExternalStore(
    useExternalStore ? store.subscribeScrollLeft : NOOP_SUBSCRIBE,
    useExternalStore ? store.getScrollLeft : ZERO_SCROLL,
    ZERO_SCROLL,
  );
  return explicitScrollLeft ?? subscribedScrollLeft;
}

/**
 * Resolve visible beat bounds for timeline culling. Explicit bounds take precedence
 * over the buffered scroll context so standalone component usages remain deterministic.
 */
export function useScoreViewportBounds(
  pixelsPerBeat: number,
  explicitStartBeats?: number,
  explicitEndBeats?: number,
): ScoreViewportBeatBounds {
  const store = useContext(ScoreViewportScrollContext);
  const hasExplicitBounds = explicitStartBeats !== undefined || explicitEndBeats !== undefined;
  const useExternalStore = !hasExplicitBounds && store !== null;
  const range = useSyncExternalStore(
    useExternalStore ? store.subscribeViewportRange : NOOP_SUBSCRIBE,
    useExternalStore ? store.getViewportPixelRange : NULL_RANGE,
    NULL_RANGE,
  );

  return useMemo(() => {
    if (hasExplicitBounds) {
      return {
        visibleStartBeats: explicitStartBeats,
        visibleEndBeats: explicitEndBeats,
      };
    }
    if (!range || pixelsPerBeat <= 0) {
      return {};
    }
    return {
      visibleStartBeats: range.startPx / pixelsPerBeat,
      visibleEndBeats: range.endPx / pixelsPerBeat,
    };
  }, [hasExplicitBounds, explicitStartBeats, explicitEndBeats, range, pixelsPerBeat]);
}
