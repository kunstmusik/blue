import React from 'react';
import WidgetWrapper from './WidgetWrapper';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetComponentProps } from './widget-component-props';

type BSBValueWidgetProps = BSBWidgetComponentProps;

function BSBValueWidget({
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
}: BSBValueWidgetProps): React.ReactElement {
  const displaySize = getWidgetDisplaySize(node);

  if (editEnabled) {
    return (
      <WidgetWrapper node={node} isSelected={isSelected} editEnabled={editEnabled} onWidgetSelect={onWidgetSelect} displayWidth={displaySize.width} displayHeight={displaySize.height} resizeMeta={resizeMeta} gridSnapEnabled={gridSnapEnabled} gridSnapWidth={gridSnapWidth} gridSnapHeight={gridSnapHeight} onBsbInterfacePatch={onBsbInterfacePatch} selectedWidgetIds={selectedWidgetIds} getWidgetPosition={getWidgetPosition} onWidgetAction={onWidgetAction}>
        <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden rounded border border-blue-border/40 bg-blue-surface/30 text-role-subheadline text-blue-muted">
          {node.objectName || 'BSBValue'}
        </div>
      </WidgetWrapper>
    );
  }

  const value = typeof node.properties.defaultValue === 'number'
    ? node.properties.defaultValue
    : typeof node.properties.value === 'number'
      ? node.properties.value
      : node.value;

  return (
    <WidgetWrapper node={node} isSelected={isSelected} editEnabled={editEnabled} onWidgetSelect={onWidgetSelect} displayWidth={displaySize.width} displayHeight={displaySize.height} resizeMeta={resizeMeta} gridSnapEnabled={gridSnapEnabled} gridSnapWidth={gridSnapWidth} gridSnapHeight={gridSnapHeight} onBsbInterfacePatch={onBsbInterfacePatch} selectedWidgetIds={selectedWidgetIds} getWidgetPosition={getWidgetPosition} onWidgetAction={onWidgetAction}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded border border-blue-border/40 bg-app-bsb-input">
        <span className="font-mono text-role-body text-blue-accent">{value.toFixed(4)}</span>
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBValueWidget);
