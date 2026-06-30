import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  AutomationParameterSnapshot,
  AutomationPointSnapshot,
  ScoreAutomationPatch,
  ScoreLayerAutomationSnapshot,
} from '../../../../../../shared/project-editor';
import AutomationLineView from './AutomationLineView';
import {
  xToBeat,
  yToValue,
  snapBeat,
  findPointNear,
  insertionIndexForTime,
  dragTimeBoundaries,
  insertDragTimeBoundaries,
  moveRange,
  scaleRange,
  shiftRangeValues,
  rangeEdgeNear,
} from './automation-line-utils';
import { snapValueToBeats, type SnapValueName } from '@blue/data';
import { useScoreAutomationStore } from '../../../../../stores/score-automation-store';

interface Props {
  automation: ScoreLayerAutomationSnapshot;
  pixelsPerBeat: number;
  totalBeats: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  tempo: number;
  smpteFrameRate: number;
  mode: 'score' | 'singleLine' | 'multiLine';
  onPatch: (patch: ScoreAutomationPatch) => void;
}

/**
 * Drag state for the single-line editor. Range gestures snapshot the line's
 * points at gesture start, apply the transform to a live preview, and commit
 * one canonical patch on mouse-up (matching Java ParameterLinePanel's
 * temporary-line-then-write-back behavior). Single-point move commits live.
 */
type DragState =
  | { kind: 'none' }
  | {
      kind: 'move';
      parameterId: string;
      pointIndex: number;
      minTime: number;
      maxTime: number;
    }
  | { kind: 'rangeCreate'; anchorBeat: number }
  | {
      kind: 'rangeMove';
      parameterId: string;
      startBeat: number;
      endBeat: number;
      originBeat: number;
      startPoints: AutomationPointSnapshot[];
    }
  | {
      kind: 'rangeScale';
      parameterId: string;
      startBeat: number;
      endBeat: number;
      edge: 'left' | 'right';
      anchorBeat: number;
      originBeat: number;
      startPoints: AutomationPointSnapshot[];
    }
  | {
      kind: 'valueShift';
      parameterId: string;
      startBeat: number;
      endBeat: number;
      originValue: number;
      startPoints: AutomationPointSnapshot[];
    };

const EDGE_THRESHOLD_PX = 6;
/** Hit-test tolerance (screen px) for hovering a point to show its readout. */
const HOVER_THRESHOLD_PX = 6;

export default function AutomationLayerOverlay({
  automation,
  pixelsPerBeat,
  snapEnabled,
  snapValue,
  tempo,
  smpteFrameRate,
  mode,
  onPatch,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({ kind: 'none' });
  /**
   * Index of the point currently under the cursor on the active parameter
   * (single-line mode). Mirrors Java Blue's ParameterLinePanel.selectedPoint,
   * which is set by mouseMoved and cleared when the cursor leaves any point.
   * Also pinned during a single-point move drag so the on-curve readout follows
   * the dragged point.
   */
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  /** Single-line range preview points for the active parameter (live during drag). */
  const [preview, setPreview] = useState<{
    parameterId: string;
    points: AutomationPointSnapshot[];
  } | null>(null);

  const selectedPoint = useScoreAutomationStore((state) => state.selectedPoint);
  const rangeSelection = useScoreAutomationStore((state) => state.rangeSelection);
  const setSelectedPoint = useScoreAutomationStore((state) => state.setSelectedPoint);
  const setRangeSelection = useScoreAutomationStore((state) => state.setRangeSelection);
  const multiLinePreview = useScoreAutomationStore((state) => state.multiLinePreview);

  const selectedParam = automation.parameters.find(
    (p) => p.parameterId === automation.selectedParameterId,
  );

  // Drop stale hover when leaving single-line mode or switching the active
  // parameter, so the readout never points at a now-irrelevant point.
  useEffect(() => {
    setHoveredPointIndex(null);
  }, [mode, automation.selectedParameterId]);

  const inactiveParams = mode === 'singleLine'
    ? automation.parameters.filter((p) => p.parameterId !== automation.selectedParameterId)
    : automation.parameters;

  const singleLineRange = useMemo(() => {
    if (mode !== 'singleLine' || !selectedParam || !rangeSelection) return null;
    if (!rangeSelection.layerIds.includes(automation.layerId)) return null;
    const params = rangeSelection.parameterIdsByLayer[automation.layerId];
    if (!params || !params.includes(selectedParam.parameterId)) return null;
    return {
      startBeat: Math.min(rangeSelection.startBeat, rangeSelection.endBeat),
      endBeat: Math.max(rangeSelection.startBeat, rangeSelection.endBeat),
    };
  }, [mode, selectedParam, rangeSelection, automation.layerId]);

  const snapBeatForMouse = useCallback(
    (beat: number) => {
      const snapBeats = snapEnabled
        ? snapValueToBeats(snapValue, tempo, smpteFrameRate, 44100, pixelsPerBeat)
        : 0;
      return snapBeat(beat, snapEnabled, snapBeats);
    },
    [snapEnabled, snapValue, tempo, smpteFrameRate, pixelsPerBeat],
  );

  const setSingleParamRange = useCallback(
    (startBeat: number, endBeat: number) => {
      if (!selectedParam) return;
      setRangeSelection({
        startBeat,
        endBeat,
        layerIds: [automation.layerId],
        parameterIdsByLayer: { [automation.layerId]: [selectedParam.parameterId] },
      });
    },
    [automation.layerId, selectedParam, setRangeSelection],
  );

  const localCoords = useCallback((clientX: number, clientY: number) => {
    // Resolve against the container ref (not e.currentTarget) so this also works
    // for window-level mousemove events captured while dragging outside the panel.
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { localX: 0, localY: 0, height: 0 };
    return {
      localX: clientX - rect.left,
      localY: clientY - rect.top,
      height: rect.height,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'singleLine') return;
      if (!selectedParam) return;
      // Only the primary (left) button inserts/moves points; right-click is
      // handled by onContextMenu (delete). Without this guard a right-click in
      // empty space would insert a point via mousedown before the contextmenu
      // delete runs.
      if (e.button !== 0) return;
      e.stopPropagation();

      const { localX, localY, height } = localCoords(e.clientX, e.clientY);
      const beat = xToBeat(localX, pixelsPerBeat);
      const snappedBeat = snapBeatForMouse(beat);
      const value = yToValue(
        localY,
        selectedParam.minimum,
        selectedParam.maximum,
        height,
        selectedParam.resolution,
      );

      // Shift-drag creates a single-line time-range selection.
      if (e.shiftKey) {
        setSelectedPoint(null);
        setSingleParamRange(snappedBeat, snappedBeat);
        setDragState({ kind: 'rangeCreate', anchorBeat: snappedBeat });
        return;
      }

      // Near an existing point → move it (plain) or vertical-shift the selection (ctrl/cmd).
      const nearIdx = findPointNear(
        selectedParam.points,
        snappedBeat,
        value,
        selectedParam.minimum,
        selectedParam.maximum,
        height,
        8,
        pixelsPerBeat,
      );
      if (nearIdx >= 0) {
        setSelectedPoint({
          layerId: automation.layerId,
          parameterId: selectedParam.parameterId,
          pointIndex: nearIdx,
        });
        const nearBoundaries = dragTimeBoundaries(selectedParam.points, nearIdx);
        setDragState({
          kind: 'move',
          parameterId: selectedParam.parameterId,
          pointIndex: nearIdx,
          minTime: nearBoundaries.minTime,
          maxTime: nearBoundaries.maxTime,
        });
        return;
      }

      // Inside an existing range → move it; on an edge → scale it.
      if (singleLineRange) {
        const edge = rangeEdgeNear(singleLineRange, snappedBeat, pixelsPerBeat, EDGE_THRESHOLD_PX);
        if (edge) {
          const anchorBeat = edge === 'left' ? singleLineRange.endBeat : singleLineRange.startBeat;
          setDragState({
            kind: 'rangeScale',
            parameterId: selectedParam.parameterId,
            startBeat: singleLineRange.startBeat,
            endBeat: singleLineRange.endBeat,
            edge,
            anchorBeat,
            originBeat: snappedBeat,
            startPoints: selectedParam.points,
          });
          return;
        }
        if (snappedBeat >= singleLineRange.startBeat && snappedBeat <= singleLineRange.endBeat) {
          // Ctrl/cmd-drag inside the range vertically shifts selected values.
          if (e.ctrlKey || e.metaKey) {
            setDragState({
              kind: 'valueShift',
              parameterId: selectedParam.parameterId,
              startBeat: singleLineRange.startBeat,
              endBeat: singleLineRange.endBeat,
              originValue: value,
              startPoints: selectedParam.points,
            });
            return;
          }
          setDragState({
            kind: 'rangeMove',
            parameterId: selectedParam.parameterId,
            startBeat: singleLineRange.startBeat,
            endBeat: singleLineRange.endBeat,
            originBeat: snappedBeat,
            startPoints: selectedParam.points,
          });
          return;
        }
      }

      // Otherwise insert a new point at the cursor and immediately begin
      // dragging it, matching Java Blue (mousePressed sets
      // selectedPoint = insertGraphPoint(...)). The new index is derived from
      // the backend's time-sorted insertion so the following move patches track
      // the freshly inserted point.
      setRangeSelection(null);
      const insertIdx = insertionIndexForTime(selectedParam.points, snappedBeat);
      const { minTime, maxTime } = insertDragTimeBoundaries(selectedParam.points, insertIdx);
      setSelectedPoint({
        layerId: automation.layerId,
        parameterId: selectedParam.parameterId,
        pointIndex: insertIdx,
      });
      setHoveredPointIndex(insertIdx);
      onPatch({
        type: 'insertAutomationPoint',
        parameterId: selectedParam.parameterId,
        point: { time: snappedBeat, value },
      });
      setDragState({
        kind: 'move',
        parameterId: selectedParam.parameterId,
        pointIndex: insertIdx,
        minTime,
        maxTime,
      });
    },
    [
      automation.layerId,
      localCoords,
      mode,
      onPatch,
      pixelsPerBeat,
      selectedParam,
      setSelectedPoint,
      setRangeSelection,
      setSingleParamRange,
      singleLineRange,
      snapBeatForMouse,
    ],
  );

  // Hover tracking only — fires from the container's onMouseMove while idle.
  // During an active drag this returns early; drag movement is handled by the
  // window-level listener (handleDragMove) so dragging keeps working even when
  // the cursor leaves the panel (Java Swing parity: mouseDragged is delivered
  // to the press target until release, regardless of cursor location).
  const handleHoverMove = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'singleLine' || !selectedParam) return;
      if (dragState.kind !== 'none') return;
      e.stopPropagation();

      const { localX, localY, height } = localCoords(e.clientX, e.clientY);
      const beat = xToBeat(localX, pixelsPerBeat);
      const value = yToValue(
        localY,
        selectedParam.minimum,
        selectedParam.maximum,
        height,
        selectedParam.resolution,
      );
      const idx = findPointNear(
        selectedParam.points,
        beat,
        value,
        selectedParam.minimum,
        selectedParam.maximum,
        height,
        HOVER_THRESHOLD_PX,
        pixelsPerBeat,
      );
      setHoveredPointIndex(idx >= 0 ? idx : null);
    },
    [dragState.kind, localCoords, mode, pixelsPerBeat, selectedParam],
  );

  // Drag movement — invoked from a window mousemove listener (attached while a
  // drag is active) so it receives events even outside the overlay bounds.
  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (dragState.kind === 'none') return;
      if (mode !== 'singleLine' || !selectedParam) return;

      const { localX, localY, height } = localCoords(clientX, clientY);
      const beat = xToBeat(localX, pixelsPerBeat);
      const snappedBeat = snapBeatForMouse(beat);

      if (dragState.kind === 'rangeCreate') {
        setSingleParamRange(dragState.anchorBeat, snappedBeat);
        return;
      }

      if (dragState.kind === 'move') {
        const value = yToValue(
          localY,
          selectedParam.minimum,
          selectedParam.maximum,
          height,
          selectedParam.resolution,
        );
        // Clamp the snapped time to the neighbor boundaries captured at drag
        // start (Java ParameterLinePanel parity), so the point can never cross
        // a neighbor and reorder/swap indices.
        const clampedBeat = Math.min(
          dragState.maxTime,
          Math.max(dragState.minTime, snappedBeat),
        );
        onPatch({
          type: 'moveAutomationPoint',
          parameterId: dragState.parameterId,
          pointIndex: dragState.pointIndex,
          point: { time: clampedBeat, value },
        });
        // Re-derive the hovered index from the cursor so the readout stays on
        // the dragged point even if the points array re-sorts around it.
        const idx = findPointNear(
          selectedParam.points,
          clampedBeat,
          value,
          selectedParam.minimum,
          selectedParam.maximum,
          height,
          HOVER_THRESHOLD_PX,
          pixelsPerBeat,
        );
        setHoveredPointIndex(idx >= 0 ? idx : dragState.pointIndex);
        return;
      }

      if (dragState.kind === 'rangeMove') {
        let beatDelta = snappedBeat - dragState.originBeat;
        const inRangeTimes = dragState.startPoints
          .filter((p) => p.time >= dragState.startBeat && p.time <= dragState.endBeat)
          .map((p) => p.time);
        const minTime = inRangeTimes.length > 0 ? Math.min(...inRangeTimes) : 0;
        beatDelta = Math.max(-minTime, beatDelta);
        setPreview({
          parameterId: dragState.parameterId,
          points: moveRange(dragState.startPoints, dragState.startBeat, dragState.endBeat, beatDelta),
        });
        return;
      }

      if (dragState.kind === 'rangeScale') {
        const span = dragState.endBeat - dragState.startBeat;
        if (span <= 0) return;
        let scaleFactor: number;
        if (dragState.edge === 'right') {
          scaleFactor = (snappedBeat - dragState.anchorBeat) / span;
        } else {
          scaleFactor = (dragState.anchorBeat - snappedBeat) / span;
        }
        scaleFactor = Math.max(0, scaleFactor);
        setPreview({
          parameterId: dragState.parameterId,
          points: scaleRange(
            dragState.startPoints,
            dragState.startBeat,
            dragState.endBeat,
            dragState.anchorBeat,
            scaleFactor,
          ),
        });
        return;
      }

      if (dragState.kind === 'valueShift') {
        const currentValue = yToValue(
          localY,
          selectedParam.minimum,
          selectedParam.maximum,
          height,
          selectedParam.resolution,
        );
        const delta = currentValue - dragState.originValue;
        setPreview({
          parameterId: dragState.parameterId,
          points: shiftRangeValues(
            dragState.startPoints,
            dragState.startBeat,
            dragState.endBeat,
            delta,
            selectedParam.minimum,
            selectedParam.maximum,
            selectedParam.resolution,
          ),
        });
        return;
      }
    },
    [dragState, localCoords, mode, onPatch, pixelsPerBeat, selectedParam, setSingleParamRange, snapBeatForMouse],
  );

  // Keep the latest drag/release handlers reachable from the window listeners
  // (which are attached once per drag, not on every dragState change). The
  // .current assignments live just below handleMouseUp to avoid a TDZ reference.
  const dragMoveRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  const mouseUpRef = useRef<() => void>(() => {});

  const handleMouseUp = useCallback(() => {
    if (dragState.kind === 'move') {
      // Release ends the click-selection so the point isn't left stuck selected
      // (which would keep it red and pin the readout even after the cursor
      // moves away). Hover re-highlights it via hoveredPointIndex while the
      // cursor remains over the point.
      setSelectedPoint(null);
      setDragState({ kind: 'none' });
      return;
    }
    if (dragState.kind === 'rangeCreate') {
      setDragState({ kind: 'none' });
      return;
    }
    if (dragState.kind === 'rangeMove' && preview) {
      const beatDelta = computeRangeMoveDelta(dragState, preview.points);
      onPatch({
        type: 'moveAutomationRange',
        range: {
          startBeat: dragState.startBeat,
          endBeat: dragState.endBeat,
          layerIds: [automation.layerId],
          parameterIdsByLayer: { [automation.layerId]: [dragState.parameterId] },
        },
        beatDelta,
      });
      // Points moved to new times — clear the (now stale) range, matching Java.
      setRangeSelection(null);
    } else if (dragState.kind === 'rangeScale' && preview) {
      const { anchorBeat, scaleFactor } = computeRangeScale(dragState, preview.points);
      onPatch({
        type: 'scaleAutomationRange',
        range: {
          startBeat: dragState.startBeat,
          endBeat: dragState.endBeat,
          layerIds: [automation.layerId],
          parameterIdsByLayer: { [automation.layerId]: [dragState.parameterId] },
        },
        anchorBeat,
        scaleFactor,
      });
      setRangeSelection(null);
    } else if (dragState.kind === 'valueShift' && preview) {
      onPatch({
        type: 'setAutomationPoints',
        parameterId: dragState.parameterId,
        points: preview.points,
      });
    }
    setPreview(null);
    setDragState({ kind: 'none' });
  }, [automation.layerId, dragState, onPatch, preview, setRangeSelection, setSelectedPoint]);

  // Point the window-listener refs at the latest handlers (declared above), then
  // capture mousemove/mouseup at the window for the lifetime of a drag so the
  // gesture keeps tracking even after the cursor leaves the panel (Java Swing
  // parity: mouseDragged is delivered to the press target until release).
  dragMoveRef.current = handleDragMove;
  mouseUpRef.current = handleMouseUp;
  const isDragging = dragState.kind !== 'none';
  useLayoutEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => dragMoveRef.current(e.clientX, e.clientY);
    const onUp = () => mouseUpRef.current();
    // Capture phase: these fire before the target element's handlers and before
    // any bubble-phase stopPropagation. This matters because other (inactive)
    // automation overlays are still pointer-events-auto in single-line mode and
    // their onMouseMove calls stopPropagation, which would otherwise block a
    // bubble-phase window listener and freeze the drag while the cursor is over
    // another panel.
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };
  }, [isDragging]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'singleLine' || !selectedParam) return;
      e.preventDefault();
      e.stopPropagation();

      const { localX, localY, height } = localCoords(e.clientX, e.clientY);
      const beat = xToBeat(localX, pixelsPerBeat);
      const value = yToValue(
        localY,
        selectedParam.minimum,
        selectedParam.maximum,
        height,
        selectedParam.resolution,
      );

      const nearIdx = findPointNear(
        selectedParam.points,
        beat,
        value,
        selectedParam.minimum,
        selectedParam.maximum,
        height,
        8,
        pixelsPerBeat,
      );

      if (nearIdx > 0) {
        setSelectedPoint(null);
        setRangeSelection(null);
        onPatch({
          type: 'deleteAutomationPoint',
          parameterId: selectedParam.parameterId,
          pointIndex: nearIdx,
        });
      }
    },
    [localCoords, mode, onPatch, pixelsPerBeat, selectedParam, setRangeSelection, setSelectedPoint],
  );

  const handlePointMouseDown = useCallback(
    (parameter: AutomationParameterSnapshot, pointIndex: number, event: React.MouseEvent<SVGCircleElement>) => {
      if (mode !== 'singleLine') return;
      if (parameter.parameterId !== selectedParam?.parameterId) return;
      // Left-click only; right-click on a point is a delete (onContextMenu).
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedPoint({
        layerId: automation.layerId,
        parameterId: parameter.parameterId,
        pointIndex,
      });
      setRangeSelection(null);
      // Pin the readout to the grabbed point so it shows during the drag even
      // before the next mousemove lands.
      setHoveredPointIndex(pointIndex);
      const { minTime, maxTime } = dragTimeBoundaries(parameter.points, pointIndex);
      setDragState({
        kind: 'move',
        parameterId: parameter.parameterId,
        pointIndex,
        minTime,
        maxTime,
      });
    },
    [automation.layerId, mode, selectedParam?.parameterId, setRangeSelection, setSelectedPoint],
  );

  const handlePointContextMenu = useCallback(
    (parameter: AutomationParameterSnapshot, pointIndex: number, event: React.MouseEvent<SVGCircleElement>) => {
      if (mode !== 'singleLine' || parameter.parameterId !== selectedParam?.parameterId) return;
      event.preventDefault();
      event.stopPropagation();
      if (pointIndex > 0) {
        setSelectedPoint(null);
        setRangeSelection(null);
        onPatch({
          type: 'deleteAutomationPoint',
          parameterId: parameter.parameterId,
          pointIndex,
        });
      }
    },
    [mode, onPatch, selectedParam?.parameterId, setRangeSelection, setSelectedPoint],
  );

  const selectedPointIndexFor = useCallback(
    (parameterId: string) => {
      if (selectedPoint?.layerId !== automation.layerId) return null;
      if (selectedPoint.parameterId !== parameterId) return null;
      return selectedPoint.pointIndex;
    },
    [automation.layerId, selectedPoint],
  );

  if (automation.parameters.length === 0) return null;

  const interactive = mode === 'singleLine';

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleHoverMove}
      onMouseLeave={() => {
        if (dragState.kind === 'none') setHoveredPointIndex(null);
      }}
      onContextMenu={handleContextMenu}
    >
      {inactiveParams.map((param) => {
        const override = preview?.parameterId === param.parameterId
          ? preview.points
          : multiLinePreview?.[param.parameterId];
        return (
          <AutomationLineView
            key={param.parameterId}
            parameter={override ? { ...param, points: override } : param}
            pixelsPerBeat={pixelsPerBeat}
            active={false}
            mode={mode}
            selectedPointIndex={selectedPointIndexFor(param.parameterId)}
            selectionRange={null}
            onPointMouseDown={(pointIndex, event) => handlePointMouseDown(param, pointIndex, event)}
            onPointContextMenu={(pointIndex, event) => handlePointContextMenu(param, pointIndex, event)}
          />
        );
      })}
      {mode === 'singleLine' && selectedParam && (
        <AutomationLineView
          parameter={
            preview?.parameterId === selectedParam.parameterId
              ? { ...selectedParam, points: preview.points }
              : selectedParam
          }
          pixelsPerBeat={pixelsPerBeat}
          active={true}
          mode={mode}
          selectedPointIndex={selectedPointIndexFor(selectedParam.parameterId)}
          hoveredPointIndex={hoveredPointIndex}
          selectionRange={singleLineRange}
          onPointMouseDown={(pointIndex, event) => handlePointMouseDown(selectedParam, pointIndex, event)}
          onPointContextMenu={(pointIndex, event) => handlePointContextMenu(selectedParam, pointIndex, event)}
        />
      )}
    </div>
  );
}

/**
 * Recover the committed beat delta from preview points: difference between a
 * moved in-range point and its start position. Falls back to deriving from the
 * first moved point.
 */
function computeRangeMoveDelta(
  drag: Extract<DragState, { kind: 'rangeMove' }>,
  previewPoints: AutomationPointSnapshot[],
): number {
  for (let i = 0; i < drag.startPoints.length && i < previewPoints.length; i++) {
    const start = drag.startPoints[i]!;
    const after = previewPoints[i]!;
    const wasInRange = start.time >= drag.startBeat && start.time <= drag.endBeat;
    if (wasInRange && after.time !== start.time) {
      return after.time - start.time;
    }
  }
  return 0;
}

function computeRangeScale(
  drag: Extract<DragState, { kind: 'rangeScale' }>,
  previewPoints: AutomationPointSnapshot[],
): { anchorBeat: number; scaleFactor: number } {
  for (let i = 0; i < drag.startPoints.length && i < previewPoints.length; i++) {
    const start = drag.startPoints[i]!;
    const after = previewPoints[i]!;
    const wasInRange = start.time >= drag.startBeat && start.time <= drag.endBeat;
    if (wasInRange && start.time !== drag.anchorBeat && after.time !== start.time) {
      const startOffset = start.time - drag.anchorBeat;
      const afterOffset = after.time - drag.anchorBeat;
      if (startOffset !== 0) {
        return { anchorBeat: drag.anchorBeat, scaleFactor: afterOffset / startOffset };
      }
    }
  }
  return { anchorBeat: drag.anchorBeat, scaleFactor: 1 };
}
