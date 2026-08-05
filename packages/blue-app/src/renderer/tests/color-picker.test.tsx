// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColorPickerButton, {
  computeColorPickerPosition,
} from '../components/ColorPicker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ColorPicker', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = '';
  });

  it('stays open through edits and closes only on outside interaction or Escape', () => {
    const onChange = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    function ControlledPicker(): React.ReactElement {
      const [value, setValue] = React.useState('#336699');
      return (
        <ColorPickerButton
          value={value}
          onChange={(nextValue) => {
            onChange(nextValue);
            setValue(nextValue);
          }}
          ariaLabel="Test color"
        />
      );
    }

    act(() => {
      root.render(<ControlledPicker />);
    });

    const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Test color"]')!;
    act(() => trigger.click());

    const hex = document.querySelector<HTMLInputElement>('[aria-label="Hex color"]')!;
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => {
      hex.value = '#654321';
      hex.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('#654321');
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => {
      document.querySelector<HTMLButtonElement>('[aria-label="Set color #ef4444"]')!.click();
    });
    expect(onChange).toHaveBeenCalledWith('#ef4444');
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    const hue = document.querySelector<HTMLInputElement>('[aria-label="Hue"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(hue, '180');
      hue.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('#43efef');
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => {
      document.querySelector('[role="dialog"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => trigger.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    act(() => trigger.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('places the popup below when it fits and above when lower space is insufficient', () => {
    expect(computeColorPickerPosition(
      { left: 100, right: 120, top: 100, bottom: 120 },
      { width: 240, height: 260 },
      { width: 800, height: 800 },
    )).toEqual({ left: 8, top: 128, placement: 'bottom' });

    expect(computeColorPickerPosition(
      { left: 500, right: 520, top: 700, bottom: 720 },
      { width: 240, height: 260 },
      { width: 800, height: 800 },
    )).toEqual({ left: 390, top: 432, placement: 'top' });
  });
});
