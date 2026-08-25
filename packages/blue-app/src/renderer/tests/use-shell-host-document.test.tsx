// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { useShellHostDocument } from '../hooks/use-host-document';

const popout = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://popout.local/',
});
const popoutDoc = popout.window.document;

describe('useShellHostDocument (float transition)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  function adoptShellIntoPopout(shell: HTMLDivElement): void {
    // Simulates dockview adopting the mounted shell into the popout window:
    // adoption mutates ownerDocument in place without any React remount.
    Object.defineProperty(shell, 'ownerDocument', {
      configurable: true,
      get: () => popoutDoc,
    });
  }

  it('re-resolves when the location-change subscription fires (group floated)', () => {
    const shell = document.createElement('div');
    document.body.appendChild(shell);
    const ref = { current: shell };
    const subscribe = vi.fn((cb: () => void) => {
      storedLocationCb = cb;
      return { dispose };
    });
    const dispose = vi.fn();
    let storedLocationCb: () => void = () => {};
    let captured: Document | null = null;

    const Probe = (): React.ReactElement => {
      captured = useShellHostDocument(ref, subscribe);
      return React.createElement('div');
    };

    act(() => {
      root.render(React.createElement(Probe));
    });
    expect(captured).toBe(document);

    adoptShellIntoPopout(shell);
    act(() => {
      storedLocationCb();
    });
    expect(captured).toBe(popoutDoc);
    void dispose;
  });

  it('re-resolves on capture-phase interaction within the shell', () => {
    const shell = document.createElement('div');
    document.body.appendChild(shell);
    const ref = { current: shell };
    let captured: Document | null = null;
    const Probe = (): React.ReactElement => {
      captured = useShellHostDocument(ref);
      return React.createElement('div');
    };
    act(() => {
      root.render(React.createElement(Probe));
    });
    expect(captured).toBe(document);

    adoptShellIntoPopout(shell);
    act(() => {
      shell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    });
    expect(captured).toBe(popoutDoc);
  });

  it('subscribes once and disposes the location subscription on unmount', () => {
    const shell = document.createElement('div');
    document.body.appendChild(shell);
    const ref = { current: shell };
    const dispose = vi.fn();
    const subscribe = vi.fn(() => ({ dispose }));
    const Probe = (): React.ReactElement => {
      useShellHostDocument(ref, subscribe);
      return React.createElement('div');
    };
    act(() => {
      root.render(React.createElement(Probe));
    });
    expect(subscribe).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
