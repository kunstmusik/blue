// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SoundFontViewerPanel from '../components/workbench/panels/tools/SoundFontViewerPanel';
import { emitPendingSoundFontFile } from '../components/workbench/panels/tools/soundfont-viewer-bus';
import { DEFAULT_SPLIT_SIZE_PX } from '../../shared/window-layout-settings';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('SoundFont Viewer panel', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const selectSoundFontFile = vi.fn();
  const inspectSoundFont = vi.fn();
  const writeClipboardText = vi.fn();
  const getPathForFile = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    selectSoundFontFile.mockResolvedValue('/SoundFonts/Piano.sf2');
    getPathForFile.mockImplementation((file: { name?: string }) => `/Dropped/${file.name ?? ''}`);
    inspectSoundFont.mockResolvedValue({
      filePath: '/SoundFonts/Piano.sf2',
      instruments: [{ number: 0, name: 'Piano' }],
      presets: [{ number: 0, name: 'Grand Piano', bank: 0, presetNumber: 0 }],
    });
    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      selectSoundFontFile,
      inspectSoundFont,
      writeClipboardText,
      getPathForFile,
    };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('chooses a file and renders the inspected instrument and preset tables', async () => {
    act(() => {
      root!.render(<SoundFontViewerPanel />);
    });

    const chooseButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Choose file'),
    );
    await act(async () => {
      chooseButton?.click();
    });

    expect(selectSoundFontFile).toHaveBeenCalledOnce();
    expect(inspectSoundFont).toHaveBeenCalledWith('/SoundFonts/Piano.sf2');
    expect(document.body.textContent).toContain('Piano.sf2');
    expect(document.body.textContent).toContain('/SoundFonts/Piano.sf2');
    expect(document.body.textContent).toContain('Grand Piano');
    const tables = Array.from(document.querySelectorAll('table'));
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      expect(table.classList).toContain('text-role-body');
      expect(table.querySelector('thead')?.classList).toContain('text-role-headline');
      expect(table.querySelector('thead')?.classList).toContain('font-bold');
    }
  });

  it('accepts an operating-system file drop and rejects non-SoundFont paths', async () => {
    act(() => {
      root!.render(<SoundFontViewerPanel />);
    });

    const dropTarget = container!.querySelector('[data-soundfont-drop-target]')!;
    expect(document.body.textContent).not.toContain('Drop an .sf2 file here');
    const dragEnterEvent = new Event('dragenter', { bubbles: true, cancelable: true });
    Object.defineProperty(dragEnterEvent, 'dataTransfer', {
      value: { dropEffect: 'none' },
    });
    act(() => {
      dropTarget.dispatchEvent(dragEnterEvent);
    });
    expect(dropTarget.className).toContain('bg-app-accent/10');

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [{ name: 'Orchestra.sf2' }],
        getData: () => '',
      },
    });
    await act(async () => {
      dropTarget.dispatchEvent(dropEvent);
    });
    expect(inspectSoundFont).toHaveBeenCalledWith('/Dropped/Orchestra.sf2');

    const invalidDropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(invalidDropEvent, 'dataTransfer', {
      value: {
        files: [{ name: 'not-a-soundfont.wav' }],
        getData: () => '',
      },
    });
    await act(async () => {
      dropTarget.dispatchEvent(invalidDropEvent);
    });
    expect(document.body.textContent).toContain('Choose or drop an .sf2 SoundFont file.');
  });

  it('rejects a File Manager regular-file payload through its existing .sf2 filter', async () => {
    act(() => {
      root!.render(<SoundFontViewerPanel />);
    });

    const dropTarget = container!.querySelector('[data-soundfont-drop-target]')!;
    const fileManagerDrop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(fileManagerDrop, 'dataTransfer', {
      value: {
        files: [],
        getData: (type: string) =>
          type === 'text/plain'
            ? '/Users/me/samples/a.wav'
            : type === 'application/x-blue-file-manager-file'
              ? JSON.stringify({
                  version: 1,
                  kind: 'file',
                  path: '/Users/me/samples/a.wav',
                  name: 'a.wav',
                })
              : '',
      },
    });
    await act(async () => {
      dropTarget.dispatchEvent(fileManagerDrop);
    });

    // The embedded browser retains its own .sf2-scoped behavior; no File
    // Manager drop operation is implied.
    expect(inspectSoundFont).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Choose or drop an .sf2 SoundFont file.');
  });

  it('inspects a File Manager double-clicked .sf2 delivered on the pending-file bus', async () => {
    act(() => {
      root!.render(<SoundFontViewerPanel />);
    });

    emitPendingSoundFontFile('/SoundFonts/Choir.sf2');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(inspectSoundFont).toHaveBeenCalledWith('/SoundFonts/Choir.sf2');
    expect(document.body.textContent).toContain('Choir.sf2');
  });

  it('holds a pending .sf2 emitted before mount and inspects it on mount', async () => {
    root!.unmount();
    container!.remove();

    emitPendingSoundFontFile('/SoundFonts/Late.sf2');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const lateRoot = createRoot(host);
    act(() => {
      lateRoot.render(<SoundFontViewerPanel />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(inspectSoundFont).toHaveBeenCalledWith('/SoundFonts/Late.sf2');

    act(() => {
      lateRoot.unmount();
    });
    host.remove();
  });

  it('keeps the scoped Copy full path action working after File Manager integration', async () => {
    act(() => {
      root!.render(<SoundFontViewerPanel />);
    });

    const chooseButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Choose file'),
    );
    await act(async () => {
      chooseButton?.click();
    });

    const copyButton = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Copy full path"]',
    )!;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
    });
    expect(writeClipboardText).toHaveBeenCalledWith('/SoundFonts/Piano.sf2');
  });

  it('switches the splitter to left/right when the panel reaches the wide breakpoint', () => {
    act(() => {
      root!.render(<SoundFontViewerPanel />);
    });

    const panel = container!.querySelector('[data-soundfont-panel]') as HTMLElement;
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      width: 700,
      height: 500,
      top: 0,
      right: 700,
      bottom: 500,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(
      container!.querySelector('[data-soundfont-splitter]')?.getAttribute('aria-orientation'),
    ).toBe('vertical');
  });

  it('uses the shared 200px default for the table splitter', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 700,
      height: 500,
      top: 0,
      right: 700,
      bottom: 500,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    try {
      act(() => {
        root!.render(<SoundFontViewerPanel />);
      });

      expect(
        container!.querySelector('[data-soundfont-splitter]')?.getAttribute('aria-valuenow'),
      ).toBe(String(DEFAULT_SPLIT_SIZE_PX));
    } finally {
      rectSpy.mockRestore();
    }
  });
});
