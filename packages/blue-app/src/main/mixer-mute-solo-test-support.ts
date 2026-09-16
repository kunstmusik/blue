import type { CompiledMixerGateBindings } from '@blue/data';
import type { MixerGateEngineIO } from './mixer-mute-solo-runtime';

export const TEST_GATE_SIGNATURE = 'test-topology|2-gates';

/**
 * Builds a small deterministic gate catalog for tests: two gates with
 * bank channels `gk_blue_mixgate_{n}_{0|1}`.
 */
export function createTestGateCatalog(
  gateCount = 2,
  signature = TEST_GATE_SIGNATURE,
): CompiledMixerGateBindings {
  return {
    signature,
    commitChannel: 'gk_blue_mixgate_commit',
    appliedChannel: 'gk_blue_mixgate_applied',
    gates: Array.from({ length: gateCount }, (_, ordinal) => ({
      ordinal,
      bankSymbols: [`gk_blue_mixgate_${ordinal}_0`, `gk_blue_mixgate_${ordinal}_1`] as const,
      initial: 1 as const,
      locator: {
        route: 'output' as const,
        channelOrdinal: ordinal,
        channelKind: 'source' as const,
        association: '',
      },
    })),
  };
}

export type FakeGateFailureMode =
  | 'none'
  | 'missing-capability'
  | 'queue-full-once'
  | 'queue-full-always'
  | 'stage-failure'
  | 'commit-write-failure'
  | 'applied-echo-delayed'
  | 'applied-echo-never';

/**
 * In-memory engine double for mixer gate publication tests. Records every
 * batched write and read and exposes knobs for each failure shape the
 * publication contract must handle.
 */
export class FakeMixerGateEngine implements MixerGateEngineIO {
  readonly writes: Array<ReadonlyArray<{ name: string; value: number }>> = [];
  readonly reads: ReadonlyArray<string>[] = [];
  failureMode: FakeGateFailureMode = 'none';
  /** What reads of the applied channel currently return. */
  appliedToken = 0;
  /** Engine-side commit truth the applied echo lags behind when delayed. */
  private committedToken = 0;
  /** Reads remaining before the delayed echo catches up. */
  echoDelayRemaining = 0;

  reset(): void {
    this.writes.length = 0;
    this.reads.length = 0;
    this.failureMode = 'none';
    this.appliedToken = 0;
    this.committedToken = 0;
    this.echoDelayRemaining = 0;
  }

  /** Bank values as actually stored engine-side, keyed by channel name. */
  private readonly bankValues = new Map<string, number>();

  getBankValue(name: string): number | undefined {
    return this.bankValues.get(name);
  }

  async setChannels(
    entries: readonly { name: string; value: number }[],
  ): Promise<{ ok: boolean; message: string }> {
    this.writes.push([...entries]);

    if (this.failureMode === 'missing-capability') {
      return {
        ok: false,
        message: 'Blue Engine is missing required capability: batch-channels-v1',
      };
    }
    if (
      this.failureMode === 'queue-full-once' ||
      this.failureMode === 'queue-full-always' ||
      this.failureMode === 'stage-failure'
    ) {
      if (this.failureMode === 'queue-full-once') {
        this.failureMode = 'none';
        return { ok: false, message: 'engine-batch-queue-full' };
      }
      return {
        ok: false,
        message:
          this.failureMode === 'stage-failure'
            ? 'engine-batch-rejected'
            : 'engine-batch-queue-full',
      };
    }

    const isCommitWrite = entries.length === 1 && entries[0].name === 'gk_blue_mixgate_commit';
    if (isCommitWrite && this.failureMode === 'commit-write-failure') {
      return { ok: false, message: 'engine-batch-rejected' };
    }

    for (const entry of entries) {
      this.bankValues.set(entry.name, entry.value);
      if (entry.name === 'gk_blue_mixgate_commit') {
        if (this.failureMode === 'applied-echo-delayed') {
          // The mailbox selects the commit between control cycles; the echo
          // only becomes readable after that many reads.
          this.committedToken = entry.value;
          this.echoDelayRemaining = Math.max(this.echoDelayRemaining, 1);
        } else if (this.failureMode !== 'applied-echo-never') {
          this.appliedToken = entry.value;
        }
      }
    }
    return { ok: true, message: 'ok' };
  }

  async getChannels(
    names: readonly string[],
  ): Promise<{ ok: true; values: number[] } | { ok: false; message: string }> {
    this.reads.push([...names]);
    if (this.failureMode === 'missing-capability') {
      return {
        ok: false,
        message: 'Blue Engine is missing required capability: batch-channels-v1',
      };
    }
    const values = names.map((name) => {
      if (name === 'gk_blue_mixgate_applied') {
        if (this.failureMode === 'applied-echo-delayed') {
          if (this.echoDelayRemaining > 0) {
            this.echoDelayRemaining -= 1;
            return this.appliedToken;
          }
          // The delayed echo lands once the countdown reaches zero.
          this.appliedToken = this.committedToken;
        }
        return this.appliedToken;
      }
      return this.bankValues.get(name) ?? 0;
    });
    return { ok: true, values };
  }
}
