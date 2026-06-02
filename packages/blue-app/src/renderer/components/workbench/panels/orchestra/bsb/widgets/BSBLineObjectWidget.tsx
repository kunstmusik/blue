import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BSB_LINE_SELECTOR_HEIGHT } from '../../../../../../../shared/bsb-widget-layout';
import { EditableLineCanvas } from '../../../shared/line-editor/EditableLineCanvas';
import WidgetWrapper from './WidgetWrapper';
import { getWidgetDisplaySize } from './utils';
import type { BSBWidgetComponentProps } from './widget-component-props';

type BSBLineObjectWidgetProps = BSBWidgetComponentProps;

interface LinePoint {
  x: number;
  y: number;
}

interface LineData {
  varName?: string;
  name?: string;
  min?: number;
  max?: number;
  color?: string | number;
  resolution?: string;
  rightBound?: boolean;
  endPointsLinked?: boolean;
  points: LinePoint[];
}

function BSBLineObjectWidget({
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
}: BSBLineObjectWidgetProps): React.ReactElement {
  const linesRaw = node.properties.lines;
  const lines: LineData[] = Array.isArray(linesRaw) ? linesRaw as LineData[] : [];
  const displaySize = getWidgetDisplaySize(node);
  const canvasWidth = typeof node.properties.canvasWidth === 'number' ? node.properties.canvasWidth : displaySize.width;
  const canvasHeight = typeof node.properties.canvasHeight === 'number'
    ? node.properties.canvasHeight
    : Math.max(40, displaySize.height - BSB_LINE_SELECTOR_HEIGHT);
  const totalHeight = canvasHeight + BSB_LINE_SELECTOR_HEIGHT;
  const lineEditInteractive = !editEnabled;
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);

  useEffect(() => {
    if (selectedLineIndex >= lines.length) {
      setSelectedLineIndex(0);
    }
  }, [lines.length, selectedLineIndex]);

  const commitLines = useCallback((nextLines: LineData[]) => {
    onBsbInterfacePatch?.({
      type: 'updateWidgetProperties',
      widgetId: node.id,
      properties: { lines: nextLines },
    });
  }, [node.id, onBsbInterfacePatch]);

  const selectorLabel = useMemo(() => {
    if (lines.length === 0) {
      return 'No lines';
    }
    const line = lines[selectedLineIndex];
    return line?.name || line?.varName || `Line ${selectedLineIndex + 1}`;
  }, [lines, selectedLineIndex]);

  const cycleSelectedLine = useCallback((delta: number) => {
    if (lines.length === 0) {
      return;
    }
    setSelectedLineIndex((current) => ((current + delta) % lines.length + lines.length) % lines.length);
  }, [lines.length]);

  return (
    <WidgetWrapper
      node={node}
      isSelected={isSelected}
      editEnabled={editEnabled}
      onWidgetSelect={onWidgetSelect}
      displayWidth={displaySize.width}
      displayHeight={totalHeight}
      resizeMeta={resizeMeta}
      gridSnapEnabled={gridSnapEnabled}
      gridSnapWidth={gridSnapWidth}
      gridSnapHeight={gridSnapHeight}
      onBsbInterfacePatch={onBsbInterfacePatch}
      selectedWidgetIds={selectedWidgetIds}
      getWidgetPosition={getWidgetPosition}
      onWidgetAction={onWidgetAction}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded border border-blue-border/40 bg-app-bsb-input">
        <EditableLineCanvas
          lines={lines}
          selectedLineIndex={selectedLineIndex}
          onLinesChange={commitLines}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          interactive={lineEditInteractive}
          locked={node.properties.locked === true}
          className="min-h-0 flex-1"
          backgroundColor="#0a0f1a"
          plotBackgroundColor="#000000"
          plotBorderColor="#d3d3d3"
        />

        <div
          className="flex items-center gap-1 border-t border-blue-border/40 px-1 text-tiny text-blue-muted"
          style={{ height: BSB_LINE_SELECTOR_HEIGHT }}
        >
          <button
            type="button"
            className="h-5 w-7 shrink-0 rounded border border-blue-border/40 text-micro text-blue-muted hover:text-gray-200"
            onClick={(event) => {
              event.stopPropagation();
              cycleSelectedLine(-1);
            }}
            disabled={lines.length === 0}
          >
            ◀
          </button>
          <div className="min-w-0 flex-1 truncate px-1 text-center font-mono text-tiny text-gray-200" title={selectorLabel}>
            {selectorLabel}
          </div>
          <button
            type="button"
            className="h-5 w-7 shrink-0 rounded border border-blue-border/40 text-micro text-blue-muted hover:text-gray-200"
            onClick={(event) => {
              event.stopPropagation();
              cycleSelectedLine(1);
            }}
            disabled={lines.length === 0}
          >
            ▶
          </button>
        </div>
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBLineObjectWidget);
