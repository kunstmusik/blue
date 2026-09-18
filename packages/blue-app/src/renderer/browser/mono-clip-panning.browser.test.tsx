import React, { act } from 'react';
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

/**
 * Browser-level verification for Spec 112 T075 (US3/US2): real Chromium
 * focus, keyboard, and checkbox semantics for the mixer Pan control
 * and the Score Settings Enable Panning checkbox.
 */
describe('Mono clip panning browser tests (T075)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /** Remounts fresh content (a root cannot render again after unmount). */
  function mount(element: React.ReactElement): void {
    act(() => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(element);
    });
  }

  function renderSlider(props: Partial<React.ComponentProps<typeof MixerPanSlider>> = {}): void {
    mount(<MixerPanSlider channelName="Track 1" pan={0.5} {...props} />);
  }

  function slider(): HTMLInputElement {
    return container.querySelector<HTMLInputElement>('input[type="range"]')!;
  }

  function pressKey(key: string, options: KeyboardEventInit = {}): void {
    act(() => {
      slider().dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }),
      );
    });
  }

  it('keeps the Pan heading while disclosing the effective law accessibly', () => {
    renderSlider({ positionMode: 'pan' });
    expect(slider().getAttribute('aria-label')).toBe('Track 1 Mono Pan');
    expect(slider().getAttribute('aria-valuetext')).toContain('Mono Pan');
    expect(slider().getAttribute('title')).toBe('Mono Pan control');

    renderSlider({ positionMode: 'balance' });
    expect(slider().getAttribute('aria-label')).toBe('Track 1 Stereo Balance');
    expect(slider().getAttribute('aria-valuetext')).toContain('Stereo Balance');
    expect(slider().getAttribute('title')).toBe('Stereo Balance control');
    expect(container.textContent).toBe('Pan');
  });

  it('keeps the value out of the strip while exposing it through aria values', () => {
    renderSlider({ pan: 0.5, positionMode: 'pan' });
    expect(formatPanDisplay(0.5)).toBe('C');
    expect(slider().value).toBe('0.5');
    expect(slider().min).toBe('0');
    expect(slider().max).toBe('1');
    expect(slider().step).toBe('0.01');
    expect(slider().getAttribute('aria-valuetext')).toBe('Mono Pan C (0.50)');
    expect(container.textContent).toBe('Pan');
  });

  it('edits the range with Arrow keys, Shift coarser steps, and Home/End', () => {
    const onCommit = vi.fn();
    renderSlider({ pan: 0.5, positionMode: 'pan', onCommit });

    slider().focus();
    expect(document.activeElement).toBe(slider());

    // The control is prop-driven: every gesture is relative to the committed
    // value (0.5), with Shift giving a coarser 0.05 step.
    pressKey('ArrowRight');
    expect(onCommit).toHaveBeenLastCalledWith(0.51);
    pressKey('ArrowRight', { shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith(0.55);
    pressKey('ArrowLeft');
    expect(onCommit).toHaveBeenLastCalledWith(0.49);
    pressKey('ArrowLeft', { shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith(0.45);
    pressKey('Home');
    expect(onCommit).toHaveBeenLastCalledWith(0);
    pressKey('End');
    expect(onCommit).toHaveBeenLastCalledWith(1);

    // Movement past the endpoints clamps to the accessible 0..1 range.
    renderSlider({ pan: 1, onCommit });
    slider().focus();
    pressKey('ArrowRight');
    expect(onCommit).toHaveBeenLastCalledWith(1);
    pressKey('ArrowRight', { shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith(1);
  });

  it('is inactive when score panning is disabled: not tabbable and non-interactive', () => {
    const onCommit = vi.fn();
    renderSlider({ disabled: true, onCommit });

    expect(slider().disabled).toBe(true);
    expect(slider().getAttribute('tabindex')).toBeNull();

    pressKey('ArrowRight');
    pressKey('Home');
    pressKey('End');
    expect(onCommit).not.toHaveBeenCalled();

    // The whole section is non-interactive for pointer users as well.
    const section = container.querySelector('.mixer-pan-section')!;
    expect(section.className).toContain('pointer-events-none');
  });

  it('renders the Score Settings Enable Panning checkbox with real click semantics', () => {
    const onPanningChange = vi.fn();
    const score = createEmptyScoreDocumentSnapshot();
    expect(score.panningEnabled).toBe(true);

    mount(
      <ScoreSettingsDialog
        score={score}
        mixerEnabled={true}
        legacyNotice={false}
        onModeChange={() => {}}
        onPanningChange={onPanningChange}
        onClose={() => {}}
      />,
    );

    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Enable Panning"]',
    )!;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);

    act(() => {
      checkbox.click();
    });
    expect(onPanningChange).toHaveBeenCalledWith(false);

    // The dialog is a controlled view: the saved state drives the box, so a
    // disabled score renders it unchecked without having mutated anything.
    mount(
      <ScoreSettingsDialog
        score={{ ...score, panningEnabled: false }}
        mixerEnabled={true}
        legacyNotice={false}
        onModeChange={() => {}}
        onPanningChange={onPanningChange}
        onClose={() => {}}
      />,
    );
    const reopened = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Enable Panning"]',
    )!;
    expect(reopened.checked).toBe(false);
  });
});
