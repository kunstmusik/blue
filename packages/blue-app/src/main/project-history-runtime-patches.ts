import type { ProjectDocumentPatch } from '../shared/project-editor/contract';
import {
  extractPatchRuntimeWork,
  type HistoryRuntimeWorkPatch,
  type RuntimeWorkOperation,
} from './project-runtime-reconciliation';

function operationKey(operation: RuntimeWorkOperation): string {
  return JSON.stringify([
    operation.kind,
    operation.ownerKey,
    'parameterId' in operation ? operation.parameterId : '',
    operation.kind === 'automation'
      ? 'resolutionDecimal' in operation.payload
        ? 'resolution'
        : 'points' in operation.payload
          ? 'points'
          : 'voice' in operation.payload
            ? 'voice'
            : [operation.operation, operation.payload.pointIndex, operation.payload.point]
      : '',
  ]);
}

/** Retain endpoint runtime intent, never restart-only code/XML payloads or repeated publications. */
export function compactHistoryRuntimePatches(
  patches: readonly ProjectDocumentPatch[],
  prefer: 'first' | 'last' = 'last',
): ProjectDocumentPatch[] {
  const seen = new Set<string>(),
    restart = new Set<string>(),
    result: ProjectDocumentPatch[] = [];
  const ordered = prefer === 'last' ? [...patches].reverse() : patches;
  for (const patch of ordered) {
    const work = extractPatchRuntimeWork(patch);
    work.restartRequiredOwnerIds.forEach((owner) => restart.add(owner));
    const operations = work.operations.filter((operation) => {
      const key = operationKey(operation);
      if (operation.kind === 'automation' && operation.operation !== 'update') return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!operations.length) continue;
    const retained: ProjectDocumentPatch | HistoryRuntimeWorkPatch =
      operations.length === work.operations.length && !work.restartRequiredOwnerIds.length
        ? patch
        : ({
            historyRuntimeWork: {
              capability: 'live',
              operations: structuredClone(operations),
              restartRequiredOwnerIds: [],
            },
          } satisfies HistoryRuntimeWorkPatch);
    if (prefer === 'last') result.unshift(retained);
    else result.push(retained);
  }
  if (restart.size) {
    const marker: HistoryRuntimeWorkPatch = {
      historyRuntimeWork: {
        capability: 'restart-required',
        operations: [],
        restartRequiredOwnerIds: [...restart],
      },
    };
    result.push(marker);
  }
  return result;
}
