import React from 'react';
import WidgetWrapper from './WidgetWrapper';
import type { BSBWidgetComponentProps } from './widget-component-props';

type PreservedWidgetProps = BSBWidgetComponentProps;

function PreservedWidget({
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
}: PreservedWidgetProps): React.ReactElement {
  return (
    <WidgetWrapper
      node={node}
      isSelected={isSelected}
      editEnabled={editEnabled}
      onWidgetSelect={onWidgetSelect}
      resizeMeta={resizeMeta}
      gridSnapEnabled={gridSnapEnabled}
      gridSnapWidth={gridSnapWidth}
      gridSnapHeight={gridSnapHeight}
      onBsbInterfacePatch={onBsbInterfacePatch}
      selectedWidgetIds={selectedWidgetIds}
      getWidgetPosition={getWidgetPosition}
      onWidgetAction={onWidgetAction}
    >
      <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden rounded border border-blue-border/40 bg-blue-surface/30 text-role-callout text-blue-muted">
        {node.objectName || node.type}
        <span className="ml-1 text-yellow-500">[?]</span>
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(PreservedWidget);
