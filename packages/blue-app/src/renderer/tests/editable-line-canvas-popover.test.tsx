// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { EditableLineCanvas } from '../components/workbench/panels/shared/line-editor/EditableLineCanvas';
import { HostDocumentContext } from '../hooks/use-host-document';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const initialLines = [{
  varName: 'line0',
  min: 0,
  max: 1,
  color: 0x20dd00,
  rightBound: true,
  endPointsLinked: false,
  points: [{ x: 0, y: 0.15 }, { x: 1, y: 0.15 }],
}];

// The "popout window": a second JSDOM realm hosting the floated panel content.
const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;

describe('EditableLineCanvas popups in a floated (popout) panel', () => {
  let host: HTMLDivElement;
  let root: Root;
  let svg: SVGSVGElement;

  beforeEach(() => {
    // Small popout viewport so clamping diverges from the main window's.
    Object.defineProperty(popout.window, 'innerWidth', { configurable: true, value: 200 });
    Object.defineProperty(popout.window, 'innerHeight', { configurable: true, value: 150 });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
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
    svg = host.querySelector('polyline')!.ownerSVGElement!;
    expect(svg).toBeTruthy();
    Object.defineProperty(svg, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 200, bottom: 120, width: 200, height: 120, x: 0, y: 0, toJSON: () => undefined }),
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  function openContextMenu(): HTMLElement {
    act(() => {
      svg.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: 100, clientY: 60,
      }));
    });
    const menu = [...popoutDoc.querySelectorAll<HTMLElement>('[role="menu"], .fixed.z-50')]
      .find((node) => node.textContent?.includes('Edit Points'));
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
    const editButton = [...menu.querySelectorAll<HTMLElement>('button')]
      .find((node) => node.textContent?.trim() === 'Edit Points')!;
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

  it('clamps the hover tooltip against the hosting window viewport', () => {
    // Hover on the right-bound point: px = 5 + 190 = 195, py = 5 + 0.85*110.
    act(() => {
      svg.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, cancelable: true, clientX: 194, clientY: 98,
      }));
    });

    const tooltip = popoutDoc.querySelector('.pointer-events-none.fixed');
    expect(tooltip).toBeTruthy();
    expect((tooltip as HTMLElement).style.left).toBe('24px'); // min(205, 200-176)
    expect((tooltip as HTMLElement).style.top).toBe('8px'); // max(8, -44)
  });
});
