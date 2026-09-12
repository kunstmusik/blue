import type {
  MixerRealtimeLevelResult,
  MixerRealtimeLevelUpdate,
} from '../shared/project-editor/contract';
import { isMixerRealtimeLevelUpdate } from '../shared/project-editor/contract';

export interface MixerGainPreviewChannel {
  getName(): string;
  getLevel(): number;
}

export interface MixerGainPreviewDeps {
  getCurrentDocumentId: () => string | null;
  getCurrentRevision: () => number;
  getChannel: (channelId: string) => MixerGainPreviewChannel | null;
  getChannelOwnerKey: (channel: MixerGainPreviewChannel) => string;
  previewChannelValue: (args: {
    ownerKey?: string;
    parameterId?: string;
    channel?: string;
    value: number;
    gestureId?: string;
  }) => Promise<{ status: 'applied' | 'rejected'; message?: string }>;
  drainPreviews: (gestureId?: string) => Promise<void>;
  getActivePerformanceGenerations?: () => readonly number[];
}

interface ActiveGesture {
  senderId: number;
  documentId: string;
  channelId: string;
  gestureId: string;
  gestureSequence: number;
  baseRevision: number;
  terminal: boolean;
  activeGenerations?: readonly number[];
}

export class MixerGainPreviewAdapter {
  private readonly deps: MixerGainPreviewDeps;
  private readonly senderHighWaterSequences = new Map<number, number>();
  private readonly activeGesturesByChannel = new Map<string, ActiveGesture>();
  private readonly closedGestureIds = new Set<string>();

  constructor(deps: MixerGainPreviewDeps) {
    this.deps = deps;
  }

  private markGestureClosed(gestureId: string): void {
    this.closedGestureIds.add(gestureId);
    if (this.closedGestureIds.size > 500) {
      const oldest = this.closedGestureIds.keys().next().value;
      if (oldest) {
        this.closedGestureIds.delete(oldest);
      }
    }
  }

  async handleUpdate(senderId: number, update: unknown): Promise<MixerRealtimeLevelResult> {
    if (!isMixerRealtimeLevelUpdate(update)) {
      return { status: 'rejected', reason: 'Invalid payload shape' };
    }

    const currentDocId = this.deps.getCurrentDocumentId();
    if (!currentDocId || currentDocId !== update.documentId) {
      return {
        status: 'rejected',
        reason: 'Document ID mismatch',
        revision: this.deps.getCurrentRevision(),
      };
    }

    const channel = this.deps.getChannel(update.channelId);
    if (!channel) {
      return {
        status: 'rejected',
        reason: 'Channel not found',
        revision: this.deps.getCurrentRevision(),
      };
    }

    if (this.closedGestureIds.has(update.gestureId)) {
      if (update.phase === 'preview') {
        return {
          status: 'rejected',
          reason: 'Gesture is already closed',
          revision: this.deps.getCurrentRevision(),
        };
      }
      return {
        status: 'applied',
        revision: this.deps.getCurrentRevision(),
      };
    }

    const highWater = this.senderHighWaterSequences.get(senderId) ?? -1;
    let active = this.activeGesturesByChannel.get(update.channelId);

    if (active) {
      // Channel currently has an active gesture
      if (active.senderId !== senderId || active.gestureId !== update.gestureId) {
        return {
          status: 'rejected',
          reason: 'Channel is controlled by another gesture',
          revision: this.deps.getCurrentRevision(),
        };
      }
      if (update.gestureSequence !== active.gestureSequence) {
        return {
          status: 'rejected',
          reason: 'Sequence mismatch for active gesture',
          revision: this.deps.getCurrentRevision(),
        };
      }
    } else {
      // No active gesture on this channel
      if (update.phase === 'preview') {
        if (update.gestureSequence <= highWater) {
          return {
            status: 'rejected',
            reason: 'Sequence is not monotonically increasing',
            revision: this.deps.getCurrentRevision(),
          };
        }
        this.senderHighWaterSequences.set(senderId, update.gestureSequence);
        active = {
          senderId,
          documentId: update.documentId,
          channelId: update.channelId,
          gestureId: update.gestureId,
          gestureSequence: update.gestureSequence,
          baseRevision: update.baseRevision,
          terminal: false,
          activeGenerations: this.deps.getActivePerformanceGenerations?.(),
        };
        this.activeGesturesByChannel.set(update.channelId, active);
      } else {
        // finish or cancel without active gesture
        if (update.gestureSequence <= highWater) {
          // Idempotent no-op for already released older sequence
          return {
            status: 'applied',
            revision: this.deps.getCurrentRevision(),
          };
        }
        return {
          status: 'rejected',
          reason: 'Gesture not found',
          revision: this.deps.getCurrentRevision(),
        };
      }
    }

    const currentRevision = this.deps.getCurrentRevision();

    // Check revision fence
    if (update.phase !== 'cancel' && currentRevision !== update.baseRevision) {
      return {
        status: 'rejected',
        reason: 'Document revision changed',
        revision: currentRevision,
      };
    }

    // Check performance generation replacement
    if (active.activeGenerations && this.deps.getActivePerformanceGenerations) {
      const currentGens = this.deps.getActivePerformanceGenerations();
      const generationChanged =
        currentGens.length !== active.activeGenerations.length ||
        currentGens.some((gen, idx) => gen !== active.activeGenerations![idx]);
      if (generationChanged) {
        return {
          status: 'rejected',
          reason: 'Performance generation changed',
          revision: currentRevision,
        };
      }
    }

    if (active.terminal) {
      if (update.phase === 'preview') {
        return {
          status: 'rejected',
          reason: 'Gesture is already closed',
          revision: currentRevision,
        };
      }
      return {
        status: 'applied',
        revision: currentRevision,
      };
    }

    if (update.phase === 'preview') {
      const ownerKey = this.deps.getChannelOwnerKey(channel);
      const ack = await this.deps.previewChannelValue({
        ownerKey,
        parameterId: 'level',
        value: update.level,
        gestureId: update.gestureId,
      });
      if (ack.status === 'rejected') {
        return {
          status: 'rejected',
          reason: ack.message ?? 'Runtime rejected preview',
          revision: currentRevision,
        };
      }
      return {
        status: 'applied',
        revision: currentRevision,
      };
    }

    if (update.phase === 'finish') {
      active.terminal = true;
      this.activeGesturesByChannel.delete(update.channelId);
      this.markGestureClosed(update.gestureId);
      await this.deps.drainPreviews(update.gestureId);
      if (this.deps.getCurrentDocumentId() !== update.documentId) {
        return {
          status: 'rejected',
          reason: 'Document replaced during finish',
          revision: this.deps.getCurrentRevision(),
        };
      }
      return {
        status: 'applied',
        revision: this.deps.getCurrentRevision(),
      };
    }

    // Phase: cancel
    active.terminal = true;
    this.activeGesturesByChannel.delete(update.channelId);
    this.markGestureClosed(update.gestureId);
    await this.deps.drainPreviews(update.gestureId);
    if (this.deps.getCurrentDocumentId() === update.documentId) {
      const freshChannel = this.deps.getChannel(update.channelId);
      if (freshChannel) {
        const ownerKey = this.deps.getChannelOwnerKey(freshChannel);
        await this.deps.previewChannelValue({
          ownerKey,
          parameterId: 'level',
          value: freshChannel.getLevel(),
        });
      }
    }
    return {
      status: 'applied',
      revision: this.deps.getCurrentRevision(),
    };
  }

  onSenderDestroyed(senderId: number): void {
    for (const [channelId, active] of this.activeGesturesByChannel.entries()) {
      if (active.senderId === senderId) {
        this.activeGesturesByChannel.delete(channelId);
      }
    }
    this.senderHighWaterSequences.delete(senderId);
  }

  onDocumentReplaced(): void {
    this.activeGesturesByChannel.clear();
    this.closedGestureIds.clear();
  }
}
