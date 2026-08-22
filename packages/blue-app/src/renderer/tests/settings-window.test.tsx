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
let settingsCloseRequest: (() => void) | null = null;

const mockBlueAPI = {
  getProgramSettings: vi.fn(() => Promise.resolve({ ...defaultSettings })),
  saveProgramSettings: vi.fn((s: ProgramSettingsSnapshot) =>
    Promise.resolve({ ok: true, snapshot: s })),
  resetProgramSettingsPanel: vi.fn((panel: string) =>
    Promise.resolve({ ...defaultSettings })),
  getProgramSettingsUsageMatrix: vi.fn(() => Promise.resolve([])),
  syncLegacyRendererSettings: vi.fn(() => Promise.resolve({ ...defaultSettings })),
  openSettingsWindow: vi.fn(() => Promise.resolve()),
  onSettingsCloseRequest: vi.fn((callback: () => void) => {
    settingsCloseRequest = callback;
    return () => {
      if (settingsCloseRequest === callback) settingsCloseRequest = null;
    };
  }),
  confirmSettingsClose: vi.fn(() => Promise.resolve<'yes' | 'no' | 'cancel'>('cancel')),
  resolveSettingsClose: vi.fn(),
  getOscServerSnapshot: vi.fn(() => Promise.resolve({
    phase: 'listening',
    preferredPort: 8000,
    activePort: 8000,
    fallbackFrom: null,
    lastBindError: null,
    lastPacketError: null,
    revision: 1,
    updatedAt: new Date().toISOString(),
  })),
  onOscServerSnapshot: vi.fn(() => () => {}),
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  settingsCloseRequest = null;
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
  it('shows the active Java Blue category panels plus MIDI and OSC panels', async () => {
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
    // SPEC 058: MIDI is now an app-wide category (distinct from project MIDI
    // mapping and realtime-render MIDI options).
    expect(container.textContent).toContain('MIDI');
    expect(container.textContent).toContain('OSC');
    const navButtons = Array.from(container.querySelectorAll('nav button'));
    expect(navButtons.map((button) => button.textContent)).toEqual([
      'General', 'Project Defaults', 'Playback', 'Utility', 'Realtime Render', 'Disk Render', 'MIDI', 'OSC',
    ]);
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

    expect(container.textContent).toContain('Csound Library Override');
    expect(container.textContent).toContain('managed Blue Engine Csound runtime');
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

  it('closes immediately when native close is requested without unsaved settings', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      settingsCloseRequest?.();
      await Promise.resolve();
    });

    expect(mockBlueAPI.confirmSettingsClose).not.toHaveBeenCalled();
    expect(mockBlueAPI.resolveSettingsClose).toHaveBeenCalledWith('allow');
  });

  it.each([
    ['yes', 'allow', true],
    ['no', 'allow', false],
    ['cancel', 'cancel', false],
  ] as const)('handles an unsaved native close choice: %s', async (choice, resolution, shouldSave) => {
    mockBlueAPI.confirmSettingsClose.mockResolvedValueOnce(choice);
    await act(async () => {
      root.render(<SettingsApp />);
    });
    await act(async () => { await Promise.resolve(); });

    const input = container.querySelector('input[placeholder="(default user directory)"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '/unsaved-dir');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      settingsCloseRequest?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockBlueAPI.confirmSettingsClose).toHaveBeenCalledTimes(1);
    expect(mockBlueAPI.saveProgramSettings).toHaveBeenCalledTimes(shouldSave ? 1 : 0);
    expect(mockBlueAPI.resolveSettingsClose).toHaveBeenCalledWith(resolution);
  });

  it('keeps Settings open when applying from the close prompt fails validation', async () => {
    mockBlueAPI.confirmSettingsClose.mockResolvedValueOnce('yes');
    mockBlueAPI.saveProgramSettings.mockResolvedValueOnce({
      ok: false,
      validationIssues: [{ path: 'osc.preferredPort', message: 'Invalid port', severity: 'error' }],
    });
    await act(async () => {
      root.render(<SettingsApp />);
    });
    await act(async () => { await Promise.resolve(); });

    const input = container.querySelector('input[placeholder="(default user directory)"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '/unsaved-dir');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      settingsCloseRequest?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockBlueAPI.resolveSettingsClose).toHaveBeenCalledWith('cancel');
    expect(container.textContent).toContain('Invalid port');
  });

  it('keeps Settings open when applying from the close prompt throws', async () => {
    mockBlueAPI.confirmSettingsClose.mockResolvedValueOnce('yes');
    mockBlueAPI.saveProgramSettings.mockRejectedValueOnce(new Error('write failed'));
    await act(async () => {
      root.render(<SettingsApp />);
    });
    await act(async () => { await Promise.resolve(); });

    const input = container.querySelector('input[placeholder="(default user directory)"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '/unsaved-dir');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      settingsCloseRequest?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockBlueAPI.resolveSettingsClose).toHaveBeenCalledWith('cancel');
  });

  it('applies, cancels, and resets the OSC preferred-port draft through Settings', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const oscButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'OSC');
    await act(() => { oscButton?.click(); });
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe('8000');

    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '9100');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const cancel = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Cancel');
    await act(() => { cancel?.click(); });
    expect(mockBlueAPI.saveProgramSettings).not.toHaveBeenCalled();

    const afterCancel = container.querySelector('input[type="number"]') as HTMLInputElement;
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(afterCancel, '9100');
      afterCancel.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const apply = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Apply');
    await act(async () => { apply?.click(); });
    expect(mockBlueAPI.saveProgramSettings).toHaveBeenCalledWith(expect.objectContaining({
      osc: { preferredPort: 9100 },
    }));

    const reset = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Reset Panel');
    await act(async () => { reset?.click(); });
    expect(mockBlueAPI.resetProgramSettingsPanel).toHaveBeenCalledWith('osc');
  });

  it('shows dependency notes on Utility panel', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const utilButton = buttons.find((b) => b.textContent === 'Utility');
    await act(() => { utilButton?.click(); });

    expect(container.textContent).toContain('Freeze Flags');
    expect(container.textContent).toContain('managed Blue Engine Csound runtime');
    expect(container.textContent).toContain('SoundFont inspection');
  });

  it('uses semantic typography roles across headers, navigation, and controls', async () => {
    await act(async () => {
      root.render(<SettingsApp />);
    });

    const rootDiv = container.querySelector('div.text-role-body');
    expect(rootDiv).toBeTruthy();

    const sectionHeadings = Array.from(container.querySelectorAll('h2'));
    expect(sectionHeadings.length).toBeGreaterThan(0);
    for (const h2 of sectionHeadings) {
      expect(h2.className).toContain('text-role-title-2');
    }

    const footerButtons = Array.from(container.querySelectorAll('div.border-t button'));
    expect(footerButtons.length).toBeGreaterThan(0);
    for (const btn of footerButtons) {
      expect(btn.className).toContain('text-role-body');
    }
  });
});
