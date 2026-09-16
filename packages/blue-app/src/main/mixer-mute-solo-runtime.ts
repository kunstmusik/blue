import type { CompiledMixerGateBindings } from '@blue/data';
import type { PerformanceKind } from './project-runtime-reconciliation';

/**
 * Engine transport used for staged mixer gate publication. Satisfied by the
 * EngineBridge/BlueLiveEngine batch channel APIs and by test doubles.
 */
export interface MixerGateEngineIO {
  setChannels(entries: readonly { name: string; value: number }[]): Promise<{
    ok: boolean;
    message: string;
  }>;
  getChannels(
    names: readonly string[],
  ): Promise<{ ok: true; values: number[] } | { ok: false; message: string }>;
}

export interface MixerGatePublicationResult {
  readonly ok: boolean;
  readonly message?: string;
  /** The commit token that was published, when staging succeeded. */
  readonly commitToken?: number;
  /** True when the commit was published but its applied echo is still unobserved. */
  readonly unconfirmed?: boolean;
}

interface MixerGatePerformanceState {
  catalog: CompiledMixerGateBindings | null;
  /**
   * Last commit token known to be selected by the engine (initial 0 matches
   * the CSD-initialized banks). The audible bank is `commitToken % 2`.
   */
  commitToken: number;
  /**
   * A token that was published but whose applied echo has not been observed.
   * The inactive bank must not be reused until it settles.
   */
  pendingToken: number | null;
}

export interface MixerGatePublisherOptions {
  /** Engine batch bound; the native mailbox accepts at most 256 entries. */
  maxBatchEntries?: number;
  /** Bounded retries for queue-full style rejections while the edit is current. */
  stageRetryLimit?: number;
  stageRetryDelayMs?: number;
  /** Bounded observation attempts for the applied token echo. */
  observeAttempts?: number;
  observeDelayMs?: number;
}

const DEFAULT_MAX_BATCH_ENTRIES = 256;
const DEFAULT_STAGE_RETRY_LIMIT = 3;
const DEFAULT_STAGE_RETRY_DELAY_MS = 10;
const DEFAULT_OBSERVE_ATTEMPTS = 8;
const DEFAULT_OBSERVE_DELAY_MS = 10;

const RETRYABLE_MESSAGES = new Set(['engine-batch-queue-full', 'engine-batch-busy']);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serialized per-performance publication of complete mixer gate vectors.
 *
 * Protocol (Spec 111): stage the full desired vector into the inactive bank
 * in bounded batches, publish one monotonically increasing commit token, and
 * wait for the engine's applied echo before acknowledging audible
 * application or reusing the bank. Failures leave the previously audible
 * bank untouched; the caller reports the runtime outcome and reconciles.
 */
export class MixerGatePublisher {
  private readonly io: MixerGateEngineIO;
  private readonly states = new Map<PerformanceKind, MixerGatePerformanceState>();
  private readonly maxBatchEntries: number;
  private readonly stageRetryLimit: number;
  private readonly stageRetryDelayMs: number;
  private readonly observeAttempts: number;
  private readonly observeDelayMs: number;

  constructor(io: MixerGateEngineIO, options: MixerGatePublisherOptions = {}) {
    this.io = io;
    this.maxBatchEntries = options.maxBatchEntries ?? DEFAULT_MAX_BATCH_ENTRIES;
    this.stageRetryLimit = options.stageRetryLimit ?? DEFAULT_STAGE_RETRY_LIMIT;
    this.stageRetryDelayMs = options.stageRetryDelayMs ?? DEFAULT_STAGE_RETRY_DELAY_MS;
    this.observeAttempts = options.observeAttempts ?? DEFAULT_OBSERVE_ATTEMPTS;
    this.observeDelayMs = options.observeDelayMs ?? DEFAULT_OBSERVE_DELAY_MS;
  }

  /** Installs the generation's compiled catalog; resets token state. */
  setBindings(kind: PerformanceKind, catalog: CompiledMixerGateBindings | null): void {
    this.states.set(kind, { catalog, commitToken: 0, pendingToken: null });
  }

  /** Clears state when the performance stops. */
  reset(kind: PerformanceKind): void {
    this.states.delete(kind);
  }

  getCommitToken(kind: PerformanceKind): number | null {
    return this.states.get(kind)?.commitToken ?? null;
  }

  /**
   * Publishes the complete desired gate vector for one performance. Values
   * are ordered by catalog gate ordinal; the signature must match the
   * compiled topology or the request is rejected as stale.
   */
  async publish(
    kind: PerformanceKind,
    signature: string,
    values: readonly number[],
  ): Promise<MixerGatePublicationResult> {
    const state = this.states.get(kind);
    if (!state?.catalog) {
      return { ok: false, message: 'gate-bindings-unavailable' };
    }
    if (state.catalog.signature !== signature) {
      return { ok: false, message: 'gate-topology-changed' };
    }
    if (values.length !== state.catalog.gates.length) {
      return {
        ok: false,
        message: `gate-vector-length-mismatch: expected ${state.catalog.gates.length}, got ${values.length}`,
      };
    }

    // Settle a previous unconfirmed commit before reusing any bank.
    if (state.pendingToken !== null) {
      const settled = await this.observeApplied(state, state.pendingToken);
      if (!settled) {
        return {
          ok: false,
          message: 'gate-commit-unconfirmed',
          commitToken: state.pendingToken,
          unconfirmed: true,
        };
      }
      state.pendingToken = null;
    }

    const targetBank = (state.commitToken + 1) % 2;
    const staged = await this.stageVector(state, targetBank, values);
    if (!staged.ok) {
      // The inactive bank may be partially staged; the active bank still
      // carries the previous complete vector, so audio is unchanged.
      return { ok: false, message: staged.message };
    }

    const commitToken = state.commitToken + 1;
    const commitWrite = await this.writeWithRetry([
      { name: state.catalog.commitChannel, value: commitToken },
    ]);
    if (!commitWrite.ok) {
      return { ok: false, message: commitWrite.message };
    }

    // The commit write succeeded, so the engine will select the staged bank.
    // From this point the token is authoritative even if the applied echo is
    // not yet observable; only bank reuse waits on the echo.
    const observed = await this.observeApplied(state, commitToken);
    state.commitToken = commitToken;
    if (!observed) {
      state.pendingToken = commitToken;
      return { ok: false, message: 'gate-commit-unconfirmed', commitToken, unconfirmed: true };
    }
    return { ok: true, commitToken };
  }

  private async stageVector(
    state: MixerGatePerformanceState,
    bank: number,
    values: readonly number[],
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const catalog = state.catalog!;
    const entries = catalog.gates.map((gate, index) => ({
      name: gate.bankSymbols[bank],
      value: values[index],
    }));

    for (let offset = 0; offset < entries.length; offset += this.maxBatchEntries) {
      const batch = entries.slice(offset, offset + this.maxBatchEntries);
      const result = await this.writeWithRetry(batch);
      if (!result.ok) {
        return { ok: false, message: result.message };
      }
    }
    return { ok: true };
  }

  private async writeWithRetry(
    entries: readonly { name: string; value: number }[],
  ): Promise<{ ok: boolean; message: string }> {
    let message = 'engine-write-failed';
    for (let attempt = 0; attempt <= this.stageRetryLimit; attempt++) {
      if (attempt > 0) {
        await delay(this.stageRetryDelayMs);
      }
      const result = await this.io.setChannels(entries);
      if (result.ok) {
        return result;
      }
      message = result.message;
      if (!RETRYABLE_MESSAGES.has(message)) {
        return result;
      }
    }
    return { ok: false, message };
  }

  private async observeApplied(state: MixerGatePerformanceState, token: number): Promise<boolean> {
    for (let attempt = 0; attempt < this.observeAttempts; attempt++) {
      if (attempt > 0) {
        await delay(this.observeDelayMs);
      }
      const read = await this.io.getChannels([state.catalog!.appliedChannel]);
      if (read.ok && read.values[0] === token) {
        return true;
      }
    }
    return false;
  }
}
