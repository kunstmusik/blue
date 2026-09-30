// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PianoRollPropertiesEditor from '../components/workbench/panels/score-object/editors/pianoroll/PianoRollPropertiesEditor';
import type { PianoRollPayload } from '../components/workbench/panels/score-object/editors/pianoroll/types';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createPayload(): PianoRollPayload {
  return {
    instrumentId: '1',
    noteTemplate: 'i1 0 1 440',
    pchGenerationMethod: 0,
    transposition: 0,
    pixelSecond: 64,
    noteHeight: 15,
    snapEnabled: true,
    snapValue: 'SIXTEENTH',
    useGlobalRuler: false,
    primaryTimeDisplay: 'BBF',
    secondaryTimeDisplay: 'TIME',
    secondaryRulerEnabled: false,
    scale: { scaleName: '12TET', baseFrequency: 261.625565, octave: 2, ratios: [1, 1.5] },
    fieldDefinitions: [],
    notes: [],
    capabilities: { fieldEditor: true, clipboard: true, undo: true, noteTemplateOverride: true },
    deferredCapabilities: [],
  };
}

function changeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('PianoRoll Base Frequency editor', () => {
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

  it('commits a valid frequency on Enter with a semantic history label', () => {
    const onPatch = vi.fn();
    act(() =>
      root.render(<PianoRollPropertiesEditor payload={createPayload()} onPatch={onPatch} />),
    );

    const input = container.querySelector<HTMLInputElement>('[aria-label="Base Frequency"]')!;
    act(() => {
      input.focus();
      changeInputValue(input, '440');
    });
    expect(onPatch).not.toHaveBeenCalled();

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));

    expect(onPatch).toHaveBeenCalledWith(
      {
        scale: {
          scaleName: '12TET',
          baseFrequency: 440,
          octave: 2,
          ratios: [1, 1.5],
        },
      },
      { label: 'Set PianoRoll Base Frequency' },
    );
  });

  it('commits a clamped nonnegative frequency on focus loss', () => {
    const onPatch = vi.fn();
    act(() =>
      root.render(<PianoRollPropertiesEditor payload={createPayload()} onPatch={onPatch} />),
    );

    const input = container.querySelector<HTMLInputElement>('[aria-label="Base Frequency"]')!;
    act(() => {
      input.focus();
      changeInputValue(input, '-5');
      input.blur();
    });

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ scale: expect.objectContaining({ baseFrequency: 0 }) }),
      { label: 'Set PianoRoll Base Frequency' },
    );
  });

  it('restores the last valid frequency after invalid input', () => {
    const onPatch = vi.fn();
    act(() =>
      root.render(<PianoRollPropertiesEditor payload={createPayload()} onPatch={onPatch} />),
    );

    const input = container.querySelector<HTMLInputElement>('[aria-label="Base Frequency"]')!;
    act(() => {
      input.focus();
      changeInputValue(input, '');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onPatch).not.toHaveBeenCalled();
    expect(input.value).toBe('261.625565');
  });
});
