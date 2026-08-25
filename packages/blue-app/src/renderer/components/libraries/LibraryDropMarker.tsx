import type { LibraryExactTransferTarget } from '../../../shared/unified-library';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useId } from 'react';
import { useLibraryDropTarget } from './use-library-drop-target';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../hooks/host-portals';

export type LibraryDropZoneState = ReturnType<typeof useLibraryDropTarget>;

const MENU_ITEM_CLASS = 'editor-context-menu__item';

function DropContextMenu({
  canPaste,
  paste,
  children,
}: {
  canPaste: boolean;
  paste: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <PopoutContextMenuPortal>
        <ContextMenu.Content
          className="editor-context-menu z-[1000] min-w-32"
          data-auxiliary-portal="true"
          {...portalEventIsolationProps}
        >
          <ContextMenu.Item disabled={!canPaste} className={MENU_ITEM_CLASS} onSelect={paste}>
            Paste
          </ContextMenu.Item>
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}

export function LibraryTableDropMarker({
  target,
  colSpan,
  label,
}: {
  target: LibraryExactTransferTarget;
  colSpan: number;
  label: string;
}): React.ReactElement {
  const { active, canPaste, feedback, dropProps, paste } = useLibraryDropTarget(target);
  const feedbackId = useId();
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <DropContextMenu canPaste={canPaste} paste={paste}>
          <div>
            <div
              {...dropProps}
              tabIndex={0}
              aria-label={`${label}; paste a Library item here`}
              aria-describedby={feedbackId}
              className={`relative h-2 outline-none focus-visible:h-3 focus-visible:bg-app-accent/35 ${active ? 'h-3 bg-app-accent' : ''}`}
            />
            <span id={feedbackId} role="status" aria-live="polite" className="sr-only">{feedback}</span>
          </div>
        </DropContextMenu>
      </td>
    </tr>
  );
}

export function LibraryBlockDropMarker({
  target,
  label,
  fillRemaining = false,
  pasteContextMenu = true,
}: {
  target: LibraryExactTransferTarget;
  label: string;
  fillRemaining?: boolean;
  pasteContextMenu?: boolean;
}): React.ReactElement {
  const { active, canPaste, feedback, dropProps, paste } = useLibraryDropTarget(target);
  const feedbackId = useId();
  const marker = (
    <div
      className={fillRemaining ? 'flex min-h-8 flex-1 flex-col' : undefined}
      data-library-list-end-drop-target={fillRemaining ? true : undefined}
    >
      <div
        {...dropProps}
        tabIndex={0}
        aria-label={`${label}; paste a Library item here`}
        aria-describedby={feedbackId}
        className={[
          'rounded outline-none',
          fillRemaining
            ? 'min-h-8 flex-1 focus-visible:bg-app-accent/20 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-app-accent'
            : 'h-2 focus-visible:h-3 focus-visible:bg-app-accent/35',
          active
            ? fillRemaining
              ? 'bg-app-accent/20 ring-1 ring-inset ring-app-accent'
              : 'h-3 bg-app-accent'
            : '',
        ].join(' ')}
      />
      <span id={feedbackId} role="status" aria-live="polite" className="sr-only">{feedback}</span>
    </div>
  );
  return pasteContextMenu
    ? <DropContextMenu canPaste={canPaste} paste={paste}>{marker}</DropContextMenu>
    : marker;
}

export function LibraryDropZone({
  target,
  enabled = true,
  children,
}: {
  target: LibraryExactTransferTarget;
  enabled?: boolean;
  children: (state: LibraryDropZoneState) => React.ReactElement;
}): React.ReactElement {
  const state = useLibraryDropTarget(target, enabled);
  return children(state);
}
