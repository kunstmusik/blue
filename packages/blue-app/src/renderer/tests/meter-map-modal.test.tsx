// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeterMapSnapshot, MeterMapPatch } from '../../shared/project-editor';
import MeterMapEditorDialog from '../components/workbench/panels/score/MeterMapEditorDialog';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const DEFAULT_METER_MAP: MeterMapSnapshot = {
  entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
};

const MIXED_METER_MAP: MeterMapSnapshot = {
  entries: [
    { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
    { measure: 5, numBeats: 3, beatLength: 4, startBeat: 16 },
    { measure: 9, numBeats: 7, beatLength: 8, startBeat: 28 },
  ],
};

function renderModal(meterMap: MeterMapSnapshot = DEFAULT_METER_MAP): {
  container: HTMLDivElement;
  root: Root;
  onCommit: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onCommit = vi.fn<(patch: MeterMapPatch) => void>();
  const onClose = vi.fn();

  act(() => {
    root.render(<MeterMapEditorDialog meterMap={meterMap} onCommit={onCommit} onClose={onClose} />);
  });

  return { container, root, onCommit, onClose };
}

afterEach(() => {
  document.body.innerHTML = '';
});

function findButton(container: HTMLDivElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text);
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function blurInput(input: HTMLInputElement): void {
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

function pressEnter(input: HTMLInputElement): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

describe('MeterMapEditorDialog', () => {
  it('renders a table with Measure and Time Signature columns', () => {
    const { container } = renderModal(MIXED_METER_MAP);
    expect(container.innerHTML).toContain('Edit Time Signature Map');
    expect(container.innerHTML).toContain('Measure');
    expect(container.innerHTML).toContain('Time Signature');
  });

  it('shows all entries from the meter map', () => {
    const { container } = renderModal(MIXED_METER_MAP);
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBeGreaterThanOrEqual(3);
  });

  it('disables first row measure input', () => {
    const { container } = renderModal(MIXED_METER_MAP);
    const numberInputs = container.querySelectorAll('input[type="number"]');
    const firstMeasure = numberInputs[0] as HTMLInputElement;
    expect(firstMeasure.disabled).toBe(true);
  });

  it('adds a row at last measure + 8 on Add click', () => {
    const { container } = renderModal(MIXED_METER_MAP);
    const addButton = findButton(container, 'Add');
    expect(addButton).toBeTruthy();
    act(() => {
      addButton!.click();
    });

    const numberInputs = container.querySelectorAll('input[type="number"]');
    const lastInput = numberInputs[numberInputs.length - 1] as HTMLInputElement;
    expect(lastInput.value).toBe('17');
  });

  it('disables delete when only one row remains', () => {
    const { container } = renderModal(DEFAULT_METER_MAP);
    const deleteButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Del',
    );
    expect(deleteButtons.length).toBe(1);
    expect((deleteButtons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('dispatches meter-map-replace on OK', () => {
    const { container, onCommit, onClose } = renderModal(DEFAULT_METER_MAP);
    const okButton = findButton(container, 'OK');
    expect(okButton).toBeTruthy();
    act(() => {
      okButton!.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'meter-map-replace',
      entries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes without committing on Cancel', () => {
    const { container, onCommit, onClose } = renderModal(DEFAULT_METER_MAP);
    const cancelButton = findButton(container, 'Cancel');
    expect(cancelButton).toBeTruthy();
    act(() => {
      cancelButton!.click();
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('delete removes a row when more than one exists', () => {
    const { container } = renderModal(MIXED_METER_MAP);
    const deleteButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Del' && !(b as HTMLButtonElement).disabled,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    act(() => {
      deleteButtons[0]!.click();
    });

    const remainingDeleteButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Del',
    );
    expect(remainingDeleteButtons.length).toBe(2);
  });

  it('modal replace produces same canonical shape as row-level edits', () => {
    const { container, onCommit } = renderModal(MIXED_METER_MAP);
    const okButton = findButton(container, 'OK');
    act(() => {
      okButton!.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'meter-map-replace',
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4 },
        { measure: 5, numBeats: 3, beatLength: 4 },
        { measure: 9, numBeats: 7, beatLength: 8 },
      ],
    });
  });

  it('commits edited measure and signature values on blur and Enter', () => {
    const { container, onCommit } = renderModal(MIXED_METER_MAP);
    const measureInputs = Array.from(
      container.querySelectorAll('input[type="number"]'),
    ) as HTMLInputElement[];
    const signatureInputs = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];

    act(() => {
      setInputValue(measureInputs[1]!, '6');
      blurInput(measureInputs[1]!);
      setInputValue(signatureInputs[1]!, '5 / 4');
      pressEnter(signatureInputs[1]!);
    });

    expect(measureInputs[1]!.value).toBe('6');
    expect(signatureInputs[1]!.value).toBe('5/4');

    const okButton = findButton(container, 'OK');
    act(() => {
      okButton!.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'meter-map-replace',
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4 },
        { measure: 6, numBeats: 5, beatLength: 4 },
        { measure: 9, numBeats: 7, beatLength: 8 },
      ],
    });
  });

  it('rejects duplicate measure numbers without committing', () => {
    const { container, onCommit, onClose } = renderModal(MIXED_METER_MAP);
    const measureInputs = Array.from(
      container.querySelectorAll('input[type="number"]'),
    ) as HTMLInputElement[];

    act(() => {
      setInputValue(measureInputs[1]!, '9');
      pressEnter(measureInputs[1]!);
    });

    expect(container.textContent).toContain('Measure 9 already has a meter entry');

    const okButton = findButton(container, 'OK');
    act(() => {
      okButton!.click();
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
