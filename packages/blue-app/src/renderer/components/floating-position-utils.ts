export interface FloatingAnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface FloatingSize {
  width: number;
  height: number;
}

export interface FloatingViewport extends FloatingSize {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface FloatingPosition {
  left: number;
  top: number;
  placement: 'top' | 'bottom';
}

export interface FloatingPositionOptions {
  gap?: number;
  margin?: number;
  align?: 'start' | 'center' | 'end';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/**
 * Positions a fixed popup next to an anchor without allowing it to leave the viewport.
 * Callers should apply the returned placement and keep the popup's contents scrollable.
 */
export function computeFloatingPosition(
  anchor: FloatingAnchorRect,
  popup: FloatingSize,
  viewport: FloatingViewport,
  options: FloatingPositionOptions = {},
): FloatingPosition {
  const gap = options.gap ?? 8;
  const margin = options.margin ?? 8;
  const leftBoundary = viewport.left ?? 0;
  const rightBoundary = viewport.right ?? viewport.width;
  const topBoundary = viewport.top ?? 0;
  const bottomBoundary = viewport.bottom ?? viewport.height;
  const availableBelow = bottomBoundary - anchor.bottom - gap - margin;
  const availableAbove = anchor.top - topBoundary - gap - margin;
  const placement = availableBelow >= popup.height || availableBelow >= availableAbove
    ? 'bottom'
    : 'top';
  const requestedTop = placement === 'bottom'
    ? anchor.bottom + gap
    : anchor.top - gap - popup.height;
  const requestedLeft = options.align === 'end'
    ? anchor.right - popup.width
    : options.align === 'center'
      ? (anchor.left + anchor.right - popup.width) / 2
      : anchor.left;

  return {
    left: clamp(requestedLeft, leftBoundary + margin, rightBoundary - popup.width - margin),
    top: clamp(requestedTop, topBoundary + margin, bottomBoundary - popup.height - margin),
    placement,
  };
}

/** Finds the nearest scroll viewport so a portaled popup does not cover a fixed footer. */
export function getFloatingViewport(anchor: HTMLElement): FloatingViewport {
  const fallback: FloatingViewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  let parent = anchor.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
    if (/(auto|scroll|overlay)/.test(overflow)) {
      const bounds = parent.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        return {
          ...fallback,
          left: Math.max(0, bounds.left),
          right: Math.min(window.innerWidth, bounds.right),
          top: Math.max(0, bounds.top),
          bottom: Math.min(window.innerHeight, bounds.bottom),
        };
      }
    }
    parent = parent.parentElement;
  }
  return fallback;
}
