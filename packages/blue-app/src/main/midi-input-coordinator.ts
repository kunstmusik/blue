/**
 * Main-process coordinator for MIDI input device service (SPEC 058).
 *
 * Responsibilities:
 *   - Track the primary application renderer's webContents.
 *   - Cache the latest serializable service snapshot.
 *   - Forward reconcile/rescan/shutdown commands from observer windows
 *     (Settings) to the primary renderer.
 *   - Broadcast snapshot updates to all application-owned observer windows.
 *
 * Raw Web MIDI objects never enter main; only structured-clone-safe payloads
 * cross IPC.
 */

import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import {
  MIDI_INPUT_COMMAND_ACK_CHANNEL,
  MIDI_INPUT_GET_SNAPSHOT_CHANNEL,
  MIDI_INPUT_INITIALIZE_CHANNEL,
  MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL,
  MIDI_INPUT_REQUEST_RESCAN_CHANNEL,
  MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
  MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL,
  normalizeMidiInputPreferences,
  type MidiInputCommandAck,
  type MidiInputPreferences,
  type MidiInputServiceCommand,
  type MidiInputServiceInitialization,
  type MidiInputServiceSnapshot,
} from '../shared/midi-input';
import type { ProgramSettingsSnapshot } from '../shared/program-settings';
import { registerIpcTransaction, type IpcMainLike } from './ipc/ipc-registration';

export const MIDI_INPUT_IPC_CHANNELS = [
  MIDI_INPUT_INITIALIZE_CHANNEL,
  MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL,
  MIDI_INPUT_COMMAND_ACK_CHANNEL,
  MIDI_INPUT_GET_SNAPSHOT_CHANNEL,
  MIDI_INPUT_REQUEST_RESCAN_CHANNEL,
] as const;

export interface MidiInputCoordinatorDeps {
  /** Registration target; defaults to Electron's process-wide ipcMain. */
  ipcMain?: IpcMainLike;
  /** Returns the current program settings snapshot (for midiInput preferences). */
  getProgramSettings: () => ProgramSettingsSnapshot;
  /** Returns true if the webContents belongs to the primary application window. */
  isPrimaryWebContents: (contents: WebContents) => boolean;
  /** Returns true if the webContents belongs to any application-owned window. */
  isApplicationWebContents: (contents: WebContents) => boolean;
}

export class MidiInputCoordinator {
  private primaryContents: WebContents | null = null;
  private cachedSnapshot: MidiInputServiceSnapshot | null = null;
  private pendingRescanId: string | null = null;
  private pendingReconcile: MidiInputServiceCommand | null = null;
  private pendingShutdown: {
    commandId: string;
    finish: () => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private shutdownPromise: Promise<void> | null = null;
  private initialized = false;
  private unregisterIpc: (() => void) | null = null;

  constructor(private deps: MidiInputCoordinatorDeps) {}

  /** Wires the IPC handlers and fails before side effects on duplicate calls. */
  registerIpcHandlers(): void {
    if (this.initialized) {
      throw new Error('MIDI input IPC is already initialized.');
    }

    const unregister = registerIpcTransaction(
      this.deps.ipcMain ?? ipcMain,
      'midi-input',
      (scope) => {
        scope.handle(
          MIDI_INPUT_INITIALIZE_CHANNEL,
          async (event): Promise<MidiInputServiceInitialization | null> => {
            if (!this.deps.isPrimaryWebContents(event.sender)) {
              return null;
            }
            this.primaryContents = event.sender;
            event.sender.once('destroyed', () => {
              if (this.primaryContents === event.sender) {
                this.primaryContents = null;
                this.finishPendingShutdown();
              }
            });
            return {
              preferences: this.deps.getProgramSettings().midiInput,
              cachedSnapshot: this.cachedSnapshot,
            };
          },
        );

        scope.on(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL, (event, snapshot: unknown) => {
          if (!this.deps.isPrimaryWebContents(event.sender)) return;
          if (!isValidSnapshot(snapshot)) return;
          this.handleReportSnapshot(snapshot);
        });

        scope.on(MIDI_INPUT_COMMAND_ACK_CHANNEL, (event, ack: unknown) => {
          if (!this.deps.isPrimaryWebContents(event.sender)) return;
          if (!isValidAck(ack)) return;
          this.handleAck(ack);
        });

        scope.handle(
          MIDI_INPUT_GET_SNAPSHOT_CHANNEL,
          async (event): Promise<MidiInputServiceSnapshot | null> => {
            if (!this.deps.isApplicationWebContents(event.sender)) return null;
            return this.cachedSnapshot;
          },
        );

        scope.handle(
          MIDI_INPUT_REQUEST_RESCAN_CHANNEL,
          async (event): Promise<{ accepted: boolean; message?: string }> => {
            if (!this.deps.isApplicationWebContents(event.sender)) {
              return { accepted: false, message: 'Not permitted' };
            }
            return this.requestRescan();
          },
        );
      },
    );
    this.unregisterIpc = unregister;
    this.initialized = true;
  }

  disposeIpcHandlers(): void {
    this.unregisterIpc?.();
    this.unregisterIpc = null;
    this.initialized = false;
  }

  /**
   * Called by main when program settings are successfully saved. Computes the
   * new MIDI preferences and forwards a reconcile command to the primary
   * renderer (or queues it for delivery once the primary is ready).
   */
  onProgramSettingsSaved(snapshot: ProgramSettingsSnapshot): void {
    const preferences = normalizeMidiInputPreferences(snapshot.midiInput);
    const commandId = makeCommandId('reconcile');
    const command: MidiInputServiceCommand = {
      type: 'reconcile',
      commandId,
      preferences,
    };
    this.dispatchOrQueueCommand(command);
  }

  /**
   * Replaces the cached snapshot when instanceId changes; otherwise accepts
   * only an increasing revision. Broadcasts to observer windows on accept.
   */
  private handleReportSnapshot(snapshot: MidiInputServiceSnapshot): void {
    const current = this.cachedSnapshot;
    if (!current || current.instanceId !== snapshot.instanceId) {
      this.cachedSnapshot = snapshot;
    } else if (snapshot.revision > current.revision) {
      this.cachedSnapshot = snapshot;
    } else {
      return;
    }
    this.broadcastSnapshot();
    // If a pending command was queued waiting for the primary to recover, flush
    // it now that we have a fresh snapshot.
    this.flushPendingCommandsIfPrimaryReady();
  }

  private handleAck(ack: MidiInputCommandAck): void {
    if (this.pendingRescanId === ack.commandId) {
      this.pendingRescanId = null;
    }
    if (this.pendingShutdown?.commandId === ack.commandId) {
      this.pendingShutdown.finish();
    }
  }

  /**
   * Ask the primary renderer to release held notes and close its Web MIDI
   * ports before Electron destroys the renderer. The bounded timeout keeps app
   * shutdown moving if the renderer has already become unresponsive.
   */
  requestShutdown(timeoutMs = 750): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    const contents = this.primaryContents;
    if (!contents || contents.isDestroyed()) return Promise.resolve();

    const commandId = makeCommandId('shutdown');
    const command: MidiInputServiceCommand = { type: 'shutdown', commandId };
    this.shutdownPromise = new Promise<void>((resolve) => {
      let finished = false;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        if (this.pendingShutdown?.commandId === commandId) {
          clearTimeout(this.pendingShutdown.timer);
          this.pendingShutdown = null;
        }
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.pendingShutdown = { commandId, finish, timer };
      contents.send(MIDI_INPUT_SERVICE_COMMAND_CHANNEL, command);
    }).finally(() => {
      this.shutdownPromise = null;
    });
    return this.shutdownPromise;
  }

  /**
   * Sends a rescan command to the primary renderer. Coalesces repeated rescan
   * requests while one is already in flight.
   */
  requestRescan(): { accepted: boolean; message?: string } {
    if (this.pendingRescanId) {
      return { accepted: true, message: 'already-in-flight' };
    }
    const commandId = makeCommandId('rescan');
    const command: MidiInputServiceCommand = { type: 'rescan', commandId };
    this.pendingRescanId = commandId;
    this.dispatchOrQueueCommand(command);
    return { accepted: true };
  }

  private dispatchOrQueueCommand(command: MidiInputServiceCommand): void {
    const contents = this.primaryContents;
    if (contents && !contents.isDestroyed()) {
      contents.send(MIDI_INPUT_SERVICE_COMMAND_CHANNEL, command);
      return;
    }
    // Queue only the most recent reconcile; only one pending rescan.
    if (command.type === 'rescan') {
      this.pendingRescanId = command.commandId;
    } else if (command.type === 'reconcile') {
      this.pendingReconcile = command;
    }
    // shutdown is best-effort; never queued.
  }

  private flushPendingCommandsIfPrimaryReady(): void {
    const contents = this.primaryContents;
    if (!contents || contents.isDestroyed()) return;

    if (this.pendingReconcile) {
      contents.send(MIDI_INPUT_SERVICE_COMMAND_CHANNEL, this.pendingReconcile);
      this.pendingReconcile = null;
    }
    if (this.pendingRescanId) {
      contents.send(MIDI_INPUT_SERVICE_COMMAND_CHANNEL, {
        type: 'rescan',
        commandId: this.pendingRescanId,
      });
      // Don't clear pendingRescan here; await its ack.
    }
  }

  private broadcastSnapshot(): void {
    if (!this.cachedSnapshot) return;
    const payload = this.cachedSnapshot;
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue;
      const contents = window.webContents;
      if (contents.isDestroyed()) continue;
      if (!this.deps.isApplicationWebContents(contents)) continue;
      contents.send(MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL, payload);
    }
  }

  /** Test/diagnostic accessor for the current cached snapshot. */
  getCachedSnapshot(): MidiInputServiceSnapshot | null {
    return this.cachedSnapshot;
  }

  /** Test/diagnostic accessor; clears internal state. */
  resetForTesting(): void {
    this.disposeIpcHandlers();
    this.finishPendingShutdown();
    this.cachedSnapshot = null;
    this.primaryContents = null;
    this.pendingRescanId = null;
    this.pendingReconcile = null;
  }

  private finishPendingShutdown(): void {
    this.pendingShutdown?.finish();
  }
}

function isValidSnapshot(value: unknown): value is MidiInputServiceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.instanceId === 'string' &&
    typeof v.revision === 'number' &&
    typeof v.phase === 'string' &&
    Array.isArray(v.devices) &&
    typeof v.updatedAt === 'number'
  );
}

function isValidAck(value: unknown): value is MidiInputCommandAck {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.commandId === 'string' && typeof v.accepted === 'boolean';
}

function makeCommandId(prefix: string): string {
  return `${prefix}-${process.hrtime.bigint().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
