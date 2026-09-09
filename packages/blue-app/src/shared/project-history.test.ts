import { describe, it, expect } from 'vitest';
import {
  PROJECT_HISTORY_COMMIT_CHANNEL,
  PROJECT_HISTORY_UNDO_CHANNEL,
  PROJECT_HISTORY_REDO_CHANNEL,
  PROJECT_HISTORY_READ_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL,
  PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL,
  PROJECT_DOCUMENT_UPDATED_CHANNEL,
  isProjectHistoryResponse,
  isProjectDocumentUpdatedEvent,
  type ProjectHistoryCommitRequest,
  type ProjectHistoryCommittedResponse,
  type ProjectHistoryStaleResponse,
  type ProjectHistoryOversizeResponse,
  type ProjectDocumentUpdatedEvent,
  type PrepareHistoryBoundaryEvent,
  type PrepareHistoryBoundaryAck,
  type ReleaseHistoryBoundaryEvent,
} from './project-history';

describe('project-history shared contracts', () => {
  it('exposes stable IPC channel constants', () => {
    expect(PROJECT_HISTORY_COMMIT_CHANNEL).toBe('project-history:commit');
    expect(PROJECT_HISTORY_UNDO_CHANNEL).toBe('project-history:undo');
    expect(PROJECT_HISTORY_REDO_CHANNEL).toBe('project-history:redo');
    expect(PROJECT_HISTORY_READ_CHANNEL).toBe('project-history:read');
    expect(PROJECT_HISTORY_BOUNDARY_PREPARE_CHANNEL).toBe('project-history:boundary:prepare');
    expect(PROJECT_HISTORY_BOUNDARY_ACK_CHANNEL).toBe('project-history:boundary:ack');
    expect(PROJECT_HISTORY_BOUNDARY_RELEASE_CHANNEL).toBe('project-history:boundary:release');
    expect(PROJECT_DOCUMENT_UPDATED_CHANNEL).toBe('project-document-updated');
  });

  it('safely serializes and deserializes commit requests with preconditions and origin', () => {
    const request: ProjectHistoryCommitRequest = {
      documentId: 'doc-1',
      operationId: 'op-1',
      expectedRevision: 4,
      contextSequence: 12,
      label: 'Move Score Object',
      gestureId: 'gesture-score-drag-1',
      fieldId: 'score-time',
      phase: 'single',
      patches: [{ globalOrc: 'sr = 44100' }],
      preconditions: [
        {
          targetType: 'scoreObject',
          targetId: 'obj-42',
          field: 'startTime',
          expectedValue: 2.5,
        },
      ],
      origin: {
        contextId: 'ctx-renderer-main',
        viewId: 'score-timeline',
        selection: [
          {
            targetType: 'scoreObject',
            targetId: 'obj-42',
          },
        ],
      },
    };

    const roundtripped: ProjectHistoryCommitRequest = JSON.parse(JSON.stringify(request));
    expect(roundtripped).toEqual(request);
    expect(roundtripped.origin?.selection?.[0].targetId).toBe('obj-42');
  });

  it('validates ProjectHistoryResponse status union with type guards', () => {
    const committed: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: 'op-10',
      documentId: 'doc-1',
      revision: 5,
      stateId: 'state-5',
      isDirty: true,
      history: {
        canUndo: true,
        canRedo: false,
        undoLabel: 'Move Score Object',
        redoLabel: null,
        cursor: 1,
        length: 1,
        retainedBytes: 1024,
        savedStateId: 'state-0',
        stateId: 'state-5',
      },
      changedTargets: ['obj-42'],
      runtimeOutcomes: [
        {
          performanceKind: 'timeline',
          generation: 1,
          desiredRevision: 5,
          appliedRevision: 5,
          status: 'applied',
        },
      ],
    };

    const stale: ProjectHistoryStaleResponse = {
      status: 'stale',
      operationId: 'op-11',
      documentId: 'doc-1',
      currentRevision: 7,
      currentStateId: 'state-7',
      reason: 'Revision mismatch',
    };

    const oversize: ProjectHistoryOversizeResponse = {
      status: 'oversize',
      operationId: 'op-12',
      documentId: 'doc-1',
      proposalToken: 'token-abc-123',
      estimatedBytes: 70 * 1024 * 1024,
      limitBytes: 64 * 1024 * 1024,
      explanation: 'Exceeds retained memory budget of 64 MiB',
    };

    expect(isProjectHistoryResponse(committed)).toBe(true);
    expect(isProjectHistoryResponse(stale)).toBe(true);
    expect(isProjectHistoryResponse(oversize)).toBe(true);
    expect(isProjectHistoryResponse(null)).toBe(false);
    expect(isProjectHistoryResponse({})).toBe(false);
    expect(isProjectHistoryResponse({ status: 'unknown' })).toBe(false);
  });

  it('validates ProjectDocumentUpdatedEvent structure and roundtrip', () => {
    const event: ProjectDocumentUpdatedEvent<{ mock: boolean }> = {
      documentId: 'doc-1',
      sessionId: 101,
      revision: 3,
      stateId: 'state-3',
      isDirty: false,
      history: {
        canUndo: true,
        canRedo: true,
        undoLabel: 'Change Level',
        redoLabel: 'Delete Instrument',
        cursor: 2,
        length: 3,
        retainedBytes: 4096,
        savedStateId: 'state-3',
        stateId: 'state-3',
      },
      acceptedOperationIds: ['op-1', 'op-2'],
      sourceSequence: 5,
      snapshot: { mock: true },
      selectionHints: [{ targetType: 'mixerChannel', targetId: 'chan-master' }],
      originViewId: 'mixer-panel',
    };

    expect(isProjectDocumentUpdatedEvent(event)).toBe(true);
    expect(isProjectDocumentUpdatedEvent({ documentId: 'doc-1' })).toBe(false);

    const serialized = JSON.parse(JSON.stringify(event));
    expect(isProjectDocumentUpdatedEvent(serialized)).toBe(true);
    expect(serialized).toEqual(event);
  });

  it('verifies settlement boundary events and acks are serializable', () => {
    const prepare: PrepareHistoryBoundaryEvent = {
      barrierId: 'barrier-1',
      reason: 'undo',
    };
    const ack: PrepareHistoryBoundaryAck = {
      barrierId: 'barrier-1',
      contextId: 'window-1',
      lastAcknowledgedRevision: 5,
      lastAcknowledgedSequence: 10,
      outstandingPrefixCount: 0,
    };
    const release: ReleaseHistoryBoundaryEvent = {
      barrierId: 'barrier-1',
      status: 'ready',
    };

    expect(JSON.parse(JSON.stringify(prepare))).toEqual(prepare);
    expect(JSON.parse(JSON.stringify(ack))).toEqual(ack);
    expect(JSON.parse(JSON.stringify(release))).toEqual(release);
  });
});
