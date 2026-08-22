// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import FTableConverterModal from '../components/workbench/panels/tools/FTableConverterModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('FTableConverterModal', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    container = null;
    root = null;
  });

  it('renders modal when blue-open-ftable-converter event is dispatched and converts f-statements', () => {
    act(() => {
      root!.render(<FTableConverterModal />);
    });

    expect(document.querySelector('h2')?.textContent).toBeUndefined();

    act(() => {
      window.dispatchEvent(new CustomEvent('blue-open-ftable-converter'));
    });

    expect(document.querySelector('h2')?.textContent).toBe('FTable Converter');

    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBe(2);

    const inputArea = textareas[0] as HTMLTextAreaElement;
    const outputArea = textareas[1] as HTMLTextAreaElement;

    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeSetter?.call(inputArea, 'f 1 0 1024 10 1');
      inputArea.dispatchEvent(new Event('input', { bubbles: true }));
      inputArea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const convertBtn = Array.from(document.querySelectorAll('button')).find((btn) => btn.textContent === 'Convert to FTGEN');
    expect(convertBtn).not.toBeUndefined();

    act(() => {
      convertBtn!.click();
    });

    expect(outputArea.value).toBe('gi_\tftgen 0, 0, 1024, 10, 1');
  });
});
