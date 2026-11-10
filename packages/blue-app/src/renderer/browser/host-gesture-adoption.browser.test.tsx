import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHostGesture, type HostGestureTerminalReason } from '../lib/host-gesture';
import { EditableLineCanvas } from '../components/workbench/panels/shared/line-editor/EditableLineCanvas';
import { HostDocumentContext } from '../hooks/use-host-document';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Host gesture adoption, multi-window ordering, pointer cancellation, and capture-phase Escape (T044)', () => {
  let mainContainer: HTMLDivElement;
  let iframe: HTMLIFrameElement;
  let popoutDoc: Document;
  let popoutWin: Window;
  let root: Root | null = null;

  beforeEach(() => {
    // 1. Setup main DOM container
    mainContainer = document.createElement('div');
    mainContainer.id = 'main-test-root';
    document.body.appendChild(mainContainer);

    // 2. Setup popout container document via iframe
    iframe = document.createElement('iframe');
    iframe.id = 'popout-iframe';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    document.body.appendChild(iframe);

    popoutDoc = iframe.contentDocument!;
    popoutWin = iframe.contentWindow!;
    popoutDoc.body.style.margin = '0';
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    mainContainer.remove();
    iframe.remove();
  });

  describe('Already-mounted host adoption', () => {
    it('adopts already-mounted element into container document and binds gesture to the new host document and window', () => {
      // Create element in main document
      const element = document.createElement('div');
      element.id = 'adopted-gesture-element';
      mainContainer.appendChild(element);
      expect(element.ownerDocument).toBe(document);

      // Adopt element into popout container document without recreating it
      popoutDoc.body.appendChild(element);
      expect(element.ownerDocument).toBe(popoutDoc);

      const events: string[] = [];
      const onMove = vi.fn((e: MouseEvent | PointerEvent) =>
        events.push(`move:${e.clientX},${e.clientY}`),
      );
      const onRelease = vi.fn((e: MouseEvent | PointerEvent) =>
        events.push(`release:${e.clientX},${e.clientY}`),
      );
      const onEscape = vi.fn(() => events.push('escape'));
      const onBlur = vi.fn(() => events.push('blur'));
      const onTerminal = vi.fn((reason: HostGestureTerminalReason) =>
        events.push(`terminal:${reason}`),
      );

      // Start gesture with host: element (resolves host from element.ownerDocument)
      attachHostGesture({
        host: element,
        onMove,
        onRelease,
        onEscape,
        onBlur,
        onTerminal,
      });

      // Events on main window must NOT affect the gesture in popout
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
      window.dispatchEvent(new FocusEvent('blur'));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100 }));

      expect(onMove).not.toHaveBeenCalled();
      expect(onRelease).not.toHaveBeenCalled();
      expect(onBlur).not.toHaveBeenCalled();
      expect(onTerminal).not.toHaveBeenCalled();

      // Events on popout window drive the gesture
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 25, clientY: 35 }));
      expect(onMove).toHaveBeenCalledTimes(1);
      expect(events).toEqual(['move:25,35']);

      // Release outside the element inside the hosting container window completes gesture once
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mouseup', { clientX: 500, clientY: 500 }));
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledTimes(1);
      expect(events).toEqual(['move:25,35', 'release:500,500', 'terminal:release']);

      // Subsequent movement inside popout or main window does NOT continue moving
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
      expect(onMove).toHaveBeenCalledTimes(1);
      expect(events.length).toBe(3);
    });

    it('blur on container window terminates adopted gesture, while main window blur has no effect', () => {
      const element = document.createElement('div');
      mainContainer.appendChild(element);
      popoutDoc.body.appendChild(element);

      const onBlur = vi.fn();
      const onTerminal = vi.fn();

      attachHostGesture({
        host: element,
        onBlur,
        onTerminal,
      });

      // Main window blur does nothing
      window.dispatchEvent(new FocusEvent('blur'));
      expect(onBlur).not.toHaveBeenCalled();
      expect(onTerminal).not.toHaveBeenCalled();

      // Popout window blur terminates with 'blur'
      popoutWin.dispatchEvent(new popoutWin.FocusEvent('blur'));
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith('blur', expect.anything());

      // Subsequent mouseup does not fire release
      const onRelease = vi.fn();
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mouseup'));
      expect(onRelease).not.toHaveBeenCalled();
    });

    it('mounted EditableLineCanvas adopted into iframe: drag and release in container document commits lines once, unaffected by main-window events', async () => {
      const initialLines = [
        {
          varName: 'line0',
          min: 0,
          max: 1,
          color: 0x20dd00,
          rightBound: true,
          endPointsLinked: false,
          points: [
            { x: 0, y: 0.15 },
            { x: 1, y: 0.15 },
          ],
        },
      ];

      const onLinesChange = vi.fn();
      const canvasHost = document.createElement('div');
      mainContainer.appendChild(canvasHost);
      root = createRoot(canvasHost);

      await act(async () => {
        root!.render(
          <HostDocumentContext.Provider value={document}>
            <EditableLineCanvas
              lines={initialLines}
              selectedLineIndex={0}
              onLinesChange={onLinesChange}
              canvasWidth={200}
              canvasHeight={120}
              interactive
              className="h-full w-full"
            />
          </HostDocumentContext.Provider>,
        );
      });

      const polyline = canvasHost.querySelector('polyline');
      expect(polyline).toBeTruthy();
      const svg = polyline!.ownerSVGElement!;
      expect(svg).toBeTruthy();

      Object.defineProperty(svg, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 200,
          bottom: 120,
          width: 200,
          height: 120,
          x: 0,
          y: 0,
          toJSON: () => undefined,
        }),
      });

      // Adopt already-mounted canvas host into popout iframe document
      popoutDoc.body.appendChild(canvasHost);
      expect(svg.ownerDocument).toBe(popoutDoc);

      // Start drag on SVG in popout
      act(() => {
        svg.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 5,
            clientY: 98,
          }),
        );
      });

      // Main window mousemove / mouseup must NOT drive or commit the gesture
      act(() => {
        window.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            clientX: 5,
            clientY: 20,
          }),
        );
        window.dispatchEvent(
          new MouseEvent('mouseup', {
            bubbles: true,
            clientX: 5,
            clientY: 20,
          }),
        );
      });
      expect(onLinesChange).not.toHaveBeenCalled();

      // Popout window mousemove moves the point
      act(() => {
        popoutWin.dispatchEvent(
          new popoutWin.MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: 5,
            clientY: 20,
          }),
        );
      });

      // Popout window mouseup outside SVG completes and commits once
      act(() => {
        popoutWin.dispatchEvent(
          new popoutWin.MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: 300,
            clientY: 300,
          }),
        );
      });

      expect(onLinesChange).toHaveBeenCalledTimes(1);
      const committedLines = onLinesChange.mock.calls[0][0];
      expect(committedLines[0].points[0].y).toBeGreaterThan(0.5);

      // Subsequent movement inside popout does NOT commit further changes
      onLinesChange.mockClear();
      act(() => {
        popoutWin.dispatchEvent(
          new popoutWin.MouseEvent('mousemove', {
            bubbles: true,
            clientX: 5,
            clientY: 50,
          }),
        );
      });
      expect(onLinesChange).not.toHaveBeenCalled();
    });
  });

  describe('Gesture event ordering across windows', () => {
    it('preserves strict chronological ordering and window isolation when events interleave across main and container windows', () => {
      const elementB = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(elementB);

      const logB: string[] = [];
      attachHostGesture({
        host: elementB,
        onMove: (e) => logB.push(`move:${e.clientX},${e.clientY}`),
        onRelease: (e) => logB.push(`release:${e.clientX},${e.clientY}`),
        onEscape: () => logB.push('escape'),
        onBlur: () => logB.push('blur'),
        onTerminal: (reason) => logB.push(`term:${reason}`),
      });

      // Interleave events on Window A (main window)
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 11, clientY: 11 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      window.dispatchEvent(new FocusEvent('blur'));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 11, clientY: 11 }));

      expect(logB).toEqual([]);

      // Events on Window B in sequence
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 10, clientY: 20 }));
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 15, clientY: 25 }));

      // Another foreign event on Window A
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 99, clientY: 99 }));

      // Complete gesture on Window B
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mouseup', { clientX: 15, clientY: 25 }));

      expect(logB).toEqual(['move:10,20', 'move:15,25', 'release:15,25', 'term:release']);
    });

    it('concurrent gestures across separate windows maintain independent lifecycles without crosstalk', () => {
      const elementA = document.createElement('div');
      mainContainer.appendChild(elementA);

      const elementB = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(elementB);

      const logA: string[] = [];
      const logB: string[] = [];

      attachHostGesture({
        host: elementA,
        onMove: () => logA.push('A:move'),
        onRelease: () => logA.push('A:release'),
        onEscape: () => logA.push('A:escape'),
        onTerminal: (r) => logA.push(`A:term:${r}`),
      });

      attachHostGesture({
        host: elementB,
        onMove: () => logB.push('B:move'),
        onRelease: () => logB.push('B:release'),
        onEscape: () => logB.push('B:escape'),
        onTerminal: (r) => logB.push(`B:term:${r}`),
      });

      // Move on Window A
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1 }));
      expect(logA).toEqual(['A:move']);
      expect(logB).toEqual([]);

      // Move on Window B
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 2, clientY: 2 }));
      expect(logA).toEqual(['A:move']);
      expect(logB).toEqual(['B:move']);

      // Escape on Window A terminates gesture A only
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(logA).toEqual(['A:move', 'A:escape', 'A:term:escape']);
      expect(logB).toEqual(['B:move']);

      // Gesture B is still alive on Window B
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 3, clientY: 3 }));
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mouseup', { clientX: 3, clientY: 3 }));
      expect(logB).toEqual(['B:move', 'B:move', 'B:release', 'B:term:release']);
    });
  });

  describe('Pointer cancellation', () => {
    it('terminates pointer-backed gesture on pointercancel and stops subsequent pointer events', () => {
      const element = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(element);

      const events: string[] = [];
      const onMove = vi.fn((e: PointerEvent | MouseEvent) => events.push(`move:${e.clientX}`));
      const onCancel = vi.fn(() => events.push('cancel'));
      const onRelease = vi.fn(() => events.push('release'));
      const onTerminal = vi.fn((reason: HostGestureTerminalReason) =>
        events.push(`term:${reason}`),
      );

      attachHostGesture({
        host: element,
        kind: 'pointer',
        pointerId: 42,
        onMove,
        onCancel,
        onRelease,
        onTerminal,
      });

      // Pointermove with matching pointerId
      popoutWin.dispatchEvent(
        new popoutWin.PointerEvent('pointermove', {
          pointerId: 42,
          clientX: 10,
        }),
      );
      expect(onMove).toHaveBeenCalledTimes(1);

      // Pointercancel on foreign window does not terminate gesture
      window.dispatchEvent(
        new PointerEvent('pointercancel', {
          pointerId: 42,
        }),
      );
      expect(onCancel).not.toHaveBeenCalled();

      // Pointercancel with mismatched pointerId in popout is ignored
      popoutWin.dispatchEvent(
        new popoutWin.PointerEvent('pointercancel', {
          pointerId: 99,
        }),
      );
      expect(onCancel).not.toHaveBeenCalled();

      // Pointercancel with matching pointerId in popout terminates gesture
      popoutWin.dispatchEvent(
        new popoutWin.PointerEvent('pointercancel', {
          pointerId: 42,
        }),
      );
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith('cancel', expect.anything());

      // Subsequent pointer movements or releases are ignored
      popoutWin.dispatchEvent(
        new popoutWin.PointerEvent('pointermove', {
          pointerId: 42,
          clientX: 20,
        }),
      );
      popoutWin.dispatchEvent(
        new popoutWin.PointerEvent('pointerup', {
          pointerId: 42,
        }),
      );
      expect(onRelease).not.toHaveBeenCalled();
      expect(events).toEqual(['move:10', 'cancel', 'term:cancel']);
    });

    it('delivers pointer cancellation to mouse-backed gestures in container window', () => {
      const element = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(element);

      const events: string[] = [];
      attachHostGesture({
        host: element,
        kind: 'mouse',
        onMove: () => events.push('move'),
        onCancel: () => events.push('cancel'),
        onRelease: () => events.push('release'),
        onTerminal: (reason) => events.push(`term:${reason}`),
      });

      // Move in popout window
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
      expect(events).toEqual(['move']);

      // Pointercancel dispatched in popout window terminates mouse gesture
      popoutWin.dispatchEvent(new popoutWin.PointerEvent('pointercancel', { pointerId: 1 }));
      expect(events).toEqual(['move', 'cancel', 'term:cancel']);

      // Subsequent mouseup is ignored
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mouseup'));
      expect(events).toEqual(['move', 'cancel', 'term:cancel']);
    });
  });

  describe('Capture-phase Escape across container documents', () => {
    it('intercepts Escape in capture phase on container document before bubble listeners and consumes it', () => {
      const element = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(element);

      let bubbleSawEscape = false;
      let bubbleEventDefaultPrevented = false;

      // Bubble listener on container document
      const bubbleListener = (e: Event) => {
        if ((e as KeyboardEvent).key === 'Escape') {
          bubbleSawEscape = true;
          bubbleEventDefaultPrevented = e.defaultPrevented;
        }
      };
      popoutDoc.addEventListener('keydown', bubbleListener, false);

      const onEscape = vi.fn();
      const onTerminal = vi.fn();

      attachHostGesture({
        host: element,
        onEscape,
        onTerminal,
      });

      const escapeEvent = new popoutWin.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      popoutDoc.dispatchEvent(escapeEvent);

      // Escape was consumed in capture phase
      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith('escape', expect.anything());
      expect(escapeEvent.defaultPrevented).toBe(true);

      // Because stopPropagation / stopImmediatePropagation is called, bubble listener on document is not invoked
      expect(bubbleSawEscape).toBe(false);

      popoutDoc.removeEventListener('keydown', bubbleListener, false);
    });

    it('Escape dispatched in main window does not cancel gesture active in container window', () => {
      const element = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(element);

      const onEscape = vi.fn();
      const onTerminal = vi.fn();
      const onMove = vi.fn();

      attachHostGesture({
        host: element,
        onMove,
        onEscape,
        onTerminal,
      });

      // Main window receives Escape
      const mainEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(mainEscape);
      document.dispatchEvent(mainEscape);

      expect(onEscape).not.toHaveBeenCalled();
      expect(onTerminal).not.toHaveBeenCalled();

      // Popout gesture is still active
      popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove', { clientX: 30, clientY: 40 }));
      expect(onMove).toHaveBeenCalledTimes(1);

      // Escape in popout window cancels it
      const popoutEscape = new popoutWin.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      popoutWin.dispatchEvent(popoutEscape);

      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith('escape', expect.anything());
    });

    it('unowned Escape does not cancel gesture and leaves event unconsumed', () => {
      const element = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(element);

      const onEscape = vi.fn();
      const onTerminal = vi.fn();

      attachHostGesture({
        host: element,
        ownsEscape: () => false, // explicitly does not own Escape
        onEscape,
        onTerminal,
      });

      const escapeEvent = new popoutWin.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      popoutDoc.dispatchEvent(escapeEvent);

      expect(onEscape).not.toHaveBeenCalled();
      expect(onTerminal).not.toHaveBeenCalled();
      expect(escapeEvent.defaultPrevented).toBe(false);
    });
  });
});
