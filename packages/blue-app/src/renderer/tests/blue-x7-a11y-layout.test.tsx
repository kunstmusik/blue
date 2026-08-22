// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBlueX7Voice } from '@blue/data';
import type { BlueX7InstrumentSnapshot } from '../../shared/project-editor';
import { BlueX7Editor } from '../components/instruments/blue-x7-editor';

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Csound Post Code"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlueX7 A11y, Keyboard Navigation & Responsive Layout', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onInstrumentPatch = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onInstrumentPatch.mockClear();
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

  const createSnapshot = (): BlueX7InstrumentSnapshot => ({
    id: 'test-x7',
    assignmentId: '1',
    type: 'blueX7',
    name: 'A11y Test Instrument',
    comment: 'Testing accessibility and responsiveness',
    enabled: true,
    voice: createDefaultBlueX7Voice(),
  });

  it('provides accessible names and ARIA attributes for all controls and panels', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
    });

    // Inputs with accessible names
    expect(container?.querySelector('input[aria-label="Instrument Name"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Instrument Enabled"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Instrument Comment"]')).not.toBeNull();
    expect(container?.querySelector('button[aria-label="Import DX7 SysEx File"]')).not.toBeNull();
    expect(container?.querySelector('button[aria-label="Undo BlueX7 edit"]')).not.toBeNull();
    expect(container?.querySelector('button[aria-label="Redo BlueX7 edit"]')).not.toBeNull();

    // Common panel
    expect(container?.querySelector('select[aria-label="Algorithm"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Feedback"]')).not.toBeNull();
    expect(container?.querySelector('input[aria-label="Key Transpose"]')).not.toBeNull();

    // Operator tabs & enables
    for (let i = 1; i <= 6; i++) {
      expect(container?.querySelector(`button[aria-label="Select Operator ${i}"]`)).not.toBeNull();
      expect(container?.querySelector(`button[aria-label="Toggle Operator ${i}"]`)).not.toBeNull();
    }
  });

  it('supports modal focus trap and escape key restoration for Algorithm dialog', () => {
    const snapshot = createSnapshot();

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
        />,
      );
    });

    const openModalBtn = container?.querySelector('button[aria-label="Choose Algorithm Dialog"]') as HTMLButtonElement;
    expect(openModalBtn).not.toBeNull();

    act(() => {
      openModalBtn.focus();
      openModalBtn.click();
    });

    const dialog = document.body.querySelector('[role="dialog"][aria-label="Select DX7 Algorithm"]');
    expect(dialog).not.toBeNull();
    const closeButton = dialog?.querySelector('button[aria-label="Close Algorithm Dialog"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);

    const dialogPanel = dialog?.querySelector('.flex.flex-col') as HTMLElement;
    const footerCloseButton = dialog?.querySelector('button:not([aria-label])') as HTMLButtonElement;
    footerCloseButton.focus();
    act(() => {
      dialogPanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(closeButton);

    // Escape closes dialog
    act(() => {
      dialogPanel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    const closedDialog = document.body.querySelector('[role="dialog"][aria-label="Select DX7 Algorithm"]');
    expect(closedDialog).toBeNull();
    expect(document.activeElement).toBe(openModalBtn);
  });

  it('renders within narrow 360px container without throwing or breaking layout', () => {
    const snapshot = createSnapshot();
    if (container) {
      container.style.width = '360px';
      container.style.height = '600px';
    }

    act(() => {
      root?.render(
        <div style={{ width: '360px', height: '600px', overflow: 'hidden' }}>
          <BlueX7Editor
            instrument={snapshot}
            onInstrumentPatch={onInstrumentPatch}
          />
        </div>,
      );
    });

    const editorRoot = container?.querySelector('[data-testid="blue-x7-editor"]');
    expect(editorRoot).not.toBeNull();
    expect(editorRoot?.classList.contains('overflow-y-auto')).toBe(true);
  });
});
