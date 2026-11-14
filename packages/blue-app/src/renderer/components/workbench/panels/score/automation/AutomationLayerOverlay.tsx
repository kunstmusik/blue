import { createFrameSnapContext } from '../snap-grid-utils';
import type { TempoMapSnapshot } from '../../../../../../shared/project-editor';
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
import type { ProjectDocumentCommitMetadata } from '../../../../../../shared/project-history';
import { useScoreAutomationStore } from '../../../../../stores/score-automation-store';
import { cn } from '../../../../../lib/cn';
import { attachHostGesture } from '../../../../../lib/host-gesture';
import {
  finishProjectGesture,
  registerHistoryEditorSettlement,
} from '../../../../../lib/history-scope-router';
import { getProjectDocumentId, useProjectStore } from '../../../../../stores/project-store';

interface Props {
  automation: ScoreLayerAutomationSnapshot;
  pixelsPerBeat: number;
  visibleStartBeats?: number;
  visibleEndBeats?: number;
  totalBeats: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  tempo: number;
  tempoMap?: TempoMapSnapshot;
  smpteFrameRate: number;
  mode: 'score' | 'singleLine' | 'multiLine';
  onPatch: (patch: ScoreAutomationPatch, metadata?: ProjectDocumentCommitMetadata) => void;
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
  visibleStartBeats,
  visibleEndBeats,
  totalBeats,
  snapEnabled,
  snapValue,
  tempo,
  tempoMap,
  smpteFrameRate,
  mode,
  onPatch,
}: Props) {
  const frameSnapContext = useMemo(
    () => createFrameSnapContext(tempoMap, smpteFrameRate, tempo),
    [tempoMap, smpteFrameRate, tempo],
  );
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

  const hostGestureDisposerRef = useRef<(() => void) | null>(null);
  const unregisterSettlementRef = useRef<(() => void) | null>(null);
  const gestureIdentityRef = useRef<{
    documentId: string;
    sessionId: number;
    layerId: string;
    parameterId: string;
  } | null>(null);
  const liveGestureRef = useRef<{
    gestureId: string;
    label: string;
    documentId: string;
    sessionId: number;
    hasMoved: boolean;
  } | null>(null);

  const previewRef = useRef(preview);
  previewRef.current = preview;
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  const clearGesture = useCallback(() => {
    unregisterSettlementRef.current?.();
    unregisterSettlementRef.current = null;
    hostGestureDisposerRef.current?.();
    hostGestureDisposerRef.current = null;
    gestureIdentityRef.current = null;
    liveGestureRef.current = null;
    previewRef.current = null;
    dragStateRef.current = { kind: 'none' };
    setPreview(null);
    setDragState({ kind: 'none' });
    setSelectedPoint(null);
    setHoveredPointIndex(null);
  }, [setSelectedPoint]);

  useEffect(() => {
    return () => {
      unregisterSettlementRef.current?.();
      unregisterSettlementRef.current = null;
      hostGestureDisposerRef.current?.();
      hostGestureDisposerRef.current = null;
      if (liveGestureRef.current?.hasMoved) {
        const live = liveGestureRef.current;
        liveGestureRef.current = null;
        void finishProjectGesture({
          documentId: live.documentId,
          sessionId: live.sessionId,
          gestureId: live.gestureId,
          label: live.label,
          phase: 'end',
        });
      }
      clearGesture();
    };
  }, [clearGesture]);

  const selectedParam = automation.parameters.find(
    (p) => p.parameterId === automation.selectedParameterId,
  );

  const latestTargetRef = useRef({
    layerId: automation.layerId,
    parameterId: selectedParam?.parameterId,
  });
  latestTargetRef.current = {
    layerId: automation.layerId,
    parameterId: selectedParam?.parameterId,
  };

  useEffect(() => {
    const identity = gestureIdentityRef.current;
    if (
      !identity ||
      (mode === 'singleLine' &&
        identity.layerId === automation.layerId &&
        identity.parameterId === selectedParam?.parameterId)
    )
      return;
    const live = liveGestureRef.current;
    clearGesture();
    if (live?.hasMoved)
      void finishProjectGesture({
        documentId: live.documentId,
        sessionId: live.sessionId,
        gestureId: live.gestureId,
        label: live.label,
        phase: 'end',
      });
  }, [automation.layerId, selectedParam?.parameterId, mode, clearGesture]);

  // Drop stale hover when leaving single-line mode or switching the active
  // parameter, so the readout never points at a now-irrelevant point.
  useEffect(() => {
    setHoveredPointIndex(null);
  }, [mode, automation.selectedParameterId]);

  const inactiveParams =
    mode === 'singleLine'
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
      return snapBeat(beat, snapEnabled, snapBeats, snapValue, frameSnapContext);
    },
    [snapEnabled, snapValue, tempo, smpteFrameRate, pixelsPerBeat, frameSnapContext],
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

  const dragMoveRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  const mouseUpRef = useRef<() => void>(() => {});
  const cancelRef = useRef<() => void>(() => {});

  const commitPreview = useCallback(
    (
      currentDrag: DragState,
      currentPreview: { parameterId: string; points: AutomationPointSnapshot[] },
    ) => {
      if (currentDrag.kind === 'rangeMove') {
        const beatDelta = computeRangeMoveDelta(currentDrag, currentPreview.points);
        onPatch(
          {
            type: 'moveAutomationRange',
            range: {
              startBeat: currentDrag.startBeat,
              endBeat: currentDrag.endBeat,
              layerIds: [automation.layerId],
              parameterIdsByLayer: { [automation.layerId]: [currentDrag.parameterId] },
            },
            beatDelta,
          },
          { label: 'Move Automation Range', phase: 'single' },
        );
        setRangeSelection(null);
      } else if (currentDrag.kind === 'rangeScale') {
        const { anchorBeat, scaleFactor } = computeRangeScale(currentDrag, currentPreview.points);
        onPatch(
          {
            type: 'scaleAutomationRange',
            range: {
              startBeat: currentDrag.startBeat,
              endBeat: currentDrag.endBeat,
              layerIds: [automation.layerId],
              parameterIdsByLayer: { [automation.layerId]: [currentDrag.parameterId] },
            },
            anchorBeat,
            scaleFactor,
          },
          { label: 'Scale Automation Range', phase: 'single' },
        );
        setRangeSelection(null);
      } else if (currentDrag.kind === 'valueShift') {
        onPatch(
          {
            type: 'setAutomationPoints',
            parameterId: currentDrag.parameterId,
            points: currentPreview.points,
          },
          { label: 'Shift Automation Values', phase: 'single' },
        );
      }
    },
    [automation.layerId, onPatch, setRangeSelection],
  );

  const handleCancel = useCallback(() => {
    const live = liveGestureRef.current;
    if (live && live.hasMoved) {
      void finishProjectGesture({
        documentId: live.documentId,
        sessionId: live.sessionId,
        gestureId: live.gestureId,
        label: live.label,
        phase: 'cancel',
      });
    }
    clearGesture();
  }, [clearGesture]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'singleLine') return;
      if (!selectedParam) return;
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

      const beginGesture = (
        state: DragState,
        liveInfo: {
          gestureId: string;
          label: string;
          documentId: string;
          sessionId: number;
          hasMoved: boolean;
        } | null,
      ) => {
        gestureIdentityRef.current = {
          documentId:
            typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '',
          sessionId: useProjectStore.getState().sessionId,
          layerId: automation.layerId,
          parameterId: selectedParam.parameterId,
        };
        liveGestureRef.current = liveInfo;
        setDragState(state);
        dragStateRef.current = state;

        unregisterSettlementRef.current?.();
        if (typeof registerHistoryEditorSettlement === 'function') {
          const hostDoc = (e.currentTarget as Element)?.ownerDocument ?? document;
          unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
            const live = liveGestureRef.current;
            const identity = gestureIdentityRef.current;
            const state = dragStateRef.current;
            const draft = previewRef.current;
            clearGesture();
            if (
              !identity ||
              identity.documentId !== (getProjectDocumentId() ?? '') ||
              identity.sessionId !== useProjectStore.getState().sessionId ||
              identity.layerId !== latestTargetRef.current.layerId ||
              identity.parameterId !== latestTargetRef.current.parameterId
            )
              return;
            if (live && live.hasMoved) {
              await finishProjectGesture({
                documentId: live.documentId,
                sessionId: live.sessionId,
                gestureId: live.gestureId,
                label: live.label,
                phase: 'end',
              });
            } else if (state && draft) {
              commitPreview(state, draft);
            }
            return useProjectStore.getState().flushPendingPatches?.();
          });
        }

        hostGestureDisposerRef.current?.();
        hostGestureDisposerRef.current = attachHostGesture({
          host: e.currentTarget,
          capture: true,
          onMove: (moveEvent) => {
            dragMoveRef.current(moveEvent.clientX, moveEvent.clientY);
          },
          onRelease: () => {
            mouseUpRef.current();
          },
          onEscape: () => {
            cancelRef.current();
          },
          onBlur: () => {
            cancelRef.current();
          },
          onCancel: () => {
            cancelRef.current();
          },
        });
      };

      // Shift-drag creates a single-line time-range selection.
      if (e.shiftKey) {
        setSelectedPoint(null);
        setSingleParamRange(snappedBeat, snappedBeat);
        beginGesture({ kind: 'rangeCreate', anchorBeat: snappedBeat }, null);
        return;
      }

      // Near an existing point → move it.
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
        const gestureId = `automation-${crypto.randomUUID()}`;
        const documentId = getProjectDocumentId() ?? '';
        const sessionId = useProjectStore.getState().sessionId;

        beginGesture(
          {
            kind: 'move',
            parameterId: selectedParam.parameterId,
            pointIndex: nearIdx,
            minTime: nearBoundaries.minTime,
            maxTime: nearBoundaries.maxTime,
          },
          {
            gestureId,
            label: 'Move Automation Point',
            documentId,
            sessionId,
            hasMoved: false,
          },
        );
        return;
      }

      // Inside an existing range → move it; on an edge → scale it.
      if (singleLineRange) {
        const edge = rangeEdgeNear(singleLineRange, snappedBeat, pixelsPerBeat, EDGE_THRESHOLD_PX);
        if (edge) {
          const anchorBeat = edge === 'left' ? singleLineRange.endBeat : singleLineRange.startBeat;
          beginGesture(
            {
              kind: 'rangeScale',
              parameterId: selectedParam.parameterId,
              startBeat: singleLineRange.startBeat,
              endBeat: singleLineRange.endBeat,
              edge,
              anchorBeat,
              originBeat: snappedBeat,
              startPoints: selectedParam.points,
            },
            null,
          );
          return;
        }
        if (snappedBeat >= singleLineRange.startBeat && snappedBeat <= singleLineRange.endBeat) {
          if (e.ctrlKey || e.metaKey) {
            beginGesture(
              {
                kind: 'valueShift',
                parameterId: selectedParam.parameterId,
                startBeat: singleLineRange.startBeat,
                endBeat: singleLineRange.endBeat,
                originValue: value,
                startPoints: selectedParam.points,
              },
              null,
            );
            return;
          }
          beginGesture(
            {
              kind: 'rangeMove',
              parameterId: selectedParam.parameterId,
              startBeat: singleLineRange.startBeat,
              endBeat: singleLineRange.endBeat,
              originBeat: snappedBeat,
              startPoints: selectedParam.points,
            },
            null,
          );
          return;
        }
      }

      // Otherwise insert a new point at the cursor and immediately begin dragging it.
      setRangeSelection(null);
      const insertIdx = insertionIndexForTime(selectedParam.points, snappedBeat);
      const { minTime, maxTime } = insertDragTimeBoundaries(selectedParam.points, insertIdx);
      setSelectedPoint({
        layerId: automation.layerId,
        parameterId: selectedParam.parameterId,
        pointIndex: insertIdx,
      });
      setHoveredPointIndex(insertIdx);

      const gestureId = `automation-${crypto.randomUUID()}`;
      const documentId = getProjectDocumentId() ?? '';
      const sessionId = useProjectStore.getState().sessionId;

      onPatch(
        {
          type: 'insertAutomationPoint',
          parameterId: selectedParam.parameterId,
          point: { time: snappedBeat, value },
        },
        { label: 'Add Automation Point', gestureId, phase: 'begin' },
      );

      beginGesture(
        {
          kind: 'move',
          parameterId: selectedParam.parameterId,
          pointIndex: insertIdx,
          minTime,
          maxTime,
        },
        {
          gestureId,
          label: 'Add Automation Point',
          documentId,
          sessionId,
          hasMoved: true,
        },
      );
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

      const currentDocId =
        typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
      const currentSessionId = useProjectStore.getState().sessionId;
      const identity = gestureIdentityRef.current;
      if (
        !identity ||
        currentDocId !== identity.documentId ||
        currentSessionId !== identity.sessionId ||
        automation.layerId !== identity.layerId ||
        selectedParam.parameterId !== identity.parameterId
      ) {
        hostGestureDisposerRef.current?.();
        clearGesture();
        return;
      }
      if (dragState.kind === 'move' && dragState.pointIndex >= selectedParam.points.length) {
        hostGestureDisposerRef.current?.();
        clearGesture();
        return;
      }

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
        const clampedBeat = Math.min(dragState.maxTime, Math.max(dragState.minTime, snappedBeat));
        const phase = liveGestureRef.current?.hasMoved ? 'update' : 'begin';
        if (liveGestureRef.current) {
          liveGestureRef.current.hasMoved = true;
        }
        const gestureId = liveGestureRef.current?.gestureId;
        const label = liveGestureRef.current?.label ?? 'Move Automation Point';
        onPatch(
          {
            type: 'moveAutomationPoint',
            parameterId: dragState.parameterId,
            pointIndex: dragState.pointIndex,
            point: { time: clampedBeat, value },
          },
          { label, gestureId, phase },
        );
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
          points: moveRange(
            dragState.startPoints,
            dragState.startBeat,
            dragState.endBeat,
            beatDelta,
          ),
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
    [
      dragState,
      localCoords,
      mode,
      onPatch,
      pixelsPerBeat,
      selectedParam,
      setSingleParamRange,
      snapBeatForMouse,
    ],
  );

  const handleMouseUp = useCallback(() => {
    const live = liveGestureRef.current;
    const identity = gestureIdentityRef.current;
    const currentDocId =
      typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
    const currentSessionId = useProjectStore.getState().sessionId;
    if (
      !identity ||
      currentDocId !== identity.documentId ||
      currentSessionId !== identity.sessionId ||
      automation.layerId !== identity.layerId ||
      selectedParam?.parameterId !== identity.parameterId
    ) {
      clearGesture();
      return;
    }

    if (dragState.kind === 'move') {
      if (live && live.hasMoved) {
        void finishProjectGesture({
          documentId: live.documentId,
          sessionId: live.sessionId,
          gestureId: live.gestureId,
          label: live.label,
          phase: 'end',
        });
      }
      clearGesture();
      return;
    }
    if (dragState.kind === 'rangeCreate') {
      clearGesture();
      return;
    }
    if (preview) {
      commitPreview(dragState, preview);
    }
    clearGesture();
  }, [
    automation.layerId,
    clearGesture,
    commitPreview,
    dragState,
    handleCancel,
    preview,
    selectedParam,
  ]);

  dragMoveRef.current = handleDragMove;
  mouseUpRef.current = handleMouseUp;
  cancelRef.current = handleCancel;

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
    (
      parameter: AutomationParameterSnapshot,
      pointIndex: number,
      event: React.MouseEvent<SVGCircleElement>,
    ) => {
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
      handleMouseDown(event);
    },
    [
      automation.layerId,
      mode,
      selectedParam?.parameterId,
      setRangeSelection,
      setSelectedPoint,
      handleMouseDown,
    ],
  );

  const handlePointContextMenu = useCallback(
    (
      parameter: AutomationParameterSnapshot,
      pointIndex: number,
      event: React.MouseEvent<SVGCircleElement>,
    ) => {
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
      className={cn(
        'absolute inset-0 z-10',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleHoverMove}
      onMouseLeave={() => {
        if (dragState.kind === 'none') setHoveredPointIndex(null);
      }}
      onContextMenu={handleContextMenu}
    >
      {inactiveParams.map((param) => {
        const override =
          preview?.parameterId === param.parameterId
            ? preview.points
            : multiLinePreview?.[param.parameterId];
        return (
          <AutomationLineView
            key={param.parameterId}
            parameter={override ? { ...param, points: override } : param}
            pixelsPerBeat={pixelsPerBeat}
            visibleStartBeats={visibleStartBeats}
            visibleEndBeats={visibleEndBeats}
            totalBeats={totalBeats}
            active={false}
            mode={mode}
            selectedPointIndex={selectedPointIndexFor(param.parameterId)}
            selectionRange={null}
            onPointMouseDown={(pointIndex, event) => handlePointMouseDown(param, pointIndex, event)}
            onPointContextMenu={(pointIndex, event) =>
              handlePointContextMenu(param, pointIndex, event)
            }
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
          visibleStartBeats={visibleStartBeats}
          visibleEndBeats={visibleEndBeats}
          totalBeats={totalBeats}
          active={true}
          mode={mode}
          selectedPointIndex={selectedPointIndexFor(selectedParam.parameterId)}
          hoveredPointIndex={hoveredPointIndex}
          selectionRange={singleLineRange}
          onPointMouseDown={(pointIndex, event) =>
            handlePointMouseDown(selectedParam, pointIndex, event)
          }
          onPointContextMenu={(pointIndex, event) =>
            handlePointContextMenu(selectedParam, pointIndex, event)
          }
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
