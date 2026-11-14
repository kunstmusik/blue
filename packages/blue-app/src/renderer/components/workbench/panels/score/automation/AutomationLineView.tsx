import { useMemo, useRef, useEffect, useState, type MouseEvent } from 'react';
import type { AutomationParameterSnapshot } from '../../../../../../shared/project-editor';
import { beatToX, valueToY, formatAutomationDouble } from './automation-line-utils';
import { HostSurfacePortal } from '../../../../host-surface/HostSurfacePortal';
import { useHostSurface } from '../../../../host-surface/use-host-surface';
import { useScoreViewportBounds } from '../score-viewport-scroll';

interface Props {
  parameter: AutomationParameterSnapshot;
  pixelsPerBeat: number;
  visibleStartBeats?: number;
  visibleEndBeats?: number;
  totalBeats?: number;
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
  visibleStartBeats: propVisibleStartBeats,
  visibleEndBeats: propVisibleEndBeats,
  totalBeats,
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

  const { visibleStartBeats, visibleEndBeats } = useScoreViewportBounds(
    pixelsPerBeat,
    propVisibleStartBeats,
    propVisibleEndBeats,
  );
  const pointsSorted = useMemo(() => arePointsSortedByTime(points), [points]);

  const pathD = useMemo(() => {
    return buildAutomationLinePath(
      parameter,
      pixelsPerBeat,
      height,
      pointsSorted,
      visibleStartBeats,
      visibleEndBeats,
      totalBeats,
    );
  }, [
    points,
    pointsSorted,
    pixelsPerBeat,
    height,
    minimum,
    maximum,
    parameter.resolution,
    visibleStartBeats,
    visibleEndBeats,
    totalBeats,
  ]);

  if (points.length === 0) return null;

  const rangeStart = selectionRange
    ? Math.min(selectionRange.startBeat, selectionRange.endBeat)
    : 0;
  const rangeEnd = selectionRange ? Math.max(selectionRange.startBeat, selectionRange.endBeat) : 0;
  const visiblePointIndices: number[] = [];
  if (showPoints) {
    if (pointsSorted) {
      const firstVisibleCircleIndex =
        visibleStartBeats !== undefined
          ? findFirstPointIndexAtOrAfter(points, visibleStartBeats)
          : 0;
      const lastVisibleCircleIndex =
        visibleEndBeats !== undefined
          ? findLastPointIndexAtOrBefore(points, visibleEndBeats)
          : points.length - 1;
      for (let i = firstVisibleCircleIndex; i <= lastVisibleCircleIndex; i++) {
        visiblePointIndices.push(i);
      }
    } else {
      for (let i = 0; i < points.length; i++) {
        const time = points[i]!.time;
        if (
          (visibleStartBeats === undefined || time >= visibleStartBeats) &&
          (visibleEndBeats === undefined || time <= visibleEndBeats)
        ) {
          visiblePointIndices.push(i);
        }
      }
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {height > 0 && (
        <svg ref={svgRef} style={{ width: '100%', height, overflow: 'visible' }}>
          {pathD && <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} />}
          {showPoints &&
            visiblePointIndices.map((i) => {
              const pt = points[i]!;
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
          className="z-50 rounded-[2px] border border-app-border bg-app-overlay/90 px-[3px] py-[3px] font-mono text-role-subheadline text-app-text-strong shadow-md"
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

function arePointsSortedByTime(points: ReadonlyArray<{ time: number }>): boolean {
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.time < points[i - 1]!.time) {
      return false;
    }
  }
  return true;
}

function findFirstPointIndexAtOrAfter(
  points: ReadonlyArray<{ time: number }>,
  targetBeat: number,
): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid]!.time < targetBeat) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function findLastPointIndexAtOrBefore(
  points: ReadonlyArray<{ time: number }>,
  targetBeat: number,
): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid]!.time <= targetBeat) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo - 1;
}

function resolveTrailingEndX(
  points: ReadonlyArray<{ time: number }>,
  pixelsPerBeat: number,
  visibleEndBeats?: number,
  totalBeats?: number,
): number {
  const lastPointX = beatToX(points[points.length - 1]!.time, pixelsPerBeat);
  if (visibleEndBeats !== undefined) {
    const endBeatLimit =
      totalBeats !== undefined ? Math.min(visibleEndBeats, totalBeats) : visibleEndBeats;
    return Math.max(0, beatToX(endBeatLimit, pixelsPerBeat));
  }
  if (totalBeats !== undefined) {
    return Math.max(lastPointX, beatToX(totalBeats, pixelsPerBeat));
  }
  return Math.max(100000, lastPointX);
}

function buildAutomationLinePath(
  parameter: AutomationParameterSnapshot,
  pixelsPerBeat: number,
  height: number,
  pointsSorted: boolean,
  visibleStartBeats?: number,
  visibleEndBeats?: number,
  totalBeats?: number,
): string {
  const points = parameter.points;
  if (points.length === 0 || height === 0) return '';

  const toX = (beat: number) => beatToX(beat, pixelsPerBeat);
  const toY = (value: number) => valueToY(value, parameter.minimum, parameter.maximum, height);
  const trailingEndX = resolveTrailingEndX(
    points,
    pixelsPerBeat,
    pointsSorted && (visibleStartBeats !== undefined || visibleEndBeats !== undefined)
      ? visibleEndBeats
      : undefined,
    totalBeats,
  );

  if (points.length === 1) {
    const startX =
      visibleStartBeats !== undefined ? Math.max(0, beatToX(visibleStartBeats, pixelsPerBeat)) : 0;
    if (visibleEndBeats !== undefined && trailingEndX < startX) {
      return '';
    }
    const y = toY(points[0]!.value);
    return `M ${startX} ${y} L ${Math.max(startX, trailingEndX)} ${y}`;
  }

  if (pointsSorted && visibleEndBeats !== undefined && points[0]!.time > visibleEndBeats) {
    return '';
  }

  let segStartIdx =
    pointsSorted && visibleStartBeats !== undefined
      ? Math.max(0, findFirstPointIndexAtOrAfter(points, visibleStartBeats) - 1)
      : 0;
  const startStepThresholdX =
    visibleStartBeats !== undefined
      ? beatToX(visibleStartBeats, pixelsPerBeat) - 4
      : Number.NEGATIVE_INFINITY;
  while (
    segStartIdx > 0 &&
    points[segStartIdx - 1]!.time === points[segStartIdx]!.time &&
    (!pointsSorted ||
      visibleStartBeats === undefined ||
      toX(points[segStartIdx]!.time) >= startStepThresholdX)
  ) {
    segStartIdx -= 1;
  }
  let segEndIdx =
    pointsSorted && visibleEndBeats !== undefined
      ? Math.min(points.length - 1, findLastPointIndexAtOrBefore(points, visibleEndBeats) + 1)
      : points.length - 1;
  const endStepThresholdX =
    visibleEndBeats !== undefined
      ? beatToX(visibleEndBeats, pixelsPerBeat) + 4
      : Number.POSITIVE_INFINITY;
  while (
    segEndIdx < points.length - 1 &&
    points[segEndIdx + 1]!.time === points[segEndIdx]!.time &&
    (!pointsSorted ||
      visibleEndBeats === undefined ||
      toX(points[segEndIdx]!.time) <= endStepThresholdX)
  ) {
    segEndIdx += 1;
  }

  if (parameter.resolution <= 0) {
    if (pointsSorted && segStartIdx >= segEndIdx) {
      const lastPoint = points[points.length - 1]!;
      const startX =
        visibleStartBeats !== undefined
          ? Math.max(toX(lastPoint.time), beatToX(Math.max(0, visibleStartBeats), pixelsPerBeat))
          : toX(lastPoint.time);
      const y = toY(lastPoint.value);
      return `M ${startX} ${y} L ${Math.max(startX, trailingEndX)} ${y}`;
    }

    const parts = [`M ${toX(points[segStartIdx]!.time)} ${toY(points[segStartIdx]!.value)}`];
    for (let i = segStartIdx + 1; i <= segEndIdx; i++) {
      const current = points[i]!;
      parts.push(`L ${toX(current.time)} ${toY(current.value)}`);
    }
    if (segEndIdx === points.length - 1 && trailingEndX > toX(points[segEndIdx]!.time)) {
      parts.push(`L ${trailingEndX} ${toY(points[segEndIdx]!.value)}`);
    }
    return parts.join(' ');
  }

  return buildQuantizedInterpolationPath(
    parameter,
    pixelsPerBeat,
    height,
    segStartIdx,
    segEndIdx,
    trailingEndX,
    pointsSorted ? visibleStartBeats : undefined,
    pointsSorted ? visibleEndBeats : undefined,
  );
}

function buildQuantizedInterpolationPath(
  parameter: AutomationParameterSnapshot,
  pixelsPerBeat: number,
  height: number,
  segStartIdx: number,
  segEndIdx: number,
  trailingEndX: number,
  visibleStartBeats?: number,
  visibleEndBeats?: number,
): string {
  const points = parameter.points;
  const toX = (beat: number) => beatToX(beat, pixelsPerBeat);
  const toY = (value: number) => valueToY(value, parameter.minimum, parameter.maximum, height);
  const minVisiblePx =
    visibleStartBeats !== undefined
      ? Math.floor(Math.max(0, visibleStartBeats) * pixelsPerBeat) - 1
      : Number.NEGATIVE_INFINITY;
  const maxVisiblePx =
    visibleEndBeats !== undefined
      ? Math.ceil(visibleEndBeats * pixelsPerBeat) + 1
      : Number.POSITIVE_INFINITY;

  if (segStartIdx >= segEndIdx) {
    const lastPoint = points[points.length - 1]!;
    const startX =
      visibleStartBeats !== undefined
        ? Math.max(toX(lastPoint.time), beatToX(Math.max(0, visibleStartBeats), pixelsPerBeat))
        : toX(lastPoint.time);
    const y = toY(lastPoint.value);
    return `M ${startX} ${y} L ${Math.max(startX, trailingEndX)} ${y}`;
  }

  const firstSegPrev = points[segStartIdx]!;
  const firstSegNext = points[segStartIdx + 1]!;
  const firstStartX = Math.round(toX(firstSegPrev.time));
  let scanCursor = segStartIdx + 1;
  let lastX = firstStartX;
  let lastY = toY(firstSegPrev.value);
  let parts: string[];

  if (minVisiblePx > firstStartX) {
    const entryX = minVisiblePx;
    if (firstSegPrev.value !== firstSegNext.value) {
      const evaluated = evaluateJavaLineMonotonic(
        points,
        entryX / pixelsPerBeat,
        parameter.resolution,
        scanCursor,
      );
      scanCursor = evaluated.nextCursor;
      let entryY = toY(evaluated.value);
      const segStartY = toY(firstSegPrev.value);
      const segEndY = toY(firstSegNext.value);
      if (segEndY > segStartY && entryY < segStartY) {
        entryY = segStartY;
      } else if (segEndY < segStartY && entryY > segStartY) {
        entryY = segStartY;
      }
      lastY = entryY;
    }
    lastX = entryX;
    parts = [`M ${entryX} ${lastY}`];
  } else {
    parts = [`M ${toX(firstSegPrev.time)} ${lastY}`];
  }
  let lastPushedX = lastX;

  for (let i = segStartIdx + 1; i <= segEndIdx; i++) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    const startX = Math.round(toX(previous.time));
    const endX = Math.round(toX(current.time));
    const startY = toY(previous.value);
    const endY = toY(current.value);

    if (endX <= startX) {
      if (
        endX >= minVisiblePx &&
        endX <= maxVisiblePx &&
        (lastPushedX !== endX || lastY !== endY)
      ) {
        parts.push(`L ${endX} ${endY}`);
        lastPushedX = endX;
        lastX = endX;
        lastY = endY;
      }
      continue;
    }

    if (previous.value === current.value) {
      const clampedEndX = Math.min(endX, maxVisiblePx);
      if (lastPushedX !== clampedEndX || lastY !== endY) {
        parts.push(`L ${clampedEndX} ${endY}`);
        lastPushedX = clampedEndX;
        lastX = clampedEndX;
        lastY = endY;
      }
      continue;
    }

    const loopEndX = Math.min(endX, maxVisiblePx);
    for (let x = Math.max(startX, lastX, minVisiblePx) + 1; x <= loopEndX; x++) {
      const time = x / pixelsPerBeat;
      const evaluated = evaluateJavaLineMonotonic(points, time, parameter.resolution, scanCursor);
      scanCursor = evaluated.nextCursor;
      let y = toY(evaluated.value);

      if (endY > startY && y < startY) {
        y = startY;
      } else if (endY < startY && y > startY) {
        y = startY;
      }

      if (Math.abs(y - lastY) > 0.0001) {
        parts.push(`L ${x} ${lastY}`);
        parts.push(`L ${x} ${y}`);
        lastY = y;
        lastPushedX = x;
      }
      lastX = x;
    }

    if (endX <= maxVisiblePx) {
      if (lastPushedX !== endX || Math.abs(lastY - endY) > 0.0001) {
        parts.push(`L ${endX} ${lastY}`);
        parts.push(`L ${endX} ${endY}`);
        lastPushedX = endX;
        lastX = endX;
        lastY = endY;
      }
    } else if (lastPushedX < maxVisiblePx) {
      parts.push(`L ${maxVisiblePx} ${lastY}`);
      lastPushedX = maxVisiblePx;
      lastX = maxVisiblePx;
    }
  }

  if (segEndIdx === points.length - 1 && trailingEndX > lastPushedX) {
    parts.push(`L ${trailingEndX} ${lastY}`);
  }
  return parts.join(' ');
}

function evaluateJavaLineMonotonic(
  points: Array<{ time: number; value: number }>,
  time: number,
  resolution: number,
  startCursor: number,
): { value: number; nextCursor: number } {
  if (points.length === 0) return { value: 0, nextCursor: startCursor };

  const first = points[0]!;
  if (points.length === 1 || time === 0) {
    return { value: first.value, nextCursor: startCursor };
  }

  let i = startCursor;
  while (i < points.length && points[i]!.time < time) {
    i++;
  }
  const nextCursor = i;

  if (i >= points.length) {
    return { value: points[points.length - 1]!.value, nextCursor };
  }

  const b = points[i]!;
  if (b.time === time) {
    if (i === points.length - 1) {
      return { value: b.value, nextCursor };
    }
    let lastMatch = b;
    let k = i;
    while (k < points.length && points[k]!.time === time) {
      lastMatch = points[k]!;
      k++;
    }
    return { value: lastMatch.value, nextCursor };
  }

  const a = points[i - 1]!;
  if (b === a || b.time === a.time) {
    return { value: b.value, nextCursor };
  }

  const slope = (b.value - a.value) / (b.time - a.time);
  let value = slope * (time - a.time) + a.value;

  if (resolution > 0) {
    value = snapJavaLineValue(value, resolution, b.value < a.value);
  }

  return { value, nextCursor };
}

function snapJavaLineValue(value: number, resolution: number, descending: boolean): number {
  if (!Number.isFinite(value) || !Number.isFinite(resolution) || resolution <= 0) {
    return value;
  }

  const adjusted = descending ? value + resolution * 0.99 : value;
  return Math.floor(adjusted / resolution) * resolution;
}
