import { Request } from 'zeromq';
import {
  JAVA_RUNTIME_METHODS,
  type ClojureEvalParams,
  type ClojureEvalResult,
  type ClojureEvalScoreObjectParams,
  type ClojureEvalScoreObjectResult,
  type ClojureReinitializeResult,
  type JavaRuntimeHealthResult,
  type JythonEvalInstrumentParams,
  type JythonEvalInstrumentResult,
  type JythonEvalObjectBuilderParams,
  type JythonEvalObjectBuilderResult,
  type JythonEvalScoreObjectParams,
  type JythonEvalScoreObjectResult,
  type JythonEvalScriptParams,
  type JythonEvalScriptResult,
  type JythonImportCheckParams,
  type JythonImportCheckResult,
  type JythonProcessNoteListParams,
  type JythonProcessNoteListResult,
  type JythonReinitializeResult,
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
  onTransportFailure?: () => void;
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
  private readonly endpoint: string;
  private readonly timeout: number;
  private readonly authToken: string;
  private readonly onTransportFailure?: () => void;
  private requestQueue: Promise<unknown> = Promise.resolve();
  private requestIndex = 0;

  constructor(options: JavaRuntimeClientOptions) {
    this.endpoint = options.endpoint;
    this.timeout = options.timeout ?? 5000;
    this.authToken = options.authToken;
    this.onTransportFailure = options.onTransportFailure;
  }

  async connect(): Promise<void> {
    this.ensureRequestSocket();
  }

  async disconnect(): Promise<void> {
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

  jythonImportCheck(
    params: JythonImportCheckParams,
  ): Promise<JavaRuntimeResponseEnvelope<JythonImportCheckResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.JYTHON_IMPORT_CHECK, params);
  }

  evaluateJythonScript(
    params: JythonEvalScriptParams,
  ): Promise<JavaRuntimeResponseEnvelope<JythonEvalScriptResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.JYTHON_EVAL_SCRIPT, params);
  }

  evaluateJythonScoreObject(
    params: JythonEvalScoreObjectParams,
  ): Promise<JavaRuntimeResponseEnvelope<JythonEvalScoreObjectResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.JYTHON_EVAL_SCORE_OBJECT, params);
  }

  evaluateJythonObjectBuilder(
    params: JythonEvalObjectBuilderParams,
  ): Promise<JavaRuntimeResponseEnvelope<JythonEvalObjectBuilderResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.JYTHON_EVAL_OBJECT_BUILDER, params);
  }

  evaluateJythonInstrument(
    params: JythonEvalInstrumentParams,
  ): Promise<JavaRuntimeResponseEnvelope<JythonEvalInstrumentResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.JYTHON_EVAL_INSTRUMENT, params);
  }

  processJythonNoteList(
    params: JythonProcessNoteListParams,
  ): Promise<JavaRuntimeResponseEnvelope<JythonProcessNoteListResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.JYTHON_PROCESS_NOTE_LIST, params);
  }

  reinitializeJython(): Promise<JavaRuntimeResponseEnvelope<JythonReinitializeResult>> {
    return this.sendRequest(JAVA_RUNTIME_METHODS.REINITIALIZE_JYTHON, {});
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
        if (error.code === 'TRANSPORT_ERROR') {
          this.onTransportFailure?.();
        }
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
