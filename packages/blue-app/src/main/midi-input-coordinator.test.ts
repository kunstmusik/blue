import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const webContentsSend = vi.fn();
const mockWindows: Array<{
  isDestroyed: () => boolean;
  webContents: { send: typeof webContentsSend; isDestroyed: () => boolean };
}> = [];

const ipcHandle = vi.fn();
const ipcOn = vi.fn();
const ipcRemoveHandler = vi.fn();
const ipcRemoveListener = vi.fn();
const ipcRemoveAllListeners = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mockWindows,
  },
  ipcMain: {
    handle: (...args: unknown[]) => ipcHandle(...args),
    on: (...args: unknown[]) => ipcOn(...args),
    removeHandler: (...args: unknown[]) => ipcRemoveHandler(...args),
    removeListener: (...args: unknown[]) => ipcRemoveListener(...args),
    removeAllListeners: (...args: unknown[]) => ipcRemoveAllListeners(...args),
  },
}));

import { MidiInputCoordinator } from './midi-input-coordinator';
import {
  MIDI_INPUT_COMMAND_ACK_CHANNEL,
  MIDI_INPUT_GET_SNAPSHOT_CHANNEL,
  MIDI_INPUT_INITIALIZE_CHANNEL,
  MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL,
  MIDI_INPUT_REQUEST_RESCAN_CHANNEL,
  MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
  MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL,
  type MidiInputCommandAck,
  type MidiInputServiceCommand,
  type MidiInputServiceSnapshot,
} from '../shared/midi-input';
import { createDefaultProgramSettings } from '../shared/program-settings';

interface FakeWebContents {
  id: number;
  send: typeof webContentsSend;
  isDestroyed(): boolean;
  once(): void;
}

function makeWebContents(id: number): FakeWebContents {
  return { id, send: webContentsSend, isDestroyed: () => false, once: () => {} };
}

function makeSnapshot(overrides: Partial<MidiInputServiceSnapshot> = {}): MidiInputServiceSnapshot {
  return {
    instanceId: 'inst-1',
    revision: 1,
    phase: 'ready',
    devices: [],
    message: null,
    updatedAt: 1,
    ...overrides,
  };
}

let primaryContents: FakeWebContents;
let settingsContents: FakeWebContents;
let coordinator: MidiInputCoordinator;
let ipcHandlers = new Map<
  string,
  (event: { sender: FakeWebContents }, ...args: unknown[]) => unknown
>();
let ipcListeners = new Map<
  string,
  (event: { sender: FakeWebContents }, ...args: unknown[]) => void
>();

beforeEach(() => {
  webContentsSend.mockClear();
  mockWindows.length = 0;
  ipcHandlers.clear();
  ipcListeners.clear();

  ipcHandle.mockImplementation(
    (
      channel: string,
      handler: (event: { sender: FakeWebContents }, ...args: unknown[]) => unknown,
    ) => {
      ipcHandlers.set(channel, handler);
    },
  );
  ipcOn.mockImplementation(
    (
      channel: string,
      handler: (event: { sender: FakeWebContents }, ...args: unknown[]) => void,
    ) => {
      ipcListeners.set(channel, handler);
    },
  );

  primaryContents = makeWebContents(1);
  settingsContents = makeWebContents(2);

  coordinator = new MidiInputCoordinator({
    getProgramSettings: () => createDefaultProgramSettings('darwin'),
    isPrimaryWebContents: (c) => (c as unknown as FakeWebContents).id === primaryContents.id,
    isApplicationWebContents: () => true,
  });
});

afterEach(() => {
  coordinator?.resetForTesting();
  ipcHandle.mockReset();
  ipcOn.mockReset();
  ipcRemoveHandler.mockReset();
  ipcRemoveListener.mockReset();
  ipcRemoveAllListeners.mockReset();
});

describe('MidiInputCoordinator', () => {
  it('registers exactly one set of IPC handlers', () => {
    coordinator.registerIpcHandlers();
    expect(() => coordinator.registerIpcHandlers()).toThrow('already initialized');
    expect(ipcHandlers.has(MIDI_INPUT_INITIALIZE_CHANNEL)).toBe(true);
    expect(ipcHandlers.has(MIDI_INPUT_GET_SNAPSHOT_CHANNEL)).toBe(true);
    expect(ipcHandlers.has(MIDI_INPUT_REQUEST_RESCAN_CHANNEL)).toBe(true);
    expect(ipcListeners.has(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL)).toBe(true);
    expect(ipcListeners.has(MIDI_INPUT_COMMAND_ACK_CHANNEL)).toBe(true);
  });

  it('initializes only when the primary renderer requests', async () => {
    coordinator.registerIpcHandlers();
    const init = ipcHandlers.get(MIDI_INPUT_INITIALIZE_CHANNEL)!;
    const resultForSettings = await init({ sender: settingsContents });
    expect(resultForSettings).toBeNull();

    const result = (await init({ sender: primaryContents })) as {
      preferences: { devices: unknown[] };
    };
    expect(result.preferences.devices).toEqual([]);
  });

  it('accepts only newer revisions from the same instance and broadcasts', () => {
    coordinator.registerIpcHandlers();
    const report = ipcListeners.get(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL)!;

    mockWindows.push({
      isDestroyed: () => false,
      webContents: { send: webContentsSend, isDestroyed: () => false },
    });

    report({ sender: primaryContents }, makeSnapshot({ instanceId: 'a', revision: 5 }));
    expect(coordinator.getCachedSnapshot()?.revision).toBe(5);

    webContentsSend.mockClear();
    report({ sender: primaryContents }, makeSnapshot({ instanceId: 'a', revision: 3 }));
    expect(coordinator.getCachedSnapshot()?.revision).toBe(5);
    expect(webContentsSend).not.toHaveBeenCalled();

    webContentsSend.mockClear();
    report({ sender: primaryContents }, makeSnapshot({ instanceId: 'b', revision: 1 }));
    expect(coordinator.getCachedSnapshot()?.instanceId).toBe('b');
    expect(webContentsSend).toHaveBeenCalled();
    const [channel, payload] = webContentsSend.mock.calls[0];
    expect(channel).toBe(MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL);
    expect((payload as MidiInputServiceSnapshot).instanceId).toBe('b');
  });

  it('ignores reports and acks from non-primary senders', () => {
    coordinator.registerIpcHandlers();
    const report = ipcListeners.get(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL)!;
    report({ sender: settingsContents }, makeSnapshot());
    expect(coordinator.getCachedSnapshot()).toBeNull();
  });

  it('forwards reconcile commands to the primary renderer when ready', () => {
    coordinator.registerIpcHandlers();
    const init = ipcHandlers.get(MIDI_INPUT_INITIALIZE_CHANNEL)!;
    void init({ sender: primaryContents });
    const report = ipcListeners.get(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL)!;
    report({ sender: primaryContents }, makeSnapshot());

    webContentsSend.mockClear();
    coordinator.onProgramSettingsSaved({
      ...createDefaultProgramSettings('darwin'),
      midiInput: {
        devices: [{ id: 'd', name: 'D', manufacturer: '', version: '', enabled: true }],
      },
    });

    const reconcileCall = webContentsSend.mock.calls.find(
      ([channel]) => channel === MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
    );
    expect(reconcileCall).toBeTruthy();
    const [, command] = reconcileCall!;
    expect((command as MidiInputServiceCommand).type).toBe('reconcile');
    expect(
      (command as MidiInputServiceCommand & { preferences: { devices: { id: string }[] } })
        .preferences.devices[0]?.id,
    ).toBe('d');
  });

  it('queues rescan and coalesces repeated rescan requests', async () => {
    coordinator.registerIpcHandlers();
    const init = ipcHandlers.get(MIDI_INPUT_INITIALIZE_CHANNEL)!;
    await init({ sender: primaryContents });
    const report = ipcListeners.get(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL)!;
    report({ sender: primaryContents }, makeSnapshot());

    webContentsSend.mockClear();
    const first = coordinator.requestRescan();
    const second = coordinator.requestRescan();
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(second.message).toBe('already-in-flight');

    const rescanCalls = webContentsSend.mock.calls.filter(
      ([channel]) => channel === MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
    );
    expect(rescanCalls).toHaveLength(1);
    expect((rescanCalls[0][1] as MidiInputServiceCommand).type).toBe('rescan');

    const ack = ipcListeners.get(MIDI_INPUT_COMMAND_ACK_CHANNEL)!;
    const rescanCommand = rescanCalls[0][1] as MidiInputServiceCommand & { commandId: string };
    ack({ sender: primaryContents }, {
      commandId: rescanCommand.commandId,
      accepted: true,
    } satisfies MidiInputCommandAck);

    webContentsSend.mockClear();
    const third = coordinator.requestRescan();
    expect(third.accepted).toBe(true);
    expect(third.message).toBeUndefined();
    const moreRescans = webContentsSend.mock.calls.filter(
      ([channel]) => channel === MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
    );
    expect(moreRescans).toHaveLength(1);
  });

  it('allows a new rescan after a rejected command is acknowledged', async () => {
    coordinator.registerIpcHandlers();
    const init = ipcHandlers.get(MIDI_INPUT_INITIALIZE_CHANNEL)!;
    await init({ sender: primaryContents });

    coordinator.requestRescan();
    const command = webContentsSend.mock.calls.find(
      ([channel]) => channel === MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
    )?.[1] as MidiInputServiceCommand;
    const ack = ipcListeners.get(MIDI_INPUT_COMMAND_ACK_CHANNEL)!;
    ack({ sender: primaryContents }, {
      commandId: command.commandId,
      accepted: false,
      message: 'rescan failed',
    } satisfies MidiInputCommandAck);

    expect(coordinator.requestRescan().message).toBeUndefined();
  });

  it('waits for the primary renderer to acknowledge graceful shutdown', async () => {
    coordinator.registerIpcHandlers();
    const init = ipcHandlers.get(MIDI_INPUT_INITIALIZE_CHANNEL)!;
    await init({ sender: primaryContents });

    let completed = false;
    const shutdown = coordinator.requestShutdown().then(() => {
      completed = true;
    });
    const command = webContentsSend.mock.calls.find(
      ([channel, payload]) =>
        channel === MIDI_INPUT_SERVICE_COMMAND_CHANNEL &&
        (payload as MidiInputServiceCommand).type === 'shutdown',
    )?.[1] as MidiInputServiceCommand;
    expect(command.type).toBe('shutdown');
    await Promise.resolve();
    expect(completed).toBe(false);

    const ack = ipcListeners.get(MIDI_INPUT_COMMAND_ACK_CHANNEL)!;
    ack({ sender: primaryContents }, {
      commandId: command.commandId,
      accepted: true,
    } satisfies MidiInputCommandAck);
    await shutdown;
    expect(completed).toBe(true);
  });

  it('get-snapshot returns cached snapshot for any app renderer', async () => {
    coordinator.registerIpcHandlers();
    const report = ipcListeners.get(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL)!;
    report({ sender: primaryContents }, makeSnapshot({ revision: 7 }));

    const get = ipcHandlers.get(MIDI_INPUT_GET_SNAPSHOT_CHANNEL)!;
    const result = (await get({ sender: settingsContents })) as MidiInputServiceSnapshot | null;
    expect(result?.revision).toBe(7);
  });

  it('rescan is rejected when the sender is not any application-owned BrowserWindow', async () => {
    // `isApplicationWebContents` should reject ad-hoc contents that aren't
    // backed by a real BrowserWindow (e.g., a synthetic BrowserView used by
    // a hypothetical browser-plugin context). All real BrowserWindows in the
    // app are trusted observers.
    const rejectCoordinator = new MidiInputCoordinator({
      getProgramSettings: () => createDefaultProgramSettings('darwin'),
      isPrimaryWebContents: (c) => (c as unknown as FakeWebContents).id === primaryContents.id,
      isApplicationWebContents: () => false,
    });
    rejectCoordinator.registerIpcHandlers();
    const rescanHandler = ipcHandlers.get(MIDI_INPUT_REQUEST_RESCAN_CHANNEL)!;
    const result = (await rescanHandler({ sender: settingsContents })) as { accepted: boolean };
    expect(result.accepted).toBe(false);
    rejectCoordinator.disposeIpcHandlers();
  });
});
