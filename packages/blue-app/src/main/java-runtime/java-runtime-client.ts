import { Request, Subscriber } from 'zeromq';
import {
  JAVA_RUNTIME_METHODS,
  type ClojureEvalParams,
  type ClojureEvalResult,
  type ClojureEvalScoreObjectParams,
  type ClojureEvalScoreObjectResult,
  type ClojureReinitializeResult,
  type JavaRuntimeHealthResult,
  type JavaRuntimeRequestEnvelope,
  type JavaRuntimeResponseEnvelope,
  type JavaRuntimeSessionInitParams,
  type JavaRuntimeSessionInitResult,
  type JavaRuntimeShutdownResult,
  createJavaRuntimeRequest,
  decodeJavaRuntimeResponse,
  encodeJavaRuntimeRequest,
} from './java-runtime-protocol';

export interface JavaRuntimeClientOptions {
  endpoint: string;
  eventEndpoint?: string;
  timeout?: number;
  authToken: string;
}

class JavaRuntimeRequestError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'JavaRuntimeRequestError';
    this.code = code;
    this.details = details;
  }
}

function createFailureEnvelope<TResult>(
  error: JavaRuntimeRequestError,
): JavaRuntimeResponseEnvelope<TResult> {
  return {
    id: null,
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    stdout: '',
    stderr: '',
    elapsedMs: 0,
  };
}

export class JavaRuntimeClient {
  private socket: Request | null = null;
  private subscriber: Subscriber | null = null;
  private readonly endpoint: string;
  private readonly eventEndpoint?: string;
  private readonly timeout: number;
  private readonly authToken: string;
  private requestQueue: Promise<unknown> = Promise.resolve();
  private requestIndex = 0;

  constructor(options: JavaRuntimeClientOptions) {
    this.endpoint = options.endpoint;
    this.eventEndpoint = options.eventEndpoint;
    this.timeout = options.timeout ?? 5000;
    this.authToken = options.authToken;
  }

  async connect(): Promise<void> {
    this.ensureRequestSocket();

    if (!this.subscriber && this.eventEndpoint) {
      this.subscriber = new Subscriber();
      this.subscriber.linger = 0;
      this.subscriber.connect(this.eventEndpoint);
    }
  }

  async disconnect(): Promise<void> {
    if (this.subscriber) {
      this.subscriber.close();
      this.subscriber = null;
    }

    this.resetRequestSocket();
  }

  health(): Promise<JavaRuntimeResponseEnvelope<JavaRuntimeHealthResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.HEALTH, {});
  }

  initSession(
    params: JavaRuntimeSessionInitParams,
  ): Promise<JavaRuntimeResponseEnvelope<JavaRuntimeSessionInitResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.INIT_SESSION, params);
  }

  evaluateClojure(
    params: ClojureEvalParams,
  ): Promise<JavaRuntimeResponseEnvelope<ClojureEvalResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.EVAL_CLOJURE, params);
  }

  evaluateClojureScoreObject(
    params: ClojureEvalScoreObjectParams,
  ): Promise<JavaRuntimeResponseEnvelope<ClojureEvalScoreObjectResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.EVAL_CLOJURE_SCORE_OBJECT, params);
  }

  reinitializeClojure(): Promise<JavaRuntimeResponseEnvelope<ClojureReinitializeResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.REINITIALIZE_CLOJURE, {});
  }

  shutdown(): Promise<JavaRuntimeResponseEnvelope<JavaRuntimeShutdownResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.SHUTDOWN, {});
  }

  private async sendRequest<TResult, TParams extends Record<string, unknown>>(
    method: JavaRuntimeRequestEnvelope<TParams>['method'],
    params: TParams,
  ): Promise<JavaRuntimeResponseEnvelope<TResult>> {
    const operation = this.requestQueue.then(async () => {
      const socket = this.ensureRequestSocket();
      const id = `req-${++this.requestIndex}`;
      const request = createJavaRuntimeRequest(id, method, this.authToken, params);

      try {
        await socket.send(encodeJavaRuntimeRequest(request));
      } catch (error) {
        throw new JavaRuntimeRequestError(
          'TRANSPORT_ERROR',
          error instanceof Error ? error.message : String(error),
        );
      }

      let response: Buffer;
      try {
        [response] = await socket.receive() as [Buffer];
      } catch (error) {
        throw new JavaRuntimeRequestError(
          'TRANSPORT_ERROR',
          error instanceof Error ? error.message : String(error),
        );
      }

      let decoded: JavaRuntimeResponseEnvelope<TResult>;
      try {
        decoded = decodeJavaRuntimeResponse<TResult>(response);
      } catch (error) {
        throw new JavaRuntimeRequestError(
          'INVALID_RESPONSE_PAYLOAD',
          error instanceof Error ? error.message : String(error),
        );
      }

      if (decoded.id !== null && decoded.id !== id) {
        throw new JavaRuntimeRequestError(
          'RESPONSE_ID_MISMATCH',
          `Java runtime response id mismatch: expected ${id}, got ${decoded.id}`,
          {
            expectedId: id,
            receivedId: decoded.id,
          },
        );
      }

      return decoded;
    });

    this.requestQueue = operation.then(() => undefined, () => undefined);

    try {
      return await operation;
    } catch (error) {
      // A REQ socket that hits a transport/state failure can no longer be reused safely.
      this.resetRequestSocket();
      if (error instanceof JavaRuntimeRequestError) {
        return createFailureEnvelope<TResult>(error);
      }
      throw error;
    }
  }

  private ensureRequestSocket(): Request {
    if (!this.socket) {
      this.socket = new Request();
      this.socket.sendTimeout = this.timeout;
      this.socket.receiveTimeout = this.timeout;
      this.socket.linger = 0;
      this.socket.connect(this.endpoint);
    }

    return this.socket;
  }

  private resetRequestSocket(): void {
    if (!this.socket) {
      return;
    }

    this.socket.close();
    this.socket = null;
  }
}