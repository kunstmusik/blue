import { describe, expect, it } from 'vitest';

import {
  RENDER_OPERATION_STATUS_CHANNEL,
  FREEZE_ITEM_STATUS_CHANNEL,
  SINGLE_ACTIVE_OPERATION,
  MAIN_OWNS_EXECUTABLE_AND_PATH,
  createStatus,
  isCancelRenderOperationRequest,
  isFreezeItemStatus,
  isFreezeScoreObjectsRequest,
  isRenderOperationStatus,
  isRenderToDiskRequest,
  type FreezeItemStatus,
  type RenderOperationStatus,
  type RenderOperationPhase,
} from './render-freeze-contract';

function freezeItem(overrides: Partial<FreezeItemStatus> = {}): FreezeItemStatus {
  return {
    operationId: 'freeze-1',
    selectionId: 'score-1',
    name: 'Pattern 1',
    action: 'freeze',
    phase: 'running',
    freezeFile: null,
    reason: null,
    outputAppend: null,
    outputType: null,
    ...overrides,
  };
}

describe('render-freeze-contract', () => {
  describe('channel constants', () => {
    it('defines a status broadcast channel', () => {
      expect(RENDER_OPERATION_STATUS_CHANNEL).toBe('render-operation-status');
    });

    it('defines a freeze item status broadcast channel', () => {
      expect(FREEZE_ITEM_STATUS_CHANNEL).toBe('freeze-item-status');
    });

    it('enforces single active operation', () => {
      expect(SINGLE_ACTIVE_OPERATION).toBe(true);
    });

    it('enforces main-owned executable and path selection', () => {
      expect(MAIN_OWNS_EXECUTABLE_AND_PATH).toBe(true);
    });
  });

  describe('createStatus', () => {
    it('creates a status with sensible defaults for null fields', () => {
      const status = createStatus('op-1', 'diskRender', 'rendering', 'Rendering...');

      expect(status.operationId).toBe('op-1');
      expect(status.kind).toBe('diskRender');
      expect(status.phase).toBe('rendering');
      expect(status.message).toBe('Rendering...');
      expect(status.progress).toBeNull();
      expect(status.outputPath).toBeNull();
      expect(status.error).toBeNull();
    });

    it('accepts overrides for progress, outputPath, and error', () => {
      const status = createStatus('op-2', 'freeze', 'failed', 'Error', {
        progress: 50,
        outputPath: '/tmp/out.wav',
        error: 'Csound not found',
      });

      expect(status.progress).toBe(50);
      expect(status.outputPath).toBe('/tmp/out.wav');
      expect(status.error).toBe('Csound not found');
    });

    it('threads the originating disk render action through overrides', () => {
      const status = createStatus('op-3', 'diskRender', 'completed', 'Done', {
        outputPath: '/tmp/out.wav',
        action: 'play',
      });

      expect(status.action).toBe('play');
    });

    it('defaults the action to null when not provided', () => {
      expect(createStatus('op', 'diskRender', 'rendering', '...').action).toBeNull();
    });
  });

  describe('RenderOperationPhase type coverage', () => {
    it('covers all lifecycle phases', () => {
      const phases: RenderOperationPhase[] = [
        'preparing',
        'rendering',
        'inspecting',
        'committing',
        'completed',
        'cancelled',
        'failed',
      ];

      for (const phase of phases) {
        const status: RenderOperationStatus = createStatus('op', 'diskRender', phase, phase);
        expect(status.phase).toBe(phase);
      }
    });
  });

  describe('runtime IPC validation', () => {
    it('accepts only supported render action requests', () => {
      expect(isRenderToDiskRequest({ action: 'render' })).toBe(true);
      expect(isRenderToDiskRequest({ action: 'render', operationId: 'disk-renderer-1' })).toBe(true);
      expect(isRenderToDiskRequest({ action: 'render', operationId: '' })).toBe(false);
      expect(isRenderToDiskRequest({ action: 'delete-project' })).toBe(false);
      expect(isRenderToDiskRequest(null)).toBe(false);
    });

    it('requires a target array for freeze and a non-empty operation id for cancellation', () => {
      expect(isFreezeScoreObjectsRequest({ targets: [] })).toBe(true);
      expect(isFreezeScoreObjectsRequest({ targets: [], operationId: 'freeze-renderer-1' })).toBe(true);
      expect(isFreezeScoreObjectsRequest({ targets: [], operationId: '' })).toBe(false);
      expect(isFreezeScoreObjectsRequest({ targets: 'all' })).toBe(false);
      expect(isCancelRenderOperationRequest({ operationId: 'freeze-1' })).toBe(true);
      expect(isCancelRenderOperationRequest({ operationId: '' })).toBe(false);
    });

    it('rejects malformed render status payloads', () => {
      expect(isRenderOperationStatus(createStatus('op', 'freeze', 'completed', 'Done'))).toBe(true);
      expect(isRenderOperationStatus({ operationId: 'op', kind: 'freeze', phase: 'unknown' })).toBe(false);
    });

    it('accepts an optional valid disk render action and rejects invalid ones', () => {
      const base = createStatus('op', 'diskRender', 'completed', 'Done', { outputPath: '/o.wav' });
      expect(isRenderOperationStatus({ ...base, action: 'play' })).toBe(true);
      expect(isRenderOperationStatus({ ...base, action: 'render' })).toBe(true);
      expect(isRenderOperationStatus({ ...base, action: 'open' })).toBe(true);
      expect(isRenderOperationStatus({ ...base, action: null })).toBe(true);
      expect(isRenderOperationStatus({ ...base, action: undefined })).toBe(true);
      expect(isRenderOperationStatus({ ...base, action: 'delete' })).toBe(false);
    });

    it('accepts well-formed freeze item statuses in every phase', () => {
      for (const phase of ['pending', 'running', 'complete', 'failed'] as const) {
        expect(isFreezeItemStatus(freezeItem({ phase }))).toBe(true);
      }
      expect(isFreezeItemStatus(freezeItem({
        action: 'unfreeze',
        freezeFile: 'freeze0.aif',
        outputAppend: 'rendering...\n',
        outputType: 'stderr',
      }))).toBe(true);
      expect(isFreezeItemStatus(freezeItem({ reason: 'Freeze failed: boom' }))).toBe(true);
    });

    it('rejects malformed freeze item statuses', () => {
      expect(isFreezeItemStatus(null)).toBe(false);
      expect(isFreezeItemStatus('running')).toBe(false);
      expect(isFreezeItemStatus({ ...freezeItem(), operationId: 7 })).toBe(false);
      expect(isFreezeItemStatus({ ...freezeItem(), phase: 'cancelled' })).toBe(false);
      expect(isFreezeItemStatus({ ...freezeItem(), action: 'render' })).toBe(false);
      expect(isFreezeItemStatus({ ...freezeItem(), freezeFile: 42 })).toBe(false);
      expect(isFreezeItemStatus({ ...freezeItem(), outputType: 'stdin' })).toBe(false);
    });
  });
});
