import { useCallback } from 'react';

import type { UdoDefinitionSnapshot } from '../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../shared/project-history';

export interface UdoCallbacks {
  onInsertUdos: (definitions: UdoDefinitionSnapshot[], index?: number) => void;
  onRemoveIndices: (indices: number[]) => void;
  onReorder: (from: number, to: number) => void;
  onUpdateUdo: (
    index: number,
    patch: Partial<UdoDefinitionSnapshot>,
    metadata?: ProjectDocumentCommitMetadata,
  ) => void;
  onConvertStyle: (index: number, style: 'CLASSIC' | 'MODERN') => void;
}

export type UdoPatchVariant = 'project' | 'embedded' | 'bsb';

const VARIANT_ADD: Record<UdoPatchVariant, string> = {
  project: 'add',
  embedded: 'addUdo',
  bsb: 'addUdo',
};

const VARIANT_REMOVE: Record<UdoPatchVariant, string> = {
  project: 'remove',
  embedded: 'removeUdo',
  bsb: 'removeUdo',
};

const VARIANT_UPDATE: Record<UdoPatchVariant, string> = {
  project: 'update',
  embedded: 'updateUdo',
  bsb: 'updateUdo',
};

const VARIANT_REORDER: Record<UdoPatchVariant, string> = {
  project: 'reorder',
  embedded: 'reorderUdo',
  bsb: 'reorderUdo',
};

const VARIANT_CONVERT: Record<UdoPatchVariant, string> = {
  project: 'convertStyle',
  embedded: 'convertUdoStyle',
  bsb: 'convertUdoStyle',
};

export function useUdoCallbacks(
  variant: UdoPatchVariant,
  dispatch: (patch: Record<string, unknown>, metadata?: ProjectDocumentCommitMetadata) => void,
): UdoCallbacks {
  const handleInsertUdos = useCallback(
    (definitions: UdoDefinitionSnapshot[], index?: number) => {
      definitions.forEach((definition, offset) => {
        dispatch({
          type: VARIANT_ADD[variant],
          index: index === undefined ? undefined : index + offset,
          definition,
        });
      });
    },
    [variant, dispatch],
  );

  const handleRemoveIndices = useCallback(
    (indices: number[]) => {
      [...indices]
        .sort((left, right) => right - left)
        .forEach((index) => {
          dispatch({ type: VARIANT_REMOVE[variant], index });
        });
    },
    [variant, dispatch],
  );

  const handleReorder = useCallback(
    (from: number, to: number) => {
      dispatch({ type: VARIANT_REORDER[variant], from, to });
    },
    [variant, dispatch],
  );

  const handleUpdateUdo = useCallback(
    (
      index: number,
      patch: Partial<UdoDefinitionSnapshot>,
      metadata?: ProjectDocumentCommitMetadata,
    ) => {
      dispatch({ type: VARIANT_UPDATE[variant], index, patch }, metadata);
    },
    [variant, dispatch],
  );

  const handleConvertStyle = useCallback(
    (index: number, style: 'CLASSIC' | 'MODERN') => {
      dispatch({ type: VARIANT_CONVERT[variant], index, style });
    },
    [variant, dispatch],
  );

  return {
    onInsertUdos: handleInsertUdos,
    onRemoveIndices: handleRemoveIndices,
    onReorder: handleReorder,
    onUpdateUdo: handleUpdateUdo,
    onConvertStyle: handleConvertStyle,
  };
}
