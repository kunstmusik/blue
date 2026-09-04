// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  HostDocumentContext,
  useHostDocument,
  usePortalContainer,
} from '../hooks/use-host-document';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('useHostDocument', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = '';
  });

  function mount(content: React.ReactNode): void {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(content);
    });
  }

  const popout = new JSDOM('<!doctype html><html><body></body></html>');
  const popoutDoc = popout.window.document;

  it('returns null for panel content without a provider (no silent main-window fallback)', () => {
    let captured: Document | null = null;
    const Probe = (): React.ReactElement => {
      captured = useHostDocument();
      return React.createElement('div');
    };
    mount(React.createElement(Probe));
    expect(captured).toBeNull();
  });

  it('falls back to the global document only when fallbackToGlobal is set', () => {
    let captured: Document | null = null;
    const Probe = (): React.ReactElement => {
      captured = useHostDocument({ fallbackToGlobal: true });
      return React.createElement('div');
    };
    mount(React.createElement(Probe));
    expect(captured).toBe(document);
  });

  it('returns the provided host document and its body for portals', () => {
    let capturedDoc: Document | null = null;
    let capturedBody: HTMLElement | null = null;
    const Probe = (): React.ReactElement => {
      capturedDoc = useHostDocument();
      capturedBody = usePortalContainer();
      return React.createElement('div');
    };
    mount(
      React.createElement(
        HostDocumentContext.Provider,
        { value: popoutDoc },
        React.createElement(Probe),
      ),
    );
    expect(capturedDoc).toBe(popoutDoc);
    expect(capturedBody).toBe(popoutDoc.body);
  });

  it('propagates a null context as render-nothing semantics', () => {
    let captured: Document | null = null;
    const Probe = (): React.ReactElement => {
      captured = useHostDocument({ fallbackToGlobal: true });
      return React.createElement('div');
    };
    mount(
      React.createElement(
        HostDocumentContext.Provider,
        { value: null },
        React.createElement(Probe),
      ),
    );
    expect(captured).toBeNull();
  });
});
