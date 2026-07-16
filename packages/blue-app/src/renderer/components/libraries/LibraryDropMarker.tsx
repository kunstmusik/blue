import type { LibraryExactTransferTarget } from '../../../shared/unified-library';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useId } from 'react';
import { useLibraryDropTarget } from './use-library-drop-target';

const MENU_ITEM_CLASS = 'cursor-default select-none rounded px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-app-selection data-[disabled]:opacity-40';

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
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-[1000] min-w-32 rounded border border-app-border bg-app-panel p-1 shadow-xl">
          <ContextMenu.Item disabled={!canPaste} className={MENU_ITEM_CLASS} onSelect={paste}>
            Paste
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
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
              className={`relative h-1 outline-none focus-visible:h-2 focus-visible:bg-app-accent/35 ${active ? 'h-2 bg-app-accent' : ''}`}
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
}: {
  target: LibraryExactTransferTarget;
  label: string;
}): React.ReactElement {
  const { active, canPaste, feedback, dropProps, paste } = useLibraryDropTarget(target);
  const feedbackId = useId();
  return (
    <DropContextMenu canPaste={canPaste} paste={paste}>
      <div>
        <div
          {...dropProps}
          tabIndex={0}
          aria-label={`${label}; paste a Library item here`}
          aria-describedby={feedbackId}
          className={`h-1 rounded outline-none focus-visible:h-2 focus-visible:bg-app-accent/35 ${active ? 'h-2 bg-app-accent' : ''}`}
        />
        <span id={feedbackId} role="status" aria-live="polite" className="sr-only">{feedback}</span>
      </div>
    </DropContextMenu>
  );
}
