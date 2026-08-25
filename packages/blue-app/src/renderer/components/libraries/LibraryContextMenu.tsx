import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  getLibraryTransferSourceType,
  type LibraryBrowseNode,
  type LibraryInteractionClipboard,
} from '../../../shared/unified-library';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../hooks/host-portals';

interface LibraryContextMenuProps {
  node: LibraryBrowseNode;
  clipboard: LibraryInteractionClipboard | null;
  children: React.ReactNode;
  onCreateFolder?: (node: LibraryBrowseNode) => void;
  onDuplicate?: (node: LibraryBrowseNode) => void;
  onCut?: (node: LibraryBrowseNode) => void;
  onCopy?: (node: LibraryBrowseNode) => void;
  onPaste?: (node: LibraryBrowseNode) => void;
  onImportInstrument?: (node: LibraryBrowseNode) => void;
  onExportInstrument?: (node: LibraryBrowseNode) => void;
  onDelete?: (node: LibraryBrowseNode) => void;
  onMoveUp?: (node: LibraryBrowseNode) => void;
  onMoveDown?: (node: LibraryBrowseNode) => void;
}

const ITEM_CLASS = 'editor-context-menu__item';

export function LibraryContextMenu({
  node,
  clipboard,
  children,
  onCreateFolder,
  onDuplicate,
  onCut,
  onCopy,
  onPaste,
  onImportInstrument,
  onExportInstrument,
  onDelete,
  onMoveUp,
  onMoveDown,
}: LibraryContextMenuProps): React.ReactElement {
  const userOwned = node.scope === 'user';
  const canContainChildren = node.nodeKind === 'folder' || node.nodeKind === 'root';
  const hasPasteDestination = canContainChildren || (node.nodeKind === 'item' && node.parentId !== null);
  const pasteCompatible = Boolean(
    clipboard
    && getLibraryTransferSourceType(clipboard.source) === node.libraryType
    && hasPasteDestination,
  );
  const canImportInstrument = userOwned
    && node.libraryType === 'instrument'
    && canContainChildren
    && onImportInstrument;
  const canExportInstrument = userOwned
    && node.libraryType === 'instrument'
    && node.nodeKind === 'item'
    && onExportInstrument;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <PopoutContextMenuPortal>
        <ContextMenu.Content
          aria-label={`${node.displayName} commands`}
          className="editor-context-menu z-[1000] min-w-40"
          collisionPadding={8}
          data-auxiliary-portal="true"
          {...portalEventIsolationProps}
        >
          {canContainChildren && userOwned && onCreateFolder && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onCreateFolder(node)}>Create Folder…</ContextMenu.Item>
          )}
          {userOwned && node.nodeKind !== 'root' && onDuplicate && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onDuplicate(node)}>Duplicate</ContextMenu.Item>
          )}
          {node.nodeKind !== 'root' && onCut && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onCut(node)}>Cut</ContextMenu.Item>
          )}
          {((userOwned && node.nodeKind !== 'root') || (!userOwned && node.nodeKind === 'item')) && onCopy && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onCopy(node)}>Copy</ContextMenu.Item>
          )}
          {onPaste && (
            <ContextMenu.Item
              disabled={!pasteCompatible}
              aria-label={pasteCompatible ? 'Paste' : 'Paste unavailable for this destination'}
              className={ITEM_CLASS}
              onSelect={() => onPaste(node)}
            >
              Paste
            </ContextMenu.Item>
          )}
          {(canImportInstrument || canExportInstrument) && (
            <>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              {canImportInstrument && (
                <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onImportInstrument?.(node)}>
                  Import…
                </ContextMenu.Item>
              )}
              {canExportInstrument && (
                <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onExportInstrument?.(node)}>
                  Export…
                </ContextMenu.Item>
              )}
            </>
          )}
          {userOwned && node.nodeKind !== 'root' && (onMoveUp || onMoveDown) && (
            <>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item disabled={!onMoveUp} className={ITEM_CLASS} onSelect={() => onMoveUp?.(node)}>Move Up</ContextMenu.Item>
              <ContextMenu.Item disabled={!onMoveDown} className={ITEM_CLASS} onSelect={() => onMoveDown?.(node)}>Move Down</ContextMenu.Item>
            </>
          )}
          {onDelete && node.nodeKind !== 'root' && (
            <>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className={`${ITEM_CLASS} text-red-300`} onSelect={() => onDelete(node)}>Delete…</ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}
