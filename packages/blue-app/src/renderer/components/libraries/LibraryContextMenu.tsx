import * as ContextMenu from '@radix-ui/react-context-menu';
import type { LibraryBrowseNode, LibraryInteractionClipboard } from '../../../shared/unified-library';

interface LibraryContextMenuProps {
  node: LibraryBrowseNode;
  clipboard: LibraryInteractionClipboard | null;
  children: React.ReactNode;
  onCreateFolder?: (node: LibraryBrowseNode) => void;
  onDuplicate?: (node: LibraryBrowseNode) => void;
  onCut?: (node: LibraryBrowseNode) => void;
  onCopy?: (node: LibraryBrowseNode) => void;
  onPaste?: (node: LibraryBrowseNode) => void;
  onDelete?: (node: LibraryBrowseNode) => void;
  onCopyToUser?: (node: LibraryBrowseNode) => void;
}

const ITEM_CLASS = 'flex cursor-default select-none items-center rounded px-2 py-1.5 text-xs text-app-text outline-none data-[highlighted]:bg-app-selection data-[disabled]:opacity-40';

export function LibraryContextMenu({
  node,
  clipboard,
  children,
  onCreateFolder,
  onDuplicate,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onCopyToUser,
}: LibraryContextMenuProps): React.ReactElement {
  const userOwned = node.scope === 'user';
  const canContainChildren = node.nodeKind === 'folder' || node.nodeKind === 'root';
  const pasteCompatible = Boolean(
    clipboard
    && clipboard.source.kind === 'userNode'
    && clipboard.source.libraryType === node.libraryType
    && userOwned
    && canContainChildren,
  );
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          aria-label={`${node.displayName} commands`}
          className="z-[1000] min-w-40 rounded border border-app-border bg-app-panel p-1 shadow-xl"
          collisionPadding={8}
        >
          {canContainChildren && userOwned && onCreateFolder && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onCreateFolder(node)}>Create Folder…</ContextMenu.Item>
          )}
          {userOwned && node.nodeKind !== 'root' && onDuplicate && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onDuplicate(node)}>Duplicate</ContextMenu.Item>
          )}
          {userOwned && node.nodeKind !== 'root' && onCut && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onCut(node)}>Cut</ContextMenu.Item>
          )}
          {userOwned && node.nodeKind !== 'root' && onCopy && (
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
          {!userOwned && node.nodeKind === 'item' && onCopyToUser && (
            <ContextMenu.Item className={ITEM_CLASS} onSelect={() => onCopyToUser(node)}>Copy to User Library…</ContextMenu.Item>
          )}
          {onDelete && node.nodeKind !== 'root' && (
            <>
              <ContextMenu.Separator className="my-1 h-px bg-app-border" />
              <ContextMenu.Item className={`${ITEM_CLASS} text-red-300`} onSelect={() => onDelete(node)}>Delete…</ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
