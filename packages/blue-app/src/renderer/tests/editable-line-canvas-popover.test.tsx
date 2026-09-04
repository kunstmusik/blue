// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { EditableLineCanvas } from '../components/workbench/panels/shared/line-editor/EditableLineCanvas';
import { HostDocumentContext } from '../hooks/use-host-document';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

// The "popout window": a second JSDOM realm hosting the floated panel content.
const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;
// A third realm for float -> re-dock lifecycle transitions (spec 090 US3).
const secondPopout = new JSDOM('<!doctype html><html><body></body></html>');
const secondPopoutDoc = secondPopout.window.document;
const SecondPopoutKeyboardEvent = secondPopout.window.KeyboardEvent;

describe('EditableLineCanvas popups in a floated (popout) panel', () => {
  let host: HTMLDivElement;
  let root: Root;
  let svg: SVGSVGElement;

  const renderCanvas = (providerDocument: Document | null = popoutDoc) => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={providerDocument}>
          <EditableLineCanvas
            lines={initialLines}
            selectedLineIndex={0}
            onLinesChange={() => {}}
            canvasWidth={200}
            canvasHeight={120}
            interactive
            className="h-full w-full"
          />
        </HostDocumentContext.Provider>,
      );
    });
  };

  beforeEach(() => {
    // Small popout viewport so clamping diverges from the main window's.
    Object.defineProperty(popout.window, 'innerWidth', { configurable: true, value: 200 });
    Object.defineProperty(popout.window, 'innerHeight', { configurable: true, value: 150 });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    renderCanvas();
    svg = host.querySelector('polyline')!.ownerSVGElement!;
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
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
    secondPopoutDoc.body.innerHTML = '';
  });

  function openContextMenu(): HTMLElement {
    act(() => {
      svg.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 60,
        }),
      );
    });
    const menu = [...popoutDoc.querySelectorAll<HTMLElement>('[role="menu"], .fixed.z-50')].find(
      (node) => node.textContent?.includes('Edit Points'),
    );
    expect(menu).toBeTruthy();
    return menu!;
  }

  it('renders the context menu into the hosting popout document', () => {
    openContextMenu();
    expect(document.body.textContent).not.toContain('Edit Points');
    expect(popoutDoc.body.textContent).toContain('Edit Points');
  });

  it('dismisses via popout-document outside mousedown and retains inside mousedown', async () => {
    const menu = openContextMenu();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Foreign-realm mousedown INSIDE the menu must not dismiss it.
    act(() => {
      menu.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(popoutDoc.body.textContent).toContain('Edit Points');

    // Outside mousedown within the popout document dismisses.
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(popoutDoc.body.textContent).not.toContain('Edit Points');

    // Main-window input never touches a popout-hosted menu.
    openContextMenu();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(popoutDoc.body.textContent).toContain('Edit Points');
  });

  it('routes Escape through the hosting window for the point editor', () => {
    const menu = openContextMenu();
    const editButton = [...menu.querySelectorAll<HTMLElement>('button')].find(
      (node) => node.textContent?.trim() === 'Edit Points',
    )!;
    expect(editButton).toBeTruthy();
    act(() => {
      editButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    // The point editor renders inline in the panel tree (which the test mounts
    // under the main container); what matters here is Escape ROUTING: the
    // hosting popout window's keydown must close it even though this module
    // executes in the main realm.
    expect(host.textContent).toContain('Line Point Editor');
    // jsdom does not bubble document→window across realms, so target the
    // hosting window directly; browsers deliver document-dispatched Escape
    // here identically.
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(host.textContent).not.toContain('Line Point Editor');
  });

  it('keeps the hover tooltip inside the hosting window viewport with a measured size', async () => {
    // Hover on the right-bound point: px = 5 + 190 = 195, near the 200px
    // host viewport's right edge; the tooltip measures 176x44.
    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 194,
          clientY: 98,
        }),
      );
    });
    const tooltip = [
      ...popoutDoc.querySelectorAll<HTMLElement>('.pointer-events-none, [data-host-surface]'),
    ].find((node) => node.textContent?.includes('x:'));
    expect(tooltip).toBeTruthy();
    Object.defineProperty(tooltip!, 'offsetWidth', { configurable: true, get: () => 176 });
    Object.defineProperty(tooltip!, 'offsetHeight', { configurable: true, get: () => 44 });
    for (const element of [popoutDoc.documentElement, popoutDoc.body]) {
      Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => 200 });
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 150 });
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const left = Number.parseInt(tooltip!.style.left, 10);
    const top = Number.parseInt(tooltip!.style.top, 10);
    expect(left + 176).toBeLessThanOrEqual(200 - 8);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top + 44).toBeLessThanOrEqual(150 - 8);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(tooltip!.style.pointerEvents).toBe('none'); // informational only
  });

  describe('context menu visibility at the smallest supported host size (240x160)', () => {
    const MENU_WIDTH = 144;
    const MENU_HEIGHT = 60;

    const setSmallHostViewport = () => {
      Object.defineProperty(popout.window, 'innerWidth', { configurable: true, value: 240 });
      Object.defineProperty(popout.window, 'innerHeight', { configurable: true, value: 160 });
      for (const element of [popoutDoc.documentElement, popoutDoc.body]) {
        Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => 240 });
        Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 160 });
      }
    };

    async function openMenuAt(x: number, y: number): Promise<HTMLElement> {
      act(() => {
        svg.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        );
      });
      const menu = [
        ...popoutDoc.querySelectorAll<HTMLElement>(
          '[role="menu"], [data-host-surface], [data-auxiliary-portal]',
        ),
      ].find((node) => node.textContent?.includes('Edit Points'));
      expect(menu).toBeTruthy();
      Object.defineProperty(menu!, 'offsetWidth', { configurable: true, get: () => MENU_WIDTH });
      Object.defineProperty(menu!, 'offsetHeight', { configurable: true, get: () => MENU_HEIGHT });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      return menu!;
    }

    it('keeps the menu fully on screen at the right edge of the host viewport', async () => {
      setSmallHostViewport();
      const menu = await openMenuAt(234, 60);
      const left = Number.parseInt(menu.style.left, 10);
      expect(Number.isFinite(left)).toBe(true);
      expect(left + MENU_WIDTH).toBeLessThanOrEqual(240 - 8);
      expect(left).toBeGreaterThanOrEqual(8);
    });

    it('flips the menu above the pointer at the bottom edge of the host viewport', async () => {
      setSmallHostViewport();
      const menu = await openMenuAt(100, 150);
      const top = Number.parseInt(menu.style.top, 10);
      expect(Number.isFinite(top)).toBe(true);
      expect(top + MENU_HEIGHT).toBeLessThanOrEqual(160 - 8);
      expect(top).toBeGreaterThanOrEqual(8);
    });

    it('closes the menu when the host viewport scrolls', async () => {
      setSmallHostViewport();
      await openMenuAt(100, 60);
      act(() => {
        popout.window.dispatchEvent(new popout.window.Event('scroll'));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(
        [
          ...popoutDoc.querySelectorAll(
            '[role="menu"], [data-host-surface], [data-auxiliary-portal]',
          ),
        ].filter((node) => node.textContent?.includes('Edit Points')),
      ).toHaveLength(0);
    });

    it('keeps a MEASURED tooltip with long content inside the host viewport', async () => {
      setSmallHostViewport();
      // Long formatted values make the real tooltip wider than the legacy
      // hard-coded 176px assumption; only a measured size can clamp it.
      act(() => {
        svg.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: 194,
            clientY: 98,
          }),
        );
      });
      const tooltip = [
        ...popoutDoc.querySelectorAll<HTMLElement>('.pointer-events-none, [data-host-surface]'),
      ].find((node) => node.textContent?.includes('x:'));
      expect(tooltip).toBeTruthy();
      Object.defineProperty(tooltip!, 'offsetWidth', { configurable: true, get: () => 200 });
      Object.defineProperty(tooltip!, 'offsetHeight', { configurable: true, get: () => 44 });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      const left = Number.parseInt(tooltip!.style.left, 10);
      expect(Number.isFinite(left)).toBe(true);
      expect(left + 200).toBeLessThanOrEqual(240 - 8);
      expect(left).toBeGreaterThanOrEqual(8);
    });
  });

  it('moves an open menu when the panel floats and leaves no remnants on unmount (SC-003)', async () => {
    const menusEverywhere = () =>
      [...popoutDoc.querySelectorAll('[data-host-surface], [role="menu"]')]
        .concat([...secondPopoutDoc.querySelectorAll('[data-host-surface], [role="menu"]')])
        .concat([...document.querySelectorAll('[data-host-surface], [role="menu"]')]);

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 60,
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      menusEverywhere().filter((node) => node.textContent?.includes('Edit Points')),
    ).toHaveLength(1);

    // Float: Dockview adopts the mounted DOM into a new window's document
    // without a React remount; the provider value swaps instead.
    Object.defineProperty(secondPopout.window, 'innerWidth', { configurable: true, value: 200 });
    Object.defineProperty(secondPopout.window, 'innerHeight', { configurable: true, value: 150 });
    for (const element of [secondPopoutDoc.documentElement, secondPopoutDoc.body]) {
      Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => 200 });
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 150 });
    }
    renderCanvas(secondPopoutDoc);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // Exactly one menu, now hosted by the NEW document; no copy left behind.
    const menuAfterFloat = menusEverywhere().filter((node) =>
      node.textContent?.includes('Edit Points'),
    );
    expect(menuAfterFloat).toHaveLength(1);
    expect(secondPopoutDoc.contains(menuAfterFloat[0])).toBe(true);

    // Dismissal follows the current host: the old window's Escape is foreign.
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(
      menusEverywhere().filter((node) => node.textContent?.includes('Edit Points')),
    ).toHaveLength(1);
    act(() => {
      secondPopout.window.dispatchEvent(
        new SecondPopoutKeyboardEvent('keydown', { key: 'Escape' }),
      );
    });
    expect(
      menusEverywhere().filter((node) => node.textContent?.includes('Edit Points')),
    ).toHaveLength(0);

    // Unmounting the panel with a tooltip open leaves nothing anywhere.
    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 194,
          clientY: 98,
        }),
      );
    });
    act(() => root.unmount());
    expect(popoutDoc.querySelectorAll('[data-host-surface], [role="menu"]')).toHaveLength(0);
    expect(secondPopoutDoc.querySelectorAll('[data-host-surface], [role="menu"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-host-surface], [role="menu"]')).toHaveLength(0);
  });
});
