// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBlueX7Voice, decodeSingleVoice } from '@blue/data';
import type { BlueX7InstrumentSnapshot, InstrumentPatch } from '../../shared/project-editor';
import BlueX7Editor from '../components/workbench/panels/orchestra/BlueX7Editor';
import { BlueX7Editor as BlueX7EditorComponent } from '../components/instruments/blue-x7-editor';
import { chooseAppSelectOption } from './app-select-test-utils';

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Csound Post Code"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLElement, value: string) {
  const tracker = (input as unknown as { _valueTracker?: { setValue: (v: string) => void } })
    ._valueTracker;
  if (tracker) {
    tracker.setValue('');
  }
  let descriptor: PropertyDescriptor | undefined;
  if (input.tagName === 'INPUT') {
    descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  } else if (input.tagName === 'TEXTAREA') {
    descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  } else if (input.tagName === 'SELECT') {
    descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');
  }
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    (input as unknown as { value: string }).value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function clickElement(element: HTMLElement) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

const fixturesDir = path.join(
  __dirname,
  '../../../../blue-data/src/instruments/blue-x7/test-fixtures',
);
const singleSysExBytes = new Uint8Array(readFileSync(path.join(fixturesDir, 'single-voice.syx')));
const bankSysExBytes = new Uint8Array(readFileSync(path.join(fixturesDir, 'voice-bank.syx')));
const selectedFile = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

describe('BlueX7Editor — Complete UI & Patch Dispatch', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let lastPatch: InstrumentPatch | null = null;
  const onInstrumentPatch = vi.fn((patch: InstrumentPatch) => {
    lastPatch = patch;
  });
  const onOrchestraPatch = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    lastPatch = null;
    onInstrumentPatch.mockClear();
    onOrchestraPatch.mockClear();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  function renderEditor(overrides: Partial<BlueX7InstrumentSnapshot> = {}) {
    const voice = createDefaultBlueX7Voice();
    const instrument: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-1',
      type: 'blueX7',
      name: 'DX7 Epiano',
      comment: 'Electric Piano FM patch',
      enabled: true,
      voice,
      sharedOscillatorSync: 1,
      sharedPitchModulationSensitivity: 0,
      ...overrides,
    };

    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
        />,
      );
    });

    return { instrument, voice };
  }

  it('renders all parameter panels and top metadata header', () => {
    renderEditor();

    expect(container?.querySelector('[data-testid="blue-x7-editor"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-common-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-lfo-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-operator-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-peg-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-csound-panel"]')).not.toBeNull();

    const nameInput = container?.querySelector('#bluex7-instrument-name') as HTMLInputElement;
    expect(nameInput.value).toBe('DX7 Epiano');

    const commentInput = container?.querySelector('#bluex7-instrument-comment') as HTMLInputElement;
    expect(commentInput.value).toBe('Electric Piano FM patch');
  });

  it('dispatches metadata updates for name, comment, and enabled toggle', () => {
    renderEditor();

    const nameInput = container?.querySelector('#bluex7-instrument-name') as HTMLInputElement;
    act(() => {
      setInputValue(nameInput, 'FM Marimba');
    });
    expect(onInstrumentPatch).toHaveBeenCalledWith({ name: 'FM Marimba' });

    const commentInput = container?.querySelector('#bluex7-instrument-comment') as HTMLInputElement;
    act(() => {
      setInputValue(commentInput, 'Tuned Percussion');
    });
    expect(onInstrumentPatch).toHaveBeenCalledWith({ comment: 'Tuned Percussion' });

    const enabledCheckbox = container?.querySelector(
      'input[aria-label="Instrument Enabled"]',
    ) as HTMLInputElement;
    act(() => {
      clickElement(enabledCheckbox);
    });
    expect(onInstrumentPatch).toHaveBeenCalledWith({ enabled: false });
  });

  it('dispatches Common parameter updates and operator enables', async () => {
    renderEditor();

    const algSelect = container?.querySelector('#bluex7-algorithm') as HTMLButtonElement;
    await chooseAppSelectOption(algSelect, 'Algorithm 5');
    expect(lastPatch?.blueX7).toEqual({
      type: 'setCommonField',
      field: 'algorithm',
      value: 5,
    });

    const transposeInput = container?.querySelector('#bluex7-key-transpose') as HTMLInputElement;
    act(() => {
      setInputValue(transposeInput, '-12');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setCommonField',
      field: 'keyTranspose',
      value: 12, // -12 + 24 = 12
    });

    const feedbackInput = container?.querySelector('#bluex7-feedback') as HTMLInputElement;
    act(() => {
      setInputValue(feedbackInput, '3');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setCommonField',
      field: 'feedback',
      value: 3,
    });

    const op2Toggle = container?.querySelector(
      'button[aria-label="Toggle Operator 2"]',
    ) as HTMLButtonElement;
    act(() => {
      clickElement(op2Toggle);
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setOperatorEnabled',
      operatorIndex: 1,
      enabled: false,
    });
  });

  it('dispatches shared sync and shared PMS updates', () => {
    renderEditor();

    const sharedSyncCheckbox = container?.querySelector(
      'input[aria-label="Shared Oscillator Sync"]',
    ) as HTMLInputElement;
    act(() => {
      clickElement(sharedSyncCheckbox);
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setSharedOscillatorSync',
      value: 0,
    });

    const sharedPmsInput = container?.querySelector('#bluex7-shared-pms') as HTMLInputElement;
    act(() => {
      setInputValue(sharedPmsInput, '6');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setSharedPitchModulationSensitivity',
      value: 6,
    });
  });

  it('keeps operator-panel sync and PMS edits shared across all operators', () => {
    renderEditor();

    const operatorSync = container?.querySelector(
      'input[aria-label="Operator Oscillator Sync"]',
    ) as HTMLInputElement;
    act(() => {
      clickElement(operatorSync);
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setSharedOscillatorSync',
      value: 0,
    });

    const operatorPms = container?.querySelector(
      'input[aria-label="Pitch Modulation Sensitivity"]',
    ) as HTMLInputElement;
    act(() => {
      setInputValue(operatorPms, '5');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setSharedPitchModulationSensitivity',
      value: 5,
    });
  });

  it('dispatches LFO parameter updates', async () => {
    renderEditor();

    const speedInput = container?.querySelector('#bluex7-lfo-speed') as HTMLInputElement;
    act(() => {
      setInputValue(speedInput, '55');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setLfoField',
      field: 'speed',
      value: 55,
    });

    const delayInput = container?.querySelector('#bluex7-lfo-delay') as HTMLInputElement;
    act(() => {
      setInputValue(delayInput, '20');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setLfoField',
      field: 'delay',
      value: 20,
    });

    const waveSelect = container?.querySelector('#bluex7-lfo-wave') as HTMLButtonElement;
    await chooseAppSelectOption(waveSelect, 'Sine');
    expect(lastPatch?.blueX7).toEqual({
      type: 'setLfoField',
      field: 'wave',
      value: 4,
    });
  });

  it('switches active operator tabs and edits operator parameters and envelope', () => {
    renderEditor();

    // Switch to Operator 3 tab (index 2)
    const op3Tab = container?.querySelector(
      'button[aria-label="Select Operator 3"]',
    ) as HTMLButtonElement;
    act(() => {
      clickElement(op3Tab);
    });

    const outputLevelInput = container?.querySelector(
      '#bluex7-op-output-level',
    ) as HTMLInputElement;
    act(() => {
      setInputValue(outputLevelInput, '75');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setOperatorField',
      operatorIndex: 2,
      field: 'outputLevel',
      value: 75,
    });

    const freqCoarseInput = container?.querySelector('#bluex7-op-coarse') as HTMLInputElement;
    act(() => {
      setInputValue(freqCoarseInput, '3');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setOperatorField',
      operatorIndex: 2,
      field: 'freqCoarse',
      value: 3,
    });

    // Edit Stage 2 Rate (R2) on Operator 3
    const r2Input = container?.querySelector('#bluex7-op-r2') as HTMLInputElement;
    act(() => {
      setInputValue(r2Input, '88');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setOperatorEnvelopePoint',
      operatorIndex: 2,
      stageIndex: 1,
      point: { rate: 88, level: 99 },
    });
  });

  it('dispatches Pitch Envelope Generator and Csound post-code edits', () => {
    renderEditor();

    const pegR1Input = container?.querySelector('#bluex7-peg-r1') as HTMLInputElement;
    act(() => {
      setInputValue(pegR1Input, '95');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setPitchEnvelopePoint',
      stageIndex: 0,
      point: { rate: 95, level: 50 },
    });

    const postCodeArea = container?.querySelector(
      'textarea[aria-label="Csound Post Code"]',
    ) as HTMLTextAreaElement;
    act(() => {
      setInputValue(postCodeArea, 'outs aout * 0.5, aout * 0.5');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setCsoundPostCode',
      text: 'outs aout * 0.5, aout * 0.5',
    });
  });

  it('handles single voice SysEx import with confirmation dialog', async () => {
    const importedVoice = decodeSingleVoice(singleSysExBytes).voice;
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'single-voice.syx',
      bytes: selectedFile(singleSysExBytes),
    });

    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    expect(onImportSysEx).toHaveBeenCalled();

    const dialog = container?.querySelector('[data-testid="sysex-import-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('TESTVOICE1');

    const confirmBtn = container?.querySelector(
      'button[aria-label="Confirm SysEx Import"]',
    ) as HTMLButtonElement;
    act(() => {
      clickElement(confirmBtn);
    });

    expect(onInstrumentPatch).toHaveBeenCalledWith({
      blueX7: {
        type: 'replaceVoice',
        voice: importedVoice,
      },
    });
    // FR-011: a SysEx import is a single atomic patch
    expect(onInstrumentPatch).toHaveBeenCalledTimes(1);
  });

  it('resynchronizes every keep-mounted panel from the canonical SysEx replacement', async () => {
    const importedVoice = decodeSingleVoice(singleSysExBytes).voice;
    const differentValue = (value: number): number => (value === 0 ? 1 : 0);
    const initialVoice = createDefaultBlueX7Voice();
    initialVoice.common.feedback = differentValue(importedVoice.common.feedback);
    initialVoice.operators[0].freqCoarse = differentValue(importedVoice.operators[0].freqCoarse);
    initialVoice.pitchEnvelope[0] = {
      rate: differentValue(importedVoice.pitchEnvelope[0].rate),
      level: differentValue(importedVoice.pitchEnvelope[0].level),
    };
    initialVoice.csoundPostCode =
      importedVoice.csoundPostCode === 'old code' ? 'new code' : 'old code';
    const { instrument } = renderEditor({ voice: initialVoice });
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'single-voice.syx',
      bytes: selectedFile(singleSysExBytes),
    });

    function ControlledEditor(): React.ReactElement {
      const [snapshot, setSnapshot] = React.useState(instrument);
      const handlePatch = (patch: InstrumentPatch): void => {
        onInstrumentPatch(patch);
        if (patch.blueX7?.type === 'replaceVoice') {
          setSnapshot((previous) => ({ ...previous, voice: patch.blueX7!.voice }));
        }
      };

      return (
        <BlueX7EditorComponent
          instrument={snapshot}
          onInstrumentPatch={handlePatch}
          onImportSysEx={onImportSysEx}
        />
      );
    }

    await act(async () => {
      root?.render(<ControlledEditor />);
      await Promise.resolve();
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });
    const confirmBtn = container?.querySelector(
      'button[aria-label="Confirm SysEx Import"]',
    ) as HTMLButtonElement;
    act(() => {
      clickElement(confirmBtn);
    });

    expect(onInstrumentPatch).toHaveBeenCalledTimes(1);
    expect(lastPatch?.blueX7).toEqual({ type: 'replaceVoice', voice: importedVoice });
    expect(
      (container?.querySelector('input[aria-label="Feedback"]') as HTMLInputElement).value,
    ).toBe(String(importedVoice.common.feedback));
    expect(
      (container?.querySelector('input[aria-label="Frequency Coarse"]') as HTMLInputElement).value,
    ).toBe(String(importedVoice.operators[0].freqCoarse));
    expect(
      (container?.querySelector('input[aria-label="Pitch Rate 1"]') as HTMLInputElement).value,
    ).toBe(String(importedVoice.pitchEnvelope[0].rate));
    expect(
      (container?.querySelector('textarea[aria-label="Csound Post Code"]') as HTMLTextAreaElement)
        .value,
    ).toBe(importedVoice.csoundPostCode);

    for (const testId of ['tab-operators', 'tab-pitch', 'tab-csound', 'tab-global']) {
      const tab = container?.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;
      act(() => {
        clickElement(tab);
      });
    }
    expect(onInstrumentPatch).toHaveBeenCalledTimes(1);
  });

  it('dispatches zero patches when single-voice import is canceled', async () => {
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'single-voice.syx',
      bytes: selectedFile(singleSysExBytes),
    });

    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const cancelBtn = container?.querySelector(
      'button[aria-label="Cancel SysEx Import"]',
    ) as HTMLButtonElement;
    act(() => {
      clickElement(cancelBtn);
    });

    // FR-015: cancellation must not mutate the instrument
    expect(onInstrumentPatch).not.toHaveBeenCalled();
    expect(container?.querySelector('[data-testid="sysex-import-dialog"]')).toBeNull();
  });

  it('traps focus and restores the importer focus when the SysEx dialog closes', async () => {
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'single-voice.syx',
      bytes: selectedFile(singleSysExBytes),
    });
    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    importBtn.focus();
    await act(async () => {
      clickElement(importBtn);
    });

    const dialog = container?.querySelector('[data-testid="sysex-import-dialog"]') as HTMLElement;
    const closeBtn = dialog.querySelector(
      'button[aria-label="Close SysEx Dialog"]',
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(closeBtn);

    act(() => {
      const panel = dialog.querySelector('.flex.flex-col') as HTMLElement;
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container?.querySelector('[data-testid="sysex-import-dialog"]')).toBeNull();
    expect(document.activeElement).toBe(importBtn);
  });

  it('discards an import result when the editor target changes while reading', async () => {
    let resolveRead:
      | ((value: import('../../shared/blue-x7-sysex').BlueX7SysexReadResult) => void)
      | undefined;
    const pendingRead = new Promise<import('../../shared/blue-x7-sysex').BlueX7SysexReadResult>(
      (resolve) => {
        resolveRead = resolve;
      },
    );
    const onImportSysEx = vi.fn(() => pendingRead);
    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const replacementTarget: BlueX7InstrumentSnapshot = {
      ...instrument,
      assignmentId: 'x7-2',
      voice: createDefaultBlueX7Voice(),
    };
    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={replacementTarget}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    await act(async () => {
      resolveRead?.({
        status: 'selected',
        fileName: 'single-voice.syx',
        bytes: selectedFile(singleSysExBytes),
      });
      await pendingRead;
    });

    expect(container?.querySelector('[data-testid="sysex-import-dialog"]')).toBeNull();
    expect(container?.querySelector('[data-testid="sysex-error-banner"]')?.textContent).toContain(
      'target changed',
    );
    expect(onInstrumentPatch).not.toHaveBeenCalled();
  });

  it('dispatches zero patches when bank import is canceled at the slot chooser', async () => {
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'voice-bank.syx',
      bytes: selectedFile(bankSysExBytes),
    });

    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    expect(container?.querySelector('[data-testid="sysex-import-dialog"]')).not.toBeNull();

    const cancelBtn = container?.querySelector(
      'button[aria-label="Cancel SysEx Bank Import"]',
    ) as HTMLButtonElement;
    act(() => {
      clickElement(cancelBtn);
    });

    // FR-015: cancellation at the bank chooser must not mutate the instrument
    expect(onInstrumentPatch).not.toHaveBeenCalled();
    expect(container?.querySelector('[data-testid="sysex-import-dialog"]')).toBeNull();
  });

  it('handles bank SysEx import with 32-slot selector dialog', async () => {
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'voice-bank.syx',
      bytes: selectedFile(bankSysExBytes),
    });

    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const dialog = container?.querySelector('[data-testid="sysex-import-dialog"]');
    expect(dialog).not.toBeNull();
    const slotBtns = dialog?.querySelectorAll('button[aria-label^="Import Bank Slot"]');
    expect(slotBtns?.length).toBe(32);

    // Choose slot 1
    act(() => {
      clickElement(slotBtns![0] as HTMLElement);
    });

    expect(onInstrumentPatch).toHaveBeenCalled();
    expect(lastPatch?.blueX7?.type).toBe('replaceVoice');
  });

  it('preserves target operator enables when importing a bank voice', async () => {
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'voice-bank.syx',
      bytes: selectedFile(bankSysExBytes),
    });
    const { instrument } = renderEditor();
    instrument.voice.common.operatorEnabled = [true, false, true, false, true, false];

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const slotBtn = container?.querySelector(
      'button[aria-label^="Import Bank Slot"]',
    ) as HTMLButtonElement;
    act(() => {
      clickElement(slotBtn);
    });

    expect(lastPatch?.blueX7).toMatchObject({
      type: 'replaceVoice',
      voice: {
        common: { operatorEnabled: [true, false, true, false, true, false] },
      },
    });
  });

  it('reports malformed bank data without mutating the instrument', async () => {
    const malformedBank = new Uint8Array(bankSysExBytes);
    malformedBank[malformedBank.length - 2] ^= 1;
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'malformed-bank.syx',
      bytes: selectedFile(malformedBank),
    });
    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    expect(onInstrumentPatch).not.toHaveBeenCalled();
    expect(container?.querySelector('[data-testid="sysex-error-banner"]')?.textContent).toContain(
      'Invalid SysEx checksum',
    );
  });

  it('displays error banner when SysEx file is invalid and cancels cleanly', async () => {
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'error',
      code: 'read-failed',
      message: 'Not a valid DX7 SysEx file',
    });

    const { instrument } = renderEditor();

    act(() => {
      root?.render(
        <BlueX7EditorComponent
          instrument={instrument}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          onImportSysEx={onImportSysEx}
        />,
      );
    });

    const importBtn = container?.querySelector(
      'button[aria-label="Import DX7 SysEx File"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const errorBanner = container?.querySelector('[data-testid="sysex-error-banner"]');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.textContent).toContain('Not a valid DX7 SysEx file');

    // FR-017: a failed import must leave the selected instrument unchanged
    expect(onInstrumentPatch).not.toHaveBeenCalled();
  });

  describe('User Story 1 — Top-Level Tabbed Navigation', () => {
    it('defaults to Voice & Global view on mount with header controls visible', () => {
      const { instrument } = renderEditor();

      act(() => {
        root?.render(
          <BlueX7EditorComponent instrument={instrument} onInstrumentPatch={onInstrumentPatch} />,
        );
      });

      // Header controls visible
      expect(container?.querySelector('input[aria-label="Instrument Name"]')).not.toBeNull();
      expect(container?.querySelector('input[aria-label="Instrument Enabled"]')).not.toBeNull();
      expect(container?.querySelector('button[aria-label="Undo BlueX7 edit"]')).not.toBeNull();

      // Top-level tabs present
      const tablist = container?.querySelector(
        '[role="tablist"][aria-label="Instrument Sections"]',
      );
      expect(tablist).not.toBeNull();

      const globalTab = container?.querySelector('[role="tab"][data-testid="tab-global"]');
      expect(globalTab?.getAttribute('aria-selected')).toBe('true');

      // Global panel is visible
      const globalPanel = container?.querySelector(
        '[data-testid="bluex7-panel-global"]',
      ) as HTMLElement;
      expect(globalPanel).not.toBeNull();
      expect(globalPanel.style.visibility).toBe('visible');
      expect(globalPanel.getAttribute('aria-hidden')).toBe('false');

      // Other panels are hidden
      const operatorsPanel = container?.querySelector(
        '[data-testid="bluex7-panel-operators"]',
      ) as HTMLElement;
      const pitchPanel = container?.querySelector(
        '[data-testid="bluex7-panel-pitch"]',
      ) as HTMLElement;
      const csoundPanel = container?.querySelector(
        '[data-testid="bluex7-panel-csound"]',
      ) as HTMLElement;

      expect(operatorsPanel.style.visibility).toBe('hidden');
      expect(operatorsPanel.getAttribute('aria-hidden')).toBe('true');
      expect(pitchPanel.style.visibility).toBe('hidden');
      expect(pitchPanel.getAttribute('aria-hidden')).toBe('true');
      expect(csoundPanel.style.visibility).toBe('hidden');
      expect(csoundPanel.getAttribute('aria-hidden')).toBe('true');
    });

    it('switches panels without emitting an instrument or orchestra patch', () => {
      const { instrument } = renderEditor();

      act(() => {
        root?.render(
          <BlueX7EditorComponent
            instrument={instrument}
            onInstrumentPatch={onInstrumentPatch}
            onOrchestraPatch={onOrchestraPatch}
          />,
        );
      });

      onInstrumentPatch.mockClear();
      onOrchestraPatch.mockClear();

      // Switch to Operators tab
      const operatorsTab = container?.querySelector(
        '[role="tab"][data-testid="tab-operators"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(operatorsTab);
      });

      expect(operatorsTab.getAttribute('aria-selected')).toBe('true');
      const operatorsPanel = container?.querySelector(
        '[data-testid="bluex7-panel-operators"]',
      ) as HTMLElement;
      const globalPanel = container?.querySelector(
        '[data-testid="bluex7-panel-global"]',
      ) as HTMLElement;

      expect(operatorsPanel.style.visibility).toBe('visible');
      expect(operatorsPanel.getAttribute('aria-hidden')).toBe('false');
      expect(globalPanel.style.visibility).toBe('hidden');
      expect(globalPanel.getAttribute('aria-hidden')).toBe('true');

      // No patches emitted
      expect(onInstrumentPatch).not.toHaveBeenCalled();
      expect(onOrchestraPatch).not.toHaveBeenCalled();

      // Switch to Pitch Envelope tab
      const pitchTab = container?.querySelector(
        '[role="tab"][data-testid="tab-pitch"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(pitchTab);
      });
      const pitchPanel = container?.querySelector(
        '[data-testid="bluex7-panel-pitch"]',
      ) as HTMLElement;
      expect(pitchPanel.style.visibility).toBe('visible');
      expect(operatorsPanel.style.visibility).toBe('hidden');
      expect(onInstrumentPatch).not.toHaveBeenCalled();

      // Switch to Csound tab
      const csoundTab = container?.querySelector(
        '[role="tab"][data-testid="tab-csound"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(csoundTab);
      });
      const csoundPanel = container?.querySelector(
        '[data-testid="bluex7-panel-csound"]',
      ) as HTMLElement;
      expect(csoundPanel.style.visibility).toBe('visible');
      expect(pitchPanel.style.visibility).toBe('hidden');
      expect(onInstrumentPatch).not.toHaveBeenCalled();

      // Header remains visible
      expect(container?.querySelector('input[aria-label="Instrument Name"]')).not.toBeNull();
    });

    it('resets to Voice & Global on fresh mount', () => {
      const { instrument } = renderEditor();

      act(() => {
        root?.render(
          <BlueX7EditorComponent instrument={instrument} onInstrumentPatch={onInstrumentPatch} />,
        );
      });

      // Switch to Csound
      const csoundTab = container?.querySelector(
        '[role="tab"][data-testid="tab-csound"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(csoundTab);
      });
      expect(csoundTab.getAttribute('aria-selected')).toBe('true');

      // Unmount and remount
      act(() => {
        root?.unmount();
      });
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);

      act(() => {
        root?.render(
          <BlueX7EditorComponent instrument={instrument} onInstrumentPatch={onInstrumentPatch} />,
        );
      });

      const globalTab = container?.querySelector('[role="tab"][data-testid="tab-global"]');
      expect(globalTab?.getAttribute('aria-selected')).toBe('true');
      const globalPanel = container?.querySelector(
        '[data-testid="bluex7-panel-global"]',
      ) as HTMLElement;
      expect(globalPanel.style.visibility).toBe('visible');
    });
  });

  describe('User Story 2 — Focused Operator Workstation with Sub-Tabs', () => {
    it('defaults to Op 1 in Operators tab and shows muted indicator for disabled operators', () => {
      const voice = createDefaultBlueX7Voice();
      voice.common.operatorEnabled = [true, false, true, false, true, false];
      const { instrument } = renderEditor({ voice });

      act(() => {
        root?.render(
          <BlueX7EditorComponent instrument={instrument} onInstrumentPatch={onInstrumentPatch} />,
        );
      });

      // Switch to Operators tab
      const operatorsTab = container?.querySelector(
        '[role="tab"][data-testid="tab-operators"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(operatorsTab);
      });

      // Op 1 is selected
      const op1Tab = container?.querySelector('[role="tab"][data-testid="operator-tab-1"]');
      expect(op1Tab?.getAttribute('aria-selected')).toBe('true');

      // Op 2 has (Muted)
      const op2Tab = container?.querySelector('[role="tab"][data-testid="operator-tab-2"]');
      expect(op2Tab?.textContent).toContain('(Muted)');
      expect(op1Tab?.textContent).not.toContain('(Muted)');
    });

    it('switches operator sub-tabs without emitting a patch and targets patches to selected operator', () => {
      const { instrument } = renderEditor();

      act(() => {
        root?.render(
          <BlueX7EditorComponent instrument={instrument} onInstrumentPatch={onInstrumentPatch} />,
        );
      });

      // Switch to Operators tab
      const operatorsTab = container?.querySelector(
        '[role="tab"][data-testid="tab-operators"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(operatorsTab);
      });

      onInstrumentPatch.mockClear();

      // Switch to Op 3
      const op3Tab = container?.querySelector(
        '[role="tab"][data-testid="operator-tab-3"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(op3Tab);
      });

      // No patch emitted on tab switch
      expect(onInstrumentPatch).not.toHaveBeenCalled();
      expect(op3Tab.getAttribute('aria-selected')).toBe('true');

      // Edit Coarse tune on Op 3
      const coarseInput = container?.querySelector(
        'input[aria-label="Frequency Coarse"]',
      ) as HTMLInputElement;
      expect(coarseInput).not.toBeNull();
      act(() => {
        setInputValue(coarseInput, '5');
      });

      expect(onInstrumentPatch).toHaveBeenCalledTimes(1);
      expect(lastPatch?.blueX7).toMatchObject({
        type: 'setOperatorField',
        operatorIndex: 2, // 0-indexed for Op 3
        field: 'freqCoarse',
        value: 5,
      });
    });

    it('preserves selected operator sub-tab across top-level tab switches', () => {
      const { instrument } = renderEditor();

      act(() => {
        root?.render(
          <BlueX7EditorComponent instrument={instrument} onInstrumentPatch={onInstrumentPatch} />,
        );
      });

      // Switch to Operators tab
      const operatorsTab = container?.querySelector(
        '[role="tab"][data-testid="tab-operators"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(operatorsTab);
      });

      // Select Op 4
      const op4Tab = container?.querySelector(
        '[role="tab"][data-testid="operator-tab-4"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(op4Tab);
      });
      expect(op4Tab.getAttribute('aria-selected')).toBe('true');

      // Switch to Pitch Envelope
      const pitchTab = container?.querySelector(
        '[role="tab"][data-testid="tab-pitch"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(pitchTab);
      });

      // Switch back to Operators
      act(() => {
        clickElement(operatorsTab);
      });

      // Op 4 is still selected
      const op4TabAfter = container?.querySelector('[role="tab"][data-testid="operator-tab-4"]');
      expect(op4TabAfter?.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('User Story 4 — Realtime & Effective-Value Scope Synchronization', () => {
    it('renders live Pitch Envelope values without dispatching a durable patch', async () => {
      const getBlueX7EffectiveValues = vi.fn().mockResolvedValue({
        ok: true,
        projectSessionId: 10,
        ownerIdentity: 'arrangement:x7-1',
        engineSequence: 1,
        values: [
          { parameterId: 'pitch-rate-1', value: 77 },
          { parameterId: 'pitch-level-1', value: 88 },
        ],
      });
      (window as unknown as { blueAPI: unknown }).blueAPI = { getBlueX7EffectiveValues };
      const { instrument } = renderEditor({
        parameters: [
          {
            parameterId: 'pitch-rate-1',
            semanticKey: 'pitchEnvelope.1.rate',
            fixedValue: 0,
            automationEnabled: true,
          },
          {
            parameterId: 'pitch-level-1',
            semanticKey: 'pitchEnvelope.1.level',
            fixedValue: 0,
            automationEnabled: true,
          },
        ],
      });

      act(() => {
        root?.render(
          <BlueX7EditorComponent
            instrument={instrument}
            onInstrumentPatch={onInstrumentPatch}
            effectiveValues={{
              target: { assignmentId: 'x7-1' },
              projectSessionId: 10,
              enabled: true,
            }}
          />,
        );
      });

      const pitchTab = container?.querySelector(
        '[role="tab"][data-testid="tab-pitch"]',
      ) as HTMLButtonElement;
      await act(async () => {
        clickElement(pitchTab);
        await Promise.resolve();
      });

      expect(getBlueX7EffectiveValues).toHaveBeenCalledWith({
        target: { assignmentId: 'x7-1' },
        projectSessionId: 10,
        parameterIds: ['pitch-rate-1', 'pitch-level-1'],
      });
      expect(
        (container?.querySelector('input[aria-label="Pitch Rate 1"]') as HTMLInputElement).value,
      ).toBe('77');
      expect(
        (container?.querySelector('input[aria-label="Pitch Level 1"]') as HTMLInputElement).value,
      ).toBe('88');
      expect(onInstrumentPatch).not.toHaveBeenCalled();
    });

    it('partitions requested parameter IDs per active tab and suppresses Csound requests', async () => {
      const getBlueX7EffectiveValues = vi.fn().mockResolvedValue({
        ok: true,
        projectSessionId: 10,
        ownerIdentity: 'arrangement:x7-1',
        engineSequence: 1,
        values: [],
      });
      (window as unknown as { blueAPI: unknown }).blueAPI = { getBlueX7EffectiveValues };

      const voice = createDefaultBlueX7Voice();
      const allParameters = Array.from({ length: 151 }, (_, i) => ({
        parameterId: `param-${i + 1}`,
        semanticKey: i === 0 ? 'common.algorithm' : i === 1 ? 'common.feedback' : `key-${i}`,
        fixedValue: 0,
        automationEnabled: true,
      }));
      // Map all 151 catalog descriptors to parameters
      const descriptors = (await import('@blue/data')).BLUE_X7_PARAMETER_DESCRIPTORS;
      const instrumentParams = descriptors.map((d, i) => ({
        parameterId: `id-${d.key}`,
        semanticKey: d.key,
        fixedValue: 0,
        automationEnabled: true,
      }));

      const instrument: BlueX7InstrumentSnapshot = {
        assignmentId: 'x7-1',
        type: 'blueX7',
        name: 'Live BlueX7',
        enabled: true,
        comment: '',
        voice,
        parameters: instrumentParams,
      };

      act(() => {
        root?.render(
          <BlueX7EditorComponent
            instrument={instrument}
            onInstrumentPatch={onInstrumentPatch}
            effectiveValues={{
              target: { assignmentId: 'x7-1' },
              projectSessionId: 10,
              enabled: true,
            }}
          />,
        );
      });

      // 1. In Global view (default): 17 parameters requested
      expect(getBlueX7EffectiveValues).toHaveBeenCalledTimes(1);
      const globalCalls = getBlueX7EffectiveValues.mock.calls[0][0];
      expect(globalCalls.parameterIds).toHaveLength(17);
      expect(globalCalls.parameterIds).toContain('id-common.algorithm');
      expect(globalCalls.parameterIds).toContain('id-lfo.speed');
      expect(globalCalls.parameterIds).toContain('id-operator.1.enabled');

      getBlueX7EffectiveValues.mockClear();

      // 2. Switch to Operators tab (Op 1 by default): 24 parameters requested
      const operatorsTab = container?.querySelector(
        '[role="tab"][data-testid="tab-operators"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(operatorsTab);
      });

      expect(getBlueX7EffectiveValues).toHaveBeenCalledTimes(1);
      const op1Calls = getBlueX7EffectiveValues.mock.calls[0][0];
      expect(op1Calls.parameterIds).toHaveLength(24);
      expect(op1Calls.parameterIds).toContain('id-operator.1.frequencyCoarse');
      expect(op1Calls.parameterIds).toContain('id-common.oscillatorKeySync');
      expect(op1Calls.parameterIds).toContain('id-lfo.pitchModulationSensitivity');

      getBlueX7EffectiveValues.mockClear();

      // 3. Switch to Op 2: 24 parameters requested (Op 2 group)
      const op2Tab = container?.querySelector(
        '[role="tab"][data-testid="operator-tab-2"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(op2Tab);
      });

      expect(getBlueX7EffectiveValues).toHaveBeenCalledTimes(1);
      const op2Calls = getBlueX7EffectiveValues.mock.calls[0][0];
      expect(op2Calls.parameterIds).toHaveLength(24);
      expect(op2Calls.parameterIds).toContain('id-operator.2.frequencyCoarse');

      getBlueX7EffectiveValues.mockClear();

      // 4. Switch to Pitch Envelope tab: 8 parameters requested
      const pitchTab = container?.querySelector(
        '[role="tab"][data-testid="tab-pitch"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(pitchTab);
      });

      expect(getBlueX7EffectiveValues).toHaveBeenCalledTimes(1);
      const pitchCalls = getBlueX7EffectiveValues.mock.calls[0][0];
      expect(pitchCalls.parameterIds).toHaveLength(8);
      expect(pitchCalls.parameterIds).toContain('id-pitchEnvelope.1.rate');

      getBlueX7EffectiveValues.mockClear();

      // 5. Switch to Csound tab: 0 parameters -> request suppressed
      const csoundTab = container?.querySelector(
        '[role="tab"][data-testid="tab-csound"]',
      ) as HTMLButtonElement;
      act(() => {
        clickElement(csoundTab);
      });

      expect(getBlueX7EffectiveValues).not.toHaveBeenCalled();
    });

    it('renders mixed placeholder for shared PMS and rejects invalid non-numeric input (T030)', () => {
      renderEditor({ sharedPitchModulationSensitivity: 'mixed' });

      const sharedPmsInput = container?.querySelector('#bluex7-shared-pms') as HTMLInputElement;
      expect(sharedPmsInput).not.toBeNull();
      expect(sharedPmsInput.placeholder).toBe('mixed');
      expect(sharedPmsInput.value).toBe('');

      // Non-numeric input does not dispatch invalid patch
      lastPatch = null;
      act(() => {
        setInputValue(sharedPmsInput, 'abc');
      });
      expect(lastPatch).toBeNull();
    });
  });
});
