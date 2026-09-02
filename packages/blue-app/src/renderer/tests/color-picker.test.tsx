// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import ColorPickerButton, {
  ColorPickerPopover,
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
    expect(document.querySelector('[role="dialog"]')?.classList).toContain('text-role-body');

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

  it('portals the popover into the anchor element document (floating workbench panels)', () => {
    const popout = new JSDOM('<!doctype html><html><body><button id="anchor"></button></body></html>');
    const popoutDoc = popout.window.document;
    const anchorElement = popoutDoc.getElementById('anchor')!;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root.render(
        <ColorPickerPopover
          open
          value="#336699"
          anchor={{ left: 10, right: 40, top: 10, bottom: 40 }}
          anchorElement={anchorElement}
          onChange={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const dialogInPopout = popoutDoc.querySelector('[role="dialog"][aria-label="Color picker"]');
    expect(dialogInPopout).toBeTruthy();
    expect(dialogInPopout!.closest('body')).toBe(popoutDoc.body);
    expect(document.querySelector('[role="dialog"][aria-label="Color picker"]')).toBeNull();

    // Portal children are created by the popout document, so they live in a
    // different realm from this module. Dismissal must still treat mousedowns
    // inside the popover as internal, and must listen on the anchor document.
    const onClose = vi.fn();
    act(() => {
      root.render(
        <ColorPickerPopover
          open
          value="#336699"
          anchor={{ left: 10, right: 40, top: 10, bottom: 40 }}
          anchorElement={anchorElement}
          onChange={vi.fn()}
          onClose={onClose}
        />,
      );
    });
    const PopoutMouseEvent = popout.window.MouseEvent;
    const hueSlider = dialogInPopout!.querySelector('input[aria-label="Hue"]') as HTMLElement | null;
    expect(hueSlider).toBeTruthy();
    act(() => {
      hueSlider!.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('binds Escape to the anchor element document (floating workbench panels)', () => {
    const popout = new JSDOM('<!doctype html><html><body><button id="anchor"></button></body></html>');
    const popoutDoc = popout.window.document;
    const anchorElement = popoutDoc.getElementById('anchor')!;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    const onClose = vi.fn();
    act(() => {
      root.render(
        <ColorPickerPopover
          open
          value="#336699"
          anchor={{ left: 10, right: 40, top: 10, bottom: 40 }}
          anchorElement={anchorElement}
          onChange={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    const PopoutKeyboardEvent = popout.window.KeyboardEvent;
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      popoutDoc.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops pointer events from bubbling to ancestors behind the popover', () => {
    // React portals bubble synthetic events along the REACT tree: without a
    // guard, pressing the picker's sliders/presets reaches ancestor handlers
    // (e.g., the score canvas surface selection handlers) and selects objects
    // sitting visually behind the popover.
    const events: string[] = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    const anchorElement = document.createElement('button');
    document.body.appendChild(anchorElement);

    function SurfaceSpy({ children }: { children: React.ReactNode }): React.ReactElement {
      return (
        <div
          onMouseDown={(e) => { events.push('mousedown'); e.preventDefault(); }}
          onMouseUp={(e) => { events.push('mouseup'); }}
          onClick={(e) => { events.push('click'); }}
        >
          {children}
        </div>
      );
    }

    act(() => {
      root.render(
        <SurfaceSpy>
          <ColorPickerPopover
            open
            value="#336699"
            anchor={{ left: 10, right: 40, top: 10, bottom: 40 }}
            anchorElement={anchorElement}
            onChange={vi.fn()}
            onClose={vi.fn()}
          />
        </SurfaceSpy>,
      );
    });

    const hueSlider = document.querySelector('input[aria-label="Hue"]') as HTMLElement;
    expect(hueSlider).toBeTruthy();
    act(() => {
      hueSlider.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      hueSlider.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      hueSlider.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(events).toEqual([]);
  });
});
