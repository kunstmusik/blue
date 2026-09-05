// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TempoMapSnapshot, TempoMapPatch } from '../../shared/project-editor';
import TempoPointDialog from '../components/workbench/panels/score/TempoPointDialog';
import ShiftObjectsDialog from '../components/workbench/panels/score/ShiftObjectsDialog';
import FontChooserDialog, {
  type FontChoice,
} from '../components/workbench/panels/orchestra/bsb/FontChooserDialog';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function pressEnter(input: HTMLInputElement): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

function pressEscape(input: HTMLInputElement): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('Specialized Numeric Dialogs Regression (T031, T044)', () => {
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
    document.body.innerHTML = '';
  });

  describe('TempoPointDialog caller-level transaction and draft ownership', () => {
    const SAMPLE_TEMPO_MAP: TempoMapSnapshot = {
      visible: true,
      enabled: true,
      points: [
        { beat: 0, tempo: 120, curveType: 'constant' },
        { beat: 16, tempo: 140, curveType: 'constant' },
        { beat: 32, tempo: 160, curveType: 'constant' },
      ],
    };

    it('OK consumes latest unblurred draft exactly once with clamp/rounding', () => {
      const onTempoPatch = vi.fn<(patch: TempoMapPatch) => void>();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <TempoPointDialog
            pointIndex={1}
            tempoMap={SAMPLE_TEMPO_MAP}
            onTempoPatch={onTempoPatch}
            onClose={onClose}
          />,
        );
      });

      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
      expect(inputs.length).toBe(2);
      const beatInput = inputs[0]!;
      const tempoInput = inputs[1]!;

      expect(beatInput.value).toBe('16');
      expect(tempoInput.value).toBe('140');

      // Edit tempo without blurring
      act(() => {
        tempoInput.focus();
        setInputValue(tempoInput, '175');
      });
      expect(tempoInput.value).toBe('175');

      // Click OK button
      const okButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'OK',
      )!;
      act(() => {
        okButton.click();
      });

      expect(onTempoPatch).toHaveBeenCalledTimes(1);
      expect(onTempoPatch).toHaveBeenCalledWith({
        type: 'updateTempoPoint',
        index: 1,
        patch: {
          beat: 16,
          tempo: 175,
        },
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Enter key inside numeric field bubbles to dialog and confirms once', () => {
      const onTempoPatch = vi.fn<(patch: TempoMapPatch) => void>();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <TempoPointDialog
            pointIndex={1}
            tempoMap={SAMPLE_TEMPO_MAP}
            onTempoPatch={onTempoPatch}
            onClose={onClose}
          />,
        );
      });

      const tempoInput = container.querySelectorAll<HTMLInputElement>('input[type="number"]')[1]!;

      act(() => {
        tempoInput.focus();
        setInputValue(tempoInput, '155');
        pressEnter(tempoInput);
      });

      expect(onTempoPatch).toHaveBeenCalledTimes(1);
      expect(onTempoPatch).toHaveBeenCalledWith({
        type: 'updateTempoPoint',
        index: 1,
        patch: {
          beat: 16,
          tempo: 155,
        },
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Cancel button and Escape key emit NO project patch', () => {
      const onTempoPatch = vi.fn();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <TempoPointDialog
            pointIndex={1}
            tempoMap={SAMPLE_TEMPO_MAP}
            onTempoPatch={onTempoPatch}
            onClose={onClose}
          />,
        );
      });

      const tempoInput = container.querySelectorAll<HTMLInputElement>('input[type="number"]')[1]!;

      // Step up using keyboard ArrowUp
      act(() => {
        tempoInput.focus();
        tempoInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      expect(tempoInput.value).toBe('141');

      // Press Escape inside the input
      act(() => {
        pressEscape(tempoInput);
      });

      // Escape bubbles to dialog onClose, emits 0 patches
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onTempoPatch).not.toHaveBeenCalled();
    });

    it('disables beat input when editing time zero point', () => {
      const onTempoPatch = vi.fn();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <TempoPointDialog
            pointIndex={0}
            tempoMap={SAMPLE_TEMPO_MAP}
            onTempoPatch={onTempoPatch}
            onClose={onClose}
          />,
        );
      });

      const beatInput = container.querySelectorAll<HTMLInputElement>('input[type="number"]')[0]!;
      expect(beatInput.disabled).toBe(true);
      expect(beatInput.value).toBe('0');
    });
  });

  describe('ShiftObjectsDialog caller-level transaction and draft ownership', () => {
    it('selects and focuses input on mount, and confirms with Enter', () => {
      const onConfirm = vi.fn<(amount: number) => void>();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <ShiftObjectsDialog minStartBeats={4} onConfirm={onConfirm} onClose={onClose} />,
        );
      });

      const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
      expect(input.value).toBe('0');

      // Edit without blur
      act(() => {
        input.focus();
        setInputValue(input, '12.5');
      });
      expect(input.value).toBe('12.5');

      // Press Enter
      act(() => {
        pressEnter(input);
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(12.5);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displays error and rejects confirmation when shift moves before beat 0', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <ShiftObjectsDialog minStartBeats={2} onConfirm={onConfirm} onClose={onClose} />,
        );
      });

      const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;

      act(() => {
        input.focus();
        setInputValue(input, '-3');
        pressEnter(input);
      });

      expect(container.textContent).toContain('Shift would move an object before beat 0.');
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      // Stepping up with button recovers
      const increaseBtn = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Increase"]',
      )!;
      act(() => {
        increaseBtn.click();
      });
      // -3 stepped by 1 with step="any" becomes -2
      expect(input.value).toBe('-2');

      const okButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'OK',
      )!;
      act(() => {
        okButton.click();
      });

      expect(onConfirm).toHaveBeenCalledWith(-2);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Escape or Cancel produces no confirmation', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <ShiftObjectsDialog minStartBeats={0} onConfirm={onConfirm} onClose={onClose} />,
        );
      });

      const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
      act(() => {
        input.focus();
        setInputValue(input, '4');
        pressEscape(input);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('FontChooserDialog caller-level transaction and draft ownership', () => {
    const INITIAL_FONT: FontChoice = {
      name: 'Monaco',
      size: 14,
      style: 0,
    };

    it('confirms latest unblurred font size with rounding and bounds on OK', async () => {
      const onConfirm = vi.fn<(font: FontChoice) => void>();
      const onCancel = vi.fn();

      await act(async () => {
        root.render(
          <FontChooserDialog
            open={true}
            font={INITIAL_FONT}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />,
        );
      });

      const sizeInput = container.querySelector<HTMLInputElement>('input[type="number"]')!;
      expect(sizeInput).not.toBeNull();
      expect(sizeInput.value).toBe('14');

      act(() => {
        sizeInput.focus();
        setInputValue(sizeInput, '18.7');
      });
      expect(sizeInput.value).toBe('18.7');

      const okButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'OK',
      )!;
      act(() => {
        okButton.click();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith({
        name: 'Monaco',
        size: 19, // rounded from 18.7
        style: 0,
      });
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('Enter inside font size input bubbles and confirms dialog', async () => {
      const onConfirm = vi.fn<(font: FontChoice) => void>();
      const onCancel = vi.fn();

      await act(async () => {
        root.render(
          <FontChooserDialog
            open={true}
            font={INITIAL_FONT}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />,
        );
      });

      const sizeInput = container.querySelector<HTMLInputElement>('input[type="number"]')!;

      act(() => {
        sizeInput.focus();
        setInputValue(sizeInput, '24');
        pressEnter(sizeInput);
      });

      expect(onConfirm).toHaveBeenCalledWith({
        name: 'Monaco',
        size: 24,
        style: 0,
      });
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('Cancel button and Escape emit no confirm', async () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      await act(async () => {
        root.render(
          <FontChooserDialog
            open={true}
            font={INITIAL_FONT}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />,
        );
      });

      const sizeInput = container.querySelector<HTMLInputElement>('input[type="number"]')!;

      act(() => {
        sizeInput.focus();
        setInputValue(sizeInput, '30');
        pressEscape(sizeInput);
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
