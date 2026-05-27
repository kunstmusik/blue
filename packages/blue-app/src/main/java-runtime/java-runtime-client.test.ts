import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequestLike = {
  sendTimeout: number;
  receiveTimeout: number;
  linger: number;
  sent: Buffer[];
  responses: Buffer[];
  receive: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

type SubscriberLike = {
  linger: number;
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

const mockState = vi.hoisted(() => ({
  requestInstances: [] as RequestLike[],
  subscriberInstances: [] as SubscriberLike[],
  onRequestCreated: null as ((request: RequestLike) => void) | null,
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
      mockState.onRequestCreated?.(this);
    }

    async send(data: Buffer): Promise<void> {
      this.sent.push(Buffer.from(data));
    }

    receive = vi.fn(async (): Promise<[Buffer]> => {
      const response = this.responses.shift();
      if (!response) {
        throw new Error('No queued response');
      }
      return [response];
    });
  }

  class MockSubscriber {
    linger = -1;
    connect = vi.fn();
    close = vi.fn();

    constructor() {
      mockState.subscriberInstances.push(this);
    }
  }

  return {
    Request: MockRequest,
    Subscriber: MockSubscriber,
  };
});

import { JavaRuntimeClient } from './java-runtime-client';

describe('java-runtime-client', () => {
  beforeEach(() => {
    mockState.requestInstances.length = 0;
    mockState.subscriberInstances.length = 0;
    mockState.onRequestCreated = null;
  });

  it('connects sockets with the configured timeout', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      timeout: 4321,
      authToken: 'secret',
    });

    await client.connect();

    const request = mockState.requestInstances[0];
    expect(request.sendTimeout).toBe(4321);
    expect(request.receiveTimeout).toBe(4321);
    expect(request.connect).toHaveBeenCalledWith('tcp://127.0.0.1:5555');
    expect(mockState.subscriberInstances[0].connect).toHaveBeenCalledWith('tcp://127.0.0.1:5556');
  });

  it('sends health requests and decodes the response', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();

    const request = mockState.requestInstances[0];
    request.responses.push(Buffer.from(JSON.stringify({
      id: 'req-1',
      ok: true,
      result: {
        version: '0.0.1',
        capabilities: ['clojure'],
        cwd: '/tmp/project',
        methods: ['runtime.health'],
      },
      stdout: '',
      stderr: '',
      elapsedMs: 2,
    })));

    const response = await client.health();

    expect(JSON.parse(request.sent[0].toString('utf-8'))).toMatchObject({
      method: 'runtime.health',
      authToken: 'secret',
    });
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.version).toBe('0.0.1');
    }
  });

  it('returns a specific envelope when the response id does not match', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();

    const request = mockState.requestInstances[0];
    request.responses.push(Buffer.from(JSON.stringify({
      id: 'different-id',
      ok: true,
      result: { accepted: true },
      stdout: '',
      stderr: '',
      elapsedMs: 1,
    })));

    const response = await client.shutdown();

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('RESPONSE_ID_MISMATCH');
      expect(response.error.details).toEqual({
        expectedId: 'req-1',
        receivedId: 'different-id',
      });
    }
  });

  it('recreates the request socket after a transport failure so later requests still work', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();

    const firstRequest = mockState.requestInstances[0];
    firstRequest.receive.mockRejectedValueOnce(new Error('Operation cannot be accomplished in current state'));

    const failed = await client.health();
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe('TRANSPORT_ERROR');
    }
    expect(firstRequest.close).toHaveBeenCalledTimes(1);

    mockState.onRequestCreated = (request) => {
      request.responses.push(Buffer.from(JSON.stringify({
        id: 'req-2',
        ok: true,
        result: {
          version: '0.0.1',
          capabilities: ['clojure'],
          cwd: '/tmp/project',
          methods: ['runtime.health'],
        },
        stdout: '',
        stderr: '',
        elapsedMs: 1,
      })));
    };

    const succeeded = await client.health();

    expect(mockState.requestInstances).toHaveLength(2);
    expect(mockState.requestInstances[1].connect).toHaveBeenCalledWith('tcp://127.0.0.1:5555');
    expect(succeeded.ok).toBe(true);
  });
});