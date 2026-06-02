import React, { useCallback } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Import, Plus } from 'lucide-react';

import type { UdoDefinitionSnapshot } from '../../../../../shared/project-editor';

export interface UdoSelectionGesture {
  range: boolean;
  toggle: boolean;
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
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteSelection: () => void;
  onExportBlueUdo: () => void;
  onExportCsoundUdo: () => void;
  onMoveSelectionUp: () => void;
  onMoveSelectionDown: () => void;
  canPaste: boolean;
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
  onCutSelection,
  onPasteSelection,
  onExportBlueUdo,
  onExportCsoundUdo,
  onMoveSelectionUp,
  onMoveSelectionDown,
  canPaste,
}: UdoTableProps): React.ReactElement {
  const hasUdos = udolist.length > 0;
  const hasSelection = selectedIndices.length > 0;
  const hasSingleSelection = selectedIndices.length === 1;
  const canMoveUp = hasSelection && Math.min(...selectedIndices) > 0;
  const canMoveDown = hasSelection && Math.max(...selectedIndices) < udolist.length - 1;

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
          className="flex items-center gap-1 rounded px-2 py-1 text-body text-app-text-strong hover:bg-app-accent/20"
          title="Add UDO"
        >
          <Plus size={14} />
          Add
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded px-2 py-1 text-body text-app-text-strong hover:bg-app-accent/20"
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

      <div className="flex-1 overflow-auto">
        {!hasUdos ? (
          <div className="flex h-full items-center justify-center text-sm text-app-text-muted">
            No UDOs defined. Click &quot;Add&quot; to create one.
          </div>
        ) : (
          <table className="w-full text-left text-body">
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
                return (
                  <ContextMenu.Root key={`${udo.name}-${index}`}>
                    <ContextMenu.Trigger asChild>
                      <tr
                        aria-selected={isSelected}
                        onClick={(event) => handleRowClick(index, event)}
                        onContextMenu={() => onContextSelectIndex(index)}
                        className={[
                          'cursor-pointer border-b border-app-border hover:bg-app-accent/10',
                          isSelected ? 'bg-app-accent/20' : '',
                        ].join(' ')}
                      >
                        <td className="px-3 py-2 text-app-text-strong">{udo.name}</td>
                        <td className="px-3 py-2">
                          <span
                            className={[
                              'rounded px-1.5 py-0.5 text-tiny font-medium',
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
                        <MenuItem disabled={!hasSelection} onSelect={onCopySelection}>
                          Copy
                        </MenuItem>
                        <MenuItem disabled={!hasSelection} onSelect={onCutSelection}>
                          Cut
                        </MenuItem>
                        <MenuItem disabled={!canPaste} onSelect={onPasteSelection}>
                          Paste
                        </MenuItem>
                        <ContextMenu.Separator className="editor-context-menu__separator" />
                        <ContextMenu.Sub>
                          <ContextMenu.SubTrigger
                            className="editor-context-menu__item editor-context-menu__subtrigger"
                            disabled={!hasSingleSelection}
                          >
                            Export
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
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
