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

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Csound Post Code"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLElement, value: string) {
  const tracker = (input as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
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

const fixturesDir = path.join(__dirname, '../../../../blue-data/src/instruments/blue-x7/test-fixtures');
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

    const enabledCheckbox = container?.querySelector('input[aria-label="Instrument Enabled"]') as HTMLInputElement;
    act(() => {
      clickElement(enabledCheckbox);
    });
    expect(onInstrumentPatch).toHaveBeenCalledWith({ enabled: false });
  });

  it('dispatches Common parameter updates and operator enables', () => {
    renderEditor();

    const algSelect = container?.querySelector('#bluex7-algorithm') as HTMLSelectElement;
    act(() => {
      setInputValue(algSelect, '5');
    });
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

    const op2Toggle = container?.querySelector('button[aria-label="Toggle Operator 2"]') as HTMLButtonElement;
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

    const sharedSyncCheckbox = container?.querySelector('input[aria-label="Shared Oscillator Sync"]') as HTMLInputElement;
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

    const operatorSync = container?.querySelector('input[aria-label="Operator Oscillator Sync"]') as HTMLInputElement;
    act(() => {
      clickElement(operatorSync);
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setSharedOscillatorSync',
      value: 0,
    });

    const operatorPms = container?.querySelector('input[aria-label="Pitch Modulation Sensitivity"]') as HTMLInputElement;
    act(() => {
      setInputValue(operatorPms, '5');
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setSharedPitchModulationSensitivity',
      value: 5,
    });
  });

  it('dispatches LFO parameter updates', () => {
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

    const waveSelect = container?.querySelector('#bluex7-lfo-wave') as HTMLSelectElement;
    act(() => {
      setInputValue(waveSelect, '4'); // Sine
    });
    expect(lastPatch?.blueX7).toEqual({
      type: 'setLfoField',
      field: 'wave',
      value: 4,
    });
  });

  it('switches active operator tabs and edits operator parameters and envelope', () => {
    renderEditor();

    // Switch to Operator 3 tab (index 2)
    const op3Tab = container?.querySelector('button[aria-label="Select Operator 3"]') as HTMLButtonElement;
    act(() => {
      clickElement(op3Tab);
    });

    const outputLevelInput = container?.querySelector('#bluex7-op-output-level') as HTMLInputElement;
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

    const postCodeArea = container?.querySelector('textarea[aria-label="Csound Post Code"]') as HTMLTextAreaElement;
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    expect(onImportSysEx).toHaveBeenCalled();

    const dialog = container?.querySelector('[data-testid="sysex-import-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('TESTVOICE1');

    const confirmBtn = container?.querySelector('button[aria-label="Confirm SysEx Import"]') as HTMLButtonElement;
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const cancelBtn = container?.querySelector('button[aria-label="Cancel SysEx Import"]') as HTMLButtonElement;
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
    importBtn.focus();
    await act(async () => {
      clickElement(importBtn);
    });

    const dialog = container?.querySelector('[data-testid="sysex-import-dialog"]') as HTMLElement;
    const closeBtn = dialog.querySelector('button[aria-label="Close SysEx Dialog"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeBtn);

    act(() => {
      const panel = dialog.querySelector('.flex.flex-col') as HTMLElement;
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container?.querySelector('[data-testid="sysex-import-dialog"]')).toBeNull();
    expect(document.activeElement).toBe(importBtn);
  });

  it('discards an import result when the editor target changes while reading', async () => {
    let resolveRead: ((value: import('../../shared/blue-x7-sysex').BlueX7SysexReadResult) => void) | undefined;
    const pendingRead = new Promise<import('../../shared/blue-x7-sysex').BlueX7SysexReadResult>((resolve) => {
      resolveRead = resolve;
    });
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
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
    expect(container?.querySelector('[data-testid="sysex-error-banner"]')?.textContent).toContain('target changed');
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    expect(container?.querySelector('[data-testid="sysex-import-dialog"]')).not.toBeNull();

    const cancelBtn = container?.querySelector('button[aria-label="Cancel SysEx Bank Import"]') as HTMLButtonElement;
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const slotBtn = container?.querySelector('button[aria-label^="Import Bank Slot"]') as HTMLButtonElement;
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    expect(onInstrumentPatch).not.toHaveBeenCalled();
    expect(container?.querySelector('[data-testid="sysex-error-banner"]')?.textContent).toContain('Invalid SysEx checksum');
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

    const importBtn = container?.querySelector('button[aria-label="Import DX7 SysEx File"]') as HTMLButtonElement;
    await act(async () => {
      clickElement(importBtn);
    });

    const errorBanner = container?.querySelector('[data-testid="sysex-error-banner"]');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.textContent).toContain('Not a valid DX7 SysEx file');

    // FR-017: a failed import must leave the selected instrument unchanged
    expect(onInstrumentPatch).not.toHaveBeenCalled();
  });
});
