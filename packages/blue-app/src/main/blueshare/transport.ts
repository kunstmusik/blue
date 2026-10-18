import { randomUUID } from 'node:crypto';
import { net, session as electronSession, type Session, type ClientRequest } from 'electron';
import type { RememberedCookie } from './remembered-session';
import type { BlueShareError, BlueShareResult } from '../../shared/blueshare';

export const DEFAULT_BLUESHARE_ORIGIN = 'https://blue3.kunstmusik.com';
export const BLUESHARE_API_BASE = '/api/blueshare/v1';
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024; // 16 MiB
export const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

export interface TransportResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

export type CustomRequestAdapter = (options: {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly partitionName?: string;
}) => Promise<TransportResponse>;

export interface DetachedSession {
  readonly partitionName: string;
  readonly nativeSession: Session | null;
}

export interface TransportOptions {
  readonly origin?: string;
  readonly requestAdapter?: CustomRequestAdapter;
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function sanitizeErrorMessage(message: string): string {
  // Strip any cookies, auth headers, tokens, passwords, or emails
  const sanitized = message
    .replace(/(?:authorization|proxy-authorization)\s*:[^\r\n]*/gi, 'Authorization: [REDACTED]')
    .replace(/(["']?(?:[a-z_-]*token|secret|proof)["']?\s*[:=]\s*)[^;\s&,}]+/gi, '$1[REDACTED]')
    .replace(/session_id=[^;\s&]+/gi, 'session_id=[REDACTED]')
    .replace(/bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"[REDACTED]"')
    .replace(/password=[^;\s&]+/gi, 'password=[REDACTED]')
    .replace(/cookie:\s*([^;\r\n]+)/gi, 'cookie: [REDACTED]')
    .replace(/set-cookie:\s*([^;\r\n]+)/gi, 'set-cookie: [REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  return sanitized.length > 1000 ? sanitized.slice(0, 1000) : sanitized;
}

// Native requests in one private Session share its connection pool. No write queue:
// reject overlap, drain idle connections, then admit a single fresh-connection write.
const nativeActivity = new WeakMap<Session, { reads: number; writing: boolean }>();
export class BlueShareNotDispatchedError extends Error {
  readonly failure: BlueShareError;
  constructor(code: 'busy' | 'timeout' | 'cancelled' | 'network_error') {
    const message =
      code === 'cancelled'
        ? 'Request aborted before dispatch'
        : code === 'busy'
          ? 'A BlueShare request is still active. Wait for it to finish and try again.'
          : 'BlueShare request could not start. No write was sent; try again.';
    super(message);
    this.failure = { code, message, outcome: 'rejected' };
  }
}

export class BlueShareTransport {
  private readonly origin: string;
  private readonly requestAdapter?: CustomRequestAdapter;
  private currentSession: Session | null = null;
  private partitionName: string;

  constructor(options: TransportOptions = {}) {
    const origin = options.origin ?? DEFAULT_BLUESHARE_ORIGIN;
    const url = new URL(origin);

    if (url.protocol !== 'https:') {
      if (url.protocol !== 'http:' || !isLoopback(url.hostname)) {
        throw new Error(`Insecure non-loopback origin rejected: ${origin}`);
      }
    }

    this.origin = url.origin;
    this.requestAdapter = options.requestAdapter;
    this.partitionName = `blueshare-session-${randomUUID()}`;
  }

  getOrigin(): string {
    return this.origin;
  }

  getPartitionName(): string {
    return this.partitionName;
  }

  detachSession(): DetachedSession {
    const detachedPartition = this.partitionName;
    const detachedNative = this.currentSession;
    this.partitionName = `blueshare-session-${randomUUID()}`;
    this.currentSession = null;
    return {
      partitionName: detachedPartition,
      nativeSession: detachedNative,
    };
  }

  rotateSession(): void {
    const oldSession = this.currentSession;
    this.partitionName = `blueshare-session-${randomUUID()}`;
    this.currentSession = null;
    if (oldSession && typeof oldSession.clearStorageData === 'function') {
      oldSession.clearStorageData().catch(() => {});
    }
  }

  shutdown(): void {
    const oldSession = this.currentSession;
    this.currentSession = null;
    if (oldSession && typeof oldSession.clearStorageData === 'function') {
      oldSession.clearStorageData().catch(() => {});
    }
  }

  private getNativeSession(): Session {
    if (!this.currentSession) {
      this.currentSession = electronSession.fromPartition(this.partitionName, { cache: false });
    }
    return this.currentSession;
  }

  async snapshotCookies(): Promise<RememberedCookie[]> {
    const native = this.getNativeSession();
    const hostname = new URL(this.origin).hostname;
    const cookies = await native.cookies.get({ domain: hostname });
    return cookies
      .filter((c) => c.domain === hostname && c.hostOnly && c.httpOnly)
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: hostname,
        path: c.path ?? '/',
        secure: c.secure === true,
        httpOnly: true,
        hostOnly: true,
        sameSite: c.sameSite,
        ...(c.expirationDate === undefined ? {} : { expirationDate: c.expirationDate }),
      }));
  }

  async restoreCookies(
    cookies: readonly RememberedCookie[],
    expiresAt: string,
    isCurrent: () => boolean,
  ): Promise<void> {
    const native = this.getNativeSession();
    for (const cookie of cookies) {
      if (!isCurrent()) return;
      await native.cookies.set({
        url: `${this.origin}${cookie.path}`,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: Math.min(cookie.expirationDate ?? Infinity, Date.parse(expiresAt) / 1000),
      });
    }
  }

  buildUrl(
    routePath: string,
    queryParams?: Record<string, string | number | null | undefined>,
  ): string {
    if (!routePath.startsWith('/') || routePath.startsWith('//') || routePath.includes('://')) {
      throw new Error(`Invalid relative route path: ${routePath}`);
    }

    const fullPath = `${BLUESHARE_API_BASE}${routePath}`;
    const url = new URL(fullPath, this.origin);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  async sendRequest(options: {
    readonly routePath: string;
    readonly method?: 'GET' | 'POST' | 'DELETE';
    readonly queryParams?: Record<string, string | number | null | undefined>;
    readonly body?: unknown;
    readonly headers?: Record<string, string>;
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
    readonly session?: Session | null;
    readonly partitionName?: string;
  }): Promise<TransportResponse> {
    const method = options.method ?? 'GET';
    const url = this.buildUrl(options.routePath, options.queryParams);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (method === 'POST' || method === 'DELETE') {
      headers.Origin = this.origin;
    }

    let serializedBody: string | undefined;
    if (options.body !== undefined) {
      serializedBody =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    if (this.requestAdapter) {
      try {
        return await this.requestAdapter({
          url,
          method,
          headers,
          body: serializedBody,
          signal: options.signal,
          timeoutMs,
          partitionName: options.partitionName ?? this.partitionName,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error('BlueShare network request failed');
      }
    }

    return this.executeNativeRequest({
      url,
      method,
      headers,
      body: serializedBody,
      timeoutMs,
      signal: options.signal,
      session: options.session,
      partitionName: options.partitionName,
    });
  }

  private async executeNativeRequest(params: {
    readonly url: string;
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body?: string;
    readonly timeoutMs: number;
    readonly signal?: AbortSignal;
    readonly session?: Session | null;
    readonly partitionName?: string;
  }): Promise<TransportResponse> {
    if (params.signal?.aborted) throw new BlueShareNotDispatchedError('cancelled');
    const session =
      params.session ??
      (params.partitionName
        ? electronSession.fromPartition(params.partitionName, { cache: false })
        : this.getNativeSession());
    const activity = nativeActivity.get(session) ?? { reads: 0, writing: false };
    nativeActivity.set(session, activity);
    const writing = params.method !== 'GET';
    if (activity.writing || (writing && activity.reads > 0))
      throw new BlueShareNotDispatchedError('busy');
    if (writing) activity.writing = true;
    else activity.reads++;
    const release = () => {
      if (writing) activity.writing = false;
      else activity.reads--;
    };
    let closing = false;
    let finished = false;
    return new Promise<TransportResponse>((resolve, reject) => {
      let request: ClientRequest | null = null;
      let timer: NodeJS.Timeout | null = null;
      let settled = false;

      const cleanup = () => {
        settled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (abortHandler && params.signal) {
          params.signal.removeEventListener('abort', abortHandler);
        }
      };

      const abortHandler = () => {
        if (!settled) {
          cleanup();
          request?.abort();
          reject(
            request ? new Error('Request aborted') : new BlueShareNotDispatchedError('cancelled'),
          );
        }
      };

      if (params.signal) {
        params.signal.addEventListener('abort', abortHandler, { once: true });
      }

      timer = setTimeout(() => {
        if (!settled) {
          cleanup();
          request?.abort();
          reject(
            request
              ? new Error(`Request timed out after ${params.timeoutMs}ms`)
              : new BlueShareNotDispatchedError('timeout'),
          );
        }
      }, params.timeoutMs);

      const dispatch = () => {
        if (settled) return;
        try {
          request = net.request({
            method: params.method,
            url: params.url,
            session,
            redirect: 'error',
            cache: 'no-store',
            credentials: 'include',
          });
          request.setHeader('Connection', 'close');
          for (const [key, value] of Object.entries(params.headers)) request.setHeader(key, value);
          request.on('redirect', (_statusCode, _method, redirectUrl) => {
            if (!settled) {
              cleanup();
              request?.abort();
              reject(new Error('Redirect rejected: redirects not permitted'));
            }
          });

          request.on('error', (err) => {
            if (!settled) {
              cleanup();
              reject(new Error('BlueShare network request failed'));
            }
          });

          request.on('response', (response) => {
            let totalBytes = 0;
            const chunks: Buffer[] = [];

            response.on('data', (chunk: Buffer) => {
              totalBytes += chunk.length;
              if (totalBytes > MAX_RESPONSE_BYTES) {
                if (!settled) {
                  cleanup();
                  request?.abort();
                  reject(
                    new Error(`Response exceeded maximum size of ${MAX_RESPONSE_BYTES} bytes`),
                  );
                }
                return;
              }
              chunks.push(chunk);
            });

            response.on('end', () => {
              if (!settled) {
                cleanup();
                const body = Buffer.concat(chunks).toString('utf8');
                const headers: Record<string, string> = {};
                for (const [k, v] of Object.entries(response.headers)) {
                  if (Array.isArray(v)) {
                    headers[k.toLowerCase()] = v.join(', ');
                  } else if (typeof v === 'string') {
                    headers[k.toLowerCase()] = v;
                  }
                }
                resolve({
                  status: response.statusCode,
                  headers,
                  body,
                });
              }
            });

            response.on('error', (err) => {
              if (!settled) {
                cleanup();
                reject(new Error('BlueShare network request failed'));
              }
            });
          });

          if (params.body) {
            request.write(params.body);
          }
          request.end();
        } catch {
          cleanup();
          reject(
            request
              ? new Error('BlueShare network request failed')
              : new BlueShareNotDispatchedError('network_error'),
          );
        }
      };
      if (writing) {
        closing = true;
        // Cookie ownership is unchanged. Never close another active request's socket,
        // and never reuse an HTTP/2 connection for an admitted mutation (T088).
        void Promise.resolve()
          .then(() => session.closeAllConnections())
          .then(
            () => {
              closing = false;
              if (finished) release();
              else dispatch();
            },
            () => {
              closing = false;
              if (finished) release();
              else {
                cleanup();
                reject(new BlueShareNotDispatchedError('network_error'));
              }
            },
          );
      } else dispatch();
    }).finally(() => {
      finished = true;
      if (!closing) release();
    });
  }

  // Parse JSON response or construct BlueShareError
  parseResponse<T>(
    response: TransportResponse,
    guard?: (data: unknown) => data is T,
    expectedStatus?: number,
  ): BlueShareResult<T> {
    if (
      expectedStatus !== undefined &&
      response.status >= 200 &&
      response.status < 300 &&
      response.status !== expectedStatus
    ) {
      return {
        ok: false,
        error: {
          code: 'unexpected_status',
          message: `Expected HTTP ${expectedStatus} for this operation`,
          status: response.status,
          outcome: 'rejected',
        },
      };
    }
    const isMutation = response.status === 201 || response.status === 200;
    const retryHeader = response.headers['retry-after'];
    const parsedRetry =
      retryHeader && /^\d{1,5}$/.test(retryHeader) ? Number(retryHeader) : undefined;
    const retryAfter = parsedRetry !== undefined && parsedRetry <= 86400 ? parsedRetry : undefined;

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      const isAmbiguous =
        (response.status >= 200 && response.status < 300) ||
        response.status >= 500 ||
        response.status === 408;
      return {
        ok: false,
        error: {
          code: 'invalid_json',
          message: `Malformed non-JSON response from server (status ${response.status})`,
          status: response.status,
          outcome: isAmbiguous ? 'unknown' : 'rejected',
          retryAfterSeconds: isNaN(retryAfter as number) ? undefined : retryAfter,
        },
      };
    }

    if (response.status >= 200 && response.status < 300) {
      if (guard && !guard(parsed)) {
        return {
          ok: false,
          error: {
            code: 'invalid_payload',
            message: 'Server returned a success status but payload failed validation',
            status: response.status,
            outcome: isMutation ? 'unknown' : 'rejected',
          },
        };
      }
      return { ok: true, value: parsed as T };
    }

    // Error status >= 300
    const errObj =
      parsed && typeof parsed === 'object' && 'error' in (parsed as Record<string, unknown>)
        ? ((parsed as Record<string, unknown>).error as Record<string, unknown>)
        : (parsed as Record<string, unknown>);

    // Remote text/field values can contain arbitrary authentication proof. Project only
    // known codes and fixed recovery wording; local XML diagnostics use the checked IPC path.
    const rawCode = typeof errObj?.code === 'string' ? errObj.code : '';
    const allowedCodes = new Set([
      'RESOURCE_UNAVAILABLE',
      'UNAUTHORIZED',
      'NOT_FOUND',
      'SESSION_EXPIRED',
      'INVALID_ORIGIN',
      'UNAUTHENTICATED',
      'INVALID_CREDENTIALS',
      'SERVICE_UNAVAILABLE',
      'METHOD_NOT_ALLOWED',
      'ENDPOINT_NOT_FOUND',
      'SERVICE_TIMEOUT',
      'CATEGORY_TREE_UNAVAILABLE',
      'CATEGORY_NOT_FOUND',
      'RESOURCE_NOT_FOUND',
      'RESOURCE_REMOVED',
      'RESOURCE_CONTENT_UNAVAILABLE',
      'FORBIDDEN',
      'INVALID_INPUT',
      'PAYLOAD_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'REQUEST_TIMEOUT',
      'RATE_LIMITED',
    ]);
    const code = allowedCodes.has(rawCode.toUpperCase()) ? rawCode : `http_${response.status}`;
    const messages: Record<number, string> = {
      400: 'Check the indicated submission fields.',
      401: 'Sign-in failed or the session expired. Sign in again or recover your account.',
      403: 'The service denied this operation. Check ownership and service configuration.',
      404: 'The requested resource or category does not exist. Refresh the list.',
      409: 'Complete resource XML is unavailable. Choose another resource.',
      410: 'This resource has been removed. Refresh the list.',
      413: 'The submission exceeds service size limits.',
      415: 'The service rejected the submission format.',
      429: 'Too many requests. Wait before trying again.',
    };
    const message =
      messages[response.status] ??
      'The BlueShare service could not complete this request. Refresh before retrying a write.';
    let fields: Record<string, string> | undefined;
    if (errObj?.fields && typeof errObj.fields === 'object' && !Array.isArray(errObj.fields)) {
      const entries = Object.keys(errObj.fields).filter((k) =>
        [
          'categoryId',
          'name',
          'description',
          'blueType',
          'xml',
          'request',
          'email',
          'password',
          'beforeId',
          'limit',
        ].includes(k),
      );
      if (entries.length)
        fields = Object.fromEntries(
          entries.map((k) => [k, 'Check this field against the submission requirements.']),
        );
    }

    const outcome: 'rejected' | 'unknown' =
      response.status >= 500 || response.status === 408 ? 'unknown' : 'rejected';

    return {
      ok: false,
      error: {
        code,
        message,
        status: response.status,
        outcome,
        retryAfterSeconds: isNaN(retryAfter as number) ? undefined : retryAfter,
        fields,
      },
    };
  }
}
