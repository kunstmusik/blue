// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SettingsApp from '../components/settings/SettingsApp';
import { createDefaultProgramSettings } from '../../shared/program-settings';
import type { ProgramSettingsSnapshot } from '../../shared/program-settings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const defaultSettings = createDefaultProgramSettings('darwin');

const mockBlueAPI = {
  getProgramSettings: vi.fn(() => Promise.resolve({ ...defaultSettings })),
  saveProgramSettings: vi.fn((s: ProgramSettingsSnapshot) =>
    Promise.resolve({ ok: true, snapshot: s })),
  resetProgramSettingsPanel: vi.fn((panel: string) =>
    Promise.resolve({ ...defaultSettings })),
  getProgramSettingsUsageMatrix: vi.fn(() => Promise.resolve([])),
  syncLegacyRendererSettings: vi.fn(() => Promise.resolve({ ...defaultSettings })),
  openSettingsWindow: vi.fn(() => Promise.resolve()),
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).window = { blueAPI: mockBlueAPI };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('settings renderer (044)', () => {
  it('shows all six active Java Blue category panels', async () => {
    mockBlueAPI.getProgramSettings.mockResolvedValueOnce({ ...defaultSettings });

    await act(async () => {
      root.render(<SettingsApp />);
    });

    expect(container.textContent).toContain('General');
    expect(container.textContent).toContain('Project Defaults');
    expect(container.textContent).toContain('Playback');
    expect(container.textContent).toContain('Utility');
    expect(container.textContent).toContain('Realtime Render');
    expect(container.textContent).toContain('Disk Render');
    expect(container.textContent).not.toContain('MIDI');
    expect(container.textContent).not.toContain('OSC');
  });

  it('shows General panel by default', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    expect(container.textContent).toContain('Work Directory');
    expect(container.textContent).toContain('Message Colors Enabled');
  });

  it('switches to Project Defaults panel', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pdButton = buttons.find((b) => b.textContent === 'Project Defaults');
    await act(() => { pdButton?.click(); });

    expect(container.textContent).toContain('Default Author');
    expect(container.textContent).toContain('Mixer Enabled');
    expect(container.textContent).toContain('Primary Ruler');
  });

  it('switches to Playback panel', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pbButton = buttons.find((b) => b.textContent === 'Playback');
    await act(() => { pbButton?.click(); });

    expect(container.textContent).toContain('Time Pointer Animation FPS');
    expect(container.textContent).toContain('Score Follows Playback');
  });

  it('switches to Realtime Render panel', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const rtButton = buttons.find((b) => b.textContent === 'Realtime Render');
    await act(() => { rtButton?.click(); });

    expect(container.textContent).toContain('Csound Executable');
    expect(container.textContent).toContain('Audio Driver');
  });

  it('calls saveProgramSettings on Apply after edit', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const input = container.querySelector('input[placeholder="(default user directory)"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await act(() => {
      (input as HTMLInputElement)?.focus();
    });
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '/new-dir');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const applyButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Apply',
    );
    await act(async () => {
      applyButton?.click();
    });
    expect(mockBlueAPI.saveProgramSettings).toHaveBeenCalled();
  });

  it('shows dependency notes on Utility panel', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const utilButton = buttons.find((b) => b.textContent === 'Utility');
    await act(() => { utilButton?.click(); });

    expect(container.textContent).toContain('freeze/unfreeze');
    expect(container.textContent).toContain('SoundFont inspection remains unavailable');
  });
});
