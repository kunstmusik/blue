import { AsyncLocalStorage } from 'node:async_hooks';
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import type { Socket } from 'node:net';
import {
  createMcpHandler,
  isJsonContentType,
  type McpHttpHandler,
  type McpServer,
  type Server as McpLowLevelServer,
} from '@modelcontextprotocol/server';
import { toWebRequest } from '@modelcontextprotocol/node';
import {
  createInitialMcpServerStatus,
  normalizeMcpServerPreferences,
  type McpAccessMode,
  type McpServerPreferences,
  type McpServerStatus,
} from '../shared/mcp-server';
import type { McpCredentialManager, McpCredentialResult } from './mcp-credential';

export const MCP_MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;
export const MCP_DEFAULT_MAX_CONCURRENT_REQUESTS = 16;
export const MCP_DEFAULT_MAX_SUBSCRIPTION_STREAMS = 16;
export const MCP_DEFAULT_HEADERS_TIMEOUT_MS = 15_000;
export const MCP_DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MCP_PROJECT_RESOURCE_URIS = [
  'blue://project/summary',
  'blue://project/instruments',
  'blue://project/csd',
] as const;

const LOOPBACK_HOST = '127.0.0.1';
const MCP_PATH = '/mcp';
const BEARER_PREFIX = 'Bearer ';
const WWW_AUTHENTICATE_CHALLENGE = 'Bearer realm="Blue MCP"';

export type McpAuthorizationAction = 'read' | 'write' | 'runtime';

export interface McpAuthorizationContext {
  readonly listenerGeneration: number;
  readonly credentialEpoch: number;
  readonly writeAccessEpoch: number;
  readonly accessMode: McpAccessMode;
  readonly signal: AbortSignal;
  isAuthorized(requiredAction?: McpAuthorizationAction): boolean;
  forAction(action: McpAuthorizationAction, signal?: AbortSignal): McpAuthorizationContext;
}

export interface McpServiceServerContext {
  era: 'legacy' | 'modern';
  accessMode: McpAccessMode;
  authContext: McpAuthorizationContext;
}

export type McpServiceServerFactory = (
  ctx: McpServiceServerContext,
) => McpServer | McpLowLevelServer | Promise<McpServer | McpLowLevelServer>;

export interface McpServerServiceDeps {
  credentialManager: McpCredentialManager;
  serverFactory: McpServiceServerFactory;
  httpServerFactory?: () => HttpServer;
  onStatusChanged?: (status: McpServerStatus) => void;
  onError?: (error: Error) => void;
  maxConcurrentRequests?: number;
  maxSubscriptions?: number;
  headersTimeoutMs?: number;
  requestTimeoutMs?: number;
  keepAliveMs?: number;
  now?: () => Date;
}

interface TrackedStream {
  abortController: AbortController;
  res: ServerResponse;
}

type BindResult =
  | { kind: 'bound'; server: HttpServer; port: number }
  | { kind: 'failed'; code: string | null; message: string }
  | { kind: 'stale' };

function isRequestBodyTooLargeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'RequestBodyTooLargeError' ||
      (error as Error & { status?: unknown }).status === 413)
  );
}

function getDistinctHeaderCount(req: IncomingMessage, name: string): number {
  const distinct = req.headersDistinct?.[name];
  if (Array.isArray(distinct)) return distinct.length;
  return req.headers[name] === undefined ? 0 : 1;
}

function isExactMcpPath(rawUrl: string | undefined): boolean {
  if (!rawUrl || !rawUrl.startsWith('/') || rawUrl.startsWith('//')) return false;
  try {
    return new URL(rawUrl, 'http://127.0.0.1').pathname === MCP_PATH;
  } catch {
    return false;
  }
}

function isAllowedLoopbackHost(req: IncomingMessage, activePort: number): boolean {
  if (getDistinctHeaderCount(req, 'host') !== 1) return false;
  const host = req.headers.host;
  if (typeof host !== 'string' || host.length === 0) return false;
  const lower = host.toLowerCase();
  return lower === `127.0.0.1:${activePort}` || lower === `localhost:${activePort}`;
}

function isAllowedOrigin(req: IncomingMessage, activePort: number): boolean {
  const count = getDistinctHeaderCount(req, 'origin');
  if (count === 0) return true;
  if (count > 1) return false;
  const origin = req.headers.origin;
  if (typeof origin !== 'string') return false;
  const lower = origin.toLowerCase();
  return lower === `http://127.0.0.1:${activePort}` || lower === `http://localhost:${activePort}`;
}

function extractBearerToken(req: IncomingMessage): string | null {
  if (getDistinctHeaderCount(req, 'authorization') !== 1) return null;
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith(BEARER_PREFIX)) return null;
  return header.slice(BEARER_PREFIX.length);
}

async function isSubscriptionListenRequest(request: Request): Promise<boolean> {
  try {
    const text = await request.clone().text();
    if (!text) return false;
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.some(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          (item as { method?: unknown }).method === 'subscriptions/listen',
      );
    }
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { method?: unknown }).method === 'subscriptions/listen'
    );
  } catch {
    return false;
  }
}

/**
 * Owns the local loopback Streamable HTTP listener, pre-dispatch HTTP guards,
 * bounded request/stream tracking, and lifecycle transitions for Blue's MCP
 * endpoint. Deliberately free of project models, windows, and Csound state.
 */
export class McpServerService {
  private readonly credentialManager: McpCredentialManager;
  private readonly serverFactory: McpServiceServerFactory;
  private readonly httpServerFactory: () => HttpServer;
  private readonly onStatusChanged?: (status: McpServerStatus) => void;
  private readonly onError?: (error: Error) => void;
  private readonly maxConcurrentRequests: number;
  private readonly maxSubscriptions: number;
  private readonly headersTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly keepAliveMs?: number;
  private readonly now: () => Date;

  private desiredPreferences: McpServerPreferences;
  private currentAccessMode: McpAccessMode;
  private status: McpServerStatus;

  private activeServer: HttpServer | null = null;
  private activeHandler: McpHttpHandler | null = null;
  private activePort: number | null = null;
  private readonly trackedSockets = new Set<Socket>();
  private readonly activeRequests = new Set<AbortController>();
  private readonly activeStreams = new Set<TrackedStream>();
  private reservedStreamCount = 0;

  private lifecycleQueue: Promise<void> = Promise.resolve();
  private generation = 0;
  private writeAccessEpoch = 0;
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private readonly admissionStorage = new AsyncLocalStorage<McpAuthorizationContext>();

  constructor(initialPreferences: McpServerPreferences, deps: McpServerServiceDeps) {
    this.desiredPreferences = normalizeMcpServerPreferences(initialPreferences);
    this.currentAccessMode = this.desiredPreferences.accessMode;
    this.credentialManager = deps.credentialManager;
    this.serverFactory = deps.serverFactory;
    this.httpServerFactory = deps.httpServerFactory ?? (() => createServer());
    this.onStatusChanged = deps.onStatusChanged;
    this.onError = deps.onError;
    this.maxConcurrentRequests = deps.maxConcurrentRequests ?? MCP_DEFAULT_MAX_CONCURRENT_REQUESTS;
    this.maxSubscriptions = deps.maxSubscriptions ?? MCP_DEFAULT_MAX_SUBSCRIPTION_STREAMS;
    this.headersTimeoutMs = deps.headersTimeoutMs ?? MCP_DEFAULT_HEADERS_TIMEOUT_MS;
    this.requestTimeoutMs = deps.requestTimeoutMs ?? MCP_DEFAULT_REQUEST_TIMEOUT_MS;
    this.keepAliveMs = deps.keepAliveMs;
    this.now = deps.now ?? (() => new Date());
    this.status = createInitialMcpServerStatus(this.desiredPreferences);
  }

  getStatus(): McpServerStatus {
    return this.status;
  }

  getCredentialForMain(): string | null {
    if (this.shuttingDown || this.status.phase !== 'listening') return null;
    return this.credentialManager.current();
  }

  createAuthorizationContext(
    action: McpAuthorizationAction,
    signal?: AbortSignal,
  ): McpAuthorizationContext {
    const captured = {
      listenerGeneration: this.generation,
      credentialEpoch: this.credentialManager.getEpoch(),
      writeAccessEpoch: this.writeAccessEpoch,
      accessMode: this.currentAccessMode,
    };
    const boundSignal = signal ?? new AbortController().signal;
    return this.buildAuthorizationContext(captured, action, boundSignal);
  }

  private buildAuthorizationContext(
    captured: {
      listenerGeneration: number;
      credentialEpoch: number;
      writeAccessEpoch: number;
      accessMode: McpAccessMode;
    },
    action: McpAuthorizationAction,
    signal: AbortSignal,
  ): McpAuthorizationContext {
    const isAuthorized = (requiredAction: McpAuthorizationAction = action): boolean => {
      if (this.shuttingDown) return false;
      if (this.status.phase !== 'listening') return false;
      if (captured.listenerGeneration !== this.generation) return false;
      if (captured.credentialEpoch !== this.credentialManager.getEpoch()) return false;
      if (this.credentialManager.current() === null) return false;
      if (signal.aborted) return false;
      if (requiredAction !== 'read') {
        if (captured.accessMode !== 'read-write') return false;
        if (this.currentAccessMode !== 'read-write') return false;
        if (captured.writeAccessEpoch !== this.writeAccessEpoch) return false;
      }
      return true;
    };

    return {
      listenerGeneration: captured.listenerGeneration,
      credentialEpoch: captured.credentialEpoch,
      writeAccessEpoch: captured.writeAccessEpoch,
      accessMode: captured.accessMode,
      signal,
      isAuthorized,
      forAction: (nextAction: McpAuthorizationAction, extraSignal?: AbortSignal) => {
        const combinedSignal =
          extraSignal && extraSignal !== signal ? AbortSignal.any([signal, extraSignal]) : signal;
        return this.buildAuthorizationContext(captured, nextAction, combinedSignal);
      },
    };
  }

  isWriteGrantCurrent(grant: {
    listenerGeneration: number;
    credentialEpoch: number;
    writeAccessEpoch?: number;
  }): boolean {
    if (this.shuttingDown || this.status.phase !== 'listening') return false;
    if (this.currentAccessMode !== 'read-write') return false;
    if (this.credentialManager.current() === null) return false;
    if (grant.listenerGeneration !== this.generation) return false;
    if (grant.credentialEpoch !== this.credentialManager.getEpoch()) return false;
    if (grant.writeAccessEpoch !== undefined && grant.writeAccessEpoch !== this.writeAccessEpoch) {
      return false;
    }
    return true;
  }

  notifyProjectResourcesUpdated(): void {
    if (this.shuttingDown || this.status.phase !== 'listening' || !this.activeHandler) return;
    for (const uri of MCP_PROJECT_RESOURCE_URIS) {
      this.activeHandler.notify.resourceUpdated(uri);
    }
  }

  applyPreferences(preferences: McpServerPreferences): Promise<McpServerStatus> {
    if (this.shuttingDown) return Promise.resolve(this.status);

    const next = normalizeMcpServerPreferences(preferences);
    const prev = this.desiredPreferences;
    const enabledChanged = next.enabled !== prev.enabled;
    const portChanged = next.preferredPort !== prev.preferredPort;
    const accessModeChanged = next.accessMode !== prev.accessMode;

    this.desiredPreferences = next;
    this.currentAccessMode = next.accessMode;
    if (prev.accessMode === 'read-write' && next.accessMode !== 'read-write') {
      this.writeAccessEpoch++;
    }

    if (!next.enabled) {
      if (
        !enabledChanged &&
        this.status.phase === 'stopped' &&
        !portChanged &&
        !accessModeChanged
      ) {
        return this.enqueue(async () => undefined).then(() => this.status);
      }

      const opGeneration = ++this.generation;
      this.abortAllActive();
      return this.enqueue(async () => {
        if (this.shuttingDown || opGeneration !== this.generation) return;
        await this.stopCurrentListener();
        if (this.shuttingDown || opGeneration !== this.generation) return;
        this.publish({
          phase: 'stopped',
          preferredPort: next.preferredPort,
          accessMode: next.accessMode,
          activePort: null,
          fallbackFrom: null,
          credentialStorage: null,
          error: null,
        });
      }).then(() => this.status);
    }

    const needsBind =
      enabledChanged ||
      portChanged ||
      this.status.phase === 'stopped' ||
      this.status.phase === 'error';
    if (!needsBind && !accessModeChanged && this.status.phase === 'listening') {
      return this.enqueue(async () => undefined).then(() => this.status);
    }

    if (!needsBind) {
      return this.enqueue(async () => {
        if (this.shuttingDown) return;
        if (this.status.phase === 'listening' && this.activeHandler) {
          if (this.status.accessMode !== this.currentAccessMode) {
            this.publish({ accessMode: this.currentAccessMode });
          }
          this.activeHandler.notify.toolsChanged();
        }
      }).then(() => this.status);
    }

    const opGeneration = ++this.generation;
    const transitionPhase =
      this.status.phase === 'listening' || this.status.phase === 'restarting'
        ? 'restarting'
        : 'starting';
    this.abortAllActive();

    return this.enqueue(async () => {
      await this.startOrRestartInternal(next, transitionPhase, opGeneration);
    }).then(() => this.status);
  }

  rotateCredential(): Promise<McpCredentialResult> {
    if (this.shuttingDown) {
      return Promise.resolve({
        kind: 'unavailable',
        message: 'The MCP service is shutting down.',
      });
    }

    // Close current authority even if storage rejects the durable rotation.
    const result = this.credentialManager.rotate();
    const rotateGeneration = this.generation;
    const syncHandler = this.activeHandler;
    this.activeHandler = null;
    this.abortActiveRequests();

    return this.enqueue(async () => {
      const handlerToClose = syncHandler ?? this.activeHandler;
      if (this.activeHandler === handlerToClose) {
        this.activeHandler = null;
      }
      await this.closeHandlerAndStreams(handlerToClose);
      if (this.shuttingDown || rotateGeneration !== this.generation) return;

      if (result.kind === 'unavailable') {
        await this.stopCurrentListener();
        if (this.shuttingDown || rotateGeneration !== this.generation) return;
        this.publish({
          phase: 'error',
          activePort: null,
          fallbackFrom: null,
          credentialStorage: null,
          error: {
            code: 'MCP_CREDENTIAL_UNAVAILABLE',
            message: this.sanitizeMessage(result.message),
          },
        });
        return;
      }

      if (this.activeServer !== null && this.activePort !== null) {
        const freshHandler = this.createHandler();
        this.activeHandler = freshHandler;
        this.publish({
          phase: 'listening',
          credentialStorage: result.storage,
          error: null,
        });
        return;
      }

      if (this.desiredPreferences.enabled && this.status.phase === 'error') {
        await this.startOrRestartInternal(this.desiredPreferences, 'restarting', rotateGeneration);
      }
    }).then(() => result);
  }

  shutdown(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;

    this.shuttingDown = true;
    this.generation++;
    this.abortAllActive();

    this.shutdownPromise = this.enqueue(async () => {
      await this.stopCurrentListener();
      if (
        this.status.phase !== 'stopped' ||
        this.status.activePort !== null ||
        this.status.fallbackFrom !== null ||
        this.status.credentialStorage !== null ||
        this.status.error !== null
      ) {
        this.publish({
          phase: 'stopped',
          activePort: null,
          fallbackFrom: null,
          credentialStorage: null,
          error: null,
        });
      }
    });
    return this.shutdownPromise;
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.lifecycleQueue.then(operation, operation);
    this.lifecycleQueue = next.catch(() => undefined);
    return next;
  }

  private async startOrRestartInternal(
    preferences: McpServerPreferences,
    phase: 'starting' | 'restarting',
    generation: number,
  ): Promise<void> {
    if (this.shuttingDown || generation !== this.generation) return;

    this.publish({
      phase,
      preferredPort: preferences.preferredPort,
      accessMode: this.currentAccessMode,
      activePort: null,
      fallbackFrom: null,
      credentialStorage: null,
      error: null,
    });

    await this.stopCurrentListener();
    if (this.shuttingDown || generation !== this.generation) return;

    const credentialResult = this.credentialManager.provision();
    if (credentialResult.kind === 'unavailable') {
      this.publish({
        phase: 'error',
        preferredPort: preferences.preferredPort,
        accessMode: this.currentAccessMode,
        activePort: null,
        fallbackFrom: null,
        credentialStorage: null,
        error: {
          code: 'MCP_CREDENTIAL_UNAVAILABLE',
          message: this.sanitizeMessage(credentialResult.message),
        },
      });
      return;
    }

    let bindResult = await this.bindCandidate(preferences.preferredPort, generation);
    let fallbackFrom: number | null = null;

    if (bindResult.kind === 'failed' && bindResult.code === 'EADDRINUSE') {
      if (this.shuttingDown || generation !== this.generation) return;
      fallbackFrom = preferences.preferredPort;
      bindResult = await this.bindCandidate(0, generation);
    }

    if (bindResult.kind === 'stale') return;

    if (bindResult.kind === 'failed') {
      if (this.shuttingDown || generation !== this.generation) return;
      this.publish({
        phase: 'error',
        preferredPort: preferences.preferredPort,
        accessMode: this.currentAccessMode,
        activePort: null,
        fallbackFrom: null,
        credentialStorage: null,
        error: {
          code: bindResult.code ?? 'MCP_BIND_ERROR',
          message: this.sanitizeMessage(bindResult.message),
        },
      });
      return;
    }

    if (this.shuttingDown || generation !== this.generation) {
      this.destroyTrackedSockets();
      await this.closeServer(bindResult.server);
      return;
    }

    const handler = this.createHandler();
    this.activeServer = bindResult.server;
    this.activePort = bindResult.port;
    this.activeHandler = handler;
    this.attachRuntimeHandlers(bindResult.server, generation);

    this.publish({
      phase: 'listening',
      preferredPort: preferences.preferredPort,
      accessMode: this.currentAccessMode,
      activePort: bindResult.port,
      fallbackFrom,
      credentialStorage: credentialResult.storage,
      error: null,
    });
  }

  private bindCandidate(port: number, generation: number): Promise<BindResult> {
    const server = this.httpServerFactory();
    server.headersTimeout = this.headersTimeoutMs;
    server.requestTimeout = this.requestTimeoutMs;

    const onConnection = (socket: Socket): void => {
      if (this.shuttingDown || generation !== this.generation) {
        socket.destroy();
        return;
      }
      this.trackedSockets.add(socket);
      socket.once('close', () => {
        this.trackedSockets.delete(socket);
      });
    };
    server.on('connection', onConnection);

    return new Promise<BindResult>((resolve) => {
      let settled = false;
      const finish = (result: BindResult): void => {
        if (settled) return;
        settled = true;
        server.removeListener('error', onError);
        server.removeListener('listening', onListening);
        resolve(result);
      };

      const onError = (error: NodeJS.ErrnoException): void => {
        server.removeListener('connection', onConnection);
        void this.closeServer(server).finally(() => {
          finish({
            kind: 'failed',
            code: typeof error?.code === 'string' ? error.code : null,
            message: error instanceof Error ? error.message : String(error),
          });
        });
      };

      const onListening = (): void => {
        if (this.shuttingDown || generation !== this.generation) {
          server.removeListener('connection', onConnection);
          this.destroyTrackedSockets();
          void this.closeServer(server).finally(() => finish({ kind: 'stale' }));
          return;
        }
        const address = server.address();
        const boundPort =
          address && typeof address === 'object' && typeof address.port === 'number'
            ? address.port
            : null;
        if (!boundPort || boundPort <= 0) {
          server.removeListener('connection', onConnection);
          void this.closeServer(server).finally(() =>
            finish({
              kind: 'failed',
              code: 'MCP_BIND_ERROR',
              message: 'Bound HTTP server did not expose a valid IPv4 port.',
            }),
          );
          return;
        }
        finish({ kind: 'bound', server, port: boundPort });
      };

      server.once('error', onError);
      server.once('listening', onListening);
      try {
        server.listen({ host: LOOPBACK_HOST, port });
      } catch (error: unknown) {
        onError(error as NodeJS.ErrnoException);
      }
    });
  }

  private attachRuntimeHandlers(server: HttpServer, generation: number): void {
    server.on('request', (req, res) => {
      void this.handleIncomingRequest(server, generation, req, res);
    });
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (this.shuttingDown || generation !== this.generation || server !== this.activeServer) {
        return;
      }
      const oldHandler = this.activeHandler;
      this.activeHandler = null;
      this.activeServer = null;
      this.activePort = null;
      this.abortAllActive();
      this.destroyTrackedSockets();
      void oldHandler?.close().catch(() => undefined);
      void this.closeServer(server);
      this.publish({
        phase: 'error',
        activePort: null,
        fallbackFrom: null,
        credentialStorage: null,
        error: {
          code: typeof error?.code === 'string' ? error.code : 'MCP_SERVER_ERROR',
          message: this.sanitizeMessage(error instanceof Error ? error.message : String(error)),
        },
      });
    });
  }

  private createHandler(): McpHttpHandler {
    return createMcpHandler(
      (sdkCtx) => {
        const admitted = this.admissionStorage.getStore();
        const authContext = admitted
          ? admitted.forAction('read', sdkCtx.requestInfo?.signal)
          : this.createAuthorizationContext('read', sdkCtx.requestInfo?.signal);
        return this.serverFactory({
          era: sdkCtx.era,
          accessMode: authContext.accessMode,
          authContext,
        });
      },
      {
        legacy: 'stateless',
        maxRequestBodySize: MCP_MAX_REQUEST_BODY_BYTES,
        maxSubscriptions: this.maxSubscriptions,
        ...(this.keepAliveMs !== undefined ? { keepAliveMs: this.keepAliveMs } : {}),
        onerror: (error) => {
          this.onError?.(error);
        },
      },
    );
  }

  private async handleIncomingRequest(
    server: HttpServer,
    generation: number,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const activePort = this.activePort;
    const handler = this.activeHandler;
    if (
      this.shuttingDown ||
      generation !== this.generation ||
      server !== this.activeServer ||
      activePort === null ||
      handler === null
    ) {
      this.sendJsonError(res, 503, 'Service Unavailable');
      return;
    }

    if (!isExactMcpPath(req.url)) {
      this.sendJsonError(res, 404, 'Not Found');
      return;
    }

    if (!isAllowedLoopbackHost(req, activePort)) {
      this.sendJsonRpcError(res, 403, -32000, 'Forbidden: invalid Host header');
      return;
    }

    if (!isAllowedOrigin(req, activePort)) {
      this.sendJsonRpcError(res, 403, -32000, 'Forbidden: invalid Origin header');
      return;
    }

    const token = extractBearerToken(req);
    if (!token || !this.credentialManager.matches(token)) {
      this.sendJsonRpcError(res, 401, -32000, 'Unauthorized', {
        'WWW-Authenticate': WWW_AUTHENTICATE_CHALLENGE,
      });
      return;
    }

    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      this.sendJsonRpcError(res, 429, -32000, 'Too Many Requests: active request limit reached');
      return;
    }

    const declaredLength = req.headers['content-length'];
    if (
      getDistinctHeaderCount(req, 'content-length') > 1 ||
      (declaredLength !== undefined && Number(declaredLength) > MCP_MAX_REQUEST_BODY_BYTES)
    ) {
      this.sendJsonRpcError(
        res,
        413,
        -32000,
        `Payload Too Large: Request body must not exceed ${MCP_MAX_REQUEST_BODY_BYTES} bytes`,
        { Connection: 'close' },
      );
      return;
    }

    const requestAbort = new AbortController();
    const admittedAuth = this.createAuthorizationContext('read', requestAbort.signal);
    this.activeRequests.add(requestAbort);
    let requestTracked = true;
    let reservedStream = false;
    let streamEntry: TrackedStream | null = null;
    let finished = false;

    const onResClose = (): void => {
      if (!finished) requestAbort.abort();
    };
    res.on('close', onResClose);
    if (res.destroyed) requestAbort.abort();

    try {
      const webRequest = await toWebRequest(req, undefined, {
        signal: requestAbort.signal,
        maxRequestBodySize: MCP_MAX_REQUEST_BODY_BYTES,
      });

      if (
        this.shuttingDown ||
        generation !== this.generation ||
        this.activeHandler !== handler ||
        requestAbort.signal.aborted
      ) {
        if (!res.headersSent && !res.destroyed) {
          this.sendJsonError(res, 503, 'Service Unavailable');
        }
        return;
      }

      let isListenRequest = false;
      if (
        webRequest.method === 'POST' &&
        isJsonContentType(webRequest.headers.get('content-type'))
      ) {
        isListenRequest = await isSubscriptionListenRequest(webRequest);
        if (isListenRequest) {
          if (this.activeStreams.size + this.reservedStreamCount >= this.maxSubscriptions) {
            this.sendJsonRpcError(
              res,
              429,
              -32000,
              'Too Many Requests: subscription stream limit reached',
            );
            return;
          }
          this.reservedStreamCount++;
          reservedStream = true;
        }
      }

      const response = await this.admissionStorage.run(admittedAuth, () =>
        handler.fetch(webRequest),
      );

      if (this.shuttingDown || generation !== this.generation || this.activeHandler !== handler) {
        await response.body?.cancel().catch(() => undefined);
        if (!res.headersSent && !res.destroyed) {
          this.sendJsonError(res, 503, 'Service Unavailable');
        }
        return;
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const isOpenedStream =
        isListenRequest &&
        response.status === 200 &&
        contentType.includes('text/event-stream') &&
        response.body !== null;

      if (isOpenedStream) {
        if (reservedStream) {
          this.reservedStreamCount--;
          reservedStream = false;
        }
        if (requestTracked) {
          this.activeRequests.delete(requestAbort);
          requestTracked = false;
        }
        streamEntry = { abortController: requestAbort, res };
        this.activeStreams.add(streamEntry);
      }

      await this.writeWebResponse(response, res, requestAbort.signal);
      finished = true;
    } catch (error: unknown) {
      if (isRequestBodyTooLargeError(error)) {
        if (!res.headersSent && !res.destroyed) {
          this.sendJsonRpcError(
            res,
            413,
            -32000,
            `Payload Too Large: Request body must not exceed ${MCP_MAX_REQUEST_BODY_BYTES} bytes`,
            { Connection: 'close' },
          );
        }
        return;
      }
      if (!requestAbort.signal.aborted && !res.headersSent && !res.destroyed) {
        this.onError?.(error instanceof Error ? error : new Error(String(error)));
        this.sendJsonRpcError(res, 500, -32603, 'Internal server error');
      }
    } finally {
      res.removeListener('close', onResClose);
      if (reservedStream) this.reservedStreamCount--;
      if (requestTracked) this.activeRequests.delete(requestAbort);
      if (streamEntry) this.activeStreams.delete(streamEntry);
    }
  }

  private async writeWebResponse(
    response: Response,
    res: ServerResponse,
    signal: AbortSignal,
  ): Promise<void> {
    const headers: Record<string, string> = {};
    for (const [name, value] of response.headers) {
      if (name.toLowerCase() === 'access-control-allow-origin') continue;
      headers[name] = value;
    }

    if (res.destroyed || res.writableEnded) {
      await response.body?.cancel().catch(() => undefined);
      return;
    }

    res.writeHead(response.status, headers);
    if (response.body === null) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    let drainResolve: (() => void) | undefined;
    const releaseDrain = (): void => {
      drainResolve?.();
      drainResolve = undefined;
    };
    const onAbort = (): void => {
      releaseDrain();
      void reader.cancel().catch(() => undefined);
    };

    res.on('drain', releaseDrain);
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal.aborted || res.destroyed || res.writableEnded) break;
        if (value !== undefined && res.write(value) === false) {
          await new Promise<void>((resolve) => {
            if (signal.aborted || res.destroyed) {
              resolve();
              return;
            }
            drainResolve = resolve;
          });
        }
      }
    } catch {
      // Stream cancelled or socket closed.
    } finally {
      signal.removeEventListener('abort', onAbort);
      res.removeListener('drain', releaseDrain);
      releaseDrain();
      reader.releaseLock();
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }

  private sendJsonError(
    res: ServerResponse,
    statusCode: number,
    message: string,
    extraHeaders?: Record<string, string>,
  ): void {
    if (res.headersSent || res.destroyed) return;
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      ...extraHeaders,
    });
    res.end(JSON.stringify({ error: message }));
  }

  private sendJsonRpcError(
    res: ServerResponse,
    statusCode: number,
    code: number,
    message: string,
    extraHeaders?: Record<string, string>,
  ): void {
    if (res.headersSent || res.destroyed) return;
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      ...extraHeaders,
    });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code, message },
        id: null,
      }),
    );
  }

  private abortActiveRequests(): void {
    for (const controller of this.activeRequests) {
      controller.abort();
    }
  }

  private abortAllActive(): void {
    this.abortActiveRequests();
    for (const stream of this.activeStreams) {
      stream.abortController.abort();
    }
  }

  private async closeHandlerAndStreams(handler: McpHttpHandler | null): Promise<void> {
    if (handler) {
      await handler.close().catch(() => undefined);
    }
    for (const stream of Array.from(this.activeStreams)) {
      stream.abortController.abort();
      if (!stream.res.writableEnded && !stream.res.destroyed) {
        stream.res.end();
      }
    }
    this.activeStreams.clear();
  }

  private destroyTrackedSockets(): void {
    for (const socket of Array.from(this.trackedSockets)) {
      try {
        socket.destroy();
      } catch {
        // Ignore already-closed sockets.
      }
    }
    this.trackedSockets.clear();
  }

  private async stopCurrentListener(): Promise<void> {
    const handler = this.activeHandler;
    const server = this.activeServer;
    this.activeHandler = null;
    this.activeServer = null;
    this.activePort = null;

    this.abortAllActive();
    await this.closeHandlerAndStreams(handler);
    this.destroyTrackedSockets();
    if (server) {
      await this.closeServer(server);
    }
  }

  private closeServer(server: HttpServer): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections();
        }
        server.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  private publish(update: Partial<Omit<McpServerStatus, 'revision' | 'updatedAt'>>): void {
    this.status = {
      ...this.status,
      ...update,
      revision: this.status.revision + 1,
      updatedAt: this.now().toISOString(),
    };
    this.onStatusChanged?.(this.status);
  }

  private sanitizeMessage(raw: string): string {
    let sanitized = raw.split(/\r?\n/, 1)[0]?.trim() || 'MCP service error.';
    const currentToken = this.credentialManager.current();
    if (currentToken) {
      sanitized = sanitized.replaceAll(currentToken, '[redacted]');
    }
    sanitized = sanitized.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]');
    sanitized = sanitized.replace(/\b[0-9a-f]{64}\b/gi, '[redacted]');
    return sanitized;
  }
}
