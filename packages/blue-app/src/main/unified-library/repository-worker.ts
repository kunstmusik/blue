import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { UnifiedLibraryRepository } from './repository';

export interface RepositoryWorkerRequest {
  readonly id: number;
  readonly operation:
    | 'getSnapshot'
    | 'getNode'
    | 'getRoot'
    | 'listChildren'
    | 'listChildrenPage'
    | 'hasChildren'
    | 'getBreadcrumb'
    | 'searchItems'
    | 'getItemPayload'
    | 'getItemSummary'
    | 'updateItemPayload'
    | 'updateItem'
    | 'moveNode'
    | 'reorderNode'
    | 'duplicateNode'
    | 'deleteNode'
    | 'createFolder'
    | 'createItem'
    | 'renameNode'
    | 'startImportBatch'
    | 'importLegacyDocument'
    | 'recordImportSourceFailure'
    | 'finishImportBatch'
    | 'listImportHistory'
    | 'undoImportBatch'
    | 'close';
  readonly args: readonly unknown[];
}

export type RepositoryWorkerResponse =
  | { readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly id: number; readonly ok: false; readonly error: { readonly message: string } };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1000) : 'Unknown repository failure';
}

export function startUnifiedLibraryRepositoryWorker(databasePath: string): void {
  if (!parentPort) throw new Error('Unified Library repository worker requires a parent port');
  const port = parentPort;
  const repository = UnifiedLibraryRepository.open(databasePath);

  port.on('message', (request: RepositoryWorkerRequest) => {
    try {
      let value: unknown;
      switch (request.operation) {
        case 'getSnapshot':
          value = repository.getSnapshot();
          break;
        case 'getNode':
          value = repository.getNode(String(request.args[0]));
          break;
        case 'getRoot':
          value = repository.getRoot(request.args[0] as 'instrument' | 'udo' | 'soundObject' | 'effect');
          break;
        case 'listChildren':
          value = repository.listChildren(String(request.args[0]));
          break;
        case 'listChildrenPage':
          value = repository.listChildrenPage(
            String(request.args[0]), Number(request.args[1]), Number(request.args[2]),
          );
          break;
        case 'hasChildren':
          value = repository.hasChildren(String(request.args[0]));
          break;
        case 'getBreadcrumb':
          value = repository.getBreadcrumb(String(request.args[0]));
          break;
        case 'searchItems':
          value = repository.searchItems(
            String(request.args[0]),
            request.args[1] as 'instrument' | 'udo' | 'soundObject' | 'effect' | 'all',
            Number(request.args[2]),
            Number(request.args[3]),
          );
          break;
        case 'getItemPayload':
          value = repository.getItemPayload(String(request.args[0]));
          break;
        case 'getItemSummary':
          value = repository.getItemSummary(String(request.args[0]));
          break;
        case 'updateItemPayload':
          value = repository.updateItemPayload(
            String(request.args[0]), Number(request.args[1]),
            request.args[2] as import('./repository').RepositoryItemPayloadInput,
          );
          break;
        case 'updateItem':
          value = repository.updateItem(
            String(request.args[0]), Number(request.args[1]), String(request.args[2]),
            request.args[3] as import('./repository').RepositoryItemPayloadInput,
          );
          break;
        case 'moveNode':
          value = repository.moveNode(
            String(request.args[0]), Number(request.args[1]), String(request.args[2]), Number(request.args[3]),
          );
          break;
        case 'reorderNode':
          value = repository.reorderNode(String(request.args[0]), Number(request.args[1]), Number(request.args[2]));
          break;
        case 'duplicateNode':
          value = repository.duplicateNode(
            String(request.args[0]), Number(request.args[1]),
            request.args[2] === undefined ? undefined : String(request.args[2]),
            request.args[3] === undefined ? undefined : Number(request.args[3]),
          );
          break;
        case 'deleteNode':
          value = repository.deleteNode(String(request.args[0]), Number(request.args[1]));
          break;
        case 'createFolder':
          value = repository.createFolder(request.args[0] as Parameters<typeof repository.createFolder>[0]);
          break;
        case 'createItem':
          value = repository.createItem(request.args[0] as Parameters<typeof repository.createItem>[0]);
          break;
        case 'renameNode':
          value = repository.renameNode(String(request.args[0]), Number(request.args[1]), String(request.args[2]));
          break;
        case 'startImportBatch':
          value = repository.startImportBatch(request.args[0] as Parameters<typeof repository.startImportBatch>[0]);
          break;
        case 'importLegacyDocument':
          value = repository.importLegacyDocument(request.args[0] as Parameters<typeof repository.importLegacyDocument>[0]);
          break;
        case 'recordImportSourceFailure':
          value = repository.recordImportSourceFailure(request.args[0] as Parameters<typeof repository.recordImportSourceFailure>[0]);
          break;
        case 'finishImportBatch':
          value = repository.finishImportBatch(request.args[0] as Parameters<typeof repository.finishImportBatch>[0]);
          break;
        case 'listImportHistory':
          value = repository.listImportHistory(Number(request.args[0] ?? 100));
          break;
        case 'undoImportBatch':
          value = repository.undoImportBatch(String(request.args[0]));
          break;
        case 'close':
          repository.close();
          value = undefined;
          break;
      }
      const response: RepositoryWorkerResponse = { id: request.id, ok: true, value };
      port.postMessage(response);
      if (request.operation === 'close') port.close();
    } catch (error) {
      const response: RepositoryWorkerResponse = {
        id: request.id,
        ok: false,
        error: { message: errorMessage(error) },
      };
      port.postMessage(response);
    }
  });
}

if (
  !isMainThread
  && workerData
  && typeof workerData === 'object'
  && workerData.kind === 'blue-unified-library-repository'
  && typeof workerData.databasePath === 'string'
) {
  startUnifiedLibraryRepositoryWorker(workerData.databasePath);
}
