import React, { useCallback } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ChevronRight, Import, Plus } from 'lucide-react';

import type { UdoDefinitionSnapshot } from '../../../../../shared/project-editor';
import type {
  LibraryBrowseNode,
  LibraryExactTransferTarget,
} from '../../../../../shared/unified-library';
import { getLibraryTransferSourceType } from '../../../../../shared/unified-library';
import {
  LibraryBlockDropMarker,
  LibraryDropZone,
  LibraryTableDropMarker,
  type LibraryDropZoneState,
} from '../../../libraries/LibraryDropMarker';
import { useLibraryStore } from '../../../../stores/library-store';
import { isTextEditingTarget } from '../../../../hooks/use-keyboard-shortcuts';
import { ProjectLibraryDragSource } from '../../../libraries/ProjectLibraryDragSource';

export interface UdoSelectionGesture {
  range: boolean;
  toggle: boolean;
}

export interface UdoLibraryDropTarget {
  projectSessionId: number;
  projectRevision: number;
  instrumentAssignmentId?: string;
  track?: { readonly rootGroupId: string; readonly trackId: string };
}

export function getProjectUdoSessionObjectId(
  target: UdoLibraryDropTarget | undefined,
  index: number,
): string {
  return target?.track
    ? `track:${target.track.rootGroupId}:${target.track.trackId}:udo:${index}`
    : target?.instrumentAssignmentId
    ? `instrument:${target.instrumentAssignmentId}:udo:${index}`
    : `udo:${index}`;
}

function createProjectUdoTarget(
  target: UdoLibraryDropTarget,
  insertIndex: number,
): LibraryExactTransferTarget {
  return {
    kind: 'projectUdo',
    ...target,
    insertIndex,
  };
}

interface UdoTableProps {
  udolist: UdoDefinitionSnapshot[];
  selectedIndices: number[];
  onSelectIndex: (index: number, gesture?: UdoSelectionGesture) => void;
  onContextSelectIndex: (index: number) => void;
  onAddUdo: () => void;
  onImportBlueUdo: () => void;
  onImportCsoundUdo: () => void;
  onRemoveSelection: () => void;
  onCopySelection: (operation: 'copy' | 'cut') => void;
  onExportBlueUdo: () => void;
  onExportCsoundUdo: () => void;
  onMoveSelectionUp: () => void;
  onMoveSelectionDown: () => void;
  projectNodes?: readonly LibraryBrowseNode[];
  libraryDropTarget?: UdoLibraryDropTarget;
}

function MenuItem({
  children,
  disabled,
  onSelect,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <ContextMenu.Item
      className="editor-context-menu__item"
      disabled={disabled}
      onSelect={onSelect}
    >
      {children}
    </ContextMenu.Item>
  );
}

export default function UdoTable({
  udolist,
  selectedIndices,
  onSelectIndex,
  onContextSelectIndex,
  onAddUdo,
  onImportBlueUdo,
  onImportCsoundUdo,
  onRemoveSelection,
  onCopySelection,
  onExportBlueUdo,
  onExportCsoundUdo,
  onMoveSelectionUp,
  onMoveSelectionDown,
  projectNodes = [],
  libraryDropTarget,
}: UdoTableProps): React.ReactElement {
  const hasSelection = selectedIndices.length > 0;
  const hasSingleSelection = selectedIndices.length === 1;
  const canMoveUp = hasSelection && Math.min(...selectedIndices) > 0;
  const canMoveDown = hasSelection && Math.max(...selectedIndices) < udolist.length - 1;
  const libraryClipboard = useLibraryStore((state) => state.clipboard);
  const transferLibraryItem = useLibraryStore((state) => state.transferToProject);
  const libraryUdoAvailable = libraryClipboard
    ? getLibraryTransferSourceType(libraryClipboard.source) === 'udo'
    : false;

  const pasteLibraryUdo = useCallback((insertIndex: number) => {
    if (
      !libraryDropTarget
      || !libraryClipboard
      || getLibraryTransferSourceType(libraryClipboard.source) !== 'udo'
    ) return;
    void transferLibraryItem(
      { kind: 'clipboard', source: libraryClipboard.source },
      createProjectUdoTarget(libraryDropTarget, insertIndex),
    );
  }, [libraryClipboard, libraryDropTarget, transferLibraryItem]);

  const handleRowClick = useCallback(
    (index: number, event: React.MouseEvent<HTMLTableRowElement>) => {
      onSelectIndex(index, {
        range: event.shiftKey,
        toggle: event.metaKey || event.ctrlKey,
      });
    },
    [onSelectIndex],
  );

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <div className="flex items-center gap-2 border-b border-app-border bg-app-surface-strong px-3 py-2">
        <button
          type="button"
          onClick={onAddUdo}
          className="flex items-center gap-1 rounded px-2 py-1 text-role-body text-app-text-strong hover:bg-app-accent/20"
          title="Add UDO"
        >
          <Plus size={14} />
          Add
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded px-2 py-1 text-role-body text-app-text-strong hover:bg-app-accent/20"
              title="Import UDO"
            >
              <Import size={14} />
              Import
              <ChevronDown size={12} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="editor-context-menu"
              align="start"
            >
              <DropdownMenu.Item
                className="editor-context-menu__item"
                onSelect={onImportBlueUdo}
              >
                Blue UDO (.blueUDO)
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="editor-context-menu__item"
                onSelect={onImportCsoundUdo}
              >
                Csound UDO (.udo/.orc/.csd)
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-auto bg-black"
        data-library-autoscroll
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey)
            && event.key.toLocaleLowerCase() === 'v'
            && libraryUdoAvailable
            && !isTextEditingTarget(event.target)
          ) {
            event.preventDefault();
            const lastSelectedIndex = selectedIndices.length > 0
              ? Math.max(...selectedIndices)
              : udolist.length - 1;
            pasteLibraryUdo(lastSelectedIndex + 1);
          }
        }}
      >
          <table className="w-full shrink-0 text-left text-role-body">
            <thead className="sticky top-0 bg-app-surface-strong">
              <tr className="border-b border-app-border">
                <th className="px-3 py-2 font-medium text-app-text-strong">Name</th>
                <th className="px-3 py-2 font-medium text-app-text-strong">Style</th>
                <th className="px-3 py-2 font-medium text-app-text-strong">Out Types</th>
                <th className="px-3 py-2 font-medium text-app-text-strong">
                  In Types / Input Args
                </th>
              </tr>
            </thead>
            <tbody>
              {udolist.map((udo, index) => {
                const isSelected = selectedIndices.includes(index);
                const projectNode = projectNodes.find((node) => (
                  node.key?.scope === 'projectOwned'
                  && node.key.locator.kind === 'udo'
                  && node.key.locator.sessionObjectId
                    === getProjectUdoSessionObjectId(libraryDropTarget, index)
                )) ?? null;
                const row = (active: boolean, dropProps: Partial<LibraryDropZoneState['dropProps']>) => (
                  <ContextMenu.Root>
                    <ContextMenu.Trigger asChild>
                      <ProjectLibraryDragSource node={projectNode}>
                      <tr
                        {...dropProps}
                        data-library-drop-target={libraryDropTarget ? 'udo-row' : undefined}
                        aria-selected={isSelected}
                        onClick={(event) => handleRowClick(index, event)}
                        onContextMenu={() => onContextSelectIndex(index)}
                        className={[
                          'cursor-pointer border-b border-app-border hover:bg-app-accent/10',
                          active ? 'ring-1 ring-inset ring-app-accent' : '',
                          isSelected ? 'bg-app-accent/20' : '',
                        ].join(' ')}
                      >
                        <td className="px-3 py-2 text-app-text-strong">{udo.name}</td>
                        <td className="px-3 py-2">
                          <span
                            className={[
                              'rounded px-1.5 py-0.5 text-role-subheadline font-medium',
                              udo.style === 'CLASSIC'
                                ? 'bg-app-accent/20 text-app-accent'
                                : 'bg-app-surface-raised text-app-text-strong',
                            ].join(' ')}
                          >
                            {udo.style}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-app-text">{udo.outTypes || '-'}</td>
                        <td className="px-3 py-2 text-app-text">
                          {udo.style === 'CLASSIC'
                            ? udo.inTypes || '-'
                            : udo.inputArguments || '-'}
                        </td>
                      </tr>
                      </ProjectLibraryDragSource>
                    </ContextMenu.Trigger>
                    <ContextMenu.Portal>
                      <ContextMenu.Content className="editor-context-menu">
                        <MenuItem disabled={!canMoveUp} onSelect={onMoveSelectionUp}>
                          Push Up
                        </MenuItem>
                        <MenuItem disabled={!canMoveDown} onSelect={onMoveSelectionDown}>
                          Push Down
                        </MenuItem>
                        <ContextMenu.Separator className="editor-context-menu__separator" />
                        <MenuItem disabled={!hasSingleSelection || !projectNode} onSelect={() => onCopySelection('copy')}>
                          Copy
                        </MenuItem>
                        <MenuItem disabled={!hasSingleSelection || !projectNode} onSelect={() => onCopySelection('cut')}>
                          Cut
                        </MenuItem>
                        <MenuItem
                          disabled={!libraryUdoAvailable}
                          onSelect={() => pasteLibraryUdo(index + 1)}
                        >
                          Paste
                        </MenuItem>
                        <ContextMenu.Separator className="editor-context-menu__separator" />
                        <ContextMenu.Sub>
                          <ContextMenu.SubTrigger
                            className="editor-context-menu__item editor-context-menu__subtrigger"
                            disabled={!hasSingleSelection}
                          >
                            <span>Export</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                          </ContextMenu.SubTrigger>
                          <ContextMenu.Portal>
                            <ContextMenu.SubContent className="editor-context-menu">
                              <ContextMenu.Item
                                className="editor-context-menu__item"
                                disabled={!hasSingleSelection}
                                onSelect={onExportBlueUdo}
                              >
                                Blue UDO (.blueUDO)
                              </ContextMenu.Item>
                              <ContextMenu.Item
                                className="editor-context-menu__item"
                                disabled={!hasSingleSelection}
                                onSelect={onExportCsoundUdo}
                              >
                                Csound UDO (.udo)
                              </ContextMenu.Item>
                            </ContextMenu.SubContent>
                          </ContextMenu.Portal>
                        </ContextMenu.Sub>
                        <ContextMenu.Separator className="editor-context-menu__separator" />
                        <MenuItem disabled={!hasSelection} onSelect={onRemoveSelection}>
                          Remove
                        </MenuItem>
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                );
                return (
                  <React.Fragment key={`${udo.name}-${index}`}>
                  {libraryDropTarget && (
                    <LibraryTableDropMarker
                      target={createProjectUdoTarget(libraryDropTarget, index)}
                      colSpan={4}
                      label={`Insert UDO before ${udo.name}`}
                    />
                  )}
                  {libraryDropTarget ? (
                    <LibraryDropZone
                      target={createProjectUdoTarget(libraryDropTarget, index + 1)}
                    >
                      {({ active, dropProps }) => row(active, dropProps)}
                    </LibraryDropZone>
                  ) : row(false, {})}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {libraryDropTarget && (
            <LibraryBlockDropMarker
              target={createProjectUdoTarget(libraryDropTarget, udolist.length)}
              label="Insert UDO at end"
              fillRemaining
            />
          )}
      </div>
    </div>
  );
}
