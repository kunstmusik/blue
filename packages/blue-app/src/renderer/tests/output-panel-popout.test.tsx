// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import OutputPanel from '../components/workbench/panels/output/OutputPanel';
import { HostDocumentContext } from '../hooks/use-host-document';
import { useOutputStore } from '../stores/output-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const popout = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://popout.test',
});
const popoutDoc = popout.window.document;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;
const PopoutMouseEvent = popout.window.MouseEvent;

describe('OutputPanel popout selection actions', () => {
  let host: HTMLDivElement;
  let root: Root;
  let writeClipboardText: ReturnType<typeof vi.fn>;
  let blueApiDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    blueApiDescriptor = Object.getOwnPropertyDescriptor(window, 'blueAPI');
    writeClipboardText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'blueAPI', {
      configurable: true,
      value: { writeClipboardText },
    });

    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    useOutputStore.getState().appendToTab('Test', 'alpha\nbeta\n');

    host = popoutDoc.createElement('div');
    popoutDoc.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.getSelection()?.removeAllRanges();
    document.getSelection()?.removeAllRanges();
    popoutDoc.body.innerHTML = '';
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    if (blueApiDescriptor) {
      Object.defineProperty(window, 'blueAPI', blueApiDescriptor);
    } else {
      delete (window as { blueAPI?: unknown }).blueAPI;
    }
  });

  it('selects and copies text through the hosting document', async () => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      );
    });

    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    expect(scroll).toBeTruthy();

    act(() => {
      scroll.dispatchEvent(new PopoutKeyboardEvent('keydown', {
        bubbles: true,
        key: 'a',
        ctrlKey: true,
      }));
    });

    const popoutSelection = popoutDoc.getSelection();
    expect(popoutSelection?.isCollapsed).toBe(false);
    expect(popoutSelection?.toString()).toContain('alpha');
    const selectedText = popoutSelection?.toString();
    expect(document.getSelection()?.isCollapsed ?? true).toBe(true);

    act(() => {
      popoutDoc.dispatchEvent(new Event('selectionchange'));
    });
    act(() => {
      scroll.dispatchEvent(new PopoutMouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
      }));
    });

    const copy = [...popoutDoc.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((item) => item.textContent?.trim() === 'Copy');
    expect(copy?.hasAttribute('data-disabled')).toBe(false);

    // Radix moves focus into the menu in this jsdom harness, which can clear
    // the browser selection before the item callback runs. Recreate the same
    // host-document range immediately before invoking Copy.
    act(() => {
      const range = popoutDoc.createRange();
      range.selectNodeContents(scroll);
      popoutSelection?.removeAllRanges();
      popoutSelection?.addRange(range);
      copy!.click();
    });
    expect(writeClipboardText).toHaveBeenCalledWith(selectedText);
  });
});
