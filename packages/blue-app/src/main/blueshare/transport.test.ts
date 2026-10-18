import { net, session } from 'electron';
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BlueShareTransport,
  BlueShareNotDispatchedError,
  DEFAULT_BLUESHARE_ORIGIN,
  sanitizeErrorMessage,
  MAX_RESPONSE_BYTES,
} from './transport';
import { FakeBlueShareServer } from './test-helpers';

class MockClientRequest extends EventEmitter {
  public headers: Record<string, string> = {};
  public writtenBody = '';
  public aborted = false;

  constructor(private readonly onEnd?: (req: MockClientRequest) => void) {
    super();
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  write(chunk: string): void {
    this.writtenBody += chunk;
  }

  end(): void {
    if (this.onEnd) {
      this.onEnd(this);
    }
  }

  abort(): void {
    this.aborted = true;
    this.emit('abort');
  }
}

class MockIncomingMessage extends EventEmitter {
  constructor(
    public readonly statusCode: number,
    public readonly headers: Record<string, string | string[]> = {},
  ) {
    super();
  }
}

let activeRequestHandler: ((req: MockClientRequest) => void) | null = null;
let lastCreatedRequest: MockClientRequest | null = null;

vi.mock('electron', () => ({
  session: {
    fromPartition: vi.fn().mockReturnValue({
      clearStorageData: vi.fn(),
      closeAllConnections: vi.fn().mockResolvedValue(undefined),
    }),
  },
  net: {
    request: vi.fn().mockImplementation(() => {
      const req = new MockClientRequest((r) => {
        if (activeRequestHandler) {
          activeRequestHandler(r);
        }
      });
      lastCreatedRequest = req;
      return req;
    }),
  },
}));

describe('BlueShareTransport', () => {
  beforeEach(() => {
    activeRequestHandler = null;
    lastCreatedRequest = null;
  });
  describe('Origin configuration and URL construction', () => {
    it('defaults to production origin and constructs v1 API URLs', () => {
      const transport = new BlueShareTransport();
      expect(transport.getOrigin()).toBe(DEFAULT_BLUESHARE_ORIGIN);
      expect(transport.buildUrl('/instrument/categories')).toBe(
        'https://blue3.kunstmusik.com/api/blueshare/v1/instrument/categories',
      );
    });

    it('appends query parameters safely', () => {
      const transport = new BlueShareTransport();
      const url = transport.buildUrl('/effect/resources', {
        categoryId: 10,
        beforeId: 45,
        ignoredNull: null,
        ignoredUndefined: undefined,
      });
      expect(url).toBe(
        'https://blue3.kunstmusik.com/api/blueshare/v1/effect/resources?categoryId=10&beforeId=45',
      );
    });

    it('allows loopback HTTP origins for test injection only', () => {
      const loopback1 = new BlueShareTransport({ origin: 'http://127.0.0.1:8080' });
      expect(loopback1.getOrigin()).toBe('http://127.0.0.1:8080');

      const loopback2 = new BlueShareTransport({ origin: 'http://localhost:3000' });
      expect(loopback2.getOrigin()).toBe('http://localhost:3000');
    });

    it('rejects non-loopback insecure HTTP origins', () => {
      expect(() => new BlueShareTransport({ origin: 'http://insecure.example.com' })).toThrow(
        /Insecure non-loopback origin rejected/,
      );
    });

    it('rejects renderer-supplied absolute URLs or invalid relative routes', () => {
      const transport = new BlueShareTransport();
      expect(() => transport.buildUrl('http://attacker.com/steal')).toThrow(
        /Invalid relative route path/,
      );
      expect(() => transport.buildUrl('//attacker.com/evil')).toThrow(
        /Invalid relative route path/,
      );
      expect(() => transport.buildUrl('relative-without-leading-slash')).toThrow(
        /Invalid relative route path/,
      );
      expect(() => transport.buildUrl('javascript:alert(1)')).toThrow(
        /Invalid relative route path/,
      );
    });
  });

  describe('Session partition and rotation', () => {
    it('uses a non-persist partition and changes partition on rotation', () => {
      const transport = new BlueShareTransport();
      const p1 = transport.getPartitionName();
      expect(p1.startsWith('blueshare-session-')).toBe(true);
      expect(p1.startsWith('persist:')).toBe(false);

      transport.rotateSession();
      const p2 = transport.getPartitionName();
      expect(p2.startsWith('blueshare-session-')).toBe(true);
      expect(p2).not.toBe(p1);
    });
  });

  describe('Error message sanitization', () => {
    it('sanitizes cookies, passwords, and tokens from error messages', () => {
      const raw =
        'Error occurred with session_id=secret-cookie-value; Path=/ and "password":"super-secret" in headers';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('secret-cookie-value');
      expect(sanitized).not.toContain('super-secret');
      expect(sanitized).toContain('session_id=[REDACTED]');
      expect(sanitized).toContain('"password":"[REDACTED]"');
    });
  });

  describe('Request handling with FakeBlueShareServer', () => {
    it('attaches exact mutation Origin header on POST and DELETE', async () => {
      const fakeServer = new FakeBlueShareServer();
      let capturedOrigin: string | undefined;

      const transport = new BlueShareTransport({
        requestAdapter: async (opts) => {
          capturedOrigin = opts.headers.Origin;
          return fakeServer.handleRequest(opts);
        },
      });

      // GET does not need Origin
      await transport.sendRequest({ routePath: '/instrument/categories' });
      expect(capturedOrigin).toBeUndefined();

      // POST attaches Origin
      await transport.sendRequest({
        routePath: '/session',
        method: 'POST',
        body: { email: 'steven@example.com', password: 'wrong' },
      });
      expect(capturedOrigin).toBe(DEFAULT_BLUESHARE_ORIGIN);
    });

    it('parses valid responses and reports structured errors for 4xx/5xx', async () => {
      const fakeServer = new FakeBlueShareServer();
      const transport = new BlueShareTransport({
        requestAdapter: async (opts) => fakeServer.handleRequest(opts),
      });

      // Successful category fetch
      const resp = await transport.sendRequest({ routePath: '/instrument/categories' });
      const parsed = transport.parseResponse<{ items: readonly unknown[] }>(resp);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(Array.isArray(parsed.value.items)).toBe(true);
      }

      // 401 Unauthorized for invalid login
      const loginResp = await transport.sendRequest({
        routePath: '/session',
        method: 'POST',
        body: { email: 'wrong@example.com', password: 'bad' },
      });
      const loginParsed = transport.parseResponse(loginResp);
      expect(loginParsed.ok).toBe(false);
      if (!loginParsed.ok) {
        expect(loginParsed.error.status).toBe(401);
        expect(loginParsed.error.code).toBe('invalid_credentials');
        expect(loginParsed.error.outcome).toBe('rejected');
      }

      // 504 Gateway Timeout -> outcome 'unknown'
      fakeServer.injectedStatus = 504;
      fakeServer.retryAfterSeconds = 15;
      const timeoutResp = await transport.sendRequest({ routePath: '/instrument/categories' });
      const timeoutParsed = transport.parseResponse(timeoutResp);
      expect(timeoutParsed.ok).toBe(false);
      if (!timeoutParsed.ok) {
        expect(timeoutParsed.error.status).toBe(504);
        expect(timeoutParsed.error.outcome).toBe('unknown');
        expect(timeoutParsed.error.retryAfterSeconds).toBe(15);
      }
    });

    it('rejects responses exceeding 16 MiB limit by aborting the stream in executeNativeRequest (T070)', async () => {
      activeRequestHandler = (req) => {
        const res = new MockIncomingMessage(200, {});
        req.emit('response', res);
        // Stream chunks exceeding MAX_RESPONSE_BYTES
        res.emit('data', Buffer.alloc(10 * 1024 * 1024));
        res.emit('data', Buffer.alloc(7 * 1024 * 1024)); // 17 MiB total
      };

      const transport = new BlueShareTransport();
      await expect(transport.sendRequest({ routePath: '/instrument/resources/1' })).rejects.toThrow(
        `Response exceeded maximum size of ${MAX_RESPONSE_BYTES} bytes`,
      );
      expect(lastCreatedRequest?.aborted).toBe(true);
    });

    it('enforces request deadline / timeout in executeNativeRequest (T070)', async () => {
      activeRequestHandler = (_req) => {
        // Deliberately do not reply; allow timeout to trigger
      };

      const transport = new BlueShareTransport();
      await expect(
        transport.sendRequest({ routePath: '/instrument/categories', timeoutMs: 30 }),
      ).rejects.toThrow(/Request timed out after 30ms/);
      expect(lastCreatedRequest?.aborted).toBe(true);
    });

    it('rejects native redirects with redirect_rejected error and aborts (T070)', async () => {
      activeRequestHandler = (req) => {
        req.emit('redirect', 302, 'GET', 'https://redirect.com/evil');
      };

      const transport = new BlueShareTransport();
      await expect(transport.sendRequest({ routePath: '/instrument/categories' })).rejects.toThrow(
        'Redirect rejected: redirects not permitted',
      );
      expect(lastCreatedRequest?.aborted).toBe(true);
    });

    it('handles pre-aborted and in-flight AbortSignal in executeNativeRequest (T070)', async () => {
      const transport = new BlueShareTransport();

      // Pre-aborted signal
      const preAborted = new AbortController();
      preAborted.abort();
      await expect(
        transport.sendRequest({ routePath: '/instrument/categories', signal: preAborted.signal }),
      ).rejects.toThrow('Request aborted before dispatch');

      // In-flight signal abort
      const inFlightAc = new AbortController();
      activeRequestHandler = (_req) => {
        inFlightAc.abort();
      };
      await expect(
        transport.sendRequest({ routePath: '/instrument/categories', signal: inFlightAc.signal }),
      ).rejects.toThrow('Request aborted');
      expect(lastCreatedRequest?.aborted).toBe(true);
    });

    it('sanitizes native request errors in executeNativeRequest (T070)', async () => {
      activeRequestHandler = (req) => {
        req.emit(
          'error',
          new Error('Connection failed with session_id=supersecret; and password=topsecret'),
        );
      };

      const transport = new BlueShareTransport();
      await expect(transport.sendRequest({ routePath: '/instrument/categories' })).rejects.toThrow(
        'BlueShare network request failed',
      );
      await expect(
        transport.sendRequest({ routePath: '/instrument/categories' }),
      ).rejects.not.toThrow(/supersecret/);
    });

    it('executes successful native requests delivering streamed chunks and headers (T070)', async () => {
      activeRequestHandler = (req) => {
        const res = new MockIncomingMessage(200, {
          'Content-Type': 'application/json',
          'X-Custom': 'BlueShare',
        });
        req.emit('response', res);
        res.emit('data', Buffer.from('{"status":'));
        res.emit('data', Buffer.from('"ok"}'));
        res.emit('end');
      };

      const transport = new BlueShareTransport();
      const res = await transport.sendRequest({
        routePath: '/instrument/categories',
        headers: { 'X-Test': '123' },
      });
      expect(res.status).toBe(200);
      expect(res.body).toBe('{"status":"ok"}');
      expect(res.headers['content-type']).toBe('application/json');
      expect(res.headers['x-custom']).toBe('BlueShare');
      expect(lastCreatedRequest?.headers['X-Test']).toBe('123');
    });

    it('parses malformed non-JSON response into invalid_json error with conservative outcome', () => {
      const transport = new BlueShareTransport();

      // Non-JSON on success (200 / 201) must conservatively retain 'unknown' outcome
      const res200 = transport.parseResponse({
        status: 200,
        headers: {},
        body: '<not>json</not>',
      });
      expect(res200.ok).toBe(false);
      if (!res200.ok) {
        expect(res200.error.code).toBe('invalid_json');
        expect(res200.error.outcome).toBe('unknown');
      }

      const res201 = transport.parseResponse({
        status: 201,
        headers: {},
        body: '<html>Created but not json</html>',
      });
      expect(res201.ok).toBe(false);
      if (!res201.ok) {
        expect(res201.error.code).toBe('invalid_json');
        expect(res201.error.outcome).toBe('unknown');
      }

      // Non-JSON on 4xx rejection (e.g. 400) is 'rejected'
      const res400 = transport.parseResponse({
        status: 400,
        headers: {},
        body: 'Bad Request HTML',
      });
      expect(res400.ok).toBe(false);
      if (!res400.ok) {
        expect(res400.error.code).toBe('invalid_json');
        expect(res400.error.outcome).toBe('rejected');
      }

      // Non-JSON on 5xx (e.g. 500 / 502) is 'unknown'
      const res500 = transport.parseResponse({
        status: 500,
        headers: {},
        body: 'Internal Server Error HTML',
      });
      expect(res500.ok).toBe(false);
      if (!res500.ok) {
        expect(res500.error.code).toBe('invalid_json');
        expect(res500.error.outcome).toBe('unknown');
      }
    });

    it('classifies ambiguous 5xx (500, 502, 503, 504) and 408 error responses as outcome unknown', () => {
      const transport = new BlueShareTransport();

      for (const status of [408, 500, 502, 503, 504]) {
        const res = transport.parseResponse({
          status,
          headers: {},
          body: JSON.stringify({ error: { code: `err_${status}`, message: `Error ${status}` } }),
        });
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error.outcome).toBe('unknown');
        }
      }

      // 4xx client errors (e.g. 400, 401, 403, 404, 409, 410, 429) remain 'rejected'
      for (const status of [400, 401, 403, 404, 409, 410, 429]) {
        const res = transport.parseResponse({
          status,
          headers: {},
          body: JSON.stringify({ error: { code: `err_${status}`, message: `Error ${status}` } }),
        });
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error.outcome).toBe('rejected');
        }
      }
    });
  });
});

describe('secret-safe error projection (T075)', () => {
  it('does not forward proof through arbitrary server codes, messages or field keys/values', () => {
    const transport = new BlueShareTransport();
    const result = transport.parseResponse({
      status: 400,
      headers: { 'retry-after': '-1' },
      body: JSON.stringify({
        error: {
          code: 'synthetic-proof',
          message: 'token=synthetic-proof',
          fields: { token: 'synthetic-proof', 'synthetic-proof': 'bad', xml: 'synthetic-proof' },
        },
      }),
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-proof');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.retryAfterSeconds).toBeUndefined();
  });
  it('sanitizes native exception text including token assignments and redirect query strings', () => {
    for (const message of [
      'token=synthetic-proof',
      '{"access_token":"synthetic-proof"}',
      'Redirect https://host/path?token=synthetic-proof',
      'Authorization: synthetic-proof',
    ]) {
      expect(sanitizeErrorMessage(message)).not.toContain('synthetic-proof');
    }
  });
});

describe('exclusive native write admission (T088)', () => {
  function reply(req: MockClientRequest) {
    const response = new MockIncomingMessage(200);
    req.emit('response', response);
    response.emit('data', Buffer.from('{}'));
    response.emit('end');
  }
  it('rejects overlap without queuing writes or closing an active read', async () => {
    const transport = new BlueShareTransport();
    const native = session.fromPartition('synthetic');
    vi.mocked(native.closeAllConnections).mockClear();
    vi.mocked(net.request).mockClear();
    const pending: MockClientRequest[] = [];
    activeRequestHandler = (req) => {
      pending.push(req);
    };
    const read = transport.sendRequest({ routePath: '/echo', session: native });
    await expect(
      transport.sendRequest({ routePath: '/publish', method: 'POST', session: native, body: {} }),
    ).rejects.toBeInstanceOf(BlueShareNotDispatchedError);
    expect(native.closeAllConnections).not.toHaveBeenCalled();
    expect(pending[0].aborted).toBe(false);
    reply(pending.shift()!);
    await read;
    const write = transport.sendRequest({
      routePath: '/publish',
      method: 'POST',
      session: native,
      body: {},
    });
    await expect(
      transport.sendRequest({ routePath: '/remove', method: 'DELETE', session: native }),
    ).rejects.toBeInstanceOf(BlueShareNotDispatchedError);
    await expect(
      transport.sendRequest({ routePath: '/echo', session: native }),
    ).rejects.toBeInstanceOf(BlueShareNotDispatchedError);
    expect(native.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(pending).toHaveLength(1);
    reply(pending.shift()!);
    await write;
    expect(net.request).toHaveBeenCalledTimes(2);
    activeRequestHandler = reply;
    await transport.sendRequest({ routePath: '/echo', session: native });
  });
  it('bounds connection draining, sends nothing after timeout and holds admission until draining settles', async () => {
    vi.useFakeTimers();
    const native = session.fromPartition('synthetic');
    let finish!: () => void;
    vi.mocked(native.closeAllConnections).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(net.request).mockClear();
    try {
      const transport = new BlueShareTransport();
      const write = transport.sendRequest({
        routePath: '/publish',
        method: 'POST',
        session: native,
        timeoutMs: 30,
      });
      const failure = expect(write).rejects.toMatchObject({
        failure: { code: 'timeout', outcome: 'rejected' },
      });
      await vi.advanceTimersByTimeAsync(31);
      await failure;
      await expect(
        transport.sendRequest({ routePath: '/remove', method: 'DELETE', session: native }),
      ).rejects.toMatchObject({ failure: { code: 'busy' } });
      finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(net.request).not.toHaveBeenCalled();
      activeRequestHandler = reply;
      await transport.sendRequest({ routePath: '/echo', session: native });
    } finally {
      vi.useRealTimers();
    }
  });
});
