// Code Repository worker thread entry point.
//
// Runs the synchronous SQLite repository off the main Electron thread. Mirrors
// the unified-library worker: one message per request, response keyed by id.

import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { CodeRepositoryNode } from '@blue/data';
import {
  CodeRepositoryRepository,
  type CodeRepositoryImportRecordInput,
} from './repository';

export interface CodeRepositoryWorkerRequest {
  readonly id: number;
  readonly operation:
    | 'getSnapshot'
    | 'commitDraft'
    | 'importTree'
    | 'createGroup'
    | 'createSnippet'
    | 'moveNode'
    | 'updateNode'
    | 'deleteNode'
    | 'recordImport'
    | 'hasImportedHash'
    | 'listImports'
    | 'close';
  readonly args: readonly unknown[];
}

export type CodeRepositoryWorkerResponse =
  | { readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly id: number; readonly ok: false; readonly error: { readonly message: string } };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1000) : 'Unknown repository failure';
}

export function startCodeRepositoryWorker(databasePath: string): void {
  if (!parentPort) throw new Error('Code Repository worker requires a parent port');
  const port = parentPort;
  const repository = CodeRepositoryRepository.open(databasePath);

  port.on('message', (request: CodeRepositoryWorkerRequest) => {
    try {
      let value: unknown;
      switch (request.operation) {
        case 'getSnapshot':
          value = repository.getSnapshot();
          break;
        case 'commitDraft':
          value = repository.commitDraft(
            Number(request.args[0]),
            request.args[1] as CodeRepositoryNode,
          );
          break;
        case 'importTree':
          value = repository.importTree(
            Number(request.args[0]),
            request.args[1] as CodeRepositoryNode,
            request.args[2] as CodeRepositoryImportRecordInput,
          );
          break;
        case 'createGroup':
          value = repository.createGroup(
            String(request.args[0]),
            String(request.args[1]),
            Number(request.args[2]),
          );
          break;
        case 'createSnippet':
          value = repository.createSnippet(
            String(request.args[0]),
            String(request.args[1]),
            String(request.args[2]),
            Number(request.args[3]),
          );
          break;
        case 'moveNode':
          value = repository.moveNode(
            String(request.args[0]),
            String(request.args[1]),
            Number(request.args[2]),
            Number(request.args[3]),
          );
          break;
        case 'updateNode':
          value = repository.updateNode(
            String(request.args[0]),
            request.args[1] as { readonly name?: string; readonly code?: string },
            Number(request.args[2]),
          );
          break;
        case 'deleteNode':
          value = repository.deleteNode(String(request.args[0]), Number(request.args[1]));
          break;
        case 'recordImport':
          repository.recordImport(request.args[0] as CodeRepositoryImportRecordInput);
          value = undefined;
          break;
        case 'hasImportedHash':
          value = repository.hasImportedHash(String(request.args[0]));
          break;
        case 'listImports':
          value = repository.listImports(Number(request.args[0] ?? 50));
          break;
        case 'close':
          repository.close();
          value = undefined;
          break;
      }
      const response: CodeRepositoryWorkerResponse = { id: request.id, ok: true, value };
      port.postMessage(response);
      if (request.operation === 'close') port.close();
    } catch (error) {
      const response: CodeRepositoryWorkerResponse = {
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
  && workerData.kind === 'blue-code-repository'
  && typeof workerData.databasePath === 'string'
) {
  startCodeRepositoryWorker(workerData.databasePath);
}
