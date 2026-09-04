import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  MeterMapSnapshot,
  TempoMapSnapshot,
  TempoMapPatch,
} from '../../../../../shared/project-editor';
import { type SnapValueName, snapValueToBeats } from '@blue/data';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { deriveSnapLineBeats } from './snap-grid-utils';
import {
  beatToScreenX,
  screenXToBeat,
  tempoToScreenY,
  screenYToTempo,
  snapBeat,
  TEMPO_LINE_VIEW_HEIGHT,
  TEMPO_MIN_BPM,
  TEMPO_MAX_BPM,
} from './tempo-map-utils';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../hooks/host-portals';
import { cn } from '../../../../lib/cn';

const BEAT_EPSILON = 0.001;

interface TempoLineViewProps {
  tempoMap: TempoMapSnapshot;
  meterMap: MeterMapSnapshot;
  totalBeats: number;
  pixelsPerBeat: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  rootTimelineOnly: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onTempoPatch: (patch: TempoMapPatch) => void;
}

interface DragState {
  pointIndex: number;
  startBeat: number;
  startTempo: number;
  startClientX: number;
  startClientY: number;
  leftBound: number;
  rightBound: number;
  constrained: 'none' | 'horizontal' | 'vertical';
}

type ContextMenuTarget =
  | { type: 'point'; index: number }
  | { type: 'segment'; index: number }
  | null;

export default function TempoLineView({
  tempoMap,
  meterMap,
  totalBeats,
  pixelsPerBeat,
  snapEnabled,
  snapValue,
  rootTimelineOnly,
  scrollContainerRef,
  onTempoPatch,
}: TempoLineViewProps) {
  const points = tempoMap.points;
  const enabled = tempoMap.enabled;
  const contentWidth = totalBeats * pixelsPerBeat;
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTarget>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const hitRadius = 4;

  const findPointAt = useCallback(
    (x: number, y: number): number => {
      for (let i = 0; i < points.length; i++) {
        const px = beatToScreenX(points[i].beat, pixelsPerBeat);
        const py = tempoToScreenY(points[i].tempo, TEMPO_LINE_VIEW_HEIGHT);
        if (Math.abs(x - px) <= hitRadius && Math.abs(y - py) <= hitRadius) return i;
      }
      return -1;
    },
    [points, pixelsPerBeat],
  );

  const findSegmentAt = useCallback(
    (beat: number): number => {
      for (let i = points.length - 1; i >= 0; i--) {
        if (beat >= points[i].beat) return i;
      }
      return -1;
    },
    [points],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!enabled || !rootTimelineOnly || e.button !== 0) return;
      const rect = svgRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const beat = screenXToBeat(x, pixelsPerBeat);

      const pointIdx = findPointAt(x, y);
      if (pointIdx >= 0) {
        setSelectedPoint(pointIdx);
        const isFirst = pointIdx === 0;
        const leftBound = isFirst ? 0 : points[pointIdx - 1].beat + 0.001;
        const rightBound =
          pointIdx < points.length - 1 ? points[pointIdx + 1].beat - 0.001 : totalBeats;
        setDragState({
          pointIndex: pointIdx,
          startBeat: points[pointIdx].beat,
          startTempo: points[pointIdx].tempo,
          startClientX: e.clientX,
          startClientY: e.clientY,
          leftBound,
          rightBound,
          constrained: 'none',
        });
        return;
      }

      if (pointIdx < 0) {
        const snappedBeat = snapBeat(
          Math.max(0, beat),
          snapEnabled && !e.shiftKey,
          snapValue,
          pixelsPerBeat,
          points[0]?.tempo ?? 60,
          30,
          44100,
          meterMap,
        );
        const tempo = screenYToTempo(y, TEMPO_LINE_VIEW_HEIGHT);
        onTempoPatch({
          type: 'addTempoPoint',
          point: { beat: snappedBeat, tempo, curveType: 'constant' },
        });
        setSelectedPoint(null);
      }
    },
    [
      enabled,
      rootTimelineOnly,
      pixelsPerBeat,
      findPointAt,
      snapEnabled,
      snapValue,
      meterMap,
      points,
      totalBeats,
      onTempoPatch,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragState) {
        const rect = svgRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const idx = findPointAt(x, y);
        if (idx >= 0) {
          setSelectedPoint(idx);
        } else if (selectedPoint !== null) {
          setSelectedPoint(null);
        }
        return;
      }

      const rect = svgRef.current!.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      let newBeat = screenXToBeat(rawX, pixelsPerBeat);
      let newTempo = screenYToTempo(rawY, TEMPO_LINE_VIEW_HEIGHT);

      const ctrlHeld = e.ctrlKey || e.metaKey;
      let constrained = dragState.constrained;
      if (ctrlHeld) {
        if (constrained === 'none') {
          const deltaX = Math.abs(e.clientX - dragState.startClientX);
          const deltaY = Math.abs(e.clientY - dragState.startClientY);
          constrained = deltaX >= deltaY ? 'horizontal' : 'vertical';
        }
      } else if (constrained !== 'none') {
        constrained = 'none';
      }

      if (constrained !== dragState.constrained) {
        setDragState((prev) => (prev ? { ...prev, constrained } : prev));
      }

      if (constrained === 'horizontal') {
        newTempo = dragState.startTempo;
      } else if (constrained === 'vertical') {
        newBeat = dragState.startBeat;
      }

      if (!e.shiftKey && snapEnabled) {
        newBeat = snapBeat(
          newBeat,
          true,
          snapValue,
          pixelsPerBeat,
          points[0]?.tempo ?? 60,
          30,
          44100,
          meterMap,
        );
      }

      newBeat = Math.max(dragState.leftBound, Math.min(dragState.rightBound, newBeat));
      newTempo = Math.max(TEMPO_MIN_BPM, Math.min(TEMPO_MAX_BPM, newTempo));

      onTempoPatch({
        type: 'updateTempoPoint',
        index: dragState.pointIndex,
        patch: { beat: newBeat, tempo: newTempo },
      });
    },
    [
      dragState,
      pixelsPerBeat,
      snapEnabled,
      snapValue,
      meterMap,
      findPointAt,
      selectedPoint,
      onTempoPatch,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!enabled || !rootTimelineOnly) return;
      e.preventDefault();
      const rect = svgRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const pointIdx = findPointAt(x, y);
      if (pointIdx > 0) {
        setSelectedPoint(pointIdx);
        setContextMenuTarget({ type: 'point', index: pointIdx });
        return;
      }

      const beat = screenXToBeat(x, pixelsPerBeat);
      const segIdx = findSegmentAt(beat);
      if (segIdx >= 0) {
        setContextMenuTarget({ type: 'segment', index: segIdx });
      } else {
        setContextMenuTarget(null);
      }
    },
    [enabled, rootTimelineOnly, findPointAt, findSegmentAt, pixelsPerBeat],
  );

  useEffect(() => {
    if (!dragState) return;
    const handleUp = () => setDragState(null);
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [dragState]);

  const buildPath = useCallback((): string => {
    if (points.length === 0) return '';
    let d = '';
    for (let i = 0; i < points.length; i++) {
      const x = beatToScreenX(points[i].beat, pixelsPerBeat);
      const y = tempoToScreenY(points[i].tempo, TEMPO_LINE_VIEW_HEIGHT);
      if (i === 0) {
        d = `M ${x} ${y}`;
      } else if (points[i - 1].curveType === 'constant') {
        const prevY = tempoToScreenY(points[i - 1].tempo, TEMPO_LINE_VIEW_HEIGHT);
        d += ` L ${x} ${prevY} L ${x} ${y}`;
      } else {
        d += ` L ${x} ${y}`;
      }
    }
    const lastX = contentWidth;
    const lastY = tempoToScreenY(points[points.length - 1].tempo, TEMPO_LINE_VIEW_HEIGHT);
    d += ` L ${lastX} ${lastY}`;
    return d;
  }, [points, pixelsPerBeat, contentWidth]);

  const curveColor = enabled ? '#22c55e' : '#555';

  const snapLines: number[] = [];
  if (snapEnabled) {
    const snapBeats = snapValueToBeats(snapValue, points[0]?.tempo ?? 60, 30, 44100, pixelsPerBeat);
    if (snapBeats > 0) {
      for (const beat of deriveSnapLineBeats(snapValue, snapBeats, meterMap, totalBeats)) {
        snapLines.push(beatToScreenX(beat, pixelsPerBeat));
      }
    }
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={cn(
            'block',
            enabled && rootTimelineOnly ? 'cursor-crosshair' : 'cursor-default',
          )}
          style={{ width: contentWidth, height: TEMPO_LINE_VIEW_HEIGHT, minWidth: contentWidth }}
        >
          <svg
            ref={svgRef}
            className="block"
            style={{ width: contentWidth, height: TEMPO_LINE_VIEW_HEIGHT, minWidth: contentWidth }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
          >
            {snapLines.map((sx, i) => (
              <line
                key={`snap-${i}`}
                x1={sx}
                y1={0}
                x2={sx}
                y2={TEMPO_LINE_VIEW_HEIGHT}
                stroke="#333"
                strokeWidth={0.5}
              />
            ))}
            <line
              x1={0}
              y1={TEMPO_LINE_VIEW_HEIGHT}
              x2={contentWidth}
              y2={TEMPO_LINE_VIEW_HEIGHT}
              stroke="#666"
              strokeWidth={1}
            />
            <path d={buildPath()} fill="none" stroke={curveColor} strokeWidth={2} />
            {points.map((pt, i) => {
              const px = beatToScreenX(pt.beat, pixelsPerBeat);
              const py = tempoToScreenY(pt.tempo, TEMPO_LINE_VIEW_HEIGHT);
              const isSelected = selectedPoint === i;
              return (
                <g key={`pt-${i}`}>
                  {isSelected && (
                    <circle cx={px} cy={py} r={6} fill="none" stroke="red" strokeWidth={1.5} />
                  )}
                  <circle
                    cx={px}
                    cy={py}
                    r={3.5}
                    fill="#111"
                    stroke={curveColor}
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </ContextMenu.Trigger>
      {enabled && rootTimelineOnly && (
        <PopoutContextMenuPortal>
          <ContextMenu.Content
            className="editor-context-menu"
            onCloseAutoFocus={() => setContextMenuTarget(null)}
            {...portalEventIsolationProps}
          >
            {contextMenuTarget?.type === 'point' &&
            Math.abs(points[contextMenuTarget.index]?.beat ?? 0) >= BEAT_EPSILON ? (
              <ContextMenu.Item
                className="editor-context-menu__item text-app-danger"
                onSelect={() => {
                  onTempoPatch({ type: 'removeTempoPoint', index: contextMenuTarget.index });
                  if (selectedPoint === contextMenuTarget.index) {
                    setSelectedPoint(null);
                  }
                  setContextMenuTarget(null);
                }}
              >
                Delete Tempo Point
              </ContextMenu.Item>
            ) : contextMenuTarget?.type === 'segment' ? (
              <>
                <ContextMenu.Item
                  className="editor-context-menu__item"
                  disabled={points[contextMenuTarget.index]?.curveType === 'constant'}
                  onSelect={() => {
                    onTempoPatch({
                      type: 'setTempoCurveType',
                      index: contextMenuTarget.index,
                      curveType: 'constant',
                    });
                    setContextMenuTarget(null);
                  }}
                >
                  Constant
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="editor-context-menu__item"
                  disabled={points[contextMenuTarget.index]?.curveType === 'linear'}
                  onSelect={() => {
                    onTempoPatch({
                      type: 'setTempoCurveType',
                      index: contextMenuTarget.index,
                      curveType: 'linear',
                    });
                    setContextMenuTarget(null);
                  }}
                >
                  Linear
                </ContextMenu.Item>
              </>
            ) : null}
          </ContextMenu.Content>
        </PopoutContextMenuPortal>
      )}
    </ContextMenu.Root>
  );
}
