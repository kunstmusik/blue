import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import ShiftObjectsDialog from '../ShiftObjectsDialog';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllSoundObjectTypeDescriptors,
  snapValueToBeats,
  type SnapValueName,
} from '@blue/data';
import type {
  AudioFadeType,
  MeterMapSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreObjectEditorTargetSnapshot,
  TrackLayerGroupSnapshot,
  TrackItemTransfer,
} from '../../../../../../shared/project-editor';
import type { ScoreObjectClipboardEntry } from '../../../../../stores/score-selection-store';
import { useScoreSelectionStore } from '../../../../../stores/score-selection-store';
import { useLibraryStore } from '../../../../../stores/library-store';
import { useProjectStore } from '../../../../../stores/project-store';
import { useMidiRoutingStore } from '../../../../../stores/midi-routing-store';
import { useWorkbenchStore } from '../../../../../stores/workbench-store';
import { RenderBar } from '../bar-renderers/renderer-registry';
import AutomationLayerOverlay from '../automation/AutomationLayerOverlay';
import type { ScoreAutomationPatch } from '../../../../../../shared/project-editor';
import type { ScoreLayerSnapshot, ScoreRowObjectSnapshot } from '../types';
import { DEFAULT_ROW_HEIGHT, GROUP_SPACER } from '../types';
import { snapBeatToGrid } from '../snap-grid-utils';
import {
  collectClipboardEntriesForSelection,
  layerGroupAcceptsObjectType,
} from './score-clipboard-utils';
import {
  buildTimelineGlobalLayerData,
  collectTimelineBoundarySelection,
  collectTimelineLayerSelection,
  findTimelineGlobalLayerAtY,
  findTimelineHit,
  findTimelineLayerAtY,
  getTimelineLayerAdjustBounds,
  selectionIntersectsTimelineItem,
  timelinePointerDeltaBeats,
} from './score-timeline-gesture-utils';
import type { ScoreInsertionLocation } from '../../../../../../shared/unified-library';
import { isCsoundAudioSourcePath } from '../../../../../../shared/file-manager';
import {
  dataTransferCanAcceptAudioDrop,
  dataTransferMayCarryAudioDrop,
  readAudioDropSource,
} from '../../tools/file-manager/file-manager-drag-drop';
import ScoreObjectColorPicker, { type ScoreObjectColorPickerHandle } from './ScoreObjectColorPicker';
import type { ColorPickerAnchorRect } from '../../../../ColorPicker';

interface Props {
  group: TrackLayerGroupSnapshot;
  allLayerGroups?: ScoreLayerGroupSnapshot[];
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

type GestureMode = 'marquee' | 'move' | 'resizeLeft' | 'resizeRight' | 'fadeIn' | 'fadeOut' | 'slideFileStart';

interface TrackPreview {
  startBeats: number;
  durationBeats: number;
}

interface OriginalTrackItem {
  objectId: string;
  objectType: string;
  groupId: string;
  layerIndex: number;
  globalLayerIndex: number;
  startBeats: number;
  durationBeats: number;
  startTimeBase: string;
  durationTimeBase: string;
  fadeInBeats: number;
  fadeOutBeats: number;
  editorTarget?: ScoreObjectEditorTargetSnapshot;
}

interface GestureState {
  mode: GestureMode;
  startClientX: number;
  startClientY: number;
  startBeats: number;
  startLayerIndex: number;
  startGlobalLayer: number;
  startGroupYOffset: number;
  minLayerAdjust: number;
  maxLayerAdjust: number;
  globalLayerMap: Array<{ groupId: string; localIndex: number }>;
  activeObjectId?: string;
  startFadeBeats?: number;
  startFileStartBeats?: number;
  audioDurationBeats?: number;
  looping?: boolean;
  resizeReferenceStartBeats?: number;
  resizeReferenceDurationBeats?: number;
  additive: boolean;
  originals: OriginalTrackItem[];
}

interface AudioClipPreview {
  fadeInBeats?: number;
  fadeOutBeats?: number;
  fileStartTimeBeats?: number;
}

interface FadeContextMenuState {
  objectId: string;
  target?: ScoreObjectEditorTargetSnapshot;
  side: 'fadeIn' | 'fadeOut';
}

const RESIZE_EDGE_PX = 5;
const MIN_TRACK_ITEM_DURATION = 0.25;
const FADE_HANDLE_SIZE = 5;
const FADE_HANDLE_OUTLINE = '0 0 0 1px #000000';
const AUDIO_FADE_TYPE_OPTIONS: Array<{ value: AudioFadeType; label: string }> = [
  { value: 'LINEAR', label: 'Linear' },
  { value: 'CONSTANT_POWER', label: 'Constant Power' },
  { value: 'SYMMETRIC', label: 'Symmetric' },
  { value: 'FAST', label: 'Fast' },
  { value: 'SLOW', label: 'Slow' },
];
const TRACK_SOUND_OBJECT_TYPES = getAllSoundObjectTypeDescriptors()
  .filter((descriptor) => descriptor.trackPlacement === 'compatible')
  .map((descriptor) => descriptor.typeName)
  .sort((a, b) => a.localeCompare(b));

function trackRef(group: TrackLayerGroupSnapshot, trackId: string, sessionId: number, revision: number) {
  return {
    rootGroupId: group.groupId,
    trackId,
    projectSessionId: sessionId,
    projectRevision: revision,
  } as const;
}

function itemTransfer(item: ScoreObjectClipboardEntry | ScoreRowObjectSnapshot): TrackItemTransfer {
  return {
    objectType: item.objectType,
    name: item.name,
    startBeats: item.startBeats,
    durationBeats: item.durationBeats,
    startTimeBase: item.startTimeBase,
    durationTimeBase: item.durationTimeBase,
    backgroundColor: item.backgroundColor,
    serializedXml: item.serializedXml,
  };
}

function clampBeat(value: number, totalBeats: number): number {
  return Math.max(0, Math.min(totalBeats, Number.isFinite(value) ? value : 0));
}

export default function TrackLayerGroupCanvas({
  group,
  allLayerGroups = [group],
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
  const containerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<ScoreObjectColorPickerHandle>(null);
  const colorPickerAnchorRef = useRef<ColorPickerAnchorRect | null>(null);
  const pendingColorTargetsRef = useRef<ScoreObjectEditorTargetSnapshot[]>([]);
  const gestureRef = useRef<GestureState | null>(null);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const marqueeRef = useRef<typeof marquee>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ xBeats: number; layerIndex: number } | null>(null);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [contextMenuObjectId, setContextMenuObjectId] = useState<string | null>(null);
  const [previewByObjectId, setPreviewByObjectId] = useState<Record<string, TrackPreview>>({});
  const [audioPreviewByObjectId, setAudioPreviewByObjectId] = useState<Record<string, AudioClipPreview>>({});
  const [fadeContextMenu, setFadeContextMenu] = useState<FadeContextMenuState | null>(null);
  const [hoveredAudioObjectId, setHoveredAudioObjectId] = useState<string | null>(null);
  const [cursorOverride, setCursorOverride] = useState<string | null>(null);
  const pendingMovePatchRef = useRef<Array<{
    target: ScoreObjectEditorTargetSnapshot;
    targetStartBeats: number;
    targetLayerIndex: number;
    targetGroupId: string;
  }>>([]);
  const pendingSharedPropertyPatchRef = useRef<Map<string, { startBeats?: number; durationBeats?: number }>>(new Map());
  const pendingFadePatchRef = useRef<Map<string, { fadeInBeats?: number; fadeOutBeats?: number }>>(new Map());
  const pendingFileStartPatchRef = useRef<Map<string, { fileStartTimeBeats: number }>>(new Map());

  const selectedObjectIds = useScoreSelectionStore((state) => state.selectedObjectIds);
  const clipboard = useScoreSelectionStore((state) => state.clipboard);
  const select = useScoreSelectionStore((state) => state.select);
  const clearSelection = useScoreSelectionStore((state) => state.clearSelection);
  const setSelection = useScoreSelectionStore((state) => state.setSelection);
  const addToSelection = useScoreSelectionStore((state) => state.addToSelection);
  const copySelected = useScoreSelectionStore((state) => state.copySelected);
  const captureScoreSoundObject = useLibraryStore((state) => state.captureScoreSoundObject);
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
  const moveScoreObjects = useProjectStore((state) => state.moveScoreObjects);
  const resizeScoreObjects = useProjectStore((state) => state.resizeScoreObjects);
  const setAudioClipEditorPreview = useProjectStore((state) => state.setAudioClipEditorPreview);
  const clearAudioClipEditorPreview = useProjectStore((state) => state.clearAudioClipEditorPreview);
  const openPanel = useWorkbenchStore((state) => state.openPanel);

  const contentWidth = totalBeats * pixelsPerBeat;
  const snapBeats = snapEnabled
    ? snapValueToBeats(snapValue, tempo, smpteFrameRate, 44100, pixelsPerBeat)
    : 0;
  const snapBeat = useCallback((beats: number, direction: 'floor' | 'nearest') => {
    if (!snapEnabled || snapBeats <= 0) return beats;
    return snapBeatToGrid(beats, direction, snapValue, snapBeats, meterMap);
  }, [meterMap, snapBeats, snapEnabled, snapValue]);
  const beatsToSeconds = useCallback((beats: number) => (
    tempo > 0 ? Math.max(0, beats) * 60 / tempo : Math.max(0, beats)
  ), [tempo]);

  const toLocalXY = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const getDisplayItem = useCallback((item: ScoreRowObjectSnapshot): ScoreRowObjectSnapshot => {
    const timingPreview = previewByObjectId[item.objectId];
    const audioPreview = audioPreviewByObjectId[item.objectId];
    const timed = timingPreview
      ? { ...item, startBeats: timingPreview.startBeats, durationBeats: timingPreview.durationBeats }
      : item;
    if (!audioPreview || timed.barRenderer.kind !== 'audioClip') return timed;
    return {
      ...timed,
      barRenderer: {
        ...timed.barRenderer,
        fileStartTimeBeats: audioPreview.fileStartTimeBeats ?? timed.barRenderer.fileStartTimeBeats,
        fadeInBeats: audioPreview.fadeInBeats ?? timed.barRenderer.fadeInBeats,
        fadeOutBeats: audioPreview.fadeOutBeats ?? timed.barRenderer.fadeOutBeats,
      },
    };
  }, [audioPreviewByObjectId, previewByObjectId]);

  const collectSelectedOriginals = useCallback((
    primaryItem: ScoreRowObjectSnapshot,
    groupStartIndexById: Map<string, number>,
  ): OriginalTrackItem[] => {
    const selectedIds = selectedObjectIds.has(primaryItem.objectId)
      ? new Set(selectedObjectIds)
      : new Set([primaryItem.objectId]);
    const originals: OriginalTrackItem[] = [];
    for (const layerGroup of allLayerGroups) {
      const groupStart = groupStartIndexById.get(layerGroup.groupId) ?? 0;
      for (let layerIndex = 0; layerIndex < layerGroup.layers.length; layerIndex += 1) {
        for (const candidate of layerGroup.layers[layerIndex]!.items) {
          if (!selectedIds.has(candidate.objectId)) continue;
          const display = getDisplayItem(candidate);
          originals.push({
            objectId: candidate.objectId,
            objectType: candidate.objectType,
            groupId: layerGroup.groupId,
            layerIndex,
            globalLayerIndex: groupStart + layerIndex,
            startBeats: display.startBeats,
            durationBeats: display.durationBeats,
            startTimeBase: candidate.startTimeBase,
            durationTimeBase: candidate.durationTimeBase,
            fadeInBeats: display.barRenderer.kind === 'audioClip' ? display.barRenderer.fadeInBeats : 0,
            fadeOutBeats: display.barRenderer.kind === 'audioClip' ? display.barRenderer.fadeOutBeats : 0,
            editorTarget: candidate.editorTarget,
          });
        }
      }
    }
    return originals;
  }, [allLayerGroups, getDisplayItem, selectedObjectIds]);

  const clearPreview = useCallback(() => {
    setPreviewByObjectId({});
  }, []);

  useEffect(() => {
    if (Object.keys(audioPreviewByObjectId).length === 0) return;
    const current = new Map<string, { fileStartTimeBeats: number; fadeInBeats: number; fadeOutBeats: number }>();
    for (const layer of group.layers) {
      for (const item of layer.items) {
        if (item.barRenderer.kind !== 'audioClip') continue;
        current.set(item.objectId, {
          fileStartTimeBeats: item.barRenderer.fileStartTimeBeats,
          fadeInBeats: item.barRenderer.fadeInBeats,
          fadeOutBeats: item.barRenderer.fadeOutBeats,
        });
      }
    }
    const settled = Object.entries(audioPreviewByObjectId)
      .filter(([objectId, preview]) => {
        const value = current.get(objectId);
        return !value || (
          (preview.fileStartTimeBeats === undefined || Math.abs(preview.fileStartTimeBeats - value.fileStartTimeBeats) < 1e-6)
          && (preview.fadeInBeats === undefined || Math.abs(preview.fadeInBeats - value.fadeInBeats) < 1e-6)
          && (preview.fadeOutBeats === undefined || Math.abs(preview.fadeOutBeats - value.fadeOutBeats) < 1e-6)
        );
      })
      .map(([objectId]) => objectId);
    if (settled.length === 0) return;
    setAudioPreviewByObjectId((previous) => {
      const next = { ...previous };
      settled.forEach((objectId) => delete next[objectId]);
      return next;
    });
    settled.forEach(clearAudioClipEditorPreview);
  }, [audioPreviewByObjectId, clearAudioClipEditorPreview, group.layers]);

  const getSelectedEntries = useCallback(() => (
    collectClipboardEntriesForSelection(allLayerGroups, selectedObjectIds)
  ), [allLayerGroups, selectedObjectIds]);

  const handleRemove = useCallback(() => {
    const targets = getSelectedEntries()
      .map((entry) => entry.editorTarget)
      .filter((target): target is ScoreObjectEditorTargetSnapshot => target !== undefined);
    if (targets.length === 0) return;
    void applyProjectDocumentPatch({ score: { type: 'removeScoreObjects', targets } });
    clearSelection();
  }, [applyProjectDocumentPatch, clearSelection, getSelectedEntries]);

  const handleCopy = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    copySelected(entries);
    if (entries.length !== 1 || entries[0]!.objectType === 'AudioClip') return;
    const target = entries[0]!.editorTarget;
    const location = target?.location ?? target?.sourceInstanceLocation;
    if (!location) return;
    void captureScoreSoundObject({ projectSessionId, projectRevision, location });
  }, [
    captureScoreSoundObject,
    copySelected,
    getSelectedEntries,
    projectRevision,
    projectSessionId,
  ]);

  const handleCut = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length === 0) return;
    copySelected(entries);
    const targets = entries
      .map((entry) => entry.editorTarget)
      .filter((target): target is ScoreObjectEditorTargetSnapshot => target !== undefined);
    const removeTargets = (): void => {
      if (targets.length > 0) {
        void applyProjectDocumentPatch({ score: { type: 'removeScoreObjects', targets } });
      }
      clearSelection();
    };
    if (entries.length !== 1 || entries[0]!.objectType === 'AudioClip') {
      removeTargets();
      return;
    }
    const target = entries[0]!.editorTarget;
    const location = target?.location ?? target?.sourceInstanceLocation;
    if (!location) {
      removeTargets();
      return;
    }
    void captureScoreSoundObject({ projectSessionId, projectRevision, location })
      .then((captured) => { if (captured) removeTargets(); });
  }, [
    applyProjectDocumentPatch,
    captureScoreSoundObject,
    clearSelection,
    copySelected,
    getSelectedEntries,
    projectRevision,
    projectSessionId,
  ]);

  const commitMoves = useCallback((
    moves: Array<{ entry: ScoreObjectClipboardEntry; targetStartBeats: number }>,
  ) => {
    const optimisticMoves = moves.map(({ entry, targetStartBeats }) => ({
      objectId: entry.objectId,
      targetStartBeats,
      targetLayerIndex: entry.layerIndex,
      targetGroupId: entry.groupId,
    }));
    moveScoreObjects(optimisticMoves);
    const canonicalMoves = moves.flatMap(({ entry, targetStartBeats }) => entry.editorTarget ? [{
      target: entry.editorTarget,
      targetStartBeats,
      targetLayerIndex: entry.layerIndex,
      targetGroupId: entry.groupId,
    }] : []);
    if (canonicalMoves.length > 0) {
      void applyProjectDocumentPatch({ score: { type: 'moveScoreObjects', moves: canonicalMoves } });
    }
  }, [applyProjectDocumentPatch, moveScoreObjects]);

  const handleFollowTheLeader = useCallback(() => {
    const sorted = [...getSelectedEntries()].sort((a, b) => a.startBeats - b.startBeats);
    if (sorted.length < 2) return;
    let cursor = sorted[0]!.startBeats;
    commitMoves(sorted.map((entry) => {
      const targetStartBeats = cursor;
      cursor += entry.durationBeats;
      return { entry, targetStartBeats };
    }));
  }, [commitMoves, getSelectedEntries]);

  const handleReverse = useCallback(() => {
    const entries = getSelectedEntries();
    if (entries.length < 2) return;
    const start = Math.min(...entries.map((entry) => entry.startBeats));
    const end = Math.max(...entries.map((entry) => entry.startBeats + entry.durationBeats));
    commitMoves(entries.map((entry) => ({
      entry,
      targetStartBeats: start + end - (entry.startBeats + entry.durationBeats),
    })));
  }, [commitMoves, getSelectedEntries]);

  const handleAlign = useCallback((alignment: 'left' | 'center' | 'right') => {
    const entries = getSelectedEntries();
    if (entries.length < 2) return;
    if (alignment === 'left') {
      const start = Math.min(...entries.map((entry) => entry.startBeats));
      commitMoves(entries.map((entry) => ({ entry, targetStartBeats: start })));
    } else if (alignment === 'right') {
      const end = Math.max(...entries.map((entry) => entry.startBeats + entry.durationBeats));
      commitMoves(entries.map((entry) => ({ entry, targetStartBeats: Math.max(0, end - entry.durationBeats) })));
    } else {
      const start = Math.min(...entries.map((entry) => entry.startBeats));
      const end = Math.max(...entries.map((entry) => entry.startBeats + entry.durationBeats));
      const center = (start + end) / 2;
      commitMoves(entries.map((entry) => ({ entry, targetStartBeats: Math.max(0, center - entry.durationBeats / 2) })));
    }
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
      commitMoves(entries.map((entry) => ({ entry, targetStartBeats: entry.startBeats + amount })));
    },
    [commitMoves, getSelectedEntries],
  );

  const minStartBeats = useMemo(() => {
    const entries = getSelectedEntries();
    return entries.length > 0 ? Math.min(...entries.map((e) => e.startBeats)) : 0;
  }, [getSelectedEntries]);

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

  const handleColorSelected = useCallback((backgroundColor: number) => {
    const targets = pendingColorTargetsRef.current;
    void Promise.all(targets.map((target) => applyProjectDocumentPatch({ score: {
      type: 'updateSharedProperties', target, patch: { backgroundColor },
    } })));
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
    colorPickerRef.current?.open(entries[0]!.backgroundColor, anchor);
  }, [getSelectedEntries]);

  const handleReplaceWithBuffer = useCallback(() => {
    const selected = getSelectedEntries();
    if (selected.length === 0 || clipboard.length !== 1) {
      toast.error('Copy one SoundObject or AudioClip before replacing selected objects.');
      return;
    }
    const replacement = clipboard[0]!;
    const invalid = selected.find((entry) => {
      const targetGroup = allLayerGroups.find((candidate) => candidate.groupId === entry.groupId);
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
  }, [allLayerGroups, applyProjectDocumentPatch, clearSelection, clipboard, getSelectedEntries]);

  const handleExport = useCallback(async () => {
    const entries = getSelectedEntries();
    if (
      entries.length !== 1
      || entries[0]!.objectType === 'AudioClip'
      || entries[0]!.objectType === 'Instance'
      || !entries[0]!.serializedXml
    ) return;
    try {
      const result = await window.blueAPI.exportScoreObject(entries[0]!.serializedXml, entries[0]!.name);
      if (result.status === 'error') toast.error(result.error);
    } catch (error) {
      toast.error('Error: Could not export Sound Object.');
      console.error('Error exporting Sound Object', error);
    }
  }, [getSelectedEntries]);

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
      const layer = group.layers[Math.max(0, Math.min(contextMenuPos.layerIndex, group.layers.length - 1))];
      if (!layer) return;
      if (!layerGroupAcceptsObjectType('track', imported.objectType)) {
        toast.error(`${imported.objectType} cannot be imported into a Track.`);
        return;
      }

      const startBeats = clampBeat(snapBeat(contextMenuPos.xBeats, 'floor'), totalBeats);

      void applyProjectDocumentPatch({
        score: {
          type: 'addTrackItem',
          track: trackRef(group, layer.layerId, projectSessionId, projectRevision),
          item: {
            name: imported.name,
            durationBeats: imported.durationBeats,
            startTimeBase: imported.destinationTimeBase,
            durationTimeBase: imported.destinationTimeBase,
            backgroundColor: imported.backgroundColor,
            objectType: imported.objectType,
            serializedXml: imported.serializedXml,
          },
          startBeats,
        },
      });
    } catch (error) {
      toast.error('Error: Could not read Sound Object from file');
      console.error('Error importing Sound Object', error);
    }
  }, [applyProjectDocumentPatch, clampBeat, contextMenuPos, group, projectRevision, projectSessionId, snapBeat, totalBeats]);

  const addTrackItem = useCallback((objectType: 'AudioClip' | string, startBeats: number, layerIndex: number) => {
    const layer = group.layers[Math.max(0, Math.min(layerIndex, group.layers.length - 1))];
    if (!layer || !layerGroupAcceptsObjectType('track', objectType)) return;
    void applyProjectDocumentPatch({
      score: {
        type: 'addTrackItem',
        track: trackRef(group, layer.layerId, projectSessionId, projectRevision),
        item: {
          objectType,
          ...(objectType === 'AudioClip' ? { name: 'AudioClip' } : {}),
          durationBeats: 4,
          startTimeBase: 'BEATS',
          durationTimeBase: 'BEATS',
        },
        startBeats: clampBeat(snapBeat(startBeats, 'floor'), totalBeats),
      },
    });
  }, [applyProjectDocumentPatch, group, projectRevision, projectSessionId, snapBeat, totalBeats]);

  const pasteAtTrackPosition = useCallback((layerIndex: number, xBeats: number) => {
    if (clipboard.length === 0) return;
    const layer = group.layers[layerIndex];
    if (!layer) return;
    const offset = xBeats - Math.min(...clipboard.map((entry) => entry.startBeats));
    const patches = clipboard.map((entry) => ({
      type: 'addTrackItem' as const,
      track: trackRef(group, layer.layerId, projectSessionId, projectRevision),
      item: itemTransfer(entry),
      startBeats: clampBeat(snapBeat(entry.startBeats + offset, 'floor'), totalBeats),
    }));
    for (const patch of patches) {
      if (layerGroupAcceptsObjectType('track', patch.item.objectType ?? '')) {
        void applyProjectDocumentPatch({ score: patch });
      }
    }
  }, [applyProjectDocumentPatch, clipboard, group, projectRevision, projectSessionId, snapBeat, totalBeats]);

  const handlePaste = useCallback(() => {
    if (!contextMenuPos) return;
    pasteAtTrackPosition(contextMenuPos.layerIndex, contextMenuPos.xBeats);
  }, [contextMenuPos, pasteAtTrackPosition]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const { x, y } = toLocalXY(event.clientX, event.clientY);
    const xBeats = x / pixelsPerBeat;
    const hit = findTimelineHit(group.layers, xBeats, y, pixelsPerBeat, DEFAULT_ROW_HEIGHT);
    const layerHit = findTimelineLayerAtY(group.layers, y, DEFAULT_ROW_HEIGHT);

    if ((event.metaKey || event.ctrlKey) && !hit && layerHit && clipboard.length > 0) {
      event.preventDefault();
      pasteAtTrackPosition(layerHit.layerIndex, xBeats);
      gestureRef.current = null;
      return;
    }

    // Spec 067: an explicit pointer selection of a Track timeline surface
    // (empty location or contained ScoreObject/clip) focuses that Track. The
    // focus layer is the one under the pointer; identity is stable.
    const focusLayer = hit
      ? group.layers[hit.layerIndex]
      : layerHit
        ? group.layers[layerHit.layerIndex]
        : undefined;
    if (focusLayer) {
      useMidiRoutingStore.getState().focusTrack({
        projectSessionId,
        rootGroupId: group.groupId,
        trackId: focusLayer.layerId,
        displayName: focusLayer.name,
      });
    }

    if (!hit) {
      if (!event.shiftKey) clearSelection();
      gestureRef.current = {
        mode: 'marquee',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startBeats: xBeats,
        startLayerIndex: findTimelineLayerAtY(group.layers, y, DEFAULT_ROW_HEIGHT)?.layerIndex ?? 0,
        startGlobalLayer: 0,
        startGroupYOffset: 0,
        minLayerAdjust: 0,
        maxLayerAdjust: 0,
        globalLayerMap: [],
        additive: event.shiftKey,
        originals: [],
      };
      marqueeRef.current = null;
      setMarquee(null);
      return;
    }

    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      select(hit.item.objectId, true, hit.item.editorTarget);
      gestureRef.current = null;
      return;
    }
    if (!selectedObjectIds.has(hit.item.objectId)) {
      select(hit.item.objectId, false, hit.item.editorTarget);
    }

    const displayItem = getDisplayItem(hit.item);
    if (event.altKey && displayItem.barRenderer.kind === 'audioClip') {
      gestureRef.current = {
        mode: 'slideFileStart',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startBeats: displayItem.startBeats,
        startLayerIndex: hit.layerIndex,
        startGlobalLayer: hit.layerIndex,
        startGroupYOffset: 0,
        minLayerAdjust: 0,
        maxLayerAdjust: 0,
        globalLayerMap: [],
        activeObjectId: hit.item.objectId,
        startFileStartBeats: displayItem.barRenderer.fileStartTimeBeats,
        audioDurationBeats: displayItem.barRenderer.audioDurationBeats,
        looping: displayItem.barRenderer.looping,
        additive: false,
        originals: [{
          objectId: hit.item.objectId,
          objectType: hit.item.objectType,
          groupId: group.groupId,
          layerIndex: hit.layerIndex,
          globalLayerIndex: hit.layerIndex,
          startBeats: displayItem.startBeats,
          durationBeats: displayItem.durationBeats,
          startTimeBase: hit.item.startTimeBase,
          durationTimeBase: hit.item.durationTimeBase,
          fadeInBeats: displayItem.barRenderer.fadeInBeats,
          fadeOutBeats: displayItem.barRenderer.fadeOutBeats,
          editorTarget: hit.item.editorTarget,
        }],
      };
      return;
    }

    const globalData = buildTimelineGlobalLayerData(allLayerGroups, DEFAULT_ROW_HEIGHT, GROUP_SPACER);
    const currentGroupStart = globalData.groupStartIndexById.get(group.groupId) ?? 0;
    const currentGroupYOffset = globalData.groupYOffsetById.get(group.groupId) ?? 0;
    const originals = collectSelectedOriginals(hit.item, globalData.groupStartIndexById);
    if (originals.length === 0) return;

    const localX = x - displayItem.startBeats * pixelsPerBeat;
    const width = Math.max(displayItem.durationBeats * pixelsPerBeat, 4);
    const onLeftEdge = selectedObjectIds.has(hit.item.objectId) && localX >= 0 && localX < RESIZE_EDGE_PX;
    const onRightEdge = selectedObjectIds.has(hit.item.objectId) && localX > width - RESIZE_EDGE_PX && localX <= width;
    let minLayerAdjust = 0;
    let maxLayerAdjust = 0;
    if (!onLeftEdge && !onRightEdge) {
      minLayerAdjust = Number.NEGATIVE_INFINITY;
      maxLayerAdjust = Number.POSITIVE_INFINITY;
      for (const original of originals) {
        const bounds = getTimelineLayerAdjustBounds(
          globalData.layerMap,
          original.objectType,
          original.globalLayerIndex,
          layerGroupAcceptsObjectType,
        );
        minLayerAdjust = Math.max(minLayerAdjust, bounds.min);
        maxLayerAdjust = Math.min(maxLayerAdjust, bounds.max);
      }
      if (!Number.isFinite(minLayerAdjust)) minLayerAdjust = 0;
      if (!Number.isFinite(maxLayerAdjust)) maxLayerAdjust = 0;
    }

    gestureRef.current = {
      mode: onLeftEdge ? 'resizeLeft' : onRightEdge ? 'resizeRight' : 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBeats: xBeats,
      startLayerIndex: hit.layerIndex,
      startGlobalLayer: currentGroupStart + hit.layerIndex,
      startGroupYOffset: currentGroupYOffset,
      minLayerAdjust,
      maxLayerAdjust,
      globalLayerMap: globalData.layerMap.map(({ groupId, localIndex }) => ({ groupId, localIndex })),
      resizeReferenceStartBeats: displayItem.startBeats,
      resizeReferenceDurationBeats: displayItem.durationBeats,
      additive: false,
      originals,
    };
  }, [allLayerGroups, clearSelection, clipboard.length, collectSelectedOriginals, getDisplayItem, group.groupId, group.layers, pasteAtTrackPosition, pixelsPerBeat, select, selectedObjectIds, toLocalXY]);

  const startFadeHandleDrag = useCallback((
    event: React.MouseEvent<HTMLDivElement>,
    item: ScoreRowObjectSnapshot,
    layerIndex: number,
    mode: 'fadeIn' | 'fadeOut',
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (!selectedObjectIds.has(item.objectId) || selectedObjectIds.size !== 1) {
      select(item.objectId, false, item.editorTarget);
    }
    const displayItem = getDisplayItem(item);
    if (displayItem.barRenderer.kind !== 'audioClip') return;
    gestureRef.current = {
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBeats: displayItem.startBeats,
      startLayerIndex: layerIndex,
      startGlobalLayer: layerIndex,
      startGroupYOffset: 0,
      minLayerAdjust: 0,
      maxLayerAdjust: 0,
      globalLayerMap: [],
      activeObjectId: item.objectId,
      startFadeBeats: mode === 'fadeIn' ? displayItem.barRenderer.fadeInBeats : displayItem.barRenderer.fadeOutBeats,
      additive: false,
      originals: [{
        objectId: item.objectId,
        objectType: item.objectType,
        groupId: group.groupId,
        layerIndex,
        globalLayerIndex: layerIndex,
        startBeats: displayItem.startBeats,
        durationBeats: displayItem.durationBeats,
        startTimeBase: item.startTimeBase,
        durationTimeBase: item.durationTimeBase,
        fadeInBeats: displayItem.barRenderer.fadeInBeats,
        fadeOutBeats: displayItem.barRenderer.fadeOutBeats,
        editorTarget: item.editorTarget,
      }],
    };
  }, [getDisplayItem, group.groupId, select, selectedObjectIds]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) {
      const { x, y } = toLocalXY(event.clientX, event.clientY);
      const hit = findTimelineHit(group.layers, x / pixelsPerBeat, y, pixelsPerBeat, DEFAULT_ROW_HEIGHT);
      if (!hit) {
        setHoveredAudioObjectId(null);
        setCursorOverride(null);
        return;
      }
      const display = getDisplayItem(hit.item);
      setHoveredAudioObjectId(display.barRenderer.kind === 'audioClip' ? hit.item.objectId : null);
      if (!selectedObjectIds.has(hit.item.objectId)) {
        setCursorOverride(null);
        return;
      }
      const localX = x - display.startBeats * pixelsPerBeat;
      const width = Math.max(display.durationBeats * pixelsPerBeat, 4);
      setCursorOverride(localX >= 0 && localX < RESIZE_EDGE_PX
        ? 'w-resize'
        : localX > width - RESIZE_EDGE_PX && localX <= width
          ? 'e-resize'
          : 'move');
      return;
    }

    const { x, y } = toLocalXY(event.clientX, event.clientY);
    if (gesture.mode === 'marquee') {
      const start = toLocalXY(gesture.startClientX, gesture.startClientY);
      const next = { startX: start.x, startY: start.y, endX: x, endY: y };
      marqueeRef.current = next;
      setMarquee(next);
      return;
    }

    if (gesture.mode === 'move') {
      const rawDelta = timelinePointerDeltaBeats(x, gesture.startBeats, pixelsPerBeat);
      const minOriginalStart = Math.min(...gesture.originals.map((original) => original.startBeats));
      const boundedDelta = Math.max(-minOriginalStart, rawDelta);
      const delta = snapBeat(minOriginalStart + boundedDelta, 'nearest') - minOriginalStart;
      const currentGlobalLayer = findTimelineGlobalLayerAtY(
        allLayerGroups,
        y + gesture.startGroupYOffset,
        DEFAULT_ROW_HEIGHT,
        GROUP_SPACER,
      );
      const rawLayerAdjust = currentGlobalLayer - gesture.startGlobalLayer;
      const layerAdjust = Math.max(gesture.minLayerAdjust, Math.min(gesture.maxLayerAdjust, rawLayerAdjust));
      const moves = gesture.originals.flatMap((original) => {
        const target = gesture.globalLayerMap[original.globalLayerIndex + layerAdjust];
        return target ? [{
          objectId: original.objectId,
          targetStartBeats: original.startBeats + delta,
          targetLayerIndex: target.localIndex,
          targetGroupId: target.groupId,
        }] : [];
      });
      if (moves.length === 0) return;
      moveScoreObjects(moves);
      setPreviewByObjectId(Object.fromEntries(moves.map((move) => {
        const original = gesture.originals.find((entry) => entry.objectId === move.objectId)!;
        return [move.objectId, { startBeats: move.targetStartBeats, durationBeats: original.durationBeats }];
      })));
      pendingMovePatchRef.current = moves.flatMap((move) => {
        const target = gesture.originals.find((entry) => entry.objectId === move.objectId)?.editorTarget;
        return target ? [{ target, targetStartBeats: move.targetStartBeats, targetLayerIndex: move.targetLayerIndex, targetGroupId: move.targetGroupId }] : [];
      });
      return;
    }

    if (gesture.mode === 'resizeLeft' || gesture.mode === 'resizeRight') {
      const rawDelta = timelinePointerDeltaBeats(x, gesture.startBeats, pixelsPerBeat);
      let resizes: Array<{ objectId: string; targetStartBeats: number; targetDurationBeats: number }>;
      if (gesture.mode === 'resizeRight') {
        const referenceStart = gesture.resizeReferenceStartBeats ?? gesture.originals[0]!.startBeats;
        const referenceDuration = gesture.resizeReferenceDurationBeats ?? gesture.originals[0]!.durationBeats;
        const referenceEnd = referenceStart + referenceDuration;
        const snappedDelta = snapBeat(referenceEnd + rawDelta, 'nearest') - referenceEnd;
        resizes = gesture.originals.map((original) => ({
          objectId: original.objectId,
          targetStartBeats: original.startBeats,
          targetDurationBeats: Math.max(MIN_TRACK_ITEM_DURATION, original.durationBeats + snappedDelta),
        }));
      } else {
        const referenceStart = gesture.resizeReferenceStartBeats ?? gesture.originals[0]!.startBeats;
        const snappedDelta = snapBeat(referenceStart + rawDelta, 'nearest') - referenceStart;
        const minDelta = Math.max(...gesture.originals.map((original) => -original.startBeats));
        const maxDelta = Math.max(0, Math.min(...gesture.originals.map((original) => original.durationBeats - MIN_TRACK_ITEM_DURATION)));
        const delta = Math.max(minDelta, Math.min(maxDelta, snappedDelta));
        resizes = gesture.originals.map((original) => ({
          objectId: original.objectId,
          targetStartBeats: original.startBeats + delta,
          targetDurationBeats: original.durationBeats - delta,
        }));
      }
      resizeScoreObjects(resizes);
      setPreviewByObjectId(Object.fromEntries(resizes.map((resize) => [resize.objectId, {
        startBeats: resize.targetStartBeats,
        durationBeats: resize.targetDurationBeats,
      }])));
      resizes.forEach((resize) => pendingSharedPropertyPatchRef.current.set(resize.objectId, {
        startBeats: resize.targetStartBeats,
        durationBeats: resize.targetDurationBeats,
      }));
      return;
    }

    const active = gesture.originals[0];
    if (!active || !gesture.activeObjectId) return;
    const delta = (event.clientX - gesture.startClientX) / Math.max(pixelsPerBeat, 1);
    if (gesture.mode === 'slideFileStart') {
      let next = (gesture.startFileStartBeats ?? 0) - delta;
      const audioDuration = gesture.audioDurationBeats ?? 0;
      if (gesture.looping && audioDuration > 0) {
        while (next < 0) next += audioDuration;
        next %= audioDuration;
      } else {
        next = Math.max(0, Math.min(Math.max(audioDuration - active.durationBeats, 0), next));
      }
      setAudioPreviewByObjectId((previous) => ({ ...previous, [active.objectId]: { ...previous[active.objectId], fileStartTimeBeats: next } }));
      setAudioClipEditorPreview(active.objectId, { fileStartTime: beatsToSeconds(next) });
      pendingFileStartPatchRef.current.set(active.objectId, { fileStartTimeBeats: next });
      return;
    }
    if (gesture.mode === 'fadeIn') {
      const next = Math.max(0, Math.min(active.durationBeats - active.fadeOutBeats, (gesture.startFadeBeats ?? active.fadeInBeats) + delta));
      setAudioPreviewByObjectId((previous) => ({ ...previous, [active.objectId]: { ...previous[active.objectId], fadeInBeats: next } }));
      pendingFadePatchRef.current.set(active.objectId, { ...pendingFadePatchRef.current.get(active.objectId), fadeInBeats: next });
    } else if (gesture.mode === 'fadeOut') {
      const next = Math.max(0, Math.min(active.durationBeats - active.fadeInBeats, (gesture.startFadeBeats ?? active.fadeOutBeats) - delta));
      setAudioPreviewByObjectId((previous) => ({ ...previous, [active.objectId]: { ...previous[active.objectId], fadeOutBeats: next } }));
      pendingFadePatchRef.current.set(active.objectId, { ...pendingFadePatchRef.current.get(active.objectId), fadeOutBeats: next });
    }
  }, [allLayerGroups, beatsToSeconds, getDisplayItem, group.layers, moveScoreObjects, pixelsPerBeat, resizeScoreObjects, selectedObjectIds, setAudioClipEditorPreview, snapBeat, toLocalXY]);

  const handleMouseUp = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.mode === 'marquee') {
      const activeMarquee = marqueeRef.current ?? marquee;
      if (activeMarquee) {
        const left = Math.min(activeMarquee.startX, activeMarquee.endX) / pixelsPerBeat;
        const right = Math.max(activeMarquee.startX, activeMarquee.endX) / pixelsPerBeat;
        const top = Math.min(activeMarquee.startY, activeMarquee.endY);
        const bottom = Math.max(activeMarquee.startY, activeMarquee.endY);
        const currentGroupIndex = Math.max(0, allLayerGroups.findIndex((candidate) => candidate.groupId === group.groupId));
        const entries: Array<{ objectId: string; editorTarget?: ScoreObjectEditorTargetSnapshot }> = [];
        for (let groupIndex = 0; groupIndex < allLayerGroups.length; groupIndex += 1) {
          const candidateGroup = allLayerGroups[groupIndex]!;
          let yShift = 0;
          const low = Math.min(groupIndex, currentGroupIndex);
          const high = Math.max(groupIndex, currentGroupIndex);
          for (let index = low; index < high; index += 1) {
            const height = allLayerGroups[index]!.layers.reduce((sum, layer) => sum + (layer.height || DEFAULT_ROW_HEIGHT), 0) + GROUP_SPACER;
            yShift += groupIndex > currentGroupIndex ? height : -height;
          }
          let layerTop = 0;
          for (const layer of candidateGroup.layers) {
            const layerHeight = layer.height || DEFAULT_ROW_HEIGHT;
            for (const item of layer.items) {
              if (selectionIntersectsTimelineItem(item, layerTop, layerHeight, {
                left,
                right,
                top: top - yShift,
                bottom: bottom - yShift,
              })) entries.push({ objectId: item.objectId, editorTarget: item.editorTarget });
            }
            layerTop += layerHeight;
          }
        }
        if (gesture.additive) addToSelection(entries);
        else setSelection(entries);
      }
    } else if (gesture.mode === 'move' && pendingMovePatchRef.current.length > 0) {
      void applyProjectDocumentPatch({ score: { type: 'moveScoreObjects', moves: pendingMovePatchRef.current } });
    } else if ((gesture.mode === 'resizeLeft' || gesture.mode === 'resizeRight') && pendingSharedPropertyPatchRef.current.size > 0) {
      const pending = Array.from(pendingSharedPropertyPatchRef.current.entries());
      void (async () => {
        for (const [objectId, values] of pending) {
          const original = gesture.originals.find((entry) => entry.objectId === objectId);
          if (!original?.editorTarget) continue;
          await applyProjectDocumentPatch({
            score: {
              type: 'updateSharedProperties',
              target: original.editorTarget,
              patch: {
                startTime: { value: values.startBeats ?? original.startBeats, timeBase: original.startTimeBase },
                subjectiveDuration: { value: values.durationBeats ?? original.durationBeats, timeBase: original.durationTimeBase },
              },
            },
          });
        }
      })();
    } else if ((gesture.mode === 'fadeIn' || gesture.mode === 'fadeOut') && pendingFadePatchRef.current.size > 0) {
      const pending = Array.from(pendingFadePatchRef.current.entries());
      void (async () => {
        for (const [objectId, values] of pending) {
          const target = gesture.originals.find((entry) => entry.objectId === objectId)?.editorTarget;
          if (!target) continue;
          await applyProjectDocumentPatch({ score: { type: 'updateTypeSpecificEditor', target, patch: {
            ...(values.fadeInBeats !== undefined ? { fadeIn: beatsToSeconds(values.fadeInBeats) } : {}),
            ...(values.fadeOutBeats !== undefined ? { fadeOut: beatsToSeconds(values.fadeOutBeats) } : {}),
          } } });
        }
      })();
    } else if (gesture.mode === 'slideFileStart' && pendingFileStartPatchRef.current.size > 0) {
      const pending = Array.from(pendingFileStartPatchRef.current.entries());
      void (async () => {
        for (const [objectId, values] of pending) {
          const target = gesture.originals.find((entry) => entry.objectId === objectId)?.editorTarget;
          if (!target) continue;
          await applyProjectDocumentPatch({ score: { type: 'updateTypeSpecificEditor', target, patch: { fileStartTime: beatsToSeconds(values.fileStartTimeBeats) } } });
        }
      })();
    }

    pendingMovePatchRef.current = [];
    pendingSharedPropertyPatchRef.current.clear();
    pendingFadePatchRef.current.clear();
    pendingFileStartPatchRef.current.clear();
    clearPreview();
    marqueeRef.current = null;
    setMarquee(null);
    setCursorOverride(null);
    gestureRef.current = null;
  }, [addToSelection, allLayerGroups, applyProjectDocumentPatch, beatsToSeconds, clearPreview, group.groupId, marquee, pixelsPerBeat, setSelection]);

  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = toLocalXY(event.clientX, event.clientY);
    const hit = findTimelineHit(group.layers, x / pixelsPerBeat, y, pixelsPerBeat, DEFAULT_ROW_HEIGHT);
    if (!hit) return;
    if (hit.item.isContainer && onDoubleClickObject) {
      onDoubleClickObject(hit.item.objectId);
    } else {
      openPanel('ScoreObjectEditorTopComponent');
    }
  }, [group.layers, onDoubleClickObject, openPanel, pixelsPerBeat, toLocalXY]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      handleCopy();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      handleCut();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      handlePaste();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelection(group.layers.flatMap(collectTimelineLayerSelection));
    } else if (!event.metaKey && !event.ctrlKey && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      handleRemove();
    }
  }, [group.layers, handleCopy, handleCut, handlePaste, handleRemove, setSelection]);

  const handleSelectLayer = useCallback(() => {
    if (!contextMenuPos) return;
    const layer = group.layers[contextMenuPos.layerIndex];
    if (layer) setSelection(collectTimelineLayerSelection(layer));
  }, [contextMenuPos, group.layers, setSelection]);

  const handleSelectAllBefore = useCallback(() => {
    if (contextMenuPos) setSelection(collectTimelineBoundarySelection(allLayerGroups, contextMenuPos.xBeats, 'before'));
  }, [allLayerGroups, contextMenuPos, setSelection]);

  const handleSelectAllAfter = useCallback(() => {
    if (contextMenuPos) setSelection(collectTimelineBoundarySelection(allLayerGroups, contextMenuPos.xBeats, 'after'));
  }, [allLayerGroups, contextMenuPos, setSelection]);

  const handleFadeTypeSelect = useCallback((fadeType: AudioFadeType) => {
    if (!fadeContextMenu?.target) return;
    void applyProjectDocumentPatch({
      score: {
        type: 'updateTypeSpecificEditor',
        target: fadeContextMenu.target,
        patch: fadeContextMenu.side === 'fadeIn' ? { fadeInType: fadeType } : { fadeOutType: fadeType },
      },
    });
  }, [applyProjectDocumentPatch, fadeContextMenu]);

  const handleMouseMoveRef = useRef(handleMouseMove);
  handleMouseMoveRef.current = handleMouseMove;
  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (gestureRef.current) handleMouseMoveRef.current(event);
    };
    const onUp = () => {
      if (gestureRef.current) handleMouseUpRef.current();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // SPEC 076: accept a File Manager regular-file drag or one external OS
  // audio file, mapped to the layer under the pointer and the snapped start
  // beat. The typed main commit revalidates everything before mutating.
  const commitAudioFileDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    const blueAPI = window.blueAPI;
    if (!blueAPI?.commitAudioFileDrop || !blueAPI.getPathForFile) return;
    const source = readAudioDropSource(event.dataTransfer, (file) => blueAPI.getPathForFile(file));
    if (!source) return;
    if (!isCsoundAudioSourcePath(source.path)) {
      toast.error(`Unsupported audio source: ${source.path}`);
      return;
    }
    const { x, y } = toLocalXY(event.clientX, event.clientY);
    const layerHit = findTimelineLayerAtY(group.layers, y, DEFAULT_ROW_HEIGHT);
    const layer = layerHit ? group.layers[layerHit.layerIndex] : undefined;
    if (!layer) return;
    const startBeats = clampBeat(snapBeat(x / pixelsPerBeat, 'floor'), totalBeats);
    const result = await blueAPI.commitAudioFileDrop({
      sourcePath: source.path,
      sourceKind: source.kind,
      track: trackRef(group, layer.layerId, projectSessionId, projectRevision),
      startBeats,
    });
    if (result.status === 'rejected') {
      toast.error(result.message);
    }
  }, [clampBeat, group, pixelsPerBeat, projectRevision, projectSessionId, snapBeat, totalBeats]);

  const rows = useMemo(() => group.layers.map((layer) => ({
    layer,
    height: layer.height || DEFAULT_ROW_HEIGHT,
  })), [group.layers]);
  const selectedEntries = getSelectedEntries();
  const canArrangeSelection = selectedEntries.length > 1;
  const canSetObjectiveDuration = selectedEntries.length > 0
    && selectedEntries.every((entry) => entry.objectType !== 'AudioClip' && Boolean(entry.editorTarget));
  const canExport = selectedEntries.length === 1
    && selectedEntries[0]!.objectType !== 'AudioClip'
    && selectedEntries[0]!.objectType !== 'Instance'
    && Boolean(selectedEntries[0]!.serializedXml);
  return (
    <ContextMenu.Root onOpenChange={(open) => { if (!open) setContextMenuObjectId(null); }}>
      <ContextMenu.Trigger asChild>
        <div
          ref={containerRef}
          tabIndex={0}
          data-group-id={group.groupId}
          data-track-layer-group="true"
          className="relative select-none focus:outline-none"
          style={{
            minHeight: rows.reduce((height, row) => height + row.height, 0),
            width: contentWidth,
            ...(cursorOverride ? { cursor: cursorOverride } : {}),
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (!gestureRef.current) setCursorOverride(null);
            setHoveredAudioObjectId(null);
          }}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
          onDragOver={(event) => {
            if (!dataTransferMayCarryAudioDrop(event.dataTransfer)) return;
            const getPathForFile = window.blueAPI?.getPathForFile;
            if (!getPathForFile || !dataTransferCanAcceptAudioDrop(event.dataTransfer, getPathForFile)) return;
            const { y } = toLocalXY(event.clientX, event.clientY);
            if (!findTimelineLayerAtY(group.layers, y, DEFAULT_ROW_HEIGHT)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(event) => {
            if (!dataTransferMayCarryAudioDrop(event.dataTransfer)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            void commitAudioFileDrop(event);
          }}
          onContextMenu={(event) => {
            const { x, y } = toLocalXY(event.clientX, event.clientY);
            const hit = findTimelineHit(group.layers, x / pixelsPerBeat, y, pixelsPerBeat, DEFAULT_ROW_HEIGHT);
            const layerHit = findTimelineLayerAtY(group.layers, y, DEFAULT_ROW_HEIGHT);
            setContextMenuPos({
              xBeats: clampBeat(x / pixelsPerBeat, totalBeats),
              layerIndex: hit?.layerIndex ?? layerHit?.layerIndex ?? 0,
            });
            setContextMenuObjectId(hit?.item.objectId ?? null);
            setFadeContextMenu(null);
            if (hit) {
              const bounds = event.currentTarget.getBoundingClientRect();
              const rowHeight = hit.layer.height || DEFAULT_ROW_HEIGHT;
              colorPickerAnchorRef.current = {
                left: event.clientX,
                right: event.clientX,
                top: bounds.top + hit.layerTop,
                bottom: bounds.top + hit.layerTop + rowHeight,
              };
              const display = getDisplayItem(hit.item);
              if (display.barRenderer.kind === 'audioClip') {
                const relativeX = x - display.startBeats * pixelsPerBeat;
                const width = Math.max(display.durationBeats * pixelsPerBeat, 4);
                const fadeInWidth = display.barRenderer.fadeInBeats * pixelsPerBeat;
                const fadeOutWidth = display.barRenderer.fadeOutBeats * pixelsPerBeat;
                if (fadeInWidth > 0 && relativeX >= 0 && relativeX <= fadeInWidth) {
                  setFadeContextMenu({ objectId: hit.item.objectId, target: hit.item.editorTarget, side: 'fadeIn' });
                } else if (fadeOutWidth > 0 && relativeX >= width - fadeOutWidth && relativeX <= width) {
                  setFadeContextMenu({ objectId: hit.item.objectId, target: hit.item.editorTarget, side: 'fadeOut' });
                }
              }
            } else {
              colorPickerAnchorRef.current = null;
            }
            if (hit && !selectedObjectIds.has(hit.item.objectId)) {
              select(hit.item.objectId, false, hit.item.editorTarget);
            }
          }}
        >
          <ScoreObjectColorPicker ref={colorPickerRef} onSelect={handleColorSelected} />
          {rows.map(({ layer, height }, layerIndex) => {
            return (
              <div
                key={layer.layerId}
                className="relative border-b border-app-border/30"
                style={{ height, backgroundColor: 'var(--color-app-canvas)' }}
              >
                {layer.items.map((item) => {
                  const displayItem = getDisplayItem(item);
                  const width = Math.max(4, displayItem.durationBeats * pixelsPerBeat);
                  const left = displayItem.startBeats * pixelsPerBeat;
                  const audioBar = displayItem.barRenderer.kind === 'audioClip' ? displayItem.barRenderer : null;
                  const showFadeHandles = Boolean(audioBar && (
                    hoveredAudioObjectId === item.objectId || gestureRef.current?.activeObjectId === item.objectId
                  ));
                  const fadeInLeft = audioBar
                    ? Math.max(left, Math.min(left + width - FADE_HANDLE_SIZE, left + Math.round(audioBar.fadeInBeats * pixelsPerBeat)))
                    : 0;
                  const fadeOutLeft = audioBar
                    ? Math.max(left, Math.min(left + width - FADE_HANDLE_SIZE, left + width - Math.round(audioBar.fadeOutBeats * pixelsPerBeat) - FADE_HANDLE_SIZE))
                    : 0;
                  return (
                    <Fragment key={item.objectId}>
                      <RenderBar
                        item={displayItem}
                        selected={selectedObjectIds.has(item.objectId)}
                        pixelsPerBeat={pixelsPerBeat}
                        pixelsPerSecond={tempo > 0 ? pixelsPerBeat * tempo / 60 : pixelsPerBeat}
                        rowHeight={height}
                        durationBeats={displayItem.durationBeats}
                      />
                      {showFadeHandles && audioBar && (
                        <>
                          <div
                            data-fade-handle="in"
                            data-object-id={item.objectId}
                            style={{
                              position: 'absolute', left: fadeInLeft, top: 2,
                              width: FADE_HANDLE_SIZE, height: FADE_HANDLE_SIZE,
                              backgroundColor: 'var(--color-app-text-strong)',
                              boxShadow: FADE_HANDLE_OUTLINE, cursor: 'e-resize', zIndex: 3,
                            }}
                            onMouseDown={(event) => startFadeHandleDrag(event, item, layerIndex, 'fadeIn')}
                          />
                          <div
                            data-fade-handle="out"
                            data-object-id={item.objectId}
                            style={{
                              position: 'absolute', left: fadeOutLeft, top: 2,
                              width: FADE_HANDLE_SIZE, height: FADE_HANDLE_SIZE,
                              backgroundColor: 'var(--color-app-text-strong)',
                              boxShadow: FADE_HANDLE_OUTLINE, cursor: 'w-resize', zIndex: 3,
                            }}
                            onMouseDown={(event) => startFadeHandleDrag(event, item, layerIndex, 'fadeOut')}
                          />
                        </>
                      )}
                    </Fragment>
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
          {marquee && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: Math.min(marquee.startX, marquee.endX),
                top: Math.min(marquee.startY, marquee.endY),
                width: Math.abs(marquee.endX - marquee.startX),
                height: Math.abs(marquee.startY - marquee.endY),
                backgroundColor: 'color-mix(in srgb, var(--color-app-text-strong) 6%, var(--color-app-clear))',
                border: '1px solid color-mix(in srgb, var(--color-app-text-strong) 50%, var(--color-app-clear))',
              }}
            />
          )}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu">
          {fadeContextMenu ? (
            AUDIO_FADE_TYPE_OPTIONS.map((option) => (
              <ContextMenu.Item key={option.value} className="editor-context-menu__item" onSelect={() => handleFadeTypeSelect(option.value)}>
                {option.label}
              </ContextMenu.Item>
            ))
          ) : contextMenuObjectId && selectedObjectIds.size > 0 ? (
            <>
              <ContextMenu.Item className="editor-context-menu__item" disabled={clipboard.length !== 1} onSelect={handleReplaceWithBuffer}>
                Replace with SoundObject in Buffer
              </ContextMenu.Item>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" disabled={!canArrangeSelection} onSelect={handleFollowTheLeader}>
                Follow the Leader
              </ContextMenu.Item>
              <ContextMenu.Item className="editor-context-menu__item" disabled={!canArrangeSelection} onSelect={handleReverse}>
                Reverse
              </ContextMenu.Item>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger" disabled={!canArrangeSelection}>
                  <span>Align</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent className="editor-context-menu">
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={() => handleAlign('left')}>Align Left</ContextMenu.Item>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={() => handleAlign('center')}>Align Center</ContextMenu.Item>
                    <ContextMenu.Item className="editor-context-menu__item" onSelect={() => handleAlign('right')}>Align Right</ContextMenu.Item>
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
              <ContextMenu.Item className="editor-context-menu__item" onSelect={handleShift}>Shift…</ContextMenu.Item>
              <ContextMenu.Item className="editor-context-menu__item" disabled={!canSetObjectiveDuration} onSelect={handleSetSubjectiveToObjective}>
                Set Subjective Time to Objective Time
              </ContextMenu.Item>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" onSelect={handleCut}>
                Cut<span className="float-right text-blue-muted text-tiny ml-4">⌘X</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="editor-context-menu__item" onSelect={handleCopy}>
                Copy<span className="float-right text-blue-muted text-tiny ml-4">⌘C</span>
              </ContextMenu.Item>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" onSelect={handleRemove}>
                Remove<span className="float-right text-blue-muted text-tiny ml-4">Del</span>
              </ContextMenu.Item>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" onSelect={handleSetColor}>Set Color…</ContextMenu.Item>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" disabled={!canExport} onSelect={handleExport}>Export…</ContextMenu.Item>
            </>
          ) : (
            <>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger">
                  <span>Add SoundObject</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent className="editor-context-menu">
                    {TRACK_SOUND_OBJECT_TYPES.map((objectType) => (
                      <ContextMenu.Item
                        key={objectType}
                        className="editor-context-menu__item"
                        onSelect={() => addTrackItem(objectType, contextMenuPos?.xBeats ?? 0, contextMenuPos?.layerIndex ?? 0)}
                      >
                        {objectType}
                      </ContextMenu.Item>
                    ))}
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
              <ContextMenu.Item className="editor-context-menu__item" onSelect={() => addTrackItem('AudioClip', contextMenuPos?.xBeats ?? 0, contextMenuPos?.layerIndex ?? 0)}>
                Add AudioClip
              </ContextMenu.Item>
              {clipboard.length > 0 && (
                <ContextMenu.Item className="editor-context-menu__item" onSelect={handlePaste}>Paste
                </ContextMenu.Item>
              )}
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" disabled={!contextMenuPos} onSelect={handleSelectLayer}>Select Layer</ContextMenu.Item>
              <ContextMenu.Item className="editor-context-menu__item" disabled={!contextMenuPos} onSelect={handleSelectAllBefore}>Select All Before</ContextMenu.Item>
              <ContextMenu.Item className="editor-context-menu__item" disabled={!contextMenuPos} onSelect={handleSelectAllAfter}>Select All After</ContextMenu.Item>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Item className="editor-context-menu__item" disabled={!contextMenuPos} onSelect={handleImport}>Import…</ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
      {showShiftDialog && (
        <ShiftObjectsDialog
          onConfirm={handleConfirmShift}
          onClose={() => setShowShiftDialog(false)}
          minStartBeats={minStartBeats}
        />
      )}
    </ContextMenu.Root>
  );
}
