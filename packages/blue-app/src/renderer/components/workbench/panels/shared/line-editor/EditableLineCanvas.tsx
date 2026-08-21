import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface EditableLinePoint {
  x: number;
  y: number;
}

export interface EditableLineLike {
  color?: string | number;
  min?: number;
  max?: number;
  rightBound?: boolean;
  endPointsLinked?: boolean;
  varName?: string;
  name?: string;
  points: EditableLinePoint[];
}

interface PointHit {
  lineIndex: number;
  pointIndex: number;
}

interface LinePointEntry {
  point: EditableLinePoint;
  index: number;
}

interface PointerLocation {
  x: number;
  yFromTop: number;
  insetX: number;
  insetY: number;
  drawableWidth: number;
  drawableHeight: number;
}

export interface EditableLineCanvasProps<TLine extends EditableLineLike> {
  lines: TLine[];
  selectedLineIndex: number;
  onLinesChange: (nextLines: TLine[]) => void;
  canvasWidth: number;
  canvasHeight: number;
  interactive: boolean;
  locked?: boolean;
  showAxes?: boolean;
  className?: string;
  backgroundColor?: string;
  plotBackgroundColor?: string;
  plotBorderColor?: string;
  tooltipFormatter?: (args: {
    line: TLine;
    lineIndex: number;
    point: EditableLinePoint;
    pointIndex: number;
  }) => {
    xText?: string;
    yText?: string;
    ySuffix?: string | null;
  };
}

const AXIS_PAD_L = 44;
const AXIS_PAD_R = 16;
const AXIS_PAD_T = 12;
const AXIS_PAD_B = 24;
const INSET = 5;

export const JAVA_LINE_COLOR_PALETTE = [
  0x20dd00,
  0x0000ff,
  0xffa500,
  0x008b00,
  0xff00ff,
  0xcd3700,
  0x68228b,
  0x00688b,
  0x2f4f4f,
  0xcd1076,
  0x8b6914,
  0x458b74,
  0x8b4513,
  0x4169e1,
  0x8b7d6b,
  0x000080,
  0x7cfc00,
  0x483d8b,
  0xffd700,
  0x838b8b,
  0x8b1a1a,
  0x7fff00,
  0x8b2323,
  0x8b7355,
  0x458b74,
  0xfa8072,
  0x8b3e2f,
  0x008b8b,
  0x458b00,
  0xa020f0,
];

export function getJavaLineColor(index: number): number {
  return JAVA_LINE_COLOR_PALETTE[index % JAVA_LINE_COLOR_PALETTE.length] ?? JAVA_LINE_COLOR_PALETTE[0]!;
}

export function cloneEditableLines<TLine extends EditableLineLike>(lines: TLine[]): TLine[] {
  return lines.map((line) => ({
    ...line,
    points: line.points.map((point) => ({ ...point })),
  }));
}

export function normalizeLineColor(color: string | number | undefined, fallback = '#808080'): string {
  if (typeof color === 'number' && Number.isFinite(color)) {
    const rgb = (color >>> 0) & 0x00ffffff;
    return `#${rgb.toString(16).padStart(6, '0')}`;
  }
  if (typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  if (/^-?\d+$/.test(trimmed)) {
    const rgb = (parseInt(trimmed, 10) >>> 0) & 0x00ffffff;
    return `#${rgb.toString(16).padStart(6, '0')}`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function cssHexToLineColor(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

export function lineMinimum(line: EditableLineLike): number {
  return typeof line.min === 'number' ? line.min : 0;
}

export function lineMaximum(line: EditableLineLike): number {
  return typeof line.max === 'number' ? line.max : 1;
}

function lineRange(line: EditableLineLike): number {
  const range = lineMaximum(line) - lineMinimum(line);
  return range === 0 ? 1 : range;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function darkenColor(color: string, ratio = 0.7): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return color;
  }
  const red = Math.floor(parseInt(hex.slice(0, 2), 16) * ratio);
  const green = Math.floor(parseInt(hex.slice(2, 4), 16) * ratio);
  const blue = Math.floor(parseInt(hex.slice(4, 6), 16) * ratio);
  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

function pointValueToCanvasY(line: EditableLineLike, y: number, plotHeight: number): number {
  const normalized = clamp((y - lineMinimum(line)) / lineRange(line), 0, 1);
  return (1 - normalized) * plotHeight;
}

function canvasYToPointValue(line: EditableLineLike, yFromTop: number): number {
  return lineMinimum(line) + ((1 - yFromTop) * lineRange(line));
}

function getSortedPointEntries(line: EditableLineLike): LinePointEntry[] {
  return line.points
    .map((point, index) => ({ point, index }))
    .sort((left, right) => left.point.x - right.point.x);
}

function getLinePointY(line: EditableLineLike, x: number): number {
  if (line.points.length === 0) {
    return lineMinimum(line) + (lineRange(line) * 0.5);
  }
  if (x <= line.points[0]!.x) {
    return line.points[0]!.y;
  }
  const lastPoint = line.points[line.points.length - 1]!;
  if (x >= lastPoint.x) {
    return lastPoint.y;
  }

  for (let index = 0; index < line.points.length - 1; index++) {
    const currentPoint = line.points[index]!;
    const nextPoint = line.points[index + 1]!;
    if (x >= currentPoint.x && x <= nextPoint.x) {
      const span = nextPoint.x - currentPoint.x || 1;
      const ratio = (x - currentPoint.x) / span;
      return currentPoint.y + (ratio * (nextPoint.y - currentPoint.y));
    }
  }

  return lastPoint.y;
}

function insertPoint<TLine extends EditableLineLike>(line: TLine, x: number, y: number): { line: TLine; index: number } {
  const point = { x, y };
  const nextPoints = [...line.points];
  let insertIndex = nextPoints.length;

  for (let index = 0; index < nextPoints.length; index++) {
    if (x <= nextPoints[index]!.x) {
      insertIndex = index;
      break;
    }
  }

  nextPoints.splice(insertIndex, 0, point);
  return {
    line: { ...line, points: nextPoints },
    index: insertIndex,
  };
}

function movePoint<TLine extends EditableLineLike>(line: TLine, pointIndex: number, x: number, y: number): TLine {
  const nextLine = cloneEditableLines([line])[0]!;
  const previousPoint = pointIndex > 0 ? nextLine.points[pointIndex - 1] : undefined;
  const nextPoint = pointIndex < nextLine.points.length - 1 ? nextLine.points[pointIndex + 1] : undefined;
  const isFirstPoint = pointIndex === 0;
  const isLastPoint = pointIndex === nextLine.points.length - 1;

  const minX = previousPoint ? previousPoint.x : 0;
  const maxX = nextPoint ? nextPoint.x : 1;
  let nextX = clamp(x, minX, maxX);
  if (isFirstPoint) {
    nextX = 0;
  } else if (isLastPoint && (line.rightBound ?? false)) {
    nextX = 1;
  }

  nextLine.points[pointIndex] = {
    x: nextX,
    y: clamp(y, lineMinimum(line), lineMaximum(line)),
  };

  if (nextLine.endPointsLinked && nextLine.points.length >= 2) {
    const firstPoint = nextLine.points[0]!;
    const lastPoint = nextLine.points[nextLine.points.length - 1]!;
    if (pointIndex === 0) {
      nextLine.points[nextLine.points.length - 1] = { ...lastPoint, y: firstPoint.y };
    } else if (pointIndex === nextLine.points.length - 1) {
      nextLine.points[0] = { ...firstPoint, y: lastPoint.y };
    }
  }

  return nextLine;
}

function formatAxisValue(value: number): string {
  const fixed = value.toFixed(3);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function useMeasuredElementSize<TElement extends HTMLElement>(fallback: { width: number; height: number }) {
  const ref = useRef<TElement | null>(null);
  const [size, setSize] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      setSize((current) => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [fallback.height, fallback.width]);

  return { ref, size };
}

export function EditableLineCanvas<TLine extends EditableLineLike>({
  lines,
  selectedLineIndex,
  onLinesChange,
  canvasWidth,
  canvasHeight,
  interactive,
  locked = false,
  showAxes = false,
  className,
  backgroundColor = 'var(--color-app-input)',
  plotBackgroundColor = 'var(--color-app-canvas)',
  plotBorderColor = 'var(--color-app-text-soft)',
  tooltipFormatter,
}: EditableLineCanvasProps<TLine>): React.ReactElement {
  const activeLineIndex = selectedLineIndex >= 0 && selectedLineIndex < lines.length ? selectedLineIndex : 0;
  const currentLine = lines[activeLineIndex] ?? null;
  const canUseDom = typeof document !== 'undefined';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const linesRef = useRef(lines);
  const selectedLineIndexRef = useRef(activeLineIndex);
  const dragRef = useRef<PointHit | null>(null);
  const [hoverPoint, setHoverPoint] = useState<PointHit | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showPointEditor, setShowPointEditor] = useState(false);
  const [pointEdits, setPointEdits] = useState<Record<string, string>>({});

  linesRef.current = lines;
  selectedLineIndexRef.current = activeLineIndex;

  useEffect(() => {
    setHoverPoint(null);
    dragRef.current = null;
  }, [activeLineIndex]);

  useEffect(() => {
    if (!locked) {
      return;
    }
    setContextMenuPosition(null);
    setShowPointEditor(false);
    setPointEdits({});
  }, [locked]);

  useEffect(() => {
    if (!contextMenuPosition) {
      return undefined;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const menu = contextMenuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      setContextMenuPosition(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenuPosition(null);
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuPosition]);

  const plotLeft = showAxes ? AXIS_PAD_L : INSET;
  const plotRight = showAxes ? AXIS_PAD_R : INSET;
  const plotTop = showAxes ? AXIS_PAD_T : INSET;
  const plotBottom = showAxes ? AXIS_PAD_B : INSET;
  const plotWidth = Math.max(1, canvasWidth - plotLeft - plotRight);
  const plotHeight = Math.max(1, canvasHeight - plotTop - plotBottom);

  const commitLines = useCallback((nextLines: TLine[]) => {
    onLinesChange(nextLines);
  }, [onLinesChange]);

  const getPointFromEvent = useCallback((clientX: number, clientY: number): PointerLocation | null => {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const insetX = (plotLeft / canvasWidth) * rect.width;
    const insetY = (plotTop / canvasHeight) * rect.height;
    const drawableWidth = Math.max(1, rect.width - insetX - ((plotRight / canvasWidth) * rect.width));
    const drawableHeight = Math.max(1, rect.height - insetY - ((plotBottom / canvasHeight) * rect.height));

    return {
      x: clamp((clientX - rect.left - insetX) / drawableWidth, 0, 1),
      yFromTop: clamp((clientY - rect.top - insetY) / drawableHeight, 0, 1),
      insetX,
      insetY,
      drawableWidth,
      drawableHeight,
    };
  }, [canvasHeight, canvasWidth, plotBottom, plotLeft, plotRight, plotTop]);

  const findPointHit = useCallback((clientX: number, clientY: number): PointHit | null => {
    const line = linesRef.current[selectedLineIndexRef.current];
    if (!line) {
      return null;
    }
    const coords = getPointFromEvent(clientX, clientY);
    if (!coords) {
      return null;
    }

    const entries = getSortedPointEntries(line);
    for (const entry of entries) {
      const px = coords.insetX + (entry.point.x * coords.drawableWidth);
      const py = coords.insetY + pointValueToCanvasY(line, entry.point.y, coords.drawableHeight);
      const dx = px - (coords.insetX + (coords.x * coords.drawableWidth));
      const dy = py - (coords.insetY + (coords.yFromTop * coords.drawableHeight));
      if (Math.hypot(dx, dy) <= 8) {
        return { lineIndex: selectedLineIndexRef.current, pointIndex: entry.index };
      }
    }

    return null;
  }, [getPointFromEvent]);

  const openPointEditor = useCallback(() => {
    if (locked) {
      return;
    }
    setPointEdits({});
    setShowPointEditor(true);
  }, [locked]);

  const resetCurrentLine = useCallback(() => {
    if (locked) {
      return;
    }
    const line = linesRef.current[selectedLineIndexRef.current];
    if (!line) {
      return;
    }
    const resetY = clamp(0.5, lineMinimum(line), lineMaximum(line));
    const points: EditableLinePoint[] = [{ x: 0, y: resetY }];
    if (line.rightBound ?? false) {
      points.push({ x: 1, y: resetY });
    }

    const nextLines = cloneEditableLines(linesRef.current);
    nextLines[selectedLineIndexRef.current] = {
      ...nextLines[selectedLineIndexRef.current]!,
      points,
    };
    setHoverPoint(null);
    commitLines(nextLines);
  }, [commitLines, locked]);

  const commitCell = useCallback((sortedIndex: number, field: 'x' | 'y', rawValue: string) => {
    if (locked) return;
    const line = linesRef.current[selectedLineIndexRef.current];
    if (!line) return;
    const key = `${sortedIndex}-${field}`;
    const parsed = Number.parseFloat(rawValue);

    if (!Number.isFinite(parsed)) {
      setPointEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }

    const currentSorted = getSortedPointEntries(line);
    const entry = currentSorted[sortedIndex];
    if (!entry) return;

    if (field === 'x') {
      const isRightBound = line.rightBound ?? false;
      if (sortedIndex === 0 || (isRightBound && sortedIndex === currentSorted.length - 1)) {
        setPointEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
        return;
      }
      const prevX = sortedIndex > 0 ? currentSorted[sortedIndex - 1]!.point.x : 0;
      const nextX = sortedIndex < currentSorted.length - 1 ? currentSorted[sortedIndex + 1]!.point.x : 1;
      const clampedX = clamp(parsed, prevX, nextX);

      const nextLines = cloneEditableLines(linesRef.current);
      const targetLine = nextLines[selectedLineIndexRef.current];
      if (!targetLine) return;
      nextLines[selectedLineIndexRef.current] = movePoint(targetLine, entry.index, clampedX, entry.point.y);
      commitLines(nextLines);
    } else {
      const min = lineMinimum(line);
      const max = lineMaximum(line);
      if (parsed < min || parsed > max) {
        setPointEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
        return;
      }

      const nextLines = cloneEditableLines(linesRef.current);
      const targetLine = nextLines[selectedLineIndexRef.current];
      if (!targetLine) return;
      nextLines[selectedLineIndexRef.current] = movePoint(targetLine, entry.index, entry.point.x, parsed);
      commitLines(nextLines);
    }

    setPointEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }, [commitLines, locked]);

  const revertCell = useCallback((sortedIndex: number, field: 'x' | 'y') => {
    const key = `${sortedIndex}-${field}`;
    setPointEdits((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }, []);

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }
    if (!interactive || !currentLine) {
      return;
    }

    setContextMenuPosition(null);

    const hit = findPointHit(event.clientX, event.clientY);
    if (hit) {
      event.preventDefault();
      event.stopPropagation();
      setHoverPoint(hit);
      dragRef.current = hit;
      return;
    }

    if (locked) {
      return;
    }

    const point = getPointFromEvent(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const startY = event.altKey
      ? getLinePointY(currentLine, point.x)
      : canvasYToPointValue(currentLine, point.yFromTop);
    const nextLines = cloneEditableLines(linesRef.current);
    const targetLine = nextLines[selectedLineIndexRef.current];
    if (!targetLine) {
      return;
    }
    const inserted = insertPoint(targetLine, point.x, clamp(startY, lineMinimum(targetLine), lineMaximum(targetLine)));
    nextLines[selectedLineIndexRef.current] = inserted.line;
    setHoverPoint({ lineIndex: selectedLineIndexRef.current, pointIndex: inserted.index });
    dragRef.current = { lineIndex: selectedLineIndexRef.current, pointIndex: inserted.index };
    commitLines(nextLines);
  }, [commitLines, currentLine, findPointHit, getPointFromEvent, interactive, locked]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !currentLine || dragRef.current) {
      return;
    }
    setHoverPoint(findPointHit(event.clientX, event.clientY));
  }, [currentLine, findPointHit, interactive]);

  useEffect(() => {
    if (!interactive) {
      dragRef.current = null;
      return undefined;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const point = getPointFromEvent(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      const nextLines = cloneEditableLines(linesRef.current);
      const targetLine = nextLines[drag.lineIndex];
      if (!targetLine) {
        return;
      }

      const y = canvasYToPointValue(targetLine, point.yFromTop);
      nextLines[drag.lineIndex] = movePoint(targetLine, drag.pointIndex, point.x, y);
      setHoverPoint({ lineIndex: drag.lineIndex, pointIndex: drag.pointIndex });
      commitLines(nextLines);
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
  }, [commitLines, getPointFromEvent, interactive]);

  const handleContextMenu = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !currentLine) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (locked) {
      setContextMenuPosition(null);
      return;
    }

    const hit = findPointHit(event.clientX, event.clientY);
    if (hit) {
      const line = linesRef.current[hit.lineIndex];
      if (!line) {
        return;
      }
      const sortedEntries = getSortedPointEntries(line);
      const sortedPointIndex = sortedEntries.findIndex((entry) => entry.index === hit.pointIndex);
      if (sortedPointIndex > 0 && sortedPointIndex < sortedEntries.length - 1) {
        const nextLines = cloneEditableLines(linesRef.current);
        nextLines[hit.lineIndex]!.points.splice(hit.pointIndex, 1);
        setHoverPoint(null);
        commitLines(nextLines);
      }
      return;
    }

    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  }, [commitLines, currentLine, findPointHit, interactive, locked]);

  const hoverTooltip = useMemo(() => {
    if (!hoverPoint) {
      return null;
    }
    const line = lines[hoverPoint.lineIndex];
    const point = line?.points[hoverPoint.pointIndex];
    const svg = svgRef.current;
    if (!line || !point || !svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const insetX = (plotLeft / canvasWidth) * rect.width;
    const insetY = (plotTop / canvasHeight) * rect.height;
    const drawableWidth = Math.max(1, rect.width - insetX - ((plotRight / canvasWidth) * rect.width));
    const drawableHeight = Math.max(1, rect.height - insetY - ((plotBottom / canvasHeight) * rect.height));
    const formattedTooltip = tooltipFormatter?.({
      line,
      lineIndex: hoverPoint.lineIndex,
      point,
      pointIndex: hoverPoint.pointIndex,
    });
    return {
      pointX: rect.left + insetX + (point.x * drawableWidth),
      canvasTop: rect.top,
      xText: formattedTooltip?.xText ?? point.x.toFixed(4),
      yText: formattedTooltip?.yText ?? point.y.toFixed(4),
      ySuffix: formattedTooltip?.ySuffix ?? null,
    };
  }, [canvasHeight, canvasWidth, hoverPoint, lines, plotBottom, plotLeft, plotRight, plotTop, tooltipFormatter]);

  const axisTicks = 4;
  const axisMin = currentLine ? lineMinimum(currentLine) : 0;
  const axisMax = currentLine ? lineMaximum(currentLine) : 1;

  return (
    <>
      <div className={className}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          className="block h-full w-full"
          style={{ cursor: interactive && !locked ? 'crosshair' : 'default' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => {
            if (!dragRef.current) {
              setHoverPoint(null);
            }
          }}
          onContextMenu={handleContextMenu}
        >
          <rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill={backgroundColor} />
          <rect
            x={plotLeft}
            y={plotTop}
            width={plotWidth}
            height={plotHeight}
            fill={plotBackgroundColor}
            stroke={plotBorderColor}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />

          {showAxes && (
            <g className="pointer-events-none">
              {Array.from({ length: axisTicks + 1 }, (_, index) => {
                const ratio = index / axisTicks;
                const y = plotTop + (ratio * plotHeight);
                const value = axisMax - ((axisMax - axisMin) * ratio);
                return (
                  <g key={`y-${index}`}>
                    <line
                      x1={plotLeft}
                      y1={y}
                      x2={plotLeft + plotWidth}
                      y2={y}
                      stroke="#263246"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={plotLeft - 4}
                      y={y}
                      fill="#74829c"
                      fontFamily="monospace"
                      className="text-role-subheadline"
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {formatAxisValue(value)}
                    </text>
                  </g>
                );
              })}
              {Array.from({ length: axisTicks + 1 }, (_, index) => {
                const ratio = index / axisTicks;
                const x = plotLeft + (ratio * plotWidth);
                return (
                  <g key={`x-${index}`}>
                    <line
                      x1={x}
                      y1={plotTop}
                      x2={x}
                      y2={plotTop + plotHeight}
                      stroke="#263246"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={x}
                      y={plotTop + plotHeight + 5}
                      fill="#74829c"
                      fontFamily="monospace"
                      className="text-role-subheadline"
                      textAnchor="middle"
                      dominantBaseline="hanging"
                    >
                      {formatAxisValue(ratio)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {lines.map((line, lineIndex) => {
            if (lineIndex === activeLineIndex) {
              return null;
            }
            if (!line.points || line.points.length === 0) {
              return null;
            }

            const baseColor = normalizeLineColor(line.color, normalizeLineColor(getJavaLineColor(lineIndex)));
            const strokeColor = darkenColor(baseColor);
            const sortedEntries = getSortedPointEntries(line);
            const polylinePoints = sortedEntries
              .map((entry) => `${plotLeft + (entry.point.x * plotWidth)},${plotTop + pointValueToCanvasY(line, entry.point.y, plotHeight)}`)
              .join(' ');

            return (
              <g key={`${line.varName ?? line.name ?? lineIndex}`}>
                {sortedEntries.length >= 2 && (
                  <polyline
                    points={polylinePoints}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}
          {currentLine && currentLine.points.length > 0 && (() => {
            const lineIndex = activeLineIndex;
            const line = currentLine;
            const baseColor = normalizeLineColor(line.color, normalizeLineColor(getJavaLineColor(lineIndex)));
            const sortedEntries = getSortedPointEntries(line);
            const polylinePoints = sortedEntries
              .map((entry) => `${plotLeft + (entry.point.x * plotWidth)},${plotTop + pointValueToCanvasY(line, entry.point.y, plotHeight)}`)
              .join(' ');

            return (
              <g key={`selected-${line.varName ?? line.name ?? lineIndex}`}>
                {sortedEntries.length >= 2 && (
                  <polyline
                    points={polylinePoints}
                    fill="none"
                    stroke={baseColor}
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {sortedEntries.map((entry) => {
                  const isHovered = hoverPoint?.lineIndex === lineIndex && hoverPoint.pointIndex === entry.index;
                  return (
                    <circle
                      key={`${lineIndex}-${entry.index}`}
                      cx={plotLeft + (entry.point.x * plotWidth)}
                      cy={plotTop + pointValueToCanvasY(line, entry.point.y, plotHeight)}
                      r={isHovered ? 4 : 3.5}
                      fill="#000000"
                      stroke={isHovered ? '#ff4d4f' : baseColor}
                      strokeWidth={1.2}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            );
          })()}
        </svg>
      </div>

      {canUseDom && contextMenuPosition && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-36 rounded border border-app-border bg-app-menu py-1 text-role-body text-app-text-strong shadow-xl"
          data-auxiliary-portal="true"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <button
            type="button"
            className="block w-full px-3 py-1 text-left hover:bg-app-hover"
            onClick={() => {
              setContextMenuPosition(null);
              openPointEditor();
            }}
          >
            Edit Points
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1 text-left hover:bg-app-hover"
            onClick={() => {
              setContextMenuPosition(null);
              resetCurrentLine();
            }}
          >
            Reset Line
          </button>
        </div>,
        document.body,
      )}

      {canUseDom && hoverTooltip && createPortal(
        <div
          className="pointer-events-none fixed z-50 min-w-32 rounded border border-app-border bg-app-input px-3 py-2 font-mono text-role-subheadline text-app-text-strong shadow-lg"
          style={{
            left: Math.max(8, Math.min(hoverTooltip.pointX + 10, window.innerWidth - 176)),
            top: Math.max(8, Math.min(hoverTooltip.canvasTop - 44, window.innerHeight - 44)),
          }}
        >
          <div>x: {hoverTooltip.xText}</div>
          <div>y: {hoverTooltip.yText}{hoverTooltip.ySuffix ? ` ${hoverTooltip.ySuffix}` : ''}</div>
        </div>,
        document.body,
      )}

      {showPointEditor && currentLine && (() => {
        const sortedEntries = getSortedPointEntries(currentLine);
        const isRightBound = currentLine.rightBound ?? false;
        const closeEditor = () => { setShowPointEditor(false); setPointEdits({}); };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeEditor}>
            <div
              className="overflow-hidden rounded border border-app-border bg-app-hover shadow-xl"
              style={{ width: 400, maxHeight: 300 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-app-border px-4 py-2 text-role-headline font-bold text-app-text-strong">
                Line Point Editor
              </div>
              <div className="overflow-auto bg-black" style={{ maxHeight: 230 }}>
                <table className="w-full border-collapse text-role-body text-app-text">
                  <thead>
                    <tr className="border-b border-app-border bg-app-menu">
                      <th className="px-2 py-1 text-left font-medium">x</th>
                      <th className="px-2 py-1 text-left font-medium">y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry, sortedIndex) => {
                      const xReadOnly = sortedIndex === 0 || (isRightBound && sortedIndex === sortedEntries.length - 1);
                      const xKey = `${sortedIndex}-x`;
                      const yKey = `${sortedIndex}-y`;
                      const xDisplay = pointEdits[xKey] ?? String(entry.point.x);
                      const yDisplay = pointEdits[yKey] ?? String(entry.point.y);
                      return (
                        <tr key={entry.index} className="border-b border-app-border/30">
                          <td className="p-0">
                            <input
                              type="number"
                              step="0.001"
                              className={`w-full border-0 bg-transparent px-2 py-1 text-role-body text-app-text-strong outline-none ${
                                xReadOnly
                                  ? 'cursor-default text-app-text-muted'
                                  : 'focus:bg-app-surface-raised focus:ring-1 focus:ring-inset focus:ring-app-accent'
                              }`}
                              value={xDisplay}
                              readOnly={xReadOnly}
                              onChange={(event) => setPointEdits((prev) => ({ ...prev, [xKey]: event.target.value }))}
                              onBlur={() => commitCell(sortedIndex, 'x', xDisplay)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') { commitCell(sortedIndex, 'x', xDisplay); (event.target as HTMLInputElement).blur(); }
                                if (event.key === 'Escape') revertCell(sortedIndex, 'x');
                              }}
                            />
                          </td>
                          <td className="p-0">
                            <input
                              type="number"
                              step="0.001"
                              className="w-full border-0 bg-transparent px-2 py-1 text-role-body text-app-text-strong outline-none focus:bg-app-surface-raised focus:ring-1 focus:ring-inset focus:ring-app-accent"
                              value={yDisplay}
                              onChange={(event) => setPointEdits((prev) => ({ ...prev, [yKey]: event.target.value }))}
                              onBlur={() => commitCell(sortedIndex, 'y', yDisplay)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') { commitCell(sortedIndex, 'y', yDisplay); (event.target as HTMLInputElement).blur(); }
                                if (event.key === 'Escape') revertCell(sortedIndex, 'y');
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-app-border px-4 py-2">
                <button
                  type="button"
                  className="rounded border border-app-border bg-app-surface px-4 py-1.5 text-role-body text-app-text-soft hover:border-app-accent"
                  onClick={closeEditor}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
