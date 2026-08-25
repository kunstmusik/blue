// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { HostDocumentContext } from '../hooks/use-host-document';
import ScoreObjectColorPicker, {
  type ScoreObjectColorPickerHandle,
} from '../components/workbench/panels/score/layer-groups/ScoreObjectColorPicker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ScoreObjectColorPicker', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = '';
  });

  function mountPicker(onSelect: (color: number) => void) {
    const ref = React.createRef<ScoreObjectColorPickerHandle>();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(<ScoreObjectColorPicker ref={ref} onSelect={onSelect} />);
    });
    return ref;
  }

  it('renders into the anchor element document when opened with a foreign-document anchor', () => {
    const popout = new JSDOM('<!doctype html><html><body><div id="timeline"></div></body></html>');
    const popoutDoc = popout.window.document;
    const timeline = popoutDoc.getElementById('timeline')!;

    const onSelect = vi.fn();
    const ref = mountPicker(onSelect);

    act(() => {
      ref.current!.open(0x336699, { left: 10, right: 10, top: 10, bottom: 40 }, timeline);
    });

    // Floating score panels live in a popout document while sharing this
    // renderer context; the picker must open there, not in the main window.
    const dialogInPopout = popoutDoc.querySelector('[role="dialog"][aria-label="Color picker"]');
    expect(dialogInPopout).toBeTruthy();
    expect(document.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeNull();

    const PopoutMouseEvent = popout.window.MouseEvent;
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(popoutDoc.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('falls back to the shared document when no anchor element is given', () => {
    const onSelect = vi.fn();
    const ref = mountPicker(onSelect);

    act(() => {
      ref.current!.open(0x336699, { left: 10, right: 10, top: 10, bottom: 40 });
    });

    expect(document.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeTruthy();

    act(() => {
      ref.current!.open(0x336699, { left: 10, right: 10, top: 10, bottom: 40 }, null);
    });

    expect(document.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeTruthy();
  });

  it('dismisses on mousedown outside even when the anchor element is a large timeline container', () => {
    // The canvas path passes the whole timeline container as anchorElement so
    // the popover can resolve the hosting document. Containment must NOT treat
    // the entire timeline as "inside the picker", or outside clicks never
    // dismiss it after a color is applied.
    const popout = new JSDOM('<!doctype html><html><body><div id="timeline"><div id="an-object"></div></div></body></html>');
    const popoutDoc = popout.window.document;
    const timeline = popoutDoc.getElementById('timeline')!;
    const objectBehindPicker = popoutDoc.getElementById('an-object')!;

    const onSelect = vi.fn();
    const ref = mountPicker(onSelect);

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <ScoreObjectColorPicker ref={ref} onSelect={onSelect} />
        </HostDocumentContext.Provider>,
      );
    });

    act(() => {
      ref.current!.open(0x336699, { left: 10, right: 10, top: 10, bottom: 40 }, timeline);
    });
    expect(popoutDoc.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeTruthy();

    // Apply a color (picker intentionally stays open on this path)…
    act(() => {
      const hex = popoutDoc.querySelector('input[aria-label="Hex color"]') as HTMLInputElement;
      hex.value = '#ff8800';
      hex.dispatchEvent(new popout.window.Event('input', { bubbles: true }));
    });
    expect(popoutDoc.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeTruthy();

    // …then a mousedown on the timeline (outside the popover) must dismiss it.
    act(() => {
      objectBehindPicker.dispatchEvent(new popout.window.MouseEvent('mousedown', { bubbles: true }));
    });
    expect(popoutDoc.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeNull();
  });
});
