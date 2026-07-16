import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical } from 'lucide-react';
import type { LibraryType } from '../../../shared/unified-library';

interface LibraryActionsMenuProps {
  selectedType: LibraryType | 'all';
  onImport: () => void;
  onExportCurrent: () => void;
  onExportAll: () => void;
  onHistory: () => void;
  hasMigrationReport?: boolean;
  onMigrationReport?: () => void;
}

const ITEM_CLASS = 'flex cursor-default select-none items-center rounded px-2 py-1.5 text-xs text-app-text outline-none data-[highlighted]:bg-app-selection data-[disabled]:opacity-40';

export function LibraryActionsMenu({ selectedType, onImport, onExportCurrent, onExportAll, onHistory, hasMigrationReport = false, onMigrationReport }: LibraryActionsMenuProps): React.ReactElement {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Library actions"
          title="Library actions"
          className="grid h-7 w-7 shrink-0 place-items-center rounded text-app-text-muted hover:bg-app-hover hover:text-app-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent"
        >
          <MoreVertical size={16} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={8} className="z-[1000] min-w-44 rounded border border-app-border bg-app-panel p-1 shadow-xl">
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={onImport}>Import XML…</DropdownMenu.Item>
          <DropdownMenu.Item
            className={ITEM_CLASS}
            disabled={selectedType === 'all'}
            aria-label={selectedType === 'all' ? 'Export Current unavailable when all library types are shown' : 'Export Current'}
            onSelect={onExportCurrent}
          >Export Current…</DropdownMenu.Item>
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={onExportAll}>Export All…</DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-app-border" />
          <DropdownMenu.Item className={ITEM_CLASS} onSelect={onHistory}>Import History…</DropdownMenu.Item>
          {hasMigrationReport && onMigrationReport && (
            <DropdownMenu.Item className={ITEM_CLASS} onSelect={onMigrationReport}>Migration Report…</DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
