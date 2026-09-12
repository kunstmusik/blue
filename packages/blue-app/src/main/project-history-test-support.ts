import type {
  ProjectHistoryCommitRequest,
  ProjectHistoryUndoRequest,
  ProjectHistoryRedoRequest,
  ProjectDocumentUpdatedEvent,
  PrepareHistoryBoundaryAck,
  PrepareHistoryBoundaryEvent,
  ReleaseHistoryBoundaryEvent,
  ProjectRuntimeOutcome,
} from '../shared/project-history';
import type { ProjectDocumentPatch } from '../shared/project-editor/contract';
import type { ProjectSession } from './project-session';

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export class MockHistoryContext {
  private _sequence = 0;

  constructor(
    readonly contextId: string,
    public drainDelayMs = 0,
  ) {}

  get sequence(): number {
    return this._sequence;
  }

  nextCommitRequest(
    documentId: string,
    expectedRevision: number,
    label: string,
    patches: ProjectDocumentPatch[] = [],
    overrides: Partial<ProjectHistoryCommitRequest> = {},
  ): ProjectHistoryCommitRequest {
    this._sequence += 1;
    return {
      documentId,
      operationId: `op-${this.contextId}-${this._sequence}`,
      expectedRevision,
      contextSequence: this._sequence,
      label,
      phase: 'single',
      patches,
      origin: { contextId: this.contextId },
      ...overrides,
    };
  }

  nextUndoRequest(
    documentId: string,
    expectedRevision: number,
    overrides: Partial<ProjectHistoryUndoRequest> = {},
  ): ProjectHistoryUndoRequest {
    this._sequence += 1;
    return {
      documentId,
      operationId: `undo-${this.contextId}-${this._sequence}`,
      expectedRevision,
      contextSequence: this._sequence,
      origin: { contextId: this.contextId },
      ...overrides,
    };
  }

  nextRedoRequest(
    documentId: string,
    expectedRevision: number,
    overrides: Partial<ProjectHistoryRedoRequest> = {},
  ): ProjectHistoryRedoRequest {
    this._sequence += 1;
    return {
      documentId,
      operationId: `redo-${this.contextId}-${this._sequence}`,
      expectedRevision,
      contextSequence: this._sequence,
      origin: { contextId: this.contextId },
      ...overrides,
    };
  }

  acknowledgeBarrier(
    barrierId: string,
    revision: number,
    outstandingPrefixCount = 0,
  ): PrepareHistoryBoundaryAck {
    return {
      barrierId,
      contextId: this.contextId,
      lastAcknowledgedRevision: revision,
      lastAcknowledgedSequence: this._sequence,
      outstandingPrefixCount,
    };
  }
}

export class FakePublicationRecorder {
  readonly events: ProjectDocumentUpdatedEvent[] = [];

  record(event: ProjectDocumentUpdatedEvent): void {
    this.events.push(event);
  }

  latest(): ProjectDocumentUpdatedEvent | undefined {
    return this.events[this.events.length - 1];
  }

  clear(): void {
    this.events.length = 0;
  }
}

/**
 * Captures a durable state fingerprint for two-context history comparisons:
 * the canonical XML of the live document. Restoring history must reproduce
 * this byte-for-byte.
 */
export function captureProjectStateXml(session: ProjectSession): string {
  const data = session.read().data;
  if (!data) throw new Error('No live project document in session');
  return data.saveToString();
}

export type FakeEngineOutcomeMode = 'success' | 'negative-ack' | 'timeout' | 'error';

export interface FakePerformance {
  kind: 'timeline' | 'blueLive';
  generation: number;
  mode: FakeEngineOutcomeMode;
  delayMs: number;
}

export class FakePerformanceManager {
  private performances = new Map<'timeline' | 'blueLive', FakePerformance>();

  startPerformance(
    kind: 'timeline' | 'blueLive',
    mode: FakeEngineOutcomeMode = 'success',
    delayMs = 0,
  ): FakePerformance {
    const existing = this.performances.get(kind);
    const generation = (existing?.generation ?? 0) + 1;
    const perf: FakePerformance = { kind, generation, mode, delayMs };
    this.performances.set(kind, perf);
    return perf;
  }

  stopPerformance(kind: 'timeline' | 'blueLive'): void {
    this.performances.delete(kind);
  }

  getPerformance(kind: 'timeline' | 'blueLive'): FakePerformance | undefined {
    return this.performances.get(kind);
  }

  async reconcileWork(
    kind: 'timeline' | 'blueLive',
    desiredRevision: number,
    affectedOwnerIds: string[] = [],
  ): Promise<ProjectRuntimeOutcome> {
    const perf = this.performances.get(kind);
    if (!perf) {
      return {
        performanceKind: kind,
        generation: 0,
        desiredRevision,
        status: 'applied',
        affectedOwnerIds,
      };
    }

    if (perf.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, perf.delayMs));
    }

    switch (perf.mode) {
      case 'negative-ack':
        return {
          performanceKind: kind,
          generation: perf.generation,
          desiredRevision,
          status: 'failed',
          message: 'Engine rejected parameter assignment',
          affectedOwnerIds,
        };
      case 'timeout':
        return {
          performanceKind: kind,
          generation: perf.generation,
          desiredRevision,
          status: 'failed',
          message: 'Engine acknowledgement timed out after 1000ms',
          affectedOwnerIds,
        };
      case 'error':
        return {
          performanceKind: kind,
          generation: perf.generation,
          desiredRevision,
          status: 'restart-required',
          message: 'Compilation-dependent structural change requires restart',
          affectedOwnerIds,
        };
      case 'success':
      default:
        return {
          performanceKind: kind,
          generation: perf.generation,
          desiredRevision,
          appliedRevision: desiredRevision,
          status: 'applied',
          affectedOwnerIds,
        };
    }
  }
}

/**
 * Generates 100 deterministic mixed project actions alternating between two contexts.
 */
export function generate100ActionWorkload(
  documentId: string,
  contextA: MockHistoryContext,
  contextB: MockHistoryContext,
  startRevision = 1,
): ProjectHistoryCommitRequest[] {
  const requests: ProjectHistoryCommitRequest[] = [];
  let currentRevision = startRevision;

  for (let i = 1; i <= 100; i++) {
    const context = i % 2 === 1 ? contextA : contextB;
    let label = '';
    let patches: ProjectDocumentPatch[] = [];

    if (i % 4 === 1) {
      label = `Adjust Global Orc ${i}`;
      patches = [
        {
          globalOrc: `; Global orchestra edit ${i}\n`,
        },
      ];
    } else if (i % 4 === 2) {
      label = `Adjust Mixer Level ${i}`;
      patches = [
        {
          mixer: {
            type: 'updateChannel',
            channelId: 'Master',
            patch: {
              level: 0.1 + (i % 10) * 0.08,
            },
          },
        },
      ];
    } else if (i % 4 === 3) {
      label = `Add Instrument ${i}`;
      patches = [
        {
          orchestra: {
            type: 'addInstrument',
            instrumentType: 'generic',
          },
        },
      ];
    } else {
      label = `Edit Tables ${i}`;
      patches = [
        {
          tablesText: `; Tables comment ${i}\n`,
        },
      ];
    }

    requests.push(context.nextCommitRequest(documentId, currentRevision, label, patches));
    currentRevision += 1;
  }

  return requests;
}

export interface StableMixerHistoryFixture {
  documentId: string;
  channelIds: {
    master: string;
    subChannel1: string;
    channel1: string;
  };
  initialSnapshots: {
    enableMeters: boolean;
    meterProfileKey: string;
  };
}

export function createStableMixerHistoryFixture(
  documentId = 'doc-mixer-history',
): StableMixerHistoryFixture {
  return {
    documentId,
    channelIds: {
      master: 'Master',
      subChannel1: 'SubChannel-1',
      channel1: 'Channel-1',
    },
    initialSnapshots: {
      enableMeters: true,
      meterProfileKey: 'peak-rms-mixing-plus-6',
    },
  };
}
