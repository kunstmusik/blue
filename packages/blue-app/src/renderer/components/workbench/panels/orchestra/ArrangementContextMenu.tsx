import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import type {
  ArrangementRowSnapshot,
  SupportedNewInstrumentType,
} from '../../../../../shared/project-editor';
import type { OrchestraMutationProps } from './types';

interface ArrangementContextMenuProps extends OrchestraMutationProps {
  row: ArrangementRowSnapshot;
  hasClipboard: boolean;
  onCopy: (assignmentId: string) => void;
  onCut: (assignmentId: string) => void;
  onPaste: () => void;
  children: React.ReactNode;
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

function AddInstrumentSubmenu({
  onAdd,
}: {
  onAdd: (instrumentType: SupportedNewInstrumentType) => void;
}): React.ReactElement {
  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger">
        <span>Add Instrument</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent
          className="editor-context-menu editor-context-menu--submenu"
          sideOffset={2}
          alignOffset={-4}
        >
          <MenuItem onSelect={() => onAdd('generic')}>Generic Instrument</MenuItem>
          <MenuItem onSelect={() => onAdd('python')}>Python Instrument</MenuItem>
          <MenuItem onSelect={() => onAdd('javascript')}>JavaScript Instrument</MenuItem>
          <MenuItem onSelect={() => onAdd('blueX7')}>BlueX7</MenuItem>
          <MenuItem onSelect={() => onAdd('blueSynthBuilder')}>
            BlueSynthBuilder
          </MenuItem>
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
}

export default function ArrangementContextMenu({
  row,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onOrchestraPatch,
  children,
}: ArrangementContextMenuProps): React.ReactElement {
  const addInstrument = (instrumentType: SupportedNewInstrumentType) => {
    void onOrchestraPatch({
      type: 'addInstrument',
      instrumentType,
      insertAfterAssignmentId: row.assignmentId,
    });
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu" sideOffset={4}>
          <MenuItem
            onSelect={() =>
              void onOrchestraPatch({
                type: 'updateAssignment',
                assignmentId: row.assignmentId,
                enabled: !row.enabled,
              })
            }
          >
            {row.enabled ? 'Disable' : 'Enable'}
          </MenuItem>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <AddInstrumentSubmenu onAdd={addInstrument} />
          <MenuItem onSelect={() => onCopy(row.assignmentId)}>Copy</MenuItem>
          <MenuItem onSelect={() => onCut(row.assignmentId)}>Cut</MenuItem>
          <MenuItem disabled={!hasClipboard} onSelect={onPaste}>
            Paste
          </MenuItem>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <MenuItem disabled onSelect={() => {}}>
            Import .binstr (deferred)
          </MenuItem>
          <MenuItem disabled onSelect={() => {}}>
            Export .binstr (deferred)
          </MenuItem>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <MenuItem
            onSelect={() =>
              void onOrchestraPatch({
                type: 'replaceInstrument',
                assignmentId: row.assignmentId,
                instrumentType: 'generic',
              })
            }
          >
            Replace with Generic
          </MenuItem>
          <MenuItem
            disabled={row.instrumentType !== 'generic'}
            onSelect={() =>
              void onOrchestraPatch({
                type: 'convertGenericToBsb',
                assignmentId: row.assignmentId,
              })
            }
          >
            Convert Generic to BSB
          </MenuItem>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <MenuItem
            onSelect={() =>
              void onOrchestraPatch({
                type: 'removeAssignment',
                assignmentId: row.assignmentId,
              })
            }
          >
            Remove
          </MenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
