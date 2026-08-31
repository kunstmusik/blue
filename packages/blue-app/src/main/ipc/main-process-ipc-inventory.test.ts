import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { APPLICATION_IPC_CHANNELS } from './application-ipc';
import {
  MAIN_PROCESS_DOMAIN_IPC_ORDER,
  registerMainProcessDomainIpc,
} from './main-process-domain-ipc';
import { PLAYBACK_RUNTIME_IPC_CHANNELS } from './playback-runtime-ipc';
import { PROJECT_ARTIFACTS_IPC_CHANNELS } from './project-artifacts-ipc';
import { PROJECT_DOCUMENT_IPC_CHANNELS } from './project-document-ipc';
import { PROJECT_LIFECYCLE_IPC_CHANNELS } from './project-lifecycle-ipc';
import {
  CODE_REPOSITORY_IPC_CHANNELS,
  registerCodeRepositoryIpc,
} from '../code-repository/ipc';
import type { CodeRepositoryService } from '../code-repository/service';
import {
  MIDI_INPUT_IPC_CHANNELS,
  MidiInputCoordinator,
} from '../midi-input-coordinator';
import { createDefaultProgramSettings } from '../../shared/program-settings';
import {
  UNIFIED_LIBRARY_IPC_CHANNELS,
  registerUnifiedLibraryIpc,
} from '../unified-library/ipc';
import type { UnifiedLibraryService } from '../unified-library/service';
import {
  disposeWorkbenchWindowHost,
  initWorkbenchWindowHost,
  WORKBENCH_WINDOW_IPC_CHANNELS,
} from '../workbench-window-host';

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  ipcMain: {},
}));

import type {
  IpcMainEventListener,
  IpcMainInvokeHandler,
  IpcMainLike,
} from './ipc-registration';

interface RegistrationRecord {
  mode: 'handle' | 'on';
  channelExpression: string;
  source: string;
}

async function registrations(
  fileName: string,
  receiver: 'ipcMain' | 'ipcRegistration' | 'scope',
): Promise<RegistrationRecord[]> {
  const source = await readFile(path.join(__dirname, '..', fileName), 'utf8');
  const records: RegistrationRecord[] = [];
  const pattern = new RegExp(`${receiver}\\.(handle|on)\\(\\s*([^,\\n)]+)`, 'g');
  for (const match of source.matchAll(pattern)) {
    records.push({
      mode: match[1] as RegistrationRecord['mode'],
      channelExpression: match[2].trim(),
      source: match[0],
    });
  }
  return records;
}

class CapturingIpcMain implements IpcMainLike {
  readonly handlers = new Map<string, IpcMainInvokeHandler>();
  readonly listeners = new Map<string, IpcMainEventListener>();
  readonly registrations: string[] = [];
  readonly removals: string[] = [];
  failOnChannel: string | null = null;

  handle(channel: string, listener: IpcMainInvokeHandler): void {
    if (channel === this.failOnChannel) throw new Error(`failed:${channel}`);
    if (this.handlers.has(channel) || this.listeners.has(channel)) throw new Error(`duplicate:${channel}`);
    this.handlers.set(channel, listener);
    this.registrations.push(`handle:${channel}`);
  }

  on(channel: string, listener: IpcMainEventListener): void {
    if (channel === this.failOnChannel) throw new Error(`failed:${channel}`);
    if (this.handlers.has(channel) || this.listeners.has(channel)) throw new Error(`duplicate:${channel}`);
    this.listeners.set(channel, listener);
    this.registrations.push(`on:${channel}`);
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel);
    this.removals.push(`handle:${channel}`);
  }

  removeListener(channel: string, listener: IpcMainEventListener): void {
    if (this.listeners.get(channel) === listener) this.listeners.delete(channel);
    this.removals.push(`on:${channel}`);
  }
}

function createUnifiedLibraryService(): UnifiedLibraryService {
  return {
    getSnapshot: vi.fn(() => ({ owner: 'unified-library' })),
    onSnapshot: vi.fn(() => () => undefined),
    onChanged: vi.fn(() => () => undefined),
    onContext: vi.fn(() => () => undefined),
    onEditorSession: vi.fn(() => () => undefined),
  } as unknown as UnifiedLibraryService;
}

function createCodeRepositoryService(): CodeRepositoryService {
  return {
    getStatus: vi.fn(() => ({ owner: 'code-repository' })),
    onChanged: vi.fn(() => () => undefined),
  } as unknown as CodeRepositoryService;
}

function expectedProcessWideRegistrations(collected: ReturnType<typeof collectedDomainHandlers>): string[] {
  return [
    ...MAIN_PROCESS_DOMAIN_IPC_ORDER.map((channel) => (
      collected.listeners.has(channel) ? `on:${channel}` : `handle:${channel}`
    )),
    ...WORKBENCH_WINDOW_IPC_CHANNELS.map((channel, index) => (
      index === 1 ? `on:${channel}` : `handle:${channel}`
    )),
    ...MIDI_INPUT_IPC_CHANNELS.map((channel, index) => (
      index === 1 || index === 2 ? `on:${channel}` : `handle:${channel}`
    )),
    ...UNIFIED_LIBRARY_IPC_CHANNELS.map((channel) => `handle:${channel}`),
    ...CODE_REPOSITORY_IPC_CHANNELS.map((channel) => `handle:${channel}`),
  ];
}

function registerProcessWideIpc(ipcMain: CapturingIpcMain): () => void {
  const disposers: Array<() => void> = [];
  try {
    disposers.push(registerMainProcessDomainIpc({ ipcMain, ...collectedDomainHandlers() }));

    initWorkbenchWindowHost(ipcMain);
    disposers.push(disposeWorkbenchWindowHost);

    const midi = new MidiInputCoordinator({
      ipcMain,
      getProgramSettings: () => createDefaultProgramSettings('darwin'),
      isPrimaryWebContents: () => true,
      isApplicationWebContents: () => true,
    });
    midi.registerIpcHandlers();
    disposers.push(() => midi.disposeIpcHandlers());

    disposers.push(registerUnifiedLibraryIpc({
      ipcMain: ipcMain as unknown as IpcMain,
      service: createUnifiedLibraryService(),
      getWindows: () => [],
    }));
    disposers.push(registerCodeRepositoryIpc({
      ipcMain: ipcMain as unknown as IpcMain,
      service: createCodeRepositoryService(),
      getWindows: () => [],
    }));
  } catch (error) {
    for (const dispose of disposers.slice().reverse()) {
      try {
        dispose();
      } catch {
        // Preserve the initiating registration failure.
      }
    }
    throw error;
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const dispose of disposers.slice().reverse()) dispose();
  };
}

function collectedDomainHandlers(): {
  handlers: Map<string, IpcMainInvokeHandler>;
  listeners: Map<string, IpcMainEventListener>;
} {
  const listeners = new Map<string, IpcMainEventListener>();
  const handlers = new Map<string, IpcMainInvokeHandler>();
  for (const channel of MAIN_PROCESS_DOMAIN_IPC_ORDER) {
    if (
      channel === 'sync-audition-score-object-availability'
      || channel === 'sync-follow-playback-state'
      || channel === 'settings:close-response'
    ) {
      listeners.set(channel, () => undefined);
    } else {
      handlers.set(channel, (...args: unknown[]) => ({ channel, args }));
    }
  }
  return { handlers, listeners };
}

describe('main-process IPC inventory oracle', () => {
  it('executes the full 183-endpoint composition in startup order with exact teardown', async () => {
    const ipcMain = new CapturingIpcMain();
    const collected = collectedDomainHandlers();
    const expected = expectedProcessWideRegistrations(collected);
    const dispose = registerProcessWideIpc(ipcMain);

    try {
      expect(ipcMain.registrations).toEqual(expected);
      expect(ipcMain.registrations).toHaveLength(183);
      expect(new Set(ipcMain.registrations).size).toBe(183);
      expect(ipcMain.handlers.size).toBe(177);
      expect(ipcMain.listeners.size).toBe(6);

      expect(ipcMain.handlers.get('open-file')?.({ sender: {} })).toEqual({
        channel: 'open-file',
        args: [{ sender: {} }],
      });
      expect(ipcMain.handlers.get(WORKBENCH_WINDOW_IPC_CHANNELS[4])?.({}, {})).toEqual({ docked: false });
      await expect(ipcMain.handlers.get(MIDI_INPUT_IPC_CHANNELS[3])?.({ sender: {} })).resolves.toBeNull();
      expect(ipcMain.handlers.get(UNIFIED_LIBRARY_IPC_CHANNELS[0])?.({})).toEqual({ owner: 'unified-library' });
      await expect(ipcMain.handlers.get(CODE_REPOSITORY_IPC_CHANNELS[1])?.({})).resolves.toEqual({ owner: 'code-repository' });
    } finally {
      dispose();
    }
    dispose();
    expect(ipcMain.removals).toEqual(expected.slice().reverse());
    expect(ipcMain.handlers.size).toBe(0);
    expect(ipcMain.listeners.size).toBe(0);
  });

  it('rolls completed registrars back when an existing registrar fails partway', () => {
    const ipcMain = new CapturingIpcMain();
    ipcMain.failOnChannel = UNIFIED_LIBRARY_IPC_CHANNELS[8];

    expect(() => registerProcessWideIpc(ipcMain)).toThrow(`failed:${UNIFIED_LIBRARY_IPC_CHANNELS[8]}`);
    expect(ipcMain.removals).toEqual(ipcMain.registrations.slice().reverse());
    expect(ipcMain.handlers.size).toBe(0);
    expect(ipcMain.listeners.size).toBe(0);
  });

  it('executes all 118 domain registrations in the documented baseline order and tears them down exactly', () => {
    const ipcMain = new CapturingIpcMain();
    const collected = collectedDomainHandlers();
    const dispose = registerMainProcessDomainIpc({ ipcMain, ...collected });

    expect(ipcMain.registrations).toEqual(MAIN_PROCESS_DOMAIN_IPC_ORDER.map((channel) => (
      collected.listeners.has(channel) ? `on:${channel}` : `handle:${channel}`
    )));
    expect(ipcMain.handlers.size).toBe(115);
    expect(ipcMain.listeners.size).toBe(3);

    dispose();
    dispose();
    expect(ipcMain.removals).toEqual(ipcMain.registrations.slice().reverse());
    expect(ipcMain.handlers.size).toBe(0);
    expect(ipcMain.listeners.size).toBe(0);
  });

  it('rolls the process-wide domain transaction back in reverse order on partial failure', () => {
    const ipcMain = new CapturingIpcMain();
    const collected = collectedDomainHandlers();
    ipcMain.failOnChannel = 'blue-live:toggle';

    expect(() => registerMainProcessDomainIpc({ ipcMain, ...collected }))
      .toThrow('failed:blue-live:toggle');
    expect(ipcMain.removals).toEqual(ipcMain.registrations.slice().reverse());
    expect(ipcMain.handlers.size).toBe(0);
    expect(ipcMain.listeners.size).toBe(0);
  });

  it('captures the current 183 inbound endpoint surface and registration modes', async () => {
    const directMain = await registrations('main.ts', 'ipcMain');
    const collected = await registrations('main.ts', 'ipcRegistration');
    const unified = await registrations('unified-library/ipc.ts', 'scope');
    const code = await registrations('code-repository/ipc.ts', 'scope');
    const workbench = await registrations('workbench-window-host.ts', 'scope');
    const midi = await registrations('midi-input-coordinator.ts', 'scope');

    const collectedInvoke = collected.filter((entry) => entry.mode === 'handle');
    const collectedListeners = collected.filter((entry) => entry.mode === 'on');
    const collectedExpandedCount = collectedInvoke.reduce(
      (count, entry) => count + (entry.channelExpression === 'channel' ? 3 : 1),
      0,
    ) + collectedListeners.length;
    const existing = [...unified, ...code, ...workbench, ...midi];
    const domainChannels = [
      ...PROJECT_LIFECYCLE_IPC_CHANNELS,
      ...PROJECT_ARTIFACTS_IPC_CHANNELS,
      ...PLAYBACK_RUNTIME_IPC_CHANNELS,
      ...PROJECT_DOCUMENT_IPC_CHANNELS,
      ...APPLICATION_IPC_CHANNELS,
    ];

    expect(directMain).toHaveLength(0);
    expect(collected).toHaveLength(116);
    expect(collectedInvoke).toHaveLength(113);
    expect(collectedListeners).toHaveLength(3);
    expect(collectedExpandedCount).toBe(118);
    expect(domainChannels).toHaveLength(118);
    expect(new Set(domainChannels).size).toBe(118);
    expect(unified).toHaveLength(44);
    expect(code).toHaveLength(11);
    expect(workbench).toHaveLength(5);
    expect(midi).toHaveLength(5);
    expect(existing).toHaveLength(65);
    expect(domainChannels.length + existing.length).toBe(183);
  });

  it('keeps registration expressions unique by mode and records listener identity sites', async () => {
    const sources = await Promise.all([
      registrations('main.ts', 'ipcRegistration'),
      registrations('unified-library/ipc.ts', 'scope'),
      registrations('code-repository/ipc.ts', 'scope'),
      registrations('workbench-window-host.ts', 'scope'),
      registrations('midi-input-coordinator.ts', 'scope'),
    ]);
    const records = sources.flat();
    const keys = records.map((entry) => `${entry.mode}:${entry.channelExpression}`);

    // The one score-object loop is the only intentionally repeated/dynamic
    // source expression; its three concrete channels are counted explicitly
    // by the first oracle.
    expect(new Set(keys).size).toBe(keys.length);
    expect(records.filter((entry) => entry.mode === 'on')).toHaveLength(6);
    expect(records.filter((entry) => entry.mode === 'on').every((entry) => entry.source.includes('('))).toBe(true);
  });

  it('keeps the direct main-process registrations in the pre-ready source region', async () => {
    const source = await readFile(path.join(__dirname, '..', 'main.ts'), 'utf8');
    const firstWhenReady = source.indexOf('const applicationReadyPromise');
    expect(firstWhenReady).toBeGreaterThan(0);
    expect([...source.matchAll(/ipcMain\.(handle|on)\(/g)]).toHaveLength(0);
    expect([...source.matchAll(/ipcRegistration\.(handle|on)\(/g)].every((match) => match.index! < firstWhenReady)).toBe(true);
    expect(source).not.toContain('ipcMain.removeAllListeners');
  });
});
