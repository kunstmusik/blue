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

const singleSysExPath = path.join(__dirname, '../../../../blue-data/src/instruments/blue-x7/test-fixtures/single-voice.syx');
const singleSysExBytes = new Uint8Array(readFileSync(singleSysExPath));

describe('BlueX7 — Editor-Local Undo / Redo History', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let dispatchedPatches: InstrumentPatch[] = [];

  const onInstrumentPatch = vi.fn((patch: InstrumentPatch) => {
    dispatchedPatches.push(patch);
  });
  const onOrchestraPatch = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    dispatchedPatches = [];
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

  function renderEditor(snapshot: BlueX7InstrumentSnapshot) {
    act(() => {
      root?.render(
        <BlueX7Editor
          instrument={snapshot}
          onInstrumentPatch={onInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
        />,
      );
    });
  }

  it('initially disables undo and redo buttons', () => {
    const voice = createDefaultBlueX7Voice();
    const instrument: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-1',
      type: 'blueX7',
      name: 'Default X7',
      enabled: true,
      comment: '',
      voice,
    };

    renderEditor(instrument);

    const undoBtn = container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement;
    const redoBtn = container?.querySelector('button[aria-label="Redo BlueX7 edit"]') as HTMLButtonElement;

    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
  });

  it('enables undo after parameter edits and restores prior voice state on undo', () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 19;
    const instrument: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-1',
      type: 'blueX7',
      name: 'Default X7',
      enabled: true,
      comment: '',
      voice,
    };

    renderEditor(instrument);

    const algSelect = container?.querySelector('#bluex7-algorithm') as HTMLSelectElement;
    act(() => {
      setInputValue(algSelect, '5');
    });

    const undoBtn = container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement;
    const redoBtn = container?.querySelector('button[aria-label="Redo BlueX7 edit"]') as HTMLButtonElement;

    expect(undoBtn.disabled).toBe(false);
    expect(redoBtn.disabled).toBe(true);

    // Clicking Undo should dispatch replaceVoice with algorithm = 19
    act(() => {
      clickElement(undoBtn);
    });

    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(false);

    const last = dispatchedPatches[dispatchedPatches.length - 1];
    expect(last?.blueX7).toEqual({
      type: 'replaceVoice',
      voice: expect.objectContaining({
        common: expect.objectContaining({ algorithm: 19 }),
      }),
    });

    // Clicking Redo should reapply the voice
    act(() => {
      clickElement(redoBtn);
    });

    expect(undoBtn.disabled).toBe(false);
    expect(redoBtn.disabled).toBe(true);
  });

  it('resets undo/redo history when switching instrument assignment ID', () => {
    const voice1 = createDefaultBlueX7Voice();
    const instrument1: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-1',
      type: 'blueX7',
      name: 'X7 #1',
      enabled: true,
      comment: '',
      voice: voice1,
    };

    renderEditor(instrument1);

    const feedbackInput = container?.querySelector('#bluex7-feedback') as HTMLInputElement;
    act(() => {
      setInputValue(feedbackInput, '2');
    });

    let undoBtn = container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);

    // Switch to instrument #2 (assignmentId: 'x7-2')
    const voice2 = createDefaultBlueX7Voice();
    const instrument2: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-2',
      type: 'blueX7',
      name: 'X7 #2',
      enabled: true,
      comment: '',
      voice: voice2,
    };

    renderEditor(instrument2);

    undoBtn = container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement;
    const redoBtn = container?.querySelector('button[aria-label="Redo BlueX7 edit"]') as HTMLButtonElement;

    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
  });

  it('resets history when the host externally replaces the voice in the same context', () => {
    const instrument1: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-1',
      type: 'blueX7',
      name: 'X7 #1',
      enabled: true,
      comment: '',
      voice: createDefaultBlueX7Voice(),
    };

    renderEditor(instrument1);
    const feedbackInput = container?.querySelector('#bluex7-feedback') as HTMLInputElement;
    act(() => {
      setInputValue(feedbackInput, '2');
    });
    expect((container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement).disabled).toBe(false);

    const replacement = createDefaultBlueX7Voice();
    replacement.common.algorithm = 4;
    renderEditor({ ...instrument1, voice: replacement });

    expect((container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement).disabled).toBe(true);
    expect((container?.querySelector('button[aria-label="Redo BlueX7 edit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not add Csound post-code edits to BlueX7 undo history', () => {
    const instrument: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-1',
      type: 'blueX7',
      name: 'Default X7',
      enabled: true,
      comment: '',
      voice: createDefaultBlueX7Voice(),
    };

    renderEditor(instrument);
    const postCodeArea = container?.querySelector('textarea[aria-label="Csound Post Code"]') as HTMLTextAreaElement;
    act(() => {
      setInputValue(postCodeArea, 'outs aout, aout');
    });

    expect((container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement).disabled).toBe(true);
    expect((container?.querySelector('button[aria-label="Redo BlueX7 edit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('records a SysEx import as a single undo step that restores the prior voice', async () => {
    const voice = createDefaultBlueX7Voice();
    const instrument: BlueX7InstrumentSnapshot = {
      assignmentId: 'x7-1',
      type: 'blueX7',
      name: 'Default X7',
      enabled: true,
      comment: '',
      voice,
    };

    const importedVoice = decodeSingleVoice(singleSysExBytes).voice;
    const onImportSysEx = vi.fn().mockResolvedValue({
      status: 'selected',
      fileName: 'single-voice.syx',
      bytes: singleSysExBytes.slice().buffer,
    });

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

    const confirmBtn = container?.querySelector('button[aria-label="Confirm SysEx Import"]') as HTMLButtonElement;
    act(() => {
      clickElement(confirmBtn);
    });

    // FR-011: the import is exactly one atomic patch
    expect(dispatchedPatches).toHaveLength(1);
    expect(dispatchedPatches[0].blueX7).toEqual({ type: 'replaceVoice', voice: importedVoice });

    // One undo step fully restores the prior voice
    const undoBtn = container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);
    act(() => {
      clickElement(undoBtn);
    });

    expect(dispatchedPatches).toHaveLength(2);
    expect(dispatchedPatches[1].blueX7).toEqual({ type: 'replaceVoice', voice });
    // A second undo must be impossible: the import was one step
    expect((container?.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
