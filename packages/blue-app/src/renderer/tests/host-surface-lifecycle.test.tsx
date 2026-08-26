// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { HostDocumentContext } from '../hooks/use-host-document';
import { HostSurfacePortal } from '../components/host-surface/HostSurfacePortal';
import { useHostSurface } from '../components/host-surface/use-host-surface';
import type {
  HostSurfaceAnchor,
  HostSurfaceDismissReason,
  HostSurfaceKind,
} from '../components/host-surface/host-surface-options';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;
const PopoutEvent = popout.window.Event;

// A third realm used to simulate Dockview moving panel content to a NEW
// floating window mid-interaction without a React remount.
const secondPopout = new JSDOM('<!doctype html><html><body></body></html>');
const secondPopoutDoc = secondPopout.window.document;
const SecondPopoutKeyboardEvent = secondPopout.window.KeyboardEvent;

function SurfaceHarness({ anchor, kind, onDismiss }: {
  anchor: HostSurfaceAnchor | null;
  kind: HostSurfaceKind;
  onDismiss?: (reason: HostSurfaceDismissReason) => void;
}) {
  const session = useHostSurface(anchor, { kind, onDismiss });
  return (
    <HostSurfacePortal session={session} role={kind === 'menu' ? 'menu' : 'tooltip'} className="test-surface">
      <div style={{ width: 120, height: 40 }}>Surface</div>
    </HostSurfacePortal>
  );
}

describe('host-surface lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;
  const dismissals: HostSurfaceDismissReason[] = [];

  const renderHarness = (
    anchor: HostSurfaceAnchor | null,
    kind: HostSurfaceKind,
    providerDocument: Document | null = popoutDoc,
  ) => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={providerDocument}>
          <SurfaceHarness anchor={anchor} kind={kind} onDismiss={(reason) => dismissals.push(reason)} />
        </HostDocumentContext.Provider>,
      );
    });
  };

  const flushFrame = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const openSurface = async (kind: HostSurfaceKind, anchor?: HostSurfaceAnchor) => {
    const effectiveAnchor = anchor ?? { type: 'point', x: 40, y: 50 };
    renderHarness(effectiveAnchor, kind);
    const surface = popoutDoc.querySelector<HTMLElement>('[data-host-surface]');
    expect(surface).toBeTruthy();
    Object.defineProperty(surface!, 'offsetWidth', { configurable: true, get: () => 120 });
    Object.defineProperty(surface!, 'offsetHeight', { configurable: true, get: () => 40 });
    await flushFrame();
    return surface!;
  };

  const setViewport = (win: Window & typeof globalThis, doc: Document, width: number, height: number) => {
    Object.defineProperty(win, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(win, 'innerHeight', { configurable: true, value: height });
    // Floating UI derives the viewport from documentElement/body client
    // sizes; JSDOM reports 0 for both, so seed them like a real browser.
    for (const element of [doc.documentElement, doc.body]) {
      Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => width });
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => height });
    }
  };

  const surfaceCount = (...docs: Document[]) => docs.reduce(
    (sum, doc) => sum + doc.querySelectorAll('[data-host-surface]').length, 0,
  );

  beforeEach(() => {
    setViewport(popout.window, popoutDoc, 600, 400);
    dismissals.length = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
    secondPopoutDoc.body.innerHTML = '';
  });

  it('closes a menu on host-viewport scroll and removes its DOM', async () => {
    await openSurface('menu');
    act(() => {
      popout.window.dispatchEvent(new PopoutEvent('scroll'));
    });
    await flushFrame();
    expect(dismissals).toContain('host-scroll');
    expect(surfaceCount(popoutDoc, document)).toBe(0);
  });

  it('never dismisses a menu for scrolling inside its own content', async () => {
    const surface = await openSurface('menu');
    act(() => {
      surface.dispatchEvent(new PopoutEvent('scroll'));
    });
    await flushFrame();
    expect(dismissals).not.toContain('host-scroll');
    expect(surfaceCount(popoutDoc)).toBe(1);
  });

  it('follows its anchor on host scroll for non-menu kinds, batched per frame', async () => {
    let rectReads = 0;
    const coords = { x: 40, y: 50 };
    const anchor: HostSurfaceAnchor = {
      type: 'rect',
      getRect: () => {
        rectReads += 1;
        return { left: coords.x, top: coords.y, right: coords.x, bottom: coords.y };
      },
    };
    const surface = await openSurface('readout', anchor);
    expect(surface.style.left).toBe('48px'); // readout prefers the right: x + gap(8)

    // Single scroll -> single recomputation (measure the baseline read cost).
    const readsAfterOpen = rectReads;
    act(() => {
      popout.window.dispatchEvent(new PopoutEvent('scroll'));
    });
    await flushFrame();
    const singleUpdateReads = rectReads - readsAfterOpen;
    expect(singleUpdateReads).toBeGreaterThan(0);

    // Five scrolls within one frame, anchor value unchanged, still
    // recomputes exactly once (SC-007).
    for (let index = 0; index < 5; index += 1) {
      act(() => {
        popout.window.dispatchEvent(new PopoutEvent('scroll'));
      });
    }
    await flushFrame();
    expect(rectReads - readsAfterOpen - singleUpdateReads).toBe(singleUpdateReads);

    // A moved anchor value follows: one scroll after the point moved lands
    // the surface at the new anchor (a value change may add one extra
    // frame-aligned re-measure, which stays within the per-frame budget).
    coords.x = 200;
    act(() => {
      popout.window.dispatchEvent(new PopoutEvent('scroll'));
    });
    await flushFrame();
    expect(surface.style.left).toBe('208px'); // followed the moved anchor
    expect(dismissals).not.toContain('host-scroll');
  });

  it('stops updating after the surface closes (SC-007)', async () => {
    let rectReads = 0;
    const coords = { x: 40, y: 50 };
    const anchor: HostSurfaceAnchor = {
      type: 'rect',
      getRect: () => {
        rectReads += 1;
        return { left: coords.x, top: coords.y, right: coords.x, bottom: coords.y };
      },
    };
    const surface = await openSurface('tooltip', anchor);
    act(() => {
      surface.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    // The whole surface is the popup: an inside mousedown must NOT dismiss.
    expect(dismissals).toHaveLength(0);

    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(dismissals).toContain('escape');
    const readsAtClose = rectReads;
    coords.x = 300;
    act(() => {
      popout.window.dispatchEvent(new PopoutEvent('scroll'));
    });
    await flushFrame();
    expect(rectReads).toBe(readsAtClose);
    expect(surfaceCount(popoutDoc, document)).toBe(0);
  });

  it('binds Escape and outside-pointer dismissal to the host window only (FR-006)', async () => {
    await openSurface('menu');

    // Main-window input never dismisses a popout-hosted surface.
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(surfaceCount(popoutDoc)).toBe(1);
    expect(dismissals).toHaveLength(0);

    // Outside pointerdown within the host document dismisses.
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(dismissals).toContain('outside-pointer');
    expect(surfaceCount(popoutDoc, document)).toBe(0);
  });

  it('does not dismiss an element-anchored surface for presses on its anchor (trigger toggles)', async () => {
    const trigger = popoutDoc.createElement('button');
    popoutDoc.body.appendChild(trigger);
    await openSurface('menu', { type: 'element', element: trigger });

    act(() => {
      trigger.dispatchEvent(new PopoutMouseEvent('pointerdown', { bubbles: true }));
      trigger.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(surfaceCount(popoutDoc)).toBe(1);
    expect(dismissals).toHaveLength(0);

    // A press elsewhere in the host document still dismisses.
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(dismissals).toContain('outside-pointer');
    expect(surfaceCount(popoutDoc, document)).toBe(0);
  });

  it('leaves no orphaned DOM and reports host-unmount on unmount (FR-011, SC-003)', async () => {
    await openSurface('popover');
    expect(surfaceCount(popoutDoc)).toBe(1);
    act(() => root.unmount());
    expect(surfaceCount(popoutDoc, document, secondPopoutDoc)).toBe(0);
    expect(dismissals).toContain('host-unmount');
  });

  it('reopens with a new anchor identity after a dismissal', async () => {
    await openSurface('menu', { type: 'point', x: 40, y: 50 });
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(surfaceCount(popoutDoc)).toBe(0);

    renderHarness({ type: 'point', x: 60, y: 70 }, 'menu');
    await flushFrame();
    expect(surfaceCount(popoutDoc)).toBe(1);
    const surface = popoutDoc.querySelector<HTMLElement>('[data-host-surface]')!;
    expect(surface.style.left).toBe('60px');
  });

  it('re-anchors into a new host document when the panel floats mid-interaction (SC-003)', async () => {
    const anchor: HostSurfaceAnchor = { type: 'point', x: 40, y: 50 };
    await openSurface('menu', anchor);
    expect(surfaceCount(popoutDoc)).toBe(1);

    // Dockview adopts the mounted DOM into the new window's document; the
    // provider value changes without a remount of the harness.
    setViewport(secondPopout.window, secondPopoutDoc, 600, 400);
    renderHarness(anchor, 'menu', secondPopoutDoc);
    await flushFrame();

    expect(surfaceCount(popoutDoc, document)).toBe(0);
    expect(surfaceCount(secondPopoutDoc)).toBe(1);

    // Listeners followed the surface: the OLD window's Escape does nothing,
    // the NEW host window's Escape dismisses.
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(surfaceCount(secondPopoutDoc)).toBe(1);
    act(() => {
      secondPopout.window.dispatchEvent(new SecondPopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(dismissals).toContain('escape');
    expect(surfaceCount(secondPopoutDoc, popoutDoc, document)).toBe(0);
  });

  it('survives a full float -> re-dock round trip with listeners bound to the current host (SC-003)', async () => {
    const anchor: HostSurfaceAnchor = { type: 'point', x: 40, y: 50 };
    await openSurface('menu', anchor);

    // Float...
    setViewport(secondPopout.window, secondPopoutDoc, 600, 400);
    renderHarness(anchor, 'menu', secondPopoutDoc);
    await flushFrame();
    expect(surfaceCount(popoutDoc, document)).toBe(0);
    expect(surfaceCount(secondPopoutDoc)).toBe(1);

    // ...and re-dock back into the original document.
    renderHarness(anchor, 'menu', popoutDoc);
    await flushFrame();
    expect(surfaceCount(secondPopoutDoc, document)).toBe(0);
    expect(surfaceCount(popoutDoc)).toBe(1);

    // Dismissal input follows the CURRENT host only: the floated window's
    // Escape is now foreign input; the original window's Escape dismisses.
    act(() => {
      secondPopout.window.dispatchEvent(new SecondPopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(surfaceCount(popoutDoc)).toBe(1);
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(dismissals).toContain('escape');
    expect(surfaceCount(popoutDoc, secondPopoutDoc, document)).toBe(0);
  });
});
