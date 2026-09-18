// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MixerPanSlider,
  formatPanDisplay,
} from '../components/workbench/panels/mixer/MixerPanSlider';
import ScoreSettingsDialog from '../components/workbench/panels/score/ScoreSettingsDialog';
import { createEmptyScoreDocumentSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('MixerPanSlider accessibility and interaction (T043, T050, T065)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    if (typeof ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as typeof ResizeObserver;
    }
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

  it('formats pan display correctly for center, left, and right', () => {
    expect(formatPanDisplay(0.5)).toBe('C');
    expect(formatPanDisplay(0.25)).toBe('L50');
    expect(formatPanDisplay(0.75)).toBe('R50');
    expect(formatPanDisplay(0)).toBe('L100');
    expect(formatPanDisplay(1)).toBe('R100');
  });

  it('provides accessible role and attributes for Pan mode', () => {
    act(() => {
      root.render(<MixerPanSlider channelName="Vocal" pan={0.5} positionMode="pan" />);
    });

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider).not.toBeNull();
    expect(slider.type).toBe('range');
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('1');
    expect(slider.step).toBe('0.01');
    expect(slider.getAttribute('aria-label')).toBe('Vocal Mono Pan');
    expect(slider.value).toBe('0.5');
    expect(slider.getAttribute('aria-valuetext')).toContain('Mono Pan C');
    expect(container.textContent).toContain('Pan');
    expect(container.textContent).not.toContain('C');
  });

  it('uses the centered Pan label for balance-law channels while retaining the value announcement', () => {
    act(() => {
      root.render(<MixerPanSlider channelName="Stereo Synth" pan={0.25} positionMode="balance" />);
    });

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider).not.toBeNull();
    expect(slider.getAttribute('aria-label')).toBe('Stereo Synth Stereo Balance');
    expect(slider.value).toBe('0.25');
    expect(slider.getAttribute('aria-valuetext')).toContain('Stereo Balance L50');
    expect(container.textContent).toContain('Pan');
    expect(container.textContent).not.toContain('L50');
  });

  it('shows the value in a React tooltip on hover and updates it during a drag', () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerPanSlider
          channelName="Vocal"
          pan={0.5}
          positionMode="pan"
          onPreview={onPreview}
          onCommit={onCommit}
        />,
      );
    });

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;

    act(() => {
      slider.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Mono Pan: C (0.50)');

    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 50,
          pointerId: 1,
        }),
      );
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        slider,
        '0.75',
      );
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onPreview).toHaveBeenLastCalledWith(0.75);
    expect(document.body.textContent).toContain('Mono Pan: R50 (0.75)');
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          clientX: 75,
          pointerId: 1,
        }),
      );
    });
    expect(onCommit).toHaveBeenLastCalledWith(0.75);
  });

  it('handles keyboard navigation: ArrowLeft/ArrowRight, Home/End, and Shift steps', () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerPanSlider channelName="Vocal" pan={0.5} positionMode="pan" onCommit={onCommit} />,
      );
    });

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;

    // ArrowLeft: -0.01
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(0.49);

    // ArrowRight: +0.01
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(0.51);

    // Shift + ArrowLeft: -0.05
    act(() => {
      slider.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
      );
    });
    expect(onCommit).toHaveBeenLastCalledWith(0.45);

    // Shift + ArrowRight: +0.05
    act(() => {
      slider.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
      );
    });
    expect(onCommit).toHaveBeenLastCalledWith(0.55);

    // Home: 0
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(0);

    // End: 1
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(1);
  });

  it('resets to center (0.5) on double-click', () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerPanSlider channelName="Vocal" pan={0.2} positionMode="pan" onCommit={onCommit} />,
      );
    });

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    act(() => {
      slider.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onCommit).toHaveBeenLastCalledWith(0.5);
  });

  it('uses native disabled semantics when panning is disabled', () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(
        <MixerPanSlider channelName="Vocal" pan={0.5} disabled={true} onCommit={onCommit} />,
      );
    });

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider.disabled).toBe(true);
    expect(slider.getAttribute('tabindex')).toBeNull();

    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ScoreSettingsDialog renders Enable Panning checkbox and notifies onPanningChange', () => {
    const onPanningChange = vi.fn();
    const score = createEmptyScoreDocumentSnapshot();
    expect(score.panningEnabled).toBe(true);

    act(() => {
      root.render(
        <ScoreSettingsDialog
          score={score}
          mixerEnabled={true}
          legacyNotice={false}
          onModeChange={() => {}}
          onPanningChange={onPanningChange}
          onClose={() => {}}
        />,
      );
    });

    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Enable Panning"]',
    )!;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);

    act(() => {
      checkbox.click();
    });
    expect(onPanningChange).toHaveBeenCalledWith(false);
  });
});
