// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MidiImportDialog from '../components/workbench/panels/MidiImportDialog';
import type { MidiImportPreview } from '../../shared/midi-import';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const preview: MidiImportPreview = {
  fileName: 'notes.mid',
  format: 0,
  ticksPerBeat: 480,
  streams: [{
    streamKey: '0:0',
    trackIndex: 0,
    trackName: 'Piano',
    channel: 0,
    noteCount: 2,
    firstBeat: 0,
    lastBeat: 2,
    warnings: [],
    defaults: {
      streamKey: '0:0',
      instrumentId: '1',
      noteTemplate: 'i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY>',
      trimTime: false,
    },
  }],
};

describe('MidiImportDialog', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const startMidiImport = vi.fn().mockResolvedValue({ status: 'ready', token: 'token-1', preview });
  const commitMidiImport = vi.fn().mockResolvedValue({ status: 'installed', project: {} });
  const cancelMidiImport = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      startMidiImport,
      commitMidiImport,
      cancelMidiImport,
    };
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('loads rows from the native-menu event and commits edited settings', async () => {
    act(() => root!.render(<MidiImportDialog />));
    expect(document.querySelector('h2')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-midi-import'));
    });

    expect(document.querySelector('h2')?.textContent).toBe('MIDI Import Settings');
    expect(document.body.textContent).toContain('Piano');

    const input = document.querySelector('input[aria-label="Instrument ID for 0:0"]') as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      nativeSetter?.call(input, '7');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      const importButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Import');
      importButton?.click();
    });

    expect(commitMidiImport).toHaveBeenCalledWith('token-1', [expect.objectContaining({ instrumentId: '7' })]);
  });

  it('cancels a ready import without committing', async () => {
    act(() => root!.render(<MidiImportDialog />));
    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-midi-import'));
    });
    act(() => {
      const cancelButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Cancel');
      cancelButton?.click();
    });

    expect(cancelMidiImport).toHaveBeenCalledWith('token-1');
    expect(commitMidiImport).not.toHaveBeenCalled();
    expect(document.querySelector('h2')).toBeNull();
  });

  it('rejects zero as an instrument ID before committing', async () => {
    act(() => root!.render(<MidiImportDialog />));
    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-midi-import'));
    });

    const input = document.querySelector('input[aria-label="Instrument ID for 0:0"]') as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      nativeSetter?.call(input, '0');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      const importButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Import');
      importButton?.click();
    });

    expect(commitMidiImport).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('must not be zero');
  });

  it('keeps the dialog open and displays commit errors', async () => {
    commitMidiImport.mockResolvedValueOnce({ status: 'error', message: 'The MIDI import session has expired.' });
    act(() => root!.render(<MidiImportDialog />));
    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-midi-import'));
    });
    await act(async () => {
      const importButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Import');
      importButton?.click();
    });

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('expired');
    expect(document.querySelector('h2')?.textContent).toBe('MIDI Import Settings');
  });

  it('keeps the dialog open when project replacement is cancelled', async () => {
    commitMidiImport.mockResolvedValueOnce({ status: 'cancelled' });
    act(() => root!.render(<MidiImportDialog />));
    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-midi-import'));
    });
    await act(async () => {
      const importButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Import');
      importButton?.click();
    });

    expect(document.querySelector('h2')?.textContent).toBe('MIDI Import Settings');
  });

  it('shows note-pairing warnings from the preview', async () => {
    startMidiImport.mockResolvedValueOnce({
      status: 'ready',
      token: 'token-warnings',
      preview: {
        ...preview,
        streams: [{
          ...preview.streams[0],
          warnings: [{
            code: 'dangling-note-on',
            message: 'Closed dangling note-on for key 60 at the end of the stream.',
            trackIndex: 0,
            channel: 0,
            tick: 960,
          }],
        }],
      },
    });
    act(() => root!.render(<MidiImportDialog />));
    await act(async () => {
      window.dispatchEvent(new CustomEvent('blue-open-midi-import'));
    });

    expect(document.body.textContent).toContain('Closed dangling note-on for key 60');
  });
});
