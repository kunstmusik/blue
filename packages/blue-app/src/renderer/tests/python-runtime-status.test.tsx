// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JythonRuntimeStatusIndicator from '../components/workbench/panels/score-object/editors/JythonRuntimeStatusIndicator';

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

describe('JythonRuntimeStatusIndicator', () => {
  it('calls the preload Jython reinitialize action', async () => {
    const reinitializeJythonRuntime = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('window', {
      ...window,
      blueAPI: { reinitializeJythonRuntime },
    });

    await act(async () => {
      root.render(<JythonRuntimeStatusIndicator />);
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Reinitialize Jython',
    );

    await act(async () => {
      button?.click();
    });

    expect(reinitializeJythonRuntime).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Error:');
  });

  it('shows runtime errors returned by the Jython reinitialize action', async () => {
    const reinitializeJythonRuntime = vi.fn(async () => ({ ok: false, error: 'Jython runtime is unavailable' }));
    vi.stubGlobal('window', {
      ...window,
      blueAPI: { reinitializeJythonRuntime },
    });

    await act(async () => {
      root.render(<JythonRuntimeStatusIndicator />);
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Reinitialize Jython',
    );

    await act(async () => {
      button?.click();
    });

    expect(container.textContent).toContain('Jython runtime is unavailable');
  });
});