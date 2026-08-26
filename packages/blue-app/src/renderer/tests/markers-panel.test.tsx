// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarkersPanel from '../components/workbench/panels/MarkersPanel';
import { chooseAppSelectOption } from './app-select-test-utils';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MockProjectState {
  loaded: boolean;
  score: {
    markers: Array<{
      name: string;
      time: number;
      timeBase: string;
      sourceIndex: number;
    }>;
  };
  transport: {
    meterMap: {
      entries: Array<{ measure: number; numBeats: number; beatLength: number }>;
    };
    tempoMap: {
      enabled: boolean;
      points: Array<{ beat: number; tempo: number; curveType: 'constant' | 'linear' }>;
    };
    sampleRate: number;
  };
  applyProjectDocumentPatch: (patch: unknown) => void;
}

const { mockProjectState } = vi.hoisted(() => ({
  mockProjectState: {
    loaded: true,
    score: {
      markers: [{ name: 'Intro', time: 4, timeBase: 'BEATS', sourceIndex: 0 }],
    },
    transport: {
      meterMap: {
        entries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
      },
      tempoMap: {
        enabled: true,
        points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
      },
      sampleRate: 44100,
    },
    applyProjectDocumentPatch: vi.fn(),
  } satisfies MockProjectState,
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: MockProjectState) => unknown) => selector(mockProjectState),
}));

function renderPanel(): { container: HTMLDivElement; root: Root; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MarkersPanel />);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  mockProjectState.applyProjectDocumentPatch.mockReset();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MarkersPanel', () => {
  it('renders Java-style columns without the redundant markers count header', () => {
    const tree = renderPanel();

    expect(tree.container.textContent).toContain('TimeBase');
    expect(tree.container.textContent).toContain('Time');
    expect(tree.container.textContent).toContain('Label');
    expect(tree.container.textContent).not.toContain('Markers (1)');

    tree.unmount();
  });

  it('commits label on Enter and time on blur', async () => {
    const tree = renderPanel();
    const labelInput = tree.container.querySelectorAll('input')[1] as HTMLInputElement;

    act(() => {
      setInputValue(labelInput, 'Cue B');
    });

    act(() => {
      labelInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateMarker',
        sourceIndex: 0,
        patch: { name: 'Cue B' },
      },
    });

    const timeBaseSelect = tree.container.querySelector('[role="combobox"]') as HTMLButtonElement;
    await chooseAppSelectOption(timeBaseSelect, 'SECONDS');

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateMarker',
        sourceIndex: 0,
        patch: { timeBeats: 4, timeBase: 'SECONDS' },
      },
    });

    const timeInput = tree.container.querySelectorAll('input')[0] as HTMLInputElement;

    act(() => {
      setInputValue(timeInput, '6');
    });

    act(() => {
      timeInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateMarker',
        sourceIndex: 0,
        patch: { timeBeats: 6, timeBase: 'SECONDS' },
      },
    });

    tree.unmount();
  });
});
