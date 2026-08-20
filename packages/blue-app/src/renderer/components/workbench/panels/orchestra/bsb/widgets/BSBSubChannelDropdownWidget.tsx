import React from 'react';
import { ChevronDown } from 'lucide-react';
import { getWidgetDisplaySize } from './utils';
import BsbTextLabel from './BsbTextLabel';
import WidgetWrapper from './WidgetWrapper';
import type { BSBWidgetComponentProps } from './widget-component-props';

type BSBSubChannelDropdownWidgetProps = BSBWidgetComponentProps;

function BSBSubChannelDropdownWidget({
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
}: BSBSubChannelDropdownWidgetProps): React.ReactElement {
  const channelOutput = typeof node.properties.channelOutput === 'string' ? node.properties.channelOutput : '';
  const displayText = channelOutput || node.objectName || 'Sub Channel';
  const displaySize = getWidgetDisplaySize(node);

  return (
    <WidgetWrapper node={node} isSelected={isSelected} editEnabled={editEnabled} onWidgetSelect={onWidgetSelect} displayWidth={displaySize.width} displayHeight={displaySize.height} resizeMeta={resizeMeta} gridSnapEnabled={gridSnapEnabled} gridSnapWidth={gridSnapWidth} gridSnapHeight={gridSnapHeight} onBsbInterfacePatch={onBsbInterfacePatch} selectedWidgetIds={selectedWidgetIds} getWidgetPosition={getWidgetPosition} onWidgetAction={onWidgetAction}>
      <button
        type="button"
        aria-disabled="true"
        className="flex h-full w-full items-center justify-between gap-1 rounded border border-blue-border bg-app-bsb-control px-2 py-1 text-role-body text-app-text outline-none"
        style={{ pointerEvents: editEnabled ? 'none' : undefined }}
      >
        <BsbTextLabel text={displayText} plainClassName="truncate" htmlClassName="inline-block max-w-full" />
        <ChevronDown size={12} className="shrink-0" />
      </button>
    </WidgetWrapper>
  );
}

export default React.memo(BSBSubChannelDropdownWidget);
