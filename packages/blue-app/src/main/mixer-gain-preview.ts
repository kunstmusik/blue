import type {
  MixerPannerParameterId,
  MixerRealtimeLevelResult,
  MixerRealtimeLevelUpdate,
  MixerRealtimePanResult,
  MixerRealtimePanUpdate,
} from '../shared/project-editor/contract';
import {
  isMixerRealtimeLevelUpdate,
  isMixerRealtimePanUpdate,
} from '../shared/project-editor/contract';

export interface MixerGainPreviewChannel {
  getName(): string;
  getLevel(): number;
  getPan?(): number;
  getPanWidth?(): number;
  getDualPanLeft?(): number;
  getDualPanRight?(): number;
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
  parameterId: 'level' | MixerPannerParameterId;
  terminal: boolean;
  activeGenerations?: readonly number[];
}

export class MixerGainPreviewAdapter {
  private readonly deps: MixerGainPreviewDeps;
  private readonly senderHighWaterSequences = new Map<number, number>();
  private readonly activeGestures = new Map<string, ActiveGesture>();
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
    return this.handleParameterUpdate(
      senderId,
      update,
      isMixerRealtimeLevelUpdate,
      'level',
      (channel) => channel.getLevel(),
    );
  }

  async handlePanUpdate(senderId: number, update: unknown): Promise<MixerRealtimePanResult> {
    const paramId: MixerPannerParameterId =
      typeof update === 'object' &&
      update !== null &&
      'parameterId' in update &&
      typeof (update as { parameterId?: unknown }).parameterId === 'string'
        ? (update as { parameterId: MixerPannerParameterId }).parameterId
        : 'pan';
    return this.handleParameterUpdate(
      senderId,
      update,
      isMixerRealtimePanUpdate,
      paramId,
      (channel) => {
        switch (paramId) {
          case 'panWidth':
            return channel.getPanWidth?.() ?? 1.0;
          case 'dualPanLeft':
            return channel.getDualPanLeft?.() ?? 0.0;
          case 'dualPanRight':
            return channel.getDualPanRight?.() ?? 1.0;
          case 'pan':
          default:
            return channel.getPan?.() ?? 0.5;
        }
      },
    );
  }

  private async handleParameterUpdate(
    senderId: number,
    update: unknown,
    isValidUpdate: (value: unknown) => value is MixerRealtimeLevelUpdate | MixerRealtimePanUpdate,
    parameterId: 'level' | MixerPannerParameterId,
    readCurrentValue: (channel: MixerGainPreviewChannel) => number,
  ): Promise<MixerRealtimeLevelResult | MixerRealtimePanResult> {
    if (!isValidUpdate(update)) {
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
    const gestureKey = `${update.channelId}::${parameterId}`;
    let active = this.activeGestures.get(gestureKey);

    if (active) {
      // Channel currently has an active gesture for this parameter
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
      // No active gesture on this channel parameter
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
          parameterId,
          terminal: false,
          activeGenerations: this.deps.getActivePerformanceGenerations?.(),
        };
        this.activeGestures.set(gestureKey, active);
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
      const value = 'level' in update ? update.level : update.pan;
      const ack = await this.deps.previewChannelValue({
        ownerKey,
        parameterId,
        value,
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
      this.activeGestures.delete(gestureKey);
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
    this.activeGestures.delete(gestureKey);
    this.markGestureClosed(update.gestureId);
    await this.deps.drainPreviews(update.gestureId);
    if (this.deps.getCurrentDocumentId() === update.documentId) {
      const freshChannel = this.deps.getChannel(update.channelId);
      if (freshChannel) {
        const ownerKey = this.deps.getChannelOwnerKey(freshChannel);
        await this.deps.previewChannelValue({
          ownerKey,
          parameterId,
          value: readCurrentValue(freshChannel),
        });
      }
    }
    return {
      status: 'applied',
      revision: this.deps.getCurrentRevision(),
    };
  }

  onSenderDestroyed(senderId: number): void {
    for (const [key, active] of this.activeGestures.entries()) {
      if (active.senderId === senderId) {
        this.activeGestures.delete(key);
      }
    }
    this.senderHighWaterSequences.delete(senderId);
  }

  onDocumentReplaced(): void {
    this.activeGestures.clear();
    this.closedGestureIds.clear();
  }
}
