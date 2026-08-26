// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSelect } from '../components/AppSelect';
import { HostDocumentContext } from '../hooks/use-host-document';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;

for (const elementPrototype of [Element.prototype, popout.window.Element.prototype]) {
  elementPrototype.hasPointerCapture ??= () => false;
  elementPrototype.setPointerCapture ??= () => undefined;
  elementPrototype.releasePointerCapture ??= () => undefined;
}
for (const htmlElementPrototype of [HTMLElement.prototype, popout.window.HTMLElement.prototype]) {
  htmlElementPrototype.scrollIntoView ??= () => undefined;
}

describe('AppSelect', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onValueChange = vi.fn();

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    onValueChange.mockReset();
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <AppSelect
            aria-label="Waveform"
            value="sine"
            options={[
              { value: 'sine', label: 'Sine' },
              { value: 'square', label: 'Square' },
              { value: 'noise', label: 'Noise', disabled: true },
            ]}
            onValueChange={onValueChange}
          />
        </HostDocumentContext.Provider>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  it('portals its app-styled listbox into the hosting document', async () => {
    const trigger = host.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    expect(trigger.textContent).toContain('Sine');

    await act(async () => {
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const listbox = popoutDoc.querySelector<HTMLElement>('[role="listbox"]');
    expect(listbox).toBeTruthy();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(listbox!.closest('[data-auxiliary-portal="true"]')).toBeTruthy();
    expect(popoutDoc.querySelector('[role="option"][aria-disabled="true"]')).toBeTruthy();
  });

  it('reports selection through its controlled-value interface', async () => {
    const trigger = host.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    await act(async () => {
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(popoutDoc.querySelector('[role="listbox"]')).toBeTruthy();
    const squareOption = popoutDoc.querySelectorAll<HTMLElement>('[role="option"]')[1];
    expect(squareOption?.textContent).toContain('Square');
    await act(async () => {
      squareOption!.dispatchEvent(new popout.window.MouseEvent('click', { bubbles: true, button: 0 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onValueChange).toHaveBeenCalledWith('square');
  });
});
