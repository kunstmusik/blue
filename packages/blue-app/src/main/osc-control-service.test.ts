import { EventEmitter } from 'node:events';
import type { Socket } from 'node:dgram';
import { afterEach, describe, expect, it } from 'vitest';
import { Bundle, Message, encode } from 'node-osc';
import { OscControlService } from './osc-control-service';
import type { OscCommandEvent } from '../shared/osc-control';

/**
 * dgram's real bind is intentionally not used here: the full workspace suite
 * runs test files concurrently and its isolated worker sandbox may deny UDP
 * binds. This fake models the dgram bind/error/listening/close contract so
 * retry, packet ordering, and release behavior stay deterministic.
 */
class FakeSocketRegistry {
  readonly bound = new Map<number, FakeSocket>();
  readonly created: FakeSocket[] = [];

  create(errorCode: string | null = null): Socket {
    const socket = new FakeSocket(this, errorCode);
    this.created.push(socket);
    return socket as unknown as Socket;
  }

  hold(port: number): void {
    this.bound.set(port, new FakeSocket(this, null));
  }
}

class FakeSocket extends EventEmitter {
  private boundPort: number | null = null;

  constructor(
    private readonly registry: FakeSocketRegistry,
    private readonly errorCode: string | null,
  ) {
    super();
  }

  bind(options: { port: number }): void {
    queueMicrotask(() => {
      const code = this.errorCode ?? (this.registry.bound.has(options.port) ? 'EADDRINUSE' : null);
      if (code) {
        this.emit('error', Object.assign(new Error(`bind failed: ${code}`), { code }));
        return;
      }
      this.boundPort = options.port;
      this.registry.bound.set(options.port, this);
      this.emit('listening');
    });
  }

  close(callback?: () => void): this {
    if (this.boundPort !== null && this.registry.bound.get(this.boundPort) === this) {
      this.registry.bound.delete(this.boundPort);
    }
    this.boundPort = null;
    callback?.();
    return this;
  }
}

const services: OscControlService[] = [];

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.shutdown()));
});

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for OSC event');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function createService(
  registry: FakeSocketRegistry,
  preferredPort: number,
  events: OscCommandEvent[] = [],
): OscControlService {
  const service = new OscControlService(
    { preferredPort },
    {
      socketFactory: () => registry.create(),
      onCommand: (event) => events.push(event),
    },
  );
  services.push(service);
  return service;
}

function activeSocket(registry: FakeSocketRegistry, port: number): FakeSocket {
  const socket = registry.bound.get(port);
  if (!socket) throw new Error(`No socket bound at ${port}`);
  return socket;
}

describe('OscControlService', () => {
  it('binds the preferred port and dispatches recognized prefix messages while ignoring arguments', async () => {
    const events: OscCommandEvent[] = [];
    const registry = new FakeSocketRegistry();
    const service = createService(registry, 8123, events);

    await service.start({ preferredPort: 8123 });
    expect(service.getSnapshot()).toMatchObject({ phase: 'listening', activePort: 8123 });

    activeSocket(registry, 8123).emit(
      'message',
      encode(new Message('/score/play/alternate', 1, 'ignored')),
    );
    await waitFor(() => events.length === 1);
    expect(events[0]).toMatchObject({
      commandId: 'score.play',
      receivedAddress: '/score/play/alternate',
    });
  });

  it('processes nested bundles in packet order and ignores timetags', async () => {
    const events: OscCommandEvent[] = [];
    const registry = new FakeSocketRegistry();
    const service = createService(registry, 8124, events);
    await service.start({ preferredPort: 8124 });

    const nested = new Bundle(
      999999999,
      new Message('/score/markerNext'),
      new Message('/score/play'),
    );
    const bundle = new Bundle(999999999, new Message('/score/rewind'), nested);
    activeSocket(registry, 8124).emit('message', encode(bundle));
    await waitFor(() => events.length === 3);
    expect(events.map((event) => event.commandId)).toEqual([
      'score.rewind',
      'score.markerNext',
      'score.play',
    ]);
  });

  it('does not recognize the retired MIDI toggle or case-mismatched paths', async () => {
    const events: OscCommandEvent[] = [];
    const registry = new FakeSocketRegistry();
    const service = createService(registry, 8125, events);
    await service.start({ preferredPort: 8125 });

    const socket = activeSocket(registry, 8125);
    socket.emit('message', encode(new Message('/blueLive/toggleMidiInput')));
    socket.emit('message', encode(new Message('/Score/play')));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual([]);
  });

  it('reports malformed packets but remains listening for later valid traffic', async () => {
    const events: OscCommandEvent[] = [];
    const registry = new FakeSocketRegistry();
    const service = createService(registry, 8126, events);
    await service.start({ preferredPort: 8126 });

    const socket = activeSocket(registry, 8126);
    socket.emit('message', Buffer.from([0x01, 0x02, 0x03]));
    await waitFor(() => service.getSnapshot().lastPacketError !== null);
    expect(service.getSnapshot().phase).toBe('listening');

    socket.emit('message', encode(new Message('/score/stop')));
    await waitFor(() => events.length === 1);
    expect(events[0]?.commandId).toBe('score.stop');
  });

  it('restarts from a newly applied preference and releases the old port', async () => {
    const registry = new FakeSocketRegistry();
    const service = createService(registry, 8127);
    await service.start({ preferredPort: 8127 });
    await service.restart({ preferredPort: 8128 });

    expect(registry.bound.has(8127)).toBe(false);
    expect(service.getSnapshot()).toMatchObject({
      phase: 'listening',
      preferredPort: 8128,
      activePort: 8128,
    });
  });

  it('scans only upward across consecutive EADDRINUSE failures and keeps the saved preference', async () => {
    const registry = new FakeSocketRegistry();
    registry.hold(8129);
    registry.hold(8130);
    registry.hold(8131);
    const service = createService(registry, 8129);

    await service.start({ preferredPort: 8129 });
    expect(service.getSnapshot()).toMatchObject({
      phase: 'listening',
      preferredPort: 8129,
      activePort: 8132,
      fallbackFrom: 8129,
    });
  });

  it('serializes overlapping restart requests and keeps only the latest port active', async () => {
    const registry = new FakeSocketRegistry();
    const service = createService(registry, 8133);
    await service.start({ preferredPort: 8133 });

    await Promise.all([
      service.restart({ preferredPort: 8134 }),
      service.restart({ preferredPort: 8135 }),
    ]);

    expect(registry.bound.has(8133)).toBe(false);
    expect(registry.bound.has(8134)).toBe(false);
    expect(service.getSnapshot()).toMatchObject({
      phase: 'listening',
      preferredPort: 8135,
      activePort: 8135,
    });
  });

  it('reports non-conflict bind errors without scanning another port', async () => {
    const registry = new FakeSocketRegistry();
    const service = new OscControlService(
      { preferredPort: 8131 },
      {
        socketFactory: () => registry.create('EACCES'),
      },
    );
    services.push(service);

    await service.start({ preferredPort: 8131 });
    expect(registry.created).toHaveLength(1);
    expect(service.getSnapshot()).toMatchObject({
      phase: 'error',
      activePort: null,
      lastBindError: { code: 'EACCES', port: 8131 },
    });
  });

  it('does not wrap when port 65535 is occupied', async () => {
    const registry = new FakeSocketRegistry();
    registry.hold(65535);
    const service = createService(registry, 65535);

    await service.start({ preferredPort: 65535 });
    expect(registry.created).toHaveLength(1);
    expect(service.getSnapshot()).toMatchObject({
      phase: 'error',
      activePort: null,
      lastBindError: { code: 'EADDRINUSE', port: 65535 },
    });
  });

  it('releases its active port during shutdown', async () => {
    const registry = new FakeSocketRegistry();
    const service = createService(registry, 8132);
    await service.start({ preferredPort: 8132 });
    await service.shutdown();

    expect(registry.bound.has(8132)).toBe(false);
    expect(service.getSnapshot()).toMatchObject({ phase: 'stopped', activePort: null });
  });
});
