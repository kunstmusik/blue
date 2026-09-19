import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MixerPanSlider,
  formatPanDisplay,
} from '../components/workbench/panels/mixer/MixerPanSlider';
import { MixerSettingsDialog } from '../components/workbench/panels/mixer/MixerSettingsDialog';
import { createEmptyMixerSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Browser-level verification for Spec 112 T075 (US3/US2): real Chromium
 * focus, keyboard, and checkbox semantics for the mixer Pan control
 * and the Mixer Settings panning controls.
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

  function emitNativeValue(element: HTMLInputElement, value: string): void {
    act(() => {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function renderMixerSettings(
    props: Partial<React.ComponentProps<typeof MixerSettingsDialog>> = {},
  ): void {
    const mixer = props.mixer ?? createEmptyMixerSnapshot();
    mount(
      <MixerSettingsDialog
        isOpen={true}
        enableMeters={true}
        mixer={mixer}
        onToggleEnableMeters={() => {}}
        onToggleEnablePanning={() => {}}
        onPanLawChange={() => {}}
        onPanBoostChange={() => {}}
        onClose={() => {}}
        {...props}
      />,
    );
  }

  function mixerDialog(): HTMLElement {
    return document.body.querySelector<HTMLElement>('[role="dialog"]')!;
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

  it('commits values delivered by the native range input', () => {
    const onCommit = vi.fn();
    renderSlider({
      pan: 0.5,
      positionMode: 'pan',
      gestureHandlers: { pan: { onCommit } },
    });

    slider().focus();
    expect(document.activeElement).toBe(slider());

    emitNativeValue(slider(), '0.51');
    expect(onCommit).toHaveBeenLastCalledWith(0.51);
    emitNativeValue(slider(), '0');
    expect(onCommit).toHaveBeenLastCalledWith(0);
    emitNativeValue(slider(), '1');
    expect(onCommit).toHaveBeenLastCalledWith(1);

    // Movement past the endpoints clamps to the accessible 0..1 range.
    renderSlider({ pan: 1, gestureHandlers: { pan: { onCommit } } });
    slider().focus();
    emitNativeValue(slider(), '1');
    expect(onCommit).toHaveBeenLastCalledWith(1);
    emitNativeValue(slider(), '1');
    expect(onCommit).toHaveBeenLastCalledWith(1);
  });

  it('is inactive when mixer panning is disabled: not tabbable and non-interactive', () => {
    const onCommit = vi.fn();
    renderSlider({ disabled: true, gestureHandlers: { pan: { onCommit } } });

    expect(slider().disabled).toBe(true);
    expect(slider().getAttribute('tabindex')).toBeNull();

    emitNativeValue(slider(), '0.25');
    expect(onCommit).not.toHaveBeenCalled();

    // The whole section is non-interactive for pointer users as well.
    const section = container.querySelector('.mixer-pan-section')!;
    expect(section.className).toContain('pointer-events-none');
  });

  it('renders the Mixer Settings Enable Panning checkbox with real click semantics', () => {
    const onPanningChange = vi.fn();
    const mixer = createEmptyMixerSnapshot();
    expect(mixer.panningEnabled).toBe(true);

    renderMixerSettings({ mixer, onToggleEnablePanning: onPanningChange });

    const checkbox = mixerDialog().querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Enable Panning"]',
    )!;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);

    act(() => {
      checkbox.click();
    });
    expect(onPanningChange).toHaveBeenCalledWith(false);

    // The dialog is a controlled view: the saved state drives the box, so a
    // disabled mixer renders it unchecked without having mutated anything.
    renderMixerSettings({
      mixer: { ...mixer, panningEnabled: false },
      onToggleEnablePanning: onPanningChange,
    });
    const reopened = mixerDialog().querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Enable Panning"]',
    )!;
    expect(reopened.checked).toBe(false);
  });

  it('renders Mixer Settings pan law choices and off-center boost with defaults and accessible explanations', () => {
    const onPanLawChange = vi.fn();
    const onPanBoostChange = vi.fn();
    const mixer = createEmptyMixerSnapshot();

    expect(mixer.panLawDb).toBe(-3);
    expect(mixer.panOffCenterBoost).toBe(false);

    renderMixerSettings({ mixer, onPanLawChange, onPanBoostChange });

    // Default law (-3 dB) is selected
    const dialog = mixerDialog();
    const lawGroup = dialog.querySelector('[role="radiogroup"][aria-label="Mixer pan law"]')!;
    expect(lawGroup).not.toBeNull();
    const defaultRadio = lawGroup.querySelector('[role="radio"][aria-checked="true"]')!;
    expect(defaultRadio.textContent).toBe('-3 dB (Default)');

    // Accessible description of affected channels and default
    expect(dialog.textContent).toContain(
      'Governs center attenuation for Mono Pan and true-stereo (Stereo Pan and Dual Pan) source-side panners. Balance channels are unaffected.',
    );
    expect(dialog.textContent).toContain('-3 dB is the default equal-power law.');

    // Off-center boost default is unchecked
    const boostCheckbox = dialog.querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Off-center boost"]',
    )!;
    expect(boostCheckbox).not.toBeNull();
    expect(boostCheckbox.checked).toBe(false);

    // Clicking a different law calls onPanLawChange
    const law0Button = Array.from(
      lawGroup.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    ).find((btn) => btn.textContent === '0 dB')!;
    act(() => {
      law0Button.click();
    });
    expect(onPanLawChange).toHaveBeenCalledWith(0);

    // Clicking boost checkbox calls onPanBoostChange
    act(() => {
      boostCheckbox.click();
    });
    expect(onPanBoostChange).toHaveBeenCalledWith(true);
  });

  it('navigates pan law radio choices via keyboard Arrow keys', () => {
    const onPanLawChange = vi.fn();
    const mixer = createEmptyMixerSnapshot(); // panLawDb is -3

    renderMixerSettings({ mixer, onPanLawChange });

    const lawGroup = mixerDialog().querySelector(
      '[role="radiogroup"][aria-label="Mixer pan law"]',
    )!;
    // In PAN_LAW_OPTIONS: [0, -3, -4.5, -6]
    // Current is index 1 (-3). ArrowRight should go to index 2 (-4.5)
    act(() => {
      lawGroup.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
    });
    expect(onPanLawChange).toHaveBeenCalledWith(-4.5);

    // ArrowLeft from -3 should go to index 0 (0)
    act(() => {
      lawGroup.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
      );
    });
    expect(onPanLawChange).toHaveBeenCalledWith(0);
  });

  it('displays clipping risk warning when off-center boost is enabled for non-zero law', () => {
    const mixer = {
      ...createEmptyMixerSnapshot(),
      panLawDb: -6 as const,
      panOffCenterBoost: true,
    };

    renderMixerSettings({ mixer });

    const warning = mixerDialog().querySelector('[role="status"]');
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain(
      'Warning: Off-center boost raises endpoint gains up to 6 dB',
    );
    expect(warning?.textContent).toContain('boosted signals may clip');
  });

  it('preserves pan law and boost as future-intent settings when panning is disabled', () => {
    const onPanLawChange = vi.fn();
    const onPanBoostChange = vi.fn();
    const mixer = {
      ...createEmptyMixerSnapshot(),
      panningEnabled: false,
      panLawDb: -4.5 as const,
      panOffCenterBoost: false,
    };

    renderMixerSettings({ mixer, onPanLawChange, onPanBoostChange });

    // Explains future intent
    const dialog = mixerDialog();
    const note = dialog.querySelector('[role="note"]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain(
      'Panning is currently disabled. Pan law and boost settings reflect future intent and will apply once Enable Panning is turned on.',
    );

    // Controls remain interactive to configure future intent
    const lawGroup = dialog.querySelector('[role="radiogroup"][aria-label="Mixer pan law"]')!;
    const radioSelected = lawGroup.querySelector('[role="radio"][aria-checked="true"]');
    expect(radioSelected?.textContent).toBe('-4.5 dB');

    const law0Button = Array.from(
      lawGroup.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    ).find((btn) => btn.textContent === '0 dB')!;
    act(() => {
      law0Button.click();
    });
    expect(onPanLawChange).toHaveBeenCalledWith(0);

    const boostCheckbox = dialog.querySelector<HTMLInputElement>(
      'input[type="checkbox"][aria-label="Off-center boost"]',
    )!;
    act(() => {
      boostCheckbox.click();
    });
    expect(onPanBoostChange).toHaveBeenCalledWith(true);
  });

  describe('Complete Stereo Mixer Panning Browser Tests (Spec 113 T022)', () => {
    it('renders mode selector with Balance, Stereo Pan, and Dual Pan options for two-bus channels', () => {
      const onModeChange = vi.fn();
      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'balance',
        onModeChange,
      });

      const modeSelect = container.querySelector<HTMLSelectElement>(
        'select[aria-label="Track 1 Pan Mode"]',
      )!;
      expect(modeSelect).not.toBeNull();
      expect(modeSelect.value).toBe('balance');

      const options = Array.from(modeSelect.options).map((o) => ({
        value: o.value,
        text: o.text,
      }));
      expect(options).toEqual([
        { value: 'balance', text: 'Balance' },
        { value: 'stereoPan', text: 'Stereo Pan' },
        { value: 'dualPan', text: 'Dual Pan' },
      ]);

      // Change mode to stereoPan
      act(() => {
        modeSelect.value = 'stereoPan';
        modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onModeChange).toHaveBeenCalledWith('stereoPan');

      // Change mode to dualPan
      act(() => {
        modeSelect.value = 'dualPan';
        modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onModeChange).toHaveBeenCalledWith('dualPan');
    });

    it('presents Mono Pan ONLY without mode selector when channel is verified mono', () => {
      const onModeChange = vi.fn();
      renderSlider({
        positionMode: 'pan',
        onModeChange,
      });

      // No mode selector on verified mono channels
      const modeSelect = container.querySelector('select[aria-label="Track 1 Pan Mode"]');
      expect(modeSelect).toBeNull();

      // Only Mono Pan slider is rendered
      const panSlider = container.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Track 1 Mono Pan"]',
      )!;
      expect(panSlider).not.toBeNull();

      // No true-stereo warning
      expect(container.querySelector('[role="status"]')).toBeNull();
    });

    it('renders Stereo Pan controls with Position and Width sliders and effective-width disclosure', () => {
      const onCommit = vi.fn();
      const onCommitWidth = vi.fn();
      const onModeChange = vi.fn();

      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'stereoPan',
        pan: 0.5,
        panWidth: 1.0,
        onModeChange,
        gestureHandlers: {
          pan: { onCommit },
          panWidth: { onCommit: onCommitWidth },
        },
      });

      const posSlider = container.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Track 1 Stereo Pan Position"]',
      )!;
      const widthSlider = container.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Track 1 Stereo Pan Width"]',
      )!;
      expect(posSlider).not.toBeNull();
      expect(widthSlider).not.toBeNull();
      expect(posSlider.value).toBe('0.5');
      expect(widthSlider.value).toBe('1');
      expect(
        container.querySelector('[role="note"][aria-label="Track 1 Stereo Pan peak disclosure"]'),
      ).toBeNull();

      // Native range operation on Width slider
      emitNativeValue(widthSlider, '0.99');
      expect(onCommitWidth).toHaveBeenCalledWith(0.99);

      emitNativeValue(widthSlider, '0');
      expect(onCommitWidth).toHaveBeenCalledWith(0);

      // Effective-width disclosure near endpoint (pan = 0.1, width = 1.0 -> d = 0.1, effective width = 20%)
      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'stereoPan',
        pan: 0.1,
        panWidth: 1.0,
        onModeChange,
      });
      const disclosure = container.querySelector(
        '[role="note"][aria-label="Track 1 Effective Width"]',
      )!;
      expect(disclosure).not.toBeNull();
      expect(disclosure.textContent).toBe('Effective width: 20%');

      // Hard endpoint pan = 0 -> effective width = 0%
      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'stereoPan',
        pan: 0.0,
        panWidth: 1.0,
        onModeChange,
      });
      const endDisclosure = container.querySelector(
        '[role="note"][aria-label="Track 1 Effective Width"]',
      )!;
      expect(endDisclosure).not.toBeNull();
      expect(endDisclosure.textContent).toBe('Effective width: 0%');
    });

    it('renders Dual Pan controls with independent Left and Right sliders', () => {
      const onCommitDualLeft = vi.fn();
      const onCommitDualRight = vi.fn();
      const onModeChange = vi.fn();

      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'dualPan',
        dualPanLeft: 0.0,
        dualPanRight: 1.0,
        onModeChange,
        gestureHandlers: {
          dualPanLeft: { onCommit: onCommitDualLeft },
          dualPanRight: { onCommit: onCommitDualRight },
        },
      });

      const leftSlider = container.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Track 1 Dual Pan Left"]',
      )!;
      const rightSlider = container.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Track 1 Dual Pan Right"]',
      )!;
      expect(leftSlider).not.toBeNull();
      expect(rightSlider).not.toBeNull();
      expect(leftSlider.value).toBe('0');
      expect(rightSlider.value).toBe('1');
      expect(
        container.querySelector('[role="note"][aria-label="Track 1 Dual Pan peak disclosure"]'),
      ).toBeNull();

      // Native range edit left slider
      emitNativeValue(leftSlider, '0.01');
      expect(onCommitDualLeft).toHaveBeenCalledWith(0.01);

      // Native range edit right slider
      emitNativeValue(rightSlider, '0.99');
      expect(onCommitDualRight).toHaveBeenCalledWith(0.99);
    });

    it('preserves stored mode values across switches', () => {
      const onModeChange = vi.fn();
      // Start in Balance with non-default stored width and dual values
      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'balance',
        pan: 0.75,
        panWidth: 0.6,
        dualPanLeft: 0.25,
        dualPanRight: 0.85,
        onModeChange,
      });

      const balanceSlider = container.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Track 1 Stereo Balance"]',
      )!;
      expect(balanceSlider.value).toBe('0.75');

      // Switch to Stereo Pan: receives preserved pan (0.75) and panWidth (0.6)
      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'stereoPan',
        pan: 0.75,
        panWidth: 0.6,
        dualPanLeft: 0.25,
        dualPanRight: 0.85,
        onModeChange,
      });
      expect(
        container.querySelector<HTMLInputElement>(
          'input[type="range"][aria-label="Track 1 Stereo Pan Position"]',
        )!.value,
      ).toBe('0.75');
      expect(
        container.querySelector<HTMLInputElement>(
          'input[type="range"][aria-label="Track 1 Stereo Pan Width"]',
        )!.value,
      ).toBe('0.6');

      // Switch to Dual Pan: receives preserved dualPanLeft (0.25) and dualPanRight (0.85)
      renderSlider({
        positionMode: 'balance',
        stereoPanMode: 'dualPan',
        pan: 0.75,
        panWidth: 0.6,
        dualPanLeft: 0.25,
        dualPanRight: 0.85,
        onModeChange,
      });
      expect(
        container.querySelector<HTMLInputElement>(
          'input[type="range"][aria-label="Track 1 Dual Pan Left"]',
        )!.value,
      ).toBe('0.25');
      expect(
        container.querySelector<HTMLInputElement>(
          'input[type="range"][aria-label="Track 1 Dual Pan Right"]',
        )!.value,
      ).toBe('0.85');
    });
  });
});
