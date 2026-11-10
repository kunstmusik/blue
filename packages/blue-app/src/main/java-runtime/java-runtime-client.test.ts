import { beforeEach, describe, expect, it, vi } from 'vitest';

type RequestLike = {
  sendTimeout: number;
  receiveTimeout: number;
  linger: number;
  sent: Buffer[];
  responses: Buffer[];
  send: (data: Buffer) => Promise<void>;
  receive: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

const mockState = vi.hoisted(() => ({
  requestInstances: [] as RequestLike[],
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

  return {
    Request: MockRequest,
  };
});

import { JavaRuntimeClient } from './java-runtime-client';

describe('java-runtime-client', () => {
  beforeEach(() => {
    mockState.requestInstances.length = 0;
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
  });

  it('sends health requests and decodes the response', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();

    const request = mockState.requestInstances[0];
    request.responses.push(
      Buffer.from(
        JSON.stringify({
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
        }),
      ),
    );

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

  it('sends Jython import checks and decodes the response', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();

    const request = mockState.requestInstances[0];
    request.responses.push(
      Buffer.from(
        JSON.stringify({
          id: 'req-1',
          ok: true,
          result: {
            importedModules: ['orchestra', 'pmask'],
            libraryPaths: ['/app/pythonLib/blue', '/Users/test/pythonLib'],
          },
          stdout: '',
          stderr: '',
          elapsedMs: 2,
        }),
      ),
    );

    const response = await client.jythonImportCheck({ modules: ['orchestra', 'pmask'] });

    expect(JSON.parse(request.sent[0].toString('utf-8'))).toMatchObject({
      method: 'jython.importCheck',
      params: { modules: ['orchestra', 'pmask'] },
    });
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.importedModules).toEqual(['orchestra', 'pmask']);
    }
  });

  it('applies a longer timeout to an interactive evaluation without changing the default', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      timeout: 5000,
      authToken: 'secret',
    });
    await client.connect();

    const request = mockState.requestInstances[0];
    request.responses.push(
      Buffer.from(
        JSON.stringify({
          id: 'req-1',
          ok: true,
          result: { value: '2', namespace: 'user0' },
          stdout: '',
          stderr: '',
          elapsedMs: 1,
        }),
      ),
    );

    const response = await client.evaluateClojure(
      { code: '(+ 1 1)', bindings: {}, returnVariableName: null },
      { timeout: 30000 },
    );

    expect(request.sendTimeout).toBe(30000);
    expect(request.receiveTimeout).toBe(30000);
    expect(response.ok).toBe(true);
  });

  it('returns a specific envelope when the response id does not match', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();

    const request = mockState.requestInstances[0];
    request.responses.push(
      Buffer.from(
        JSON.stringify({
          id: 'different-id',
          ok: true,
          result: { accepted: true },
          stdout: '',
          stderr: '',
          elapsedMs: 1,
        }),
      ),
    );

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
    firstRequest.receive.mockRejectedValueOnce(
      new Error('Operation cannot be accomplished in current state'),
    );

    const failed = await client.health();
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe('TRANSPORT_ERROR');
    }
    expect(firstRequest.close).toHaveBeenCalledTimes(1);

    mockState.onRequestCreated = (request) => {
      request.responses.push(
        Buffer.from(
          JSON.stringify({
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
          }),
        ),
      );
    };

    const succeeded = await client.health();

    expect(mockState.requestInstances).toHaveLength(2);
    expect(mockState.requestInstances[1].connect).toHaveBeenCalledWith('tcp://127.0.0.1:5555');
    expect(succeeded.ok).toBe(true);
  });

  it('invalidates queued operations on explicit disconnect without recreating sockets', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();
    const socket = mockState.requestInstances[0];

    let resolveReceive!: (value: [Buffer]) => void;
    socket.receive.mockImplementationOnce(
      () =>
        new Promise<[Buffer]>((resolve) => {
          resolveReceive = resolve;
        }),
    );

    let sentResolve!: () => void;
    const sentPromise = new Promise<void>((r) => {
      sentResolve = r;
    });
    const origSend = socket.send;
    socket.send = async (data: Buffer) => {
      await origSend.call(socket, data);
      sentResolve();
    };

    const first = client.health();
    await sentPromise;
    const second = client.health();

    await client.disconnect();

    resolveReceive([
      Buffer.from(
        JSON.stringify({
          id: 'req-1',
          ok: true,
          result: { version: '0.0.1' },
          stdout: '',
          stderr: '',
          elapsedMs: 1,
        }),
      ),
    ]);

    const firstResult = await first;
    const secondResult = await second;

    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) {
      expect(firstResult.error.code).toBe('CLIENT_DISCONNECTED');
    }
    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) {
      expect(secondResult.error.code).toBe('CLIENT_DISCONNECTED');
    }

    expect(mockState.requestInstances).toHaveLength(1);
    expect(socket.close).toHaveBeenCalled();
  });

  it('prevents implicit socket recreation after explicit disconnect', async () => {
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
    });
    await client.connect();
    expect(mockState.requestInstances).toHaveLength(1);

    await client.disconnect();

    const response = await client.health();
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('CLIENT_DISCONNECTED');
    }
    expect(mockState.requestInstances).toHaveLength(1);
  });

  it('isolates stale-generation failures after reconnect so they cannot close the new socket', async () => {
    const onTransportFailure = vi.fn();
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
      onTransportFailure,
    });
    await client.connect();
    const firstSocket = mockState.requestInstances[0];

    let rejectFirstReceive!: (error: Error) => void;
    firstSocket.receive.mockImplementationOnce(
      () =>
        new Promise<[Buffer]>((_, reject) => {
          rejectFirstReceive = reject;
        }),
    );

    let sentResolve!: () => void;
    const sentPromise = new Promise<void>((r) => {
      sentResolve = r;
    });
    const origSend = firstSocket.send;
    firstSocket.send = async (data: Buffer) => {
      await origSend.call(firstSocket, data);
      sentResolve();
    };

    const firstReqPromise = client.health();
    await sentPromise;

    await client.disconnect();
    expect(firstSocket.close).toHaveBeenCalledTimes(1);

    await client.connect();
    expect(mockState.requestInstances).toHaveLength(2);
    const secondSocket = mockState.requestInstances[1];

    secondSocket.responses.push(
      Buffer.from(
        JSON.stringify({
          id: 'req-2',
          ok: true,
          result: { version: '0.0.1', capabilities: [], cwd: '', methods: [] },
          stdout: '',
          stderr: '',
          elapsedMs: 1,
        }),
      ),
    );

    const secondReqPromise = client.health();
    const secondResult = await secondReqPromise;
    expect(secondResult.ok).toBe(true);

    rejectFirstReceive(new Error('Old socket read error'));
    const firstResult = await firstReqPromise;
    expect(firstResult.ok).toBe(false);

    expect(secondSocket.close).not.toHaveBeenCalled();
    expect(onTransportFailure).not.toHaveBeenCalled();
  });

  it('notifies onTransportFailure and keeps ordinary transport recovery retryable', async () => {
    const onTransportFailure = vi.fn();
    const client = new JavaRuntimeClient({
      endpoint: 'tcp://127.0.0.1:5555',
      authToken: 'secret',
      onTransportFailure,
    });
    await client.connect();
    const firstRequest = mockState.requestInstances[0];
    firstRequest.receive.mockRejectedValueOnce(new Error('Transport broken'));

    const failed = await client.health();
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe('TRANSPORT_ERROR');
    }
    expect(onTransportFailure).toHaveBeenCalledTimes(1);
    expect(firstRequest.close).toHaveBeenCalledTimes(1);

    mockState.onRequestCreated = (request) => {
      request.responses.push(
        Buffer.from(
          JSON.stringify({
            id: 'req-2',
            ok: true,
            result: { version: '0.0.1', capabilities: [], cwd: '', methods: [] },
            stdout: '',
            stderr: '',
            elapsedMs: 1,
          }),
        ),
      );
    };

    const succeeded = await client.health();
    expect(succeeded.ok).toBe(true);
    expect(mockState.requestInstances).toHaveLength(2);
  });
});
