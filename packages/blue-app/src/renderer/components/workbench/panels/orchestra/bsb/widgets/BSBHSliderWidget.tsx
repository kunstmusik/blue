import React, { useCallback, useRef, useEffect } from 'react';
import {
  BSB_VALUE_PANEL_HEIGHT,
  BSB_VALUE_PANEL_WIDTH,
} from '../../../../../../../shared/bsb-widget-layout';
import WidgetWrapper from './WidgetWrapper';
import { ValuePanel, formatValue } from './ValuePanel';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetPatchComponentProps } from './widget-component-props';

type BSBHSliderWidgetProps = BSBWidgetPatchComponentProps;

const TRACK_H = 4;
const THUMB_R = 7;

function BSBHSliderWidget({
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
}: BSBHSliderWidgetProps): React.ReactElement {
  const sliderWidth =
    typeof node.properties.sliderWidth === 'number' ? node.properties.sliderWidth : 150;
  const displaySize = getWidgetDisplaySize(node);
  const value = node.value;
  const minimum = node.minimum;
  const maximum = node.maximum;
  const showValue = node.properties.valueDisplayEnabled === true;

  const totalWidth = displaySize.width;
  const totalHeight = displaySize.height;
  const range = maximum - minimum || 1;
  const pct = Math.max(0, Math.min(1, (value - minimum) / range));

  const strVal = formatValue(value);
  const displayVal = strVal.length > 7 ? strVal.substring(0, 7) : strVal;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const paramsRef = useRef({ sliderWidth, minimum, range, nodeId: node.id });
  paramsRef.current = { sliderWidth, minimum, range, nodeId: node.id };
  const patchRef = useRef(onBsbInterfacePatch);
  patchRef.current = onBsbInterfacePatch;

  useEffect(() => {
    if (editEnabled) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !svgRef.current) return;
      e.preventDefault();
      const { sliderWidth: sw, minimum: min, range: r, nodeId } = paramsRef.current;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const trackStart = THUMB_R;
      const trackEnd = sw - THUMB_R;
      const newPct = Math.max(0, Math.min(1, (x - trackStart) / (trackEnd - trackStart)));
      const newVal = min + newPct * r;
      patchRef.current({
        type: 'updateWidgetProperties',
        widgetId: nodeId,
        properties: { value: newVal },
      });
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [editEnabled]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (editEnabled) return;
      e.preventDefault();
      dragging.current = true;
      const { sliderWidth: sw, minimum: min, range: r, nodeId } = paramsRef.current;
      const rect = svgRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const trackStart = THUMB_R;
      const trackEnd = sw - THUMB_R;
      const newPct = Math.max(0, Math.min(1, (x - trackStart) / (trackEnd - trackStart)));
      const newVal = min + newPct * r;
      patchRef.current({
        type: 'updateWidgetProperties',
        widgetId: nodeId,
        properties: { value: newVal },
      });
    },
    [editEnabled],
  );

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
      <div className="flex h-full w-full" style={{ width: totalWidth, height: totalHeight }}>
        <svg
          ref={svgRef}
          width={sliderWidth}
          height={totalHeight}
          className="block"
          style={{ cursor: editEnabled ? 'default' : 'pointer' }}
          onMouseDown={handleMouseDown}
        >
          <rect
            x={THUMB_R}
            y={totalHeight / 2 - TRACK_H / 2}
            width={sliderWidth - 2 * THUMB_R}
            height={TRACK_H}
            rx={2}
            ry={2}
            fill="rgb(63,102,150)"
          />
          <rect
            x={THUMB_R}
            y={totalHeight / 2 - TRACK_H / 2}
            width={(sliderWidth - 2 * THUMB_R) * pct}
            height={TRACK_H}
            rx={2}
            ry={2}
            fill="rgb(102,177,253)"
          />
          <circle
            cx={THUMB_R + (sliderWidth - 2 * THUMB_R) * pct}
            cy={totalHeight / 2}
            r={THUMB_R}
            fill="rgb(102,177,253)"
          />
          <circle
            cx={THUMB_R + (sliderWidth - 2 * THUMB_R) * pct}
            cy={totalHeight / 2}
            r={THUMB_R - 2}
            fill="rgb(38,51,76)"
          />
        </svg>
        {showValue && (
          <ValuePanel
            value={displayVal}
            width={BSB_VALUE_PANEL_WIDTH}
            height={BSB_VALUE_PANEL_HEIGHT}
            onCommit={(v) => {
              const parsed = parseFloat(v);
              if (!isNaN(parsed)) {
                onBsbInterfacePatch({
                  type: 'updateWidgetProperties',
                  widgetId: node.id,
                  properties: { value: Math.max(minimum, Math.min(maximum, parsed)) },
                });
              }
            }}
          />
        )}
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBHSliderWidget);
