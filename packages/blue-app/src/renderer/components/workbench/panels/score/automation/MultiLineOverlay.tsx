import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AutomationRangeRef,
  ScoreAutomationPatch,
  ScoreLayerGroupSnapshot,
} from '../../../../../../shared/project-editor';
import { useProjectStore } from '../../../../../stores/project-store';
import { useScoreAutomationStore } from '../../../../../stores/score-automation-store';
import { useScoreSelectionStore } from '../../../../../stores/score-selection-store';
import { snapValueToBeats, type SnapValueName } from '@blue/data';
import {
  xToBeat,
  snapBeat,
  moveRangeWithAnchors,
  scaleRangeWithAnchors,
  rangeEdgeNear,
} from './automation-line-utils';
import {
  buildLayerRowGeometry,
  totalLayerContentHeight,
  layersIntersectingYRange,
  buildRangeRefForLayers,
  computeMultiLinePreview,
} from './automation-selection-utils';

interface Props {
  layerGroups: ScoreLayerGroupSnapshot[];
  pixelsPerBeat: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  tempo: number;
  smpteFrameRate: number;
}

type DragState =
  | { kind: 'none' }
  | { kind: 'selecting'; anchorBeat: number; startY: number; shiftKey: boolean }
  | { kind: 'moving'; originBeat: number; range: AutomationRangeRef; beatDelta: number }
  | {
      kind: 'scaling';
      edge: 'left' | 'right';
      anchorBeat: number;
      span: number;
      range: AutomationRangeRef;
      scaleFactor: number;
    };

const EDGE_THRESHOLD_PX = 6;
/** Minimum selection width in pixels during scale (Java MultiLineScaleMouseListener.EDGE). */
const MIN_EDGE_PX = 5;

/**
 * Multi-line (ScoreMode.MULTI_LINE) interaction layer. Renders above all score
 * rows and owns the cross-layer time/layer range selection plus the move and
 * scale gestures. Automation lines are drawn by the per-row AutomationLayerOverlay
 * instances (pointer-events-none in this mode); this component reads committed
 * points from the snapshot to produce a live preview via the shared store, then
 * commits one canonical range patch on gesture completion.
 *
 * Mirrors Java Blue's MultiLineSelectionMouseProcessor / MultiLineMoveMouseListener /
 * MultiLineScaleMouseListener:
 * - A plain drag creates a time-and-layer selection (automation-only).
 * - A shift-drag creates the selection AND adds intersecting score objects / audio
 *   clips to the score selection store (Java's marqueeSelectionPerformed).
 * - Dragging inside the selection moves it; dragging an edge scales it.
 * - Only explicitly shift-selected objects/clips move/scale with the automation
 *   lines (Java's selectedScoreObjects model).
 * - Ctrl/Cmd bypasses snap during move/scale (Java's !isControlDown()).
 */
export default function MultiLineOverlay({
  layerGroups,
  pixelsPerBeat,
  snapEnabled,
  snapValue,
  tempo,
  smpteFrameRate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>({ kind: 'none' });
  const lastClientX = useRef(0);

  const rangeSelection = useScoreAutomationStore((s) => s.rangeSelection);
  const setRangeSelection = useScoreAutomationStore((s) => s.setRangeSelection);
  const setMultiLinePreview = useScoreAutomationStore((s) => s.setMultiLinePreview);
  const setMultiLineObjectPreview = useScoreAutomationStore((s) => s.setMultiLineObjectPreview);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);

  const geometry = useMemo(() => buildLayerRowGeometry(layerGroups), [layerGroups]);
  const contentHeight = useMemo(() => totalLayerContentHeight(geometry), [geometry]);
  const hasAutomatable = geometry.some((row) => row.automatable);

  const dispatchPatch = useCallback(
    (patch: ScoreAutomationPatch) => {
      void (async () => {
        await applyProjectDocumentPatch({ score: patch });
        await flushPendingPatches();
      })();
    },
    [applyProjectDocumentPatch, flushPendingPatches],
  );

  /**
   * Snap a beat value, with Ctrl/Cmd bypass matching Java's
   * `!e.isControlDown()` check in MultiLineMove/ScaleMouseListener.
   */
  const snapBeatForMouse = useCallback(
    (beat: number, bypassSnap: boolean) => {
      if (bypassSnap) return Math.max(0, beat);
      const snapBeats = snapEnabled
        ? snapValueToBeats(snapValue, tempo, smpteFrameRate, 44100, pixelsPerBeat)
        : 0;
      return snapBeat(beat, snapEnabled, snapBeats);
    },
    [snapEnabled, snapValue, tempo, smpteFrameRate, pixelsPerBeat],
  );

  // E1: Auto-scroll near viewport edges during drag (Java's checkScroll).
  // Finds the .score-timeline-scroll ancestor and scrolls it when the cursor
  // is within SCROLL_EDGE_PX of the left/right viewport boundary.
  const SCROLL_EDGE_PX = 40;
  const scrollContainer = useCallback((): HTMLElement | null => {
    let el: HTMLElement | null = containerRef.current;
    while (el) {
      if (el.classList.contains('score-timeline-scroll')) return el;
      el = el.parentElement;
    }
    return null;
  }, []);

  useEffect(() => {
    if (drag.kind === 'none') return;
    let raf = 0;
    const tick = () => {
      const sc = scrollContainer();
      if (sc) {
        const rect = sc.getBoundingClientRect();
        const x = lastClientX.current;
        const edgeLeft = rect.left + SCROLL_EDGE_PX;
        const edgeRight = rect.right - SCROLL_EDGE_PX;
        if (x < edgeLeft) {
          sc.scrollLeft -= 8;
        } else if (x > edgeRight) {
          sc.scrollLeft += 8;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [drag.kind, scrollContainer]);

  const currentRange = useMemo((): AutomationRangeRef | null => {
    if (!rangeSelection || rangeSelection.layerIds.length === 0) return null;
    return {
      startBeat: Math.min(rangeSelection.startBeat, rangeSelection.endBeat),
      endBeat: Math.max(rangeSelection.startBeat, rangeSelection.endBeat),
      layerIds: rangeSelection.layerIds,
      parameterIdsByLayer: rangeSelection.parameterIdsByLayer,
    };
  }, [rangeSelection]);

  const localCoords = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!hasAutomatable) return;
      e.stopPropagation();
      const coords = localCoords(e);
      if (!coords) return;
      const bypassSnap = e.ctrlKey || e.metaKey;
      const beat = snapBeatForMouse(xToBeat(coords.x, pixelsPerBeat), bypassSnap);

      if (currentRange) {
        // Java's marquee.contains(p) checks BOTH horizontal (beat) and vertical
        // (layer row) containment. Compute the vertical extent of the selected
        // rows and reject clicks that fall outside it — those start a new
        // selection, not a move.
        const selectedRows = geometry.filter((r) => currentRange.layerIds.includes(r.layerId));
        const marqueeTop =
          selectedRows.length > 0 ? Math.min(...selectedRows.map((r) => r.top)) : 0;
        const marqueeBottom =
          selectedRows.length > 0
            ? Math.max(...selectedRows.map((r) => r.top + r.height))
            : Infinity;
        const insideVertical = coords.y >= marqueeTop && coords.y <= marqueeBottom;

        const edge = rangeEdgeNear(
          { startBeat: currentRange.startBeat, endBeat: currentRange.endBeat },
          beat,
          pixelsPerBeat,
          EDGE_THRESHOLD_PX,
        );
        if (edge && insideVertical) {
          const anchorBeat = edge === 'left' ? currentRange.endBeat : currentRange.startBeat;
          setDrag({
            kind: 'scaling',
            edge,
            anchorBeat,
            span: currentRange.endBeat - currentRange.startBeat,
            range: currentRange,
            scaleFactor: 1,
          });
          return;
        }
        if (insideVertical && beat >= currentRange.startBeat && beat <= currentRange.endBeat) {
          setDrag({ kind: 'moving', originBeat: beat, range: currentRange, beatDelta: 0 });
          return;
        }
      }

      // Start a new cross-layer selection.
      setMultiLinePreview(null);
      setMultiLineObjectPreview(null);
      setRangeSelection(null);
      useScoreSelectionStore.getState().clearSelection();
      setDrag({ kind: 'selecting', anchorBeat: beat, startY: coords.y, shiftKey: e.shiftKey });
    },
    [
      currentRange,
      geometry,
      hasAutomatable,
      localCoords,
      pixelsPerBeat,
      setMultiLineObjectPreview,
      setMultiLinePreview,
      setRangeSelection,
      snapBeatForMouse,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (drag.kind === 'none') return;
      const coords = localCoords(e);
      if (!coords) return;
      lastClientX.current = e.clientX;
      const bypassSnap = e.ctrlKey || e.metaKey;
      const beat = snapBeatForMouse(xToBeat(coords.x, pixelsPerBeat), bypassSnap);

      if (drag.kind === 'selecting') {
        const rows = layersIntersectingYRange(geometry, drag.startY, coords.y);
        if (rows.length === 0) {
          setRangeSelection(null);
          return;
        }
        const startBeat = Math.min(drag.anchorBeat, beat);
        const endBeat = Math.max(drag.anchorBeat, beat);
        setRangeSelection(buildRangeRefForLayers(rows, startBeat, endBeat));
        return;
      }

      if (drag.kind === 'moving') {
        let beatDelta = beat - drag.originBeat;
        const minDelta = computeMinMoveDelta(layerGroups, drag.range);
        beatDelta = Math.max(minDelta, beatDelta);
        setDrag({ ...drag, beatDelta });
        setMultiLinePreview(
          computeMultiLinePreview(layerGroups, drag.range, (points) =>
            moveRangeWithAnchors(points, drag.range.startBeat, drag.range.endBeat, beatDelta),
          ),
        );
        setMultiLineObjectPreview(computeObjectMovePreview(layerGroups, drag.range, beatDelta));
        return;
      }

      if (drag.kind === 'scaling') {
        if (drag.span <= 0) return;
        const minEdgeBeats = MIN_EDGE_PX / pixelsPerBeat;
        let clampedBeat = beat;
        if (drag.edge === 'left') {
          clampedBeat = Math.max(0, Math.min(drag.range.endBeat - minEdgeBeats, beat));
        } else {
          clampedBeat = Math.max(drag.range.startBeat + minEdgeBeats, beat);
        }
        let scaleFactor =
          drag.edge === 'right'
            ? (clampedBeat - drag.anchorBeat) / drag.span
            : (drag.anchorBeat - clampedBeat) / drag.span;
        scaleFactor = Math.max(0, scaleFactor);
        setDrag({ ...drag, scaleFactor });
        setMultiLinePreview(
          computeMultiLinePreview(layerGroups, drag.range, (points) =>
            scaleRangeWithAnchors(
              points,
              drag.range.startBeat,
              drag.range.endBeat,
              drag.anchorBeat,
              scaleFactor,
            ),
          ),
        );
        setMultiLineObjectPreview(
          computeObjectScalePreview(layerGroups, drag.range, drag.anchorBeat, scaleFactor),
        );
        return;
      }
    },
    [
      drag,
      geometry,
      layerGroups,
      localCoords,
      pixelsPerBeat,
      setMultiLineObjectPreview,
      setMultiLinePreview,
      setRangeSelection,
      snapBeatForMouse,
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (drag.kind === 'selecting') {
        // B2: On selection release, if shift was held, populate the score-object
        // selection with objects/clips whose bounds intersect the marquee on the
        // selected layers (Java's marqueeSelectionPerformed). Without shift, the
        // object selection is cleared (automation-only range).
        if (e.shiftKey || drag.shiftKey) {
          const range = currentRange ?? rangeSelection;
          if (range) {
            const ids = collectIntersectingObjectIds(layerGroups, range);
            if (ids.length > 0) {
              useScoreSelectionStore.getState().setSelection(ids);
            }
          }
        }
        setDrag({ kind: 'none' });
        return;
      }

      // Collect explicitly selected object IDs for the move/scale patch (B3).
      // Only shift-selected objects participate — matches Java's
      // ScoreController.getSelectedScoreObjects() model.
      const selectedIds = [...useScoreSelectionStore.getState().selectedObjectIds];
      const objectIds = selectedIds.length > 0 ? selectedIds : undefined;

      if (drag.kind === 'moving') {
        if (drag.beatDelta !== 0) {
          dispatchPatch({
            type: 'moveAutomationRange',
            range: drag.range,
            beatDelta: drag.beatDelta,
            objectIds,
          });
        }
        setMultiLinePreview(null);
        setMultiLineObjectPreview(null);
        // Keep selection alive — update range to the new position (Java updates
        // marquee.startTime/endTime to the translated position on release).
        const newStart = Math.max(0, drag.range.startBeat + drag.beatDelta);
        const newEnd = Math.max(0, drag.range.endBeat + drag.beatDelta);
        setRangeSelection({ ...drag.range, startBeat: newStart, endBeat: newEnd });
        // Object selection persists — do NOT clear it.
      } else if (drag.kind === 'scaling') {
        if (drag.scaleFactor !== 1 && drag.span > 0) {
          if (objectIds && hasPartialOverlapObject(layerGroups, drag.range, objectIds)) {
            setMultiLinePreview(null);
            setMultiLineObjectPreview(null);
            setDrag({ kind: 'none' });
            return;
          }
          dispatchPatch({
            type: 'scaleAutomationRange',
            range: drag.range,
            anchorBeat: drag.anchorBeat,
            scaleFactor: drag.scaleFactor,
            objectIds,
          });
        }
        setMultiLinePreview(null);
        setMultiLineObjectPreview(null);
        // Update range to the scaled position.
        const scaledStart =
          drag.anchorBeat + (drag.range.startBeat - drag.anchorBeat) * drag.scaleFactor;
        const scaledEnd =
          drag.anchorBeat + (drag.range.endBeat - drag.anchorBeat) * drag.scaleFactor;
        setRangeSelection({ ...drag.range, startBeat: scaledStart, endBeat: scaledEnd });
      }
      setDrag({ kind: 'none' });
    },
    [
      currentRange,
      dispatchPatch,
      drag,
      layerGroups,
      rangeSelection,
      setMultiLinePreview,
      setRangeSelection,
    ],
  );

  if (!hasAutomatable) return null;

  // Selection rectangle geometry (translated during a move to follow the cursor).
  const selectionRect = (() => {
    if (!currentRange) return null;
    let startBeat = currentRange.startBeat;
    let endBeat = currentRange.endBeat;
    if (drag.kind === 'moving') {
      startBeat = Math.max(0, startBeat + drag.beatDelta);
      endBeat = Math.max(0, endBeat + drag.beatDelta);
    }
    const left = Math.min(startBeat, endBeat) * pixelsPerBeat;
    const width = Math.abs(endBeat - startBeat) * pixelsPerBeat;
    // Vertical span covers every selected row.
    const selectedRows = geometry.filter((r) => currentRange.layerIds.includes(r.layerId));
    if (selectedRows.length === 0) return null;
    const top = Math.min(...selectedRows.map((r) => r.top));
    const bottom = Math.max(...selectedRows.map((r) => r.top + r.height));
    return { left, width, top, height: bottom - top };
  })();

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-auto"
      style={{ height: contentHeight }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {selectionRect && (
        <div
          className="absolute border border-app-accent/70 bg-app-accent/15 pointer-events-none"
          style={{
            left: selectionRect.left,
            width: Math.max(selectionRect.width, 1),
            top: selectionRect.top,
            height: selectionRect.height,
          }}
        />
      )}
    </div>
  );
}

/**
 * Collect objectIds for score objects / audio clips on automatable layers whose
 * [start, start+duration] intersects the range [startBeat, endBeat]. Used by
 * shift-drag to populate the score selection (Java's marqueeSelectionPerformed
 * uses intersection, not just start-in-range).
 */
function collectIntersectingObjectIds(
  layerGroups: ScoreLayerGroupSnapshot[],
  range: AutomationRangeRef,
): string[] {
  const ids: string[] = [];
  const layerSet = new Set(range.layerIds);
  for (const group of layerGroups) {
    for (const layer of group.layers) {
      if (!layerSet.has(layer.layerId)) continue;
      for (const item of layer.items) {
        const itemEnd = item.startBeats + item.durationBeats;
        if (item.startBeats < range.endBeat && itemEnd > range.startBeat) {
          ids.push(item.objectId);
        }
      }
    }
  }
  return ids;
}

/**
 * C1: Check if any selected object's [start, start+duration] intersects but is
 * not fully contained within the selection range. Java aborts scaling in this
 * case ("Overlapping scoreobjects found, don't scale") to prevent partial-object
 * scaling. Uses simple intersection test matching Java's check.
 */
function hasPartialOverlapObject(
  layerGroups: ScoreLayerGroupSnapshot[],
  range: AutomationRangeRef,
  objectIds: string[],
): boolean {
  const wanted = new Set(objectIds);
  for (const group of layerGroups) {
    for (const layer of group.layers) {
      for (const item of layer.items) {
        if (!wanted.has(item.objectId)) continue;
        const itemEnd = item.startBeats + item.durationBeats;
        // Object intersects the range but is not fully contained within it.
        const intersects = item.startBeats < range.endBeat && itemEnd > range.startBeat;
        const fullyContained = item.startBeats >= range.startBeat && itemEnd <= range.endBeat;
        if (intersects && !fullyContained) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Compute the minimum (most negative) beat delta allowed for a multi-line move,
 * so neither the automation range start nor any selected score object / audio
 * clip moves before beat 0. Matches Java's MultiLineMoveMouseListener.mousePressed
 * which computes minTranslation from both selection.getStartTime() and every
 * selected score object's start time.
 */
function computeMinMoveDelta(
  layerGroups: ScoreLayerGroupSnapshot[],
  range: AutomationRangeRef,
): number {
  let minDelta = -range.startBeat;
  const selectedIds = useScoreSelectionStore.getState().selectedObjectIds;
  if (selectedIds.size === 0) return minDelta;

  const layerSet = new Set(range.layerIds);
  for (const group of layerGroups) {
    for (const layer of group.layers) {
      if (!layerSet.has(layer.layerId)) continue;
      for (const item of layer.items) {
        if (!selectedIds.has(item.objectId)) continue;
        minDelta = Math.max(minDelta, -item.startBeats);
      }
    }
  }
  return minDelta;
}

/**
 * Compute live preview positions for shift-selected objects during a multi-line
 * move. Only objects in the score selection store are included.
 */
function computeObjectMovePreview(
  layerGroups: ScoreLayerGroupSnapshot[],
  range: AutomationRangeRef,
  beatDelta: number,
): Record<string, { startBeats: number; durationBeats: number }> {
  const preview: Record<string, { startBeats: number; durationBeats: number }> = {};
  const selectedIds = useScoreSelectionStore.getState().selectedObjectIds;
  if (selectedIds.size === 0) return preview;

  const layerSet = new Set(range.layerIds);
  for (const group of layerGroups) {
    for (const layer of group.layers) {
      if (!layerSet.has(layer.layerId)) continue;
      for (const item of layer.items) {
        if (!selectedIds.has(item.objectId)) continue;
        preview[item.objectId] = {
          startBeats: Math.max(0, item.startBeats + beatDelta),
          durationBeats: item.durationBeats,
        };
      }
    }
  }
  return preview;
}

/**
 * Compute live preview positions for shift-selected objects during a multi-line
 * scale. Both start and duration are scaled around the anchor beat.
 */
function computeObjectScalePreview(
  layerGroups: ScoreLayerGroupSnapshot[],
  range: AutomationRangeRef,
  anchorBeat: number,
  scaleFactor: number,
): Record<string, { startBeats: number; durationBeats: number }> {
  const preview: Record<string, { startBeats: number; durationBeats: number }> = {};
  const selectedIds = useScoreSelectionStore.getState().selectedObjectIds;
  if (selectedIds.size === 0) return preview;

  const layerSet = new Set(range.layerIds);
  for (const group of layerGroups) {
    for (const layer of group.layers) {
      if (!layerSet.has(layer.layerId)) continue;
      for (const item of layer.items) {
        if (!selectedIds.has(item.objectId)) continue;
        const startBeats = Math.max(0, anchorBeat + (item.startBeats - anchorBeat) * scaleFactor);
        const endBeats = Math.max(
          0,
          anchorBeat + (item.startBeats + item.durationBeats - anchorBeat) * scaleFactor,
        );
        preview[item.objectId] = {
          startBeats,
          durationBeats: Math.max(0, endBeats - startBeats),
        };
      }
    }
  }
  return preview;
}
