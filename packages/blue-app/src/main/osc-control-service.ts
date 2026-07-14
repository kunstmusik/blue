import { createSocket, type Socket } from 'node:dgram';
import { decode } from 'node-osc';
import {
  createInitialOscServerRuntimeSnapshot,
  findOscCommand,
  type OscCommandEvent,
  type OscRuntimeDiagnostic,
  type OscServerPhase,
  type OscServerPreferences,
  type OscServerRuntimeSnapshot,
} from '../shared/osc-control';

interface DecodedOscMessage {
  oscType: 'message';
  address: string;
  args?: unknown[];
}

interface DecodedOscBundle {
  oscType: 'bundle';
  timetag?: unknown;
  elements: unknown[];
}

type DecodedOscPacket = DecodedOscMessage | DecodedOscBundle;

export interface OscControlServiceDeps {
  socketFactory?: () => Socket;
  decoder?: (packet: Buffer) => unknown;
  onSnapshot?: (snapshot: OscServerRuntimeSnapshot) => void;
  onCommand?: (event: OscCommandEvent) => void;
  now?: () => Date;
}

type BindResult =
  | { kind: 'bound'; socket: Socket }
  | { kind: 'failed'; diagnostic: OscRuntimeDiagnostic }
  | { kind: 'stale' };

/**
 * Owns the single inbound UDP OSC socket. The service is deliberately unaware
 * of BrowserWindow, project state, and engines; callers provide serializable
 * snapshot and command sinks at the application boundary.
 */
export class OscControlService {
  private readonly socketFactory: () => Socket;
  private readonly decoder: (packet: Buffer) => unknown;
  private readonly now: () => Date;
  private readonly onSnapshot?: (snapshot: OscServerRuntimeSnapshot) => void;
  private readonly onCommand?: (event: OscCommandEvent) => void;
  private socket: Socket | null = null;
  private lifecycleQueue: Promise<void> = Promise.resolve();
  private generation = 0;
  private commandSequence = 0;
  private shuttingDown = false;
  private snapshot: OscServerRuntimeSnapshot;

  constructor(
    preferences: OscServerPreferences,
    deps: OscControlServiceDeps = {},
  ) {
    this.socketFactory = deps.socketFactory ?? (() => createSocket('udp4'));
    this.decoder = deps.decoder ?? decode;
    this.now = deps.now ?? (() => new Date());
    this.onSnapshot = deps.onSnapshot;
    this.onCommand = deps.onCommand;
    this.snapshot = createInitialOscServerRuntimeSnapshot(preferences);
  }

  getSnapshot(): OscServerRuntimeSnapshot {
    return this.snapshot;
  }

  start(preferences: OscServerPreferences): Promise<void> {
    return this.enqueue(() => this.startInternal(preferences, 'starting'));
  }

  restart(preferences: OscServerPreferences): Promise<void> {
    return this.enqueue(() => this.startInternal(preferences, 'restarting'));
  }

  /**
   * Prevent packet execution immediately, then close the current socket in
   * lifecycle order. It is safe to call repeatedly during Electron shutdown.
   */
  shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.generation++;
    return this.enqueue(async () => {
      await this.closeCurrentSocket();
      this.publish({
        phase: 'stopped',
        activePort: null,
        fallbackFrom: null,
      });
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.lifecycleQueue.then(operation, operation);
    this.lifecycleQueue = next.catch(() => undefined);
    return next;
  }

  private async startInternal(
    preferences: OscServerPreferences,
    phase: Extract<OscServerPhase, 'starting' | 'restarting'>,
  ): Promise<void> {
    if (this.shuttingDown) return;

    const generation = ++this.generation;
    this.publish({
      phase,
      preferredPort: preferences.preferredPort,
      activePort: null,
      fallbackFrom: null,
      lastBindError: null,
    });

    await this.closeCurrentSocket();
    if (this.shuttingDown || generation !== this.generation) return;

    for (let candidate = preferences.preferredPort; candidate <= 65535; candidate++) {
      const result = await this.bindCandidate(candidate, generation);
      if (result.kind === 'stale') return;

      if (result.kind === 'bound') {
        if (this.shuttingDown || generation !== this.generation) {
          await this.closeSocket(result.socket);
          return;
        }

        this.socket = result.socket;
        this.attachRuntimeHandlers(result.socket, generation);
        this.publish({
          phase: 'listening',
          preferredPort: preferences.preferredPort,
          activePort: candidate,
          fallbackFrom: candidate === preferences.preferredPort ? null : preferences.preferredPort,
          lastBindError: null,
        });
        return;
      }

      if (result.diagnostic.code !== 'EADDRINUSE') {
        this.publish({
          phase: 'error',
          preferredPort: preferences.preferredPort,
          activePort: null,
          fallbackFrom: null,
          lastBindError: result.diagnostic,
        });
        return;
      }

      if (candidate === 65535) {
        this.publish({
          phase: 'error',
          preferredPort: preferences.preferredPort,
          activePort: null,
          fallbackFrom: null,
          lastBindError: {
            code: 'EADDRINUSE',
            port: candidate,
            message: 'No available UDP port from the preferred port through 65535.',
          },
        });
        return;
      }
    }
  }

  private bindCandidate(port: number, generation: number): Promise<BindResult> {
    const socket = this.socketFactory();
    return new Promise<BindResult>((resolve) => {
      let settled = false;
      const finish = (result: BindResult): void => {
        if (settled) return;
        settled = true;
        socket.removeListener('error', onError);
        socket.removeListener('listening', onListening);
        resolve(result);
      };
      const onError = (error: NodeJS.ErrnoException): void => {
        void this.closeSocket(socket).finally(() => {
          finish({ kind: 'failed', diagnostic: this.toDiagnostic(error, port) });
        });
      };
      const onListening = (): void => {
        if (this.shuttingDown || generation !== this.generation) {
          void this.closeSocket(socket).finally(() => finish({ kind: 'stale' }));
          return;
        }
        finish({ kind: 'bound', socket });
      };

      socket.once('error', onError);
      socket.once('listening', onListening);
      try {
        socket.bind({ address: '0.0.0.0', port });
      } catch (error: unknown) {
        onError(error as NodeJS.ErrnoException);
      }
    });
  }

  private attachRuntimeHandlers(socket: Socket, generation: number): void {
    socket.on('message', (packet) => {
      if (this.shuttingDown || generation !== this.generation || socket !== this.socket) return;
      this.handlePacket(packet);
    });
    socket.on('error', (error: NodeJS.ErrnoException) => {
      if (this.shuttingDown || generation !== this.generation || socket !== this.socket) return;
      this.socket = null;
      this.publish({
        phase: 'error',
        activePort: null,
        fallbackFrom: null,
        lastBindError: this.toDiagnostic(error, this.snapshot.activePort),
      });
      void this.closeSocket(socket);
    });
  }

  private handlePacket(packet: Buffer): void {
    try {
      this.dispatchDecoded(this.decoder(packet));
    } catch (error: unknown) {
      this.publish({
        lastPacketError: this.toDiagnostic(error, null, 'OSC_DECODE_ERROR'),
      });
    }
  }

  private dispatchDecoded(packet: unknown): void {
    if (!packet || typeof packet !== 'object') {
      throw new Error('OSC decoder returned an invalid packet.');
    }
    const decoded = packet as Partial<DecodedOscPacket>;
    if (decoded.oscType === 'message') {
      if (typeof decoded.address !== 'string') {
        throw new Error('OSC message is missing an address.');
      }
      const command = findOscCommand(decoded.address);
      if (!command || this.shuttingDown) return;
      try {
        this.onCommand?.({
          sequence: ++this.commandSequence,
          commandId: command.id,
          receivedAddress: decoded.address,
          receivedAt: this.now().toISOString(),
        });
      } catch (error: unknown) {
        this.publish({
          lastPacketError: this.toDiagnostic(error, null, 'OSC_COMMAND_DISPATCH_ERROR'),
        });
      }
      return;
    }
    if (decoded.oscType === 'bundle') {
      if (!Array.isArray(decoded.elements)) {
        throw new Error('OSC bundle is missing elements.');
      }
      // Java Blue ignores bundle timetags and recursively walks in packet order.
      for (const element of decoded.elements) {
        this.dispatchDecoded(element);
      }
      return;
    }
    throw new Error('Unsupported OSC packet type.');
  }

  private async closeCurrentSocket(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      await this.closeSocket(socket);
    }
  }

  private closeSocket(socket: Socket): Promise<void> {
    return new Promise((resolve) => {
      try {
        socket.close(() => resolve());
      } catch {
        // dgram throws when a failed bind has already closed the socket.
        resolve();
      }
    });
  }

  private publish(update: Partial<Omit<OscServerRuntimeSnapshot, 'revision' | 'updatedAt'>>): void {
    this.snapshot = {
      ...this.snapshot,
      ...update,
      revision: this.snapshot.revision + 1,
      updatedAt: this.now().toISOString(),
    };
    this.onSnapshot?.(this.snapshot);
  }

  private toDiagnostic(
    error: unknown,
    port: number | null,
    fallbackCode: string | null = null,
  ): OscRuntimeDiagnostic {
    const value = error as Partial<NodeJS.ErrnoException>;
    return {
      code: typeof value?.code === 'string' ? value.code : fallbackCode,
      message: error instanceof Error ? error.message : String(error),
      port,
    };
  }
}
