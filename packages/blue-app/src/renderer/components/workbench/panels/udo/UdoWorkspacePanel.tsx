import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UdoDefinitionSnapshot } from '../../../../../shared/project-editor';
import { useUdoImportExport } from '../../../../hooks/use-udo-actions';
import { createDefaultUdoSnapshot } from '../../../../utils/program-settings-defaults';
import SplitPane from '../orchestra/SplitPane';
import UdoEditor from './UdoEditor';
import UdoTable, { type UdoSelectionGesture } from './UdoTable';
import { cloneUdoSnapshot } from './udo-snapshot-utils';

interface UdoWorkspacePanelProps {
  udos: UdoDefinitionSnapshot[];
  resetKey?: string | number | null;
  onInsertUdos: (definitions: UdoDefinitionSnapshot[], index?: number) => void;
  onRemoveIndices: (indices: number[]) => void;
  onReorder: (from: number, to: number) => void;
  onUpdateUdo: (index: number, patch: Partial<UdoDefinitionSnapshot>) => void;
  onConvertStyle: (index: number, style: 'CLASSIC' | 'MODERN') => void;
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
}: UdoWorkspacePanelProps): React.ReactElement {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [clipboard, setClipboard] = useState<UdoDefinitionSnapshot[]>([]);
  const anchorIndexRef = useRef<number | null>(null);
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

  const handleCopySelection = useCallback(() => {
    const nextClipboard = selectedIndices
      .map((index) => udos[index])
      .filter((snapshot): snapshot is UdoDefinitionSnapshot => Boolean(snapshot))
      .map((snapshot) => cloneUdoSnapshot(snapshot));
    setClipboard(nextClipboard);
  }, [selectedIndices, udos]);

  const handleRemoveSelection = useCallback(() => {
    if (selectedIndices.length === 0) {
      return;
    }

    onRemoveIndices(selectedIndices);
    setSelectedIndices([]);
    anchorIndexRef.current = null;
  }, [onRemoveIndices, selectedIndices]);

  const handleCutSelection = useCallback(() => {
    handleCopySelection();
    handleRemoveSelection();
  }, [handleCopySelection, handleRemoveSelection]);

  const handlePasteSelection = useCallback(() => {
    if (clipboard.length === 0) {
      return;
    }

    const insertIndex =
      selectedIndices.length > 0 ? Math.max(...selectedIndices) + 1 : udos.length;
    onInsertUdos(clipboard.map((snapshot) => cloneUdoSnapshot(snapshot)), insertIndex);
    const nextSelection = clipboard.map((_unused, offset) => insertIndex + offset);
    setSelectedIndices(nextSelection);
    anchorIndexRef.current = nextSelection[0] ?? null;
  }, [clipboard, onInsertUdos, selectedIndices, udos.length]);

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
      minSecondSize={300}
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
          onCutSelection={handleCutSelection}
          onPasteSelection={handlePasteSelection}
          onExportBlueUdo={handleExportBlue}
          onExportCsoundUdo={handleExportCsound}
          onMoveSelectionUp={handleMoveSelectionUp}
          onMoveSelectionDown={handleMoveSelectionDown}
          canPaste={clipboard.length > 0}
        />
      }
      second={
        <UdoEditor
          udo={selectedUdo}
          onUpdateUdo={handleUpdateSelectedUdo}
          onConvertStyle={handleConvertSelectedStyle}
          onTestOpcode={handleTestSelectedUdo}
        />
      }
    />
  );
}
