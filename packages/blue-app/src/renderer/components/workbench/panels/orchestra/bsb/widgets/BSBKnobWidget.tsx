import React, { useCallback, useRef } from 'react';
import WidgetWrapper from './WidgetWrapper';
import { formatValue } from './ValuePanel';
import BsbTextLabel from './BsbTextLabel';
import { getFontString, getWidgetDisplaySize, measureTextContent } from './utils';
import type { BSBWidgetPatchComponentProps } from './widget-component-props';

type BSBKnobWidgetProps = BSBWidgetPatchComponentProps;

const VALUE_HEIGHT = 14;
const ARC_START = 225;
const ARC_LENGTH = 270;
const TRACK_COLOR = 'rgb(63,102,150)';
const TRACK_COLOR_BRIGHT = 'rgb(96,142,192)';

function BSBKnobWidget({
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
}: BSBKnobWidgetProps): React.ReactElement {
  const value = node.value;
  const minimum = node.minimum;
  const maximum = node.maximum;
  const showLabel = node.properties.labelEnabled === true;
  const labelText = typeof node.properties.label === 'string' ? node.properties.label : '';
  const showValue = node.properties.valueDisplayEnabled === true;

  const labelFontName = typeof node.properties['labelFont.name'] === 'string' ? node.properties['labelFont.name'] : 'Roboto';
  const labelFontSize = typeof node.properties['labelFont.size'] === 'number' ? node.properties['labelFont.size'] : 12;
  const labelFontStyle = typeof node.properties['labelFont.style'] === 'number' ? node.properties['labelFont.style'] : 0;
  const labelMetrics = showLabel
    ? measureTextContent(labelText, getFontString(labelFontName, labelFontSize, labelFontStyle))
    : { width: 0, height: 0 };

  const range = maximum - minimum || 1;
  const knobVal = Math.max(0, Math.min(1, (value - minimum) / range));

  const strVal = formatValue(value);
  const displayVal = strVal.length > 7 ? strVal.substring(0, 7) : strVal;

  const displaySize = getWidgetDisplaySize(node);
  const labelH = showLabel ? Math.max(16, Math.ceil(labelMetrics.height)) : 0;
  const valueH = showValue ? VALUE_HEIGHT : 0;
  const knobSize = typeof node.properties.knobWidth === 'number'
    ? node.properties.knobWidth
    : Math.max(30, displaySize.height - labelH - valueH);
  const totalH = displaySize.height;

  const svgRef = useRef<SVGSVGElement>(null);
  const paramsRef = useRef({ minimum, range, knobSize, nodeId: node.id });
  paramsRef.current = { minimum, range, knobSize, nodeId: node.id };

  const patchRef = useRef(onBsbInterfacePatch);
  patchRef.current = onBsbInterfacePatch;

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (editEnabled) return;
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const computeValue = (clientX: number, clientY: number): number => {
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let angle = Math.atan2(-(clientY - cy), clientX - cx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      let rel = ARC_START - angle;
      if (rel < 0) rel += 360;
      if (rel > ARC_LENGTH) return -1;
      return rel / ARC_LENGTH;
    };

    const { minimum: min, range: r, nodeId } = paramsRef.current;

    const newVal = computeValue(e.clientX, e.clientY);
    if (newVal >= 0) {
      patchRef.current({
        type: 'updateWidgetProperties',
        widgetId: nodeId,
        properties: { value: min + newVal * r },
      });
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const v = computeValue(moveEvent.clientX, moveEvent.clientY);
      if (v >= 0) {
        patchRef.current({
          type: 'updateWidgetProperties',
          widgetId: paramsRef.current.nodeId,
          properties: { value: paramsRef.current.minimum + v * paramsRef.current.range },
        });
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [editEnabled]);

  return (
    <WidgetWrapper node={node} isSelected={isSelected} editEnabled={editEnabled} onWidgetSelect={onWidgetSelect} displayWidth={displaySize.width} displayHeight={displaySize.height} resizeMeta={resizeMeta} gridSnapEnabled={gridSnapEnabled} gridSnapWidth={gridSnapWidth} gridSnapHeight={gridSnapHeight} onBsbInterfacePatch={onBsbInterfacePatch} selectedWidgetIds={selectedWidgetIds} getWidgetPosition={getWidgetPosition} onWidgetAction={onWidgetAction}>
      <div className="flex h-full w-full flex-col items-center" style={{ width: displaySize.width, height: totalH }}>
        {showLabel && (
          <div
            className="flex w-full items-center justify-center overflow-hidden"
            style={{ height: labelH, fontFamily: `'${labelFontName}', Roboto, sans-serif`, fontSize: labelFontSize, color: 'var(--color-app-text-bright)' }}
          >
            <BsbTextLabel text={labelText} plainClassName="truncate" htmlClassName="inline-block max-w-full text-center" />
          </div>
        )}
        <KnobSVG ref={svgRef} size={knobSize} value={knobVal} interactive={!editEnabled} onMouseDown={handleMouseDown} />
        {showValue && (
          <div
            className="flex items-center justify-center"
            style={{
              height: valueH,
              width: displaySize.width,
              fontFamily: "'Roboto', sans-serif",
              fontSize: 'var(--text-role-subheadline)',
              color: 'var(--color-app-text-bright)',
              background: 'var(--color-app-bsb-value)',
              borderRadius: 3,
            }}
          >
            {displayVal}
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(BSBKnobWidget);

const KnobSVG = React.forwardRef<SVGSVGElement, {
  size: number;
  value: number;
  interactive: boolean;
  onMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
}>(({ size, value, interactive, onMouseDown }, ref) => {
  const drawSize = size - 2;
  const mid = drawSize / 2;
  const cx = mid + 1;
  const cy = mid + 1;

  const trackPath = describePieArc(cx, cy, mid, ARC_START, -ARC_LENGTH);
  const valueSweep = ARC_LENGTH * value;
  const valPath = value > 0.001 ? describePieArc(cx, cy, mid, ARC_START, -valueSweep) : '';

  const knobCenterSize = drawSize * 0.65;
  const knobR = knobCenterSize / 2;

  const rotation = Math.PI * 2.0 * (-0.625 + value * 0.75);
  const notchAdj = drawSize / 18;
  const notchW = 2 * notchAdj;
  const notchLen = knobCenterSize / 2 + notchW;
  const lineStart = mid / 2;
  const lineEnd = mid - 2;
  const lineW = Math.max(1.5, drawSize / 30);

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      className="block"
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      onMouseDown={interactive ? onMouseDown : undefined}
    >
      <path d={trackPath} fill="rgba(0,0,0,0.25)" />
      {valPath && <path d={valPath} fill={TRACK_COLOR} />}
      <path d={trackPath} fill="none" stroke="black" strokeWidth={0.5} />
      <circle cx={cx} cy={cy} r={knobR} fill="black" />
      <g transform={`translate(${cx},${cy}) rotate(${rotation * 180 / Math.PI})`}>
        <line
          x1={lineStart} y1={0} x2={lineEnd} y2={0}
          stroke={TRACK_COLOR_BRIGHT}
          strokeWidth={lineW}
          strokeLinecap="round"
        />
        <rect
          x={-notchAdj} y={-notchAdj}
          width={notchLen} height={notchW}
          rx={notchW} ry={notchW}
          fill={TRACK_COLOR}
          stroke="rgb(16,16,16)"
          strokeWidth={Math.max(0.5, drawSize / 40)}
        />
      </g>
    </svg>
  );
});

KnobSVG.displayName = 'KnobSVG';

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describePieArc(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, startDeg + sweepDeg);
  const large = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweep = sweepDeg < 0 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} ${sweep} ${e.x} ${e.y} Z`;
}
