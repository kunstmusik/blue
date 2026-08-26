// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MidiInputPanel from '../components/workbench/panels/MidiInputPanel';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot, type MidiInputProcessorSnapshot } from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function seedLoadedProject(midiInput: MidiInputProcessorSnapshot): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  useProjectStore.getState().setProjectInfo({
    title: 'MIDI Input Test',
    author: 'Test',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/test.blue',
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: { ...snapshot.orchestra, loaded: true },
    projectProperties: snapshot.projectProperties,
    transport: snapshot.transport,
    midiInput,
  });
}

function renderPanel(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MidiInputPanel />);
  });

  return { container, root };
}

beforeEach(() => {
  useProjectStore.getState().clearProject();
});

afterEach(() => {
  const state = useProjectStore.getState();
  if (state.loaded) {
    state.clearProject();
  }
});

describe('MidiInputPanel', () => {
  it('renders the processor form when a project is loaded', () => {
    seedLoadedProject({
      keyMapping: 'TUNING_CPS',
      velocityMapping: 'AMP_0DBFS',
      pitchConstant: 'gk_pitch',
      ampConstant: 'gk_amp',
      scale: {
        scaleName: 'Test Scale',
        baseFrequency: 440,
        octave: 2,
        ratios: [1, 1.5, 2],
      },
    });

    const { container, root } = renderPanel();

    const selects = container.querySelectorAll('[role="combobox"]');
    expect(selects.length).toBeGreaterThanOrEqual(2);

    expect(selects[0]?.textContent).toContain('Tuning - CPS');
    expect(selects[1]?.textContent).toContain('Amp (0dbfs = 1)');

    const inputs = container.querySelectorAll('input[type="text"], input:not([type])');
    const constantInputs = Array.from(inputs).filter(
      (el) => !(el as HTMLInputElement).readOnly,
    );
    expect(constantInputs.length).toBeGreaterThanOrEqual(2);

    const scaleInput = container.querySelector('input[readonly]') as HTMLInputElement | null;
    expect(scaleInput?.value).toBe('Test Scale');
    expect(container.innerHTML).toContain('w-24 flex-none text-right text-role-body text-app-text');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows the empty state when no project is loaded', () => {
    const { container, root } = renderPanel();

    expect(container.textContent).toContain('No project loaded');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the Scale row with a read-only name field and ... button', () => {
    seedLoadedProject({
      keyMapping: 'PCH',
      velocityMapping: 'MIDI',
      pitchConstant: '',
      ampConstant: '',
      scale: {
        scaleName: '12TET',
        baseFrequency: 261.6255653005986,
        octave: 2,
        ratios: [1, 1.5, 2],
      },
    });

    const { container, root } = renderPanel();

    const scaleInput = container.querySelector('input[readonly]') as HTMLInputElement | null;
    expect(scaleInput).toBeTruthy();
    expect(scaleInput?.value).toBe('12TET');

    const dotButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '...') ?? null;
    expect(dotButton).toBeTruthy();
    expect(dotButton?.textContent?.trim()).toBe('...');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
