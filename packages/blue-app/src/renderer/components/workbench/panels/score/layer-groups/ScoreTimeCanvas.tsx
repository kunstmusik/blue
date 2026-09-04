import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import ShiftObjectsDialog from '../ShiftObjectsDialog';
import { ConfirmationDialog } from '../../../../dialogs/ConfirmationDialog';
import { ChevronRight } from 'lucide-react';
import type { PolyObjectLayerGroupSnapshot, ScoreLayerGroupSnapshot, ScoreLayerSnapshot, ScoreRowObjectSnapshot } from '../types';
import { DEFAULT_ROW_HEIGHT, GROUP_SPACER } from '../types';
import { RenderBar } from '../bar-renderers/renderer-registry';
import { useScoreSelectionStore, type ScoreObjectClipboardEntry } from '../../../../../stores/score-selection-store';
import { useLayerSelectionStore } from '../../../../../stores/layer-selection-store';
import { buildSelectionKey, getLayerSelectionId } from '../layer-selection-utils';
import { useProjectStore } from '../../../../../stores/project-store';
import { useWorkbenchStore } from '../../../../../stores/workbench-store';
import AutomationLayerOverlay from '../automation/AutomationLayerOverlay';
import { useScoreAutomationStore } from '../../../../../stores/score-automation-store';
import { useLibraryStore } from '../../../../../stores/library-store';
import type { ScoreAutomationPatch } from '../../../../../../shared/project-editor';
import {
  getLibraryTransferSourceType,
  type LibraryExactTransferTarget,
  type ScoreInsertionLocation,
} from '../../../../../../shared/unified-library';
import { useKeyboardShortcutScope } from '../../../../../hooks/use-keyboard-shortcut-scope';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../../hooks/host-portals';
import { isTextEditingTarget } from '../../../../../hooks/use-keyboard-shortcuts';
import { cn } from '../../../../../lib/cn';
import { useFreezeOperationStore } from '../../../../../stores/freeze-operation-store';
import { snapValueToBeats } from '@blue/data';
import type { SnapValueName } from '@blue/data';
import type { MeterMapSnapshot, ScoreObjectEditorTargetSnapshot } from '../../../../../../shared/project-editor';
import { deriveSnapLineBeats, snapBeatToGrid } from '../snap-grid-utils';
import { toast } from 'sonner';
import {
  collectClipboardEntriesForSelection,
  createPolyObjectPasteObjectFromClipboard,
  groupPasteObjectsByTargetGroup,
  layerGroupAcceptsObjectType,
  translateClipboardEntriesForPaste,
  type ScorePasteObject,
} from './score-clipboard-utils';
import {
  BLUE_LIBRARY_DRAG_MIME,
  readLibraryDragDescriptor,
  readLibraryDragSource,
} from '../../../../libraries/library-drag-drop';
import ScoreObjectColorPicker, { type ScoreObjectColorPickerHandle } from './ScoreObjectColorPicker';
import type { ColorPickerAnchorRect } from '../../../../ColorPicker';
import {
  collectTimelineBoundarySelection,
  collectTimelineLayerSelection,
} from './score-timeline-gesture-utils';
import { buildSetSelectionToLayerColorPatch } from '../score-color-actions';
import { useScoreColorHistoryStore } from '../../../../../stores/score-color-history-store';

interface Props {
  group: PolyObjectLayerGroupSnapshot;
  rootGroupIndex?: number;
  projectSessionId: number;
  projectRevision: number;
  scoreRootGroupId: string;
  scoreContainerPath: ScoreInsertionLocation['containerPath'];
  mode?: 'score' | 'singleLine' | 'multiLine';
  totalBeats: number;
  pixelsPerBeat: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  tempo: number;
  smpteFrameRate: number;
  meterMap: MeterMapSnapshot;
  onDoubleClickObject?: (objectId: string) => void;
}

function argbToRGB(argb: number): number {
  return argb & 0x00FFFFFF;
}

function rgbToCSS(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

function colorToCSS(argb: number): string {
  return rgbToCSS(argbToRGB(argb));
}

function brighten(rgb: number, factor: number): number {
  const r = Math.min(255, Math.round(((rgb >> 16) & 0xFF) * factor));
  const g = Math.min(255, Math.round(((rgb >> 8) & 0xFF) * factor));
  const b = Math.min(255, Math.round((rgb & 0xFF) * factor));
  return (r << 16) | (g << 8) | b;
}

function darken(rgb: number, factor: number): number {
  const r = Math.max(0, Math.round(((rgb >> 16) & 0xFF) * factor));
  const g = Math.max(0, Math.round(((rgb >> 8) & 0xFF) * factor));
  const b = Math.max(0, Math.round((rgb & 0xFF) * factor));
  return (r << 16) | (g << 8) | b;
}

function textColorForBackground(argb: number): string {
  const r = (argb >> 16) & 0xFF;
  const g = (argb >> 8) & 0xFF;
  const b = argb & 0xFF;
  return (r + g + b) > 128 * 3 ? '#000000' : '#ffffff';
}

function findItemOnLayer(layer: ScoreLayerSnapshot, xBeats: number): ScoreRowObjectSnapshot | null {
  for (let i = layer.items.length - 1; i >= 0; i--) {
    const item = layer.items[i];
    if (xBeats >= item.startBeats && xBeats <= item.startBeats + item.durationBeats) {
      return item;
    }
  }
  return null;
}

function findLayerAtY(
  layers: ScoreLayerSnapshot[],
  localY: number,
): { layer: ScoreLayerSnapshot; index: number; yOffset: number } | null {
  let yOff = 0;
  for (let i = 0; i < layers.length; i++) {
    const h = layers[i].height || DEFAULT_ROW_HEIGHT;
    if (localY >= yOff && localY < yOff + h) {
      return { layer: layers[i], index: i, yOffset: yOff };
    }
    yOff += h;
  }
  return null;
}

function buildGlobalLayerData(layerGroups: ScoreLayerGroupSnapshot[]): {
  layerMap: Array<{ groupId: string; localIndex: number; acceptsScoreObject: boolean }>;
  groupStartIndexById: Map<string, number>;
  groupYOffsetById: Map<string, number>;
} {
  const layerMap: Array<{ groupId: string; localIndex: number; acceptsScoreObject: boolean }> = [];
  const groupStartIndexById = new Map<string, number>();
  const groupYOffsetById = new Map<string, number>();

  let yOff = 0;
  for (const group of layerGroups) {
    groupStartIndexById.set(group.groupId, layerMap.length);
    groupYOffsetById.set(group.groupId, yOff);

    const acceptsScoreObject = group.groupType === 'polyObject';
    for (let li = 0; li < group.layers.length; li++) {
      const h = group.layers[li].height || DEFAULT_ROW_HEIGHT;
      layerMap.push({ groupId: group.groupId, localIndex: li, acceptsScoreObject });
      yOff += h;
    }

    yOff += GROUP_SPACER;
  }

  return { layerMap, groupStartIndexById, groupYOffsetById };
}

function getGlobalLayerIndexForY(layerGroups: ScoreLayerGroupSnapshot[], y: number): number {
  let runningY = 0;
  let runningIndex = 0;
  const totalLayers = layerGroups.reduce((sum, group) => sum + group.layers.length, 0);

  for (const group of layerGroups) {
    for (const layer of group.layers) {
      const h = layer.height || DEFAULT_ROW_HEIGHT;
      if (y <= runningY + h) {
        return runningIndex;
      }
      runningY += h;
      runningIndex += 1;
    }

    if (runningIndex < totalLayers && y <= runningY + GROUP_SPACER) {
      return runningIndex;
    }

    runningY += GROUP_SPACER;
  }

  return Math.max(totalLayers - 1, 0);
}

function getLayerAdjustBounds(
  layerMap: Array<{ acceptsScoreObject: boolean }>,
  startLayerIndex: number,
): { min: number; max: number } {
  let min = -startLayerIndex;
  for (let i = startLayerIndex - 1; i >= 0; i--) {
    if (layerMap[i].acceptsScoreObject) {
      continue;
    }
    min = i + 1 - startLayerIndex;
    break;
  }

  let max = layerMap.length - 1 - startLayerIndex;
  for (let i = startLayerIndex + 1; i < layerMap.length; i++) {
    if (layerMap[i].acceptsScoreObject) {
      continue;
    }
    max = i - 1 - startLayerIndex;
    break;
  }

  return { min, max };
}

function collectAllItemSelectionEntries(
  group: PolyObjectLayerGroupSnapshot,
): Array<{ objectId: string; editorTarget?: ScoreObjectEditorTargetSnapshot }> {
  const entries: Array<{ objectId: string; editorTarget?: ScoreObjectEditorTargetSnapshot }> = [];
  for (const layer of group.layers) {
    for (const item of layer.items) {
      entries.push({ objectId: item.objectId, editorTarget: item.editorTarget });
    }
  }
  return entries;
}

function sameLocation(
  a: ScoreObjectEditorTargetSnapshot['location'] | undefined,
  b: ScoreObjectEditorTargetSnapshot['location'] | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.rootGroupIndex !== b.rootGroupIndex) return false;
  if (a.layerIndex !== b.layerIndex || a.objectIndex !== b.objectIndex) return false;
  if (a.containerPath.length !== b.containerPath.length) return false;
  for (let i = 0; i < a.containerPath.length; i++) {
    const segmentA = a.containerPath[i];
    const segmentB = b.containerPath[i];
    if (segmentA.layerIndex !== segmentB.layerIndex || segmentA.objectIndex !== segmentB.objectIndex) {
      return false;
    }
  }
  return true;
}

function sameTarget(
  a: ScoreObjectEditorTargetSnapshot | null | undefined,
  b: ScoreObjectEditorTargetSnapshot | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.selectedObjectType !== b.selectedObjectType || a.editorObjectType !== b.editorObjectType) return false;
  if (a.ownerKind !== b.ownerKind) return false;
  if (a.displayContext !== b.displayContext) return false;
  if (sameLocation(a.location, b.location)) return true;
  if (sameLocation(a.sourceInstanceLocation, b.sourceInstanceLocation)) return true;
  if (a.library && b.library) {
    return a.library.libraryId === b.library.libraryId && a.library.libraryIndex === b.library.libraryIndex;
  }
  return false;
}

type GestureMode = 'none' | 'marquee' | 'move' | 'resizeLeft' | 'resizeRight';

interface PendingConvertTarget {
  target: ScoreObjectEditorTargetSnapshot;
  projectSessionId: number;
  projectRevision: number;
}

const RESIZE_EDGE_PX = 5;
const DEFAULT_SOBJ_DURATION = 4.0;
const MIN_SCORE_OBJECT_DURATION = 0.25;

export default function ScoreTimeCanvas({
  group,
  projectSessionId,
  projectRevision,
  scoreRootGroupId,
  scoreContainerPath,
  mode = 'score',
  totalBeats,
  pixelsPerBeat,
  snapEnabled,
  snapValue,
  tempo,
  smpteFrameRate,
  meterMap,
  onDoubleClickObject,
}: Props) {
  const selectedObjectIds = useScoreSelectionStore((s) => s.selectedObjectIds);
  const selectedObjectTarget = useScoreSelectionStore((s) => s.selectedObjectTarget);
  const selectedObjectTargets = useScoreSelectionStore((s) => s.selectedObjectTargets);
  const select = useScoreSelectionStore((s) => s.select);
  const selectedLayerKeys = useLayerSelectionStore((s) => s.selectedKeys);
  const clearLayerSelection = useLayerSelectionStore((s) => s.clear);
  const clearSelection = useScoreSelectionStore((s) => s.clearSelection);
  const setSelection = useScoreSelectionStore((s) => s.setSelection);
  const addToSelection = useScoreSelectionStore((s) => s.addToSelection);
  const setLiveSharedProperties = useScoreSelectionStore((s) => s.setLiveSharedProperties);
  const clearLiveSharedProperties = useScoreSelectionStore((s) => s.clearLiveSharedProperties);
  const copySelected = useScoreSelectionStore((s) => s.copySelected);
  const clipboard = useScoreSelectionStore((s) => s.clipboard);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);
  const openPanel = useWorkbenchStore((s) => s.openPanel);
  const moveScoreObjects = useProjectStore((s) => s.moveScoreObjects);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [pendingConvertTarget, setPendingConvertTarget] = useState<PendingConvertTarget | null>(null);
  const addScoreObjects = useProjectStore((s) => s.addScoreObjects);
  const libraryClipboard = useLibraryStore((s) => s.clipboard);
  const librarySoundObjectAvailable = libraryClipboard
    ? getLibraryTransferSourceType(libraryClipboard.source) === 'soundObject'
    : false;
  const libraryBsbAvailable = libraryClipboard
    ? getLibraryTransferSourceType(libraryClipboard.source) === 'instrument'
      && libraryClipboard.objectType?.split('.').pop() === 'BlueSynthBuilder'
    : false;
  const transferLibraryItem = useLibraryStore((s) => s.transferToProject);
  const captureScoreSoundObject = useLibraryStore((s) => s.captureScoreSoundObject);
  const addScoreSoundObjectToProjectLibrary = useLibraryStore((s) => s.addScoreSoundObjectToProjectLibrary);
  const resizeScoreObjects = useProjectStore((s) => s.resizeScoreObjects);
  const currentScore = useProjectStore((s) => s.score);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<ScoreObjectColorPickerHandle>(null);
  const colorPickerAnchorRef = useRef<ColorPickerAnchorRect | null>(null);
  const colorPickerAnchorElementRef = useRef<HTMLElement | null>(null);
  const pendingColorTargetsRef = useRef<ScoreObjectEditorTargetSnapshot[]>([]);
  const [contextMenuPos, setContextMenuPos] = useState<{ xBeats: number; layerIndex: number } | null>(null);
  const [contextMenuOnObject, setContextMenuOnObject] = useState(false);
  const [contextMenuObjectType, setContextMenuObjectType] = useState<string | null>(null);
  const [libraryDropMarker, setLibraryDropMarker] = useState<{
    x: number;
    y: number;
    height: number;
    target: LibraryExactTransferTarget;
  } | null>(null);
  const lastLibraryTargetRef = useRef<LibraryExactTransferTarget | null>(null);
  const [marquee, setMarquee] = useState<{
    startX: number; startY: number; endX: number; endY: number;
  } | null>(null);
  const gestureRef = useRef<{
    mode: GestureMode;
    startClientX: number;
    startClientY: number;
    startBeats: number;
    startGlobalLayer: number;
    startGroupYOffset: number;
    minLayerAdjust: number;
    maxLayerAdjust: number;
    resizeReferenceStartBeats?: number;
    resizeReferenceDurationBeats?: number;
    additive: boolean;
    globalLayerMap: Array<{ groupId: string; localIndex: number }>;
    originalPositions: Array<{
      objectId: string;
      startBeats: number;
      durationBeats: number;
      startTimeBase?: string;
      durationTimeBase?: string;
      globalLayerIndex: number;
      editorTarget?: ScoreObjectEditorTargetSnapshot;
    }>;
  } | null>(null);
  const pendingSharedPropertyPatchRef = useRef<Map<string, { startBeats?: number; durationBeats?: number }>>(new Map());
  const pendingMovePatchRef = useRef<Array<{ target: ScoreObjectEditorTargetSnapshot; targetStartBeats: number; targetLayerIndex: number; targetGroupId: string }>>([]);
  const [cursorOverride, setCursorOverride] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [previewByObjectId, setPreviewByObjectId] = useState<Record<string, { startBeats: number; durationBeats: number }>>({});

  // Merge multi-line object preview from the automation store (set during
  // multi-line move/scale drags) with the local score-mode drag preview.
  const multiLineObjectPreview = useScoreAutomationStore((s) => s.multiLineObjectPreview);
  const effectivePreview = useMemo(() => {
    if (!multiLineObjectPreview) return previewByObjectId;
    return { ...multiLineObjectPreview, ...previewByObjectId };
  }, [multiLineObjectPreview, previewByObjectId]);
  const canAddToProjectSoundObjectLibrary = selectedObjectIds.size === 1
    && selectedObjectTarget?.ownerKind === 'timeline'
    && selectedObjectTarget.selectedObjectType !== 'Instance'
    && selectedObjectTarget.location !== undefined;

  const isNestedView = scoreContainerPath.length > 0;
  const interactionLayerGroups = useMemo<ScoreLayerGroupSnapshot[]>(
    () => (isNestedView ? [group] : currentScore.layerGroups),
    [isNestedView, group, currentScore.layerGroups],
  );

  useEffect(() => {
    setPreviewByObjectId({});
    clearLiveSharedProperties();
    pendingMovePatchRef.current = [];
  }, [group.groupId, clearLiveSharedProperties]);

  useEffect(() => {
    if (Object.keys(previewByObjectId).length === 0) return;

    const currentValues = new Map<string, { startBeats: number; durationBeats: number }>();
    for (const layer of group.layers) {
      for (const item of layer.items) {
        currentValues.set(item.objectId, {
          startBeats: item.startBeats,
          durationBeats: item.durationBeats,
        });
      }
    }

    const idsToClear: string[] = [];
    for (const [objectId, preview] of Object.entries(previewByObjectId)) {
      const current = currentValues.get(objectId);
      if (!current) {
        idsToClear.push(objectId);
        continue;
      }
      if (
        Math.abs(current.startBeats - preview.startBeats) < 1e-6
        && Math.abs(current.durationBeats - preview.durationBeats) < 1e-6
      ) {
        idsToClear.push(objectId);
      }
    }

    if (idsToClear.length === 0) return;
    setPreviewByObjectId((prev) => {
      const next = { ...prev };
      for (const objectId of idsToClear) {
        delete next[objectId];
      }
      return next;
    });
    clearLiveSharedProperties(idsToClear);
  }, [group.layers, previewByObjectId, clearLiveSharedProperties]);

  const snapBeats = snapEnabled
    ? snapValueToBeats(snapValue, tempo, smpteFrameRate, 44100, pixelsPerBeat)
    : 0;
  const pixelsPerSecond = tempo > 0 ? pixelsPerBeat * (tempo / 60) : pixelsPerBeat;
  const contentWidth = totalBeats * pixelsPerBeat;
  const snapLineXPositions = useMemo(() => {
    if (!snapEnabled || snapBeats <= 0) {
      return [] as number[];
    }

    return deriveSnapLineBeats(snapValue, snapBeats, meterMap, totalBeats)
      .map((beat) => Math.round(beat * pixelsPerBeat) + 0.5);
  }, [meterMap, pixelsPerBeat, snapBeats, snapEnabled, snapValue, totalBeats]);

  const snapBeatValueMove = useCallback((beats: number): number => {
    if (!snapEnabled || snapBeats <= 0) return beats;
    return snapBeatToGrid(beats, 'nearest', snapValue, snapBeats, meterMap);
  }, [meterMap, snapEnabled, snapBeats, snapValue]);

  const snapBeatValueStart = useCallback((beats: number): number => {
    if (!snapEnabled || snapBeats <= 0) return beats;
    return snapBeatToGrid(beats, 'floor', snapValue, snapBeats, meterMap);
  }, [meterMap, snapEnabled, snapBeats, snapValue]);

  const findEditorTarget = useCallback((objectId: string): ScoreObjectEditorTargetSnapshot | undefined => {
    const fromSelection = selectedObjectTargets[objectId];
    if (fromSelection) return fromSelection;
    for (const layer of group.layers) {
      const item = layer.items.find((candidate) => candidate.objectId === objectId);
      if (item?.editorTarget) return item.editorTarget;
    }
    return undefined;
  }, [group.layers, selectedObjectTargets]);

  const toLocalXY = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const buildLibraryTarget = useCallback((
    layerIndex: number,
    startBeats: number,
  ): Extract<LibraryExactTransferTarget, { kind: 'score' }> | null => {
    const layer = group.layers[layerIndex];
    if (!layer || mode !== 'score') return null;
    return {
      kind: 'score',
      projectSessionId,
      projectRevision,
      location: {
        rootGroupId: scoreRootGroupId,
        containerPath: scoreContainerPath,
        layerId: layer.layerId,
        startTime: snapBeatValueStart(Math.max(0, Math.min(totalBeats, startBeats))),
      },
      timeContextRevision: String(projectRevision),
    };
  }, [group.layers, mode, projectRevision, projectSessionId, scoreContainerPath, scoreRootGroupId, snapBeatValueStart, totalBeats]);

  const locateLibraryTarget = useCallback((clientX: number, clientY: number) => {
    const { x, y } = toLocalXY(clientX, clientY);
    const hit = findLayerAtY(group.layers, y);
    if (!hit) return null;
    const target = buildLibraryTarget(hit.index, x / pixelsPerBeat);
    if (!target) return null;
    return {
      target,
      x: target.location.startTime * pixelsPerBeat,
      y: hit.yOffset,
      height: hit.layer.height || DEFAULT_ROW_HEIGHT,
    };
  }, [buildLibraryTarget, group.layers, pixelsPerBeat, toLocalXY]);

  const pasteLibraryAtContext = useCallback(() => {
    if (!libraryClipboard || !librarySoundObjectAvailable || !contextMenuPos) return;
    const target = buildLibraryTarget(contextMenuPos.layerIndex, contextMenuPos.xBeats);
    if (!target) return;
    void transferLibraryItem({ kind: 'clipboard', source: libraryClipboard.source }, target);
  }, [buildLibraryTarget, contextMenuPos, libraryClipboard, librarySoundObjectAvailable, transferLibraryItem]);

  const pasteBsbAtContext = useCallback(() => {
    if (!libraryClipboard || !libraryBsbAvailable || !contextMenuPos) return;
    const scoreTarget = buildLibraryTarget(contextMenuPos.layerIndex, contextMenuPos.xBeats);
    if (!scoreTarget) return;
    const target: Extract<LibraryExactTransferTarget, { kind: 'scoreBsbSound' }> = {
      ...scoreTarget,
      kind: 'scoreBsbSound',
    };
    void transferLibraryItem({ kind: 'clipboard', source: libraryClipboard.source }, target);
  }, [buildLibraryTarget, contextMenuPos, libraryBsbAvailable, libraryClipboard, transferLibraryItem]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return;

    const { x, y } = toLocalXY(e.clientX, e.clientY);
    const xBeats = x / pixelsPerBeat;
    const hit = findLayerAtY(group.layers, y);
    const item = hit ? findItemOnLayer(hit.layer, xBeats) : null;

    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && hit && !item && clipboard.length > 0) {
      const paste = translateClipboardEntriesForPaste({
        clipboard,
        layerGroups: interactionLayerGroups,
        targetGroupId: group.groupId,
        targetLayerIndex: hit.index,
        targetXBeats: xBeats,
        snapBeatValue: snapBeatValueStart,
      });
      if (!paste.ok) {
        toast.error(paste.message);
        return;
      }
      for (const objects of groupPasteObjectsByTargetGroup(paste.entries.map((entry) => entry.object))) {
        addScoreObjects(objects);
      }
      return;
    }

    // Background click (no score object under the cursor, whether on an empty
    // part of a layer row or outside any layer row): start a marquee. Java Blue
    // parity — MarqueeSelectionListener starts on any non-object press, with
    // shift toggling additive mode. A plain marquee clears the selection first;
    // shift preserves it so the marquee unions onto it.
    if (!item) {
      if (!e.shiftKey) {
        clearSelection();
        clearLayerSelection();
      }
      gestureRef.current = {
        mode: 'marquee', startClientX: e.clientX, startClientY: e.clientY,
        startBeats: 0, startGlobalLayer: 0, startGroupYOffset: 0,
        minLayerAdjust: 0, maxLayerAdjust: 0,
        additive: e.shiftKey, globalLayerMap: [], originalPositions: [],
      };
      setMarquee(null);
      return;
    }

    if (e.shiftKey) {
      select(item.objectId, true, item.editorTarget);
      return;
    }

    // Determine the set of objects this gesture acts on. The closure-captured
    // selectedObjectIds goes stale the moment `select` mutates the store below,
    // so the effective selection is derived from the click semantics: an
    // exclusive select (clicking an unselected object, or re-targeting a single
    // selection) drags only the clicked object; clicking an already-selected
    // object drags the whole selection. Deriving here avoids dragging objects
    // that were just deselected (which previously caused overlapping objects to
    // move together and could cascade into misplaced/deleted objects).
    let effectiveSelectedIds: Set<string>;
    if (!selectedObjectIds.has(item.objectId)) {
      select(item.objectId, false, item.editorTarget);
      effectiveSelectedIds = new Set([item.objectId]);
    } else if (selectedObjectIds.size === 1 && !sameTarget(selectedObjectTarget, item.editorTarget)) {
      select(item.objectId, false, item.editorTarget);
      effectiveSelectedIds = new Set([item.objectId]);
    } else {
      effectiveSelectedIds = new Set(selectedObjectIds);
      effectiveSelectedIds.add(item.objectId);
    }

    const itemPreview = effectivePreview[item.objectId];
    const itemStartBeats = itemPreview?.startBeats ?? item.startBeats;
    const itemDurationBeats = itemPreview?.durationBeats ?? item.durationBeats;
    const itemLeft = itemStartBeats * pixelsPerBeat;
    const itemWidth = itemDurationBeats * pixelsPerBeat;
    const localX = x - itemLeft;
    const onLeftEdge = localX > 0 && localX < RESIZE_EDGE_PX;
    const onRightEdge = localX > itemWidth - RESIZE_EDGE_PX && localX < itemWidth;

    const { layerMap, groupStartIndexById, groupYOffsetById } = buildGlobalLayerData(interactionLayerGroups);
    const globalLayerMap = layerMap.map(({ groupId, localIndex }) => ({ groupId, localIndex }));
    const currentGroupGlobalStart = groupStartIndexById.get(group.groupId) ?? 0;
    const currentGroupYOffset = groupYOffsetById.get(group.groupId) ?? 0;
    const totalGlobalLayers = globalLayerMap.length;

    const origPositions: Array<{
      objectId: string;
      startBeats: number;
      durationBeats: number;
      startTimeBase?: string;
      durationTimeBase?: string;
      globalLayerIndex: number;
      editorTarget?: ScoreObjectEditorTargetSnapshot;
    }> = [];

    for (const lg of interactionLayerGroups) {
      const groupStart = groupStartIndexById.get(lg.groupId) ?? 0;
      for (let li = 0; li < lg.layers.length; li++) {
        for (const obj of lg.layers[li].items) {
          if (effectiveSelectedIds.has(obj.objectId)) {
            const preview = effectivePreview[obj.objectId];
            origPositions.push({
              objectId: obj.objectId,
              startBeats: preview?.startBeats ?? obj.startBeats,
              durationBeats: preview?.durationBeats ?? obj.durationBeats,
              startTimeBase: obj.startTimeBase,
              durationTimeBase: obj.durationTimeBase,
              globalLayerIndex: groupStart + li,
              editorTarget: obj.editorTarget,
            });
          }
        }
      }
    }

    const startGlobalLayer = currentGroupGlobalStart + hit!.index;
    let minLayerAdj = 0;
    let maxLayerAdj = 0;
    if (!onLeftEdge && !onRightEdge && origPositions.length > 0) {
      minLayerAdj = Number.NEGATIVE_INFINITY;
      maxLayerAdj = Number.POSITIVE_INFINITY;
      for (const pos of origPositions) {
        const bounds = getLayerAdjustBounds(layerMap, pos.globalLayerIndex);
        minLayerAdj = Math.max(minLayerAdj, bounds.min);
        maxLayerAdj = Math.min(maxLayerAdj, bounds.max);
      }
      if (!Number.isFinite(minLayerAdj)) {
        minLayerAdj = 0;
      }
      if (!Number.isFinite(maxLayerAdj)) {
        maxLayerAdj = totalGlobalLayers - 1;
      }
    }

    if (onLeftEdge || onRightEdge) {
      gestureRef.current = {
        mode: onLeftEdge ? 'resizeLeft' : 'resizeRight',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startBeats: xBeats,
        startGlobalLayer,
        startGroupYOffset: currentGroupYOffset,
        minLayerAdjust: 0,
        maxLayerAdjust: 0,
        resizeReferenceStartBeats: itemStartBeats,
        resizeReferenceDurationBeats: itemDurationBeats,
        additive: false,
        globalLayerMap,
        originalPositions: origPositions,
      };
    } else {
      gestureRef.current = {
        mode: 'move',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startBeats: xBeats,
        startGlobalLayer,
        startGroupYOffset: currentGroupYOffset,
        minLayerAdjust: minLayerAdj,
        maxLayerAdjust: maxLayerAdj,
        additive: false,
        globalLayerMap,
        originalPositions: origPositions,
      };
    }
  }, [toLocalXY, pixelsPerBeat, group.layers, group.groupId, select, clearSelection, clearLayerSelection, selectedObjectIds, selectedObjectTarget, clipboard, snapBeatValueStart, addScoreObjects, interactionLayerGroups, previewByObjectId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!gestureRef.current) {
      const { x, y } = toLocalXY(e.clientX, e.clientY);
      const xBeats = x / pixelsPerBeat;
      const hit = findLayerAtY(group.layers, y);
      if (hit) {
        const item = findItemOnLayer(hit.layer, xBeats);
        if (item) {
          const preview = effectivePreview[item.objectId];
          const startBeats = preview?.startBeats ?? item.startBeats;
          const durationBeats = preview?.durationBeats ?? item.durationBeats;
          setTooltip(`${item.name} (${item.objectType}) @ beat ${startBeats.toFixed(2)}, dur ${durationBeats.toFixed(2)}`);
          if (selectedObjectIds.has(item.objectId)) {
            const itemLeft = startBeats * pixelsPerBeat;
            const itemWidth = durationBeats * pixelsPerBeat;
            const localX = x - itemLeft;
            if (localX > 0 && localX < RESIZE_EDGE_PX) {
              setCursorOverride('w-resize');
            } else if (localX > itemWidth - RESIZE_EDGE_PX && localX < itemWidth) {
              setCursorOverride('e-resize');
            } else {
              setCursorOverride('move');
            }
          } else {
            setCursorOverride(null);
          }
        } else {
          setTooltip(null);
          setCursorOverride(null);
        }
      } else {
        setTooltip(null);
        setCursorOverride(null);
      }
      return;
    }
    const g = gestureRef.current;

    if (g.mode === 'marquee') {
      const start = toLocalXY(g.startClientX, g.startClientY);
      const end = toLocalXY(e.clientX, e.clientY);
      setMarquee({ startX: start.x, startY: start.y, endX: end.x, endY: end.y });
    } else if (g.mode === 'move') {
      if (g.originalPositions.length === 0) return;
      const { x, y } = toLocalXY(e.clientX, e.clientY);
      const currentBeats = x / pixelsPerBeat;
      const rawDelta = currentBeats - g.startBeats;
      const minOriginal = Math.min(...g.originalPositions.map((p) => p.startBeats));
      let delta = Math.max(-minOriginal, rawDelta);
      if (snapEnabled && snapBeats > 0) {
        const absPos = minOriginal + delta;
        const snappedAbsPos = snapBeatToGrid(absPos, 'nearest', snapValue, snapBeats, meterMap);
        delta = snappedAbsPos - minOriginal;
      }

      const globalY = y + g.startGroupYOffset;
      const currentGlobalLayer = getGlobalLayerIndexForY(interactionLayerGroups, globalY);

      const rawLayerAdj = currentGlobalLayer - g.startGlobalLayer;
      const layerAdjust = Math.max(g.minLayerAdjust, Math.min(g.maxLayerAdjust, rawLayerAdj));

      const moves = g.originalPositions.map((pos) => {
        const targetGlobalLayer = pos.globalLayerIndex + layerAdjust;
        const target = g.globalLayerMap[targetGlobalLayer];
        if (!target) {
          return null;
        }
        return {
          objectId: pos.objectId,
          targetStartBeats: pos.startBeats + delta,
          targetLayerIndex: target.localIndex,
          targetGroupId: target.groupId,
        };
      }).filter((move): move is { objectId: string; targetStartBeats: number; targetLayerIndex: number; targetGroupId: string } => move !== null);

      if (moves.length === 0) return;
      if (!isNestedView) {
        moveScoreObjects(moves);
      }
      pendingMovePatchRef.current = moves.map((move) => {
        const original = g.originalPositions.find((pos) => pos.objectId === move.objectId);
        const target = original?.editorTarget;
        if (!target) {
          return null;
        }
        return {
          target,
          targetStartBeats: move.targetStartBeats,
          targetLayerIndex: move.targetLayerIndex,
          targetGroupId: move.targetGroupId,
        };
      }).filter((move): move is { target: ScoreObjectEditorTargetSnapshot; targetStartBeats: number; targetLayerIndex: number; targetGroupId: string } => move !== null);
      setPreviewByObjectId((prev) => {
        const next = { ...prev };
        for (const move of moves) {
          const original = g.originalPositions.find((pos) => pos.objectId === move.objectId);
          if (!original) continue;
          next[move.objectId] = {
            startBeats: move.targetStartBeats,
            durationBeats: original.durationBeats,
          };
        }
        return next;
      });
      setLiveSharedProperties(moves.map((move) => {
        const original = g.originalPositions.find((pos) => pos.objectId === move.objectId);
        return {
          objectId: move.objectId,
          startBeats: move.targetStartBeats,
          durationBeats: original?.durationBeats,
        };
      }));
    } else if (g.mode === 'resizeRight' || g.mode === 'resizeLeft') {
      if (g.originalPositions.length === 0) return;
      const { x } = toLocalXY(e.clientX, e.clientY);
      const currentBeats = x / pixelsPerBeat;
      const rawDelta = currentBeats - g.startBeats;

      if (g.mode === 'resizeRight') {
        const referenceStart = g.resizeReferenceStartBeats ?? g.originalPositions[0]!.startBeats;
        const referenceDuration = g.resizeReferenceDurationBeats ?? g.originalPositions[0]!.durationBeats;
        const referenceEnd = referenceStart + referenceDuration;
        const targetReferenceEnd = snapBeatValueMove(referenceEnd + rawDelta);
        const snappedDelta = targetReferenceEnd - referenceEnd;
        const resizes = g.originalPositions.map((pos) => {
          const targetEnd = Math.max(
            pos.startBeats + MIN_SCORE_OBJECT_DURATION,
            pos.startBeats + pos.durationBeats + snappedDelta,
          );
          return {
            objectId: pos.objectId,
            targetStartBeats: pos.startBeats,
            targetDurationBeats: targetEnd - pos.startBeats,
          };
        });
        if (!isNestedView) {
          resizeScoreObjects(resizes);
        }
        setPreviewByObjectId((prev) => {
          const next = { ...prev };
          for (const resize of resizes) {
            next[resize.objectId] = {
              startBeats: resize.targetStartBeats,
              durationBeats: resize.targetDurationBeats,
            };
          }
          return next;
        });
        for (const resize of resizes) {
          pendingSharedPropertyPatchRef.current.set(resize.objectId, {
            startBeats: resize.targetStartBeats,
            durationBeats: resize.targetDurationBeats,
          });
        }
        setLiveSharedProperties(resizes.map((resize) => ({
          objectId: resize.objectId,
          startBeats: resize.targetStartBeats,
          durationBeats: resize.targetDurationBeats,
        })));
      } else {
        const referenceStart = g.resizeReferenceStartBeats ?? g.originalPositions[0]!.startBeats;
        const targetReferenceStart = snapBeatValueMove(referenceStart + rawDelta);
        const snappedDelta = targetReferenceStart - referenceStart;
        const minDelta = Math.max(...g.originalPositions.map((pos) => -pos.startBeats));
        const maxDelta = Math.max(
          0,
          Math.min(...g.originalPositions.map((pos) => pos.durationBeats - MIN_SCORE_OBJECT_DURATION)),
        );
        const resizeDelta = Math.max(minDelta, Math.min(maxDelta, snappedDelta));
        const resizes = g.originalPositions.map((pos) => {
          const targetStart = pos.startBeats + resizeDelta;
          return {
            objectId: pos.objectId,
            targetStartBeats: targetStart,
            targetDurationBeats: pos.startBeats + pos.durationBeats - targetStart,
          };
        });
        if (!isNestedView) {
          resizeScoreObjects(resizes);
        }
        setPreviewByObjectId((prev) => {
          const next = { ...prev };
          for (const resize of resizes) {
            next[resize.objectId] = {
              startBeats: resize.targetStartBeats,
              durationBeats: resize.targetDurationBeats,
            };
          }
          return next;
        });
        for (const resize of resizes) {
          pendingSharedPropertyPatchRef.current.set(resize.objectId, {
            startBeats: resize.targetStartBeats,
            durationBeats: resize.targetDurationBeats,
          });
        }
        setLiveSharedProperties(resizes.map((resize) => ({
          objectId: resize.objectId,
          startBeats: resize.targetStartBeats,
          durationBeats: resize.targetDurationBeats,
        })));
      }
    }
  }, [toLocalXY, pixelsPerBeat, group.layers, selectedObjectIds, moveScoreObjects, resizeScoreObjects, snapBeatValueMove, interactionLayerGroups, snapEnabled, snapBeats, snapValue, meterMap, previewByObjectId, isNestedView, setLiveSharedProperties]);

  const handleMouseUp = useCallback(() => {
    if (!gestureRef.current) {
      setMarquee(null);
      return;
    }
    const g = gestureRef.current;

    if (g.mode === 'marquee' && marquee) {
      const left = Math.min(marquee.startX, marquee.endX);
      const right = Math.max(marquee.startX, marquee.endX);
      const top = Math.min(marquee.startY, marquee.endY);
      const bottom = Math.max(marquee.startY, marquee.endY);

      const startBeats = left / pixelsPerBeat;
      const endBeats = right / pixelsPerBeat;

      const hitItems: Array<{ objectId: string; editorTarget?: ScoreObjectEditorTargetSnapshot }> = [];
      if (!g.additive) {
        clearSelection();
      }

      const currentGroupIndex = interactionLayerGroups.findIndex(
        (lg) => lg.groupId === group.groupId,
      );

      for (let gi = 0; gi < interactionLayerGroups.length; gi++) {
        const lg = interactionLayerGroups[gi];

        let yShift = 0;
        const lo = Math.min(gi, currentGroupIndex);
        const hi = Math.max(gi, currentGroupIndex);
        for (let k = lo; k < hi; k++) {
          const h = interactionLayerGroups[k].layers.reduce(
            (s, l) => s + (l.height || DEFAULT_ROW_HEIGHT), 0,
          ) + GROUP_SPACER;
          if (gi > currentGroupIndex) {
            yShift += h;
          } else {
            yShift -= h;
          }
        }

        const shiftedTop = top - yShift;
        const shiftedBottom = bottom - yShift;

        let yOff = 0;
        for (const layer of lg.layers) {
          const h = layer.height || DEFAULT_ROW_HEIGHT;
          const layerTop = yOff;
          const layerBottom = yOff + h;
          if (layerBottom > shiftedTop && layerTop < shiftedBottom) {
            for (const item of layer.items) {
              const itemEnd = item.startBeats + item.durationBeats;
              if (item.startBeats < endBeats && itemEnd > startBeats) {
                hitItems.push({ objectId: item.objectId, editorTarget: item.editorTarget });
              }
            }
          }
          yOff += h;
        }
      }

      if (hitItems.length > 0) {
        // Java Blue parity: shift (additive) marquee unions the hit items with
        // the existing selection; a plain marquee replaces it.
        if (g.additive) {
          addToSelection(hitItems);
        } else {
          setSelection(hitItems);
        }
      }
    }

    const pendingPatches = Array.from(pendingSharedPropertyPatchRef.current.entries());
    pendingSharedPropertyPatchRef.current.clear();
    const pendingMovePatch = pendingMovePatchRef.current;
    pendingMovePatchRef.current = [];

    if (pendingMovePatch.length > 0 && g.mode === 'move') {
      void applyProjectDocumentPatch({
        score: {
          type: 'moveScoreObjects',
          moves: pendingMovePatch,
        },
      });
    }

    if (pendingPatches.length > 0 && g.mode !== 'marquee') {
      void (async () => {
        const targetByObjectId = new Map<string, ScoreObjectEditorTargetSnapshot>();
        for (const pos of g.originalPositions) {
          if (pos.editorTarget) {
            targetByObjectId.set(pos.objectId, pos.editorTarget);
          }
        }

        for (const [objectId, values] of pendingPatches) {
          const target = targetByObjectId.get(objectId) ?? findEditorTarget(objectId);
          if (!target) continue;
          const original = g.originalPositions.find((pos) => pos.objectId === objectId);
          const patch: {
            startTime?: { value: number; timeBase: string };
            subjectiveDuration?: { value: number; timeBase: string };
          } = {};
          if (values.startBeats !== undefined) {
            patch.startTime = { value: values.startBeats, timeBase: original?.startTimeBase ?? 'BEATS' };
          }
          if (values.durationBeats !== undefined) {
            patch.subjectiveDuration = { value: values.durationBeats, timeBase: original?.durationTimeBase ?? 'BEATS' };
          }
          if (Object.keys(patch).length === 0) continue;
          await applyProjectDocumentPatch({
            score: {
              type: 'updateSharedProperties',
              target,
              patch,
            },
          });
        }
      })();
    }

    gestureRef.current = null;
    setMarquee(null);
  }, [marquee, pixelsPerBeat, group.groupId, interactionLayerGroups, clearSelection, setSelection, addToSelection, applyProjectDocumentPatch, findEditorTarget]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { x, y } = toLocalXY(e.clientX, e.clientY);
    const xBeats = x / pixelsPerBeat;
    const hit = findLayerAtY(group.layers, y);
    if (!hit) return;
    const item = findItemOnLayer(hit.layer, xBeats);
    if (!item) return;
    if (item.isContainer) {
      // Java Blue: double-clicking a PolyObject drills one layer down via
      // ScoreController.editLayerGroup() instead of opening the object editor.
      if (onDoubleClickObject) {
        onDoubleClickObject(item.objectId);
      }
      return;
    }
    // Java Blue: ScoreObjectSelectionListener.editScoreObject() opens (or
    // reactivates) ScoreObjectEditorTopComponent for a non-PolyObject score
    // object, but only when exactly one object is selected. openPanel reveals
    // the panel if minimized/closed and focuses it if already docked/floating.
    if (selectedObjectIds.size === 1) {
      openPanel('ScoreObjectEditorTopComponent');
    }
  }, [toLocalXY, pixelsPerBeat, group.layers, onDoubleClickObject, openPanel, selectedObjectIds]);

  const getSelectedEntries = useCallback((): ScoreObjectClipboardEntry[] => {
    const entries = collectClipboardEntriesForSelection(interactionLayerGroups, selectedObjectIds);
    if (Object.keys(previewByObjectId).length === 0) {
      return entries;
    }
    return entries.map((entry) => {
      const preview = effectivePreview[entry.objectId];
      return preview
        ? {
          ...entry,
          startBeats: preview.startBeats,
          durationBeats: preview.durationBeats,
        }
        : entry;
    });
  }, [interactionLayerGroups, selectedObjectIds, previewByObjectId]);

  const handleFreezeUnfreeze = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    void useFreezeOperationStore.getState().start(entries);
  }, [getSelectedEntries]);

  const handleCopy = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    copySelected(entries);
    if (entries.length !== 1) return;
    const target = entries[0]!.editorTarget;
    const location = target?.location ?? target?.sourceInstanceLocation;
    if (!location) return;
    void captureScoreSoundObject({ projectSessionId, projectRevision, location });
  }, [getSelectedEntries, copySelected, captureScoreSoundObject, projectSessionId, projectRevision]);

  const handleCut = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length > 0) {
      copySelected(entries);
      const targets = entries
        .map((entry) => entry.editorTarget)
        .filter((target): target is ScoreObjectEditorTargetSnapshot => target !== undefined);
      const removeTargets = (): void => {
        if (targets.length > 0) {
          void applyProjectDocumentPatch({
            score: {
              type: 'removeScoreObjects',
              targets,
            },
          });
        }
        clearSelection();
      };
      const location = entries.length === 1
        ? entries[0]!.editorTarget?.location ?? entries[0]!.editorTarget?.sourceInstanceLocation
        : undefined;
      if (!location) {
        removeTargets();
        return;
      }
      void captureScoreSoundObject({ projectSessionId, projectRevision, location })
        .then((captured) => { if (captured) removeTargets(); });
    }
  }, [
    getSelectedEntries,
    copySelected,
    applyProjectDocumentPatch,
    clearSelection,
    captureScoreSoundObject,
    projectSessionId,
    projectRevision,
  ]);

  const handleAddToProjectSoundObjectLibrary = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length !== 1) return;
    const target = entries[0]!.editorTarget;
    if (!target?.location || target.ownerKind !== 'timeline') return;
    void addScoreSoundObjectToProjectLibrary({
      projectSessionId,
      projectRevision,
      location: target.location,
    }).then((added) => { if (added) clearSelection(); });
  }, [
    getSelectedEntries,
    addScoreSoundObjectToProjectLibrary,
    projectSessionId,
    projectRevision,
    clearSelection,
  ]);

  const handleRemove = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length > 0) {
      const targets = entries
        .map((entry) => entry.editorTarget)
        .filter((target): target is ScoreObjectEditorTargetSnapshot => target !== undefined);
      if (targets.length > 0) {
        void applyProjectDocumentPatch({
          score: {
            type: 'removeScoreObjects',
            targets,
          },
        });
      }
      clearSelection();
    }
  }, [getSelectedEntries, applyProjectDocumentPatch, clearSelection]);

  const handleSetSubjectiveToObjective = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0 || entries.some((entry) => entry.objectType === 'AudioClip')) return;
    const targets = entries
      .map((entry) => entry.editorTarget)
      .filter((target): target is ScoreObjectEditorTargetSnapshot => target !== undefined);
    if (targets.length > 0) {
      void applyProjectDocumentPatch({ score: { type: 'setSubjectiveDurationToObjective', targets } });
    }
  }, [applyProjectDocumentPatch, getSelectedEntries]);

  const handleReplaceWithBuffer = useCallback(() => {
    const selected = getSelectedEntries();
    if (selected.length === 0 || clipboard.length !== 1) {
      toast.error('Copy one SoundObject or AudioClip before replacing selected objects.');
      return;
    }
    const replacement = clipboard[0]!;
    const invalid = selected.find((entry) => {
      const targetGroup = interactionLayerGroups.find((candidate) => candidate.groupId === entry.groupId);
      return !targetGroup || !layerGroupAcceptsObjectType(targetGroup.groupType, replacement.objectType);
    });
    if (invalid) {
      toast.error(`${replacement.objectType} is not compatible with the selected destination layer.`);
      return;
    }
    const removeTargets = selected
      .map((entry) => entry.editorTarget)
      .filter((target): target is ScoreObjectEditorTargetSnapshot => target !== undefined);
    void (async () => {
      if (removeTargets.length > 0) {
        await applyProjectDocumentPatch({ score: { type: 'removeScoreObjects', targets: removeTargets } });
      }
      for (const entry of selected) {
        await applyProjectDocumentPatch({ score: {
          type: 'addScoreObjects',
          groupId: entry.groupId,
          objects: [{
            layerIndex: entry.layerIndex,
            objectType: replacement.objectType,
            name: replacement.name,
            startBeats: entry.startBeats,
            durationBeats: entry.durationBeats,
            startTimeBase: entry.startTimeBase,
            durationTimeBase: entry.durationTimeBase,
            backgroundColor: replacement.backgroundColor,
            serializedXml: replacement.serializedXml,
          }],
        } });
      }
      clearSelection();
    })();
  }, [applyProjectDocumentPatch, clearSelection, clipboard, getSelectedEntries, interactionLayerGroups]);

  const handleColorSelected = useCallback((backgroundColor: number) => {
    const targets = pendingColorTargetsRef.current;
    void Promise.all(targets.map((target) => applyProjectDocumentPatch({
      score: {
        type: 'updateSharedProperties',
        target,
        patch: { backgroundColor },
      },
    })));
  }, [applyProjectDocumentPatch]);

  const handleSetColor = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    const targets = entries
      .map((entry) => entry.editorTarget)
      .filter((target): target is ScoreObjectEditorTargetSnapshot => target !== undefined);
    const anchor = colorPickerAnchorRef.current;
    if (targets.length === 0 || !anchor) return;
    pendingColorTargetsRef.current = targets;
    colorPickerRef.current?.open(entries[0]!.backgroundColor, anchor, colorPickerAnchorElementRef.current);
  }, [getSelectedEntries]);

  const handleSetToLayerColor = useCallback(async () => {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    const pair = buildSetSelectionToLayerColorPatch({
      selection: entries,
      layerGroups: interactionLayerGroups,
    });
    if (pair) {
      try {
        await applyProjectDocumentPatch(pair.forward);
        await flushPendingPatches();
        useScoreColorHistoryStore.getState().pushEntry({
          label: 'Set to Layer Color',
          forward: pair.forward,
          inverse: pair.inverse,
        });
      } catch {
        // Rejection reconciliation - do not record history entry
      }
    }
  }, [getSelectedEntries, interactionLayerGroups, applyProjectDocumentPatch, flushPendingPatches]);

  const handleExport = useCallback(async () => {
    const entries = getSelectedEntries();
    if (
      entries.length !== 1 ||
      entries[0]!.objectType === 'AudioClip' ||
      entries[0]!.objectType === 'Instance' ||
      !entries[0]!.serializedXml
    ) {
      return;
    }
    try {
      const result = await window.blueAPI.exportScoreObject(entries[0]!.serializedXml, entries[0]!.name);
      if (result.status === 'error') toast.error(result.error);
    } catch (error) {
      toast.error('Error: Could not export Sound Object.');
      console.error('Error exporting Sound Object', error);
    }
  }, [getSelectedEntries]);

  const handleConvertToObjectBuilder = useCallback(() => {
    const entries = getSelectedEntries();
    if (
      entries.length !== 1 ||
      (entries[0]!.objectType !== 'PythonObject' && entries[0]!.objectType !== 'External') ||
      !entries[0]!.editorTarget
    ) {
      return;
    }
    setPendingConvertTarget({
      target: entries[0]!.editorTarget,
      projectSessionId,
      projectRevision,
    });
  }, [getSelectedEntries, projectRevision, projectSessionId]);

  const handleImport = useCallback(async () => {
    if (!window.blueAPI?.importScoreObject || !contextMenuPos) return;
    try {
      const result = await window.blueAPI.importScoreObject();
      if (!result) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const imported = result.object;
      const startBeats = snapBeatValueStart(contextMenuPos.xBeats);

      addScoreObjects([{
        groupId: group.groupId,
        layerIndex: contextMenuPos.layerIndex,
        name: imported.name,
        startBeats,
        durationBeats: imported.durationBeats,
        startTimeBase: imported.destinationTimeBase,
        durationTimeBase: imported.destinationTimeBase,
        backgroundColor: imported.backgroundColor,
        objectType: imported.objectType,
        isContainer: imported.isContainer,
        serializedXml: imported.serializedXml,
      }]);
    } catch (error) {
      toast.error('Error: Could not read Sound Object from file');
      console.error('Error importing Sound Object', error);
    }
  }, [contextMenuPos, snapBeatValueStart, group.groupId, addScoreObjects]);

  const selectedEntries = getSelectedEntries();
  const canSetObjectiveDuration = selectedEntries.length > 0
    && selectedEntries.every((entry) => entry.objectType !== 'AudioClip' && Boolean(entry.editorTarget));
  const canExport = selectedEntries.length === 1 &&
    selectedEntries[0]!.objectType !== 'AudioClip' &&
    selectedEntries[0]!.objectType !== 'Instance' &&
    Boolean(selectedEntries[0]!.serializedXml);
  // Mirrors Java ConvertToObjectBuilderAction: enabled for exactly one
  // selected PythonObject or External.
  const canConvertToObjectBuilder = selectedEntries.length === 1 &&
    (selectedEntries[0]!.objectType === 'PythonObject' ||
      selectedEntries[0]!.objectType === 'External');
  const canConvertToPolyObject = selectedEntries.length > 0 &&
    selectedEntries.every((entry) => entry.objectType !== 'AudioClip' && Boolean(entry.editorTarget));

  const handleConvertToPolyObject = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0 || !contextMenuPos) return;
    const targets = entries.flatMap((entry) => (entry.editorTarget ? [entry.editorTarget] : []));
    if (targets.length === 0) return;

    const selectionId = `poly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    void (async () => {
      await applyProjectDocumentPatch({
        score: {
          type: 'convertToPolyObject',
          targets,
          targetGroupId: group.groupId,
          targetLayerIndex: contextMenuPos.layerIndex,
          selectionId,
        },
      });
      await flushPendingPatches();
      select(selectionId, false);
    })();
  }, [getSelectedEntries, contextMenuPos, applyProjectDocumentPatch, flushPendingPatches, group.groupId, select]);

  const handlePasteAsPolyObject = useCallback(() => {
    if (clipboard.length === 0 || !contextMenuPos) return;
    const paste = createPolyObjectPasteObjectFromClipboard({
      clipboard,
      layerGroups: interactionLayerGroups,
      targetGroupId: group.groupId,
      targetLayerIndex: contextMenuPos.layerIndex,
      targetXBeats: contextMenuPos.xBeats,
      snapBeatValue: snapBeatValueStart,
    });
    if (!paste.ok) {
      toast.error(paste.message);
      return;
    }
    addScoreObjects([paste.pasteObject]);
  }, [clipboard, contextMenuPos, interactionLayerGroups, group.groupId, snapBeatValueStart, addScoreObjects]);

  const handleContextMenuPaste = useCallback(() => {
    if (clipboard.length === 0 || !contextMenuPos) return;
    const paste = translateClipboardEntriesForPaste({
      clipboard,
      layerGroups: interactionLayerGroups,
      targetGroupId: group.groupId,
      targetLayerIndex: contextMenuPos.layerIndex,
      targetXBeats: contextMenuPos.xBeats,
      snapBeatValue: snapBeatValueStart,
    });
    if (!paste.ok) {
      toast.error(paste.message);
      return;
    }
    for (const objects of groupPasteObjectsByTargetGroup(paste.entries.map((entry) => entry.object))) {
      addScoreObjects(objects);
    }
  }, [clipboard, contextMenuPos, snapBeatValueStart, addScoreObjects, interactionLayerGroups, group.groupId]);

  const handleSelectLayer = useCallback(() => {
    if (!contextMenuPos) return;
    const layer = group.layers[contextMenuPos.layerIndex];
    if (layer) setSelection(collectTimelineLayerSelection(layer));
  }, [contextMenuPos, group.layers, setSelection]);

  const handleSelectAllBefore = useCallback(() => {
    if (contextMenuPos) {
      setSelection(collectTimelineBoundarySelection(interactionLayerGroups, contextMenuPos.xBeats, 'before'));
    }
  }, [contextMenuPos, interactionLayerGroups, setSelection]);

  const handleSelectAllAfter = useCallback(() => {
    if (contextMenuPos) {
      setSelection(collectTimelineBoundarySelection(interactionLayerGroups, contextMenuPos.xBeats, 'after'));
    }
  }, [contextMenuPos, interactionLayerGroups, setSelection]);

  const commitMoves = useCallback(
    (moves: Array<{ entry: ScoreObjectClipboardEntry; targetStartBeats: number }>) => {
      if (moves.length === 0) return;
      const optimisticMoves = moves.map(({ entry, targetStartBeats }) => ({
        objectId: entry.objectId,
        targetStartBeats,
        targetLayerIndex: entry.layerIndex,
        targetGroupId: entry.groupId,
      }));
      moveScoreObjects(optimisticMoves);
      const canonicalMoves = moves.flatMap(({ entry, targetStartBeats }) =>
        entry.editorTarget
          ? [
              {
                target: entry.editorTarget,
                targetStartBeats,
                targetLayerIndex: entry.layerIndex,
                targetGroupId: entry.groupId,
              },
            ]
          : [],
      );
      if (canonicalMoves.length > 0) {
        void applyProjectDocumentPatch({ score: { type: 'moveScoreObjects', moves: canonicalMoves } });
      }
    },
    [applyProjectDocumentPatch, moveScoreObjects],
  );

  const handleAlignLeft = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length < 2) return;
    const minStart = Math.min(...entries.map((e) => e.startBeats));
    commitMoves(entries.map((entry) => ({ entry, targetStartBeats: minStart })));
  }, [commitMoves, getSelectedEntries]);

  const handleAlignCenter = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length < 2) return;
    const centers = entries.map((e) => e.startBeats + e.durationBeats / 2);
    const mid = (Math.min(...centers) + Math.max(...centers)) / 2;
    commitMoves(
      entries.map((entry) => ({
        entry,
        targetStartBeats: Math.max(0, mid - entry.durationBeats / 2),
      })),
    );
  }, [commitMoves, getSelectedEntries]);

  const handleAlignRight = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length < 2) return;
    const maxEnd = Math.max(...entries.map((e) => e.startBeats + e.durationBeats));
    commitMoves(
      entries.map((entry) => ({
        entry,
        targetStartBeats: Math.max(0, maxEnd - entry.durationBeats),
      })),
    );
  }, [commitMoves, getSelectedEntries]);

  const handleFollowTheLeader = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length < 2) return;
    const sorted = [...entries].sort((a, b) => a.startBeats - b.startBeats);
    let cursor = sorted[0].startBeats;
    commitMoves(
      sorted.map((entry) => {
        const targetStartBeats = cursor;
        cursor += entry.durationBeats;
        return { entry, targetStartBeats };
      }),
    );
  }, [commitMoves, getSelectedEntries]);

  const handleReverse = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length < 2) return;
    const sorted = [...entries].sort((a, b) => a.startBeats - b.startBeats);
    const reversed = [...sorted].reverse();
    commitMoves(
      sorted.map((entry, i) => ({
        entry,
        targetStartBeats: reversed[i].startBeats,
      })),
    );
  }, [commitMoves, getSelectedEntries]);

  const handleShift = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    setShowShiftDialog(true);
  }, [getSelectedEntries]);

  const handleConfirmShift = useCallback(
    (amount: number) => {
      const entries = getSelectedEntries();
      if (entries.length === 0) return;
      commitMoves(
        entries.map((entry) => ({
          entry,
          targetStartBeats: entry.startBeats + amount,
        })),
      );
    },
    [commitMoves, getSelectedEntries],
  );

  const minStartBeats = useMemo(() => {
    const entries = getSelectedEntries();
    return entries.length > 0 ? Math.min(...entries.map((e) => e.startBeats)) : 0;
  }, [getSelectedEntries]);

  const handleSelectAll = useCallback(() => {
    setSelection(collectAllItemSelectionEntries(group));
  }, [group, setSelection]);

  const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTextEditingTarget(e.target)) return;

    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'c') {
      e.preventDefault();
      e.stopPropagation();
      handleCopy();
      return;
    }

    if (mod && key === 'x') {
      e.preventDefault();
      e.stopPropagation();
      handleCut();
      return;
    }

    if (mod && key === 'v') {
      e.preventDefault();
      e.stopPropagation();
      if (libraryClipboard && librarySoundObjectAvailable) {
        const target = contextMenuPos
          ? buildLibraryTarget(contextMenuPos.layerIndex, contextMenuPos.xBeats)
          : lastLibraryTargetRef.current;
        if (target) {
          void transferLibraryItem({ kind: 'clipboard', source: libraryClipboard.source }, target);
        } else {
          toast.error('Point to an exact Score layer and time before pasting a Library item.');
        }
      } else {
        handleContextMenuPaste();
      }
      return;
    }

    if (!mod && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace') && selectedObjectIds.size > 0) {
      e.preventDefault();
      e.stopPropagation();
      handleRemove();
    }
  }, [buildLibraryTarget, contextMenuPos, handleCopy, handleContextMenuPaste, handleCut, handleRemove, libraryClipboard, librarySoundObjectAvailable, selectedObjectIds, transferLibraryItem]);

  const canvasShortcutScope = useKeyboardShortcutScope({
    ref: containerRef,
    onKeyDown: handleCanvasKeyDown,
  });

  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;
  const handleMouseMoveRef = useRef(handleMouseMove);
  handleMouseMoveRef.current = handleMouseMove;

  useEffect(() => {
    const onMouseUp = () => {
      if (gestureRef.current) {
        handleMouseUpRef.current();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (gestureRef.current) {
        handleMouseMoveRef.current(e as unknown as React.MouseEvent);
      }
    };
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.endX),
    top: Math.min(marquee.startY, marquee.endY),
    width: Math.abs(marquee.endX - marquee.startX),
    height: Math.abs(marquee.endY - marquee.startY),
  } : null;

  const menuItemClass = 'editor-context-menu__item';
  const subMenuClass = 'editor-context-menu';
  const menuClass = 'editor-context-menu';
  const sepClass = 'editor-context-menu__separator';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          ref={containerRef}
          data-group-id={group.groupId}
          data-shortcut-scope="score-time-canvas"
          className="relative select-none focus:outline-none"
          title={mode === 'score' ? (tooltip ?? undefined) : undefined}
          style={{ cursor: cursorOverride ?? 'default' }}
          {...canvasShortcutScope}
          onMouseDown={handleMouseDown}
          onMouseMove={(event) => {
            handleMouseMove(event);
            lastLibraryTargetRef.current = locateLibraryTarget(event.clientX, event.clientY)?.target ?? null;
          }}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(BLUE_LIBRARY_DRAG_MIME)) return;
            const descriptor = readLibraryDragDescriptor(event.dataTransfer);
            if (descriptor && descriptor.libraryType !== 'soundObject') {
              event.dataTransfer.dropEffect = 'none';
              setLibraryDropMarker(null);
              return;
            }
            const located = locateLibraryTarget(event.clientX, event.clientY);
            if (!located) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            lastLibraryTargetRef.current = located.target;
            setLibraryDropMarker(located);
            const scroller = event.currentTarget.closest('[data-library-autoscroll]');
            if (scroller instanceof HTMLElement) {
              const rect = scroller.getBoundingClientRect();
              if (event.clientY < rect.top + 24) scroller.scrollTop -= 16;
              else if (event.clientY > rect.bottom - 24) scroller.scrollTop += 16;
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setLibraryDropMarker(null);
            }
          }}
          onDrop={(event) => {
            const descriptor = readLibraryDragDescriptor(event.dataTransfer);
            const source = readLibraryDragSource(event.dataTransfer);
            const located = locateLibraryTarget(event.clientX, event.clientY);
            setLibraryDropMarker(null);
            if (descriptor?.libraryType !== 'soundObject' || !source || !located) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            void transferLibraryItem(source, located.target);
          }}
          onContextMenu={(e) => {
            const { x, y } = toLocalXY(e.clientX, e.clientY);
            const xBeats = x / pixelsPerBeat;
            const hit = findLayerAtY(group.layers, y);
            const item = hit ? findItemOnLayer(hit.layer, xBeats) : null;
            setContextMenuPos(hit ? { xBeats, layerIndex: hit.index } : null);
            setContextMenuOnObject(!!item);
            setContextMenuObjectType(item?.editorTarget?.selectedObjectType ?? item?.objectType ?? null);
            lastLibraryTargetRef.current = hit ? buildLibraryTarget(hit.index, xBeats) : null;
            if (item && hit) {
              const bounds = e.currentTarget.getBoundingClientRect();
              const rowHeight = hit.layer.height || DEFAULT_ROW_HEIGHT;
              colorPickerAnchorRef.current = {
                left: e.clientX,
                right: e.clientX,
                top: bounds.top + hit.yOffset,
                bottom: bounds.top + hit.yOffset + rowHeight,
              };
              colorPickerAnchorElementRef.current = e.currentTarget as HTMLElement;
            } else {
              colorPickerAnchorRef.current = null;
              colorPickerAnchorElementRef.current = null;
            }
            if (item && !selectedObjectIds.has(item.objectId)) {
              select(item.objectId, false, item.editorTarget);
            }
          }}
        >
          <ScoreObjectColorPicker ref={colorPickerRef} onSelect={handleColorSelected} />
          {group.layers.map((layer: ScoreLayerSnapshot) => {
            const isLayerSelected = selectedLayerKeys.has(
              buildSelectionKey(group.groupId, getLayerSelectionId(layer)),
            );
            return (
              <div
                key={layer.layerId}
                data-timeline-layer-row
                aria-selected={isLayerSelected ? 'true' : 'false'}
                data-selected-layer={isLayerSelected ? 'true' : undefined}
                className="relative"
                style={{
                  height: layer.height || DEFAULT_ROW_HEIGHT,
                  backgroundColor: 'var(--color-app-canvas)',
                  borderBottom: '1px solid var(--color-app-timeline-divider)',
                }}
              >
              <SnapLinesLayer
                layerId={layer.layerId}
                contentWidth={contentWidth}
                lineXPositions={snapLineXPositions}
                height={layer.height || DEFAULT_ROW_HEIGHT}
              />
              {layer.items.map((item: ScoreRowObjectSnapshot) => {
                const preview = effectivePreview[item.objectId];
                const startBeats = preview?.startBeats ?? item.startBeats;
                const durationBeats = preview?.durationBeats ?? item.durationBeats;
                const isSelected = selectedObjectIds.has(item.objectId);

                return (
                  <RenderBar
                    key={item.objectId}
                    item={{ ...item, startBeats, durationBeats }}
                    selected={isSelected}
                    pixelsPerBeat={pixelsPerBeat}
                    pixelsPerSecond={pixelsPerSecond}
                    rowHeight={layer.height || DEFAULT_ROW_HEIGHT}
                    durationBeats={durationBeats}
                  />
                );
              })}
              {layer.automation && layer.automation.parameters.length > 0 && (
                <AutomationLayerOverlay
                  automation={layer.automation}
                  pixelsPerBeat={pixelsPerBeat}
                  totalBeats={totalBeats}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  tempo={tempo}
                  smpteFrameRate={smpteFrameRate}
                  mode={mode}
                  onPatch={(patch: ScoreAutomationPatch) => {
                    void (async () => {
                      await applyProjectDocumentPatch({ score: patch });
                      await flushPendingPatches();
                    })();
                  }}
                />
              )}
            </div>
            );
          })}

          {marqueeStyle && (
            <div
              className="absolute pointer-events-none"
              style={{
                ...marqueeStyle,
                backgroundColor: 'color-mix(in srgb, var(--color-app-text-strong) 6%, var(--color-app-clear))',
                border: '1px solid color-mix(in srgb, var(--color-app-text-strong) 50%, var(--color-app-clear))',
                zIndex: 10,
              }}
            />
          )}

          {libraryDropMarker && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-30 border-y border-app-accent bg-app-accent/10"
              style={{
                left: 0,
                right: 0,
                top: libraryDropMarker.y,
                height: libraryDropMarker.height,
              }}
            >
              <div
                className="absolute inset-y-0 w-0.5 bg-app-accent shadow-[0_0_0_1px_var(--color-app-bg)]"
                style={{ left: libraryDropMarker.x }}
              />
            </div>
          )}
        </div>
      </ContextMenu.Trigger>

      <PopoutContextMenuPortal>
        <ContextMenu.Content className={menuClass} {...portalEventIsolationProps}>
          {contextMenuOnObject && selectedObjectIds.size > 0 ? (
            <ObjectContextMenu
              menuItemClass={menuItemClass}
              subMenuClass={subMenuClass}
              sepClass={sepClass}
              onAlignLeft={handleAlignLeft}
              onAlignCenter={handleAlignCenter}
              onAlignRight={handleAlignRight}
              onCopy={handleCopy}
              onCut={handleCut}
              onAddToProjectSoundObjectLibrary={handleAddToProjectSoundObjectLibrary}
              canAddToProjectSoundObjectLibrary={
                canAddToProjectSoundObjectLibrary && contextMenuObjectType !== 'Instance'
              }
              onRemove={handleRemove}
              onFollowTheLeader={handleFollowTheLeader}
              onReverse={handleReverse}
              onShift={handleShift}
              onSetColor={handleSetColor}
              onSetToLayerColor={handleSetToLayerColor}
              onSetSubjectiveToObjective={handleSetSubjectiveToObjective}
              canSetObjectiveDuration={canSetObjectiveDuration}
              onReplaceWithBuffer={handleReplaceWithBuffer}
              canReplaceWithBuffer={clipboard.length === 1}
              onFreezeUnfreeze={handleFreezeUnfreeze}
              onExport={handleExport}
              canExport={canExport}
              onConvertToObjectBuilder={handleConvertToObjectBuilder}
              canConvertToObjectBuilder={canConvertToObjectBuilder}
              onConvertToPolyObject={handleConvertToPolyObject}
              canConvertToPolyObject={canConvertToPolyObject}
            />
          ) : (
            <EmptyAreaContextMenu
              menuItemClass={menuItemClass}
              sepClass={sepClass}
              clipboard={clipboard}
              libraryClipboardAvailable={librarySoundObjectAvailable}
              libraryBsbAvailable={libraryBsbAvailable}
              contextMenuPos={contextMenuPos}
              group={group}
              onPaste={handleContextMenuPaste}
              onPasteAsPolyObject={handlePasteAsPolyObject}
              onLibraryPaste={pasteLibraryAtContext}
              onPasteBsb={pasteBsbAtContext}
              snapBeatValue={snapBeatValueStart}
              addScoreObjects={addScoreObjects}
              onSelectLayer={handleSelectLayer}
              onSelectAllBefore={handleSelectAllBefore}
              onSelectAllAfter={handleSelectAllAfter}
              onImport={handleImport}
            />
          )}
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
      {showShiftDialog && (
        <ShiftObjectsDialog
          onConfirm={handleConfirmShift}
          onClose={() => setShowShiftDialog(false)}
          minStartBeats={minStartBeats}
        />
      )}
      {pendingConvertTarget && (
        <ConfirmationDialog
          open={true}
          title="Convert to ObjectBuilder?"
          description="This operation can not be undone. Are you sure?"
          actions={[
            { id: 'cancel', label: 'Cancel', intent: 'cancel' },
            { id: 'convert', label: 'Convert', intent: 'destructive' },
          ]}
          cancelActionId="cancel"
          onDecision={(actionId) => {
            if (actionId === 'convert' && pendingConvertTarget) {
              const currentTarget = findEditorTarget(pendingConvertTarget.target.selectionId);
              if (
                pendingConvertTarget.projectSessionId === projectSessionId
                && pendingConvertTarget.projectRevision === projectRevision
                && currentTarget?.selectionId === pendingConvertTarget.target.selectionId
                && sameTarget(currentTarget, pendingConvertTarget.target)
              ) {
                void applyProjectDocumentPatch({
                  score: { type: 'convertScoreObjectToObjectBuilder', target: currentTarget },
                });
              }
            }
            setPendingConvertTarget(null);
          }}
        />
      )}
    </ContextMenu.Root>
  );
}

function ObjectContextMenu({ menuItemClass, subMenuClass, sepClass, onAlignLeft, onAlignCenter, onAlignRight, onCopy, onCut, onAddToProjectSoundObjectLibrary, canAddToProjectSoundObjectLibrary, onRemove, onFollowTheLeader, onReverse, onShift, onSetColor, onSetToLayerColor, onSetSubjectiveToObjective, canSetObjectiveDuration, onReplaceWithBuffer, canReplaceWithBuffer, onFreezeUnfreeze, onExport, canExport, onConvertToObjectBuilder, canConvertToObjectBuilder, onConvertToPolyObject, canConvertToPolyObject }: {
  menuItemClass: string;
  subMenuClass: string;
  sepClass: string;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onCopy: () => void;
  onCut: () => void;
  onAddToProjectSoundObjectLibrary: () => void;
  canAddToProjectSoundObjectLibrary: boolean;
  onRemove: () => void;
  onFollowTheLeader: () => void;
  onReverse: () => void;
  onShift: () => void;
  onSetColor: () => void;
  onSetToLayerColor: () => void;
  onSetSubjectiveToObjective: () => void;
  canSetObjectiveDuration: boolean;
  onReplaceWithBuffer: () => void;
  canReplaceWithBuffer: boolean;
  onFreezeUnfreeze: () => void;
  onExport: () => void;
  canExport: boolean;
  onConvertToObjectBuilder: () => void;
  canConvertToObjectBuilder: boolean;
  onConvertToPolyObject: () => void;
  canConvertToPolyObject: boolean;
}) {
  return (
    <>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canAddToProjectSoundObjectLibrary}
        onSelect={onAddToProjectSoundObjectLibrary}
      >
        Add to Project SoundObjects
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onFreezeUnfreeze}>
        Freeze/Unfreeze ScoreObjects
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canConvertToPolyObject}
        onSelect={onConvertToPolyObject}
      >
        Convert to PolyObject
      </ContextMenu.Item>
      <ContextMenu.Item
        className={menuItemClass}
        disabled={!canConvertToObjectBuilder}
        onSelect={onConvertToObjectBuilder}
      >
        Convert to ObjectBuilder
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} disabled={!canReplaceWithBuffer} onSelect={onReplaceWithBuffer}>
        Replace with SoundObject in Buffer
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onFollowTheLeader}>
        Follow the Leader
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} onSelect={onReverse}>
        Reverse
      </ContextMenu.Item>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className={cn(menuItemClass, 'editor-context-menu__subtrigger')}>
          <span>Align</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </ContextMenu.SubTrigger>
        <PopoutContextMenuPortal>
          <ContextMenu.SubContent className={subMenuClass} {...portalEventIsolationProps}>
            <ContextMenu.Item className={menuItemClass} onSelect={onAlignLeft}>Align Left</ContextMenu.Item>
            <ContextMenu.Item className={menuItemClass} onSelect={onAlignCenter}>Align Center</ContextMenu.Item>
            <ContextMenu.Item className={menuItemClass} onSelect={onAlignRight}>Align Right</ContextMenu.Item>
          </ContextMenu.SubContent>
        </PopoutContextMenuPortal>
      </ContextMenu.Sub>
      <ContextMenu.Item className={menuItemClass} onSelect={onShift}>
        Shift…
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} disabled={!canSetObjectiveDuration} onSelect={onSetSubjectiveToObjective}>
        Set Subjective Time to Objective Time
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onCut}>
        Cut<span className="float-right text-blue-muted text-role-callout ml-4">⌘X</span>
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} onSelect={onCopy}>
        Copy<span className="float-right text-blue-muted text-role-callout ml-4">⌘C</span>
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onRemove}>
        Remove<span className="float-right text-blue-muted text-role-callout ml-4">Del</span>
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onSetColor}>
        Set Color…
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} onSelect={onSetToLayerColor}>
        Set to Layer Color
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} disabled={!canExport} onSelect={onExport}>
        Export…
      </ContextMenu.Item>
    </>
  );
}

function EmptyAreaContextMenu({ menuItemClass, sepClass, clipboard, libraryClipboardAvailable, libraryBsbAvailable, contextMenuPos, group, onPaste, onPasteAsPolyObject, onLibraryPaste, onPasteBsb, snapBeatValue, addScoreObjects, onSelectLayer, onSelectAllBefore, onSelectAllAfter, onImport }: {
  menuItemClass: string;
  sepClass: string;
  clipboard: ScoreObjectClipboardEntry[];
  libraryClipboardAvailable: boolean;
  libraryBsbAvailable: boolean;
  contextMenuPos: { xBeats: number; layerIndex: number } | null;
  group: PolyObjectLayerGroupSnapshot;
  onPaste: () => void;
  onPasteAsPolyObject: () => void;
  onLibraryPaste: () => void;
  onPasteBsb: () => void;
  snapBeatValue: (b: number) => number;
  addScoreObjects: (objects: ScorePasteObject[]) => void;
  onSelectLayer: () => void;
  onSelectAllBefore: () => void;
  onSelectAllAfter: () => void;
  onImport: () => void;
}) {
  const handleAddSobj = (typeName: string) => {
    if (contextMenuPos == null) return;
    const isContainer = typeName === 'PolyObject';
    addScoreObjects([{
      layerIndex: contextMenuPos.layerIndex,
      groupId: group.groupId,
      name: typeName,
      startBeats: snapBeatValue(contextMenuPos.xBeats),
      durationBeats: DEFAULT_SOBJ_DURATION,
      objectType: typeName,
      isContainer,
    }]);
  };

  const addSobjTypes = [
    { name: 'AudioFile', pos: 10 },
    { name: 'Comment', pos: 20 },
    { name: 'External', pos: 30 },
    { name: 'GenericScore', pos: 40 },
    { name: 'JMask', pos: 50 },
    { name: 'LineObject', pos: 60 },
    { name: 'ObjectBuilder', pos: 70 },
    { name: 'PatternObject', pos: 80 },
    { name: 'PianoRoll', pos: 90 },
    { name: 'PolyObject', pos: 100 },
    { name: 'PythonObject', pos: 110 },
    { name: 'JavaScriptObject', pos: 120 },
    { name: 'Sound', pos: 130 },
    { name: 'TrackerObject', pos: 140 },
    { name: 'ZakLineObject', pos: 150 },
  ];

  return (
    <>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className={cn(menuItemClass, 'editor-context-menu__subtrigger')}>
          <span>Add SoundObject</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </ContextMenu.SubTrigger>
        <PopoutContextMenuPortal>
          <ContextMenu.SubContent className="editor-context-menu" {...portalEventIsolationProps}>
            {addSobjTypes.map((t) => (
              <ContextMenu.Item
                key={t.name}
                className={menuItemClass}
                onSelect={() => handleAddSobj(t.name)}
              >
                {t.name}
              </ContextMenu.Item>
            ))}
          </ContextMenu.SubContent>
        </PopoutContextMenuPortal>
      </ContextMenu.Sub>
      <ContextMenu.Separator className={sepClass} />
      {(libraryClipboardAvailable || libraryBsbAvailable || clipboard.length > 0) && (
        <>
          <ContextMenu.Item
            className={menuItemClass}
            disabled={!libraryClipboardAvailable && clipboard.length === 0}
            onSelect={libraryClipboardAvailable ? onLibraryPaste : onPaste}
          >
            Paste<span className="float-right text-blue-muted text-role-callout ml-4">⌘V</span>
          </ContextMenu.Item>
          {clipboard.length > 0 && (
            <ContextMenu.Item
              className={menuItemClass}
              disabled={clipboard.some((entry) => entry.objectType === 'AudioClip')}
              onSelect={onPasteAsPolyObject}
            >
              Paste as PolyObject
            </ContextMenu.Item>
          )}
          <ContextMenu.Item
            className={menuItemClass}
            disabled={!libraryBsbAvailable}
            onSelect={onPasteBsb}
          >
            Paste BSB As Sound
          </ContextMenu.Item>
          <ContextMenu.Separator className={sepClass} />
        </>
      )}
      <ContextMenu.Item className={menuItemClass} disabled={!contextMenuPos} onSelect={onSelectLayer}>
        Select Layer
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} disabled={!contextMenuPos} onSelect={onSelectAllBefore}>
        Select All Before
      </ContextMenu.Item>
      <ContextMenu.Item className={menuItemClass} disabled={!contextMenuPos} onSelect={onSelectAllAfter}>
        Select All After
      </ContextMenu.Item>
      <ContextMenu.Separator className={sepClass} />
      <ContextMenu.Item className={menuItemClass} onSelect={onImport}>
        Import…
      </ContextMenu.Item>
    </>
  );
}

function SnapLinesLayer({ layerId, contentWidth, lineXPositions, height }: {
  layerId: string;
  contentWidth: number;
  lineXPositions: number[];
  height: number;
}) {
  const pathData = useMemo(() => {
    if (lineXPositions.length === 0 || contentWidth <= 0 || height <= 0) {
      return '';
    }

    return lineXPositions.map((x) => `M ${x} 0 V ${height}`).join(' ');
  }, [contentWidth, height, lineXPositions]);

  if (!pathData) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      data-snap-lines-layer={layerId}
      className="absolute top-0 left-0 pointer-events-none overflow-hidden"
      width={contentWidth}
      height={height}
      viewBox={`0 0 ${contentWidth} ${height}`}
    >
      <path
        d={pathData}
        fill="none"
        shapeRendering="crispEdges"
        stroke="var(--color-app-timeline-grid)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
