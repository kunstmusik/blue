/**
 * Host gesture lifetime and listener helper.
 *
 * Provides a narrow listener and disposer lifecycle for active-window movement,
 * release, capture-phase owned Escape, blur, and pointer cancellation.
 *
 * Rules (contracts/gestures-and-history.md):
 * - Attach only while an actual gesture is active; dispose with matching capture options.
 * - Capture-phase Escape acts only when the active caller owns it, before workspace stop.
 *   Consume an owned cancellation and leave unrelated keys/surface ownership intact.
 * - Exactly one terminal callback wins. Remove active listeners and revoke input
 *   synchronously before awaiting a commit/cancel receipt.
 * - Pure DOM helper: no store, history, geometry, settings, or process imports.
 */

export type HostGestureStreamKind = 'mouse' | 'pointer';

export type HostGestureTerminalReason = 'release' | 'escape' | 'blur' | 'cancel';

export interface HostGestureOptions {
  /**
   * Press-time host target: Window, Document, or Element.
   */
  host?: Window | Document | Element | null;
  /** Explicit host document if separate. */
  hostDocument?: Document | null;
  /** Explicit host window if separate. */
  hostWindow?: Window | null;

  /** Stream kind: 'mouse' (default) or 'pointer'. */
  kind?: HostGestureStreamKind;

  /** Optional pointer identity for pointer event filtering. */
  pointerId?: number;

  /** Whether movement and release listeners use capture phase. Defaults to false. */
  capture?: boolean;

  /**
   * Predicate determining if Escape key is owned by this gesture.
   * If omitted, defaults to true whenever an onEscape or onTerminal callback is provided.
   */
  ownsEscape?: (event: KeyboardEvent) => boolean;

  /** Called during movement (mousemove or pointermove). */
  onMove?: (event: MouseEvent | PointerEvent) => void;

  /** Called on release (mouseup or pointerup). Terminal. */
  onRelease?: (event: MouseEvent | PointerEvent) => void;

  /** Called on capture-phase Escape keydown. Terminal. */
  onEscape?: (event: KeyboardEvent) => void;

  /** Called when the host window loses blur. Terminal. */
  onBlur?: (event: FocusEvent) => void;

  /** Called on pointer cancellation (pointercancel). Terminal. */
  onCancel?: (event: PointerEvent | Event) => void;

  /** Unified callback invoked when any terminal event wins. */
  onTerminal?: (reason: HostGestureTerminalReason, event: Event) => void;
}

export type HostGestureDisposer = () => void;

function isPointerEvent(event: Event): event is PointerEvent {
  return typeof (event as PointerEvent).pointerId === 'number';
}

function resolveHost(options: HostGestureOptions): {
  hostWindow: Window | null;
  hostDocument: Document | null;
} {
  let hostWindow: Window | null = options.hostWindow ?? null;
  let hostDocument: Document | null = options.hostDocument ?? null;

  if (options.host) {
    const h = options.host;
    if (typeof (h as Window).window === 'object' && typeof (h as Window).document === 'object') {
      hostWindow = hostWindow ?? (h as Window);
      hostDocument = hostDocument ?? (h as Window).document;
    } else if (typeof (h as Document).defaultView !== 'undefined') {
      hostDocument = hostDocument ?? (h as Document);
      hostWindow = hostWindow ?? (h as Document).defaultView;
    } else if (typeof (h as HTMLElement).ownerDocument === 'object') {
      hostDocument = hostDocument ?? (h as HTMLElement).ownerDocument;
      hostWindow = hostWindow ?? (h as HTMLElement).ownerDocument?.defaultView ?? null;
    }
  }

  if (!hostWindow && hostDocument?.defaultView) {
    hostWindow = hostDocument.defaultView;
  }
  if (!hostDocument && hostWindow?.document) {
    hostDocument = hostWindow.document;
  }

  if (!hostWindow && typeof window !== 'undefined') {
    hostWindow = window;
  }
  if (!hostDocument && typeof document !== 'undefined') {
    hostDocument = document;
  }

  return { hostWindow, hostDocument };
}

/**
 * Attaches host window/document listeners for an active gesture.
 * Returns an idempotent disposer function.
 */
export function attachHostGesture(options: HostGestureOptions): HostGestureDisposer {
  const { hostWindow, hostDocument } = resolveHost(options);
  const streamKind = options.kind ?? 'mouse';
  const captureOption = options.capture ?? false;

  let terminated = false;

  const moveEventType = streamKind === 'pointer' ? 'pointermove' : 'mousemove';
  const releaseEventType = streamKind === 'pointer' ? 'pointerup' : 'mouseup';
  const cancelEventType = 'pointercancel';

  const moveListenerTarget: EventTarget | null = hostWindow ?? hostDocument;
  const keydownTargets: EventTarget[] = [];
  if (hostWindow) keydownTargets.push(hostWindow);
  if (
    hostDocument &&
    hostDocument !== (hostWindow as unknown as { document?: Document })?.document
  ) {
    keydownTargets.push(hostDocument);
  } else if (hostDocument && keydownTargets.length === 0) {
    keydownTargets.push(hostDocument);
  }

  // Define handlers
  const handleMove = (event: Event) => {
    if (terminated) return;
    if (
      options.pointerId !== undefined &&
      isPointerEvent(event) &&
      event.pointerId !== options.pointerId
    ) {
      return;
    }
    options.onMove?.(event as MouseEvent | PointerEvent);
  };

  const handleRelease = (event: Event) => {
    if (terminated) return;
    if (
      options.pointerId !== undefined &&
      isPointerEvent(event) &&
      event.pointerId !== options.pointerId
    ) {
      return;
    }
    terminate('release', event, () => {
      options.onRelease?.(event as MouseEvent | PointerEvent);
    });
  };

  const handlePointerCancel = (event: Event) => {
    if (terminated) return;
    if (
      options.pointerId !== undefined &&
      isPointerEvent(event) &&
      event.pointerId !== options.pointerId
    ) {
      return;
    }
    terminate('cancel', event, () => {
      options.onCancel?.(event as PointerEvent | Event);
    });
  };

  const handleBlur = (event: Event) => {
    if (terminated) return;
    terminate('blur', event, () => {
      options.onBlur?.(event as FocusEvent);
    });
  };

  const handleKeyDown = (event: Event) => {
    if (terminated) return;
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== 'Escape') {
      return;
    }

    const owns = options.ownsEscape
      ? options.ownsEscape(keyEvent)
      : Boolean(options.onEscape || options.onTerminal);

    if (!owns) {
      return;
    }

    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    keyEvent.stopImmediatePropagation?.();

    terminate('escape', keyEvent, () => {
      options.onEscape?.(keyEvent);
    });
  };

  const removeAllListeners = () => {
    if (moveListenerTarget) {
      moveListenerTarget.removeEventListener(moveEventType, handleMove, captureOption);
      moveListenerTarget.removeEventListener(releaseEventType, handleRelease, captureOption);
      moveListenerTarget.removeEventListener(cancelEventType, handlePointerCancel, captureOption);
    }

    if (hostWindow) {
      hostWindow.removeEventListener('blur', handleBlur, false);
    }

    for (const target of keydownTargets) {
      target.removeEventListener('keydown', handleKeyDown, true);
    }
  };

  function terminate(
    reason: HostGestureTerminalReason,
    event: Event,
    specificCallback?: () => void,
  ): void {
    if (terminated) return;
    terminated = true;
    removeAllListeners();
    specificCallback?.();
    options.onTerminal?.(reason, event);
  }

  // Attach listeners synchronously
  if (moveListenerTarget) {
    moveListenerTarget.addEventListener(moveEventType, handleMove, captureOption);
    moveListenerTarget.addEventListener(releaseEventType, handleRelease, captureOption);
    moveListenerTarget.addEventListener(cancelEventType, handlePointerCancel, captureOption);
  }

  if (hostWindow) {
    hostWindow.addEventListener('blur', handleBlur, false);
  }

  for (const target of keydownTargets) {
    target.addEventListener('keydown', handleKeyDown, true);
  }

  // Return idempotent disposer
  return () => {
    if (terminated) return;
    terminated = true;
    removeAllListeners();
  };
}

// Aliases for convenience
export const startHostGesture = attachHostGesture;
export const bindHostGesture = attachHostGesture;
