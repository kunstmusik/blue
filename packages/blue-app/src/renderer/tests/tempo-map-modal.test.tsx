// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  TempoMapPatch,
  TempoMapSnapshot,
  TimeConversionContext,
} from '../../shared/project-editor';
import TempoMapEditorDialog from '../components/workbench/panels/score/TempoMapEditorDialog';
import { chooseAppSelectOption } from './app-select-test-utils';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const BASE_TEMPO_MAP: TempoMapSnapshot = {
  enabled: true,
  visible: true,
  points: [
    { beat: 0, tempo: 60, curveType: 'constant', timeBase: 'BEATS' },
    { beat: 4, tempo: 120, curveType: 'linear', timeBase: 'BEATS' },
  ],
};

const BASE_TIME_CONTEXT: TimeConversionContext = {
  meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
  tempoEnabled: true,
  initialTempo: 60,
  sampleRate: 44100,
};

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

function setSelectValue(select: HTMLSelectElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderDialog(
  tempoMap: TempoMapSnapshot = BASE_TEMPO_MAP,
  timeContext: TimeConversionContext = BASE_TIME_CONTEXT,
): {
  container: HTMLDivElement;
  root: Root;
  onCommit: ReturnType<typeof vi.fn<(patch: TempoMapPatch) => void>>;
  onClose: ReturnType<typeof vi.fn<() => void>>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onCommit = vi.fn<(patch: TempoMapPatch) => void>();
  const onClose = vi.fn<() => void>();

  act(() => {
    root.render(
      <TempoMapEditorDialog
        tempoMap={tempoMap}
        timeContext={timeContext}
        onCommit={onCommit}
        onClose={onClose}
      />,
    );
  });

  return { container, root, onCommit, onClose };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TempoMapEditorDialog', () => {
  it('adds a new row at last beat plus four with the previous tempo', () => {
    const { container, root } = renderDialog();
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Add',
    ) as HTMLButtonElement;

    act(() => {
      addButton.click();
    });

    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(3);

    const lastStartInput = rows[2]?.querySelector('input[type="text"]') as HTMLInputElement;
    const lastTempoInput = rows[2]?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(lastStartInput.value).toBe('8');
    expect(lastTempoInput.value).toBe('120');

    act(() => {
      root.unmount();
    });
  });

  it('disables deletion when only one row remains', () => {
    const { container, root } = renderDialog({
      enabled: true,
      visible: false,
      points: [{ beat: 0, tempo: 72, curveType: 'constant', timeBase: 'BEATS' }],
    });
    const deleteButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Del',
    ) as HTMLButtonElement;

    expect(deleteButton.disabled).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it('disables deleting the tempo point at time zero even when more rows exist', () => {
    const { container, root } = renderDialog();
    const deleteButtons = Array.from(container.querySelectorAll('button')).filter(
      (button) => button.textContent === 'Del',
    ) as HTMLButtonElement[];

    expect(deleteButtons[0]!.disabled).toBe(true);
    expect(deleteButtons[1]!.disabled).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  it('allows editing the first visible row when that row is not at time zero', () => {
    const { container, root } = renderDialog({
      enabled: true,
      visible: true,
      points: [
        { beat: 4, tempo: 120, curveType: 'linear', timeBase: 'BEATS' },
        { beat: 8, tempo: 90, curveType: 'constant', timeBase: 'BEATS' },
      ],
    });
    const startInputs = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];

    expect(startInputs[0]!.disabled).toBe(false);

    act(() => {
      setInputValue(startInputs[0]!, '5');
      pressEnter(startInputs[0]!);
    });

    expect(startInputs[0]!.value).toBe('5');

    act(() => {
      root.unmount();
    });
  });

  it('cancels without committing changes', () => {
    const { container, root, onCommit, onClose } = renderDialog();
    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Cancel',
    ) as HTMLButtonElement;

    act(() => {
      cancelButton.click();
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it('commits a replaceTempoMap patch on OK while preserving enabled and visible flags', () => {
    const { container, root, onCommit, onClose } = renderDialog();
    const startInputs = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];
    const tempoInputs = Array.from(
      container.querySelectorAll('input[type="number"]'),
    ) as HTMLInputElement[];

    act(() => {
      setInputValue(startInputs[1]!, '6');
      setInputValue(tempoInputs[1]!, '132');
    });

    const okButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'OK',
    ) as HTMLButtonElement;

    act(() => {
      okButton.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'replaceTempoMap',
      map: {
        enabled: true,
        visible: true,
        points: [
          { beat: 0, tempo: 60, curveType: 'constant', timeBase: 'BEATS' },
          { beat: 6, tempo: 132, curveType: 'linear', timeBase: 'BEATS' },
        ],
      },
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it('commits edited beat and tempo values on blur and Enter', () => {
    const { container, onCommit } = renderDialog();
    const startInputs = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];
    const tempoInputs = Array.from(
      container.querySelectorAll('input[type="number"]'),
    ) as HTMLInputElement[];

    act(() => {
      setInputValue(startInputs[1]!, '6.5');
      blurInput(startInputs[1]!);
      setInputValue(tempoInputs[1]!, '132.4');
      pressEnter(tempoInputs[1]!);
    });

    expect(startInputs[1]!.value).toBe('6.5');
    expect(tempoInputs[1]!.value).toBe('132');

    const okButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'OK',
    ) as HTMLButtonElement;

    act(() => {
      okButton.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'replaceTempoMap',
      map: {
        enabled: true,
        visible: true,
        points: [
          { beat: 0, tempo: 60, curveType: 'constant', timeBase: 'BEATS' },
          { beat: 6.5, tempo: 132, curveType: 'linear', timeBase: 'BEATS' },
        ],
      },
    });
  });

  it('reverts duplicate beat values on blur instead of leaving an error state', () => {
    const { container, onCommit, onClose } = renderDialog();
    const startInputs = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];

    act(() => {
      setInputValue(startInputs[1]!, '0');
      blurInput(startInputs[1]!);
    });

    expect(startInputs[1]!.value).toBe('4');
    expect(container.textContent).not.toContain('already has a tempo point');

    const okButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'OK',
    ) as HTMLButtonElement;

    act(() => {
      okButton.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'replaceTempoMap',
      map: {
        enabled: true,
        visible: true,
        points: [
          { beat: 0, tempo: 60, curveType: 'constant', timeBase: 'BEATS' },
          { beat: 4, tempo: 120, curveType: 'linear', timeBase: 'BEATS' },
        ],
      },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reverts invalid tempo values on Enter instead of leaving an error state', () => {
    const { container, onCommit } = renderDialog();
    const tempoInputs = Array.from(
      container.querySelectorAll('input[type="number"]'),
    ) as HTMLInputElement[];

    act(() => {
      setInputValue(tempoInputs[1]!, '0');
      pressEnter(tempoInputs[1]!);
    });

    expect(tempoInputs[1]!.value).toBe('120');
    expect(container.textContent).not.toContain('Tempo must be between 1 and 999 BPM');

    const okButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'OK',
    ) as HTMLButtonElement;

    act(() => {
      okButton.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'replaceTempoMap',
      map: {
        enabled: true,
        visible: true,
        points: [
          { beat: 0, tempo: 60, curveType: 'constant', timeBase: 'BEATS' },
          { beat: 4, tempo: 120, curveType: 'linear', timeBase: 'BEATS' },
        ],
      },
    });
  });

  it('allows each tempo point to use its own time unit', async () => {
    const { container, onCommit } = renderDialog();
    const selects = Array.from(
      container.querySelectorAll('[role="combobox"]'),
    ) as HTMLButtonElement[];
    const startInputs = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];

    await chooseAppSelectOption(selects[1]!, 'BBF (Bar.Beat.Fraction, hundredths)');

    expect(startInputs[1]!.value).toBe('2.1.00');

    act(() => {
      setInputValue(startInputs[1]!, '3.1.00');
      pressEnter(startInputs[1]!);
    });

    const okButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'OK',
    ) as HTMLButtonElement;

    act(() => {
      okButton.click();
    });

    expect(onCommit).toHaveBeenCalledWith({
      type: 'replaceTempoMap',
      map: {
        enabled: true,
        visible: true,
        points: [
          { beat: 0, tempo: 60, curveType: 'constant', timeBase: 'BEATS' },
          { beat: 8, tempo: 120, curveType: 'linear', timeBase: 'BBF' },
        ],
      },
    });
  });
});
