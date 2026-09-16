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

export interface MixerGateBindingOptions {
  /** Performance generation that owns this compiled catalog and transport. */
  readonly generation?: number;
  /** Exact engine client captured for this generation. */
  readonly io?: MixerGateEngineIO;
}

interface MixerGatePerformanceState {
  catalog: CompiledMixerGateBindings | null;
  io: MixerGateEngineIO;
  generation?: number;
  valid: boolean;
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
  setBindings(
    kind: PerformanceKind,
    catalog: CompiledMixerGateBindings | null,
    options: MixerGateBindingOptions = {},
  ): void {
    const previous = this.states.get(kind);
    if (previous) previous.valid = false;
    this.states.set(kind, {
      catalog,
      io: options.io ?? this.io,
      generation: options.generation,
      valid: true,
      commitToken: 0,
      pendingToken: null,
    });
  }

  /** Clears state when the performance stops. */
  reset(kind: PerformanceKind): void {
    const state = this.states.get(kind);
    if (state) state.valid = false;
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
    expectedGeneration?: number,
  ): Promise<MixerGatePublicationResult> {
    const state = this.states.get(kind);
    if (!state?.catalog || !this.isCurrent(kind, state, expectedGeneration)) {
      if (state && expectedGeneration !== undefined && state.generation !== expectedGeneration) {
        return this.staleResult();
      }
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
      const pendingToken = state.pendingToken;
      const settled = await this.observeApplied(kind, state, pendingToken, expectedGeneration);
      if (settled.stale) return this.staleResult();
      if (!settled.observed) {
        return {
          ok: false,
          message: 'gate-commit-unconfirmed',
          commitToken: pendingToken,
          unconfirmed: true,
        };
      }
      if (!this.isCurrent(kind, state, expectedGeneration)) return this.staleResult();
      state.commitToken = pendingToken;
      state.pendingToken = null;
    }

    const targetBank = (state.commitToken + 1) % 2;
    const staged = await this.stageVector(kind, state, targetBank, values, expectedGeneration);
    if (!staged.ok) {
      // The inactive bank may be partially staged; the active bank still
      // carries the previous complete vector, so audio is unchanged.
      return staged.stale ? this.staleResult() : { ok: false, message: staged.message };
    }

    const commitToken = state.commitToken + 1;
    if (!this.isCurrent(kind, state, expectedGeneration)) return this.staleResult();

    // Keep the attempted token before awaiting transport. A rejected request
    // is definite and clears this marker; a thrown/uncertain request keeps it
    // so the next publication can recover by readback before reusing a bank.
    state.pendingToken = commitToken;
    const commitWrite = await this.writeWithRetry(
      kind,
      state,
      [{ name: state.catalog.commitChannel, value: commitToken }],
      expectedGeneration,
      true,
    );
    if (commitWrite.stale) return this.staleResult();
    if (!commitWrite.ok) {
      if (!commitWrite.uncertain && this.isCurrent(kind, state, expectedGeneration)) {
        state.pendingToken = null;
      }
      if (commitWrite.uncertain) {
        return {
          ok: false,
          message: 'gate-commit-unconfirmed',
          commitToken,
          unconfirmed: true,
        };
      }
      return { ok: false, message: commitWrite.message };
    }

    const observed = await this.observeApplied(kind, state, commitToken, expectedGeneration);
    if (observed.stale) return this.staleResult();
    if (!observed.observed) {
      return { ok: false, message: 'gate-commit-unconfirmed', commitToken, unconfirmed: true };
    }
    if (!this.isCurrent(kind, state, expectedGeneration)) return this.staleResult();
    state.commitToken = commitToken;
    state.pendingToken = null;
    return { ok: true, commitToken };
  }

  private async stageVector(
    kind: PerformanceKind,
    state: MixerGatePerformanceState,
    bank: number,
    values: readonly number[],
    expectedGeneration?: number,
  ): Promise<{ ok: true } | { ok: false; message: string; stale?: boolean }> {
    const catalog = state.catalog!;
    const entries = catalog.gates.map((gate, index) => ({
      name: gate.bankSymbols[bank],
      value: values[index],
    }));

    for (let offset = 0; offset < entries.length; offset += this.maxBatchEntries) {
      const batch = entries.slice(offset, offset + this.maxBatchEntries);
      const result = await this.writeWithRetry(kind, state, batch, expectedGeneration);
      if (!result.ok) {
        return { ok: false, message: result.message, stale: result.stale };
      }
    }
    return { ok: true };
  }

  private async writeWithRetry(
    kind: PerformanceKind,
    state: MixerGatePerformanceState,
    entries: readonly { name: string; value: number }[],
    expectedGeneration?: number,
    uncertainOnError = false,
  ): Promise<{ ok: boolean; message: string; uncertain?: boolean; stale?: boolean }> {
    let message = 'engine-write-failed';
    for (let attempt = 0; attempt <= this.stageRetryLimit; attempt++) {
      if (attempt > 0) {
        await delay(this.stageRetryDelayMs);
        if (!this.isCurrent(kind, state, expectedGeneration)) {
          return { ok: false, message: 'gate-publication-stale', stale: true };
        }
      }
      if (!this.isCurrent(kind, state, expectedGeneration)) {
        return { ok: false, message: 'gate-publication-stale', stale: true };
      }
      let result: { ok: boolean; message: string };
      try {
        result = await state.io.setChannels(entries);
      } catch (error: unknown) {
        if (!this.isCurrent(kind, state, expectedGeneration)) {
          return { ok: false, message: 'gate-publication-stale', stale: true };
        }
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          uncertain: uncertainOnError,
        };
      }
      if (!this.isCurrent(kind, state, expectedGeneration)) {
        return { ok: false, message: 'gate-publication-stale', stale: true };
      }
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

  private async observeApplied(
    kind: PerformanceKind,
    state: MixerGatePerformanceState,
    token: number,
    expectedGeneration?: number,
  ): Promise<{ observed: boolean; stale: boolean }> {
    for (let attempt = 0; attempt < this.observeAttempts; attempt++) {
      if (attempt > 0) {
        await delay(this.observeDelayMs);
        if (!this.isCurrent(kind, state, expectedGeneration)) {
          return { observed: false, stale: true };
        }
      }
      if (!this.isCurrent(kind, state, expectedGeneration)) {
        return { observed: false, stale: true };
      }
      let read: { ok: true; values: number[] } | { ok: false; message: string };
      try {
        read = await state.io.getChannels([state.catalog!.appliedChannel]);
      } catch {
        if (!this.isCurrent(kind, state, expectedGeneration)) {
          return { observed: false, stale: true };
        }
        continue;
      }
      if (!this.isCurrent(kind, state, expectedGeneration)) {
        return { observed: false, stale: true };
      }
      if (read.ok && read.values[0] === token) {
        return { observed: true, stale: false };
      }
    }
    return { observed: false, stale: false };
  }

  private isCurrent(
    kind: PerformanceKind,
    state: MixerGatePerformanceState,
    expectedGeneration?: number,
  ): boolean {
    return (
      state.valid &&
      this.states.get(kind) === state &&
      (state.generation === undefined
        ? expectedGeneration === undefined
        : state.generation === expectedGeneration)
    );
  }

  private staleResult(): MixerGatePublicationResult {
    return { ok: false, message: 'gate-publication-stale' };
  }
}
