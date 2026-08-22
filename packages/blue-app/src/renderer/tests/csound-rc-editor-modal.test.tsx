// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CsoundRCEditorModal from '../components/workbench/panels/tools/CsoundRCEditorModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CsoundRCEditorModal', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockReadCsoundRC = vi.fn().mockResolvedValue({
    filePath: '/Users/test/.csound7rc',
    content: '-m0 -d -W',
  });
  const mockWriteCsoundRC = vi.fn().mockResolvedValue({
    success: true,
    filePath: '/Users/test/.csound7rc',
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      readCsoundRC: mockReadCsoundRC,
      writeCsoundRC: mockWriteCsoundRC,
    };
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
    vi.clearAllMocks();
  });

  it('renders modal when blue-open-csoundrc-editor is dispatched, loads content and saves on submit', async () => {
    act(() => {
      root!.render(<CsoundRCEditorModal />);
    });

    expect(document.querySelector('h2')?.textContent).toBeUndefined();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-csoundrc-editor'));
    });

    expect(document.querySelector('h2')?.textContent).toBe('.csound7rc Editor');
    expect(mockReadCsoundRC).toHaveBeenCalledTimes(1);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('-m0 -d -W');
    expect(document.body.textContent).toContain('/Users/test/.csound7rc');

    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeSetter?.call(textarea, '-m0 -d -W -o dac');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveBtn = Array.from(document.querySelectorAll('button')).find((btn) => btn.textContent === 'Save');
    expect(saveBtn).not.toBeUndefined();

    await act(async () => {
      saveBtn!.click();
    });

    expect(mockWriteCsoundRC).toHaveBeenCalledWith('-m0 -d -W -o dac');
  });
});
