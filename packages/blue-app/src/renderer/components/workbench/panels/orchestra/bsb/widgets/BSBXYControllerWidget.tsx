import React, { useCallback, useRef } from 'react';
import { BSB_XY_READOUT_HEIGHT } from '../../../../../../../shared/bsb-widget-layout';
import WidgetWrapper from './WidgetWrapper';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetComponentProps } from './widget-component-props';

type BSBXYControllerWidgetProps = BSBWidgetComponentProps;

function BSBXYControllerWidget({
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
}: BSBXYControllerWidgetProps): React.ReactElement {
  const xValue = typeof node.properties.xValue === 'number' ? node.properties.xValue : 0;
  const yValue = typeof node.properties.yValue === 'number' ? node.properties.yValue : 0;
  const xMin = typeof node.properties.xMin === 'number' ? node.properties.xMin : 0;
  const xMax = typeof node.properties.xMax === 'number' ? node.properties.xMax : 1;
  const yMin = typeof node.properties.yMin === 'number' ? node.properties.yMin : 0;
  const yMax = typeof node.properties.yMax === 'number' ? node.properties.yMax : 1;
  const showValue = node.properties.valueDisplayEnabled === true;

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xPct = Math.max(0, Math.min(1, (xValue - xMin) / xRange));
  const yPct = Math.max(0, Math.min(1, (yValue - yMin) / yRange));
  const displaySize = getWidgetDisplaySize(node);

  const padRef = useRef<HTMLDivElement | null>(null);
  const patchRef = useRef(onBsbInterfacePatch);
  patchRef.current = onBsbInterfacePatch;
  const paramsRef = useRef({ nodeId: node.id, xMin, xMax, yMin, yMax, xRange, yRange });
  paramsRef.current = { nodeId: node.id, xMin, xMax, yMin, yMax, xRange, yRange };

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const { nodeId, xMin: xn, xRange: xr, yMin: yn, yRange: yr } = paramsRef.current;
    patchRef.current?.({
      type: 'updateWidgetProperties',
      widgetId: nodeId,
      properties: { xValue: xn + px * xr, yValue: yn + py * yr },
    });
  }, []);

  return (
    <WidgetWrapper
      node={node}
      isSelected={isSelected}
      editEnabled={editEnabled}
      onWidgetSelect={onWidgetSelect}
      displayWidth={displaySize.width}
      displayHeight={displaySize.height}
      resizeMeta={resizeMeta}
      gridSnapEnabled={gridSnapEnabled}
      gridSnapWidth={gridSnapWidth}
      gridSnapHeight={gridSnapHeight}
      onBsbInterfacePatch={onBsbInterfacePatch}
      selectedWidgetIds={selectedWidgetIds}
      getWidgetPosition={getWidgetPosition}
      onWidgetAction={onWidgetAction}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded border border-blue-border/40 bg-blue-surface/30">
        <div
          ref={padRef}
          className="relative flex-1 min-h-0 bg-app-bsb-input"
          style={{ cursor: editEnabled ? 'default' : 'crosshair' }}
          onMouseDown={
            editEnabled
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  updateFromPointer(e.clientX, e.clientY);
                  const onMove = (ev: MouseEvent) => {
                    ev.preventDefault();
                    updateFromPointer(ev.clientX, ev.clientY);
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }
          }
        >
          <div
            className="absolute h-px w-full bg-blue-border/20"
            style={{ top: `${yPct * 100}%` }}
          />
          <div
            className="absolute h-full w-px bg-blue-border/20"
            style={{ left: `${xPct * 100}%` }}
          />
          <div
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-accent"
            style={{ left: `${xPct * 100}%`, top: `${yPct * 100}%` }}
          />
        </div>
        {showValue && (
          <div
            className="flex shrink-0 items-center justify-center gap-2 border-t border-blue-border/20 px-1 text-role-callout text-blue-muted"
            style={{ height: BSB_XY_READOUT_HEIGHT }}
          >
            <span>x: {xValue.toFixed(2)}</span>
            <span>y: {yValue.toFixed(2)}</span>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBXYControllerWidget);
