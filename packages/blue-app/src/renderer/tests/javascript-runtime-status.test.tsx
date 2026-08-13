// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JavaScriptRuntimeStatusIndicator from '../components/workbench/panels/score-object/editors/JavaScriptRuntimeStatusIndicator';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe('JavaScriptRuntimeStatusIndicator', () => {
  it('calls the preload JavaScript reinitialize action', async () => {
    const reinitializeJavaScriptRuntime = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('window', {
      ...window,
      blueAPI: { reinitializeJavaScriptRuntime },
    });

    await act(async () => {
      root.render(<JavaScriptRuntimeStatusIndicator />);
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Reinitialize JavaScript',
    );

    await act(async () => {
      button?.click();
    });

    expect(reinitializeJavaScriptRuntime).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Error:');
  });

  it('shows runtime errors returned by the JavaScript reinitialize action', async () => {
    const reinitializeJavaScriptRuntime = vi.fn(async () => ({ ok: false, error: 'QuickJS is unavailable' }));
    vi.stubGlobal('window', {
      ...window,
      blueAPI: { reinitializeJavaScriptRuntime },
    });

    await act(async () => {
      root.render(<JavaScriptRuntimeStatusIndicator />);
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Reinitialize JavaScript',
    );

    await act(async () => {
      button?.click();
    });

    expect(container.textContent).toContain('QuickJS is unavailable');
  });
});
