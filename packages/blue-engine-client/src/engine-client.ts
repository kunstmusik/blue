/**
 * EngineClient — ZMQ REQ/REP client for the C++ blue-engine process.
 *
 * Manages connection to a running blue-engine executable and provides
 * methods for all protocol commands plus a pub/sub state stream.
 */
import { Request, Subscriber } from 'zeromq';
import {
  BLUE_ENGINE_PROTOCOL_VERSION,
  AUTOMATION_DECIMAL_FEATURE,
  BATCH_CHANNELS_FEATURE,
  decodeEngineCapabilitiesJson,
  EngineCapabilities,
  hasEngineFeature,
} from './capabilities';
import {
  encodeSetChannel,
  encodeGetChannel,
  encodeCreateAutomation,
  encodeUpdateAutomation,
  encodeNameCommand,
  encodeNoPayloadCommand,
  decodeAutomationList,
  decodeEngineStatePayload,
  AutomationCurveCode,
  AutomationPoint,
  AutomationListEntry,
  EngineStateSnapshot,
  ENGINE_STATE_TOPIC,
  CMD_CREATE_ENGINE,
  CMD_COMPILE_ORC,
  CMD_READ_SCORE,
  CMD_SET_OPTION,
  CMD_START,
  CMD_STOP,
  CMD_DESTROY_ENGINE,
  CMD_GET_ENGINE_STATE,
  CMD_GET_CAPABILITIES,
  CMD_CREATE_CHANNEL,
  CMD_SET_CHANNEL,
  CMD_GET_CHANNEL,
  CMD_GET_SHM_NAME,
  CMD_BATCH_SET_CHANNELS,
  CMD_BATCH_GET_CHANNELS,
  encodeSetChannels,
  encodeGetChannels,
  decodeBatchChannelValues,
  BatchChannelEntry,
  CMD_CREATE_AUTOMATION,
  CMD_UPDATE_AUTOMATION,
  CMD_DELETE_AUTOMATION,
  CMD_ENABLE_AUTOMATION,
  CMD_DISABLE_AUTOMATION,
  CMD_LIST_AUTOMATION,
  CMD_CLEAR_AUTOMATION,
} from './protocol';

// Status codes (from engine protocol)
const STATUS_OK = 0x00;
const STATUS_ERROR = 0x01;

export interface EngineClientOptions {
  /** ZMQ endpoint (default: tcp://localhost:5555) */
  endpoint?: string;
  /** ZMQ pub/sub endpoint for engine state events (default: endpoint port + 1; supply explicitly for non-TCP transports) */
  pubEndpoint?: string;
  /** Connection timeout in ms (default: 5000) */
  timeout?: number;
}

export type EngineStateListener = (snapshot: EngineStateSnapshot) => void;

interface EngineResponse {
  ok: boolean;
  message: string;
  payload: Buffer;
}

export class EngineClient {
  private socket: Request | null = null;
  private subscriber: Subscriber | null = null;
  private endpoint: string;
  private pubEndpoint: string;
  private timeout: number;
  private stateListeners = new Set<EngineStateListener>();
  private subscriptionLoop: Promise<void> | null = null;
  private subscriptionClosed = false;
  private subscriptionError: Error | null = null;
  private requestQueue: Promise<EngineResponse> = Promise.resolve({
    ok: true,
    message: '',
    payload: Buffer.alloc(0),
  });
  private disconnectPromise: Promise<void> | null = null;
  private verifiedCapabilities: EngineCapabilities | null = null;

  constructor(options: EngineClientOptions = {}) {
    this.endpoint = options.endpoint ?? 'tcp://localhost:5555';
    this.pubEndpoint = options.pubEndpoint ?? derivePubEndpoint(this.endpoint);
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Connect to the blue-engine process.
   */
  async connect(): Promise<void> {
    if (this.socket) {
      return; // Already connected
    }

    this.socket = new Request();
    this.socket.sendTimeout = this.timeout;
    this.socket.receiveTimeout = this.timeout;
    this.socket.linger = 0;
    this.socket.connect(this.endpoint);

    this.subscriber = new Subscriber();
    this.subscriber.linger = 0;
    this.subscriber.subscribe(ENGINE_STATE_TOPIC);
    this.subscriber.connect(this.pubEndpoint);
    this.subscriptionClosed = false;
    this.subscriptionError = null;
    this.verifiedCapabilities = null;
    this.subscriptionLoop = this.consumeStateEvents().catch((error: unknown) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      this.subscriptionError = normalizedError;

      if (!this.subscriptionClosed) {
        console.warn(`[EngineClient] engine.state subscriber failed: ${normalizedError.message}`);
      }
    });
  }

  /**
   * Disconnect from the engine.
   */
  async disconnect(destroyEngine = true): Promise<void> {
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    const disconnectPromise = this.performDisconnect(destroyEngine);
    this.disconnectPromise = disconnectPromise;
    try {
      await disconnectPromise;
    } finally {
      if (this.disconnectPromise === disconnectPromise) {
        this.disconnectPromise = null;
      }
    }
  }

  private async performDisconnect(destroyEngine: boolean): Promise<void> {
    this.subscriptionClosed = true;

    const subscriber = this.subscriber;
    this.subscriber = null;
    const subscriptionLoop = this.subscriptionLoop;
    this.subscriptionLoop = null;
    const socket = this.socket;

    if (subscriber) {
      try {
        subscriber.close();
      } catch {
        // The native socket may already be closed during process teardown.
      }
    }

    if (socket && destroyEngine) {
      try {
        await this.sendRaw(CMD_DESTROY_ENGINE);
      } catch {
        // The engine process may already be gone.
      }
    }

    this.socket = null;
    if (socket) {
      try {
        socket.close();
      } catch {
        // The native socket may already be closed during process teardown.
      }
    }

    // Closing the socket rejects any in-flight request and lets queued
    // requests observe the disconnected state. Wait for both to settle before
    // allowing the host process to tear down the native addon.
    try {
      await this.requestQueue;
    } catch {
      // sendRaw normalizes request failures, but keep teardown best-effort.
    }

    if (subscriptionLoop) {
      try {
        await subscriptionLoop;
      } catch {
        // consumeStateEvents suppresses expected close errors.
      }
    }

    this.subscriptionError = null;
    this.verifiedCapabilities = null;
  }

  async getCapabilities(): Promise<{
    ok: boolean;
    capabilities?: EngineCapabilities;
    message: string;
  }> {
    const response = await this.sendRaw(CMD_GET_CAPABILITIES);
    if (!response.ok) {
      return { ok: false, message: response.message };
    }
    try {
      const capabilities = decodeEngineCapabilitiesJson(response.message);
      return { ok: true, capabilities, message: '' };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Invalid engine capabilities',
      };
    }
  }

  /**
   * Send a raw command and parse the response.
   * Response format: [status: uint8][msg_len: uint32 LE][message: bytes]
   * All requests must use the 5-byte header format, even with no payload.
   */
  private async sendRaw(cmd: number, payload?: Buffer): Promise<EngineResponse> {
    return (this.requestQueue = this.requestQueue
      .then(async () => {
        if (!this.socket) {
          throw new Error('EngineClient not connected. Call connect() first.');
        }

        let data: Buffer;
        if (payload) {
          data = payload;
        } else {
          // Always use 5-byte header format, even for no-payload commands
          data = Buffer.alloc(5);
          data.writeUInt8(cmd, 0);
          data.writeUInt32LE(0, 1);
        }

        await this.socket.send(data);

        const [response] = await this.socket.receive();
        const respBuf = response as Buffer;

        if (respBuf.length < 5) {
          return { ok: false, message: 'Invalid response (too short)', payload: Buffer.alloc(0) };
        }

        const status = respBuf.readUInt8(0);
        const msgLen = respBuf.readUInt32LE(1);
        const message = respBuf.slice(5, 5 + msgLen).toString('utf-8');
        const rawPayload = respBuf.slice(5, 5 + msgLen);

        return { ok: status === STATUS_OK, message, payload: rawPayload };
      })
      .catch((error: unknown) => {
        // Ensure the queue remains functional even after an error
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          payload: Buffer.alloc(0),
        };
      }));
  }

  /**
   * Create the Csound engine instance.
   * Must be called before any other command.
   */
  async createEngine(): Promise<{ ok: boolean; message: string }> {
    if (!this.verifiedCapabilities) {
      const capabilityResult = await this.getCapabilities();
      if (!capabilityResult.ok || !capabilityResult.capabilities) {
        await this.disconnect(false);
        return {
          ok: false,
          message: `Engine capability handshake failed: ${capabilityResult.message}`,
        };
      }
      if (capabilityResult.capabilities.protocolVersion !== BLUE_ENGINE_PROTOCOL_VERSION) {
        const actualVersion = capabilityResult.capabilities.protocolVersion;
        await this.disconnect(false);
        return {
          ok: false,
          message:
            `Blue Engine protocol mismatch: expected ${BLUE_ENGINE_PROTOCOL_VERSION}, ` +
            `received ${actualVersion}`,
        };
      }
      if (!capabilityResult.capabilities.features.includes(AUTOMATION_DECIMAL_FEATURE)) {
        await this.disconnect(false);
        return {
          ok: false,
          message: `Blue Engine is missing required capability: ${AUTOMATION_DECIMAL_FEATURE}`,
        };
      }
      this.verifiedCapabilities = capabilityResult.capabilities;
    }

    // If engine already exists, destroy it first
    let resp = await this.sendRaw(CMD_CREATE_ENGINE);
    if (!resp.ok && resp.message.includes('Engine already created')) {
      await this.sendRaw(CMD_DESTROY_ENGINE);
      resp = await this.sendRaw(CMD_CREATE_ENGINE);
    }
    return resp;
  }

  /**
   * Destroy the engine instance.
   */
  async destroyEngine(): Promise<{ ok: boolean; message: string }> {
    return this.sendRaw(CMD_DESTROY_ENGINE);
  }

  /**
   * Set a Csound option (e.g., '-odac', '-d').
   */
  async setOption(option: string): Promise<{ ok: boolean; message: string }> {
    return this.sendCommand(CMD_SET_OPTION, option);
  }

  /**
   * Compile a Csound orchestra string.
   */
  async compileOrc(orchestra: string): Promise<{ ok: boolean; message: string }> {
    return this.sendCommand(CMD_COMPILE_ORC, orchestra);
  }

  /**
   * Submit a Csound score string.
   */
  async readScore(score: string): Promise<{ ok: boolean; message: string }> {
    return this.sendCommand(CMD_READ_SCORE, score);
  }

  /**
   * Start Csound performance.
   */
  async start(): Promise<{ ok: boolean; message: string }> {
    return this.sendRaw(CMD_START);
  }

  /**
   * Stop Csound performance.
   */
  async stop(): Promise<{ ok: boolean; message: string }> {
    return this.sendRaw(CMD_STOP);
  }

  async getEngineState(): Promise<{ ok: boolean; state?: EngineStateSnapshot; message: string }> {
    const resp = await this.sendRaw(CMD_GET_ENGINE_STATE);
    if (!resp.ok) {
      return { ok: false, message: resp.message };
    }

    return {
      ok: true,
      state: decodeEngineStatePayload(resp.payload),
      message: resp.message,
    };
  }

  onEngineState(listener: EngineStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Send a command with a string payload.
   */
  private async sendCommand(
    cmd: number,
    payload: string,
  ): Promise<{ ok: boolean; message: string }> {
    const payloadBuf = Buffer.from(payload, 'utf-8');
    const buf = Buffer.alloc(5 + payloadBuf.length);
    buf.writeUInt8(cmd, 0);
    buf.writeUInt32LE(payloadBuf.length, 1);
    payloadBuf.copy(buf, 5);
    return this.sendRaw(cmd, buf);
  }

  /**
   * Create a named channel with an initial value.
   */
  async createChannel(
    name: string,
    initialValue: number,
  ): Promise<{ ok: boolean; message: string }> {
    const nameBuf = Buffer.from(name + '\0', 'utf-8');
    const valueBuf = Buffer.alloc(8);
    valueBuf.writeDoubleLE(initialValue, 0);
    const payload = Buffer.concat([nameBuf, valueBuf]);

    const cmdBuf = Buffer.alloc(5 + payload.length);
    cmdBuf.writeUInt8(CMD_CREATE_CHANNEL, 0);
    cmdBuf.writeUInt32LE(payload.length, 1);
    payload.copy(cmdBuf, 5);

    return this.sendRaw(CMD_CREATE_CHANNEL, cmdBuf);
  }

  /**
   * Set a channel value.
   */
  async setChannel(name: string, value: number): Promise<{ ok: boolean; message: string }> {
    if (!this.socket) {
      throw new Error('EngineClient not connected.');
    }
    const data = encodeSetChannel(name, value);
    return this.sendRaw(CMD_SET_CHANNEL, data);
  }

  /**
   * Get a channel value.
   */
  async getChannel(name: string): Promise<{ ok: boolean; value: number }> {
    if (!this.socket) {
      throw new Error('EngineClient not connected.');
    }
    const data = encodeGetChannel(name);
    const resp = await this.sendRaw(CMD_GET_CHANNEL, data);
    // Use raw payload buffer (not UTF-8 message) to avoid binary corruption
    if (resp.ok && resp.payload.length >= 8) {
      return { ok: true, value: resp.payload.readDoubleLE(0) };
    }
    return { ok: false, value: 0 };
  }

  /**
   * Get the shared memory region name.
   */
  async getShmName(): Promise<{ ok: boolean; message: string }> {
    return this.sendRaw(CMD_GET_SHM_NAME);
  }

  /**
   * The batch-channel capability must be accepted by the handshake before
   * any batch command is sent; an older engine yields an explicit
   * unsupported-runtime diagnostic instead of a silent fallback.
   */
  private batchChannelsGuard(): { ok: true } | { ok: false; message: string } {
    if (!this.verifiedCapabilities) {
      return { ok: false, message: 'Batch channels require a completed capability handshake' };
    }
    if (!hasEngineFeature(this.verifiedCapabilities, BATCH_CHANNELS_FEATURE)) {
      return {
        ok: false,
        message: `Blue Engine is missing required capability: ${BATCH_CHANNELS_FEATURE}`,
      };
    }
    return { ok: true };
  }

  /**
   * Set multiple channels in one all-or-error round trip.
   * The engine validates the entire payload before applying any write.
   */
  async setChannels(
    entries: readonly BatchChannelEntry[],
  ): Promise<{ ok: boolean; message: string }> {
    if (!this.socket) {
      throw new Error('EngineClient not connected.');
    }
    const guard = this.batchChannelsGuard();
    if (!guard.ok) {
      return guard;
    }
    const data = encodeSetChannels(entries);
    return this.sendRaw(CMD_BATCH_SET_CHANNELS, data);
  }

  /**
   * Get multiple channel values in request order. Missing channels return
   * an error result with no partial value list.
   */
  async getChannels(
    names: readonly string[],
  ): Promise<{ ok: true; values: number[] } | { ok: false; message: string }> {
    if (!this.socket) {
      throw new Error('EngineClient not connected.');
    }
    const guard = this.batchChannelsGuard();
    if (!guard.ok) {
      return guard;
    }
    const data = encodeGetChannels(names);
    const resp = await this.sendRaw(CMD_BATCH_GET_CHANNELS, data);
    if (!resp.ok) {
      return { ok: false, message: resp.message };
    }
    try {
      return { ok: true, values: decodeBatchChannelValues(resp.payload) };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ─── Automation Commands ───

  /**
   * Create an automation definition on the engine.
   * The engine will interpolate values and write to the named channel per k-cycle.
   */
  async createAutomation(
    name: string,
    curve: AutomationCurveCode,
    enabled: boolean,
    resolutionDecimal: string,
    points: AutomationPoint[],
  ): Promise<{ ok: boolean; message: string }> {
    const data = encodeCreateAutomation(name, curve, enabled, resolutionDecimal, points);
    return this.sendRaw(CMD_CREATE_AUTOMATION, data);
  }

  /**
   * Update an existing automation definition.
   * Same payload format as createAutomation.
   */
  async updateAutomation(
    name: string,
    curve: AutomationCurveCode,
    enabled: boolean,
    resolutionDecimal: string,
    points: AutomationPoint[],
  ): Promise<{ ok: boolean; message: string }> {
    const data = encodeUpdateAutomation(name, curve, enabled, resolutionDecimal, points);
    return this.sendRaw(CMD_UPDATE_AUTOMATION, data);
  }

  /**
   * Delete an automation definition by channel name.
   */
  async deleteAutomation(name: string): Promise<{ ok: boolean; message: string }> {
    const data = encodeNameCommand(CMD_DELETE_AUTOMATION, name);
    return this.sendRaw(CMD_DELETE_AUTOMATION, data);
  }

  /**
   * Enable an automation definition.
   */
  async enableAutomation(name: string): Promise<{ ok: boolean; message: string }> {
    const data = encodeNameCommand(CMD_ENABLE_AUTOMATION, name);
    return this.sendRaw(CMD_ENABLE_AUTOMATION, data);
  }

  /**
   * Disable an automation definition.
   */
  async disableAutomation(name: string): Promise<{ ok: boolean; message: string }> {
    const data = encodeNameCommand(CMD_DISABLE_AUTOMATION, name);
    return this.sendRaw(CMD_DISABLE_AUTOMATION, data);
  }

  /**
   * List all current automation definitions.
   */
  async listAutomations(): Promise<{ ok: boolean; entries: AutomationListEntry[] }> {
    const data = encodeNoPayloadCommand(CMD_LIST_AUTOMATION);
    const resp = await this.sendRaw(CMD_LIST_AUTOMATION, data);
    if (resp.ok) {
      const entries = decodeAutomationList(resp.payload);
      return { ok: true, entries };
    }
    return { ok: false, entries: [] };
  }

  /**
   * Clear all automation definitions.
   */
  async clearAutomations(): Promise<{ ok: boolean; message: string }> {
    const data = encodeNoPayloadCommand(CMD_CLEAR_AUTOMATION);
    return this.sendRaw(CMD_CLEAR_AUTOMATION, data);
  }

  private async consumeStateEvents(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    try {
      for await (const message of this.subscriber) {
        if (this.subscriptionClosed) {
          return;
        }

        const [topicFrame, payloadFrame] = message as Buffer[];
        if (!topicFrame || !payloadFrame) {
          continue;
        }

        const topic = topicFrame.toString('utf-8');
        if (topic !== ENGINE_STATE_TOPIC) {
          continue;
        }

        const snapshot = decodeEngineStatePayload(payloadFrame);
        for (const listener of this.stateListeners) {
          try {
            listener(snapshot);
          } catch (error: unknown) {
            console.warn(
              `[EngineClient] engine.state listener failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    } catch (error) {
      if (!this.subscriptionClosed) {
        throw error;
      }
    }
  }
}

function derivePubEndpoint(endpoint: string): string {
  const match = endpoint.match(/^(tcp:\/\/[^:]+:)(\d+)$/);
  if (!match) {
    throw new Error(`Cannot derive pub endpoint from unsupported endpoint: ${endpoint}`);
  }

  const port = Number(match[2]);
  if (!Number.isFinite(port)) {
    throw new Error(`Cannot derive pub endpoint from endpoint: ${endpoint}`);
  }

  return `${match[1]}${port + 1}`;
}
