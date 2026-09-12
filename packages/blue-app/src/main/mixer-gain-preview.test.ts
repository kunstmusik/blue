import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  MixerGainPreviewAdapter,
  type MixerGainPreviewDeps,
  type MixerGainPreviewChannel,
} from './mixer-gain-preview';
import type { MixerRealtimeLevelUpdate } from '../shared/project-editor/contract';

describe('MixerGainPreviewAdapter', () => {
  let deps: MixerGainPreviewDeps;
  let mockChannel: MixerGainPreviewChannel;
  let adapter: MixerGainPreviewAdapter;
  let currentDocId: string | null;
  let currentRevision: number;
  let previewCalls: Array<{
    ownerKey?: string;
    parameterId?: string;
    value: number;
    gestureId?: string;
  }>;
  let drainCalls: string[];
  let currentGenerations: number[];

  beforeEach(() => {
    currentDocId = 'doc-123';
    currentRevision = 5;
    previewCalls = [];
    drainCalls = [];
    currentGenerations = [1];

    mockChannel = {
      getName: () => 'Track 1',
      getLevel: () => -6.0,
    };

    deps = {
      getCurrentDocumentId: () => currentDocId,
      getCurrentRevision: () => currentRevision,
      getChannel: (id: string) => (id === 'ch-1' ? mockChannel : null),
      getChannelOwnerKey: (ch: MixerGainPreviewChannel) => `owner-${ch.getName()}`,
      previewChannelValue: vi.fn(async (args) => {
        previewCalls.push(args);
        return { status: 'applied' as const };
      }),
      drainPreviews: vi.fn(async (gestureId) => {
        if (gestureId) drainCalls.push(gestureId);
      }),
      getActivePerformanceGenerations: () => [...currentGenerations],
    };

    adapter = new MixerGainPreviewAdapter(deps);
  });

  it('rejects invalid payload shapes or out-of-range gain levels', async () => {
    // missing fields
    const res1 = await adapter.handleUpdate(1, { phase: 'preview', level: 0 });
    expect(res1.status).toBe('rejected');

    // out-of-range level (< -96 or > 12)
    const res2 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: 15,
    });
    expect(res2.status).toBe('rejected');

    // non-finite level
    const res3 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: NaN,
    });
    expect(res3.status).toBe('rejected');
  });

  it('rejects document ID mismatch and missing channel', async () => {
    // Document mismatch
    const res1 = await adapter.handleUpdate(1, {
      documentId: 'wrong-doc',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: 0,
    });
    expect(res1.status).toBe('rejected');
    expect(res1.reason).toContain('Document ID mismatch');

    // Missing channel
    const res2 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'unknown-ch',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: 0,
    });
    expect(res2.status).toBe('rejected');
    expect(res2.reason).toContain('Channel not found');
  });

  it('applies preview and routes to runtime reconciliation', async () => {
    const res = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3.5,
    });

    expect(res.status).toBe('applied');
    expect(previewCalls).toHaveLength(1);
    expect(previewCalls[0]).toEqual({
      ownerKey: 'owner-Track 1',
      parameterId: 'level',
      value: -3.5,
      gestureId: 'g-1',
    });
  });

  it('enforces sender ownership and rejects competing gestures on the same channel', async () => {
    // Sender 1 starts gesture g-1
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });

    // Sender 2 tries to preview on the same channel
    const compRes = await adapter.handleUpdate(2, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-comp',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -2,
    });
    expect(compRes.status).toBe('rejected');
    expect(compRes.reason).toContain('controlled by another gesture');
  });

  it('enforces sender sequence high-water mark', async () => {
    // First gesture sequence 1
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });

    // Cancel g-1
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'cancel',
    });

    // Late or equal sequence 1 with new gestureId should be rejected
    const lateRes = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-2',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -4,
    });
    expect(lateRes.status).toBe('rejected');
    expect(lateRes.reason).toContain('Sequence is not monotonically increasing');

    // Strictly higher sequence 2 should succeed
    const okRes = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-3',
      gestureSequence: 2,
      baseRevision: 5,
      phase: 'preview',
      level: -4,
    });
    expect(okRes.status).toBe('applied');
  });

  it('rejects preview and finish when base revision is stale, but allows cancel to restore latest canonical state', async () => {
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });

    // Revision bumps
    currentRevision = 6;
    (mockChannel as { getLevel: () => number }).getLevel = () => -10;

    // Further preview with baseRevision 5 rejected
    const previewRes = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -2,
    });
    expect(previewRes.status).toBe('rejected');
    expect(previewRes.reason).toContain('revision changed');

    // Finish also rejected
    const finishRes = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'finish',
    });
    expect(finishRes.status).toBe('rejected');

    // Cancel proceeds and restores latest canonical gain (-10)
    const cancelRes = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'cancel',
    });
    expect(cancelRes.status).toBe('applied');
    expect(drainCalls).toContain('g-1');
    const lastPreview = previewCalls[previewCalls.length - 1];
    expect(lastPreview.value).toBe(-10);
  });

  it('handles finish, drains queue, and rejects delayed previews after finish', async () => {
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });

    const finishRes = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'finish',
    });
    expect(finishRes.status).toBe('applied');
    expect(drainCalls).toContain('g-1');

    // Delayed preview arriving after finish is rejected
    const latePreview = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -2,
    });
    expect(latePreview.status).toBe('rejected');
    expect(latePreview.reason).toContain('closed');
  });

  it('terminal idempotence: repeated finish and cancel are acknowledged as no-ops', async () => {
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });

    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'finish',
    });

    // Repeated finish
    const repeatFinish = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'finish',
    });
    expect(repeatFinish.status).toBe('applied');

    // Final cancel
    const cancelRes = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'cancel',
    });
    expect(cancelRes.status).toBe('applied');

    // Repeated cancel after release
    const repeatCancel = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'cancel',
    });
    expect(repeatCancel.status).toBe('applied');
  });

  it('cleans up state on sender destroyed and document replacement', async () => {
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });

    adapter.onSenderDestroyed(1);

    // Another sender can now acquire ch-1
    const newSenderRes = await adapter.handleUpdate(2, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-2',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -4,
    });
    expect(newSenderRes.status).toBe('applied');

    // Document replaced
    adapter.onDocumentReplaced();
    currentDocId = 'doc-456';
    const postDocRes = await adapter.handleUpdate(2, {
      documentId: 'doc-456',
      channelId: 'ch-1',
      gestureId: 'g-3',
      gestureSequence: 2,
      baseRevision: 5,
      phase: 'preview',
      level: -5,
    });
    expect(postDocRes.status).toBe('applied');
  });

  it('rejects previews when performance generation changes', async () => {
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });

    // Generation advances
    currentGenerations = [2];

    const res = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -2,
    });
    expect(res.status).toBe('rejected');
    expect(res.reason).toContain('generation');
  });

  it('allows multiple sequential drag gestures on the same channel without rejection', async () => {
    // Gesture 1: drag from initial to -3 dB then finish
    const p1 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -3,
    });
    expect(p1.status).toBe('applied');

    const f1 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-1',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'finish',
    });
    expect(f1.status).toBe('applied');

    // Gesture 2: user drags a second time on the same channel to -6 dB then finishes
    const p2 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-2',
      gestureSequence: 2,
      baseRevision: 5,
      phase: 'preview',
      level: -6,
    });
    expect(p2.status).toBe('applied');

    const f2 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-2',
      gestureSequence: 2,
      baseRevision: 5,
      phase: 'finish',
    });
    expect(f2.status).toBe('applied');

    // Gesture 3: user drags a third time to +1 dB then cancels
    const p3 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-3',
      gestureSequence: 3,
      baseRevision: 5,
      phase: 'preview',
      level: 1,
    });
    expect(p3.status).toBe('applied');

    const c3 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-3',
      gestureSequence: 3,
      baseRevision: 5,
      phase: 'cancel',
    });
    expect(c3.status).toBe('applied');

    // Gesture 4: user drags a fourth time to -1.5 dB then finishes
    const p4 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-4',
      gestureSequence: 4,
      baseRevision: 5,
      phase: 'preview',
      level: -1.5,
    });
    expect(p4.status).toBe('applied');

    const f4 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-seq-4',
      gestureSequence: 4,
      baseRevision: 5,
      phase: 'finish',
    });
    expect(f4.status).toBe('applied');

    expect(previewCalls.map((c) => c.value)).toEqual([-3, -6, 1, -6, -1.5]);
  });

  it('rejects delayed previews from closed gestures without blocking subsequent active gestures', async () => {
    // Gesture 1 finish
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-old',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -2,
    });
    await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-old',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'finish',
    });

    // Gesture 2 starts and is active
    const pNew = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-new',
      gestureSequence: 2,
      baseRevision: 5,
      phase: 'preview',
      level: -5,
    });
    expect(pNew.status).toBe('applied');

    // Delayed preview from g-old arrives
    const delayedOld = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-old',
      gestureSequence: 1,
      baseRevision: 5,
      phase: 'preview',
      level: -1,
    });
    expect(delayedOld.status).toBe('rejected');
    expect(delayedOld.reason).toContain('closed');

    // Gesture 2 can still send preview and finish
    const pNew2 = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-new',
      gestureSequence: 2,
      baseRevision: 5,
      phase: 'preview',
      level: -7,
    });
    expect(pNew2.status).toBe('applied');

    const fNew = await adapter.handleUpdate(1, {
      documentId: 'doc-123',
      channelId: 'ch-1',
      gestureId: 'g-new',
      gestureSequence: 2,
      baseRevision: 5,
      phase: 'finish',
    });
    expect(fNew.status).toBe('applied');
  });
});
