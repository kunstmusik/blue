// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type { NoteProcessorChainSnapshot } from '../../shared/project-editor';
import NoteProcessorChainEditor from '../components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor';
import { HostDocumentContext } from '../hooks/use-host-document';
import { getNoteProcessorCatalog } from '@blue/data';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const CATALOG = getNoteProcessorCatalog();

const CHAIN: NoteProcessorChainSnapshot = {
  processors: [],
  hasUnsupportedProcessors: false,
  hasDeferredProcessors: false,
};

// A "popout window" realm without requestAnimationFrame so the module's
// frame scheduler falls back to timers (deterministic in tests).
const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;

describe('NoteProcessorChainEditor Add menu (host-surface, spec 090)', () => {
  let host: HTMLDivElement;
  let root: Root;
  const commits: NoteProcessorChainSnapshot[] = [];

  const renderEditor = (providerDocument: Document) => {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={providerDocument}>
          <NoteProcessorChainEditor chain={CHAIN} onCommit={(next) => commits.push(next)} />
        </HostDocumentContext.Provider>,
      );
    });
  };

  const findButton = (label: string): HTMLButtonElement => {
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === label);
    if (!button) throw new Error(`Button not found: ${label}`);
    return button;
  };

  const click = (button: HTMLButtonElement) => {
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  };

  const flushFrame = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const menuIn = (doc: Document): HTMLElement | null =>
    doc.body.querySelector('[data-host-surface]');

  beforeEach(() => {
    Object.defineProperty(popout.window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(popout.window, 'innerHeight', { configurable: true, value: 600 });
    for (const element of [popoutDoc.documentElement, popoutDoc.body]) {
      Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => 800 });
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 600 });
    }
    commits.length = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  it('opens with every catalog item and a viewport-derived height, hosted by the host document', async () => {
    renderEditor(popoutDoc);
    click(findButton('+ Add'));
    await flushFrame();

    const menu = menuIn(popoutDoc);
    expect(menu).toBeTruthy();
    // The full catalog is rendered — no fixed 192px (max-h-48) cap: the
    // constraint comes from the host viewport and dwarfs the old cap here.
    const items = [...menu!.querySelectorAll('button')].map((b) => b.textContent);
    expect(items).toHaveLength(CATALOG.length);
    expect(items).toContain('AddProcessor');
    expect(items).toContain('PythonProcessor');
    const maxHeight = Number.parseInt(menu!.style.maxHeight, 10);
    expect(Number.isFinite(maxHeight)).toBe(true);
    expect(maxHeight).toBeGreaterThan(192);
    expect(menu!.style.overflowY).toBe('auto');
  });

  it('adds the chosen processor and closes the menu', async () => {
    renderEditor(popoutDoc);
    click(findButton('+ Add'));
    await flushFrame();

    const item = [...menuIn(popoutDoc)!.querySelectorAll('button')].find(
      (b) => b.textContent === 'MultiplyProcessor',
    )!;
    click(item);
    await flushFrame();

    expect(commits).toHaveLength(1);
    expect(commits[0]!.processors).toHaveLength(1);
    expect(commits[0]!.processors[0]!.processorType).toBe('MultiplyProcessor');
    expect(menuIn(popoutDoc)).toBeNull();
  });

  it('toggles closed through the trigger and dismisses via host-document input only', async () => {
    renderEditor(popoutDoc);
    const addButton = findButton('+ Add');
    click(addButton);
    await flushFrame();
    expect(menuIn(popoutDoc)).toBeTruthy();

    // Presses on the anchor toggle rather than count as outside dismissal.
    click(addButton);
    await flushFrame();
    expect(menuIn(popoutDoc)).toBeNull();

    click(addButton);
    await flushFrame();
    expect(menuIn(popoutDoc)).toBeTruthy();

    // Main-window input is foreign and never dismisses the popout menu.
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(menuIn(popoutDoc)).toBeTruthy();

    // Escape on the HOST window dismisses.
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(menuIn(popoutDoc)).toBeNull();

    // Outside mousedown within the host document dismisses a reopened menu.
    click(addButton);
    await flushFrame();
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(menuIn(popoutDoc)).toBeNull();
  });

  it('renders into the main document when docked', async () => {
    renderEditor(document);
    click(findButton('+ Add'));
    await flushFrame();
    expect(menuIn(document)).toBeTruthy();
    expect(menuIn(popoutDoc)).toBeNull();
  });
});
