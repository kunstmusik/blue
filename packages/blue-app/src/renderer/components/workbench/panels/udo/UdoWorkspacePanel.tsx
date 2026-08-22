import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UdoDefinitionSnapshot } from '../../../../../shared/project-editor';
import { useUdoImportExport } from '../../../../hooks/use-udo-actions';
import { createDefaultUdoSnapshot } from '../../../../utils/program-settings-defaults';
import SplitPane from '../orchestra/SplitPane';
import UdoEditor from './UdoEditor';
import { toUdoCompletionDefinitions } from '../editors/udo-completion-scope';
import UdoTable, {
  getProjectUdoSessionObjectId,
  type UdoLibraryDropTarget,
  type UdoSelectionGesture,
} from './UdoTable';
import { cloneUdoSnapshot } from './udo-snapshot-utils';
import { useLibraryStore } from '../../../../stores/library-store';
import { useProjectLibraryNodes } from '../../../libraries/use-project-library-nodes';

interface UdoWorkspacePanelProps {
  udos: UdoDefinitionSnapshot[];
  resetKey?: string | number | null;
  onInsertUdos: (definitions: UdoDefinitionSnapshot[], index?: number) => void;
  onRemoveIndices: (indices: number[]) => void;
  onReorder: (from: number, to: number) => void;
  onUpdateUdo: (index: number, patch: Partial<UdoDefinitionSnapshot>) => void;
  onConvertStyle: (index: number, style: 'CLASSIC' | 'MODERN') => void;
  libraryDropTarget?: UdoLibraryDropTarget;
  /**
   * Project-global UDO definitions available to the UDO body editor. Project
   * hosts pass the current project UDOs; standalone library hosts omit this so
   * project UDOs never leak into library editing.
   */
  projectUdos?: readonly UdoDefinitionSnapshot[];
  /**
   * UDOs owned by the current host and available as context completions.
   * Defaults to the editable owner list, including self for recursion. The
   * project-global UDO workspace overrides this with an empty list because its
   * owner definitions belong exclusively to project scope.
   */
  completionContextUdos?: readonly UdoDefinitionSnapshot[];
}

function createRange(start: number, end: number): number[] {
  const lower = Math.min(start, end);
  const upper = Math.max(start, end);
  const values: number[] = [];

  for (let index = lower; index <= upper; index += 1) {
    values.push(index);
  }

  return values;
}

function normalizeIndices(indices: number[]): number[] {
  return [...new Set(indices)].sort((left, right) => left - right);
}

export default function UdoWorkspacePanel({
  udos,
  resetKey,
  onInsertUdos,
  onRemoveIndices,
  onReorder,
  onUpdateUdo,
  onConvertStyle,
  libraryDropTarget,
  projectUdos,
  completionContextUdos = udos,
}: UdoWorkspacePanelProps): React.ReactElement {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const anchorIndexRef = useRef<number | null>(null);
  const captureClipboard = useLibraryStore((state) => state.captureClipboard);
  const projectNodes = useProjectLibraryNodes(
    'projectOwned',
    'udo',
    libraryDropTarget?.projectSessionId ?? null,
    libraryDropTarget?.projectRevision ?? 0,
  );
  const {
    handleImportBlueUdo,
    handleImportCsoundUdo,
    handleExportBlueUdo,
    handleExportCsoundUdo,
    handleTestOpcode,
  } = useUdoImportExport();

  useEffect(() => {
    setSelectedIndices([]);
    anchorIndexRef.current = null;
  }, [resetKey]);

  useEffect(() => {
    setSelectedIndices((current) => {
      const next = current.filter((index) => index >= 0 && index < udos.length);
      if (next.length === 0) {
        anchorIndexRef.current = null;
      } else if (
        anchorIndexRef.current === null ||
        anchorIndexRef.current < 0 ||
        anchorIndexRef.current >= udos.length
      ) {
        anchorIndexRef.current = next[0] ?? null;
      }
      return next;
    });
  }, [udos.length]);

  const selectedUdo = useMemo(() => {
    if (selectedIndices.length !== 1) {
      return null;
    }

    const [selectedIndex] = selectedIndices;
    return selectedIndex !== undefined ? udos[selectedIndex] ?? null : null;
  }, [selectedIndices, udos]);

  const udoCompletionOptions = useMemo(
    () => ({
      contextUdos: toUdoCompletionDefinitions(completionContextUdos),
      projectUdos: toUdoCompletionDefinitions(projectUdos ?? []),
    }),
    [completionContextUdos, projectUdos],
  );

  const setSingleSelection = useCallback((index: number) => {
    setSelectedIndices([index]);
    anchorIndexRef.current = index;
  }, []);

  const handleSelectIndex = useCallback(
    (index: number, gesture?: UdoSelectionGesture) => {
      setSelectedIndices((current) => {
        if (gesture?.range) {
          const anchor = anchorIndexRef.current ?? current[0] ?? index;
          return createRange(anchor, index);
        }

        if (gesture?.toggle) {
          const next = current.includes(index)
            ? current.filter((value) => value !== index)
            : normalizeIndices([...current, index]);
          anchorIndexRef.current = index;
          return next;
        }

        anchorIndexRef.current = index;
        return [index];
      });
    },
    [],
  );

  const handleContextSelectIndex = useCallback(
    (index: number) => {
      setSelectedIndices((current) => {
        if (current.includes(index)) {
          return current;
        }

        anchorIndexRef.current = index;
        return [index];
      });
    },
    [],
  );

  const handleAdd = useCallback(() => {
    void (async () => {
      const insertIndex =
        selectedIndices.length > 0 ? Math.max(...selectedIndices) + 1 : udos.length;
      const definition = await createDefaultUdoSnapshot();
      onInsertUdos([definition], insertIndex);
      const nextSelection = [insertIndex];
      setSelectedIndices(nextSelection);
      anchorIndexRef.current = insertIndex;
    })();
  }, [onInsertUdos, selectedIndices, udos.length]);

  const handleImport = useCallback(
    async (loader: () => Promise<UdoDefinitionSnapshot[]>) => {
      const imported = await loader();
      if (imported.length === 0) {
        return;
      }

      const insertIndex = udos.length;
      onInsertUdos(imported.map((snapshot) => cloneUdoSnapshot(snapshot)), insertIndex);
      const nextSelection = imported.map((_unused, offset) => insertIndex + offset);
      setSelectedIndices(nextSelection);
      anchorIndexRef.current = nextSelection[0] ?? null;
    },
    [onInsertUdos, udos.length],
  );

  const handleCopySelection = useCallback((operation: 'copy' | 'cut') => {
    const selectedIndex = selectedIndices.length === 1 ? selectedIndices[0] : undefined;
    if (selectedIndex === undefined) return;
    const node = projectNodes.find((candidate) => (
      candidate.key?.scope === 'projectOwned'
      && candidate.key.locator.kind === 'udo'
      && candidate.key.locator.sessionObjectId
        === getProjectUdoSessionObjectId(libraryDropTarget, selectedIndex)
    ));
    if (node) void captureClipboard(node, operation);
  }, [captureClipboard, libraryDropTarget, projectNodes, selectedIndices]);

  const handleRemoveSelection = useCallback(() => {
    if (selectedIndices.length === 0) {
      return;
    }

    onRemoveIndices(selectedIndices);
    setSelectedIndices([]);
    anchorIndexRef.current = null;
  }, [onRemoveIndices, selectedIndices]);

  const handleMoveSelectionUp = useCallback(() => {
    if (selectedIndices.length === 0 || Math.min(...selectedIndices) === 0) {
      return;
    }

    const ordered = normalizeIndices(selectedIndices);
    ordered.forEach((index) => onReorder(index, index - 1));
    const nextSelection = ordered.map((index) => index - 1);
    setSelectedIndices(nextSelection);
    anchorIndexRef.current = nextSelection[0] ?? null;
  }, [onReorder, selectedIndices]);

  const handleMoveSelectionDown = useCallback(() => {
    if (selectedIndices.length === 0 || Math.max(...selectedIndices) >= udos.length - 1) {
      return;
    }

    const ordered = normalizeIndices(selectedIndices).reverse();
    ordered.forEach((index) => onReorder(index, index + 1));
    const nextSelection = normalizeIndices(selectedIndices.map((index) => index + 1));
    setSelectedIndices(nextSelection);
    anchorIndexRef.current = nextSelection[0] ?? null;
  }, [onReorder, selectedIndices, udos.length]);

  const handleUpdateSelectedUdo = useCallback(
    (patch: Partial<UdoDefinitionSnapshot>) => {
      if (selectedIndices.length !== 1) {
        return;
      }

      const [selectedIndex] = selectedIndices;
      if (selectedIndex === undefined) {
        return;
      }

      onUpdateUdo(selectedIndex, patch);
    },
    [onUpdateUdo, selectedIndices],
  );

  const handleConvertSelectedStyle = useCallback(
    (style: 'CLASSIC' | 'MODERN') => {
      if (selectedIndices.length !== 1) {
        return;
      }

      const [selectedIndex] = selectedIndices;
      if (selectedIndex === undefined) {
        return;
      }

      onConvertStyle(selectedIndex, style);
    },
    [onConvertStyle, selectedIndices],
  );

  const handleTestSelectedUdo = useCallback(() => {
    if (selectedUdo) {
      handleTestOpcode(selectedUdo);
    }
  }, [handleTestOpcode, selectedUdo]);

  const handleExportBlue = useCallback(() => {
    if (selectedUdo) {
      void handleExportBlueUdo(selectedUdo);
    }
  }, [handleExportBlueUdo, selectedUdo]);

  const handleExportCsound = useCallback(() => {
    if (selectedUdo) {
      void handleExportCsoundUdo(selectedUdo);
    }
  }, [handleExportCsoundUdo, selectedUdo]);

  return (
    <SplitPane
      orientation="vertical"
      splitId="udo.workspace.outer"
      controlledPane="first"
      defaultSizePx={200}
      minFirstSize={200}
      minSecondSize={120}
      ariaLabel="UDO workspace split"
      first={
        <UdoTable
          udolist={udos}
          selectedIndices={selectedIndices}
          onSelectIndex={handleSelectIndex}
          onContextSelectIndex={handleContextSelectIndex}
          onAddUdo={handleAdd}
          onImportBlueUdo={() => {
            void handleImport(handleImportBlueUdo);
          }}
          onImportCsoundUdo={() => {
            void handleImport(handleImportCsoundUdo);
          }}
          onRemoveSelection={handleRemoveSelection}
          onCopySelection={handleCopySelection}
          onExportBlueUdo={handleExportBlue}
          onExportCsoundUdo={handleExportCsound}
          onMoveSelectionUp={handleMoveSelectionUp}
          onMoveSelectionDown={handleMoveSelectionDown}
          projectNodes={projectNodes}
          libraryDropTarget={libraryDropTarget}
        />
      }
      second={
        <UdoEditor
          udo={selectedUdo}
          javaBlueCompletionOptions={udoCompletionOptions}
          onUpdateUdo={handleUpdateSelectedUdo}
          onConvertStyle={handleConvertSelectedStyle}
          onTestOpcode={handleTestSelectedUdo}
        />
      }
    />
  );
}
