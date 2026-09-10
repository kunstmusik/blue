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
  isProjectRuntimeOutcomeEvent,
  type ProjectHistoryCommitRequest,
  type ProjectHistoryCommittedResponse,
  type ProjectHistoryStaleResponse,
  type ProjectHistoryOversizeResponse,
  type ProjectDocumentUpdatedEvent,
  type PrepareHistoryBoundaryEvent,
  type PrepareHistoryBoundaryAck,
  type ReleaseHistoryBoundaryEvent,
  validateProjectHistoryCommitRequest,
  validateProjectDocumentPatchBatchRequest,
  validateProjectHistoryUndoRequest,
  validateProjectHistoryReadRequest,
  validateRegisterHistoryParticipantRequest,
  validatePrepareHistoryBoundaryAck,
  validateCancelOversizeProposalRequest,
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
        limitBytes: 64 * 1024 * 1024,
        maxEntries: 200,
        retentionStatus: 'within-limit',
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
    expect(
      isProjectDocumentUpdatedEvent({
        ...event,
        history: { ...event.history, retentionStatus: 'unknown' },
      }),
    ).toBe(false);
    expect(
      isProjectDocumentUpdatedEvent({
        ...event,
        runtimeOutcomes: [
          {
            performanceKind: 'timeline',
            generation: 1,
            desiredRevision: 3,
            status: 'failed',
            unexpected: true,
          },
        ],
      }),
    ).toBe(false);
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

  it('rejects malformed history requests before they reach the coordinator', () => {
    const validCommit = {
      documentId: 'doc-1',
      operationId: 'op-1',
      expectedRevision: 0,
      contextSequence: 1,
      label: 'Edit',
      patches: [{ globalOrc: 'sr = 44100' }],
    };

    expect(validateProjectHistoryCommitRequest(validCommit).valid).toBe(true);
    expect(validateProjectHistoryCommitRequest({ ...validCommit, contextSequence: -1 }).valid).toBe(
      false,
    );
    expect(validateProjectHistoryCommitRequest({ ...validCommit, unexpected: true }).valid).toBe(
      false,
    );
    expect(
      validateProjectHistoryCommitRequest({
        ...validCommit,
        patches: [{ globalOrc: () => 'not serializable' }],
      }).valid,
    ).toBe(false);
    expect(
      validateProjectHistoryUndoRequest({
        documentId: 'doc-1',
        operationId: 'undo-1',
        expectedRevision: 0,
        contextSequence: 1,
        extra: 'foreign field',
      }).valid,
    ).toBe(false);
    expect(validateProjectHistoryReadRequest({ documentId: '' }).valid).toBe(false);
    expect(
      validateRegisterHistoryParticipantRequest({
        contextId: 'ctx-1',
        documentId: 'doc-1',
        acceptedRevision: Number.POSITIVE_INFINITY,
      }).valid,
    ).toBe(false);
    expect(
      validatePrepareHistoryBoundaryAck({
        barrierId: 'barrier-1',
        contextId: 'ctx-1',
        lastAcknowledgedRevision: 0,
        lastAcknowledgedSequence: 0,
        outstandingPrefixCount: 0,
        foreign: true,
      }).valid,
    ).toBe(false);
    expect(validateCancelOversizeProposalRequest({ proposalToken: '' }).valid).toBe(false);
  });

  it('accepts patches whose optional fields are explicitly undefined', () => {
    // UI patch builders legitimately spell out optional fields as `undefined`
    // (for example MixerPanel's `{ type: 'addSubChannel', name: undefined }`).
    // Structured clone preserves those keys, and every patch applier treats
    // `field === undefined` as "not provided", so they must stay valid;
    // rejecting them silently dropped whole commits from the project.
    const addSubChannel = {
      mixer: { type: 'addSubChannel', name: undefined, channelId: 'channel-1' },
    };
    expect(validateProjectDocumentPatchBatchRequest([addSubChannel]).valid).toBe(true);
    expect(
      validateProjectDocumentPatchBatchRequest([{ mixer: addSubChannel.mixer, score: undefined }])
        .valid,
    ).toBe(true);
    // Genuinely non-serializable values must still be rejected.
    expect(
      validateProjectDocumentPatchBatchRequest([
        { mixer: { type: 'addSubChannel', name: () => 'function' } },
      ]).valid,
    ).toBe(false);
  });

  it('rejects malformed publication events instead of accepting partial projections', () => {
    const event: ProjectDocumentUpdatedEvent = {
      documentId: 'doc-1',
      sessionId: 1,
      revision: 2,
      stateId: 'state-2',
      isDirty: true,
      history: {
        canUndo: true,
        canRedo: false,
        undoLabel: 'Edit',
        redoLabel: null,
        cursor: 1,
        length: 1,
        retainedBytes: 256,
        savedStateId: null,
        stateId: 'state-2',
      },
      acceptedOperationIds: [],
      snapshot: null,
    };

    expect(isProjectDocumentUpdatedEvent(event)).toBe(true);
    expect(
      isProjectDocumentUpdatedEvent({
        ...event,
        history: { ...event.history, retainedBytes: -1 },
      }),
    ).toBe(false);
    expect(isProjectDocumentUpdatedEvent({ ...event, acceptedOperationIds: [''] })).toBe(false);
    expect(isProjectDocumentUpdatedEvent({ ...event, snapshot: undefined })).toBe(false);
    const missingSnapshot = { ...event } as Partial<ProjectDocumentUpdatedEvent>;
    delete missingSnapshot.snapshot;
    expect(isProjectDocumentUpdatedEvent(missingSnapshot)).toBe(false);

    expect(
      isProjectRuntimeOutcomeEvent({
        documentId: 'doc-1',
        revision: 2,
        outcomes: [
          {
            performanceKind: 'blueLive',
            generation: 4,
            desiredRevision: 2,
            status: 'applied',
          },
        ],
      }),
    ).toBe(true);
    expect(
      isProjectRuntimeOutcomeEvent({
        documentId: 'doc-1',
        revision: 2,
        outcomes: [{ performanceKind: 'timeline', generation: -1 }],
      }),
    ).toBe(false);
  });
});
