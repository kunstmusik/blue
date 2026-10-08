import { settleHistoryEditors } from '../../../../../lib/history-scope-router';
import type { BsbInterfacePatch } from '../../../../../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../../../../../shared/project-history';

export type BsbInterfacePatchHandler = (
  patch: BsbInterfacePatch,
  metadata?: ProjectDocumentCommitMetadata,
) => void;

/** Synchronous begin/end submissions become one explicitly bounded queue batch. */
export function dispatchBsbAction(
  dispatch: BsbInterfacePatchHandler,
  patches: readonly BsbInterfacePatch[],
  label: string,
): void {
  void settleHistoryEditors();
  const gestureId = crypto.randomUUID();
  patches.forEach((patch, index) => {
    dispatch(patch, {
      label,
      gestureId,
      phase:
        patches.length === 1
          ? 'single'
          : index === 0
            ? 'begin'
            : index === patches.length - 1
              ? 'end'
              : 'update',
    });
  });
}
