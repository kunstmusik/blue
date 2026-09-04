import React, { useCallback, useEffect, useRef } from 'react';
import {
  BSB_VALUE_PANEL_HEIGHT,
  BSB_VALUE_PANEL_WIDTH,
  getVSliderBankDisplaySize,
} from '../../../../../../../shared/bsb-widget-layout';
import WidgetWrapper from './WidgetWrapper';
import { ValuePanel, formatValue } from './ValuePanel';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetComponentProps } from './widget-component-props';

type BSBVSliderBankWidgetProps = BSBWidgetComponentProps;

const TRACK_W = 4;
const THUMB_R = 7;

function BSBVSliderBankWidget({
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
}: BSBVSliderBankWidgetProps): React.ReactElement {
  const minimum = typeof node.properties.minimum === 'number' ? node.properties.minimum : 0;
  const maximum = typeof node.properties.maximum === 'number' ? node.properties.maximum : 1;
  const gap = typeof node.properties.gap === 'number' ? node.properties.gap : 5;
  const showValue = node.properties.valueDisplayEnabled === true;
  const sliderHeight =
    typeof node.properties.sliderHeight === 'number' ? node.properties.sliderHeight : 150;
  const sliderCount =
    typeof node.properties.numberOfSliders === 'number'
      ? Math.max(1, node.properties.numberOfSliders)
      : 1;
  const storedSliders = Array.isArray(node.properties.sliders)
    ? (node.properties.sliders as Array<{ value?: number }>)
    : [];
  const sliders = Array.from(
    { length: Math.max(sliderCount, storedSliders.length, 1) },
    (_unused, index) => {
      const slider = storedSliders[index];
      return { value: typeof slider?.value === 'number' ? slider.value : minimum };
    },
  );

  const range = maximum - minimum || 1;
  const displaySize = getWidgetDisplaySize(node);
  const bankSize = getVSliderBankDisplaySize(sliders.length, sliderHeight, gap, showValue);
  const sliderRefs = useRef<Array<SVGSVGElement | null>>([]);
  const dragRef = useRef<{ sliderIndex: number } | null>(null);

  const updateSliderValue = useCallback(
    (sliderIndex: number, clientY: number) => {
      const element = sliderRefs.current[sliderIndex];
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const y = clientY - rect.top;
      const trackStart = THUMB_R;
      const trackEnd = Math.max(trackStart + 1, rect.height - THUMB_R);
      const pct = 1 - Math.max(0, Math.min(1, (y - trackStart) / (trackEnd - trackStart)));
      const nextValue = minimum + pct * range;
      onBsbInterfacePatch?.({
        type: 'updateSliderBankValue',
        widgetId: node.id,
        sliderIndex,
        value: nextValue,
      });
    },
    [minimum, node.id, onBsbInterfacePatch, range],
  );

  useEffect(() => {
    if (editEnabled) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      updateSliderValue(dragRef.current.sliderIndex, event.clientY);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editEnabled, updateSliderValue]);

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
      displayWidth={displaySize.width}
      displayHeight={displaySize.height}
    >
      <div
        className="flex h-full w-full flex-row overflow-hidden rounded border border-blue-border/40 bg-blue-surface/30"
        style={{ gap, width: bankSize.width, height: bankSize.height }}
      >
        {sliders.map((slider, i) => {
          const val = typeof slider.value === 'number' ? slider.value : minimum;
          const pct = Math.max(0, Math.min(1, (val - minimum) / range));
          const displayValue = formatValue(val);
          const trackHeight = Math.max(1, sliderHeight - 2 * THUMB_R);
          const thumbY = THUMB_R + trackHeight * (1 - pct);
          const trackX = BSB_VALUE_PANEL_WIDTH / 2 - TRACK_W / 2;
          return (
            <div
              key={i}
              className="flex shrink-0 flex-col items-center"
              style={{ width: BSB_VALUE_PANEL_WIDTH }}
            >
              <svg
                ref={(element) => {
                  sliderRefs.current[i] = element;
                }}
                width={BSB_VALUE_PANEL_WIDTH}
                height={sliderHeight}
                className="block shrink-0"
                onMouseDown={(event) => {
                  if (editEnabled) return;
                  event.preventDefault();
                  event.stopPropagation();
                  dragRef.current = { sliderIndex: i };
                  updateSliderValue(i, event.clientY);
                }}
                style={{ cursor: editEnabled ? 'default' : 'pointer', height: sliderHeight }}
              >
                <rect
                  x={trackX}
                  y={THUMB_R}
                  width={TRACK_W}
                  height={trackHeight}
                  rx={2}
                  ry={2}
                  fill="rgb(63,102,150)"
                />
                <rect
                  x={trackX}
                  y={thumbY}
                  width={TRACK_W}
                  height={sliderHeight - THUMB_R - thumbY}
                  rx={2}
                  ry={2}
                  fill="rgb(102,177,253)"
                />
                <circle
                  cx={BSB_VALUE_PANEL_WIDTH / 2}
                  cy={thumbY}
                  r={THUMB_R}
                  fill="rgb(102,177,253)"
                />
                <circle
                  cx={BSB_VALUE_PANEL_WIDTH / 2}
                  cy={thumbY}
                  r={THUMB_R - 2}
                  fill="rgb(38,51,76)"
                />
              </svg>
              {showValue && (
                <ValuePanel
                  value={displayValue.length > 7 ? displayValue.substring(0, 7) : displayValue}
                  width={BSB_VALUE_PANEL_WIDTH}
                  height={BSB_VALUE_PANEL_HEIGHT}
                  onCommit={
                    editEnabled
                      ? undefined
                      : (text) => {
                          const parsed = parseFloat(text);
                          if (!Number.isNaN(parsed)) {
                            onBsbInterfacePatch?.({
                              type: 'updateSliderBankValue',
                              widgetId: node.id,
                              sliderIndex: i,
                              value: Math.max(minimum, Math.min(maximum, parsed)),
                            });
                          }
                        }
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBVSliderBankWidget);
