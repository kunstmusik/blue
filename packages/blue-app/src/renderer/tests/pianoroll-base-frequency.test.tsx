// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PianoRollCanvas from '../components/workbench/panels/score-object/editors/pianoroll/PianoRollCanvas';
import PianoRollPropertiesEditor from '../components/workbench/panels/score-object/editors/pianoroll/PianoRollPropertiesEditor';
import type {
  NoteCanvasMouseListener,
  PianoRollPayload,
} from '../components/workbench/panels/score-object/editors/pianoroll/types';

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

  it('virtualizes PianoRollCanvas notes outside the viewport + overscan and updates on scroll', () => {
    const payload = createPayload();
    const notes = [
      { start: 0.5, duration: 1, octave: 5, scaleDegree: 0, fieldValues: [] },
      { start: 15, duration: 1, octave: 5, scaleDegree: 0, fieldValues: [] },
      { start: 30, duration: 1, octave: 5, scaleDegree: 0, fieldValues: [] },
    ];
    const listener = {
      getDragMode: () => 'NONE',
      getMarquee: () => null,
      getCursor: () => 'default',
      mousePressed: vi.fn(),
      mouseDragged: vi.fn(),
      mouseReleased: vi.fn(),
      cancel: vi.fn(),
      dispose: vi.fn(),
    } as unknown as NoteCanvasMouseListener;

    const getFarNoteStart = vi.fn(() => 30);
    Object.defineProperty(notes[2], 'start', { get: getFarNoteStart });
    const renderAtScroll = (
      scrollLeft: number,
      previewNotes: ReadonlyMap<number, (typeof notes)[number]> | null = null,
    ) => {
      act(() => {
        root.render(
          <PianoRollCanvas
            notes={notes}
            previewNotes={previewNotes}
            scale={payload.scale}
            fieldDefinitions={payload.fieldDefinitions}
            selectedIndices={new Set()}
            pixelSecond={64}
            noteHeight={15}
            snapEnabled={false}
            snapBeats={0.25}
            durationBeats={40}
            pchGenerationMethod={0}
            listener={listener}
            canvasRef={{ current: null }}
            scrollLeft={scrollLeft}
            scrollTop={0}
            viewportWidth={300}
            viewportHeight={400}
          />,
        );
      });
    };

    renderAtScroll(0);
    let mountedNotes = container.querySelectorAll('div[title^="Note: "]');
    expect(mountedNotes.length).toBe(1);

    getFarNoteStart.mockClear();
    renderAtScroll(
      0,
      new Map([
        [0, { ...notes[0]!, start: 25 }],
        [1, { ...notes[1]!, start: 2 }],
      ]),
    );
    mountedNotes = container.querySelectorAll('div[title^="Note: "]');
    expect(mountedNotes.length).toBe(1);
    expect(mountedNotes[0]!.getAttribute('style')).toContain('left: 128px');
    expect(getFarNoteStart).not.toHaveBeenCalled();

    renderAtScroll(900);
    mountedNotes = container.querySelectorAll('div[title^="Note: "]');
    expect(mountedNotes.length).toBe(1);
    expect(mountedNotes[0]!.getAttribute('style')).toContain('left: 960px');
  });
});
