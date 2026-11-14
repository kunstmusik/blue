// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OutputPanel from '../components/workbench/panels/output/OutputPanel';
import { HostDocumentContext } from '../hooks/use-host-document';
import { useOutputStore } from '../stores/output-store';
import { PROJECT_MESSAGES_TAB } from '../../shared/xml-diagnostics';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('OutputPanel virtualization', () => {
  let host: HTMLDivElement;
  let root: Root;
  let blueApiDescriptor: PropertyDescriptor | undefined;
  let writeClipboardText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    blueApiDescriptor = Object.getOwnPropertyDescriptor(window, 'blueAPI');
    writeClipboardText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'blueAPI', {
      configurable: true,
      value: { writeClipboardText },
    });

    const lines = Array.from({ length: 300 }, (_, i) => `line-${i}`).join('\n') + '\n';
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    useOutputStore.getState().appendToTab('Build', lines);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.getSelection()?.removeAllRanges();
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    if (blueApiDescriptor) {
      Object.defineProperty(window, 'blueAPI', blueApiDescriptor);
    } else {
      delete (window as { blueAPI?: unknown }).blueAPI;
    }
  });

  it('virtualizes large line logs and copies every line on Ctrl+A + copy', () => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      );
    });

    const renderedLines = host.querySelectorAll('.output-panel__line');
    expect(renderedLines.length).toBeGreaterThan(0);
    expect(renderedLines.length).toBeLessThan(120);

    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    const spacers = scroll.querySelectorAll<HTMLElement>('[aria-hidden="true"]');
    expect(spacers.length).toBeGreaterThanOrEqual(1);

    // Selecting all + async selectionchange + right-click mousedown must still copy all lines.
    act(() => {
      scroll.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: 'a',
        }),
      );
      document.dispatchEvent(new Event('selectionchange'));
      scroll.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
    });

    let clipboardText = '';
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(copyEvent, 'clipboardData', {
      value: {
        setData: (_type: string, data: string) => {
          clipboardText = data;
        },
      },
    });
    act(() => {
      scroll.dispatchEvent(copyEvent);
    });

    const copiedLines = clipboardText.split('\n');
    expect(copiedLines).toHaveLength(300);
    expect(copiedLines[0]).toBe('line-0');
    expect(copiedLines[299]).toBe('line-299');
  });

  it('does not fixed-height virtualize Project Messages tab where rows wrap', () => {
    const messages =
      Array.from({ length: 600 }, (_, i) => `msg-${i} long wrapped text`).join('\n') + '\n';
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    useOutputStore.getState().appendToTab(PROJECT_MESSAGES_TAB, messages);

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      );
    });

    expect(host.querySelectorAll('.output-panel__line')).toHaveLength(600);
  });

  it('preserves longest-line horizontal width sentinel when long line scrolls out of view without duplicating copied text', () => {
    const longLine = 'L'.repeat(400);
    const lines =
      [longLine, ...Array.from({ length: 299 }, (_, i) => `short-${i + 1}`)].join('\n') + '\n';
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    useOutputStore.getState().appendToTab('Build', lines);

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      );
    });

    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    act(() => {
      scroll.scrollTop = 3000;
      scroll.dispatchEvent(new Event('scroll'));
    });

    const visibleLines = Array.from(
      scroll.querySelectorAll<HTMLElement>('.output-panel__line:not([data-output-width-sentinel])'),
    );
    expect(visibleLines.length).toBeGreaterThan(0);
    expect(visibleLines.some((el) => el.textContent === longLine)).toBe(false);

    const sentinel = scroll.querySelector<HTMLElement>('[data-output-width-sentinel="true"]');
    expect(sentinel).not.toBeNull();
    expect(sentinel?.textContent).toBe(longLine);
    expect(sentinel?.style.height).toBe('0px');
    expect(sentinel?.style.width).toBe('max-content');
    expect(sentinel?.style.visibility).toBe('hidden');

    act(() => {
      scroll.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: 'a',
        }),
      );
    });
    let clipboardText = '';
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(copyEvent, 'clipboardData', {
      value: {
        setData: (_type: string, data: string) => {
          clipboardText = data;
        },
      },
    });
    act(() => {
      scroll.dispatchEvent(copyEvent);
    });

    const copiedLines = clipboardText.split('\n');
    expect(copiedLines).toHaveLength(300);
    expect(copiedLines[0]).toBe(longLine);
    expect(copiedLines[299]).toBe('short-299');
  });

  it('keeps Select All intact across vertical scrolling, log appends, and selectionchange', () => {
    const longLine = 'W'.repeat(300);
    const initial =
      Array.from({ length: 95 }, (_, i) => (i === 0 ? longLine : `line-${i}`)).join('\n') + '\n';
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    useOutputStore.getState().appendToTab('Build', initial);

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      );
    });

    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    act(() => {
      scroll.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: 'a',
        }),
      );
      document.dispatchEvent(new Event('selectionchange'));
    });

    // Cross virtualization threshold and scroll vertically while Select All is active
    const appended = Array.from({ length: 205 }, (_, i) => `appended-${i}`).join('\n') + '\n';
    act(() => {
      useOutputStore.getState().appendToTab('Build', appended);
      scroll.scrollTop = 1200;
      scroll.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('selectionchange'));
    });

    let clipboardText = '';
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(copyEvent, 'clipboardData', {
      value: {
        setData: (_type: string, data: string) => {
          clipboardText = data;
        },
      },
    });
    act(() => {
      scroll.dispatchEvent(copyEvent);
    });

    const copiedLines = clipboardText.split('\n');
    expect(copiedLines).toHaveLength(300);
    expect(copiedLines[0]).toBe(longLine);
    expect(copiedLines[299]).toBe('appended-204');
  });

  it('resets active selection and auto-scroll state when switching tabs', () => {
    const buildText = Array.from({ length: 200 }, (_, i) => `build-${i}`).join('\n') + '\n';
    const msgText = Array.from({ length: 50 }, (_, i) => `msg-${i}`).join('\n') + '\n';
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
    useOutputStore.getState().appendToTab('Build', buildText);
    useOutputStore.getState().appendToTab(PROJECT_MESSAGES_TAB, msgText);
    useOutputStore.getState().selectTab('Build');

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      );
    });

    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    act(() => {
      scroll.scrollTop = 120;
      scroll.dispatchEvent(new Event('scroll'));
      scroll.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: 'a',
        }),
      );
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(scroll.scrollTop).toBe(120);

    // Switch to Project Messages: clears previous selection and resets scrollTop to 0
    act(() => {
      useOutputStore.getState().selectTab(PROJECT_MESSAGES_TAB);
    });
    expect(scroll.scrollTop).toBe(0);
    expect(document.getSelection()?.isCollapsed ?? true).toBe(true);
  });
});
