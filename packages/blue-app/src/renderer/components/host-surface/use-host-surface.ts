import { useCallback, useEffect, useRef, useState } from 'react';
import { computePosition, flip, offset, shift, size, type Placement } from '@floating-ui/dom';
import { useHostDocument } from '../../hooks/use-host-document';
import { containsNode, isNodeLike } from '../../utils/cross-realm-dom';
import {
  DEFAULT_SURFACE_GAP,
  DEFAULT_SURFACE_MARGIN,
  surfaceCloseOnHostScrollByKind,
  type HostAnchorRect,
  type HostSurfaceAnchor,
  type HostSurfaceDismissReason,
  type HostSurfaceOptions,
  type HostSurfaceSide,
  type PlacementResult,
} from './host-surface-options';

export type HostSurfacePhase = 'opening' | 'open' | 'closed';

export interface HostSurfaceSession {
  /** Document that hosts the surface; null in no-DOM environments (FR-011). */
  hostDocument: Document | null;
  phase: HostSurfacePhase;
  placement: PlacementResult | null;
  /** Ref callback for the surface root element (measured sizing source). */
  setSurfaceElement: (element: HTMLElement | null) => void;
  close: () => void;
}

interface FloatingReference {
  getBoundingClientRect: () => {
    x: number;
    y: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  ownerDocument?: Document | null;
}

function pointRect(x: number, y: number): HostAnchorRect {
  return { left: x, top: y, right: x, bottom: y, width: 0, height: 0 };
}

function toFloatingReference(
  anchor: HostSurfaceAnchor,
  hostDocument: Document | null,
): FloatingReference {
  if (anchor.type === 'element') {
    return anchor.element;
  }
  const getRect = anchor.type === 'rect' ? anchor.getRect : () => pointRect(anchor.x, anchor.y);
  return {
    // Floating UI re-reads this on every update, so rect/point anchors
    // follow points that move during drags (spec FR-005, SC-007).
    getBoundingClientRect: () => {
      const rect = getRect();
      return {
        x: rect.left,
        y: rect.top,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width ?? Math.max(0, rect.right - rect.left),
        height: rect.height ?? Math.max(0, rect.bottom - rect.top),
      };
    },
    ownerDocument: hostDocument,
  };
}

function preferredSide(options: HostSurfaceOptions): HostSurfaceSide {
  return options.placement ?? (options.kind === 'readout' ? 'right' : 'bottom');
}

/**
 * One placement/dismissal/lifecycle policy for hand-rolled workbench
 * surfaces (menus at pointer, tooltips, and SVG/canvas readouts), rendered
 * into whichever document hosts the panel content (spec FR-008).
 *
 * Radix surfaces must NOT use this hook — they use the Popout*Portal
 * wrappers (contracts/radix-surface-integration.md).
 */
export function useHostSurface(
  anchor: HostSurfaceAnchor | null,
  options: HostSurfaceOptions,
): HostSurfaceSession {
  const contextHostDocument = useHostDocument();
  // An explicit hostDocument (even null) overrides the panel context for
  // components that resolve their host from an anchor element's realm.
  const hostDocument =
    options.hostDocument !== undefined ? options.hostDocument : contextHostDocument;
  const hostWindow = hostDocument?.defaultView ?? null;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // compute() and the frame scheduler read the latest anchor/host through
  // refs so a scheduled update never captures a stale closure (SC-007).
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const hostDocumentRef = useRef(hostDocument);
  hostDocumentRef.current = hostDocument;

  const surfaceElRef = useRef<HTMLElement | null>(null);
  const dismissedRef = useRef(false);
  const pendingRef = useRef(false);
  const frameHandleRef = useRef<number | null>(null);
  const timerHandleRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  const [phase, setPhase] = useState<HostSurfacePhase>('closed');
  const [placement, setPlacement] = useState<PlacementResult | null>(null);

  const cancelScheduledUpdate = useCallback(() => {
    pendingRef.current = false;
    const view = hostDocumentRef.current?.defaultView ?? null;
    if (frameHandleRef.current != null && view) {
      view.cancelAnimationFrame(frameHandleRef.current);
    }
    if (timerHandleRef.current != null && view) {
      view.clearTimeout(timerHandleRef.current);
    }
    frameHandleRef.current = null;
    timerHandleRef.current = null;
  }, []);

  const compute = useCallback(() => {
    const element = surfaceElRef.current;
    const currentAnchor = anchorRef.current;
    const doc = hostDocumentRef.current;
    if (!element || !currentAnchor || !doc) {
      return;
    }
    const opts = optionsRef.current;
    const gap = opts.gap ?? DEFAULT_SURFACE_GAP;
    const margin = opts.margin ?? DEFAULT_SURFACE_MARGIN;
    const align = opts.align ?? 'start';
    const side = preferredSide(opts);
    // Floating UI expresses centered alignment as the bare side placement.
    const placement: Placement = align === 'center' ? side : `${side}-${align}`;
    const generation = ++generationRef.current;
    // This floating-ui version delivers size constraints only through the
    // `apply` callback (middlewareData.size stays empty); capture the last
    // invocation, which reflects the final placement after any rects reset.
    let availableHeight: number | null = null;

    void computePosition(toFloatingReference(currentAnchor, doc), element, {
      strategy: 'fixed',
      placement,
      middleware: [
        offset(gap),
        flip({ padding: margin }),
        shift({ padding: margin }),
        size({
          padding: margin,
          apply: ({ availableHeight: constrained }) => {
            availableHeight = constrained;
          },
        }),
      ],
    })
      .then((result) => {
        if (generation !== generationRef.current || dismissedRef.current) {
          return;
        }
        setPlacement({
          left: result.x,
          top: result.y,
          placement: result.placement.split('-')[0] as HostSurfaceSide,
          maxHeight:
            availableHeight != null && Number.isFinite(availableHeight) ? availableHeight : null,
        });
        setPhase((prev) => (prev === 'closed' ? prev : 'open'));
      })
      .catch(() => {
        // Measurement can throw in degenerate no-layout environments; the
        // surface simply never becomes visible rather than crashing the panel.
      });
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (pendingRef.current || dismissedRef.current) {
      return;
    }
    const view = hostDocumentRef.current?.defaultView ?? null;
    if (!view) {
      return;
    }
    pendingRef.current = true;
    const run = () => {
      pendingRef.current = false;
      if (dismissedRef.current) {
        return;
      }
      compute();
    };
    // Align updates to the HOST window's frame loop: at most one placement
    // per rendered frame (SC-007). JSDOM popout realms lack rAF; timers
    // keep tests deterministic.
    if (typeof view.requestAnimationFrame === 'function') {
      frameHandleRef.current = view.requestAnimationFrame(() => {
        frameHandleRef.current = null;
        run();
      });
    } else {
      timerHandleRef.current = view.setTimeout(() => {
        timerHandleRef.current = null;
        run();
      }, 0);
    }
  }, [compute]);

  const dismiss = useCallback(
    (reason: HostSurfaceDismissReason) => {
      if (dismissedRef.current) {
        return;
      }
      dismissedRef.current = true;
      cancelScheduledUpdate();
      generationRef.current += 1;
      setPhase('closed');
      optionsRef.current.onDismiss?.(reason);
    },
    [cancelScheduledUpdate],
  );

  const close = useCallback(() => {
    dismiss('caller');
  }, [dismiss]);

  // The lifecycle keys on the anchor's VALUE, not object identity: consumers
  // naturally rebuild anchor objects every render, and keying on identity
  // would reset placement after every position update and re-schedule in a
  // loop. Rect anchors are read here so a moved point re-measures; element
  // anchors keep their element identity; point anchors use their coords.
  let anchorKey: string | object | null = null;
  if (anchor) {
    if (anchor.type === 'point') {
      anchorKey = `point:${anchor.x},${anchor.y}`;
    } else if (anchor.type === 'element') {
      anchorKey = anchor.element;
    } else {
      const rect = anchor.getRect();
      anchorKey = `rect:${rect.left},${rect.top},${rect.right},${rect.bottom}`;
    }
  }

  // Null <-> anchored opens/closes the surface; a changed anchor value
  // re-measures in place, keeping the current placement visible until the
  // next frame lands (no hidden flash while a dragged point moves). A host
  // window change (panel floated/re-docked mid-interaction) rebinds every
  // listener and re-anchors instead of leaving stale visuals (SC-003).
  useEffect(() => {
    dismissedRef.current = false;
    generationRef.current += 1;
    cancelScheduledUpdate();
    if (anchorKey == null) {
      setPlacement(null);
      setPhase('closed');
      return () => {
        cancelScheduledUpdate();
      };
    }
    setPhase((prev) => (prev === 'closed' ? 'opening' : prev));
    scheduleUpdate();
    return () => {
      cancelScheduledUpdate();
    };
  }, [anchorKey, hostWindow, cancelScheduledUpdate, scheduleUpdate]);

  // True unmount only (empty deps): notify once, never on re-anchoring.
  useEffect(
    () => () => {
      if (!dismissedRef.current) {
        dismissedRef.current = true;
        optionsRef.current.onDismiss?.('host-unmount');
      }
    },
    [],
  );

  // Dismissal + follow listeners bind to the HOST window only; equivalent
  // input from unrelated documents never reaches them (FR-006).
  useEffect(() => {
    if (phase === 'closed' || !hostWindow) {
      return undefined;
    }

    const isInsideSurface = (target: EventTarget | null): boolean => {
      const element = surfaceElRef.current;
      return element != null && isNodeLike(target) && element.contains(target);
    };
    // The trigger toggles an element-anchored surface itself; presses on the
    // anchor are not "outside" (mirrors Radix trigger/DismissableLayer
    // coordination, where the trigger click closes via its own handler).
    const isInsideAnchor = (target: EventTarget | null): boolean => {
      const anchor = anchorRef.current;
      return anchor?.type === 'element' && containsNode(anchor.element, target);
    };

    const handleKeyDown = (event: Event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        dismiss('escape');
      }
    };
    const handlePointerDown = (event: Event) => {
      if (!isInsideSurface(event.target) && !isInsideAnchor(event.target)) {
        dismiss('outside-pointer');
      }
    };
    const handleScroll = (event: Event) => {
      // Scrolling inside the surface's own content never dismisses (FR-005).
      if (isInsideSurface(event.target)) {
        return;
      }
      if (
        surfaceCloseOnHostScrollByKind(
          optionsRef.current.kind,
          optionsRef.current.closeOnHostScroll,
        )
      ) {
        dismiss('host-scroll');
      } else {
        scheduleUpdate();
      }
    };
    const handleResize = () => {
      scheduleUpdate();
    };

    hostWindow.addEventListener('keydown', handleKeyDown);
    // Document-level too: keydown dispatched at the document (or synthetic
    // non-bubbling test events) never reaches the window listener.
    hostDocument.addEventListener('keydown', handleKeyDown);
    hostWindow.addEventListener('mousedown', handlePointerDown);
    hostWindow.addEventListener('pointerdown', handlePointerDown);
    hostWindow.addEventListener('scroll', handleScroll, true);
    hostWindow.addEventListener('resize', handleResize);
    return () => {
      hostWindow.removeEventListener('keydown', handleKeyDown);
      hostDocument.removeEventListener('keydown', handleKeyDown);
      hostWindow.removeEventListener('mousedown', handlePointerDown);
      hostWindow.removeEventListener('pointerdown', handlePointerDown);
      hostWindow.removeEventListener('scroll', handleScroll, true);
      hostWindow.removeEventListener('resize', handleResize);
    };
  }, [phase, hostDocument, hostWindow, dismiss, scheduleUpdate]);

  const setSurfaceElement = useCallback(
    (element: HTMLElement | null) => {
      surfaceElRef.current = element;
      if (element && !dismissedRef.current && anchorRef.current) {
        scheduleUpdate();
      }
    },
    [scheduleUpdate],
  );

  return { hostDocument, phase, placement, setSurfaceElement, close };
}
