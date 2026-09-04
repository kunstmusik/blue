import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequestLike = {
  sendTimeout: number;
  receiveTimeout: number;
  linger: number;
  sent: Buffer[];
  responses: Buffer[];
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

type SubscriberLike = {
  receiveTimeout: number;
  linger: number;
  subscriptions: Array<string | Buffer>;
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  push: (message: Buffer[]) => void;
};

const mockState = vi.hoisted(() => ({
  requestInstances: [] as RequestLike[],
  subscriberInstances: [] as SubscriberLike[],
}));

vi.mock('zeromq', () => {
  class MockRequest {
    sendTimeout = 0;
    receiveTimeout = 0;
    linger = -1;
    sent: Buffer[] = [];
    responses: Buffer[] = [];
    connect = vi.fn();
    close = vi.fn();

    constructor() {
      mockState.requestInstances.push(this);
    }

    async send(data: Buffer): Promise<void> {
      this.sent.push(Buffer.from(data));
    }

    async receive(): Promise<[Buffer]> {
      const next = this.responses.shift();
      if (!next) {
        throw new Error('No queued response for mock request');
      }
      return [next];
    }
  }

  class MockSubscriber implements AsyncIterable<Buffer[]> {
    receiveTimeout = 0;
    linger = -1;
    subscriptions: Array<string | Buffer> = [];
    connect = vi.fn();
    private closed = false;
    private queue: Buffer[][] = [];
    private waiters: Array<(value: IteratorResult<Buffer[]>) => void> = [];

    constructor() {
      mockState.subscriberInstances.push(this);
    }

    subscribe(...prefixes: Array<string | Buffer>): void {
      this.subscriptions.push(...prefixes);
    }

    close = vi.fn(() => {
      this.closed = true;
      while (this.waiters.length > 0) {
        const resolve = this.waiters.shift();
        resolve?.({ value: undefined, done: true });
      }
    });

    push(message: Buffer[]): void {
      if (this.waiters.length > 0) {
        const resolve = this.waiters.shift();
        resolve?.({ value: message, done: false });
        return;
      }

      this.queue.push(message);
    }

    [Symbol.asyncIterator](): AsyncIterator<Buffer[]> {
      return {
        next: () => {
          if (this.queue.length > 0) {
            return Promise.resolve({ value: this.queue.shift()!, done: false });
          }

          if (this.closed) {
            return Promise.resolve({ value: undefined, done: true });
          }

          return new Promise<IteratorResult<Buffer[]>>((resolve) => {
            this.waiters.push(resolve);
          });
        },
      };
    }
  }

  return {
    Request: MockRequest,
    Subscriber: MockSubscriber,
  };
});

import { EngineClient } from '../src/engine-client';
import { BLUE_ENGINE_PROTOCOL_VERSION, AUTOMATION_DECIMAL_FEATURE } from '../src/capabilities';
import {
  CMD_CREATE_ENGINE,
  CMD_DESTROY_ENGINE,
  CMD_GET_CAPABILITIES,
  CMD_GET_ENGINE_STATE,
  ENGINE_STATE_TOPIC,
} from '../src/protocol';

function encodeOkResponse(payload = ''): Buffer {
  const payloadBuffer = Buffer.from(payload, 'utf-8');
  const response = Buffer.alloc(5 + payloadBuffer.length);
  response.writeUInt8(0x00, 0);
  response.writeUInt32LE(payloadBuffer.length, 1);
  payloadBuffer.copy(response, 5);
  return response;
}

function capabilities(
  protocolVersion = BLUE_ENGINE_PROTOCOL_VERSION,
  features = [AUTOMATION_DECIMAL_FEATURE],
): string {
  return JSON.stringify({
    schemaVersion: 1,
    engineVersion: '0.1.0',
    protocolVersion,
    sourceRevision: 'test',
    features: ['engine-state-v1', ...features],
  });
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('EngineClient', () => {
  beforeEach(() => {
    mockState.requestInstances.length = 0;
    mockState.subscriberInstances.length = 0;
  });

  it('configures request and subscriber sockets on connect', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555', timeout: 1234 });

    await client.connect();

    const request = mockState.requestInstances[0];
    const subscriber = mockState.subscriberInstances[0];
    expect(request.sendTimeout).toBe(1234);
    expect(request.receiveTimeout).toBe(1234);
    expect(request.linger).toBe(0);
    expect(subscriber.receiveTimeout).toBe(0);
    expect(subscriber.linger).toBe(0);
    expect(subscriber.subscriptions).toEqual([ENGINE_STATE_TOPIC]);

    request.responses.push(encodeOkResponse());
    await client.disconnect();
  });

  it('connects to explicit ipc endpoints without deriving pub transport from tcp', async () => {
    const client = new EngineClient({
      endpoint: 'ipc:///tmp/blue-engine-control.ipc',
      pubEndpoint: 'ipc:///tmp/blue-engine-pub.ipc',
      timeout: 1234,
    });

    await client.connect();

    const request = mockState.requestInstances[0];
    const subscriber = mockState.subscriberInstances[0];
    expect(request.connect).toHaveBeenCalledWith('ipc:///tmp/blue-engine-control.ipc');
    expect(subscriber.connect).toHaveBeenCalledWith('ipc:///tmp/blue-engine-pub.ipc');

    request.responses.push(encodeOkResponse());
    await client.disconnect();
  });

  it('polls engine state via GET_ENGINE_STATE', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555' });
    await client.connect();

    const request = mockState.requestInstances[0];
    request.responses.push(
      encodeOkResponse(
        JSON.stringify({
          state: 'running',
          stopReason: 'none',
          engineCreated: true,
          running: true,
          sampleFrames: 4096,
          sampleRate: 44100,
          ksmps: 64,
          sequence: 3,
          lastError: '',
        }),
      ),
    );

    const response = await client.getEngineState();

    expect(request.sent[0].readUInt8(0)).toBe(CMD_GET_ENGINE_STATE);
    expect(response.ok).toBe(true);
    expect(response.state).toEqual(
      expect.objectContaining({
        state: 'running',
        sampleFrames: 4096,
        sequence: 3,
      }),
    );

    request.responses.push(encodeOkResponse());
    await client.disconnect();
  });

  it('dispatches pubsub engine state snapshots to listeners', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555' });
    await client.connect();

    const request = mockState.requestInstances[0];
    const subscriber = mockState.subscriberInstances[0];
    const listener = vi.fn();
    client.onEngineState(listener);

    subscriber.push([
      Buffer.from(ENGINE_STATE_TOPIC, 'utf-8'),
      Buffer.from(
        JSON.stringify({
          state: 'stopped',
          stopReason: 'completed',
          engineCreated: true,
          running: false,
          sampleFrames: 88200,
          sampleRate: 44100,
          ksmps: 64,
          sequence: 9,
          lastError: '',
        }),
        'utf-8',
      ),
    ]);

    await flushAsyncWork();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'stopped',
        stopReason: 'completed',
        sequence: 9,
      }),
    );

    request.responses.push(encodeOkResponse());
    await client.disconnect();
    expect(request.sent.at(-1)?.readUInt8(0)).toBe(CMD_DESTROY_ENGINE);
  });

  it('continues dispatching pubsub snapshots when one listener throws', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555' });
    await client.connect();

    const request = mockState.requestInstances[0];
    const subscriber = mockState.subscriberInstances[0];
    const badListener = vi.fn(() => {
      throw new Error('listener boom');
    });
    const goodListener = vi.fn();

    client.onEngineState(badListener);
    client.onEngineState(goodListener);

    subscriber.push([
      Buffer.from(ENGINE_STATE_TOPIC, 'utf-8'),
      Buffer.from(
        JSON.stringify({
          state: 'running',
          stopReason: 'none',
          engineCreated: true,
          running: true,
          sampleFrames: 64,
          sampleRate: 44100,
          ksmps: 64,
          sequence: 2,
          lastError: '',
        }),
        'utf-8',
      ),
    ]);

    await flushAsyncWork();

    expect(badListener).toHaveBeenCalledOnce();
    expect(goodListener).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'running',
        sequence: 2,
      }),
    );

    request.responses.push(encodeOkResponse());
    await client.disconnect();
  });

  it('gets and validates engine capabilities', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555' });
    await client.connect();
    const request = mockState.requestInstances[0];
    request.responses.push(encodeOkResponse(capabilities()));

    const result = await client.getCapabilities();

    expect(request.sent[0].readUInt8(0)).toBe(CMD_GET_CAPABILITIES);
    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({ protocolVersion: BLUE_ENGINE_PROTOCOL_VERSION }),
      message: '',
    });
    request.responses.push(encodeOkResponse());
    await client.disconnect();
  });

  it('performs the capability handshake before CREATE_ENGINE', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555' });
    await client.connect();
    const request = mockState.requestInstances[0];
    request.responses.push(encodeOkResponse(capabilities()), encodeOkResponse());

    expect(await client.createEngine()).toEqual(expect.objectContaining({ ok: true, message: '' }));
    expect(request.sent.map((message) => message.readUInt8(0))).toEqual([
      CMD_GET_CAPABILITIES,
      CMD_CREATE_ENGINE,
    ]);
    request.responses.push(encodeOkResponse());
    await client.disconnect();
  });

  it('rejects malformed capabilities and closes sockets', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555' });
    await client.connect();
    const request = mockState.requestInstances[0];
    const subscriber = mockState.subscriberInstances[0];
    request.responses.push(encodeOkResponse('{'));

    const result = await client.createEngine();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('capability handshake failed');
    expect(request.sent).toHaveLength(1);
    expect(request.close).toHaveBeenCalledOnce();
    expect(subscriber.close).toHaveBeenCalledOnce();
  });

  it('rejects a protocol mismatch before CREATE_ENGINE and tears down', async () => {
    const client = new EngineClient({ endpoint: 'tcp://localhost:5555' });
    await client.connect();
    const request = mockState.requestInstances[0];
    request.responses.push(encodeOkResponse(capabilities(99)));

    const result = await client.createEngine();

    expect(result).toEqual({
      ok: false,
      message: `Blue Engine protocol mismatch: expected ${BLUE_ENGINE_PROTOCOL_VERSION}, received 99`,
    });
    expect(request.sent.map((message) => message.readUInt8(0))).toEqual([CMD_GET_CAPABILITIES]);
    expect(request.close).toHaveBeenCalledOnce();
  });
});
