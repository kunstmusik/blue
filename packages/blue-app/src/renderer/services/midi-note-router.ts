/**
 * Common renderer MIDI note router (SPEC 058, extended by SPEC 067).
 *
 * Single ingress point shared by hardware (via the Web MIDI service) and the
 * Virtual Keyboard. Normalizes note-on velocity zero to note-off, validates
 * ranges, maintains a source-scoped held-note ledger with target-aware aggregate
 * reference counts, and forwards accepted notes through the existing Blue Live
 * trigger IPC. Operations are serialized so a note-off cannot overtake its
 * note-on.
 *
 * Spec 067 target-aware changes:
 * - The aggregate ledger is keyed by `(target identity, midiNote)` rather than
 *   `(channel, midiNote)`, so equal channel/pitch routed to different targets
 *   remain independent.
 * - A successful note-on retains its resolved target and Blue Live session id on
 *   the held record; note-off uses that stored target/session and never consults
 *   current focus or the current engine generation.
 * - Target-resolution and trigger failures return `{ accepted: false }` so the
 *   router creates no held state; callers must never retry against another target.
 */

import {
  isValidMidiChannel,
  isValidMidiNote,
  isValidMidiVelocity,
  blueLiveTargetIdentityKey,
  blueLiveTargetKey,
  type MidiNoteEvent,
  type MidiNoteRouteResult,
} from '../../shared/midi-input';
import type { BlueLiveNoteTarget } from '../../shared/project-editor';

interface HeldNote {
  sourceId: string;
  sourceKind: MidiNoteEvent['sourceKind'];
  deviceId: string | null;
  channel: number;
  midiNote: number;
  velocity: number;
  /** Target captured at note-on; note-off returns to this target. */
  target: BlueLiveNoteTarget;
  /** Identity-only portion of the target key, for aggregate bookkeeping. */
  targetIdentityKey: string;
  /** Blue Live session id captured at note-on; note-off never substitutes it. */
  liveSessionId: number;
}

export type BlueLiveTriggerFn = (
  request: {
    type: 'noteOn' | 'noteOff';
    midiNote: number;
    velocity: number;
    channel: number;
    source: 'mouse' | 'computer' | 'hardware';
    sourceId?: string;
    deviceId?: string;
    timestamp?: number;
    /** Spec 067 optional focus-routing target. */
    target?: BlueLiveNoteTarget;
    /** Spec 067 optional Blue Live session fence. */
    liveSessionId?: number;
  },
) => Promise<{ ok: boolean; message?: string }>;

export type BlueLiveAllNotesOffFn = () => Promise<{ ok: boolean; message?: string }>;

/**
 * Resolves the routing target and current Blue Live session id for a new note-on.
 * Returns `null` to fail closed (no fallback target). The router creates no held
 * state when resolution fails.
 */
export type MidiTargetResolver = (
  channel: number,
) => { target: BlueLiveNoteTarget; liveSessionId: number } | null;

export interface MidiNoteRouterDeps {
  trigger: BlueLiveTriggerFn;
  allNotesOff?: BlueLiveAllNotesOffFn;
  /** Returns true when Blue Live is running and a project is loaded. */
  isLiveActive: () => boolean;
  /**
   * Spec 067: resolves the target + Blue Live session id at note-on. When omitted
   * the router falls back to direct-channel routing on the event channel, matching
   * the pre-Spec-067 behavior used by existing callers during migration.
   */
  resolveTarget?: MidiTargetResolver;
}

const HELD_KEY_SEPARATOR = '|';

function sourceKey(sourceId: string, channel: number, midiNote: number): string {
  return `${sourceId}${HELD_KEY_SEPARATOR}${channel}${HELD_KEY_SEPARATOR}${midiNote}`;
}

export class MidiNoteRouter {
  private deps: MidiNoteRouterDeps;
  private heldBySource = new Map<string, HeldNote>();
  private aggregateCount = new Map<string, number>();
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(deps: MidiNoteRouterDeps) {
    this.deps = deps;
  }

  routeNote(input: MidiNoteEvent): Promise<MidiNoteRouteResult> {
    return this.enqueue(() => this.routeNoteNow(input));
  }

  private async routeNoteNow(input: MidiNoteEvent): Promise<MidiNoteRouteResult> {
    // Validate ranges.
    if (!isValidMidiChannel(input.channel)) {
      return { accepted: false, message: 'Invalid MIDI channel' };
    }
    if (!isValidMidiNote(input.midiNote)) {
      return { accepted: false, message: 'Invalid MIDI note' };
    }
    if (!isValidMidiVelocity(input.velocity)) {
      return { accepted: false, message: 'Invalid MIDI velocity' };
    }

    // Normalize note-on velocity-zero to note-off.
    const event: MidiNoteEvent = {
      ...input,
      type: input.type === 'noteOn' && input.velocity === 0 && input.sourceKind === 'hardware'
        ? 'noteOff'
        : input.type,
    };

    if (!this.deps.isLiveActive()) {
      return { accepted: false, message: 'Blue Live is not running' };
    }

    const sKey = sourceKey(event.sourceId, event.channel, event.midiNote);

    if (event.type === 'noteOn') {
      // Idempotent: a repeated note-on for the same source key is a no-op
      // (avoids double-submission to Blue Live).
      if (this.heldBySource.has(sKey)) {
        return { accepted: true };
      }

      // Resolve target + session only for a new note-on. A matching note-off uses
      // the target stored on the held source record. Resolution failure is a silent
      // typed failure: no held state, no fallback target.
      const resolved = this.resolveTargetForNoteOn(event.channel);
      if (!resolved) {
        return { accepted: false, message: 'No resolved MIDI target' };
      }
      const { target, liveSessionId } = resolved;
      const targetIdentity = blueLiveTargetIdentityKey(target);
      const aKey = blueLiveTargetKey(target, event.midiNote);

      const existingAggregateCount = this.aggregateCount.get(aKey) ?? 0;
      if (existingAggregateCount === 0) {
        const triggerRequest = toTriggerRequest(event, target, liveSessionId);
        const triggerResult = await this.deps.trigger(triggerRequest);
        if (!triggerResult.ok) {
          // Failed/unmapped/stopped note-ons do not create cleanup debt.
          return { accepted: false, message: triggerResult.message };
        }
      }

      const held: HeldNote = {
        sourceId: event.sourceId,
        sourceKind: event.sourceKind,
        deviceId: event.deviceId,
        channel: event.channel,
        midiNote: event.midiNote,
        velocity: event.velocity,
        target,
        targetIdentityKey: targetIdentity,
        liveSessionId,
      };
      this.heldBySource.set(sKey, held);
      this.aggregateCount.set(aKey, existingAggregateCount + 1);

      return { accepted: true };
    }

    // noteOff — use the stored target and session; never consult current focus/mode.
    const existing = this.heldBySource.get(sKey);
    if (!existing) {
      // Idempotent release: ignore unknown source key.
      return { accepted: true };
    }
    this.heldBySource.delete(sKey);
    const aKey = blueLiveTargetKey(existing.target, existing.midiNote);
    const remaining = (this.aggregateCount.get(aKey) ?? 0) - 1;
    if (remaining <= 0) {
      this.aggregateCount.delete(aKey);
      // Final aggregate note-off — send to Blue Live using the stored target/session.
      const offResult = await this.deps.trigger({
        type: 'noteOff',
        midiNote: existing.midiNote,
        velocity: event.velocity,
        channel: existing.channel,
        source: event.sourceKind,
        sourceId: event.sourceId,
        deviceId: event.deviceId ?? undefined,
        timestamp: event.timestamp,
        target: existing.target,
        liveSessionId: existing.liveSessionId,
      });
      if (!offResult.ok) {
        return { accepted: false, message: offResult.message };
      }
    } else {
      this.aggregateCount.set(aKey, remaining);
    }
    return { accepted: true };
  }

  private resolveTargetForNoteOn(
    channel: number,
  ): { target: BlueLiveNoteTarget; liveSessionId: number } | null {
    if (this.deps.resolveTarget) {
      return this.deps.resolveTarget(channel);
    }
    // Migration fallback: direct-channel routing on the event channel.
    return { target: { kind: 'channel', channel }, liveSessionId: 0 };
  }

  /**
   * Release all held notes for a source (used on disconnect/disable/project
   * change/exit). Idempotent. Releases each affected source note to its stored
   * target so a focus/mode change between note-on and release cannot misroute it.
   */
  releaseSource(sourceId: string): Promise<void> {
    return this.enqueue(() => this.releaseSourceNow(sourceId));
  }

  private async releaseSourceNow(sourceId: string): Promise<void> {
    const toRelease: HeldNote[] = [];
    for (const [key, held] of this.heldBySource) {
      if (held.sourceId === sourceId) {
        toRelease.push(held);
        this.heldBySource.delete(key);
      }
    }
    if (toRelease.length === 0) return;
    // Recompute aggregate counts from remaining held notes (keyed by target+pitch).
    const counts = new Map<string, number>();
    for (const held of this.heldBySource.values()) {
      const k = blueLiveTargetKey(held.target, held.midiNote);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    this.aggregateCount = counts;
    const finalReleases = new Map<string, HeldNote>();
    for (const held of toRelease) {
      const aKey = blueLiveTargetKey(held.target, held.midiNote);
      const remaining = counts.get(aKey) ?? 0;
      if (remaining <= 0 && !finalReleases.has(aKey)) {
        finalReleases.set(aKey, held);
      }
    }
    for (const held of finalReleases.values()) {
      const off = await this.deps.trigger({
        type: 'noteOff',
        midiNote: held.midiNote,
        velocity: held.velocity,
        channel: held.channel,
        source: held.sourceKind,
        sourceId,
        deviceId: held.deviceId ?? undefined,
        target: held.target,
        liveSessionId: held.liveSessionId,
      });
      if (!off.ok) {
        // best-effort cleanup; do not block subsequent releases
        continue;
      }
    }
  }

  /**
   * Release every held note from every source and reset the aggregate ledger.
   * Clears ledgers before requesting the best-effort engine all-notes-off so a new
   * engine generation cannot receive late events. Used for Blue Live stop, project
   * replacement, and app shutdown.
   */
  releaseAll(): Promise<boolean> {
    return this.enqueue(() => this.releaseAllNow());
  }

  private async releaseAllNow(): Promise<boolean> {
    const all = Array.from(this.heldBySource.values());
    this.heldBySource.clear();
    this.aggregateCount.clear();
    if (all.length === 0) return false;
    // Best-effort engine-side all-notes-off; we clear ledgers first and rely on the
    // engine stop path as the final audio safeguard.
    let sentAllNotesOff = false;
    if (this.deps.allNotesOff) {
      try {
        await this.deps.allNotesOff();
        sentAllNotesOff = true;
      } catch { /* ignore */ }
    }
    return sentAllNotesOff;
  }

  /** Diagnostic accessor: how many source-key held notes are currently tracked. */
  get heldCount(): number {
    return this.heldBySource.size;
  }

  /** Diagnostic accessor: how many aggregate (target, midiNote) notes are active. */
  get aggregateHeldCount(): number {
    return this.aggregateCount.size;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function toTriggerRequest(
  event: MidiNoteEvent,
  target: BlueLiveNoteTarget,
  liveSessionId: number,
): Parameters<BlueLiveTriggerFn>[0] {
  return {
    type: event.type,
    midiNote: event.midiNote,
    velocity: event.velocity,
    channel: event.channel,
    source: event.sourceKind,
    sourceId: event.sourceId,
    deviceId: event.deviceId ?? undefined,
    timestamp: event.timestamp,
    target,
    liveSessionId,
  };
}
