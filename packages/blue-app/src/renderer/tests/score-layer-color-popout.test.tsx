// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColorPickerButton from '../components/ColorPicker';
import { HostDocumentContext } from '../hooks/use-host-document';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Score Layer Color Popout & Host Placement (T046)', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = '';
  });

  it('renders ColorPickerButton inside HostDocumentProvider with accessible label and keyboard interaction', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    const handleChange = vi.fn();
    const handleGestureComplete = vi.fn();

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={document}>
          <ColorPickerButton
            value="#404040"
            onChange={handleChange}
            onGestureComplete={handleGestureComplete}
            ariaLabel="Layer color for Layer 1"
            title="Layer color: Layer 1"
          />
        </HostDocumentContext.Provider>
      );
    });

    const button = host.querySelector('button[aria-label="Layer color for Layer 1"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.getAttribute('title')).toBe('Layer color: Layer 1');

    // Trigger open via click
    act(() => {
      button?.click();
    });

    // Popover content should be portaled into document.body (the host document)
    const popoverContent = document.body.querySelector('[role="dialog"]');
    expect(popoverContent).not.toBeNull();

    // Trigger Escape to dismiss
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });

  it('portals into custom floating popout document and renders safely', () => {
    const popoutDoc = document.implementation.createHTMLDocument('Floated Score Panel');
    host = popoutDoc.createElement('div');
    popoutDoc.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <ColorPickerButton
            value="#ff0000"
            onChange={vi.fn()}
            ariaLabel="Floating Layer Color"
          />
        </HostDocumentContext.Provider>
      );
    });

    const button = host.querySelector('button[aria-label="Floating Layer Color"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    // Open popup
    act(() => {
      button?.click();
    });

    // Should portal into the custom popoutDoc, NOT window.document
    const popoutContent = popoutDoc.body.querySelector('[role="dialog"]');
    expect(popoutContent).not.toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
