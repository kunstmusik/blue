// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MixerLevelSlider } from '../components/workbench/panels/mixer/MixerLevelSlider';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('MixerLevelSlider interaction and accessibility', () => {
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
  });

  it('provides full dB-valued accessibility attributes', () => {
    act(() => {
      root.render(<MixerLevelSlider channelName="Lead" levelDb={-6.0} sliderHeight={120} />);
    });

    const slider = container.querySelector('[role="slider"]')!;
    expect(slider).not.toBeNull();
    expect(slider.getAttribute('aria-label')).toBe('Gain for Lead');
    expect(slider.getAttribute('aria-orientation')).toBe('vertical');
    expect(slider.getAttribute('aria-valuemin')).toBe('-96');
    expect(slider.getAttribute('aria-valuemax')).toBe('12');
    expect(slider.getAttribute('aria-valuenow')).toBe('-6');
    expect(slider.getAttribute('aria-valuetext')).toBe('-6.00 dB');
  });

  it('handles keyboard arrow increments of 0.1 dB and Shift/Page increments of 1.0 dB', () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider
          channelName="Lead"
          levelDb={-10.0}
          sliderHeight={120}
          onCommit={onCommit}
        />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;

    // ArrowUp: +0.1 dB
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(-9.9);

    // ArrowDown: -0.1 dB
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(-10.1);

    // Shift+ArrowUp: +1.0 dB
    act(() => {
      slider.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }),
      );
    });
    expect(onCommit).toHaveBeenLastCalledWith(-9.0);

    // Shift+ArrowDown: -1.0 dB
    act(() => {
      slider.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
      );
    });
    expect(onCommit).toHaveBeenLastCalledWith(-11.0);

    // PageUp: +1.0 dB
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(-9.0);

    // PageDown: -1.0 dB
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(-11.0);
  });

  it('normalizes keyboard step without wiping out extra precision', () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider
          channelName="Lead"
          levelDb={-7.1234}
          sliderHeight={120}
          onCommit={onCommit}
        />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(-7.0234);
  });

  it('handles Home and End keys for finite endpoints', () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider channelName="Lead" levelDb={0} sliderHeight={120} onCommit={onCommit} />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;

    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(-96);

    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(12);
  });

  it('resets to exactly 0 dB on double-click', () => {
    const onCommit = vi.fn();
    const onReset = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider
          channelName="Lead"
          levelDb={-14.5}
          sliderHeight={120}
          onCommit={onCommit}
          onDoubleClickReset={onReset}
        />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;
    act(() => {
      slider.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('performs relative pointer dragging with previews and one final commit on release', () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    act(() => {
      root.render(
        <MixerLevelSlider
          channelName="Lead"
          levelDb={0}
          sliderHeight={120}
          onPreview={onPreview}
          onCommit={onCommit}
          onCancel={onCancel}
        />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;

    // Pointer down at y = 50
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientY: 50,
          pointerId: 1,
        }),
      );
    });

    // Pointer move upwards by 20px (y = 30) -> gain increases
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientY: 30,
          pointerId: 1,
        }),
      );
    });

    expect(onPreview).toHaveBeenCalled();
    const previewVal = onPreview.mock.calls[0][0];
    expect(previewVal).toBeGreaterThan(0);

    // Pointer up -> commits the moved gain
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientY: 30,
          pointerId: 1,
        }),
      );
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(previewVal);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('restores exact initial value and cancels when returning exactly to starting pointer position', () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    act(() => {
      root.render(
        <MixerLevelSlider
          channelName="Lead"
          levelDb={-7.1234}
          sliderHeight={120}
          onPreview={onPreview}
          onCommit={onCommit}
          onCancel={onCancel}
        />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;

    // Pointer down at y = 50
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientY: 50,
          pointerId: 1,
        }),
      );
    });

    // Move away
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientY: 40,
          pointerId: 1,
        }),
      );
    });

    // Move back exactly to y = 50
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientY: 50,
          pointerId: 1,
        }),
      );
    });

    expect(onPreview).toHaveBeenLastCalledWith(-7.1234);

    // Release at starting point -> no durable change, calls onCancel
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientY: 50,
          pointerId: 1,
        }),
      );
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('cancels drag on Escape key', () => {
    const onCancel = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider channelName="Lead" levelDb={0} sliderHeight={120} onCancel={onCancel} />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;

    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientY: 50,
          pointerId: 1,
        }),
      );
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalled();
  });

  it('cancels drag on lostpointercapture or pointercancel', () => {
    const onCancel = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider channelName="Lead" levelDb={0} sliderHeight={120} onCancel={onCancel} />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;

    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientY: 50,
          pointerId: 1,
        }),
      );
      slider.dispatchEvent(
        new PointerEvent('lostpointercapture', {
          bubbles: true,
          pointerId: 1,
        }),
      );
    });

    expect(onCancel).toHaveBeenCalled();
  });

  it('cancels drag when control height changes mid-gesture', () => {
    const onCancel = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider channelName="Lead" levelDb={0} sliderHeight={120} onCancel={onCancel} />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;

    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientY: 50,
          pointerId: 1,
        }),
      );
    });

    // Re-render with new height mid-drag
    act(() => {
      root.render(
        <MixerLevelSlider channelName="Lead" levelDb={0} sliderHeight={200} onCancel={onCancel} />,
      );
    });

    expect(onCancel).toHaveBeenCalled();
  });

  it('ignores input when disabled during temporary settlement', () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerLevelSlider
          channelName="Lead"
          levelDb={0}
          sliderHeight={120}
          disabled={true}
          onPreview={onPreview}
          onCommit={onCommit}
        />,
      );
    });

    const slider = container.querySelector<HTMLDivElement>('[role="slider"]')!;
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    expect(slider.getAttribute('tabindex')).toBe('-1');

    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientY: 50,
          pointerId: 1,
        }),
      );
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });

    expect(onPreview).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
