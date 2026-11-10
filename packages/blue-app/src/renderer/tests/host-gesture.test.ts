// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { attachHostGesture } from '../lib/host-gesture';

describe('HostGesture lifecycle and listener boundary (T003, T009)', () => {
  it('direct two-document listener: listens only to the gesture host window/document', () => {
    const mainDom = new JSDOM(
      '<!doctype html><html><body><div id="main-root"></div></body></html>',
    );
    const popoutDom = new JSDOM(
      '<!doctype html><html><body><div id="popout-root"></div></body></html>',
    );

    const mainWin = mainDom.window;
    const popoutWin = popoutDom.window;

    const onMove = vi.fn();
    const onRelease = vi.fn();
    const onEscape = vi.fn();
    const onBlur = vi.fn();

    // Attach gesture to popout window
    attachHostGesture({
      hostWindow: popoutWin as unknown as Window,
      hostDocument: popoutDom.window.document as unknown as Document,
      onMove,
      onRelease,
      onEscape,
      onBlur,
    });

    // Events on main window must not trigger popout gesture callbacks
    mainWin.dispatchEvent(new mainWin.MouseEvent('mousemove'));
    mainWin.dispatchEvent(new mainWin.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    mainWin.dispatchEvent(new mainWin.FocusEvent('blur'));
    mainWin.dispatchEvent(new mainWin.MouseEvent('mouseup'));

    expect(onMove).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();

    // Events on popout window trigger the callbacks
    popoutWin.dispatchEvent(new popoutWin.MouseEvent('mousemove'));
    expect(onMove).toHaveBeenCalledTimes(1);

    popoutWin.dispatchEvent(new popoutWin.MouseEvent('mouseup'));
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('matching-removal: removes all attached listeners with matching capture options upon disposal', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    const added: Array<{
      type: string;
      listener: EventListenerOrEventListenerObject;
      options: unknown;
    }> = [];
    const removed: Array<{
      type: string;
      listener: EventListenerOrEventListenerObject;
      options: unknown;
    }> = [];

    const origAdd = win.addEventListener.bind(win);
    const origRemove = win.removeEventListener.bind(win);

    win.addEventListener = vi.fn((type, listener, options) => {
      added.push({ type, listener, options });
      origAdd(type, listener, options);
    }) as unknown as typeof win.addEventListener;

    win.removeEventListener = vi.fn((type, listener, options) => {
      removed.push({ type, listener, options });
      origRemove(type, listener, options);
    }) as unknown as typeof win.removeEventListener;

    const onMove = vi.fn();
    const onRelease = vi.fn();
    const onEscape = vi.fn();

    const dispose = attachHostGesture({
      hostWindow: win as unknown as Window,
      capture: true,
      onMove,
      onRelease,
      onEscape,
    });

    expect(added.length).toBeGreaterThan(0);
    expect(removed.length).toBe(0);

    // Call disposer
    dispose();

    expect(removed.length).toBe(added.length);

    // Verify every added listener was removed with identical signature and options
    for (const addCall of added) {
      const match = removed.find(
        (rem) =>
          rem.type === addCall.type &&
          rem.listener === addCall.listener &&
          rem.options === addCall.options,
      );
      expect(match).toBeDefined();
    }
  });

  it('capture-Escape: intercepts and consumes Escape in capture phase before workspace stop', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body><button id="btn">Click</button></body></html>',
    );
    const win = dom.window;
    const btn = win.document.getElementById('btn')!;

    let bubbleEscapeFired = false;
    win.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') bubbleEscapeFired = true;
      },
      false,
    );

    const onEscape = vi.fn();
    const onTerminal = vi.fn();

    attachHostGesture({
      hostWindow: win as unknown as Window,
      onEscape,
      onTerminal,
    });

    const escapeEvent = new win.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });

    btn.dispatchEvent(escapeEvent);

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith('escape', escapeEvent);
    expect(escapeEvent.defaultPrevented).toBe(true);
    // Because stopImmediatePropagation / stopPropagation is called, bubble handler should not receive it
    expect(bubbleEscapeFired).toBe(false);
  });

  it('capture-Escape: leaves non-Escape keys and unowned Escape intact', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    let spaceReceived = false;
    win.addEventListener('keydown', (e) => {
      if (e.key === 'Space') spaceReceived = true;
    });

    const onEscape = vi.fn();

    attachHostGesture({
      hostWindow: win as unknown as Window,
      ownsEscape: (e) => e.key === 'Escape' && false, // explicitly does not own
      onEscape,
    });

    // Space key
    const spaceEvent = new win.KeyboardEvent('keydown', {
      key: 'Space',
      bubbles: true,
      cancelable: true,
    });
    win.dispatchEvent(spaceEvent);
    expect(spaceEvent.defaultPrevented).toBe(false);
    expect(spaceReceived).toBe(true);
    expect(onEscape).not.toHaveBeenCalled();

    // Escape when ownsEscape returns false
    const escapeEvent = new win.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    win.dispatchEvent(escapeEvent);
    expect(escapeEvent.defaultPrevented).toBe(false);
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('pointer-cancel: terminates the gesture on pointercancel and filters by pointerId', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    const onMove = vi.fn();
    const onRelease = vi.fn();
    const onCancel = vi.fn();
    const onTerminal = vi.fn();

    attachHostGesture({
      hostWindow: win as unknown as Window,
      kind: 'pointer',
      pointerId: 42,
      onMove,
      onRelease,
      onCancel,
      onTerminal,
    });

    // Pointer event with different pointerId must be ignored
    const otherMove = new win.Event('pointermove') as PointerEvent;
    Object.defineProperty(otherMove, 'pointerId', { value: 99 });
    win.dispatchEvent(otherMove);
    expect(onMove).not.toHaveBeenCalled();

    // Matching pointermove
    const matchMove = new win.Event('pointermove') as PointerEvent;
    Object.defineProperty(matchMove, 'pointerId', { value: 42 });
    win.dispatchEvent(matchMove);
    expect(onMove).toHaveBeenCalledTimes(1);

    // Pointercancel with different pointerId ignored
    const otherCancel = new win.Event('pointercancel') as PointerEvent;
    Object.defineProperty(otherCancel, 'pointerId', { value: 99 });
    win.dispatchEvent(otherCancel);
    expect(onCancel).not.toHaveBeenCalled();

    // Matching pointercancel terminates gesture
    const matchCancel = new win.Event('pointercancel') as PointerEvent;
    Object.defineProperty(matchCancel, 'pointerId', { value: 42 });
    win.dispatchEvent(matchCancel);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith('cancel', matchCancel);

    // Subsequent events must not fire anything
    win.dispatchEvent(matchMove);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('delivers pointer cancellation to mouse-backed gestures (T039)', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    const onMove = vi.fn();
    const onRelease = vi.fn();
    const onCancel = vi.fn();
    const onTerminal = vi.fn();

    // Default kind is 'mouse'
    attachHostGesture({
      hostWindow: win as unknown as Window,
      kind: 'mouse',
      onMove,
      onRelease,
      onCancel,
      onTerminal,
    });

    win.dispatchEvent(new win.MouseEvent('mousemove'));
    expect(onMove).toHaveBeenCalledTimes(1);

    // Pointercancel event arrives during mouse-backed gesture
    const cancelEvt = new win.Event('pointercancel');
    win.dispatchEvent(cancelEvt);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith('cancel', cancelEvt);

    // After pointercancel, gesture is terminated: subsequent movement or release is ignored
    win.dispatchEvent(new win.MouseEvent('mousemove'));
    win.dispatchEvent(new win.MouseEvent('mouseup'));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('synchronous-disposal: unregisters listeners immediately and is idempotent', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    const onMove = vi.fn();
    const onRelease = vi.fn();

    const dispose = attachHostGesture({
      hostWindow: win as unknown as Window,
      onMove,
      onRelease,
    });

    // Dispose synchronously
    dispose();
    // Subsequent calls are safe no-ops
    dispose();
    dispose();

    // Any dispatched events should not trigger callbacks
    win.dispatchEvent(new win.MouseEvent('mousemove'));
    win.dispatchEvent(new win.MouseEvent('mouseup'));
    win.dispatchEvent(new win.FocusEvent('blur'));

    expect(onMove).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('exactly-once terminal: first terminal event wins and prevents subsequent terminal callbacks', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    const onRelease = vi.fn();
    const onEscape = vi.fn();
    const onBlur = vi.fn();
    const onTerminal = vi.fn();

    attachHostGesture({
      hostWindow: win as unknown as Window,
      onRelease,
      onEscape,
      onBlur,
      onTerminal,
    });

    // 1. Release fires first
    win.dispatchEvent(new win.MouseEvent('mouseup'));

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith('release', expect.any(Object));

    // 2. Subsequent events (Escape, blur, mouseup again) must NOT trigger any callbacks
    win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    win.dispatchEvent(new win.FocusEvent('blur'));
    win.dispatchEvent(new win.MouseEvent('mouseup'));

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onEscape).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it('exactly-once terminal: Escape wins over subsequent mouseup and blur', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    const onRelease = vi.fn();
    const onEscape = vi.fn();
    const onBlur = vi.fn();

    attachHostGesture({
      hostWindow: win as unknown as Window,
      onRelease,
      onEscape,
      onBlur,
    });

    // Escape fires first
    win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);

    // Mouseup and blur afterwards
    win.dispatchEvent(new win.MouseEvent('mouseup'));
    win.dispatchEvent(new win.FocusEvent('blur'));

    expect(onRelease).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
  });

  it('exactly-once terminal: blur wins over subsequent mouseup and Escape', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const win = dom.window;

    const onRelease = vi.fn();
    const onEscape = vi.fn();
    const onBlur = vi.fn();

    attachHostGesture({
      hostWindow: win as unknown as Window,
      onRelease,
      onEscape,
      onBlur,
    });

    // Blur fires first
    win.dispatchEvent(new win.FocusEvent('blur'));
    expect(onBlur).toHaveBeenCalledTimes(1);

    // Mouseup and Escape afterwards
    win.dispatchEvent(new win.MouseEvent('mouseup'));
    win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onRelease).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });
});
