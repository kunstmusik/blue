import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { LibraryType } from '../../shared/unified-library';
import {
  RepositoryItemPayload,
  type RepositoryItemPayloadInput,
  RepositoryItemSummary,
  RepositoryBrowsePage,
  RepositoryClipboardNode,
  RepositoryCutClipboardResult,
  RepositoryNode,
  RepositorySearchPage,
  RepositorySnapshot,
  UnifiedLibraryRepository,
} from './repository';
import type { RepositoryWorkerRequest, RepositoryWorkerResponse } from './repository-worker';

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

export class UnifiedLibraryRepositoryClient {
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  private constructor(
    private readonly repository: UnifiedLibraryRepository | null,
    private readonly worker: Worker | null,
  ) {
    worker?.on('message', (response: RepositoryWorkerResponse) => {
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
      if (!this.closed && code !== 0) {
        this.rejectPending(new Error(`Unified Library repository worker exited with ${code}`));
      }
    });
  }

  static open(databasePath: string): UnifiedLibraryRepositoryClient {
    const workerPath = path.join(__dirname, 'repository-worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        kind: 'blue-unified-library-repository',
        databasePath,
      },
    });
    return new UnifiedLibraryRepositoryClient(null, worker);
  }

  static openForTesting(databasePath: string): UnifiedLibraryRepositoryClient {
    return new UnifiedLibraryRepositoryClient(UnifiedLibraryRepository.open(databasePath), null);
  }

  getSnapshot(): Promise<RepositorySnapshot> {
    return this.request<RepositorySnapshot>('getSnapshot');
  }

  getNode(nodeId: string): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('getNode', nodeId);
  }

  getRoot(libraryType: LibraryType): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('getRoot', libraryType);
  }

  listChildren(parentId: string): Promise<RepositoryNode[]> {
    return this.request<RepositoryNode[]>('listChildren', parentId);
  }

  listChildrenPage(parentId: string, offset: number, limit: number): Promise<RepositoryBrowsePage> {
    return this.request<RepositoryBrowsePage>('listChildrenPage', parentId, offset, limit);
  }

  hasChildren(nodeId: string): Promise<boolean> {
    return this.request<boolean>('hasChildren', nodeId);
  }

  getBreadcrumb(nodeId: string): Promise<string[]> {
    return this.request<string[]>('getBreadcrumb', nodeId);
  }

  searchItems(
    query: string,
    libraryType: LibraryType | 'all',
    offset: number,
    limit: number,
  ): Promise<RepositorySearchPage> {
    return this.request<RepositorySearchPage>('searchItems', query, libraryType, offset, limit);
  }

  getItemPayload(nodeId: string): Promise<RepositoryItemPayload> {
    return this.request<RepositoryItemPayload>('getItemPayload', nodeId);
  }

  getItemSummary(nodeId: string): Promise<RepositoryItemSummary> {
    return this.request<RepositoryItemSummary>('getItemSummary', nodeId);
  }

  getClipboardSubtree(nodeId: string): Promise<RepositoryClipboardNode> {
    return this.request<RepositoryClipboardNode>('getClipboardSubtree', nodeId);
  }

  createClipboardSubtree(
    parentId: string,
    subtree: RepositoryClipboardNode,
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('createClipboardSubtree', parentId, subtree);
  }

  cutClipboardSubtree(
    nodeId: string,
    expectedRevision: number,
    expectedNodeIds: readonly string[],
  ): Promise<RepositoryCutClipboardResult> {
    return this.request<RepositoryCutClipboardResult>(
      'cutClipboardSubtree',
      nodeId,
      expectedRevision,
      expectedNodeIds,
    );
  }

  updateItemPayload(
    nodeId: string,
    expectedRevision: number,
    payload: RepositoryItemPayloadInput,
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('updateItemPayload', nodeId, expectedRevision, payload);
  }

  updateItem(
    nodeId: string,
    expectedRevision: number,
    displayName: string,
    payload: RepositoryItemPayloadInput,
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>(
      'updateItem',
      nodeId,
      expectedRevision,
      displayName,
      payload,
    );
  }

  moveNode(
    nodeId: string,
    expectedRevision: number,
    parentId: string,
    targetIndex: number,
    expectedParentRevision?: number,
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>(
      'moveNode',
      nodeId,
      expectedRevision,
      parentId,
      targetIndex,
      expectedParentRevision,
    );
  }

  reorderNode(
    nodeId: string,
    expectedRevision: number,
    targetIndex: number,
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('reorderNode', nodeId, expectedRevision, targetIndex);
  }

  duplicateNode(
    nodeId: string,
    expectedRevision: number,
    parentId?: string,
    targetIndex?: number,
    expectedParentRevision?: number,
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>(
      'duplicateNode',
      nodeId,
      expectedRevision,
      parentId,
      targetIndex,
      expectedParentRevision,
    );
  }

  listDescendantNodeIds(nodeId: string): Promise<string[]> {
    return this.request<string[]>('listDescendantNodeIds', nodeId);
  }

  deleteNode(nodeId: string, expectedRevision: number): Promise<string[]> {
    return this.request<string[]>('deleteNode', nodeId, expectedRevision);
  }

  createFolder(
    input: Parameters<UnifiedLibraryRepository['createFolder']>[0],
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('createFolder', input);
  }

  createItem(
    input: Parameters<UnifiedLibraryRepository['createItem']>[0],
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('createItem', input);
  }

  renameNode(
    nodeId: string,
    expectedRevision: number,
    displayName: string,
  ): Promise<RepositoryNode> {
    return this.request<RepositoryNode>('renameNode', nodeId, expectedRevision, displayName);
  }

  startImportBatch(
    input: Parameters<UnifiedLibraryRepository['startImportBatch']>[0],
  ): Promise<void> {
    return this.request<void>('startImportBatch', input);
  }

  importLegacyDocument(input: Parameters<UnifiedLibraryRepository['importLegacyDocument']>[0]) {
    return this.request<ReturnType<UnifiedLibraryRepository['importLegacyDocument']>>(
      'importLegacyDocument',
      input,
    );
  }

  recordImportSourceFailure(
    input: Parameters<UnifiedLibraryRepository['recordImportSourceFailure']>[0],
  ): Promise<void> {
    return this.request<void>('recordImportSourceFailure', input);
  }

  finishImportBatch(
    input: Parameters<UnifiedLibraryRepository['finishImportBatch']>[0],
  ): Promise<void> {
    return this.request<void>('finishImportBatch', input);
  }

  listImportHistory(limit = 100) {
    return this.request<ReturnType<UnifiedLibraryRepository['listImportHistory']>>(
      'listImportHistory',
      limit,
    );
  }

  undoImportBatch(batchId: string) {
    return this.request<ReturnType<UnifiedLibraryRepository['undoImportBatch']>>(
      'undoImportBatch',
      batchId,
    );
  }

  runForTesting<T>(
    operation: (repository: UnifiedLibraryRepository) => T | Promise<T>,
  ): Promise<T> {
    if (!this.repository) return Promise.reject(new Error('In-process repository is unavailable'));
    return this.enqueue(() => operation(this.repository as UnifiedLibraryRepository));
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
    operation: RepositoryWorkerRequest['operation'],
    ...args: readonly unknown[]
  ): Promise<T> {
    return this.enqueue(async () => {
      if (this.repository) {
        switch (operation) {
          case 'getSnapshot':
            return this.repository.getSnapshot() as T;
          case 'getNode':
            return this.repository.getNode(String(args[0])) as T;
          case 'getRoot':
            return this.repository.getRoot(args[0] as LibraryType) as T;
          case 'listChildren':
            return this.repository.listChildren(String(args[0])) as T;
          case 'listChildrenPage':
            return this.repository.listChildrenPage(
              String(args[0]),
              Number(args[1]),
              Number(args[2]),
            ) as T;
          case 'hasChildren':
            return this.repository.hasChildren(String(args[0])) as T;
          case 'getBreadcrumb':
            return this.repository.getBreadcrumb(String(args[0])) as T;
          case 'searchItems':
            return this.repository.searchItems(
              String(args[0]),
              args[1] as LibraryType | 'all',
              Number(args[2]),
              Number(args[3]),
            ) as T;
          case 'getItemPayload':
            return this.repository.getItemPayload(String(args[0])) as T;
          case 'getItemSummary':
            return this.repository.getItemSummary(String(args[0])) as T;
          case 'getClipboardSubtree':
            return this.repository.getClipboardSubtree(String(args[0])) as T;
          case 'createClipboardSubtree':
            return this.repository.createClipboardSubtree(
              String(args[0]),
              args[1] as RepositoryClipboardNode,
            ) as T;
          case 'cutClipboardSubtree':
            return this.repository.cutClipboardSubtree(
              String(args[0]),
              Number(args[1]),
              args[2] as readonly string[],
            ) as T;
          case 'updateItemPayload':
            return this.repository.updateItemPayload(
              String(args[0]),
              Number(args[1]),
              args[2] as RepositoryItemPayloadInput,
            ) as T;
          case 'updateItem':
            return this.repository.updateItem(
              String(args[0]),
              Number(args[1]),
              String(args[2]),
              args[3] as RepositoryItemPayloadInput,
            ) as T;
          case 'moveNode':
            return this.repository.moveNode(
              String(args[0]),
              Number(args[1]),
              String(args[2]),
              Number(args[3]),
              args[4] === undefined ? undefined : Number(args[4]),
            ) as T;
          case 'reorderNode':
            return this.repository.reorderNode(
              String(args[0]),
              Number(args[1]),
              Number(args[2]),
            ) as T;
          case 'duplicateNode':
            return this.repository.duplicateNode(
              String(args[0]),
              Number(args[1]),
              args[2] === undefined ? undefined : String(args[2]),
              args[3] === undefined ? undefined : Number(args[3]),
              args[4] === undefined ? undefined : Number(args[4]),
            ) as T;
          case 'listDescendantNodeIds':
            return this.repository.listDescendantNodeIds(String(args[0])) as T;
          case 'deleteNode':
            return this.repository.deleteNode(String(args[0]), Number(args[1])) as T;
          case 'createFolder':
            return this.repository.createFolder(
              args[0] as Parameters<UnifiedLibraryRepository['createFolder']>[0],
            ) as T;
          case 'createItem':
            return this.repository.createItem(
              args[0] as Parameters<UnifiedLibraryRepository['createItem']>[0],
            ) as T;
          case 'renameNode':
            return this.repository.renameNode(
              String(args[0]),
              Number(args[1]),
              String(args[2]),
            ) as T;
          case 'startImportBatch':
            return this.repository.startImportBatch(
              args[0] as Parameters<UnifiedLibraryRepository['startImportBatch']>[0],
            ) as T;
          case 'importLegacyDocument':
            return this.repository.importLegacyDocument(
              args[0] as Parameters<UnifiedLibraryRepository['importLegacyDocument']>[0],
            ) as T;
          case 'recordImportSourceFailure':
            return this.repository.recordImportSourceFailure(
              args[0] as Parameters<UnifiedLibraryRepository['recordImportSourceFailure']>[0],
            ) as T;
          case 'finishImportBatch':
            return this.repository.finishImportBatch(
              args[0] as Parameters<UnifiedLibraryRepository['finishImportBatch']>[0],
            ) as T;
          case 'listImportHistory':
            return this.repository.listImportHistory(Number(args[0] ?? 100)) as T;
          case 'undoImportBatch':
            return this.repository.undoImportBatch(String(args[0])) as T;
          case 'close':
            this.repository.close();
            return undefined as T;
        }
      }
      if (!this.worker) throw new Error('Unified Library repository client has no transport');
      const id = this.nextRequestId++;
      const response = new Promise<unknown>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
      });
      const request: RepositoryWorkerRequest = { id, operation, args };
      this.worker.postMessage(request);
      return (await response) as T;
    });
  }

  private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.closed)
      return Promise.reject(new Error('Unified Library repository client is closed'));
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
