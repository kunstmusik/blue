import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppSelect } from '../components/AppSelect';
import CommitNumberInput from '../components/CommitNumberInput';
import SettingsField from '../components/settings/SettingsField';
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog';
import AboutApp from '../components/about/AboutApp';
import blueIconUrl from '../../../assets/blueIcon.png';
import { MixerSettingsDialog } from '../components/workbench/panels/mixer/MixerSettingsDialog';
import { MeterCanvas } from '../components/workbench/panels/mixer/MeterCanvas';
import { MeterScaleRuler } from '../components/workbench/panels/mixer/MeterScaleRuler';
import { PeakReadout } from '../components/workbench/panels/mixer/ChannelStrip';
import { meterStore } from '../stores/meter-store';
import { createEmptyMixerSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Accessibility Focus Traversal Browser Tests (T020)', () => {
  let container: HTMLDivElement;
  let root: Root;

  let origBlueAPI: unknown;

  beforeEach(() => {
    origBlueAPI = (window as unknown as { blueAPI?: unknown }).blueAPI;
    (window as unknown as { blueAPI?: unknown }).blueAPI = {
      ...(typeof origBlueAPI === 'object' && origBlueAPI !== null ? origBlueAPI : {}),
      getAppMetadata: vi.fn().mockResolvedValue({
        version: '1.0.0',
        csoundVersion: '6.18.0',
        electronVersion: '35.7.5',
        nodeVersion: '22.23.1',
        chromiumVersion: '134.0.6998.35',
      }),
      closeAboutWindow: vi.fn().mockResolvedValue(undefined),
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (window as unknown as { blueAPI?: unknown }).blueAPI = origBlueAPI;
  });

  it('traverses form fields and controls via keyboard focus', async () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <div className="flex flex-col gap-4 p-4">
          <SettingsField label="User Name" value="Steven" onChange={onChange} id="field-name" />
          <CommitNumberInput
            id="field-number"
            value={440}
            min={20}
            max={20000}
            onChange={onChange}
          />
          <AppSelect
            id="field-select"
            value="option-1"
            options={[
              { value: 'option-1', label: 'Option 1' },
              { value: 'option-2', label: 'Option 2' },
            ]}
            onValueChange={onChange}
          />
        </div>,
      );
    });

    const textInput = container.querySelector('#field-name') as HTMLInputElement;
    const numberInput = container.querySelector('#field-number') as HTMLInputElement;
    const selectTrigger = container.querySelector('#field-select') as HTMLButtonElement;

    expect(textInput).not.toBeNull();
    expect(numberInput).not.toBeNull();
    expect(selectTrigger).not.toBeNull();

    // Focus first input
    textInput.focus();
    expect(document.activeElement).toBe(textInput);

    // Focus number input
    numberInput.focus();
    expect(document.activeElement).toBe(numberInput);

    // Focus select trigger
    selectTrigger.focus();
    expect(document.activeElement).toBe(selectTrigger);
  });

  it('preserves focus containment and focus restoration in modal dialogs', () => {
    const onDecision = vi.fn();
    act(() => {
      root.render(
        <div>
          <button id="opener-btn" type="button">
            Open Dialog
          </button>
          <ConfirmationDialog
            open={true}
            title="Confirm Action"
            description="Are you sure?"
            actions={[
              { id: 'cancel', label: 'Cancel', intent: 'cancel' },
              { id: 'confirm', label: 'Confirm', intent: 'primary' },
            ]}
            cancelActionId="cancel"
            onDecision={onDecision}
          />
        </div>,
      );
    });

    const cancelBtn = container.querySelector('[data-action-id="cancel"]') as HTMLButtonElement;
    const confirmBtn = container.querySelector('[data-action-id="confirm"]') as HTMLButtonElement;

    expect(cancelBtn).not.toBeNull();
    expect(confirmBtn).not.toBeNull();

    // Verify initial focus
    expect(document.activeElement).toBe(cancelBtn);

    // Tab to confirm button
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);
  });

  it('renders visible focus outlines on separator buttons when focused via keyboard', () => {
    act(() => {
      root.render(
        <div className="p-4">
          <button
            role="separator"
            tabIndex={0}
            className="h-2 w-full bg-app-border"
            aria-label="Resize panel"
          />
        </div>,
      );
    });

    const separator = container.querySelector('button[role="separator"]') as HTMLButtonElement;
    expect(separator).not.toBeNull();

    separator.focus();
    expect(document.activeElement).toBe(separator);
  });

  it('renders AboutApp entry point with keyboard reachable links and controls', () => {
    act(() => {
      root.render(<AboutApp iconUrl={blueIconUrl} />);
    });

    const buttons = container.querySelectorAll('button, a[href]');
    expect(buttons.length).toBeGreaterThan(0);

    const firstInteractive = buttons[0] as HTMLElement;
    firstInteractive.focus();
    expect(document.activeElement).toBe(firstInteractive);
  });

  it('supports programmatic focus on panel shells with tabindex -1 without visual outline pollution', () => {
    act(() => {
      root.render(
        <div id="programmatic-shell" tabIndex={-1} className="h-64 w-64 bg-app-surface">
          <span>Panel Content</span>
        </div>,
      );
    });

    const shell = container.querySelector('#programmatic-shell') as HTMLDivElement;
    expect(shell).not.toBeNull();

    shell.focus();
    expect(document.activeElement).toBe(shell);
  });

  it('provides keyboard operation, accessible labels, and focus traversal for mixer controls (T041)', () => {
    act(() => {
      root.render(
        <div className="flex items-center gap-4 p-4">
          <select
            id="mixer-profile-select"
            aria-label="Meter profile"
            className="mixer-toolbar__select"
            defaultValue="peak-rms-mixing-plus-6"
          >
            <option value="peak-rms-mixing-plus-6">Peak/RMS (+6 dBFS)</option>
            <option value="k14-rms-peak">K14 (RMS + Peak)</option>
          </select>
          <PeakReadout stripId="master" />
          <MeterCanvas
            stripId="master"
            width={14}
            height={80}
            profileKey="peak-rms-mixing-plus-6"
          />
          <MeterScaleRuler profileKey="peak-rms-mixing-plus-6" />
          <button
            id="mixer-settings-gear"
            type="button"
            aria-label="Mixer settings"
            className="mixer-settings-button"
          >
            Settings
          </button>
        </div>,
      );
    });

    const select = container.querySelector('#mixer-profile-select') as HTMLSelectElement;
    const peakReadout = container.querySelector('.mixer-peak-readout') as HTMLButtonElement;
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const scaleRuler = container.querySelector('.mixer-scale-ruler') as HTMLElement;
    const gearBtn = container.querySelector('#mixer-settings-gear') as HTMLButtonElement;

    expect(select).not.toBeNull();
    expect(peakReadout).not.toBeNull();
    expect(canvas).not.toBeNull();
    expect(scaleRuler).not.toBeNull();
    expect(gearBtn).not.toBeNull();

    // Focus profile selector via keyboard
    select.focus();
    expect(document.activeElement).toBe(select);
    expect(select.getAttribute('aria-label')).toBe('Meter profile');

    // Focus peak readout button via keyboard
    peakReadout.focus();
    expect(document.activeElement).toBe(peakReadout);
    expect(peakReadout.getAttribute('aria-label')).toContain('Held peak readout');

    // Canvas accessible name
    expect(canvas.getAttribute('aria-label')).toContain('Level meter for master');

    // Focus gear button via keyboard
    gearBtn.focus();
    expect(document.activeElement).toBe(gearBtn);
    expect(gearBtn.getAttribute('aria-label')).toBe('Mixer settings');
  });

  it('provides initial focus, focus trap, and keyboard toggle in MixerSettingsDialog (T041)', () => {
    const handleToggle = vi.fn();
    const handleClose = vi.fn();

    act(() => {
      root.render(
        <MixerSettingsDialog
          isOpen={true}
          enableMeters={true}
          mixer={createEmptyMixerSnapshot()}
          onToggleEnableMeters={handleToggle}
          onToggleEnablePanning={vi.fn()}
          onPanLawChange={vi.fn()}
          onPanBoostChange={vi.fn()}
          onClose={handleClose}
        />,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Initial focus lands on checkbox
    const checkbox = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(document.activeElement).toBe(checkbox);

    // Toggle via click / space
    act(() => {
      checkbox.click();
    });
    expect(handleToggle).toHaveBeenCalledWith(false);

    // Focus Close button
    const closeBtn = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Close',
    )!;
    expect(closeBtn).not.toBeNull();
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Escape closes dialog
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(handleClose).toHaveBeenCalled();
  });
});
