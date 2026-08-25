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

// The "popout window": a second JSDOM realm hosting the floated panel
// content. Its viewport is deliberately smaller than the main window's so
// clamping against the wrong realm is detectable (spec FR-004).
const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;

interface HarnessProps {
  anchor: HostSurfaceAnchor | null;
  kind: HostSurfaceKind;
  onDismiss?: (reason: HostSurfaceDismissReason) => void;
}

function SurfaceHarness({ anchor, kind, onDismiss }: HarnessProps) {
  const session = useHostSurface(anchor, { kind, onDismiss });
  return (
    <HostSurfacePortal
      session={session}
      role={kind === 'menu' ? 'menu' : 'tooltip'}
      className="test-surface rounded border bg-app-menu px-3 py-2 text-role-body"
    >
      <div style={{ width: 120, height: 40 }}>Surface</div>
    </HostSurfacePortal>
  );
}

describe('host-surface placement', () => {
  let host: HTMLDivElement;
  let root: Root;
  const dismissals: HostSurfaceDismissReason[] = [];

  const setPopoutViewport = (width: number, height: number) => {
    Object.defineProperty(popout.window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(popout.window, 'innerHeight', { configurable: true, value: height });
    // Floating UI derives the viewport from documentElement/body client
    // sizes; JSDOM reports 0 for both, so seed them like a real browser.
    for (const element of [popoutDoc.documentElement, popoutDoc.body]) {
      Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => width });
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => height });
    }
  };

  const renderHarness = (anchor: HostSurfaceAnchor | null, kind: HostSurfaceKind = 'menu') => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <SurfaceHarness anchor={anchor} kind={kind} onDismiss={(reason) => dismissals.push(reason)} />
        </HostDocumentContext.Provider>,
      );
    });
  };

  /** Sizes the mounted surface element and flushes the frame scheduler. */
  const openAndMeasure = async (
    anchor: HostSurfaceAnchor | null,
    kind: HostSurfaceKind,
    size: { width: number; height: number } = { width: 120, height: 40 },
  ): Promise<HTMLElement> => {
    renderHarness(anchor, kind);
    const surface = popoutDoc.querySelector<HTMLElement>('[data-host-surface]');
    expect(surface).toBeTruthy();
    Object.defineProperty(surface, 'offsetWidth', { configurable: true, get: () => size.width });
    Object.defineProperty(surface, 'offsetHeight', { configurable: true, get: () => size.height });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return surface!;
  };

  beforeEach(() => {
    setPopoutViewport(200, 150);
    dismissals.length = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  it('places below an unobstructed point anchor with gap and start alignment', async () => {
    setPopoutViewport(600, 400);
    const surface = await openAndMeasure({ type: 'point', x: 100, y: 80 }, 'menu');
    expect(surface.style.left).toBe('100px');
    expect(surface.style.top).toBe('88px'); // y + gap(8)
    expect(surface.style.visibility).toBe('');
  });

  it('flips above an anchor at the bottom edge of the HOST viewport (not the main window)', async () => {
    // Main JSDOM window is ~1024x768; only the host realm (200x150) forces
    // the flip, proving limits come from the hosting document (FR-004).
    const surface = await openAndMeasure({ type: 'point', x: 40, y: 140 }, 'menu');
    expect(surface.style.top).toBe('92px'); // 140 - gap(8) - height(40)
    expect(surface.dataset.placement).toBe('top');
  });

  it('keeps a right-edge anchor inside the host viewport by aligning the menu end', async () => {
    const surface = await openAndMeasure({ type: 'point', x: 190, y: 50 }, 'menu');
    // flip's alignment fallback moves to bottom-end so the menu grows
    // leftward from the pointer: right edge at anchor.x = 190.
    expect(surface.style.left).toBe('70px'); // 190 - width(120)
    expect(Number.parseInt(surface.style.left, 10) + 120).toBeLessThanOrEqual(200 - 8);
    expect(surface.dataset.placement).toBe('bottom');
  });

  it('constrains oversized content with maxHeight from remaining space', async () => {
    const surface = await openAndMeasure(
      { type: 'point', x: 40, y: 50 },
      'menu',
      { width: 120, height: 200 },
    );
    // 150 - (50 + gap 8) - margin 8 = 84px of usable space below the anchor.
    expect(surface.style.maxHeight).toBe('84px');
    expect(surface.style.overflowY).toBe('auto');
  });

  it('anchors to a host-realm element', async () => {
    const anchorEl = popoutDoc.createElement('div');
    popoutDoc.body.appendChild(anchorEl);
    Object.defineProperty(anchorEl, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 40, top: 50, right: 60, bottom: 70, width: 20, height: 20, x: 40, y: 50, toJSON: () => undefined }),
    });
    const surface = await openAndMeasure({ type: 'element', element: anchorEl }, 'popover');
    expect(surface.style.left).toBe('40px');
    expect(surface.style.top).toBe('78px'); // bottom(70) + gap(8)
  });

  it('re-reads a live rect anchor so the surface follows a moved point', async () => {
    setPopoutViewport(600, 400);
    const coords = { x: 100, y: 80 };
    const anchor: HostSurfaceAnchor = {
      type: 'rect',
      getRect: () => ({ left: coords.x, top: coords.y, right: coords.x, bottom: coords.y }),
    };
    const surface = await openAndMeasure(anchor, 'readout');
    expect(surface.style.left).toBe('108px'); // readout prefers the right: x + gap(8)
    expect(surface.dataset.placement).toBe('right');

    coords.x = 250;
    coords.y = 160;
    act(() => {
      popout.window.dispatchEvent(new popout.window.Event('resize'));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(surface.style.left).toBe('258px');
    expect(surface.style.top).toBe('160px');
  });

  it('renders nothing and keeps both documents clean when there is no host DOM', async () => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={null}>
          <SurfaceHarness anchor={{ type: 'point', x: 10, y: 10 }} kind="menu" />
        </HostDocumentContext.Provider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(popoutDoc.querySelectorAll('[data-host-surface]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-host-surface]')).toHaveLength(0);
  });
});
