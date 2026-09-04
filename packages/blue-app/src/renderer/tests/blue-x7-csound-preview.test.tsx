// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBlueX7Voice } from '@blue/data';
import { CsoundPanel } from '../components/instruments/blue-x7/csound-panel';

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Csound Post Code"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('CsoundPanel', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onApplyPatch = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onApplyPatch.mockClear();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it('renders Post Code header, description, and editor textarea, and dispatches patches', () => {
    const voice = createDefaultBlueX7Voice();
    voice.csoundPostCode = 'blueMixerOut aout, aout';

    act(() => {
      root?.render(<CsoundPanel voice={voice} onApplyPatch={onApplyPatch} />);
    });

    const header = container?.querySelector('span.text-role-headline');
    expect(header?.textContent).toBe('Post Code');

    const textarea = container?.querySelector(
      'textarea[aria-label="Csound Post Code"]',
    ) as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('blueMixerOut aout, aout');

    act(() => {
      setInputValue(textarea, 'outs aout, aout');
    });

    expect(onApplyPatch).toHaveBeenCalledWith('Edit Csound Post-Code', {
      type: 'setCsoundPostCode',
      text: 'outs aout, aout',
    });
  });

  it('does not render sub-tab buttons or preview/diagnostics panes', () => {
    const voice = createDefaultBlueX7Voice();

    act(() => {
      root?.render(<CsoundPanel voice={voice} onApplyPatch={onApplyPatch} />);
    });

    expect(container?.querySelector('[role="tablist"]')).toBeNull();
    expect(container?.querySelector('button[aria-label="Csound Preview Tab"]')).toBeNull();
    expect(container?.querySelector('button[aria-label="Csound Bindings Tab"]')).toBeNull();
    expect(container?.querySelector('[data-testid="csound-tables-preview"]')).toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-bindings-tab"]')).toBeNull();
  });
});
