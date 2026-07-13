/**
 * Common renderer MIDI note router (SPEC 058).
 *
 * Single ingress point shared by hardware (via the Web MIDI service) and the
 * Virtual Keyboard. Normalizes note-on velocity zero to note-off, validates
 * ranges, maintains a source-scoped held-note ledger with aggregate reference
 * counts, and forwards accepted notes through the existing Blue Live trigger
 * IPC. Operations are serialized so a note-off cannot overtake its note-on.
 */

import {
  isValidMidiChannel,
  isValidMidiNote,
  isValidMidiVelocity,
  type MidiNoteEvent,
  type MidiNoteRouteResult,
} from '../../shared/midi-input';

interface HeldNote {
  sourceId: string;
  sourceKind: MidiNoteEvent['sourceKind'];
  deviceId: string | null;
  channel: number;
  midiNote: number;
  velocity: number;
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
  },
) => Promise<{ ok: boolean; message?: string }>;

export type BlueLiveAllNotesOffFn = () => Promise<{ ok: boolean; message?: string }>;

export interface MidiNoteRouterDeps {
  trigger: BlueLiveTriggerFn;
  allNotesOff?: BlueLiveAllNotesOffFn;
  /** Returns true when Blue Live is running and a project is loaded. */
  isLiveActive: () => boolean;
}

const HELD_KEY_SEPARATOR = '|';

function sourceKey(sourceId: string, channel: number, midiNote: number): string {
  return `${sourceId}${HELD_KEY_SEPARATOR}${channel}${HELD_KEY_SEPARATOR}${midiNote}`;
}

function aggregateKey(channel: number, midiNote: number): string {
  return `${channel}${HELD_KEY_SEPARATOR}${midiNote}`;
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
    const aKey = aggregateKey(event.channel, event.midiNote);

    if (event.type === 'noteOn') {
      // Idempotent: a repeated note-on for the same source key is a no-op
      // (avoids double-submission to Blue Live).
      if (this.heldBySource.has(sKey)) {
        return { accepted: true };
      }

      const existingAggregateCount = this.aggregateCount.get(aKey) ?? 0;
      if (existingAggregateCount === 0) {
        const triggerRequest = toTriggerRequest(event);
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
      };
      this.heldBySource.set(sKey, held);
      this.aggregateCount.set(aKey, existingAggregateCount + 1);

      return { accepted: true };
    }

    // noteOff
    const existing = this.heldBySource.get(sKey);
    if (!existing) {
      // Idempotent release: ignore unknown source key.
      return { accepted: true };
    }
    this.heldBySource.delete(sKey);
    const remaining = (this.aggregateCount.get(aKey) ?? 0) - 1;
    if (remaining <= 0) {
      this.aggregateCount.delete(aKey);
      // Final aggregate note-off — send to Blue Live.
      const offResult = await this.deps.trigger({
        type: 'noteOff',
        midiNote: event.midiNote,
        velocity: event.velocity,
        channel: event.channel,
        source: event.sourceKind,
        sourceId: event.sourceId,
        deviceId: event.deviceId ?? undefined,
        timestamp: event.timestamp,
      });
      if (!offResult.ok) {
        return { accepted: false, message: offResult.message };
      }
    } else {
      this.aggregateCount.set(aKey, remaining);
    }
    return { accepted: true };
  }

  /**
   * Release all held notes for a source (used on disconnect/disable/project
   * change/exit). Idempotent.
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
    // Recompute aggregate counts and emit final note-offs where needed.
    const counts = new Map<string, number>();
    for (const held of this.heldBySource.values()) {
      const k = aggregateKey(held.channel, held.midiNote);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    this.aggregateCount = counts;
    for (const held of toRelease) {
      const aKey = aggregateKey(held.channel, held.midiNote);
      const remaining = counts.get(aKey) ?? 0;
      if (remaining <= 0) {
        const off = await this.deps.trigger({
          type: 'noteOff',
          midiNote: held.midiNote,
          velocity: held.velocity,
          channel: held.channel,
          source: held.sourceKind,
          sourceId,
          deviceId: held.deviceId ?? undefined,
        });
        if (!off.ok) {
          // best-effort cleanup; do not block subsequent releases
          continue;
        }
      }
    }
  }

  /**
   * Release every held note from every source and reset the aggregate ledger.
   * Used for Blue Live stop, project replacement, and app shutdown.
   */
  releaseAll(): Promise<boolean> {
    return this.enqueue(() => this.releaseAllNow());
  }

  private async releaseAllNow(): Promise<boolean> {
    const all = Array.from(this.heldBySource.values());
    this.heldBySource.clear();
    this.aggregateCount.clear();
    if (all.length === 0) return false;
    // Best-effort engine-side all-notes-off; we do not synthesize per-note
    // releases because the engine stop path is the final audio safeguard.
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

  /** Diagnostic accessor: how many aggregate (channel, midiNote) notes are active. */
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

function toTriggerRequest(event: MidiNoteEvent): Parameters<BlueLiveTriggerFn>[0] {
  return {
    type: event.type,
    midiNote: event.midiNote,
    velocity: event.velocity,
    channel: event.channel,
    source: event.sourceKind,
    sourceId: event.sourceId,
    deviceId: event.deviceId ?? undefined,
    timestamp: event.timestamp,
  };
}
