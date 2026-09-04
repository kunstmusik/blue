// Async client for the Code Repository. Wraps the synchronous repository with
// a serializing Promise queue and an optional worker transport, mirroring the
// unified-library client. `open` spawns the worker; `openForTesting` runs the
// repository in-process for unit tests.

import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { CodeRepositoryNode } from '@blue/data';
import {
  CodeRepositoryRepository,
  type CodeRepositoryImportRecord,
  type CodeRepositoryImportRecordInput,
  type CodeRepositorySnapshotData,
} from './repository';
import type {
  CodeRepositoryWorkerRequest,
  CodeRepositoryWorkerResponse,
} from './repository-worker';

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

export class CodeRepositoryClient {
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  private constructor(
    private readonly repository: CodeRepositoryRepository | null,
    private readonly worker: Worker | null,
  ) {
    worker?.on('message', (response: CodeRepositoryWorkerResponse) => {
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.ok) pending.resolve(response.value);
      else pending.reject(new Error(response.error.message));
    });
    worker?.on('error', (error) => {
      this.rejectPending(error instanceof Error ? error : new Error(String(error)));
    });
    worker?.on('exit', (code) => {
      // Any exit while the client is still open is unexpected. A worker whose
      // `workerData.kind` guard doesn't match exits with code 0 without ever
      // registering a listener, which would otherwise leave pending requests
      // hanging forever — reject them all so `start()` fails fast.
      if (!this.closed) {
        this.closed = true;
        this.rejectPending(new Error(`Code Repository worker exited with ${code}`));
      }
    });
  }

  static open(databasePath: string): CodeRepositoryClient {
    const workerPath = path.join(__dirname, 'code-repository-worker.js');
    const worker = new Worker(workerPath, {
      workerData: { kind: 'blue-code-repository', databasePath },
    });
    return new CodeRepositoryClient(null, worker);
  }

  static openForTesting(databasePath: string): CodeRepositoryClient {
    return new CodeRepositoryClient(CodeRepositoryRepository.open(databasePath), null);
  }

  getSnapshot(): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>('getSnapshot');
  }

  commitDraft(
    expectedRevision: number,
    root: CodeRepositoryNode,
  ): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>('commitDraft', expectedRevision, root);
  }

  importTree(
    expectedRevision: number,
    root: CodeRepositoryNode,
    importRecord: CodeRepositoryImportRecordInput,
  ): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>(
      'importTree',
      expectedRevision,
      root,
      importRecord,
    );
  }

  createGroup(
    parentId: string,
    name: string,
    expectedRevision: number,
  ): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>(
      'createGroup',
      parentId,
      name,
      expectedRevision,
    );
  }

  createSnippet(
    parentId: string,
    name: string,
    code: string,
    expectedRevision: number,
  ): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>(
      'createSnippet',
      parentId,
      name,
      code,
      expectedRevision,
    );
  }

  moveNode(
    nodeId: string,
    parentId: string,
    order: number,
    expectedRevision: number,
  ): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>(
      'moveNode',
      nodeId,
      parentId,
      order,
      expectedRevision,
    );
  }

  updateNode(
    nodeId: string,
    patch: { readonly name?: string; readonly code?: string },
    expectedRevision: number,
  ): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>('updateNode', nodeId, patch, expectedRevision);
  }

  deleteNode(nodeId: string, expectedRevision: number): Promise<CodeRepositorySnapshotData> {
    return this.request<CodeRepositorySnapshotData>('deleteNode', nodeId, expectedRevision);
  }

  recordImport(input: CodeRepositoryImportRecordInput): Promise<void> {
    return this.request<void>('recordImport', input);
  }

  hasImportedHash(hash: string): Promise<boolean> {
    return this.request<boolean>('hasImportedHash', hash);
  }

  listImports(limit = 50): Promise<CodeRepositoryImportRecord[]> {
    return this.request<CodeRepositoryImportRecord[]>('listImports', limit);
  }

  runForTesting<T>(
    operation: (repository: CodeRepositoryRepository) => T | Promise<T>,
  ): Promise<T> {
    if (!this.repository) return Promise.reject(new Error('In-process repository is unavailable'));
    return this.enqueue(() => operation(this.repository as CodeRepositoryRepository));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    if (this.worker) {
      await this.request<void>('close');
      this.closed = true;
      await this.worker.terminate();
    } else {
      await this.enqueue(() => this.repository?.close());
      this.closed = true;
    }
  }

  private request<T>(
    operation: CodeRepositoryWorkerRequest['operation'],
    ...args: readonly unknown[]
  ): Promise<T> {
    return this.enqueue(async () => {
      if (this.repository) {
        switch (operation) {
          case 'getSnapshot':
            return this.repository.getSnapshot() as T;
          case 'commitDraft':
            return this.repository.commitDraft(Number(args[0]), args[1] as CodeRepositoryNode) as T;
          case 'importTree':
            return this.repository.importTree(
              Number(args[0]),
              args[1] as CodeRepositoryNode,
              args[2] as CodeRepositoryImportRecordInput,
            ) as T;
          case 'createGroup':
            return this.repository.createGroup(
              String(args[0]),
              String(args[1]),
              Number(args[2]),
            ) as T;
          case 'createSnippet':
            return this.repository.createSnippet(
              String(args[0]),
              String(args[1]),
              String(args[2]),
              Number(args[3]),
            ) as T;
          case 'moveNode':
            return this.repository.moveNode(
              String(args[0]),
              String(args[1]),
              Number(args[2]),
              Number(args[3]),
            ) as T;
          case 'updateNode':
            return this.repository.updateNode(
              String(args[0]),
              args[1] as { readonly name?: string; readonly code?: string },
              Number(args[2]),
            ) as T;
          case 'deleteNode':
            return this.repository.deleteNode(String(args[0]), Number(args[1])) as T;
          case 'recordImport':
            this.repository.recordImport(args[0] as CodeRepositoryImportRecordInput);
            return undefined as T;
          case 'hasImportedHash':
            return this.repository.hasImportedHash(String(args[0])) as T;
          case 'listImports':
            return this.repository.listImports(Number(args[0] ?? 50)) as T;
          case 'close':
            this.repository.close();
            return undefined as T;
        }
      }
      if (!this.worker) throw new Error('Code Repository client has no transport');
      const id = this.nextRequestId++;
      const response = new Promise<unknown>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
      });
      const request: CodeRepositoryWorkerRequest = { id, operation, args };
      this.worker.postMessage(request);
      return (await response) as T;
    });
  }

  private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new Error('Code Repository client is closed'));
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
