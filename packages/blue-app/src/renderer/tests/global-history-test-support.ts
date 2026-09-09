import { vi } from 'vitest';
import type {
  ProjectHistoryCommitRequest,
  ProjectHistoryUndoRequest,
  ProjectHistoryRedoRequest,
  ProjectHistoryReadRequest,
  ProjectHistoryResponse,
  ProjectHistoryCommittedResponse,
  ProjectDocumentUpdatedEvent,
  PrepareHistoryBoundaryEvent,
  PrepareHistoryBoundaryAck,
  ReleaseHistoryBoundaryEvent,
} from '../../shared/project-history';

export interface MockHistoryBridgeOptions {
  documentId?: string;
  initialRevision?: number;
  initialStateId?: string;
}

export class MockRendererHistoryBridge {
  documentId: string;
  revision: number;
  stateId: string;
  isDirty = false;
  canUndo = false;
  canRedo = false;
  undoLabel: string | null = null;
  redoLabel: string | null = null;
  cursor = 0;
  length = 0;
  retainedBytes = 0;
  savedStateId: string | null = null;

  readonly committedRequests: ProjectHistoryCommitRequest[] = [];
  readonly acknowledgedAcks: PrepareHistoryBoundaryAck[] = [];
  private boundaryListeners = new Set<(event: PrepareHistoryBoundaryEvent) => void>();
  private releaseListeners = new Set<(event: ReleaseHistoryBoundaryEvent) => void>();
  private documentUpdatedListeners = new Set<(event: ProjectDocumentUpdatedEvent) => void>();

  constructor(options: MockHistoryBridgeOptions = {}) {
    this.documentId = options.documentId ?? 'doc-test-1';
    this.revision = options.initialRevision ?? 0;
    this.stateId = options.initialStateId ?? 'state-0';
    this.savedStateId = this.stateId;
  }

  onPrepareHistoryBoundary(listener: (event: PrepareHistoryBoundaryEvent) => void): () => void {
    this.boundaryListeners.add(listener);
    return () => this.boundaryListeners.delete(listener);
  }

  onReleaseHistoryBoundary(listener: (event: ReleaseHistoryBoundaryEvent) => void): () => void {
    this.releaseListeners.add(listener);
    return () => this.releaseListeners.delete(listener);
  }

  onProjectDocumentUpdated(listener: (event: ProjectDocumentUpdatedEvent) => void): () => void {
    this.documentUpdatedListeners.add(listener);
    return () => this.documentUpdatedListeners.delete(listener);
  }

  dispatchPrepareBoundary(barrierId: string, reason: PrepareHistoryBoundaryEvent['reason']): void {
    const event: PrepareHistoryBoundaryEvent = { barrierId, reason };
    for (const listener of this.boundaryListeners) {
      listener(event);
    }
  }

  dispatchReleaseBoundary(barrierId: string, status: 'ready' | 'aborted', reason?: string): void {
    const event: ReleaseHistoryBoundaryEvent = { barrierId, status, reason };
    for (const listener of this.releaseListeners) {
      listener(event);
    }
  }

  dispatchDocumentUpdated(event: ProjectDocumentUpdatedEvent): void {
    this.revision = event.revision;
    this.stateId = event.stateId;
    this.isDirty = event.isDirty;
    this.canUndo = event.history.canUndo;
    this.canRedo = event.history.canRedo;
    this.undoLabel = event.history.undoLabel;
    this.redoLabel = event.history.redoLabel;
    for (const listener of this.documentUpdatedListeners) {
      listener(event);
    }
  }

  async commit(request: ProjectHistoryCommitRequest): Promise<ProjectHistoryResponse> {
    this.committedRequests.push(request);
    this.revision += 1;
    this.stateId = `state-${this.revision}`;
    this.isDirty = true;
    this.canUndo = true;
    this.undoLabel = request.label;
    this.cursor += 1;
    this.length += 1;

    const response: ProjectHistoryCommittedResponse = {
      status: 'committed',
      operationId: request.operationId,
      documentId: request.documentId,
      revision: this.revision,
      stateId: this.stateId,
      isDirty: this.isDirty,
      history: {
        canUndo: this.canUndo,
        canRedo: this.canRedo,
        undoLabel: this.undoLabel,
        redoLabel: this.redoLabel,
        cursor: this.cursor,
        length: this.length,
        retainedBytes: this.retainedBytes,
        savedStateId: this.savedStateId,
        stateId: this.stateId,
      },
    };
    return response;
  }

  async undo(_request: ProjectHistoryUndoRequest): Promise<ProjectHistoryResponse> {
    if (!this.canUndo || this.cursor <= 0) {
      return {
        status: 'unchanged',
        operationId: _request.operationId,
        documentId: _request.documentId,
        revision: this.revision,
        stateId: this.stateId,
        isDirty: this.isDirty,
        history: {
          canUndo: false,
          canRedo: this.canRedo,
          undoLabel: null,
          redoLabel: this.redoLabel,
          cursor: this.cursor,
          length: this.length,
          retainedBytes: this.retainedBytes,
          savedStateId: this.savedStateId,
          stateId: this.stateId,
        },
      };
    }
    this.revision += 1;
    this.cursor -= 1;
    this.stateId = `state-${this.cursor}`;
    this.canRedo = true;
    this.redoLabel = this.undoLabel;
    this.canUndo = this.cursor > 0;
    this.undoLabel = this.canUndo ? `Action ${this.cursor}` : null;
    this.isDirty = this.stateId !== this.savedStateId;

    return {
      status: 'committed',
      operationId: _request.operationId,
      documentId: _request.documentId,
      revision: this.revision,
      stateId: this.stateId,
      isDirty: this.isDirty,
      history: {
        canUndo: this.canUndo,
        canRedo: this.canRedo,
        undoLabel: this.undoLabel,
        redoLabel: this.redoLabel,
        cursor: this.cursor,
        length: this.length,
        retainedBytes: this.retainedBytes,
        savedStateId: this.savedStateId,
        stateId: this.stateId,
      },
    };
  }

  async redo(_request: ProjectHistoryRedoRequest): Promise<ProjectHistoryResponse> {
    if (!this.canRedo || this.cursor >= this.length) {
      return {
        status: 'unchanged',
        operationId: _request.operationId,
        documentId: _request.documentId,
        revision: this.revision,
        stateId: this.stateId,
        isDirty: this.isDirty,
        history: {
          canUndo: this.canUndo,
          canRedo: false,
          undoLabel: this.undoLabel,
          redoLabel: null,
          cursor: this.cursor,
          length: this.length,
          retainedBytes: this.retainedBytes,
          savedStateId: this.savedStateId,
          stateId: this.stateId,
        },
      };
    }
    this.revision += 1;
    this.cursor += 1;
    this.stateId = `state-${this.cursor}`;
    this.canUndo = true;
    this.undoLabel = this.redoLabel;
    this.canRedo = this.cursor < this.length;
    this.redoLabel = this.canRedo ? `Action ${this.cursor + 1}` : null;
    this.isDirty = this.stateId !== this.savedStateId;

    return {
      status: 'committed',
      operationId: _request.operationId,
      documentId: _request.documentId,
      revision: this.revision,
      stateId: this.stateId,
      isDirty: this.isDirty,
      history: {
        canUndo: this.canUndo,
        canRedo: this.canRedo,
        undoLabel: this.undoLabel,
        redoLabel: this.redoLabel,
        cursor: this.cursor,
        length: this.length,
        retainedBytes: this.retainedBytes,
        savedStateId: this.savedStateId,
        stateId: this.stateId,
      },
    };
  }

  async acknowledgeBoundary(ack: PrepareHistoryBoundaryAck): Promise<void> {
    this.acknowledgedAcks.push(ack);
  }
}
