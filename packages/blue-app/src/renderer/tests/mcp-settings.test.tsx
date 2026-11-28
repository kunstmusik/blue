// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import SettingsApp from '../components/settings/SettingsApp';
import {
  createDefaultProgramSettings,
  type ProgramSettingsSnapshot,
} from '../../shared/program-settings';
import type { McpServerStatus } from '../../shared/mcp-server';
import { chooseAppSelectOption } from './app-select-test-utils';

const RAW_CREDENTIAL_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const defaultSettings = createDefaultProgramSettings('darwin');
let statusListener: ((status: McpServerStatus) => void) | null = null;
const unsubscribeStatusSpy = vi.fn(() => {
  statusListener = null;
});

function makeMcpStatus(overrides: Partial<McpServerStatus> = {}): McpServerStatus {
  return {
    phase: 'stopped',
    preferredPort: 8765,
    accessMode: 'read-only',
    activePort: null,
    fallbackFrom: null,
    credentialStorage: null,
    error: null,
    revision: 1,
    updatedAt: '2026-11-26T00:00:00.000Z',
    ...overrides,
  };
}

const mockBlueAPI = {
  getProgramSettings: vi.fn(() => Promise.resolve(structuredClone(defaultSettings))),
  saveProgramSettings: vi.fn((snapshot: ProgramSettingsSnapshot) =>
    Promise.resolve({ ok: true, snapshot }),
  ),
  resetProgramSettingsPanel: vi.fn(() => Promise.resolve(structuredClone(defaultSettings))),
  getProgramSettingsUsageMatrix: vi.fn(() => Promise.resolve([])),
  syncLegacyRendererSettings: vi.fn(() => Promise.resolve(structuredClone(defaultSettings))),
  openSettingsWindow: vi.fn(() => Promise.resolve()),
  onSettingsCloseRequest: vi.fn(() => () => {}),
  confirmSettingsClose: vi.fn(() => Promise.resolve<'yes' | 'no' | 'cancel'>('cancel')),
  resolveSettingsClose: vi.fn(),
  getOscServerSnapshot: vi.fn(() =>
    Promise.resolve({
      phase: 'stopped',
      preferredPort: 8000,
      activePort: null,
      fallbackFrom: null,
      lastBindError: null,
      lastPacketError: null,
      revision: 1,
      updatedAt: '2026-11-26T00:00:00.000Z',
    }),
  ),
  onOscServerSnapshot: vi.fn(() => () => {}),
  getMcpServerStatus: vi.fn(() => Promise.resolve(makeMcpStatus())),
  onMcpServerStatus: vi.fn((callback: (status: McpServerStatus) => void) => {
    statusListener = callback;
    return unsubscribeStatusSpy;
  }),
  copyMcpCredential: vi.fn(() => Promise.resolve({ ok: true as const })),
  copyMcpClientConfig: vi.fn(() => Promise.resolve({ ok: true as const })),
  rotateMcpCredential: vi.fn(() =>
    Promise.resolve({ ok: true as const, storage: 'persisted' as const }),
  ),
};

let container: HTMLDivElement;
let root: Root;

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function findSelectTrigger(labelText: string): HTMLElement {
  const label = Array.from(container.querySelectorAll('label')).find(
    (candidate) => candidate.textContent === labelText,
  );
  if (!label) throw new Error(`Label not found: ${labelText}`);
  const trigger = document.getElementById(label.htmlFor);
  if (!trigger) throw new Error(`Control not found for label: ${labelText}`);
  return trigger;
}

async function openMcpPanel(): Promise<void> {
  await act(async () => {
    root.render(<SettingsApp />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    findButton('MCP').click();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  statusListener = null;
  mockBlueAPI.getProgramSettings.mockImplementation(() =>
    Promise.resolve(structuredClone(defaultSettings)),
  );
  mockBlueAPI.getMcpServerStatus.mockImplementation(() => Promise.resolve(makeMcpStatus()));
  mockBlueAPI.copyMcpCredential.mockImplementation(() => Promise.resolve({ ok: true as const }));
  mockBlueAPI.copyMcpClientConfig.mockImplementation(() => Promise.resolve({ ok: true as const }));
  mockBlueAPI.rotateMcpCredential.mockImplementation(() =>
    Promise.resolve({ ok: true as const, storage: 'persisted' as const }),
  );
  (window as typeof window & { blueAPI: typeof mockBlueAPI }).blueAPI = mockBlueAPI;
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

describe('MCP settings panel (T012, T037)', () => {
  it('reads initial status, subscribes to updates, and cleans up on unmount', async () => {
    await openMcpPanel();

    expect(mockBlueAPI.getMcpServerStatus).toHaveBeenCalledTimes(1);
    expect(mockBlueAPI.onMcpServerStatus).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Stopped');

    act(() => {
      statusListener?.(
        makeMcpStatus({
          phase: 'listening',
          activePort: 8765,
          credentialStorage: 'persisted',
          revision: 2,
        }),
      );
    });

    expect(container.textContent).toContain('Listening');
    expect(container.textContent).toContain('http://127.0.0.1:8765/mcp');
    expect(container.textContent).not.toContain(RAW_CREDENTIAL_SECRET);

    act(() => {
      root.unmount();
    });
    expect(unsubscribeStatusSpy).toHaveBeenCalledTimes(1);
  });

  it('shows disabled defaults, enables MCP, and saves explicit read-write access mode', async () => {
    await openMcpPanel();

    const enableCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const accessTrigger = findSelectTrigger('Access Mode');

    expect(enableCheckbox.checked).toBe(false);
    expect(portInput.value).toBe('8765');
    expect(accessTrigger.textContent).toContain('Read-only');

    await act(async () => {
      enableCheckbox.click();
    });
    await chooseAppSelectOption(accessTrigger, 'Read-write');

    expect(container.textContent).toContain('Read-write access allows authenticated local MCP');

    await act(async () => {
      findButton('Apply').click();
    });

    expect(mockBlueAPI.saveProgramSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mcp: {
          enabled: true,
          preferredPort: 8765,
          accessMode: 'read-write',
        },
      }),
    );
  });

  it('validates preferred port bounds and disables Apply when invalid', async () => {
    await openMcpPanel();

    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const applyButton = findButton('Apply');

    for (const invalid of ['1023', '65536', '']) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          portInput,
          invalid,
        );
        portInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(container.textContent).toContain(
        'Enter a whole port number from 1024 through 65535 before applying.',
      );
      expect(applyButton.disabled).toBe(true);
    }

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        portInput,
        '9876',
      );
      portInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(applyButton.disabled).toBe(false);

    await act(async () => {
      applyButton.click();
    });

    expect(mockBlueAPI.saveProgramSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mcp: expect.objectContaining({ preferredPort: 9876 }),
      }),
    );
  });

  it('shows preferred vs actual fallback port, session-only storage notice, and sanitized errors', async () => {
    mockBlueAPI.getMcpServerStatus.mockResolvedValueOnce(
      makeMcpStatus({
        phase: 'listening',
        preferredPort: 8765,
        activePort: 51234,
        fallbackFrom: 8765,
        credentialStorage: 'session-only',
        revision: 4,
      }),
    );

    await openMcpPanel();

    expect(container.textContent).toContain('http://127.0.0.1:51234/mcp');
    expect(container.textContent).toContain(
      'Port 8765 was already in use; MCP is listening on fallback port 51234.',
    );
    expect(container.textContent).toContain('Session-only');

    act(() => {
      statusListener?.(
        makeMcpStatus({
          phase: 'error',
          preferredPort: 8765,
          activePort: null,
          fallbackFrom: null,
          credentialStorage: null,
          error: {
            code: 'LOCKED_CREDENTIAL',
            message: 'The saved MCP credential is locked.',
          },
          revision: 5,
        }),
      );
    });

    expect(container.textContent).toContain('Error');
    expect(container.textContent).toContain('The saved MCP credential is locked.');
  });

  it('disables copy buttons while unavailable and performs copy and rotate without raw tokens in IPC or DOM', async () => {
    await openMcpPanel();

    expect(findButton('Copy Credential').disabled).toBe(true);
    expect(findButton('Copy Client Config').disabled).toBe(true);
    expect(findButton('Rotate Credential').disabled).toBe(false);

    // Listening without credentialStorage still disables copying.
    act(() => {
      statusListener?.(
        makeMcpStatus({
          phase: 'listening',
          activePort: 8765,
          credentialStorage: null,
          revision: 2,
        }),
      );
    });
    expect(findButton('Copy Credential').disabled).toBe(true);
    expect(findButton('Copy Client Config').disabled).toBe(true);

    // Ready state enables copying.
    act(() => {
      statusListener?.(
        makeMcpStatus({
          phase: 'listening',
          activePort: 8765,
          credentialStorage: 'persisted',
          revision: 3,
        }),
      );
    });

    const copyTokenButton = findButton('Copy Credential');
    const copyConfigButton = findButton('Copy Client Config');
    expect(copyTokenButton.disabled).toBe(false);
    expect(copyConfigButton.disabled).toBe(false);

    await act(async () => {
      copyTokenButton.click();
    });
    expect(mockBlueAPI.copyMcpCredential).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Bearer credential copied to clipboard.');
    expect(container.textContent).not.toContain(RAW_CREDENTIAL_SECRET);

    const clientTrigger = findSelectTrigger('Client Target');
    await act(async () => {
      copyConfigButton.click();
    });
    expect(mockBlueAPI.copyMcpClientConfig).toHaveBeenLastCalledWith('cursor');

    await chooseAppSelectOption(clientTrigger, 'VS Code');
    await act(async () => {
      copyConfigButton.click();
    });
    expect(mockBlueAPI.copyMcpClientConfig).toHaveBeenLastCalledWith('vscode');

    await chooseAppSelectOption(clientTrigger, 'Codex CLI / ChatGPT Desktop');
    expect(container.textContent).toContain('Settings → MCP servers → Add server');
    await act(async () => {
      copyConfigButton.click();
    });
    expect(mockBlueAPI.copyMcpClientConfig).toHaveBeenLastCalledWith('codex');
    expect(container.textContent).toContain(
      'Copied Codex CLI / ChatGPT Desktop configuration to clipboard.',
    );

    await chooseAppSelectOption(clientTrigger, 'OpenCode');
    expect(container.textContent).toContain('mcp.servers for OpenCode 2.x');
    await act(async () => {
      copyConfigButton.click();
    });
    expect(mockBlueAPI.copyMcpClientConfig).toHaveBeenLastCalledWith('opencode');

    await chooseAppSelectOption(clientTrigger, 'Google Antigravity');
    expect(container.textContent).toContain('private mcp_config.json');
    await act(async () => {
      copyConfigButton.click();
    });
    expect(mockBlueAPI.copyMcpClientConfig).toHaveBeenLastCalledWith('antigravity');
    expect(container.textContent).not.toContain(RAW_CREDENTIAL_SECRET);

    const rotateButton = findButton('Rotate Credential');
    await act(async () => {
      rotateButton.click();
    });
    expect(mockBlueAPI.rotateMcpCredential).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain(
      'Credential rotated and persisted. Previous sessions were closed.',
    );

    mockBlueAPI.rotateMcpCredential.mockResolvedValueOnce({
      ok: true,
      storage: 'session-only',
    });
    await act(async () => {
      rotateButton.click();
    });
    expect(container.textContent).toContain('Credential rotated for this session only.');

    mockBlueAPI.rotateMcpCredential.mockResolvedValueOnce({
      ok: false,
      code: 'ROTATION_FAILED',
      message: 'Previous credential could not be removed.',
    });
    await act(async () => {
      rotateButton.click();
    });
    expect(container.textContent).toContain('Previous credential could not be removed.');
    expect(container.textContent).not.toContain(RAW_CREDENTIAL_SECRET);
  });

  it('supports keyboard interaction on port stepping, select menus, and action buttons', async () => {
    mockBlueAPI.getMcpServerStatus.mockResolvedValueOnce(
      makeMcpStatus({
        phase: 'listening',
        activePort: 8765,
        credentialStorage: 'persisted',
        revision: 2,
      }),
    );

    await openMcpPanel();

    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      portInput.focus();
      portInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(portInput.value).toBe('8766');

    const accessTrigger = findSelectTrigger('Access Mode');
    await chooseAppSelectOption(accessTrigger, 'Read-write');
    expect(accessTrigger.textContent).toContain('Read-write');

    const copyButton = findButton('Copy Credential');
    expect(copyButton.type).toBe('button');
    expect(copyButton.className).toContain('focus-visible:ring-app-focus');
    await act(async () => {
      copyButton.focus();
      expect(document.activeElement).toBe(copyButton);
    });
  });
});
