import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { getWidgetDisplaySize } from './utils';
import BsbTextLabel from './BsbTextLabel';
import WidgetWrapper from './WidgetWrapper';
import type { BSBWidgetComponentProps } from './widget-component-props';

type BSBDropdownWidgetProps = BSBWidgetComponentProps;

function BSBDropdownWidget({
  node,
  isSelected,
  editEnabled,
  onWidgetSelect,
  onBsbInterfacePatch,
  resizeMeta,
  gridSnapEnabled,
  gridSnapWidth,
  gridSnapHeight,
  selectedWidgetIds,
  getWidgetPosition,
  onWidgetAction,
}: BSBDropdownWidgetProps): React.ReactElement {
  const selectedIndex = typeof node.properties.selectedIndex === 'number' ? node.properties.selectedIndex : 0;
  const fontSize = typeof node.properties.fontSize === 'number' ? node.properties.fontSize : 12;
  const itemsRaw = node.properties.dropdownItems;
  const displaySize = getWidgetDisplaySize(node);

  const items: Array<{ name?: string; value?: string }> = Array.isArray(itemsRaw) ? itemsRaw as Array<{ name?: string; value?: string }> : [];

  let displayText = node.objectName || 'Dropdown';
  if (items.length > 0) {
    const idx = Math.min(selectedIndex, items.length - 1);
    if (items[idx]?.name) {
      displayText = items[idx].name!;
    }
  }

  const handleItemSelect = (index: number) => {
    onBsbInterfacePatch?.({
      type: 'updateWidgetProperties',
      widgetId: node.id,
      properties: { selectedIndex: index },
    });
  };

  return (
    <WidgetWrapper node={node} isSelected={isSelected} editEnabled={editEnabled} onWidgetSelect={onWidgetSelect} displayWidth={displaySize.width} displayHeight={displaySize.height} resizeMeta={resizeMeta} gridSnapEnabled={gridSnapEnabled} gridSnapWidth={gridSnapWidth} gridSnapHeight={gridSnapHeight} onBsbInterfacePatch={onBsbInterfacePatch} selectedWidgetIds={selectedWidgetIds} getWidgetPosition={getWidgetPosition} onWidgetAction={onWidgetAction}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild disabled={items.length === 0}>
          <button
            type="button"
            className="flex h-full w-full items-center justify-between gap-1 rounded border border-blue-border bg-app-bsb-control px-2 py-1 text-role-body text-app-text-strong outline-none hover:bg-blue-accent/20 disabled:cursor-default disabled:hover:bg-app-bsb-control"
            style={{ fontFamily: 'Roboto, sans-serif', fontSize, pointerEvents: editEnabled ? 'none' : undefined }}
          >
            <BsbTextLabel text={displayText} plainClassName="truncate" htmlClassName="inline-block max-w-full" />
            <ChevronDown size={12} className="shrink-0" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-50 min-w-37.5 rounded-md border border-blue-border bg-app-surface-strong p-1 shadow-lg">
            {items.map((item, i) => (
              <DropdownMenu.Item
                key={i}
                className="cursor-pointer px-2 py-1 text-role-body text-app-text-strong outline-none hover:bg-blue-accent/20"
                onClick={() => handleItemSelect(i)}
                style={{ fontFamily: 'Roboto, sans-serif', fontSize }}
              >
                <BsbTextLabel text={item.name || item.value || `Item ${i}`} plainClassName="block" htmlClassName="inline-block max-w-full" />
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </WidgetWrapper>
  );
}

export default React.memo(BSBDropdownWidget);
