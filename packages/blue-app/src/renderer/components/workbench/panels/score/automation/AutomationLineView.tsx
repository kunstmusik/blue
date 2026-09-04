import { useMemo, useRef, useEffect, useState, type MouseEvent } from 'react';
import type { AutomationParameterSnapshot } from '../../../../../../shared/project-editor';
import { beatToX, valueToY, formatAutomationDouble } from './automation-line-utils';
import { HostSurfacePortal } from '../../../../host-surface/HostSurfacePortal';
import { useHostSurface } from '../../../../host-surface/use-host-surface';

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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);

  const points = parameter.points;
  const { minimum, maximum } = parameter;
  const baseColor = useMemo(() => colorFromLineColor(parameter.lineColor), [parameter.lineColor]);
  const lineColor = mode === 'singleLine' && active ? baseColor : darkenColor(baseColor, 0.65);
  const showPoints = mode === 'multiLine' || (mode === 'singleLine' && active);
  const interactive = mode === 'singleLine' && active;

  // On-curve readout (spec 090): the annotation keeps Java Blue's
  // drawPointInformation content and edge flip, but renders through the
  // host-surface portal so it escapes the row's overflow clipping (FR-002)
  // and follows the point during drags (FR-005). Hover takes priority over
  // click-selection, mirroring Java's mouseMoved-driven selectedPoint.
  const showReadout = mode === 'singleLine' && active;
  const readoutPointIndex = hoveredPointIndex ?? selectedPointIndex;
  const readoutPoint = showReadout
    ? readoutPointIndex == null
      ? null
      : (points[readoutPointIndex] ?? null)
    : null;
  const readoutXText =
    readoutPoint != null ? `x: ${formatAutomationDouble(readoutPoint.time)}` : '';
  const readoutYText =
    readoutPoint != null
      ? `y: ${formatAutomationDouble(readoutPoint.value)}${parameter.label.length > 0 ? ` ${parameter.label}` : ''}`
      : '';
  const readoutAnchor =
    readoutPoint != null
      ? {
          type: 'rect' as const,
          getRect: () => {
            const rect = svgRef.current?.getBoundingClientRect();
            const px = (rect?.left ?? 0) + beatToX(readoutPoint.time, pixelsPerBeat);
            const py = (rect?.top ?? 0) + valueToY(readoutPoint.value, minimum, maximum, height);
            return { left: px, right: px, top: py, bottom: py };
          },
        }
      : null;
  const readoutSurface = useHostSurface(readoutAnchor, {
    kind: 'readout',
    gap: 7, // Java's pointRadius(4) + offset(3) clearance beside the point
  });

  const pathD = useMemo(() => {
    return buildAutomationLinePath(parameter, pixelsPerBeat, height);
  }, [points, pixelsPerBeat, height, minimum, maximum, parameter.resolution]);

  if (points.length === 0) return null;

  const rangeStart = selectionRange
    ? Math.min(selectionRange.startBeat, selectionRange.endBeat)
    : 0;
  const rangeEnd = selectionRange ? Math.max(selectionRange.startBeat, selectionRange.endBeat) : 0;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {height > 0 && (
        <svg ref={svgRef} style={{ width: '100%', height, overflow: 'visible' }}>
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} />
          {showPoints &&
            points.map((pt, i) => {
              const cx = beatToX(pt.time, pixelsPerBeat);
              const cy = valueToY(pt.value, minimum, maximum, height);
              const directlySelected = selectedPointIndex === i;
              const hovered = hoveredPointIndex === i;
              const highlighted = directlySelected || hovered;
              const rangeSelected =
                selectionRange != null && pt.time >= rangeStart && pt.time <= rangeEnd;
              const fill = rangeSelected ? baseColor : '#05070d';
              const stroke = highlighted ? '#ef4444' : lineColor;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={3.25}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.5}
                  className={interactive ? 'pointer-events-auto' : 'pointer-events-none'}
                  style={{
                    cursor: interactive ? 'pointer' : 'default',
                    pointerEvents: interactive ? 'auto' : 'none',
                  }}
                  onMouseDown={(event) => onPointMouseDown?.(i, event)}
                  onContextMenu={(event) => onPointContextMenu?.(i, event)}
                />
              );
            })}
        </svg>
      )}
      {mode === 'singleLine' && active && readoutPoint != null && (
        <HostSurfacePortal
          session={readoutSurface}
          interactive={false}
          className="z-50 px-[3px] py-[3px] font-mono text-role-subheadline text-white"
          style={{
            background: 'rgba(5, 7, 13, 0.82)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 2,
          }}
        >
          <div>{readoutXText}</div>
          <div>{readoutYText}</div>
        </HostSurfacePortal>
      )}
    </div>
  );
}

function colorFromLineColor(lineColor: number): string {
  return `#${((lineColor >>> 0) & 0x00ffffff).toString(16).padStart(6, '0')}`;
}

function darkenColor(color: string, factor: number): string {
  const hex = color.replace('#', '');
  const red = Math.max(0, Math.min(255, Math.round(Number.parseInt(hex.slice(0, 2), 16) * factor)));
  const green = Math.max(
    0,
    Math.min(255, Math.round(Number.parseInt(hex.slice(2, 4), 16) * factor)),
  );
  const blue = Math.max(
    0,
    Math.min(255, Math.round(Number.parseInt(hex.slice(4, 6), 16) * factor)),
  );
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
