import { useMemo, useRef, useEffect, useLayoutEffect, useState, type MouseEvent } from 'react';
import type { AutomationParameterSnapshot } from '../../../../../../shared/project-editor';
import {
  beatToX,
  valueToY,
  formatAutomationDouble,
} from './automation-line-utils';

interface Props {
  parameter: AutomationParameterSnapshot;
  pixelsPerBeat: number;
  active: boolean;
  mode: 'score' | 'singleLine' | 'multiLine';
  selectedPointIndex?: number | null;
  hoveredPointIndex?: number | null;
  selectionRange?: { startBeat: number; endBeat: number } | null;
  onPointMouseDown?: (pointIndex: number, event: MouseEvent<SVGCircleElement>) => void;
  onPointContextMenu?: (pointIndex: number, event: MouseEvent<SVGCircleElement>) => void;
}

export default function AutomationLineView({
  parameter,
  pixelsPerBeat,
  active,
  mode,
  selectedPointIndex = null,
  hoveredPointIndex = null,
  selectionRange = null,
  onPointMouseDown,
  onPointContextMenu,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setHeight(el.getBoundingClientRect().height);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const points = parameter.points;
  const { minimum, maximum } = parameter;
  const baseColor = useMemo(() => colorFromLineColor(parameter.lineColor), [parameter.lineColor]);
  const lineColor = mode === 'singleLine' && active ? baseColor : darkenColor(baseColor, 0.65);
  const showPoints = mode === 'multiLine' || (mode === 'singleLine' && active);
  const interactive = mode === 'singleLine' && active;

  const pathD = useMemo(() => {
    return buildAutomationLinePath(parameter, pixelsPerBeat, height);
  }, [points, pixelsPerBeat, height, minimum, maximum, parameter.resolution]);

  if (points.length === 0) return null;

  const rangeStart = selectionRange ? Math.min(selectionRange.startBeat, selectionRange.endBeat) : 0;
  const rangeEnd = selectionRange ? Math.max(selectionRange.startBeat, selectionRange.endBeat) : 0;
  // Hover takes priority over click-selection for the on-curve readout, matching
  // Java Blue's ParameterLinePanel where selectedPoint is driven by mouseMoved.
  const readoutPointIndex = hoveredPointIndex ?? selectedPointIndex;
  const readoutPoint = readoutPointIndex == null ? null : points[readoutPointIndex] ?? null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {height > 0 && (
        <svg
          style={{ width: '100%', height, overflow: 'visible' }}
        >
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
          />
          {showPoints && points.map((pt, i) => {
            const cx = beatToX(pt.time, pixelsPerBeat);
            const cy = valueToY(pt.value, minimum, maximum, height);
            const directlySelected = selectedPointIndex === i;
            const hovered = hoveredPointIndex === i;
            const highlighted = directlySelected || hovered;
            const rangeSelected =
              selectionRange != null && pt.time >= rangeStart && pt.time <= rangeEnd;
            const fill = highlighted
              ? '#ef4444'
              : rangeSelected
                ? baseColor
                : '#05070d';
            const stroke = highlighted ? '#ef4444' : lineColor;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={highlighted ? 4 : 3.25}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
                className={interactive ? 'pointer-events-auto' : 'pointer-events-none'}
                style={{ cursor: interactive ? 'pointer' : 'default', pointerEvents: interactive ? 'auto' : 'none' }}
                onMouseDown={(event) => onPointMouseDown?.(i, event)}
                onContextMenu={(event) => onPointContextMenu?.(i, event)}
              />
            );
          })}
          {mode === 'singleLine' && active && readoutPoint != null && (
            <ReadoutText
              point={readoutPoint}
              label={parameter.label}
              minimum={minimum}
              maximum={maximum}
              height={height}
              width={width}
              pixelsPerBeat={pixelsPerBeat}
            />
          )}
        </svg>
      )}
    </div>
  );
}

/**
 * On-curve point detail readout, mirroring Java Blue's
 * `ParameterLinePanel.drawPointInformation`. Draws two short text lines
 * (`x:` time, `y:` value + optional parameter label) next to the point, flipping
 * left/up when the box would overflow the canvas.
 *
 * Java draws pure-white text with no backing box: `LineCanvas` sits on a solid
 * black backdrop so white-on-black is high-contrast, but `ParameterLinePanel`
 * has no backdrop and is effectively illegible. Here the canvas is not
 * uniformly dark, so we draw a solid dark backing box behind the white text to
 * guarantee contrast in any theme (matching LineCanvas's effective look).
 */
function ReadoutText({
  point,
  label,
  minimum,
  maximum,
  height,
  width,
  pixelsPerBeat,
}: {
  point: { time: number; value: number };
  label: string;
  minimum: number;
  maximum: number;
  height: number;
  width: number;
  pixelsPerBeat: number;
}) {
  const groupRef = useRef<SVGGElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const px = beatToX(point.time, pixelsPerBeat);
  const py = valueToY(point.value, minimum, maximum, height);

  const xText = `x: ${formatAutomationDouble(point.time)}`;
  let yText = `y: ${formatAutomationDouble(point.value)}`;
  if (label.length > 0) {
    yText += ` ${label}`;
  }

  // Box sizing: 3px inner padding around the text plus a 3px offset gap so the
  // box sits clear of the point/cursor instead of under it.
  const fontSize = 11;
  const pad = 3;
  const offset = 3;
  const pointRadius = 4;
  const lineHeight = 14;
  const ascent = 9;
  const descent = 3;

  // Measure the actual rendered text width so the box hugs the content.
  // A per-character estimate is inaccurate for proportional fonts (and variable
  // parameter labels), which left a large gap on the right. Falls back to an
  // estimate on the first paint before the layout effect has run.
  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    let max = 0;
    for (const t of g.querySelectorAll('text')) {
      const w = (t as SVGTextElement).getBBox().width;
      if (w > max) max = w;
    }
    setMeasuredWidth((prev) => (max > 0 && Math.abs(max - prev) > 0.5 ? max : prev));
  }, [xText, yText]);

  const textWidth = measuredWidth > 0
    ? measuredWidth
    : Math.max(xText.length, yText.length) * 6.2;

  const boxWidth = Math.ceil(textWidth) + pad * 2;
  // top pad + first ascent + baseline gap + second line descent + bottom pad
  const boxHeight = pad + ascent + lineHeight + descent + pad;

  // Place the box to the lower-right of the point with an offset gap, flipping
  // left/up when it would overflow the canvas.
  let boxX = px + pointRadius + offset;
  let boxY = py + pointRadius + offset;
  if (boxX + boxWidth > width) {
    boxX = px - pointRadius - offset - boxWidth;
  }
  if (boxY + boxHeight > height) {
    boxY = py - pointRadius - offset - boxHeight;
  }

  const textX = boxX + pad;
  const baseline1 = boxY + pad + ascent;
  const baseline2 = baseline1 + lineHeight;

  return (
    <g ref={groupRef}>
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={2}
        ry={2}
        fill="rgba(5, 7, 13, 0.82)"
        stroke="rgba(255, 255, 255, 0.14)"
        strokeWidth={1}
      />
      <text x={textX} y={baseline1} fill="#ffffff" className="text-role-subheadline" style={{ fontSize: 'var(--text-role-subheadline)' }}>
        {xText}
      </text>
      <text x={textX} y={baseline2} fill="#ffffff" className="text-role-subheadline" style={{ fontSize: 'var(--text-role-subheadline)' }}>
        {yText}
      </text>
    </g>
  );
}

function colorFromLineColor(lineColor: number): string {
  return `#${((lineColor >>> 0) & 0x00FFFFFF).toString(16).padStart(6, '0')}`;
}

function darkenColor(color: string, factor: number): string {
  const hex = color.replace('#', '');
  const red = Math.max(0, Math.min(255, Math.round(Number.parseInt(hex.slice(0, 2), 16) * factor)));
  const green = Math.max(0, Math.min(255, Math.round(Number.parseInt(hex.slice(2, 4), 16) * factor)));
  const blue = Math.max(0, Math.min(255, Math.round(Number.parseInt(hex.slice(4, 6), 16) * factor)));
  return `#${red.toString(16).padStart(2, '0')}${green
    .toString(16)
    .padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

function buildAutomationLinePath(
  parameter: AutomationParameterSnapshot,
  pixelsPerBeat: number,
  height: number,
): string {
  const points = parameter.points;
  if (points.length === 0 || height === 0) return '';

  const toX = (beat: number) => beatToX(beat, pixelsPerBeat);
  const toY = (value: number) => valueToY(value, parameter.minimum, parameter.maximum, height);

  if (points.length === 1) {
    const y = toY(points[0]!.value);
    return `M 0 ${y} L 100000 ${y}`;
  }

  if (parameter.resolution <= 0) {
    const parts = [`M ${toX(points[0]!.time)} ${toY(points[0]!.value)}`];
    for (let i = 1; i < points.length; i++) {
      const current = points[i]!;
      parts.push(`L ${toX(current.time)} ${toY(current.value)}`);
    }
    parts.push(`L 100000 ${toY(points[points.length - 1]!.value)}`);
    return parts.join(' ');
  }

  return buildQuantizedInterpolationPath(parameter, pixelsPerBeat, height);
}

function buildQuantizedInterpolationPath(
  parameter: AutomationParameterSnapshot,
  pixelsPerBeat: number,
  height: number,
): string {
  const points = parameter.points;
  const toX = (beat: number) => beatToX(beat, pixelsPerBeat);
  const toY = (value: number) => valueToY(value, parameter.minimum, parameter.maximum, height);
  const parts = [`M ${toX(points[0]!.time)} ${toY(points[0]!.value)}`];

  let lastX = Math.round(toX(points[0]!.time));
  let lastY = toY(points[0]!.value);

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    const startX = Math.round(toX(previous.time));
    const endX = Math.round(toX(current.time));
    const startY = toY(previous.value);
    const endY = toY(current.value);

    if (endX <= startX) {
      if (lastX !== endX || lastY !== endY) {
        parts.push(`L ${endX} ${endY}`);
        lastX = endX;
        lastY = endY;
      }
      continue;
    }

    if (previous.value === current.value) {
      if (lastX !== endX || lastY !== endY) {
        parts.push(`L ${endX} ${endY}`);
        lastX = endX;
        lastY = endY;
      }
      continue;
    }

    for (let x = Math.max(startX, lastX) + 1; x <= endX; x++) {
      const time = x / pixelsPerBeat;
      const value = getJavaLineValue(points, time, parameter.resolution);
      let y = toY(value);

      if (endY > startY && y < startY) {
        y = startY;
      } else if (endY < startY && y > startY) {
        y = startY;
      }

      if (Math.abs(y - lastY) > 0.0001) {
        parts.push(`L ${x} ${lastY}`);
        parts.push(`L ${x} ${y}`);
        lastY = y;
      }
      lastX = x;
    }

    if (lastX !== endX || Math.abs(lastY - endY) > 0.0001) {
      parts.push(`L ${endX} ${lastY}`);
      parts.push(`L ${endX} ${endY}`);
      lastX = endX;
      lastY = endY;
    }
  }

  parts.push(`L 100000 ${lastY}`);
  return parts.join(' ');
}

function getJavaLineValue(
  points: Array<{ time: number; value: number }>,
  time: number,
  resolution: number,
): number {
  if (points.length === 0) return 0;

  const first = points[0]!;
  if (points.length === 1 || time === 0) {
    return first.value;
  }

  let a = first;
  let b = first;

  for (let i = 1; i < points.length; i++) {
    b = points[i]!;

    if (b.time === time) {
      if (i === points.length - 1) {
        return b.value;
      }
      while (i < points.length) {
        const temp = points[i]!;
        if (temp.time !== time) {
          break;
        }
        b = temp;
        i++;
      }
      return b.value;
    }

    if (b.time < time) {
      a = b;
    } else {
      break;
    }
  }

  if (b === a || b.time === a.time) {
    return b.value;
  }

  const slope = (b.value - a.value) / (b.time - a.time);
  let value = slope * (time - a.time) + a.value;

  if (resolution > 0) {
    value = snapJavaLineValue(value, resolution, b.value < a.value);
  }

  return value;
}

function snapJavaLineValue(value: number, resolution: number, descending: boolean): number {
  if (!Number.isFinite(value) || !Number.isFinite(resolution) || resolution <= 0) {
    return value;
  }

  const adjusted = descending ? value + resolution * 0.99 : value;
  return Math.floor(adjusted / resolution) * resolution;
}
