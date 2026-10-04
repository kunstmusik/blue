import React, { useCallback, useRef, useEffect } from 'react';
import {
  BSB_VALUE_PANEL_HEIGHT,
  BSB_VALUE_PANEL_WIDTH,
} from '../../../../../../../shared/bsb-widget-layout';
import WidgetWrapper from './WidgetWrapper';
import { ValuePanel, formatDisplayValue, formatValue } from './ValuePanel';
import {
  computeKeyboardSteppedValue,
  getWidgetDisplaySize,
  getWidgetResolution,
  getWidgetResolutionDecimal,
  snapWidgetValueToResolution,
} from './utils';
import type { BSBWidgetPatchComponentProps } from './widget-component-props';

type BSBVSliderWidgetProps = BSBWidgetPatchComponentProps;

const SLIDER_WIDTH = 50;
const TRACK_W = 4;
const THUMB_R = 7;

function BSBVSliderWidget({
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
}: BSBVSliderWidgetProps): React.ReactElement {
  const sliderHeight =
    typeof node.properties.sliderHeight === 'number' ? node.properties.sliderHeight : 150;
  const displaySize = getWidgetDisplaySize(node);
  const value = node.value;
  const minimum = node.minimum;
  const maximum = node.maximum;
  const showValue = node.properties.valueDisplayEnabled === true;
  const resolution = getWidgetResolution(node);
  const resolutionDecimal = getWidgetResolutionDecimal(node);

  const totalHeight = displaySize.height;
  const range = maximum - minimum || 1;
  const pct = Math.max(0, Math.min(1, (value - minimum) / range));

  const strVal = formatValue(value);
  const displayVal = formatDisplayValue(strVal);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const paramsRef = useRef({
    sliderHeight,
    minimum,
    maximum,
    range,
    nodeId: node.id,
    resolution,
    resolutionDecimal,
  });
  paramsRef.current = {
    sliderHeight,
    minimum,
    maximum,
    range,
    nodeId: node.id,
    resolution,
    resolutionDecimal,
  };
  const patchRef = useRef(onBsbInterfacePatch);
  patchRef.current = onBsbInterfacePatch;

  useEffect(() => {
    if (editEnabled) return;
    const ownerWindow = svgRef.current?.ownerDocument?.defaultView || window;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !svgRef.current) return;
      e.preventDefault();
      const {
        sliderHeight: sh,
        minimum: min,
        maximum: max,
        range: r,
        nodeId,
        resolution: res,
        resolutionDecimal: resDec,
      } = paramsRef.current;
      const rect = svgRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const trackStart = THUMB_R;
      const trackEnd = sh - THUMB_R;
      const newPct = 1 - Math.max(0, Math.min(1, (y - trackStart) / (trackEnd - trackStart)));
      const rawVal = min + newPct * r;
      const newVal = snapWidgetValueToResolution(rawVal, min, max, res, resDec);
      patchRef.current({
        type: 'updateWidgetProperties',
        widgetId: nodeId,
        properties: { value: newVal },
      });
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    ownerWindow.addEventListener('mousemove', onMouseMove);
    ownerWindow.addEventListener('mouseup', onMouseUp);
    return () => {
      ownerWindow.removeEventListener('mousemove', onMouseMove);
      ownerWindow.removeEventListener('mouseup', onMouseUp);
    };
  }, [editEnabled]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (editEnabled) return;
      e.preventDefault();
      dragging.current = true;
      const {
        sliderHeight: sh,
        minimum: min,
        maximum: max,
        range: r,
        nodeId,
        resolution: res,
        resolutionDecimal: resDec,
      } = paramsRef.current;
      const rect = svgRef.current!.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const trackStart = THUMB_R;
      const trackEnd = sh - THUMB_R;
      const newPct = 1 - Math.max(0, Math.min(1, (y - trackStart) / (trackEnd - trackStart)));
      const rawVal = min + newPct * r;
      const newVal = snapWidgetValueToResolution(rawVal, min, max, res, resDec);
      patchRef.current({
        type: 'updateWidgetProperties',
        widgetId: nodeId,
        properties: { value: newVal },
      });
    },
    [editEnabled],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (editEnabled) return;
      const nextVal = computeKeyboardSteppedValue({
        current: value,
        min: minimum,
        max: maximum,
        resolution,
        resolutionDecimal,
        key: e.key,
        shiftKey: e.shiftKey,
        axis: 'vertical',
      });
      if (nextVal !== null) {
        e.preventDefault();
        e.stopPropagation();
        patchRef.current({
          type: 'updateWidgetProperties',
          widgetId: node.id,
          properties: { value: nextVal },
        });
      }
    },
    [editEnabled, value, minimum, maximum, resolution, resolutionDecimal, node.id],
  );

  const trackX = SLIDER_WIDTH / 2 - TRACK_W / 2;
  const thumbCy = sliderHeight - THUMB_R - (sliderHeight - 2 * THUMB_R) * pct;

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
      <div
        className="flex h-full w-full flex-col"
        style={{ width: displaySize.width, height: totalHeight }}
      >
        <svg
          ref={svgRef}
          width={displaySize.width}
          height={sliderHeight}
          className="block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus rounded-sm"
          style={{ cursor: editEnabled ? 'default' : 'pointer' }}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          tabIndex={editEnabled ? -1 : 0}
          role="slider"
          aria-orientation="vertical"
          aria-label={node.objectName || 'Vertical Slider'}
          aria-valuemin={minimum}
          aria-valuemax={maximum}
          aria-valuenow={value}
          aria-valuetext={showValue ? strVal : String(value)}
        >
          <rect
            x={trackX}
            y={THUMB_R}
            width={TRACK_W}
            height={sliderHeight - 2 * THUMB_R}
            rx={2}
            ry={2}
            fill="rgb(63,102,150)"
          />
          <rect
            x={trackX}
            y={thumbCy}
            width={TRACK_W}
            height={sliderHeight - THUMB_R - thumbCy}
            rx={2}
            ry={2}
            fill="rgb(102,177,253)"
          />
          <circle cx={SLIDER_WIDTH / 2} cy={thumbCy} r={THUMB_R} fill="rgb(102,177,253)" />
          <circle cx={SLIDER_WIDTH / 2} cy={thumbCy} r={THUMB_R - 2} fill="rgb(38,51,76)" />
        </svg>
        {showValue && (
          <ValuePanel
            value={displayVal}
            fullValue={strVal}
            width={BSB_VALUE_PANEL_WIDTH}
            height={BSB_VALUE_PANEL_HEIGHT}
            onCommit={(v) => {
              const parsed = parseFloat(v);
              if (!isNaN(parsed)) {
                const clamped = Math.max(minimum, Math.min(maximum, parsed));
                const snapped = snapWidgetValueToResolution(
                  clamped,
                  minimum,
                  maximum,
                  resolution,
                  resolutionDecimal,
                );
                onBsbInterfacePatch({
                  type: 'updateWidgetProperties',
                  widgetId: node.id,
                  properties: { value: snapped },
                });
              }
            }}
          />
        )}
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBVSliderWidget);
