import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vite-plus/test';
import OutputPanel from '../components/workbench/panels/output/OutputPanel';
import { HostDocumentContext } from '../hooks/use-host-document';
import { useOutputStore } from '../stores/output-store';
import { PROJECT_MESSAGES_TAB } from '../../shared/xml-diagnostics';
import '../styles/index.css';

it('preserves horizontal scroll when the widest log line leaves the virtual window', async () => {
  const host = document.createElement('div');
  host.style.width = '400px';
  host.style.height = '250px';
  document.body.append(host);
  const root = createRoot(host);
  const wideLine = '漢'.repeat(100);
  const asciiLine = 'x'.repeat(110);
  try {
    useOutputStore
      .getState()
      .appendToTab('Build', [wideLine, ...Array(198).fill('short'), asciiLine].join('\n') + '\n');
    await act(async () => root.render(<OutputPanel />));
    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    const scrollTo = async (top: number) => {
      await act(async () => {
        scroll.scrollTop = top;
        scroll.dispatchEvent(new Event('scroll'));
      });
    };

    await scrollTo(0);
    const width = scroll.scrollWidth;
    scroll.scrollLeft = width;
    const left = scroll.scrollLeft;
    expect(left).toBeGreaterThan(0);

    await scrollTo(scroll.scrollHeight);
    const visibleText = Array.from(
      scroll.querySelectorAll('.output-panel__line:not([data-output-width-sentinel])'),
      (line) => line.textContent,
    );
    expect(visibleText).toContain(asciiLine);
    expect(visibleText).not.toContain(wideLine);
    expect(scroll.scrollWidth).toBe(width);
    expect(scroll.scrollLeft).toBe(left);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
  }
});

it('keeps a native selection across virtual windows and reculls rows when it clears', async () => {
  const host = document.createElement('div');
  host.style.width = '400px';
  host.style.height = '250px';
  document.body.append(host);
  const root = createRoot(host);
  const selection = document.getSelection()!;
  const lines = Array.from({ length: 150 }, (_, i) => `Line ${i}`);
  try {
    useOutputStore.getState().appendToTab('Build', lines.join('\n') + '\n');
    await act(async () =>
      root.render(
        <HostDocumentContext.Provider value={document}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      ),
    );
    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    const rows = () => scroll.querySelectorAll<HTMLElement>('.output-panel__line.min-h-lh');
    await act(async () => {
      scroll.scrollTop = 0;
      scroll.dispatchEvent(new Event('scroll'));
    });
    expect(rows().length).toBeLessThan(lines.length);
    const firstText = rows()[0]!.querySelector('span')!.firstChild!;
    await act(async () => {
      selection.setBaseAndExtent(firstText, 0, firstText, lines[0]!.length);
      // Scroll before the browser's asynchronous selectionchange can run.
      scroll.scrollTop = scroll.scrollHeight;
      scroll.dispatchEvent(new Event('scroll'));
    });
    expect(selection.toString()).toBe(lines[0]);
    expect(firstText.isConnected).toBe(true);

    const lastText = rows()[lines.length - 1]!.querySelector('span')!.firstChild!;
    await act(async () => {
      selection.extend(lastText, lines.at(-1)!.length);
    });
    expect(selection.toString().split('\n')).toEqual(lines);

    await act(async () => {
      selection.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(rows().length).toBeLessThan(lines.length);
    expect(firstText.isConnected).toBe(false);
  } finally {
    selection.removeAllRanges();
    await act(async () => root.unmount());
    host.remove();
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
  }
});

it('defers offscreen wrapped diagnostics and preserves selection across pages', async () => {
  const host = document.createElement('div');
  host.style.width = '320px';
  host.style.height = '250px';
  document.body.append(host);
  const root = createRoot(host);
  const selection = document.getSelection()!;
  const lines = Array.from(
    { length: 300 },
    (_, i) => `Diagnostic ${i}: ${'long message '.repeat(9)}!`,
  );
  try {
    useOutputStore.getState().appendToTab(PROJECT_MESSAGES_TAB, lines.join('\n') + '\n');
    await act(async () =>
      root.render(
        <HostDocumentContext.Provider value={document}>
          <OutputPanel />
        </HostDocumentContext.Provider>,
      ),
    );
    const scroll = host.querySelector<HTMLElement>('.output-panel__scroll')!;
    const rows = scroll.querySelectorAll('.output-panel__line span');
    expect(rows).toHaveLength(lines.length);
    expect(getComputedStyle(rows[0]!.parentElement!.parentElement!).contentVisibility).toBe(
      'visible',
    );
    expect(getComputedStyle(rows[299]!.parentElement!.parentElement!).contentVisibility).toBe(
      'auto',
    );
    await act(async () => {
      scroll.scrollTop = 600;
      scroll.dispatchEvent(new Event('scroll'));
      useOutputStore.getState().appendToTab(PROJECT_MESSAGES_TAB, 'more output\n');
    });
    expect(scroll.scrollTop).toBe(600);
    await act(async () => {
      selection.setBaseAndExtent(
        rows[0]!.firstChild!,
        0,
        rows[299]!.firstChild!,
        lines[299]!.length,
      );
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(selection.toString().split('\n')).toEqual(lines);
  } finally {
    selection.removeAllRanges();
    await act(async () => root.unmount());
    host.remove();
    useOutputStore.setState({ tabs: {}, tabOrder: [], activeTabId: null });
  }
});
