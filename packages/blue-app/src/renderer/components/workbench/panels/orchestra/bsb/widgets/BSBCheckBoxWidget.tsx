import React, { useCallback } from 'react';
import WidgetWrapper from './WidgetWrapper';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetPatchComponentProps } from './widget-component-props';
import BsbTextLabel from './BsbTextLabel';

type BSBCheckBoxWidgetProps = BSBWidgetPatchComponentProps;

function BSBCheckBoxWidget({
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
}: BSBCheckBoxWidgetProps): React.ReactElement {
  const selected = node.properties.selected === true;
  const labelText = typeof node.properties.label === 'string' ? node.properties.label : node.objectName;
  const displaySize = getWidgetDisplaySize(node);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (editEnabled) {
      onWidgetSelect(node.id);
      return;
    }
    onBsbInterfacePatch({
      type: 'updateWidgetProperties',
      widgetId: node.id,
      properties: { selected: !selected },
    });
  }, [editEnabled, selected, node.id, onWidgetSelect, onBsbInterfacePatch]);

  return (
    <WidgetWrapper node={node} isSelected={isSelected} editEnabled={editEnabled} onWidgetSelect={onWidgetSelect} autoSize displayWidth={displaySize.width} displayHeight={displaySize.height} resizeMeta={resizeMeta} gridSnapEnabled={gridSnapEnabled} gridSnapWidth={gridSnapWidth} gridSnapHeight={gridSnapHeight} onBsbInterfacePatch={onBsbInterfacePatch} selectedWidgetIds={selectedWidgetIds} getWidgetPosition={getWidgetPosition} onWidgetAction={onWidgetAction}>
      <div
        className="flex h-full w-full items-center gap-1.5"
        style={{ fontFamily: 'Roboto, sans-serif', fontSize: 12, cursor: editEnabled ? 'default' : 'pointer', color: 'var(--color-app-text-bright)' }}
        onClick={handleToggle}
      >
        <svg width={13} height={13} className="shrink-0">
          <rect x={0} y={0} width={12} height={12} rx={2} ry={2} fill="rgb(38,51,76)" stroke="rgb(63,102,150)" strokeWidth={1} />
          {selected && (
            <path d="M2 6l3 3 5-5" fill="none" stroke="rgb(240,240,255)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
        <BsbTextLabel text={labelText} plainClassName="block text-[12px]" htmlClassName="inline-block max-w-full text-[12px]" />
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBCheckBoxWidget);
