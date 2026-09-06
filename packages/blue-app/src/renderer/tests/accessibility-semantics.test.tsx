// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsField, {
  SettingsCheckboxField,
  SettingsDraftNumberField,
  SettingsNumberField,
  SettingsSelectField,
} from '../components/settings/SettingsField';
import CommitNumberInput from '../components/CommitNumberInput';
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog';
import { useDialogFocus } from '../components/dialogs/use-dialog-focus';
import BSBKnobWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBKnobWidget';
import BSBHSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderWidget';
import BSBVSliderWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderWidget';
import BSBHSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBHSliderBankWidget';
import BSBVSliderBankWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBVSliderBankWidget';
import BSBXYControllerWidget from '../components/workbench/panels/orchestra/bsb/widgets/BSBXYControllerWidget';
import type { BSBWidgetPatchComponentProps } from '../components/workbench/panels/orchestra/bsb/widgets/widget-component-props';
import type { BsbWidgetNodeSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Accessibility Semantics (T031)', () => {
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

  describe('SettingsField input / label / description associations', () => {
    it('associates text SettingsField with label via id/htmlFor and description via aria-describedby', () => {
      act(() => {
        root.render(
          <SettingsField
            label="Server Port"
            description="TCP port for remote API connections"
            value="8080"
            onChange={vi.fn()}
          />,
        );
      });

      const input = container.querySelector('input')!;
      expect(input).not.toBeNull();
      const label = container.querySelector('label')!;
      expect(label).not.toBeNull();
      expect(input.id).toBeTruthy();
      expect(label.getAttribute('for')).toBe(input.id);

      const descId = input.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      const descEl = container.querySelector(`#${descId}`);
      expect(descEl).not.toBeNull();
      expect(descEl?.textContent).toBe('TCP port for remote API connections');
    });

    it('associates SettingsNumberField with label via id/htmlFor and description via aria-describedby', () => {
      act(() => {
        root.render(
          <SettingsNumberField
            label="Buffer Size"
            description="Audio buffer size in frames"
            value={512}
            onChange={vi.fn()}
          />,
        );
      });

      const input = container.querySelector('input')!;
      const label = container.querySelector('label')!;
      expect(input.id).toBeTruthy();
      expect(label.getAttribute('for')).toBe(input.id);

      const descId = input.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      const descEl = container.querySelector(`#${descId}`);
      expect(descEl?.textContent).toBe('Audio buffer size in frames');
    });

    it('associates SettingsDraftNumberField with label via id/htmlFor and description via aria-describedby', () => {
      act(() => {
        root.render(
          <SettingsDraftNumberField
            label="Sample Rate"
            description="Target audio output sample rate"
            value="44100"
            onChange={vi.fn()}
          />,
        );
      });

      const input = container.querySelector('input')!;
      const label = container.querySelector('label')!;
      expect(input.id).toBeTruthy();
      expect(label.getAttribute('for')).toBe(input.id);

      const descId = input.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      const descEl = container.querySelector(`#${descId}`);
      expect(descEl?.textContent).toBe('Target audio output sample rate');
    });

    it('associates SettingsSelectField with label and description via aria-describedby', () => {
      act(() => {
        root.render(
          <SettingsSelectField
            label="Audio Driver"
            description="Preferred audio output driver"
            value="portaudio"
            onChange={vi.fn()}
          >
            <option value="portaudio">PortAudio</option>
            <option value="jack">JACK</option>
          </SettingsSelectField>,
        );
      });

      const trigger = container.querySelector('[role="combobox"]')!;
      expect(trigger).not.toBeNull();
      const label = container.querySelector('label')!;
      expect(label).not.toBeNull();

      const triggerId = trigger.getAttribute('id');
      const labelFor = label.getAttribute('for');
      const ariaLabelledBy = trigger.getAttribute('aria-labelledby');
      const isAssociated =
        (triggerId && labelFor === triggerId) ||
        (ariaLabelledBy && label.id && ariaLabelledBy.includes(label.id));
      expect(isAssociated).toBe(true);

      const descId = trigger.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      const descEl = container.querySelector(`#${descId}`);
      expect(descEl?.textContent).toBe('Preferred audio output driver');
    });

    it('associates SettingsCheckboxField with label and description via aria-describedby', () => {
      act(() => {
        root.render(
          <SettingsCheckboxField
            label="Enable Dithering"
            description="Applies triangular PDF dither"
            checked={true}
            onChange={vi.fn()}
          />,
        );
      });

      const checkbox = container.querySelector('input[type="checkbox"]')!;
      expect(checkbox).not.toBeNull();

      const descId = checkbox.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      const descEl = container.querySelector(`#${descId}`);
      expect(descEl?.textContent).toBe('Applies triangular PDF dither');
    });
  });

  describe('Numeric inputs and accessible names', () => {
    it('CommitNumberInput exposes an accessible name via aria-label', () => {
      act(() => {
        root.render(<CommitNumberInput value={120} onChange={vi.fn()} aria-label="Tempo BPM" />);
      });

      const input = container.querySelector('input')!;
      expect(input.getAttribute('aria-label')).toBe('Tempo BPM');
    });
  });

  describe('Value sliders and assistive technology roles/values', () => {
    const baseWidgetProps: BSBWidgetPatchComponentProps = {
      node: {} as BsbWidgetNodeSnapshot,
      isSelected: false,
      editEnabled: false,
      onWidgetSelect: vi.fn(),
      gridSnapEnabled: false,
      gridSnapWidth: 10,
      gridSnapHeight: 10,
      onBsbInterfacePatch: vi.fn(),
      selectedWidgetIds: new Set<string>(),
      getWidgetPosition: () => ({ x: 0, y: 0 }),
      onWidgetAction: vi.fn(),
    };

    it('BSBKnobWidget provides slider role, aria-label, and value range metadata', () => {
      const node: BsbWidgetNodeSnapshot = {
        id: 'knob-1',
        type: 'BSBKnob',
        objectName: 'volume',
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        value: 75,
        minimum: 0,
        maximum: 100,
        editable: false,
        properties: { resolution: 1, label: 'Master Volume' },
      };

      act(() => {
        root.render(<BSBKnobWidget {...baseWidgetProps} node={node} />);
      });

      const slider = container.querySelector('[role="slider"]')!;
      expect(slider).not.toBeNull();
      expect(slider.getAttribute('aria-label')).toBe('Master Volume');
      expect(slider.getAttribute('aria-valuemin')).toBe('0');
      expect(slider.getAttribute('aria-valuemax')).toBe('100');
      expect(slider.getAttribute('aria-valuenow')).toBe('75');
    });

    it('BSBHSliderBankWidget gives each handle an independent slider role and accessible name', () => {
      const node: BsbWidgetNodeSnapshot = {
        id: 'hbank-1',
        type: 'BSBHSliderBank',
        objectName: 'eqBank',
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        value: 0,
        minimum: 0,
        maximum: 10,
        editable: false,
        properties: {
          numberOfSliders: 3,
          sliders: [{ value: 2 }, { value: 5 }, { value: 8 }],
        },
      };

      act(() => {
        root.render(<BSBHSliderBankWidget {...baseWidgetProps} node={node} />);
      });

      const sliders = container.querySelectorAll('[role="slider"]');
      expect(sliders.length).toBe(3);
      expect(sliders[0].getAttribute('aria-label')).toContain('1');
      expect(sliders[0].getAttribute('aria-valuenow')).toBe('2');
      expect(sliders[1].getAttribute('aria-label')).toContain('2');
      expect(sliders[1].getAttribute('aria-valuenow')).toBe('5');
      expect(sliders[2].getAttribute('aria-label')).toContain('3');
      expect(sliders[2].getAttribute('aria-valuenow')).toBe('8');
    });

    it('BSBXYControllerWidget exposes independent X and Y axis slider handles', () => {
      const node: BsbWidgetNodeSnapshot = {
        id: 'xy-1',
        type: 'BSBXYController',
        objectName: 'panFilter',
        x: 0,
        y: 0,
        width: 150,
        height: 150,
        value: 0,
        minimum: 0,
        maximum: 1,
        editable: false,
        properties: {
          xValue: 0.3,
          yValue: 0.7,
          minX: 0,
          maxX: 100,
          minY: 0,
          maxY: 200,
        },
      };

      act(() => {
        root.render(<BSBXYControllerWidget {...baseWidgetProps} node={node} />);
      });

      const sliders = container.querySelectorAll('[role="slider"]');
      expect(sliders.length).toBe(2);

      const xSlider = Array.from(sliders).find((s) => s.getAttribute('aria-label')?.includes('X'));
      const ySlider = Array.from(sliders).find((s) => s.getAttribute('aria-label')?.includes('Y'));
      expect(xSlider).toBeDefined();
      expect(ySlider).toBeDefined();
      expect(xSlider?.getAttribute('aria-valuenow')).toBe('0.3');
      expect(ySlider?.getAttribute('aria-valuenow')).toBe('0.7');
    });
  });

  describe('Modal Dialog semantics and focus containment', () => {
    it('ConfirmationDialog renders role, aria-modal, aria-labelledby, aria-describedby, and focuses Cancel by default for destructive intent', () => {
      const onDecision = vi.fn();
      act(() => {
        root.render(
          <ConfirmationDialog
            open={true}
            title="Delete Track?"
            description="All audio clips on this track will be deleted."
            actions={[
              { id: 'cancel', label: 'Cancel', intent: 'cancel' },
              { id: 'delete', label: 'Delete', intent: 'destructive' },
            ]}
            cancelActionId="cancel"
            onDecision={onDecision}
          />,
        );
      });

      const dialog = container.querySelector('[role="alertdialog"]')!;
      expect(dialog).not.toBeNull();
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      const titleId = dialog.getAttribute('aria-labelledby');
      expect(titleId).toBeTruthy();
      expect(container.querySelector(`#${titleId}`)?.textContent).toBe('Delete Track?');

      const descId = dialog.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      expect(container.querySelector(`#${descId}`)?.textContent).toBe(
        'All audio clips on this track will be deleted.',
      );

      const cancelButton = container.querySelector('[data-action-id="cancel"]');
      expect(document.activeElement).toBe(cancelButton);
    });

    it('ConfirmationDialog fail-closes on Escape', () => {
      const onDecision = vi.fn();
      act(() => {
        root.render(
          <ConfirmationDialog
            open={true}
            title="Discard Changes?"
            actions={[
              { id: 'cancel', label: 'Cancel', intent: 'cancel' },
              { id: 'discard', label: 'Discard', intent: 'destructive' },
            ]}
            cancelActionId="cancel"
            onDecision={onDecision}
          />,
        );
      });

      act(() => {
        const dialog = container.querySelector('[role="alertdialog"]')!;
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(onDecision).toHaveBeenCalledWith('cancel');
    });

    it('useDialogFocus traps Tab navigation inside the dialog', () => {
      function TestModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
        const dialogRef = useDialogFocus(isOpen, onClose);
        if (!isOpen) return null;
        return (
          <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
            <button id="first-btn">First</button>
            <input id="middle-input" defaultValue="Test" />
            <button id="last-btn">Last</button>
          </div>
        );
      }

      const onClose = vi.fn();
      act(() => {
        root.render(<TestModal isOpen={true} onClose={onClose} />);
      });

      const firstBtn = container.querySelector<HTMLButtonElement>('#first-btn')!;
      const lastBtn = container.querySelector<HTMLButtonElement>('#last-btn')!;
      expect(document.activeElement).toBe(firstBtn);

      lastBtn.focus();
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        lastBtn.dispatchEvent(event);
      });
      expect(document.activeElement).toBe(firstBtn);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });
        firstBtn.dispatchEvent(event);
      });
      expect(document.activeElement).toBe(lastBtn);
    });

    it('useDialogFocus restores focus to the opener element when closing', () => {
      const opener = document.createElement('button');
      opener.id = 'opener-button';
      document.body.appendChild(opener);
      opener.focus();
      expect(document.activeElement).toBe(opener);

      function ModalHost() {
        const [open, setOpen] = useState(true);
        const dialogRef = useDialogFocus(open, () => setOpen(false));
        return open ? (
          <div ref={dialogRef} role="dialog" tabIndex={-1}>
            <button id="inside-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        ) : null;
      }

      act(() => {
        root.render(<ModalHost />);
      });

      const insideBtn = container.querySelector<HTMLButtonElement>('#inside-btn')!;
      expect(document.activeElement).toBe(insideBtn);

      act(() => {
        insideBtn.click();
      });

      expect(document.activeElement).toBe(opener);
      opener.remove();
    });
  });
});
