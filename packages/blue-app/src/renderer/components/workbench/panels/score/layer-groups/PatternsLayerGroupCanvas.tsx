import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { SnapValueName } from '@blue/data';
import type { MeterMapSnapshot } from '../../../../../../shared/project-editor';
import type { PatternCellEdit, PatternsLayerGroupSnapshot } from '../types';
import { DEFAULT_ROW_HEIGHT } from '../types';
import { getProjectDocumentId, useProjectStore } from '../../../../../stores/project-store';
import { useScoreSelectionStore } from '../../../../../stores/score-selection-store';
import { useWorkbenchStore } from '../../../../../stores/workbench-store';
import { attachHostGesture, type HostGestureDisposer } from '../../../../../lib/host-gesture';
import { registerHistoryEditorSettlement } from '../../../../../lib/history-scope-router';
import {
  PopoutContextMenuPortal,
  portalEventIsolationProps,
} from '../../../../../hooks/host-portals';
import PatternGridRow from './PatternGridRow';
import {
  beatToPixelX,
  cellsBetween,
  cellIndexAtBeat,
  computePatternExtentBeats,
  findPatternRowAtY,
  pixelXToBeat,
  safePixelsPerBeat,
} from './patterns-timeline-utils';
import { mapPatternShapeToTarget, SINGLE_PATTERN_CELL_SHAPE } from './patterns-clipboard-utils';

interface Props {
  group: PatternsLayerGroupSnapshot;
  projectSessionId: number;
  projectRevision: number;
  totalBeats: number;
  pixelsPerBeat: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  tempo: number;
  smpteFrameRate: number;
  meterMap: MeterMapSnapshot;
}

interface PatternCellTarget {
  layerId: string;
  cellIndex: number;
}

interface PaintGesture {
  layerId: string;
  groupId: string;
  documentId: string;
  sessionId: number;
  active: boolean;
  lastCellIndex: number;
  changes: Map<number, boolean>;
}

interface PaintPreviewCell extends PatternCellTarget {
  active: boolean;
}

export default function PatternsLayerGroupCanvas({ group, totalBeats, pixelsPerBeat }: Props) {
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
  const openPanel = useWorkbenchStore((state) => state.openPanel);
  const select = useScoreSelectionStore((state) => state.select);
  const patternClipboard = useScoreSelectionStore((state) => state.patternClipboard);
  const copyPatternShape = useScoreSelectionStore((state) => state.copyPatternShape);

  const containerRef = useRef<HTMLDivElement>(null);
  const hostGestureDisposerRef = useRef<HostGestureDisposer | null>(null);
  const unregisterSettlementRef = useRef<(() => void) | null>(null);
  const gestureRef = useRef<PaintGesture | null>(null);
  const [paintPreview, setPaintPreview] = useState<PaintPreviewCell[]>([]);
  const [contextTarget, setContextTarget] = useState<PatternCellTarget | null>(null);

  const endHostGesture = useCallback(() => {
    unregisterSettlementRef.current?.();
    unregisterSettlementRef.current = null;
    if (hostGestureDisposerRef.current) {
      hostGestureDisposerRef.current();
      hostGestureDisposerRef.current = null;
    }
    gestureRef.current = null;
    setPaintPreview([]);
  }, []);

  const scale = safePixelsPerBeat(pixelsPerBeat);
  const stepBeats =
    Number.isFinite(group.effectivePatternBeatsLength) && group.effectivePatternBeatsLength > 0
      ? group.effectivePatternBeatsLength
      : 1;
  const stepWidth = beatToPixelX(stepBeats, scale);
  const contentWidth = Math.max(totalBeats, computePatternExtentBeats(group), stepBeats) * scale;

  const commitPatternPatch = useCallback(
    (changes: PatternCellEdit[]) => {
      if (changes.length === 0) return;
      void (async () => {
        await applyProjectDocumentPatch({
          score: { type: 'updatePatternCells', groupId: group.groupId, changes },
        });
        await flushPendingPatches();
      })();
    },
    [applyProjectDocumentPatch, flushPendingPatches, group.groupId],
  );

  const toLocalXY = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const element = containerRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const cellTargetAtPoint = useCallback(
    (clientX: number, clientY: number): PatternCellTarget | null => {
      const { x, y } = toLocalXY(clientX, clientY);
      const rowHit = findPatternRowAtY(group.layers, y, DEFAULT_ROW_HEIGHT);
      if (!rowHit) return null;
      return {
        layerId: rowHit.layer.layerId,
        cellIndex: cellIndexAtBeat(pixelXToBeat(x, scale), stepBeats),
      };
    },
    [group.layers, scale, stepBeats, toLocalXY],
  );

  const setPreviewForGesture = useCallback((gesture: PaintGesture) => {
    const preview = [...gesture.changes.entries()]
      .sort(([left], [right]) => left - right)
      .map(([cellIndex, active]) => ({
        layerId: gesture.layerId,
        cellIndex,
        active,
      }));
    setPaintPreview(preview);
  }, []);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = cellTargetAtPoint(event.clientX, event.clientY);
      if (!target) return;
      const layer = group.layers.find((candidate) => candidate.layerId === target.layerId);
      if (!layer) return;

      endHostGesture();

      const docId =
        typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
      const sessionId = useProjectStore?.getState?.()?.sessionId ?? 0;
      const active = !layer.activeCellIndices.includes(target.cellIndex);
      const gesture: PaintGesture = {
        layerId: target.layerId,
        groupId: group.groupId,
        documentId: docId,
        sessionId,
        active,
        lastCellIndex: target.cellIndex,
        changes: new Map([[target.cellIndex, active]]),
      };
      gestureRef.current = gesture;
      setPreviewForGesture(gesture);
      event.preventDefault();

      const host = containerRef.current;
      const hostDoc = host?.ownerDocument ?? document;
      unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
        unregisterSettlementRef.current?.();
        unregisterSettlementRef.current = null;
        if (hostGestureDisposerRef.current) {
          hostGestureDisposerRef.current();
          hostGestureDisposerRef.current = null;
        }
        const g = gestureRef.current;
        gestureRef.current = null;
        setPaintPreview([]);
        if (!g) return;
        const currentDocId = getProjectDocumentId() ?? '';
        const currentSessionId = useProjectStore?.getState?.()?.sessionId;
        if (
          g.documentId !== currentDocId ||
          (currentSessionId !== undefined && g.sessionId !== currentSessionId)
        ) {
          return;
        }
        const targetLayer = group.layers.find((candidate) => candidate.layerId === g.layerId);
        const actualChanges: PatternCellEdit[] = [];
        for (const [cellIndex, activeVal] of g.changes.entries()) {
          const currentlyActive = targetLayer?.activeCellIndices.includes(cellIndex) ?? false;
          if (currentlyActive !== activeVal) {
            actualChanges.push({ layerId: g.layerId, cellIndex, active: activeVal });
          }
        }
        if (actualChanges.length > 0) {
          actualChanges.sort((a, b) => a.cellIndex - b.cellIndex);
          commitPatternPatch(actualChanges);
        }
        return useProjectStore?.getState?.()?.flushPendingPatches?.();
      });

      const disposer = attachHostGesture({
        host,
        onMove: (moveEvent) => {
          const g = gestureRef.current;
          if (!g) return;
          const currentDocId = getProjectDocumentId() ?? '';
          const currentSessionId = useProjectStore?.getState?.()?.sessionId;
          if (
            g.documentId !== currentDocId ||
            (currentSessionId !== undefined && g.sessionId !== currentSessionId)
          ) {
            endHostGesture();
            gestureRef.current = null;
            setPaintPreview([]);
            return;
          }
          const { x } = toLocalXY(
            (moveEvent as MouseEvent).clientX,
            (moveEvent as MouseEvent).clientY,
          );
          const cellIndex = cellIndexAtBeat(pixelXToBeat(x, scale), stepBeats);
          if (cellIndex === g.lastCellIndex) return;

          for (const traversedCell of cellsBetween(g.lastCellIndex, cellIndex)) {
            g.changes.set(traversedCell, g.active);
          }
          g.lastCellIndex = cellIndex;
          setPreviewForGesture(g);
        },
        onRelease: () => {
          unregisterSettlementRef.current?.();
          unregisterSettlementRef.current = null;
          hostGestureDisposerRef.current = null;
          const g = gestureRef.current;
          gestureRef.current = null;
          setPaintPreview([]);
          if (!g) return;

          const currentDocId = getProjectDocumentId() ?? '';
          const currentSessionId = useProjectStore?.getState?.()?.sessionId;
          if (
            g.documentId !== currentDocId ||
            (currentSessionId !== undefined && g.sessionId !== currentSessionId)
          ) {
            return;
          }

          const targetLayer = group.layers.find((candidate) => candidate.layerId === g.layerId);
          const actualChanges: PatternCellEdit[] = [];
          for (const [cellIndex, activeVal] of g.changes.entries()) {
            const currentlyActive = targetLayer?.activeCellIndices.includes(cellIndex) ?? false;
            if (currentlyActive !== activeVal) {
              actualChanges.push({ layerId: g.layerId, cellIndex, active: activeVal });
            }
          }
          if (actualChanges.length > 0) {
            actualChanges.sort((a, b) => a.cellIndex - b.cellIndex);
            commitPatternPatch(actualChanges);
          }
        },
        onEscape: () => {
          endHostGesture();
        },
        onBlur: () => {
          endHostGesture();
        },
        onCancel: () => {
          endHostGesture();
        },
      });
      hostGestureDisposerRef.current = disposer;
    },
    [
      cellTargetAtPoint,
      commitPatternPatch,
      endHostGesture,
      group.layers,
      scale,
      setPreviewForGesture,
      stepBeats,
      toLocalXY,
    ],
  );

  useEffect(() => {
    return () => {
      endHostGesture();
      gestureRef.current = null;
      setPaintPreview([]);
      setContextTarget(null);
    };
  }, [endHostGesture, group.groupId]);

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      setContextTarget(cellTargetAtPoint(event.clientX, event.clientY));
    },
    [cellTargetAtPoint],
  );

  const targetLayer = contextTarget
    ? group.layers.find((layer) => layer.layerId === contextTarget.layerId)
    : undefined;
  const targetIsActive =
    !!targetLayer &&
    !!contextTarget &&
    targetLayer.activeCellIndices.includes(contextTarget.cellIndex);
  const canPaste = !!patternClipboard && !!contextTarget;

  const handleCopy = useCallback(() => {
    if (!targetIsActive) return;
    copyPatternShape(SINGLE_PATTERN_CELL_SHAPE);
  }, [copyPatternShape, targetIsActive]);

  const handleCut = useCallback(() => {
    if (!targetIsActive || !contextTarget) return;
    copyPatternShape(SINGLE_PATTERN_CELL_SHAPE);
    commitPatternPatch([{ ...contextTarget, active: false }]);
  }, [commitPatternPatch, contextTarget, copyPatternShape, targetIsActive]);

  const handleDelete = useCallback(() => {
    if (!targetIsActive || !contextTarget) return;
    commitPatternPatch([{ ...contextTarget, active: false }]);
  }, [commitPatternPatch, contextTarget, targetIsActive]);

  const handlePaste = useCallback(() => {
    if (!patternClipboard || !contextTarget) return;
    commitPatternPatch(mapPatternShapeToTarget(patternClipboard, contextTarget, group));
  }, [commitPatternPatch, contextTarget, group, patternClipboard]);

  const selectSourceForTarget = useCallback(
    (target: PatternCellTarget | null) => {
      if (!target) return;
      const layer = group.layers.find((candidate) => candidate.layerId === target.layerId);
      if (!layer) return;
      select(layer.sourceObject.objectId, false, layer.sourceObject.editorTarget);
      openPanel('ScoreObjectEditorTopComponent');
    },
    [group.layers, openPanel, select],
  );

  const handleProperties = useCallback(() => {
    selectSourceForTarget(contextTarget);
  }, [contextTarget, selectSourceForTarget]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          ref={containerRef}
          data-group-id={group.groupId}
          data-pattern-canvas
          data-pattern-step-beats={stepBeats}
          data-pattern-content-width={contentWidth}
          data-shortcut-scope="pattern-layer-canvas"
          className="relative select-none focus:outline-none"
          style={{ minWidth: contentWidth, width: '100%' }}
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
        >
          {group.layers.map((layer) => (
            <PatternGridRow
              key={layer.layerId}
              layer={layer}
              groupId={group.groupId}
              pixelsPerBeat={scale}
              stepBeats={stepBeats}
              stepWidth={stepWidth}
              paintPreview={paintPreview
                .filter((cell) => cell.layerId === layer.layerId)
                .map((cell) => ({ cellIndex: cell.cellIndex, active: cell.active }))}
            />
          ))}
        </div>
      </ContextMenu.Trigger>

      <PopoutContextMenuPortal>
        <ContextMenu.Content
          className="editor-context-menu"
          data-pattern-context-menu
          {...portalEventIsolationProps}
        >
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!targetIsActive}
            onSelect={handleCut}
          >
            Cut
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!targetIsActive}
            onSelect={handleCopy}
          >
            Copy
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!canPaste}
            onSelect={handlePaste}
          >
            Paste
          </ContextMenu.Item>
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!targetIsActive}
            onSelect={handleDelete}
          >
            Delete
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className="editor-context-menu__item"
            disabled={!targetLayer}
            onSelect={handleProperties}
          >
            Properties
          </ContextMenu.Item>
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}
