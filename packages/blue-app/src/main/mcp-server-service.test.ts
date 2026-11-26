import { EventEmitter } from 'node:events';
import {
  createServer as createNodeHttpServer,
  request as httpRequest,
  type IncomingMessage,
  type Server as HttpServer,
} from 'node:http';
import { connect as netConnect, type Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { McpServer } from '@modelcontextprotocol/server';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { z } from 'zod';
import {
  McpCredentialManager,
  type McpCredentialFileStore,
  type McpCredentialInterlock,
  type McpCredentialProtection,
} from './mcp-credential';
import {
  MCP_MAX_REQUEST_BODY_BYTES,
  MCP_PROJECT_RESOURCE_URIS,
  McpServerService,
  type McpAuthorizationContext,
  type McpServiceServerContext,
} from './mcp-server-service';
import type { McpServerPreferences, McpServerStatus } from '../shared/mcp-server';

class InMemoryProtection implements McpCredentialProtection {
  available = true;
  failDecrypt = false;

  isEncryptionAvailable(): boolean {
    return this.available;
  }

  encryptString(plainText: string): Buffer {
    return Buffer.from(plainText, 'utf8').map((byte) => byte ^ 0x5a);
  }

  decryptString(ciphertext: Buffer): string {
    if (this.failDecrypt) throw new Error('Keychain locked');
    return Buffer.from(ciphertext.map((byte) => byte ^ 0x5a)).toString('utf8');
  }
}

class InMemoryCredentialStore implements McpCredentialFileStore {
  data: Buffer | null = null;
  revocationMarker: string | null = null;
  failClear = false;
  failSave = false;
  failSaveMarker = false;
  failVerifyWritable = false;

  load(): Buffer | null {
    return this.data;
  }

  save(ciphertext: Buffer): void {
    if (this.failSave) throw new Error('EACCES: read-only');
    this.data = Buffer.from(ciphertext);
  }

  clear(): void {
    if (this.failClear) throw new Error('EACCES: cannot clear');
    this.data = null;
  }

  loadRevocationMarker(): string | null {
    return this.revocationMarker;
  }

  saveRevocationMarker(marker: string): void {
    if (this.failSaveMarker) throw new Error('EACCES: cannot save revocation marker');
    this.revocationMarker = marker;
  }

  clearRevocationMarker(): void {
    this.revocationMarker = null;
  }

  verifyWritable(): void {
    if (this.failVerifyWritable) throw new Error('EACCES: read-only directory');
  }
}

class InMemoryCredentialInterlock implements McpCredentialInterlock {
  marker: string | null = null;
  failSave = false;
  failVerifyWritable = false;

  load(): string | null {
    return this.marker;
  }

  save(marker: string): void {
    if (this.failSave) throw new Error('EACCES: cannot save interlock');
    this.marker = marker;
  }

  clear(): void {
    this.marker = null;
  }

  verifyWritable(): void {
    if (this.failVerifyWritable) throw new Error('EACCES: read-only interlock');
  }
}

class FakeSocket extends EventEmitter {
  destroyed = false;

  destroy(): this {
    if (!this.destroyed) {
      this.destroyed = true;
      this.emit('close');
    }
    return this;
  }
}

class FakeHttpServer extends EventEmitter {
  headersTimeout = 0;
  requestTimeout = 0;
  listening = false;
  closed = false;
  listenCalls: Array<{ host?: string; port?: number }> = [];
  private boundPort: number | null = null;

  constructor(
    private readonly registry: FakeHttpServerRegistry,
    private readonly options: {
      bindErrorCode?: string;
      asyncBind?: boolean;
      ephemeralPort?: number;
    } = {},
  ) {
    super();
  }

  listen(opts: { host?: string; port?: number }): this {
    this.listenCalls.push({ host: opts.host, port: opts.port });
    const completeBind = (): void => {
      const requestedPort = opts.port ?? 0;
      const errorCode =
        this.options.bindErrorCode ??
        (requestedPort !== 0 && this.registry.occupiedPorts.has(requestedPort)
          ? 'EADDRINUSE'
          : null);
      if (errorCode) {
        this.emit('error', Object.assign(new Error(`listen ${errorCode}`), { code: errorCode }));
        return;
      }
      const assigned =
        requestedPort === 0
          ? (this.options.ephemeralPort ?? this.registry.allocatePort())
          : requestedPort;
      this.boundPort = assigned;
      this.listening = true;
      this.registry.occupiedPorts.set(assigned, this);
      this.emit('listening');
    };

    if (this.options.asyncBind) {
      this.registry.pendingBinds.push(completeBind);
    } else {
      queueMicrotask(completeBind);
    }
    return this;
  }

  address(): { address: string; family: string; port: number } | null {
    if (this.boundPort === null) return null;
    return { address: '127.0.0.1', family: 'IPv4', port: this.boundPort };
  }

  closeAllConnections(): void {
    // Tracked for lifecycle verification.
  }

  close(callback?: (err?: Error) => void): this {
    this.closed = true;
    this.listening = false;
    if (this.boundPort !== null && this.registry.occupiedPorts.get(this.boundPort) === this) {
      this.registry.occupiedPorts.delete(this.boundPort);
    }
    this.boundPort = null;
    callback?.();
    return this;
  }
}

class FakeHttpServerRegistry {
  occupiedPorts = new Map<number, FakeHttpServer>();
  created: FakeHttpServer[] = [];
  pendingBinds: Array<() => void> = [];
  private nextEphemeral = 41000;

  create(options?: {
    bindErrorCode?: string;
    asyncBind?: boolean;
    ephemeralPort?: number;
  }): HttpServer {
    const server = new FakeHttpServer(this, options);
    this.created.push(server);
    return server as unknown as HttpServer;
  }

  allocatePort(): number {
    return this.nextEphemeral++;
  }

  holdPort(port: number): void {
    this.occupiedPorts.set(port, new FakeHttpServer(this));
  }
}

const activeServices: McpServerService[] = [];
const activeRawServers: HttpServer[] = [];
const activeClients: Client[] = [];

afterEach(async () => {
  await Promise.all(activeClients.splice(0).map((client) => client.close().catch(() => undefined)));
  await Promise.all(activeServices.splice(0).map((service) => service.shutdown()));
  await Promise.all(
    activeRawServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections?.();
          server.close(() => resolve());
        }),
    ),
  );
});

function createDefaultPrefs(overrides: Partial<McpServerPreferences> = {}): McpServerPreferences {
  return {
    enabled: false,
    preferredPort: 8765,
    accessMode: 'read-only',
    ...overrides,
  };
}

function createTestMcpServer(
  ctx: McpServiceServerContext,
  options: {
    onToolCall?: (args: { name?: string }) => Promise<void> | void;
  } = {},
): McpServer {
  const server = new McpServer(
    { name: 'blue-test', version: '1.0.0' },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
      },
    },
  );

  server.registerTool(
    'echo_status',
    {
      description: 'Echoes current mode and access state',
      inputSchema: z.object({ text: z.string() }).strict(),
    },
    async ({ text }) => {
      await options.onToolCall?.({ name: 'echo_status' });
      return {
        content: [{ type: 'text', text: `${ctx.era}:${ctx.accessMode}:${text}` }],
        structuredContent: {
          era: ctx.era,
          accessMode: ctx.accessMode,
          authorized: ctx.authContext.isAuthorized('read'),
          text,
        },
      };
    },
  );

  server.registerTool(
    'write_probe',
    {
      description: 'Checks write authorization',
      inputSchema: z.object({}).strict(),
    },
    async () => {
      const allowed = ctx.authContext.isAuthorized('write');
      return {
        isError: !allowed,
        content: [{ type: 'text', text: allowed ? 'write-ok' : 'ACCESS_DENIED' }],
      };
    },
  );

  for (const uri of MCP_PROJECT_RESOURCE_URIS) {
    server.registerResource(uri, uri, { mimeType: 'application/json' }, async (resourceUri) => ({
      contents: [
        {
          uri: resourceUri.href,
          text: JSON.stringify({ uri: resourceUri.href, accessMode: ctx.accessMode }),
        },
      ],
    }));
  }

  return server;
}

async function allocateFreeLoopbackPort(): Promise<number> {
  const probe = createNodeHttpServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port: 0 }, () => resolve());
  });
  const addr = probe.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  if (!port) throw new Error('Failed to allocate loopback port');
  return port;
}

async function rawHttpExchange(options: {
  port: number;
  path?: string;
  method?: string;
  headers?: Record<string, string | string[]>;
  body?: string | Buffer;
  chunks?: Array<string | Buffer>;
}): Promise<{ status: number; headers: IncomingMessage['headers']; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port: options.port,
        path: options.path ?? '/mcp',
        method: options.method ?? 'POST',
        headers: options.headers,
      },
      (res) => {
        const buffers: Buffer[] = [];
        res.on('data', (chunk: Buffer) => buffers.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(buffers).toString('utf8'),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (options.chunks) {
      for (const chunk of options.chunks) {
        req.write(chunk);
      }
      req.end();
    } else if (options.body !== undefined) {
      req.end(options.body);
    } else {
      req.end();
    }
  });
}

async function rawTcpExchange(
  port: number,
  payload: string,
): Promise<{ status: number; raw: string }> {
  return new Promise((resolve, reject) => {
    const socket = netConnect({ host: '127.0.0.1', port }, () => {
      socket.write(payload);
    });
    const chunks: Buffer[] = [];
    socket.on('data', (chunk: Buffer) => chunks.push(chunk));
    socket.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const statusMatch = /^HTTP\/1\.[01]\s+(\d+)/.exec(raw);
      resolve({ status: statusMatch ? Number(statusMatch[1]) : 0, raw });
    });
    socket.on('error', reject);
  });
}

function modernEnvelope(method: string, id: string | number, params: Record<string, unknown> = {}) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params: {
      ...params,
      _meta: {
        'modelcontextprotocol.io/protocolVersion': '2026-07-28',
        'modelcontextprotocol.io/clientInfo': { name: 'test-client', version: '1.0.0' },
        'modelcontextprotocol.io/clientCapabilities': {},
      },
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('McpServerService', () => {
  it('stays stopped on disabled startup without binding or provisioning a credential', async () => {
    const registry = new FakeHttpServerRegistry();
    const store = new InMemoryCredentialStore();
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: store,
    });
    const service = new McpServerService(createDefaultPrefs({ enabled: false }), {
      credentialManager,
      serverFactory: (ctx) => createTestMcpServer(ctx),
      httpServerFactory: () => registry.create(),
    });
    activeServices.push(service);

    await service.applyPreferences(createDefaultPrefs({ enabled: false }));

    expect(service.getStatus()).toMatchObject({
      phase: 'stopped',
      activePort: null,
      fallbackFrom: null,
      credentialStorage: null,
      error: null,
    });
    expect(registry.created).toHaveLength(0);
    expect(credentialManager.current()).toBeNull();
    expect(service.getCredentialForMain()).toBeNull();
  });

  it('binds only to IPv4 loopback 127.0.0.1 with HTTP timeouts configured', async () => {
    const registry = new FakeHttpServerRegistry();
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });
    const service = new McpServerService(createDefaultPrefs(), {
      credentialManager,
      serverFactory: (ctx) => createTestMcpServer(ctx),
      httpServerFactory: () => registry.create(),
      headersTimeoutMs: 12_000,
      requestTimeoutMs: 25_000,
    });
    activeServices.push(service);

    const status = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: 8765 }),
    );

    expect(status).toMatchObject({
      phase: 'listening',
      preferredPort: 8765,
      activePort: 8765,
      fallbackFrom: null,
      credentialStorage: 'persisted',
      error: null,
    });
    expect(registry.created).toHaveLength(1);
    expect(registry.created[0]?.listenCalls).toEqual([{ host: '127.0.0.1', port: 8765 }]);
    expect(registry.created[0]?.headersTimeout).toBe(12_000);
    expect(registry.created[0]?.requestTimeout).toBe(25_000);
    expect(service.getCredentialForMain()).toBe(credentialManager.current());
  });

  it('enters error with sanitized diagnostic and binds nothing when credential is unavailable', async () => {
    const registry = new FakeHttpServerRegistry();
    const store = new InMemoryCredentialStore();
    store.data = Buffer.from('corrupt-locked-ciphertext');
    const protection = new InMemoryProtection();
    protection.failDecrypt = true;

    const credentialManager = new McpCredentialManager({ protection, fileStore: store });
    const service = new McpServerService(createDefaultPrefs(), {
      credentialManager,
      serverFactory: (ctx) => createTestMcpServer(ctx),
      httpServerFactory: () => registry.create(),
    });
    activeServices.push(service);

    const status = await service.applyPreferences(createDefaultPrefs({ enabled: true }));

    expect(status.phase).toBe('error');
    expect(status.activePort).toBeNull();
    expect(status.credentialStorage).toBeNull();
    expect(status.error?.code).toBe('MCP_CREDENTIAL_UNAVAILABLE');
    expect(registry.created).toHaveLength(0);
    expect(service.getCredentialForMain()).toBeNull();
  });

  it('falls back once to 127.0.0.1:0 on EADDRINUSE and surfaces non-EADDRINUSE errors without fallback', async () => {
    const registry = new FakeHttpServerRegistry();
    registry.holdPort(8765);
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });
    const service = new McpServerService(createDefaultPrefs(), {
      credentialManager,
      serverFactory: (ctx) => createTestMcpServer(ctx),
      httpServerFactory: () => registry.create({ ephemeralPort: 45123 }),
    });
    activeServices.push(service);

    const fallbackStatus = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: 8765 }),
    );
    expect(fallbackStatus).toMatchObject({
      phase: 'listening',
      preferredPort: 8765,
      activePort: 45123,
      fallbackFrom: 8765,
    });
    expect(registry.created).toHaveLength(2);
    expect(registry.created[0]?.listenCalls).toEqual([{ host: '127.0.0.1', port: 8765 }]);
    expect(registry.created[1]?.listenCalls).toEqual([{ host: '127.0.0.1', port: 0 }]);

    // Non-EADDRINUSE bind error must not retry on port 0.
    const errRegistry = new FakeHttpServerRegistry();
    const errService = new McpServerService(createDefaultPrefs(), {
      credentialManager,
      serverFactory: (ctx) => createTestMcpServer(ctx),
      httpServerFactory: () => errRegistry.create({ bindErrorCode: 'EACCES' }),
    });
    activeServices.push(errService);

    const errorStatus = await errService.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: 8766 }),
    );
    expect(errRegistry.created).toHaveLength(1);
    expect(errorStatus).toMatchObject({
      phase: 'error',
      activePort: null,
      fallbackFrom: null,
      credentialStorage: null,
      error: { code: 'EACCES' },
    });
  });

  it('closes stale bind sockets immediately when superseded by restart or disable', async () => {
    const registry = new FakeHttpServerRegistry();
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });
    const service = new McpServerService(createDefaultPrefs(), {
      credentialManager,
      serverFactory: (ctx) => createTestMcpServer(ctx),
      httpServerFactory: () => registry.create({ asyncBind: true }),
    });
    activeServices.push(service);

    const firstStart = service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: 8801 }),
    );
    await waitFor(() => registry.pendingBinds.length === 1);

    const secondStart = service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: 8802 }),
    );

    // Complete the first (now stale) bind; its socket must close immediately.
    registry.pendingBinds[0]?.();
    await waitFor(() => registry.pendingBinds.length === 2);
    registry.pendingBinds[1]?.();

    await Promise.all([firstStart, secondStart]);

    expect(registry.created[0]?.closed).toBe(true);
    expect(registry.occupiedPorts.has(8801)).toBe(false);
    expect(registry.occupiedPorts.has(8802)).toBe(true);
    expect(service.getStatus()).toMatchObject({
      phase: 'listening',
      preferredPort: 8802,
      activePort: 8802,
    });
  });

  it('enforces pre-dispatch path, Host, Origin, Authorization, capacity (429), and 2 MiB limits on real 127.0.0.1', async () => {
    const preferredPort = await allocateFreeLoopbackPort();
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });

    let serverFactoryCalls = 0;
    let releaseSlowTool!: () => void;
    let slowToolStarted!: () => void;
    const slowToolStartedPromise = new Promise<void>((resolve) => {
      slowToolStarted = resolve;
    });
    const slowToolGate = new Promise<void>((resolve) => {
      releaseSlowTool = resolve;
    });

    const service = new McpServerService(createDefaultPrefs({ preferredPort }), {
      credentialManager,
      maxConcurrentRequests: 1,
      maxSubscriptions: 1,
      keepAliveMs: 0,
      serverFactory: (ctx) => {
        serverFactoryCalls++;
        return createTestMcpServer(ctx, {
          onToolCall: async () => {
            slowToolStarted();
            await slowToolGate;
          },
        });
      },
    });
    activeServices.push(service);

    const status = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort }),
    );
    expect(status.phase).toBe('listening');
    const port = status.activePort!;
    const token = service.getCredentialForMain()!;
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // 404 for non-/mcp paths.
    for (const badPath of ['/', '/mcp/', '/mcp/extra', '//mcp']) {
      const res = await rawHttpExchange({
        port,
        path: badPath,
        method: 'GET',
        headers: { Host: `127.0.0.1:${port}`, Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }

    // 403 for disallowed Host headers (missing in HTTP/1.0, empty, wrong port, no port, IPv6, external).
    const missingHostRes = await rawTcpExchange(
      port,
      `POST /mcp HTTP/1.0\r\nAuthorization: Bearer ${token}\r\nContent-Length: 2\r\n\r\n{}`,
    );
    expect(missingHostRes.status).toBe(403);
    expect(missingHostRes.raw.toLowerCase()).not.toContain('access-control-allow-origin');

    const emptyHostRes = await rawTcpExchange(
      port,
      `POST /mcp HTTP/1.1\r\nHost:\r\nAuthorization: Bearer ${token}\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`,
    );
    expect(emptyHostRes.status).toBe(403);
    expect(emptyHostRes.raw.toLowerCase()).not.toContain('access-control-allow-origin');

    for (const badHost of [
      `127.0.0.1:${port + 1}`,
      'localhost',
      `[::1]:${port}`,
      `evil.com:${port}`,
    ]) {
      const res = await rawHttpExchange({
        port,
        method: 'POST',
        headers: { Host: badHost, Authorization: `Bearer ${token}` },
        body: '{}',
      });
      expect(res.status).toBe(403);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }

    // 403 for disallowed Origin headers.
    for (const badOrigin of [
      '',
      'null',
      `https://localhost:${port}`,
      `http://127.0.0.1:${port + 1}`,
      `http://[::1]:${port}`,
      'http://evil.com',
      `http://localhost:${port}/`,
    ]) {
      const res = await rawHttpExchange({
        port,
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${port}`,
          Origin: badOrigin,
          Authorization: `Bearer ${token}`,
        },
        body: '{}',
      });
      expect(res.status).toBe(403);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }

    // 401 with WWW-Authenticate for missing or invalid Bearer tokens.
    for (const badAuth of [
      undefined,
      'Basic abc',
      `bearer ${token}`,
      `Bearer ${'0'.repeat(64)}`,
      'Bearer short',
    ]) {
      const headers: Record<string, string> = { Host: `localhost:${port}` };
      if (badAuth !== undefined) headers.Authorization = badAuth;
      const res = await rawHttpExchange({ port, method: 'POST', headers, body: '{}' });
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer realm="Blue MCP"');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }

    // None of the rejected requests above may reach the SDK serverFactory.
    expect(serverFactoryCalls).toBe(0);

    // Declared Content-Length > 2 MiB -> 413 before body parsing or SDK dispatch.
    const declaredTooLarge = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': String(MCP_MAX_REQUEST_BODY_BYTES + 1),
      },
      body: '{}',
    });
    expect(declaredTooLarge.status).toBe(413);
    expect(serverFactoryCalls).toBe(0);

    // Chunked body > 2 MiB (2_097_153 bytes) -> 413 before body parsing or SDK dispatch.
    const chunkedTooLarge = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Transfer-Encoding': 'chunked',
      },
      chunks: [Buffer.alloc(1024 * 1024, 0x20), Buffer.alloc(1024 * 1024, 0x20), Buffer.from(' ')],
    });
    expect(chunkedTooLarge.status).toBe(413);
    expect(serverFactoryCalls).toBe(0);

    // Exact 2 MiB (2_097_152 bytes) succeeds (both declared and chunked) and reaches SDK.
    const baseReq = JSON.stringify(modernEnvelope('tools/list', 10));
    const padLength = MCP_MAX_REQUEST_BODY_BYTES - Buffer.byteLength(baseReq, 'utf8');
    const exact2MiBBody = `${' '.repeat(padLength)}${baseReq}`;
    expect(Buffer.byteLength(exact2MiBBody, 'utf8')).toBe(MCP_MAX_REQUEST_BODY_BYTES);

    const exactDeclared = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `LOCALHOST:${port}`,
        Origin: `http://localhost:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': String(MCP_MAX_REQUEST_BODY_BYTES),
      },
      body: exact2MiBBody,
    });
    expect(exactDeclared.status).toBe(200);
    expect(exactDeclared.headers['access-control-allow-origin']).toBeUndefined();

    const exactChunked = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Transfer-Encoding': 'chunked',
      },
      chunks: [exact2MiBBody.slice(0, 1024 * 1024), exact2MiBBody.slice(1024 * 1024)],
    });
    expect(exactChunked.status).toBe(200);

    // Active request capacity (429) while 1 slow tool call is in flight.
    const callsBeforeCapacity = serverFactoryCalls;
    const inflightCall = rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(
        modernEnvelope('tools/call', 11, { name: 'echo_status', arguments: { text: 'hold' } }),
      ),
    });
    await slowToolStartedPromise;

    const rejected429 = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(modernEnvelope('tools/list', 12)),
    });
    expect(rejected429.status).toBe(429);
    expect(serverFactoryCalls).toBe(callsBeforeCapacity + 1);

    releaseSlowTool();
    const inflightRes = await inflightCall;
    expect(inflightRes.status).toBe(200);

    // Subscription stream capacity (429) while 1 subscription stream is open.
    const client = new Client(
      { name: 'cap-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    activeClients.push(client);
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    await client.connect(transport);
    const sub = await client.listen({ toolsListChanged: true });

    const secondListen = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(
        modernEnvelope('subscriptions/listen', 'listen:extra', {
          notifications: { toolsListChanged: true },
        }),
      ),
    });
    expect(secondListen.status).toBe(429);

    // Ordinary requests still succeed while subscription stream is open.
    const toolsWhileSubscribed = await client.listTools();
    expect(toolsWhileSubscribed.tools.map((t) => t.name)).toContain('echo_status');

    await sub.close();
  });

  it('serves @modelcontextprotocol/client over real 127.0.0.1 loopback (modern + legacy + notifications)', async () => {
    // Occupy the preferred port with a real socket to verify real EADDRINUSE fallback too.
    const occupied = createNodeHttpServer();
    activeRawServers.push(occupied);
    await new Promise<void>((resolve) => occupied.listen({ host: '127.0.0.1', port: 0 }, resolve));
    const occupiedPort = (occupied.address() as { port: number }).port;

    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });
    const service = new McpServerService(createDefaultPrefs({ preferredPort: occupiedPort }), {
      credentialManager,
      keepAliveMs: 0,
      serverFactory: (ctx) => createTestMcpServer(ctx),
    });
    activeServices.push(service);

    const status = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: occupiedPort, accessMode: 'read-only' }),
    );
    expect(status.phase).toBe('listening');
    expect(status.fallbackFrom).toBe(occupiedPort);
    expect(status.activePort).not.toBeNull();
    expect(status.activePort).not.toBe(occupiedPort);

    const port = status.activePort!;
    const token = service.getCredentialForMain()!;

    const client = new Client(
      { name: 'smoke-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    activeClients.push(client);
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    await client.connect(transport);
    expect(client.getProtocolEra()).toBe('modern');

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(['echo_status', 'write_probe']);

    const callResult = await client.callTool({
      name: 'echo_status',
      arguments: { text: 'hello' },
    });
    expect(callResult.structuredContent).toEqual({
      era: 'modern',
      accessMode: 'read-only',
      authorized: true,
      text: 'hello',
    });

    const resources = await client.listResources();
    expect(resources.resources.map((r) => r.uri)).toEqual([...MCP_PROJECT_RESOURCE_URIS]);
    const readRes = await client.readResource({ uri: 'blue://project/summary' });
    expect(readRes.contents[0]).toMatchObject({ uri: 'blue://project/summary' });

    const updatedUris: string[] = [];
    let toolsChangedCount = 0;
    client.setNotificationHandler('notifications/resources/updated', (note) => {
      updatedUris.push(note.params.uri);
    });
    client.setNotificationHandler('notifications/tools/list_changed', () => {
      toolsChangedCount++;
    });

    const sub = await client.listen({
      toolsListChanged: true,
      resourceSubscriptions: [...MCP_PROJECT_RESOURCE_URIS],
    });

    service.notifyProjectResourcesUpdated();
    await waitFor(() => updatedUris.length === 3);
    expect(updatedUris).toEqual([...MCP_PROJECT_RESOURCE_URIS]);

    // Access-mode change retains listener & stream, updates status, and notifies toolsChanged.
    const writeAuthBefore = service.createAuthorizationContext('write');
    expect(writeAuthBefore.isAuthorized()).toBe(false);

    const rwStatus = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: occupiedPort, accessMode: 'read-write' }),
    );
    expect(rwStatus.phase).toBe('listening');
    expect(rwStatus.activePort).toBe(port);
    expect(rwStatus.accessMode).toBe('read-write');
    await waitFor(() => toolsChangedCount === 1);

    const rwCall = await client.callTool({ name: 'write_probe', arguments: {} });
    expect(rwCall.isError).not.toBe(true);

    // Legacy 2025 stateless client compatibility over the same endpoint.
    const legacyClient = new Client({ name: 'legacy-client', version: '1.0.0' });
    activeClients.push(legacyClient);
    await legacyClient.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    expect(legacyClient.getProtocolEra()).toBe('legacy');
    const legacyCall = await legacyClient.callTool({
      name: 'echo_status',
      arguments: { text: 'legacy-ok' },
    });
    expect(legacyCall.structuredContent).toMatchObject({ era: 'legacy', text: 'legacy-ok' });

    await sub.close();
  });

  it('revokes old credentials, closes open streams, and transitions on credential rotation', async () => {
    const preferredPort = await allocateFreeLoopbackPort();
    const store = new InMemoryCredentialStore();
    const protection = new InMemoryProtection();
    const credentialManager = new McpCredentialManager({ protection, fileStore: store });
    const service = new McpServerService(createDefaultPrefs({ preferredPort }), {
      credentialManager,
      keepAliveMs: 0,
      serverFactory: (ctx) => createTestMcpServer(ctx),
    });
    activeServices.push(service);

    const status = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort }),
    );
    const port = status.activePort!;
    const oldToken = service.getCredentialForMain()!;
    const readAuth = service.createAuthorizationContext('read');
    expect(readAuth.isAuthorized()).toBe(true);

    const client = new Client(
      { name: 'rotate-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    activeClients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${oldToken}` } },
      }),
    );
    const sub = await client.listen({ toolsListChanged: true });

    const rotatePromise = service.rotateCredential();
    // Epoch and authorization context revoke synchronously before awaiting rotation.
    expect(readAuth.isAuthorized()).toBe(false);

    const rotateResult = await rotatePromise;
    expect(rotateResult).toEqual({ kind: 'ready', storage: 'persisted' });

    const closeReason = await sub.closed;
    expect(['graceful', 'remote']).toContain(closeReason);

    const newToken = service.getCredentialForMain()!;
    expect(newToken).not.toBe(oldToken);
    expect(service.getStatus()).toMatchObject({
      phase: 'listening',
      activePort: port,
      credentialStorage: 'persisted',
    });

    // Old token is rejected with 401; new token works on the same port.
    const oldRes = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${oldToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(modernEnvelope('tools/list', 1)),
    });
    expect(oldRes.status).toBe(401);

    const newRes = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${newToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(modernEnvelope('tools/list', 2)),
    });
    expect(newRes.status).toBe(200);

    // Rotation failure enters error and stops listener.
    const revokedToken = newToken;
    protection.available = false;
    store.failClear = true;
    const failedRotate = await service.rotateCredential();
    expect(failedRotate.kind).toBe('unavailable');
    expect(service.getStatus()).toMatchObject({
      phase: 'error',
      activePort: null,
      credentialStorage: null,
      error: { code: 'MCP_CREDENTIAL_UNAVAILABLE' },
    });

    // Enable/retry while revocation could not be persisted stays in error and never restores revokedToken (T054).
    protection.available = true;
    store.failSave = true;
    const retryAfterFail = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort }),
    );
    expect(retryAfterFail.phase).toBe('error');
    expect(retryAfterFail.error?.code).toBe('MCP_CREDENTIAL_UNAVAILABLE');
    expect(service.getCredentialForMain()).toBeNull();
    expect(credentialManager.matches(revokedToken)).toBe(false);

    // Restoring writability and rotating again recovers cleanly with a brand new token.
    store.failClear = false;
    store.failSave = false;
    const recoveredRotate = await service.rotateCredential();
    expect(recoveredRotate).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(service.getStatus().phase).toBe('listening');
    expect(service.getCredentialForMain()).not.toBeNull();
    expect(service.getCredentialForMain()).not.toBe(revokedToken);
  });

  it('permanently invalidates admission-captured write authority on permission downgrade while preserving read-only subscriptions (T055)', async () => {
    const preferredPort = await allocateFreeLoopbackPort();
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });
    let releasePendingWrite!: () => void;
    let pendingWriteEntered!: () => void;
    const pendingWriteEnteredPromise = new Promise<void>((resolve) => {
      pendingWriteEntered = resolve;
    });
    const pendingWriteGate = new Promise<void>((resolve) => {
      releasePendingWrite = resolve;
    });

    const service = new McpServerService(
      createDefaultPrefs({ preferredPort, accessMode: 'read-write' }),
      {
        credentialManager,
        keepAliveMs: 0,
        serverFactory: (ctx) =>
          createTestMcpServer(ctx, {
            onToolCall: async ({ name }) => {
              if (name === 'write_probe_wait') {
                pendingWriteEntered();
                await pendingWriteGate;
              }
            },
          }),
      },
    );
    // Wrap write_probe to allow holding the request before effect commit
    const originalFactory = (service as unknown as { serverFactory: typeof createTestMcpServer })
      .serverFactory;
    (service as unknown as { serverFactory: typeof createTestMcpServer }).serverFactory = (
      ctx: McpServiceServerContext,
    ) => {
      const server = originalFactory(ctx);
      server.registerTool(
        'write_probe_held',
        {
          description: 'Holds before checking admission authority',
          inputSchema: z.object({}).strict(),
        },
        async (_args, extra) => {
          const writeAuth = ctx.authContext.forAction('write', extra?.signal);
          expect(writeAuth.isAuthorized('write')).toBe(true);
          pendingWriteEntered();
          await pendingWriteGate;
          const allowedAfter = writeAuth.isAuthorized('write');
          return {
            isError: !allowedAfter,
            content: [{ type: 'text', text: allowedAfter ? 'write-ok' : 'ACCESS_DENIED' }],
          };
        },
      );
      return server;
    };
    activeServices.push(service);

    const status = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort, accessMode: 'read-write' }),
    );
    const port = status.activePort!;
    const token = service.getCredentialForMain()!;

    // Keep an active subscription stream open across mode changes
    const subClient = new Client(
      { name: 'downgrade-sub-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    activeClients.push(subClient);
    await subClient.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const notifications: string[] = [];
    subClient.setNotificationHandler('notifications/resources/updated', (note) => {
      notifications.push(note.params.uri);
    });
    const sub = await subClient.listen({ resourceSubscriptions: [...MCP_PROJECT_RESOURCE_URIS] });

    const inflightWrite = rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(
        modernEnvelope('tools/call', 501, { name: 'write_probe_held', arguments: {} }),
      ),
    });
    await pendingWriteEnteredPromise;

    // Downgrade read-write -> read-only, then re-enable read-write while the pending write is waiting
    await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort, accessMode: 'read-only' }),
    );
    await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort, accessMode: 'read-write' }),
    );

    releasePendingWrite();
    const res = await inflightWrite;
    expect(res.status).toBe(200);
    expect(res.body).toContain('ACCESS_DENIED');

    // A fresh request admitted after restoring read-write is authorized
    const freshWrite = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(
        modernEnvelope('tools/call', 502, { name: 'write_probe', arguments: {} }),
      ),
    });
    expect(freshWrite.status).toBe(200);
    expect(freshWrite.body).toContain('write-ok');

    // Subscription stream stayed open and continues receiving resource updates
    service.notifyProjectResourcesUpdated();
    await waitFor(() => notifications.length === MCP_PROJECT_RESOURCE_URIS.length);
    await sub.close();
  });

  it('synchronously aborts signals, destroys sockets, and is idempotent on disable and shutdown', async () => {
    const preferredPort = await allocateFreeLoopbackPort();
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });
    const observedSignals: AbortSignal[] = [];
    const observedAuthContexts: McpAuthorizationContext[] = [];
    let toolStarted!: () => void;
    const toolStartedPromise = new Promise<void>((resolve) => {
      toolStarted = resolve;
    });

    const service = new McpServerService(createDefaultPrefs({ preferredPort }), {
      credentialManager,
      keepAliveMs: 0,
      serverFactory: (ctx) => {
        observedSignals.push(ctx.authContext.signal);
        observedAuthContexts.push(ctx.authContext);
        return createTestMcpServer(ctx, {
          onToolCall: () =>
            new Promise<void>((resolve) => {
              toolStarted();
              ctx.authContext.signal.addEventListener('abort', () => resolve(), { once: true });
            }),
        });
      },
    });
    activeServices.push(service);

    const status = await service.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort }),
    );
    const port = status.activePort!;
    const token = service.getCredentialForMain()!;

    const streamClient = new Client(
      { name: 'stream-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    activeClients.push(streamClient);
    await streamClient.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const activeCountBeforeStream = observedSignals.length;
    const sub = await streamClient.listen({ toolsListChanged: true });
    const streamSignal = observedSignals[activeCountBeforeStream]!;

    const inflightTool = rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(
        modernEnvelope('tools/call', 99, { name: 'echo_status', arguments: { text: 'wait' } }),
      ),
    }).catch(() => null);
    await toolStartedPromise;
    const inflightSignal = observedSignals[observedSignals.length - 1]!;

    // Disable synchronously revokes authorization and aborts active signals before settling.
    const disablePromise = service.applyPreferences(
      createDefaultPrefs({ enabled: false, preferredPort }),
    );
    expect(observedAuthContexts.every((ctx) => !ctx.isAuthorized())).toBe(true);
    expect(streamSignal.aborted).toBe(true);
    expect(inflightSignal.aborted).toBe(true);

    const disabledStatus = await disablePromise;
    await inflightTool;
    expect(disabledStatus).toMatchObject({
      phase: 'stopped',
      activePort: null,
      credentialStorage: null,
    });
    expect(await sub.closed).toBeDefined();

    // Re-enable then test repeated terminal shutdown.
    const statusHistory: McpServerStatus[] = [];
    const fakeRegistry = new FakeHttpServerRegistry();
    const fakeSockets: FakeSocket[] = [];
    const trackedService = new McpServerService(createDefaultPrefs(), {
      credentialManager,
      httpServerFactory: () => {
        const srv = fakeRegistry.create();
        const sock = new FakeSocket();
        fakeSockets.push(sock);
        queueMicrotask(() => srv.emit('connection', sock as unknown as Socket));
        return srv;
      },
      serverFactory: (ctx) => createTestMcpServer(ctx),
      onStatusChanged: (next) => statusHistory.push(next),
    });
    activeServices.push(trackedService);

    await trackedService.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: 8890 }),
    );
    expect(fakeSockets.length).toBeGreaterThan(0);

    await Promise.all([trackedService.shutdown(), trackedService.shutdown()]);
    expect(fakeSockets.every((s) => s.destroyed)).toBe(true);
    expect(trackedService.getStatus().phase).toBe('stopped');

    // Enabling after terminal shutdown must remain stopped and bind nothing.
    const createdBeforePostShutdown = fakeRegistry.created.length;
    await trackedService.applyPreferences(
      createDefaultPrefs({ enabled: true, preferredPort: 8891 }),
    );
    expect(fakeRegistry.created.length).toBe(createdBeforePostShutdown);
    expect(trackedService.getStatus().phase).toBe('stopped');
  });

  it('tracks socket destruction on disable and forwards error hook safely', async () => {
    const onError = vi.fn();
    const registry = new FakeHttpServerRegistry();
    const credentialManager = new McpCredentialManager({
      protection: new InMemoryProtection(),
      fileStore: new InMemoryCredentialStore(),
    });
    const service = new McpServerService(createDefaultPrefs(), {
      credentialManager,
      httpServerFactory: () => registry.create(),
      serverFactory: (ctx) => createTestMcpServer(ctx),
      onError,
    });
    activeServices.push(service);

    await service.applyPreferences(createDefaultPrefs({ enabled: true, preferredPort: 8895 }));
    const srv = registry.created[0]!;
    const sock = new FakeSocket();
    srv.emit('connection', sock as unknown as Socket);

    srv.emit('error', Object.assign(new Error('socket exploded'), { code: 'ECONNRESET' }));
    expect(service.getStatus()).toMatchObject({
      phase: 'error',
      activePort: null,
      error: { code: 'ECONNRESET', message: 'socket exploded' },
    });
    expect(sock.destroyed).toBe(true);
  });

  it('starts the listener on persisted enabled preferences with fallback port, saved accessMode, and auth (T060)', async () => {
    const occupiedPort = await allocateFreeLoopbackPort();
    const blocker = createNodeHttpServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(occupiedPort, '127.0.0.1', () => resolve());
    });
    activeRawServers.push(blocker);

    const savedPrefs = createDefaultPrefs({
      enabled: true,
      preferredPort: occupiedPort,
      accessMode: 'read-write',
    });
    const store = new InMemoryCredentialStore();
    const protection = new InMemoryProtection();
    const credentialManager = new McpCredentialManager({ protection, fileStore: store });
    const service = new McpServerService(savedPrefs, {
      credentialManager,
      keepAliveMs: 0,
      serverFactory: (ctx) => createTestMcpServer(ctx),
    });
    activeServices.push(service);

    expect(service.getStatus().phase).toBe('stopped');

    const status = await service.applyPreferences(savedPrefs);
    expect(status.phase).toBe('listening');
    expect(status.preferredPort).toBe(occupiedPort);
    expect(status.fallbackFrom).toBe(occupiedPort);
    expect(status.activePort).not.toBeNull();
    expect(status.activePort).not.toBe(occupiedPort);
    expect(status.accessMode).toBe('read-write');

    const port = status.activePort!;
    const token = service.getCredentialForMain();
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // Invalid token rejected with 401; valid Bearer token accesses read-write tools.
    const unauth = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: 'Bearer deadbeef',
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(modernEnvelope('tools/list', 1)),
    });
    expect(unauth.status).toBe(401);

    const client = new Client(
      { name: 'startup-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    activeClients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const rwCall = await client.callTool({ name: 'write_probe', arguments: {} });
    expect(rwCall.isError).not.toBe(true);

    // Disabled startup stays stopped and binds nothing.
    const disabledPrefs = createDefaultPrefs({
      enabled: false,
      preferredPort: await allocateFreeLoopbackPort(),
      accessMode: 'read-only',
    });
    const registry = new FakeHttpServerRegistry();
    const disabledService = new McpServerService(disabledPrefs, {
      credentialManager: new McpCredentialManager({
        protection: new InMemoryProtection(),
        fileStore: new InMemoryCredentialStore(),
      }),
      httpServerFactory: () => registry.create(),
      serverFactory: (ctx) => createTestMcpServer(ctx),
    });
    activeServices.push(disabledService);
    const disabledStatus = await disabledService.applyPreferences(disabledPrefs);
    expect(disabledStatus.phase).toBe('stopped');
    expect(registry.created).toHaveLength(0);

    // Generation fencing still wins when disable races initial enabled startup.
    const racedService = new McpServerService(savedPrefs, {
      credentialManager: new McpCredentialManager({
        protection: new InMemoryProtection(),
        fileStore: new InMemoryCredentialStore(),
      }),
      httpServerFactory: () => registry.create(),
      serverFactory: (ctx) => createTestMcpServer(ctx),
    });
    activeServices.push(racedService);
    const startRace = racedService.applyPreferences(savedPrefs);
    const stopRace = racedService.applyPreferences({ ...savedPrefs, enabled: false });
    await Promise.all([startRace, stopRace]);
    expect(racedService.getStatus().phase).toBe('stopped');
    expect(racedService.getStatus().activePort).toBeNull();
  });

  it('fails closed across app relaunch when credential replacement, clear, and revocation marker fail simultaneously, then recovers via explicit rotate (T064)', async () => {
    const preferredPort = await allocateFreeLoopbackPort();
    const store = new InMemoryCredentialStore();
    const interlock = new InMemoryCredentialInterlock();
    const protection = new InMemoryProtection();
    const savedPrefs = createDefaultPrefs({ enabled: true, preferredPort });

    const firstManager = new McpCredentialManager({ protection, fileStore: store, interlock });
    const firstService = new McpServerService(savedPrefs, {
      credentialManager: firstManager,
      keepAliveMs: 0,
      serverFactory: (ctx) => createTestMcpServer(ctx),
    });
    activeServices.push(firstService);

    const startedStatus = await firstService.applyPreferences(savedPrefs);
    expect(startedStatus.phase).toBe('listening');
    const oldToken = firstService.getCredentialForMain()!;

    // Simulate simultaneous primary credential persistence failures during rotation.
    store.failClear = true;
    store.failSave = true;
    store.failSaveMarker = true;
    const failedRotate = await firstService.rotateCredential();
    expect(failedRotate.kind).toBe('unavailable');
    expect(firstService.getStatus()).toMatchObject({
      phase: 'error',
      activePort: null,
      error: { code: 'MCP_CREDENTIAL_UNAVAILABLE' },
    });

    // Simulate application relaunch: fresh McpCredentialManager + fresh McpServerService applying persisted enabled preferences.
    const relaunchedManager = new McpCredentialManager({
      protection,
      fileStore: store,
      interlock,
    });
    const relaunchedService = new McpServerService(savedPrefs, {
      credentialManager: relaunchedManager,
      keepAliveMs: 0,
      serverFactory: (ctx) => createTestMcpServer(ctx),
    });
    activeServices.push(relaunchedService);

    const relaunchStatus = await relaunchedService.applyPreferences(savedPrefs);
    expect(relaunchStatus).toMatchObject({
      phase: 'error',
      activePort: null,
      credentialStorage: null,
      error: { code: 'MCP_CREDENTIAL_UNAVAILABLE' },
    });
    expect(relaunchedService.getCredentialForMain()).toBeNull();
    expect(relaunchedManager.matches(oldToken)).toBe(false);

    // Restore write access and perform explicit recovery via rotateCredential().
    store.failClear = false;
    store.failSave = false;
    store.failSaveMarker = false;
    const recoveredRotate = await relaunchedService.rotateCredential();
    expect(recoveredRotate).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(relaunchedService.getStatus().phase).toBe('listening');

    const port = relaunchedService.getStatus().activePort!;
    const newToken = relaunchedService.getCredentialForMain()!;
    expect(newToken).not.toBe(oldToken);

    // Old revoked token is permanently rejected; recovered token works.
    const oldRes = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${oldToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(modernEnvelope('tools/list', 1)),
    });
    expect(oldRes.status).toBe(401);

    const newRes = await rawHttpExchange({
      port,
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Authorization: `Bearer ${newToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(modernEnvelope('tools/list', 2)),
    });
    expect(newRes.status).toBe(200);
  });
});
