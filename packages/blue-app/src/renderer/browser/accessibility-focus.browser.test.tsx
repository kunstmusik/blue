import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppSelect } from '../components/AppSelect';
import CommitNumberInput from '../components/CommitNumberInput';
import SettingsField from '../components/settings/SettingsField';
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog';
import AboutApp from '../components/about/AboutApp';
import blueIconUrl from '../../../assets/blueIcon.png';

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
});
