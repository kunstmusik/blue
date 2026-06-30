import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  AudioClip,
  Element,
  TimeDuration,
  TimePosition,
  snapValueToBeats,
} from '@blue/data';
import type {
  AudioFadeType,
  AudioLayerGroupSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreLayerSnapshot,
  ScoreRowObjectSnapshot,
} from '../types';
import { DEFAULT_ROW_HEIGHT, GROUP_SPACER } from '../types';
import { RenderBar } from '../bar-renderers/renderer-registry';
import { snapBeatToGrid } from '../snap-grid-utils';
import {
  collectClipboardEntriesForSelection,
  groupPasteObjectsByTargetGroup,
  layerGroupAcceptsObjectType,
  translateClipboardEntriesForPaste,
  type ScorePasteObject,
} from './score-clipboard-utils';
import type {
  MeterMapSnapshot,
  ScoreObjectEditorTargetSnapshot,
} from '../../../../../../shared/project-editor';
import { useScoreSelectionStore } from '../../../../../stores/score-selection-store';
import { useProjectStore } from '../../../../../stores/project-store';
import AutomationLayerOverlay from '../automation/AutomationLayerOverlay';
import { useScoreAutomationStore } from '../../../../../stores/score-automation-store';
import type { ScoreAutomationPatch } from '../../../../../../shared/project-editor';
import { useKeyboardShortcutScope } from '../../../../../hooks/use-keyboard-shortcut-scope';
import { isTextEditingTarget } from '../../../../../hooks/use-keyboard-shortcuts';
import { toast } from 'sonner';

interface Props {
  group: AudioLayerGroupSnapshot;
  rootGroupIndex?: number;
  allLayerGroups: ScoreLayerGroupSnapshot[];
  mode?: 'score' | 'singleLine' | 'multiLine';
  totalBeats: number;
  pixelsPerBeat: number;
  snapEnabled: boolean;
  snapValue: import('@blue/data').SnapValueName;
  tempo: number;
  smpteFrameRate: number;
  meterMap: MeterMapSnapshot;
}

const DEFAULT_AUDIO_CLIP_BG = 0x669966;
const DEFAULT_SAMPLE_RATE = 44100;
const RESIZE_EDGE_PX = 5;
const FADE_HANDLE_SIZE = 5;
const FADE_HANDLE_OUTLINE = '0 0 0 1px #000000';
const MIN_AUDIO_CLIP_DURATION = 0.25;

type GestureMode = 'none' | 'marquee' | 'move' | 'resizeLeft' | 'resizeRight' | 'fadeIn' | 'fadeOut' | 'slideFileStart';

interface FadeContextMenuState {
  objectId: string;
  target?: ScoreObjectEditorTargetSnapshot;
  side: 'fadeIn' | 'fadeOut';
}

const AUDIO_FADE_TYPE_OPTIONS: Array<{ value: AudioFadeType; label: string }> = [
  { value: 'LINEAR', label: 'Linear' },
  { value: 'CONSTANT_POWER', label: 'Constant Power' },
  { value: 'SYMMETRIC', label: 'Symmetric' },
  { value: 'FAST', label: 'Fast' },
  { value: 'SLOW', label: 'Slow' },
];

interface AudioClipPreview {
  fadeInBeats?: number;
  fadeOutBeats?: number;
  fileStartTimeBeats?: number;
}

interface SelectedAudioPosition {
  objectId: string;
  objectType: string;
  startBeats: number;
  durationBeats: number;
  layerIndex: number;
  groupId: string;
  globalLayerIndex: number;
  editorTarget?: ScoreObjectEditorTargetSnapshot;
  startTimeBase?: string;
  durationTimeBase?: string;
  fadeInBeats: number;
  fadeOutBeats: number;
}

function splitLabelLines(value: string): string[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [''];
}

function normalizeAudioFadeType(value: string | null | undefined): AudioFadeType {
  switch ((value ?? '').trim().toUpperCase().replace(/\s+/g, '_')) {
    case 'CONSTANT_POWER':
      return 'CONSTANT_POWER';
    case 'SYMMETRIC':
      return 'SYMMETRIC';
    case 'FAST':
      return 'FAST';
    case 'SLOW':
      return 'SLOW';
    case 'LINEAR':
    default:
      return 'LINEAR';
  }
}

function getFileName(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return 'AudioClip';
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || 'AudioClip';
}

function findItemOnLayer(
  layer: ScoreLayerSnapshot,
  xBeats: number,
  pixelsPerBeat: number,
): ScoreRowObjectSnapshot | null {
  const minimumHitDuration = 4 / Math.max(pixelsPerBeat, 1);
  for (let i = layer.items.length - 1; i >= 0; i--) {
    const item = layer.items[i]!;
    const endBeats = item.startBeats + Math.max(item.durationBeats, minimumHitDuration);
    if (xBeats >= item.startBeats && xBeats <= endBeats) {
      return item;
    }
  }
  return null;
}

function findLayerAtY(
  layers: ScoreLayerSnapshot[],
  localY: number,
): { layer: ScoreLayerSnapshot; index: number } | null {
  let yOffset = 0;
  for (let i = 0; i < layers.length; i++) {
    const height = layers[i]!.height || DEFAULT_ROW_HEIGHT;
    if (localY >= yOffset && localY < yOffset + height) {
      return { layer: layers[i]!, index: i };
    }
    yOffset += height;
  }
  return null;
}

function buildGlobalLayerData(layerGroups: ScoreLayerGroupSnapshot[]): {
  layerMap: Array<{ groupId: string; localIndex: number; groupType: ScoreLayerGroupSnapshot['groupType'] }>;
  groupStartIndexById: Map<string, number>;
  groupYOffsetById: Map<string, number>;
} {
  const layerMap: Array<{ groupId: string; localIndex: number; groupType: ScoreLayerGroupSnapshot['groupType'] }> = [];
  const groupStartIndexById = new Map<string, number>();
  const groupYOffsetById = new Map<string, number>();

  let yOffset = 0;
  for (const layerGroup of layerGroups) {
    groupStartIndexById.set(layerGroup.groupId, layerMap.length);
    groupYOffsetById.set(layerGroup.groupId, yOffset);

    for (let localIndex = 0; localIndex < layerGroup.layers.length; localIndex += 1) {
      layerMap.push({
        groupId: layerGroup.groupId,
        localIndex,
        groupType: layerGroup.groupType,
      });
      yOffset += layerGroup.layers[localIndex]!.height || DEFAULT_ROW_HEIGHT;
    }

    yOffset += GROUP_SPACER;
  }

  return { layerMap, groupStartIndexById, groupYOffsetById };
}

function getGlobalLayerIndexForY(layerGroups: ScoreLayerGroupSnapshot[], y: number): number {
  let runningY = 0;
  let runningIndex = 0;
  const totalLayers = layerGroups.reduce((sum, layerGroup) => sum + layerGroup.layers.length, 0);

  for (const layerGroup of layerGroups) {
    for (const layer of layerGroup.layers) {
      const height = layer.height || DEFAULT_ROW_HEIGHT;
      if (y <= runningY + height) {
        return runningIndex;
      }
      runningY += height;
      runningIndex += 1;
    }

    if (runningIndex < totalLayers && y <= runningY + GROUP_SPACER) {
      return runningIndex;
    }

    runningY += GROUP_SPACER;
  }

  return Math.max(totalLayers - 1, 0);
}

function getLayerAdjustBoundsForObjectType(
  layerMap: Array<{ groupType: ScoreLayerGroupSnapshot['groupType'] }>,
  objectType: string,
  startLayerIndex: number,
): { min: number; max: number } {
  let min = -startLayerIndex;
  for (let index = startLayerIndex - 1; index >= 0; index -= 1) {
    if (layerGroupAcceptsObjectType(layerMap[index]!.groupType, objectType)) {
      continue;
    }
    min = index + 1 - startLayerIndex;
    break;
  }

  let max = layerMap.length - 1 - startLayerIndex;
  for (let index = startLayerIndex + 1; index < layerMap.length; index += 1) {
    if (layerGroupAcceptsObjectType(layerMap[index]!.groupType, objectType)) {
      continue;
    }
    max = index - 1 - startLayerIndex;
    break;
  }

  return { min, max };
}

function collectLayerSelectionEntries(
  layer: ScoreLayerSnapshot,
): Array<{ objectId: string; editorTarget?: ScoreRowObjectSnapshot['editorTarget'] }> {
  return layer.items.map((item) => ({ objectId: item.objectId, editorTarget: item.editorTarget }));
}

function collectBoundarySelectionEntries(
  groups: ScoreLayerGroupSnapshot[],
  xBeats: number,
  mode: 'before' | 'after',
): Array<{ objectId: string; editorTarget?: ScoreRowObjectSnapshot['editorTarget'] }> {
  const entries: Array<{ objectId: string; editorTarget?: ScoreRowObjectSnapshot['editorTarget'] }> = [];

  for (const group of groups) {
    for (const layer of group.layers) {
      for (const item of layer.items) {
        const itemEnd = item.startBeats + item.durationBeats;
        const include = mode === 'before'
          ? itemEnd <= xBeats
          : item.startBeats >= xBeats;
        if (include) {
          entries.push({ objectId: item.objectId, editorTarget: item.editorTarget });
        }
      }
    }
  }

  return entries;
}

function createAudioClipBarRenderer(
  clip: AudioClip,
  secondsToBeats: (seconds: number) => number,
  displayName?: string,
): ScoreRowObjectSnapshot['barRenderer'] {
  const audioFilePath = clip.getAudioFile();
  return {
    kind: 'audioClip',
    labelLines: splitLabelLines(displayName ?? clip.getName()),
    audioFilePath,
    waveformKey: audioFilePath ? `aclp:${audioFilePath}` : null,
    fileStartTimeBeats: secondsToBeats(clip.getFileStartTime()),
    audioDurationBeats: secondsToBeats(clip.getAudioDuration()),
    looping: clip.isLooping(),
    fadeInBeats: secondsToBeats(clip.getFadeIn()),
    fadeInType: normalizeAudioFadeType(String(clip.getFadeInType())),
    fadeOutBeats: secondsToBeats(clip.getFadeOut()),
    fadeOutType: normalizeAudioFadeType(String(clip.getFadeOutType())),
  };
}

function createAudioClipFromSerializedXml(serializedXml?: string): AudioClip | null {
  if (!serializedXml) {
    return null;
  }

  try {
    const parsed = Element.parse(serializedXml);
    if (parsed.getName() !== 'audioClip') {
      return null;
    }
    return AudioClip.loadFromXML(parsed);
  } catch {
    return null;
  }
}

function decodeDroppedPath(rawValue: string): string {
  const firstLine = rawValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'));

  if (!firstLine) {
    return '';
  }

  if (firstLine.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(firstLine).pathname);
    } catch {
      return decodeURIComponent(firstLine.substring(7));
    }
  }

  return firstLine;
}

function getDroppedFilePath(dataTransfer: DataTransfer): string {
  const droppedFile = dataTransfer.files[0] as (File & { path?: string }) | undefined;
  const directPath = droppedFile?.path?.trim() || droppedFile?.name?.trim() || '';
  if (directPath) {
    return directPath;
  }

  const uriList = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
  return decodeDroppedPath(uriList);
}

async function readAudioFileMetadata(file: File): Promise<{ durationSeconds: number; numChannels: number } | null> {
  const AudioContextCtor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor || typeof file.arrayBuffer !== 'function') {
    return null;
  }

  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
    return {
      durationSeconds: decoded.duration,
      numChannels: decoded.numberOfChannels,
    };
  } catch {
    return null;
  } finally {
    if (typeof audioContext.close === 'function') {
      void audioContext.close().catch(() => undefined);
    }
  }
}

export default function AudioLayerGroupCanvas({
  group,
  allLayerGroups,
  mode = 'score',
  totalBeats,
  pixelsPerBeat,
  snapEnabled,
  snapValue,
  tempo,
  smpteFrameRate,
  meterMap,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ xBeats: number; layerIndex: number } | null>(null);
  const [fadeContextMenu, setFadeContextMenu] = useState<FadeContextMenuState | null>(null);
  const gestureRef = useRef<{
    mode: GestureMode;
    startClientX: number;
    startClientY: number;
    startBeats: number;
    startLayerIndex: number;
    startGlobalLayer?: number;
    startGroupYOffset?: number;
    minLayerAdjust: number;
    maxLayerAdjust: number;
    originalPositions: SelectedAudioPosition[];
    globalLayerMap?: Array<{ groupId: string; localIndex: number }>;
    activeObjectId?: string;
    startFadeBeats?: number;
    startFileStartBeats?: number;
    audioDurationBeats?: number;
    looping?: boolean;
    resizeReferenceStartBeats?: number;
    resizeReferenceDurationBeats?: number;
    additive?: boolean;
  } | null>(null);
  const pendingMovePatchRef = useRef<Array<{
    target: ScoreObjectEditorTargetSnapshot;
    targetStartBeats: number;
    targetLayerIndex: number;
    targetGroupId: string;
  }>>([]);
  const pendingSharedPropertyPatchRef = useRef<Map<string, { startBeats?: number; durationBeats?: number }>>(new Map());
  const pendingFadePatchRef = useRef<Map<string, { fadeInBeats?: number; fadeOutBeats?: number }>>(new Map());
  const pendingFileStartPatchRef = useRef<Map<string, { fileStartTimeBeats: number }>>(new Map());
  const [cursorOverride, setCursorOverride] = useState<string | null>(null);
  const [hoveredAudioObjectId, setHoveredAudioObjectId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const marqueeRef = useRef<typeof marquee>(null);
  const [audioPreviewByObjectId, setAudioPreviewByObjectId] = useState<Record<string, AudioClipPreview>>({});

  const selectedObjectIds = useScoreSelectionStore((state) => state.selectedObjectIds);
  const multiLineObjectPreview = useScoreAutomationStore((s) => s.multiLineObjectPreview);
  const selectedObjectTargets = useScoreSelectionStore((state) => state.selectedObjectTargets);
  const clipboard = useScoreSelectionStore((state) => state.clipboard);
  const select = useScoreSelectionStore((state) => state.select);
  const clearSelection = useScoreSelectionStore((state) => state.clearSelection);
  const setSelection = useScoreSelectionStore((state) => state.setSelection);
  const copySelected = useScoreSelectionStore((state) => state.copySelected);

  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
  const addScoreObjects = useProjectStore((state) => state.addScoreObjects);
  const moveScoreObjects = useProjectStore((state) => state.moveScoreObjects);
  const removeScoreObjects = useProjectStore((state) => state.removeScoreObjects);
  const resizeScoreObjects = useProjectStore((state) => state.resizeScoreObjects);
  const setAudioClipEditorPreview = useProjectStore((state) => state.setAudioClipEditorPreview);
  const clearAudioClipEditorPreview = useProjectStore((state) => state.clearAudioClipEditorPreview);

  const secondsToBeatValue = useCallback((seconds: number): number => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }
    return tempo > 0 ? seconds * (tempo / 60) : seconds;
  }, [tempo]);

  const beatsToSecondsValue = useCallback((beats: number): number => {
    if (!Number.isFinite(beats) || beats <= 0) {
      return 0;
    }
    return tempo > 0 ? beats * (60 / tempo) : beats;
  }, [tempo]);

  const snapBeats = snapEnabled
    ? snapValueToBeats(snapValue, tempo, smpteFrameRate, DEFAULT_SAMPLE_RATE, pixelsPerBeat)
    : 0;
  const pixelsPerSecond = tempo > 0 ? pixelsPerBeat * (tempo / 60) : pixelsPerBeat;

  const snapBeatValueStart = useCallback((beats: number): number => {
    if (!snapEnabled || snapBeats <= 0) {
      return beats;
    }
    return snapBeatToGrid(beats, 'floor', snapValue, snapBeats, meterMap);
  }, [meterMap, snapBeats, snapEnabled, snapValue]);

  const snapBeatValueMove = useCallback((beats: number): number => {
    if (!snapEnabled || snapBeats <= 0) {
      return beats;
    }
    return snapBeatToGrid(beats, 'nearest', snapValue, snapBeats, meterMap);
  }, [meterMap, snapBeats, snapEnabled, snapValue]);

  const toLocalXY = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    if (!containerRef.current) {
      return { x: 0, y: 0 };
    }
    const rect = containerRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const getDisplayItem = useCallback((item: ScoreRowObjectSnapshot): ScoreRowObjectSnapshot => {
    const preview = audioPreviewByObjectId[item.objectId];
    if (!preview || item.barRenderer.kind !== 'audioClip') {
      return item;
    }

    return {
      ...item,
      barRenderer: {
        ...item.barRenderer,
        fileStartTimeBeats: preview.fileStartTimeBeats ?? item.barRenderer.fileStartTimeBeats,
        fadeInBeats: preview.fadeInBeats ?? item.barRenderer.fadeInBeats,
        fadeOutBeats: preview.fadeOutBeats ?? item.barRenderer.fadeOutBeats,
      },
    };
  }, [audioPreviewByObjectId]);

  const findEditorTarget = useCallback((objectId: string): ScoreObjectEditorTargetSnapshot | undefined => {
    const fromSelection = selectedObjectTargets[objectId];
    if (fromSelection) {
      return fromSelection;
    }

    for (const layer of group.layers) {
      const item = layer.items.find((candidate) => candidate.objectId === objectId);
      if (item?.editorTarget) {
        return item.editorTarget;
      }
    }

    return undefined;
  }, [group.layers, selectedObjectTargets]);

  const collectSelectedPositions = useCallback((
    primaryItem: ScoreRowObjectSnapshot,
    groupStartIndexById: Map<string, number>,
  ): SelectedAudioPosition[] => {
    const selectedIds = selectedObjectIds.has(primaryItem.objectId)
      ? new Set(selectedObjectIds)
      : new Set([primaryItem.objectId]);
    const positions: SelectedAudioPosition[] = [];

    allLayerGroups.forEach((layerGroup) => {
      const groupStartIndex = groupStartIndexById.get(layerGroup.groupId) ?? 0;
      layerGroup.layers.forEach((layer, layerIndex) => {
        layer.items.forEach((candidate) => {
          if (!selectedIds.has(candidate.objectId)) {
            return;
          }

          const display = getDisplayItem(candidate);
          positions.push({
            objectId: candidate.objectId,
            objectType: candidate.objectType,
            startBeats: display.startBeats,
            durationBeats: display.durationBeats,
            layerIndex,
            groupId: layerGroup.groupId,
            globalLayerIndex: groupStartIndex + layerIndex,
            editorTarget: candidate.editorTarget,
            startTimeBase: candidate.startTimeBase,
            durationTimeBase: candidate.durationTimeBase,
            fadeInBeats: display.barRenderer.kind === 'audioClip' ? display.barRenderer.fadeInBeats : 0,
            fadeOutBeats: display.barRenderer.kind === 'audioClip' ? display.barRenderer.fadeOutBeats : 0,
          });
        });
      });
    });

    if (positions.length === 0) {
      const display = getDisplayItem(primaryItem);
      const layerIndex = primaryItem.editorTarget?.location?.layerIndex ?? 0;
      const groupStartIndex = groupStartIndexById.get(group.groupId) ?? 0;
      positions.push({
        objectId: primaryItem.objectId,
        objectType: primaryItem.objectType,
        startBeats: display.startBeats,
        durationBeats: display.durationBeats,
        layerIndex,
        groupId: group.groupId,
        globalLayerIndex: groupStartIndex + layerIndex,
        editorTarget: primaryItem.editorTarget,
        startTimeBase: primaryItem.startTimeBase,
        durationTimeBase: primaryItem.durationTimeBase,
        fadeInBeats: display.barRenderer.kind === 'audioClip' ? display.barRenderer.fadeInBeats : 0,
        fadeOutBeats: display.barRenderer.kind === 'audioClip' ? display.barRenderer.fadeOutBeats : 0,
      });
    }

    return positions;
  }, [allLayerGroups, getDisplayItem, group.groupId, selectedObjectIds]);

  useEffect(() => {
    if (Object.keys(audioPreviewByObjectId).length === 0) {
      return;
    }

    const currentValues = new Map<string, { fileStartTimeBeats: number; fadeInBeats: number; fadeOutBeats: number }>();
    for (const layer of group.layers) {
      for (const item of layer.items) {
        if (item.barRenderer.kind !== 'audioClip') {
          continue;
        }
        currentValues.set(item.objectId, {
          fileStartTimeBeats: item.barRenderer.fileStartTimeBeats,
          fadeInBeats: item.barRenderer.fadeInBeats,
          fadeOutBeats: item.barRenderer.fadeOutBeats,
        });
      }
    }

    const idsToClear: string[] = [];
    for (const [objectId, preview] of Object.entries(audioPreviewByObjectId)) {
      const current = currentValues.get(objectId);
      if (!current) {
        idsToClear.push(objectId);
        continue;
      }

      const fileStartMatches = preview.fileStartTimeBeats === undefined
        || Math.abs(current.fileStartTimeBeats - preview.fileStartTimeBeats) < 1e-6;
      const fadeInMatches = preview.fadeInBeats === undefined
        || Math.abs(current.fadeInBeats - preview.fadeInBeats) < 1e-6;
      const fadeOutMatches = preview.fadeOutBeats === undefined
        || Math.abs(current.fadeOutBeats - preview.fadeOutBeats) < 1e-6;
      if (fileStartMatches && fadeInMatches && fadeOutMatches) {
        idsToClear.push(objectId);
      }
    }

    if (idsToClear.length === 0) {
      return;
    }

    setAudioPreviewByObjectId((prev) => {
      const next = { ...prev };
      idsToClear.forEach((objectId) => {
        delete next[objectId];
      });
      return next;
    });
    idsToClear.forEach((objectId) => {
      clearAudioClipEditorPreview(objectId);
    });
  }, [audioPreviewByObjectId, clearAudioClipEditorPreview, group.layers]);

  const handleCopy = useCallback(() => {
    const entries = collectClipboardEntriesForSelection(allLayerGroups, selectedObjectIds);
    if (entries.length === 0) {
      return;
    }
    copySelected(entries);
  }, [allLayerGroups, copySelected, selectedObjectIds]);

  const handleRemove = useCallback(() => {
    if (selectedObjectIds.size === 0) {
      return;
    }
    removeScoreObjects(new Set(selectedObjectIds));
    clearSelection();
  }, [clearSelection, removeScoreObjects, selectedObjectIds]);

  const handleCut = useCallback(() => {
    const entries = collectClipboardEntriesForSelection(allLayerGroups, selectedObjectIds);
    if (entries.length === 0) {
      return;
    }
    copySelected(entries);
    removeScoreObjects(new Set(entries.map((entry) => entry.objectId)));
    clearSelection();
  }, [allLayerGroups, clearSelection, copySelected, removeScoreObjects, selectedObjectIds]);

  const pasteClipboardAt = useCallback((targetLayerIndex: number, targetXBeats: number) => {
    if (clipboard.length === 0) {
      return false;
    }
    const paste = translateClipboardEntriesForPaste({
      clipboard,
      layerGroups: allLayerGroups,
      targetGroupId: group.groupId,
      targetLayerIndex,
      targetXBeats,
      snapBeatValue: snapBeatValueStart,
    });
    if (!paste.ok) {
      toast.error(paste.message);
      return false;
    }

    const translated: ScorePasteObject[] = paste.entries.map(({ source, object }) => {
      if (object.objectType !== 'AudioClip') {
        return object;
      }
      const clip = createAudioClipFromSerializedXml(source.serializedXml);
      return {
        ...object,
        barRenderer: clip ? createAudioClipBarRenderer(clip, secondsToBeatValue, source.name) : {
          kind: 'audioClip' as const,
          labelLines: splitLabelLines(source.name),
          audioFilePath: '',
          waveformKey: null,
          fileStartTimeBeats: 0,
          audioDurationBeats: 0,
          looping: true,
          fadeInBeats: 0,
          fadeInType: 'LINEAR' as const,
          fadeOutBeats: 0,
          fadeOutType: 'LINEAR' as const,
        },
      };
    });

    for (const objects of groupPasteObjectsByTargetGroup(translated)) {
      addScoreObjects(objects);
    }
    return true;
  }, [addScoreObjects, allLayerGroups, clipboard, group.groupId, secondsToBeatValue, snapBeatValueStart]);

  const handlePaste = useCallback(() => {
    if (!contextMenuPos) {
      return;
    }
    pasteClipboardAt(contextMenuPos.layerIndex, contextMenuPos.xBeats);
  }, [contextMenuPos, pasteClipboardAt]);

  const handleSelectLayer = useCallback(() => {
    if (!contextMenuPos) {
      return;
    }
    const layer = group.layers[contextMenuPos.layerIndex];
    if (!layer) {
      return;
    }
    setSelection(collectLayerSelectionEntries(layer));
  }, [contextMenuPos, group.layers, setSelection]);

  const handleSelectAllBefore = useCallback(() => {
    if (!contextMenuPos) {
      return;
    }
    setSelection(collectBoundarySelectionEntries(allLayerGroups, contextMenuPos.xBeats, 'before'));
  }, [allLayerGroups, contextMenuPos, setSelection]);

  const handleSelectAllAfter = useCallback(() => {
    if (!contextMenuPos) {
      return;
    }
    setSelection(collectBoundarySelectionEntries(allLayerGroups, contextMenuPos.xBeats, 'after'));
  }, [allLayerGroups, contextMenuPos, setSelection]);

  const handleFadeTypeSelect = useCallback((fadeType: AudioFadeType) => {
    if (!fadeContextMenu) {
      return;
    }

    const target = fadeContextMenu.target ?? findEditorTarget(fadeContextMenu.objectId);
    if (!target) {
      return;
    }

    void applyProjectDocumentPatch({
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: fadeContextMenu.side === 'fadeIn'
          ? { fadeInType: fadeType }
          : { fadeOutType: fadeType },
      },
    });
  }, [applyProjectDocumentPatch, fadeContextMenu, findEditorTarget]);

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTextEditingTarget(event.target)) {
      return;
    }

    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (mod && key === 'c') {
      event.preventDefault();
      event.stopPropagation();
      handleCopy();
      return;
    }

    if (mod && key === 'x') {
      event.preventDefault();
      event.stopPropagation();
      handleCut();
      return;
    }

    if (mod && key === 'v') {
      event.preventDefault();
      event.stopPropagation();
      handlePaste();
      return;
    }

    if (!mod && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      event.stopPropagation();
      handleRemove();
    }
  }, [handleCopy, handleCut, handlePaste, handleRemove]);

  const canvasShortcutScope = useKeyboardShortcutScope({
    ref: containerRef,
    onKeyDown: handleCanvasKeyDown,
  });

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      return;
    }

    const { x, y } = toLocalXY(event.clientX, event.clientY);
    const xBeats = x / pixelsPerBeat;
    const hit = findLayerAtY(group.layers, y);
    if (!hit) {
      if (!(event.metaKey || event.ctrlKey)) {
        clearSelection();
      }
      gestureRef.current = null;
      return;
    }

    setContextMenuPos({ xBeats, layerIndex: hit.index });

    const item = findItemOnLayer(hit.layer, xBeats, pixelsPerBeat);
    if (!item) {
      if ((event.metaKey || event.ctrlKey) && clipboard.length > 0) {
        pasteClipboardAt(hit.index, xBeats);
        gestureRef.current = null;
        return;
      }
      if (!event.shiftKey) {
        clearSelection();
      }
      gestureRef.current = {
        mode: 'marquee',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startBeats: 0,
        startLayerIndex: hit.index,
        minLayerAdjust: 0,
        maxLayerAdjust: 0,
        originalPositions: [],
        additive: event.shiftKey,
      };
      marqueeRef.current = null;
      setMarquee(null);
      return;
    }

    const isMeta = event.metaKey || event.ctrlKey;
    if (isMeta || event.shiftKey) {
      select(item.objectId, true, item.editorTarget);
      gestureRef.current = null;
      return;
    }

    if (!selectedObjectIds.has(item.objectId)) {
      select(item.objectId, false, item.editorTarget);
    }

    const displayItem = getDisplayItem(item);
    if (event.altKey && !event.shiftKey && displayItem.barRenderer.kind === 'audioClip') {
      if (!selectedObjectIds.has(item.objectId) || selectedObjectIds.size !== 1) {
        select(item.objectId, false, item.editorTarget);
      }

      gestureRef.current = {
        mode: 'slideFileStart',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startBeats: displayItem.startBeats,
        startLayerIndex: hit.index,
        minLayerAdjust: 0,
        maxLayerAdjust: 0,
        originalPositions: [{
          objectId: item.objectId,
          objectType: item.objectType,
          startBeats: displayItem.startBeats,
          durationBeats: displayItem.durationBeats,
          layerIndex: hit.index,
          groupId: group.groupId,
          globalLayerIndex: hit.index,
          editorTarget: item.editorTarget,
          startTimeBase: item.startTimeBase,
          durationTimeBase: item.durationTimeBase,
          fadeInBeats: displayItem.barRenderer.fadeInBeats,
          fadeOutBeats: displayItem.barRenderer.fadeOutBeats,
        }],
        activeObjectId: item.objectId,
        startFileStartBeats: displayItem.barRenderer.fileStartTimeBeats,
        audioDurationBeats: displayItem.barRenderer.audioDurationBeats,
        looping: displayItem.barRenderer.looping,
      };
      return;
    }

    const itemLeft = displayItem.startBeats * pixelsPerBeat;
    const itemWidth = Math.max(displayItem.durationBeats * pixelsPerBeat, 4);
    const localX = x - itemLeft;
    const onLeftEdge = selectedObjectIds.has(item.objectId) && localX >= 0 && localX < RESIZE_EDGE_PX;
    const onRightEdge = selectedObjectIds.has(item.objectId)
      && localX > itemWidth - RESIZE_EDGE_PX
      && localX <= itemWidth;
    const { layerMap, groupStartIndexById, groupYOffsetById } = buildGlobalLayerData(allLayerGroups);
    const globalLayerMap = layerMap.map(({ groupId, localIndex }) => ({ groupId, localIndex }));
    const currentGroupGlobalStart = groupStartIndexById.get(group.groupId) ?? 0;
    const currentGroupYOffset = groupYOffsetById.get(group.groupId) ?? 0;
    const startGlobalLayer = currentGroupGlobalStart + hit.index;
    const originalPositions = collectSelectedPositions(item, groupStartIndexById);

    if (originalPositions.length === 0) {
      gestureRef.current = null;
      return;
    }

    let minLayerAdjust = 0;
    let maxLayerAdjust = 0;
    if (!onLeftEdge && !onRightEdge) {
      minLayerAdjust = Number.NEGATIVE_INFINITY;
      maxLayerAdjust = Number.POSITIVE_INFINITY;
      for (const position of originalPositions) {
        const bounds = getLayerAdjustBoundsForObjectType(
          layerMap,
          position.objectType,
          position.globalLayerIndex,
        );
        minLayerAdjust = Math.max(minLayerAdjust, bounds.min);
        maxLayerAdjust = Math.min(maxLayerAdjust, bounds.max);
      }
      if (!Number.isFinite(minLayerAdjust)) {
        minLayerAdjust = 0;
      }
      if (!Number.isFinite(maxLayerAdjust)) {
        maxLayerAdjust = 0;
      }
    }

    gestureRef.current = {
      mode: onLeftEdge ? 'resizeLeft' : onRightEdge ? 'resizeRight' : 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBeats: xBeats,
      startLayerIndex: hit.index,
      startGlobalLayer,
      startGroupYOffset: currentGroupYOffset,
      minLayerAdjust,
      maxLayerAdjust,
      originalPositions,
      globalLayerMap,
      resizeReferenceStartBeats: displayItem.startBeats,
      resizeReferenceDurationBeats: displayItem.durationBeats,
    };
  }, [allLayerGroups, clearSelection, clipboard.length, collectSelectedPositions, getDisplayItem, group.groupId, group.layers, pasteClipboardAt, pixelsPerBeat, select, selectedObjectIds, toLocalXY]);

  const startFadeHandleDrag = useCallback((
    event: React.MouseEvent<HTMLDivElement>,
    item: ScoreRowObjectSnapshot,
    layerIndex: number,
    mode: 'fadeIn' | 'fadeOut',
  ) => {
    if (event.button === 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!selectedObjectIds.has(item.objectId) || selectedObjectIds.size !== 1) {
      select(item.objectId, false, item.editorTarget);
    }

    const displayItem = getDisplayItem(item);
    if (displayItem.barRenderer.kind !== 'audioClip') {
      return;
    }

    gestureRef.current = {
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBeats: displayItem.startBeats,
      startLayerIndex: layerIndex,
      minLayerAdjust: 0,
      maxLayerAdjust: 0,
      originalPositions: [{
        objectId: item.objectId,
        objectType: item.objectType,
        startBeats: displayItem.startBeats,
        durationBeats: displayItem.durationBeats,
        layerIndex,
        groupId: group.groupId,
        globalLayerIndex: layerIndex,
        editorTarget: item.editorTarget,
        startTimeBase: item.startTimeBase,
        durationTimeBase: item.durationTimeBase,
        fadeInBeats: displayItem.barRenderer.fadeInBeats,
        fadeOutBeats: displayItem.barRenderer.fadeOutBeats,
      }],
      activeObjectId: item.objectId,
      startFadeBeats: mode === 'fadeIn'
        ? displayItem.barRenderer.fadeInBeats
        : displayItem.barRenderer.fadeOutBeats,
    };
  }, [getDisplayItem, group.groupId, select, selectedObjectIds]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) {
      const { x, y } = toLocalXY(event.clientX, event.clientY);
      const xBeats = x / pixelsPerBeat;
      const hit = findLayerAtY(group.layers, y);
      if (!hit) {
        setCursorOverride(null);
        setHoveredAudioObjectId(null);
        return;
      }

      const item = findItemOnLayer(hit.layer, xBeats, pixelsPerBeat);
      const hoveredItemId = (() => {
        if (!item) {
          return null;
        }
        const displayItem = getDisplayItem(item);
        return displayItem.barRenderer.kind === 'audioClip' ? item.objectId : null;
      })();
      setHoveredAudioObjectId(hoveredItemId);

      if (!item || !selectedObjectIds.has(item.objectId)) {
        setCursorOverride(null);
        return;
      }

      const displayItem = getDisplayItem(item);
      const localX = x - (displayItem.startBeats * pixelsPerBeat);
      const itemWidth = Math.max(displayItem.durationBeats * pixelsPerBeat, 4);
      if (localX >= 0 && localX < RESIZE_EDGE_PX) {
        setCursorOverride('w-resize');
      } else if (localX > itemWidth - RESIZE_EDGE_PX && localX <= itemWidth) {
        setCursorOverride('e-resize');
      } else {
        setCursorOverride('move');
      }
      return;
    }

    if (gesture.mode === 'marquee') {
      const start = toLocalXY(gesture.startClientX, gesture.startClientY);
      const end = toLocalXY(event.clientX, event.clientY);
      const nextMarquee = { startX: start.x, startY: start.y, endX: end.x, endY: end.y };
      marqueeRef.current = nextMarquee;
      setMarquee(nextMarquee);
      return;
    }

    if (gesture.mode === 'move') {
      const { x, y } = toLocalXY(event.clientX, event.clientY);
      const currentBeats = x / pixelsPerBeat;
      const minOriginalStart = Math.min(...gesture.originalPositions.map((position) => position.startBeats));
      let deltaBeats = Math.max(-minOriginalStart, currentBeats - gesture.startBeats);
      deltaBeats = snapBeatValueMove(minOriginalStart + deltaBeats) - minOriginalStart;

      const globalY = y + (gesture.startGroupYOffset ?? 0);
      const currentGlobalLayer = getGlobalLayerIndexForY(allLayerGroups, globalY);
      const rawLayerAdjust = currentGlobalLayer - (gesture.startGlobalLayer ?? gesture.startLayerIndex);
      const layerAdjust = Math.max(
        gesture.minLayerAdjust,
        Math.min(gesture.maxLayerAdjust, rawLayerAdjust),
      );

      const moves = gesture.originalPositions.map((position) => {
        const targetGlobalLayer = position.globalLayerIndex + layerAdjust;
        const targetLayer = gesture.globalLayerMap?.[targetGlobalLayer];
        if (!targetLayer) {
          return null;
        }
        return {
          objectId: position.objectId,
          targetStartBeats: position.startBeats + deltaBeats,
          targetLayerIndex: targetLayer.localIndex,
          targetGroupId: targetLayer.groupId,
        };
      }).filter((move): move is {
        objectId: string;
        targetStartBeats: number;
        targetLayerIndex: number;
        targetGroupId: string;
      } => move !== null);

      if (moves.length === 0) {
        return;
      }

      moveScoreObjects(moves);
      pendingMovePatchRef.current = moves.map((move) => {
        const target = gesture.originalPositions.find((position) => position.objectId === move.objectId)?.editorTarget;
        if (!target) {
          return null;
        }
        return {
          target,
          targetStartBeats: move.targetStartBeats,
          targetLayerIndex: move.targetLayerIndex,
          targetGroupId: move.targetGroupId,
        };
      }).filter((move): move is {
        target: ScoreObjectEditorTargetSnapshot;
        targetStartBeats: number;
        targetLayerIndex: number;
        targetGroupId: string;
      } => move !== null);
      return;
    }

    if (gesture.mode === 'slideFileStart' && gesture.activeObjectId) {
      const active = gesture.originalPositions[0];
      if (!active) {
        return;
      }

      const deltaBeats = (event.clientX - gesture.startClientX) / Math.max(pixelsPerBeat, 1);
      let nextFileStartBeats = (gesture.startFileStartBeats ?? 0) - deltaBeats;
      const audioDurationBeats = gesture.audioDurationBeats ?? 0;

      if (gesture.looping && audioDurationBeats > 0) {
        while (nextFileStartBeats < 0) {
          nextFileStartBeats += audioDurationBeats;
        }
        nextFileStartBeats %= audioDurationBeats;
      } else {
        const maxFileStart = Math.max(audioDurationBeats - active.durationBeats, 0);
        nextFileStartBeats = Math.max(0, Math.min(maxFileStart, nextFileStartBeats));
      }

      setAudioPreviewByObjectId((prev) => ({
        ...prev,
        [active.objectId]: {
          ...prev[active.objectId],
          fileStartTimeBeats: nextFileStartBeats,
        },
      }));
      setAudioClipEditorPreview(active.objectId, {
        fileStartTime: beatsToSecondsValue(nextFileStartBeats),
      });
      pendingFileStartPatchRef.current.set(active.objectId, {
        fileStartTimeBeats: nextFileStartBeats,
      });
      return;
    }

    if (gesture.mode === 'resizeLeft' || gesture.mode === 'resizeRight') {
      const { x } = toLocalXY(event.clientX, event.clientY);
      const currentBeats = x / pixelsPerBeat;
      const rawDelta = currentBeats - gesture.startBeats;

      if (gesture.mode === 'resizeRight') {
        const referenceStart = gesture.resizeReferenceStartBeats ?? gesture.originalPositions[0]!.startBeats;
        const referenceDuration = gesture.resizeReferenceDurationBeats ?? gesture.originalPositions[0]!.durationBeats;
        const referenceEnd = referenceStart + referenceDuration;
        const snappedDelta = snapBeatValueMove(referenceEnd + rawDelta) - referenceEnd;

        const resizes = gesture.originalPositions.map((position) => ({
          objectId: position.objectId,
          targetStartBeats: position.startBeats,
          targetDurationBeats: Math.max(
            MIN_AUDIO_CLIP_DURATION,
            position.durationBeats + snappedDelta,
          ),
        }));

        resizeScoreObjects(resizes);
        resizes.forEach((resize) => {
          pendingSharedPropertyPatchRef.current.set(resize.objectId, {
            startBeats: resize.targetStartBeats,
            durationBeats: resize.targetDurationBeats,
          });
        });
      } else {
        const referenceStart = gesture.resizeReferenceStartBeats ?? gesture.originalPositions[0]!.startBeats;
        const snappedDelta = snapBeatValueMove(referenceStart + rawDelta) - referenceStart;
        const minDelta = Math.max(...gesture.originalPositions.map((position) => -position.startBeats));
        const maxDelta = Math.max(
          0,
          Math.min(...gesture.originalPositions.map((position) => position.durationBeats - MIN_AUDIO_CLIP_DURATION)),
        );
        const resizeDelta = Math.max(minDelta, Math.min(maxDelta, snappedDelta));

        const resizes = gesture.originalPositions.map((position) => {
          const targetStartBeats = position.startBeats + resizeDelta;
          return {
            objectId: position.objectId,
            targetStartBeats,
            targetDurationBeats: position.startBeats + position.durationBeats - targetStartBeats,
          };
        });

        resizeScoreObjects(resizes);
        resizes.forEach((resize) => {
          pendingSharedPropertyPatchRef.current.set(resize.objectId, {
            startBeats: resize.targetStartBeats,
            durationBeats: resize.targetDurationBeats,
          });
        });
      }
      return;
    }

    if ((gesture.mode === 'fadeIn' || gesture.mode === 'fadeOut') && gesture.activeObjectId) {
      const active = gesture.originalPositions[0];
      if (!active) {
        return;
      }

      const deltaBeats = (event.clientX - gesture.startClientX) / Math.max(pixelsPerBeat, 1);
      if (gesture.mode === 'fadeIn') {
        const nextFadeInBeats = Math.max(
          0,
          Math.min(
            active.durationBeats - active.fadeOutBeats,
            (gesture.startFadeBeats ?? active.fadeInBeats) + deltaBeats,
          ),
        );
        setAudioPreviewByObjectId((prev) => ({
          ...prev,
          [active.objectId]: {
            ...prev[active.objectId],
            fadeInBeats: nextFadeInBeats,
          },
        }));
        pendingFadePatchRef.current.set(active.objectId, {
          ...pendingFadePatchRef.current.get(active.objectId),
          fadeInBeats: nextFadeInBeats,
        });
      } else {
        const nextFadeOutBeats = Math.max(
          0,
          Math.min(
            active.durationBeats - active.fadeInBeats,
            (gesture.startFadeBeats ?? active.fadeOutBeats) - deltaBeats,
          ),
        );
        setAudioPreviewByObjectId((prev) => ({
          ...prev,
          [active.objectId]: {
            ...prev[active.objectId],
            fadeOutBeats: nextFadeOutBeats,
          },
        }));
        pendingFadePatchRef.current.set(active.objectId, {
          ...pendingFadePatchRef.current.get(active.objectId),
          fadeOutBeats: nextFadeOutBeats,
        });
      }
    }
  }, [allLayerGroups, beatsToSecondsValue, getDisplayItem, group.layers, moveScoreObjects, pixelsPerBeat, resizeScoreObjects, selectedObjectIds, setAudioClipEditorPreview, snapBeatValueMove, toLocalXY]);

  const handleMouseLeave = useCallback(() => {
    if (!gestureRef.current) {
      setCursorOverride(null);
    }
    setHoveredAudioObjectId(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) {
      setCursorOverride(null);
      marqueeRef.current = null;
      setMarquee(null);
      return;
    }

    if (gesture.mode === 'marquee') {
      const activeMarquee = marqueeRef.current ?? marquee;
      if (activeMarquee) {
        const left = Math.min(activeMarquee.startX, activeMarquee.endX);
        const right = Math.max(activeMarquee.startX, activeMarquee.endX);
        const top = Math.min(activeMarquee.startY, activeMarquee.endY);
        const bottom = Math.max(activeMarquee.startY, activeMarquee.endY);
        const startBeats = left / pixelsPerBeat;
        const endBeats = right / pixelsPerBeat;
        const hitItems: Array<{ objectId: string; editorTarget?: ScoreObjectEditorTargetSnapshot }> = [];
        const currentGroupIndex = Math.max(
          0,
          allLayerGroups.findIndex((layerGroup) => layerGroup.groupId === group.groupId),
        );

        for (let groupIndex = 0; groupIndex < allLayerGroups.length; groupIndex += 1) {
          const layerGroup = allLayerGroups[groupIndex]!;
          let yShift = 0;
          const lo = Math.min(groupIndex, currentGroupIndex);
          const hi = Math.max(groupIndex, currentGroupIndex);
          for (let index = lo; index < hi; index += 1) {
            const height = allLayerGroups[index]!.layers.reduce(
              (sum, layer) => sum + (layer.height || DEFAULT_ROW_HEIGHT),
              0,
            ) + GROUP_SPACER;
            yShift += groupIndex > currentGroupIndex ? height : -height;
          }

          const shiftedTop = top - yShift;
          const shiftedBottom = bottom - yShift;
          let yOffset = 0;
          for (const layer of layerGroup.layers) {
            const height = layer.height || DEFAULT_ROW_HEIGHT;
            const layerTop = yOffset;
            const layerBottom = yOffset + height;
            if (layerBottom > shiftedTop && layerTop < shiftedBottom) {
              for (const item of layer.items) {
                const itemEnd = item.startBeats + item.durationBeats;
                if (item.startBeats < endBeats && itemEnd > startBeats) {
                  hitItems.push({ objectId: item.objectId, editorTarget: item.editorTarget });
                }
              }
            }
            yOffset += height;
          }
        }

        if (hitItems.length > 0) {
          setSelection(hitItems);
        }
      }

      gestureRef.current = null;
      setCursorOverride(null);
      marqueeRef.current = null;
      setMarquee(null);
      return;
    }

    const pendingMovePatch = pendingMovePatchRef.current;
    pendingMovePatchRef.current = [];
    const pendingSharedPatches = Array.from(pendingSharedPropertyPatchRef.current.entries());
    pendingSharedPropertyPatchRef.current.clear();
    const pendingFadePatches = Array.from(pendingFadePatchRef.current.entries());
    pendingFadePatchRef.current.clear();
    const pendingFileStartPatches = Array.from(pendingFileStartPatchRef.current.entries());
    pendingFileStartPatchRef.current.clear();

    if (pendingMovePatch.length > 0 && gesture.mode === 'move') {
      void applyProjectDocumentPatch({
        score: {
          type: 'moveScoreObjects',
          moves: pendingMovePatch,
        },
      });
    }

    if (pendingSharedPatches.length > 0 && (gesture.mode === 'resizeLeft' || gesture.mode === 'resizeRight')) {
      void (async () => {
        for (const [objectId, values] of pendingSharedPatches) {
          const original = gesture.originalPositions.find((position) => position.objectId === objectId);
          const target = original?.editorTarget ?? findEditorTarget(objectId);
          if (!target) {
            continue;
          }

          const patch: {
            startTime?: { value: number; timeBase: string };
            subjectiveDuration?: { value: number; timeBase: string };
          } = {};

          if (values.startBeats !== undefined) {
            patch.startTime = {
              value: values.startBeats,
              timeBase: original?.startTimeBase ?? 'BEATS',
            };
          }
          if (values.durationBeats !== undefined) {
            patch.subjectiveDuration = {
              value: values.durationBeats,
              timeBase: original?.durationTimeBase ?? 'BEATS',
            };
          }

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

    if (pendingFadePatches.length > 0 && (gesture.mode === 'fadeIn' || gesture.mode === 'fadeOut')) {
      void (async () => {
        for (const [objectId, values] of pendingFadePatches) {
          const target = gesture.originalPositions.find((position) => position.objectId === objectId)?.editorTarget
            ?? findEditorTarget(objectId);
          if (!target) {
            continue;
          }

          await applyProjectDocumentPatch({
            score: {
              type: 'updateTypeSpecificEditor',
              target,
              patch: {
                ...(values.fadeInBeats !== undefined ? { fadeIn: beatsToSecondsValue(values.fadeInBeats) } : {}),
                ...(values.fadeOutBeats !== undefined ? { fadeOut: beatsToSecondsValue(values.fadeOutBeats) } : {}),
              },
            },
          });
        }
      })();
    }

    if (pendingFileStartPatches.length > 0 && gesture.mode === 'slideFileStart') {
      void (async () => {
        for (const [objectId, values] of pendingFileStartPatches) {
          const target = gesture.originalPositions.find((position) => position.objectId === objectId)?.editorTarget
            ?? findEditorTarget(objectId);
          if (!target) {
            continue;
          }

          await applyProjectDocumentPatch({
            score: {
              type: 'updateTypeSpecificEditor',
              target,
              patch: {
                fileStartTime: beatsToSecondsValue(values.fileStartTimeBeats),
              },
            },
          });
        }
      })();
    }

    gestureRef.current = null;
    setCursorOverride(null);
  }, [allLayerGroups, applyProjectDocumentPatch, beatsToSecondsValue, findEditorTarget, group.groupId, marquee, pixelsPerBeat, setSelection]);

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
    const onMouseMove = (event: MouseEvent) => {
      if (gestureRef.current) {
        handleMouseMoveRef.current(event as unknown as React.MouseEvent<HTMLDivElement>);
      }
    };

    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = toLocalXY(event.clientX, event.clientY);
    const xBeats = x / pixelsPerBeat;
    const hit = findLayerAtY(group.layers, y);
    setContextMenuPos(hit ? { xBeats, layerIndex: hit.index } : null);
    setFadeContextMenu(null);

    if (!hit) {
      return;
    }

    const item = findItemOnLayer(hit.layer, xBeats, pixelsPerBeat);
    if (item) {
      const displayItem = getDisplayItem(item);
      if (displayItem.barRenderer.kind === 'audioClip') {
        const barLeft = displayItem.startBeats * pixelsPerBeat;
        const barWidth = Math.max(displayItem.durationBeats * pixelsPerBeat, 4);
        const relativeX = x - barLeft;
        const fadeInWidth = Math.round(displayItem.barRenderer.fadeInBeats * pixelsPerBeat);
        const fadeOutWidth = Math.round(displayItem.barRenderer.fadeOutBeats * pixelsPerBeat);

        if (fadeInWidth > 0 && relativeX >= 0 && relativeX <= fadeInWidth) {
          setFadeContextMenu({
            objectId: item.objectId,
            target: item.editorTarget,
            side: 'fadeIn',
          });
        } else if (fadeOutWidth > 0 && relativeX >= barWidth - fadeOutWidth && relativeX <= barWidth) {
          setFadeContextMenu({
            objectId: item.objectId,
            target: item.editorTarget,
            side: 'fadeOut',
          });
        }
      }

      if (!selectedObjectIds.has(item.objectId)) {
        setSelection([{ objectId: item.objectId, editorTarget: item.editorTarget }]);
      }
    }
  }, [getDisplayItem, group.layers, pixelsPerBeat, selectedObjectIds, setSelection, toLocalXY]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const { x, y } = toLocalXY(event.clientX, event.clientY);
    const xBeats = x / pixelsPerBeat;
    const hit = findLayerAtY(group.layers, y);
    if (!hit) {
      return;
    }

    const filePath = getDroppedFilePath(event.dataTransfer);
    if (!filePath) {
      return;
    }

    const droppedFile = event.dataTransfer.files[0];
    const metadata = droppedFile ? await readAudioFileMetadata(droppedFile) : null;
    const durationSeconds = metadata?.durationSeconds ?? 0;
    const durationBeats = durationSeconds > 0 && tempo > 0
      ? durationSeconds * (tempo / 60)
      : 0;

    const clip = new AudioClip();
    clip.setName(getFileName(filePath));
    clip.setAudioFile(filePath);
    clip.setNumChannels(metadata?.numChannels ?? 0);
    clip.setAudioDuration(durationSeconds);
    clip.setStartTime(TimePosition.beats(xBeats));
    clip.setSubjectiveDuration(
      durationSeconds > 0
        ? TimeDuration.fromSeconds(durationSeconds)
        : TimeDuration.beats(0),
    );
    clip.setBackgroundColor(DEFAULT_AUDIO_CLIP_BG);

    setContextMenuPos({ xBeats, layerIndex: hit.index });
    addScoreObjects([
      {
        layerIndex: hit.index,
        groupId: group.groupId,
        name: clip.getName(),
        startBeats: xBeats,
        durationBeats,
        startTimeBase: 'BEATS',
        durationTimeBase: durationSeconds > 0 ? 'TIME' : 'BEATS',
        backgroundColor: DEFAULT_AUDIO_CLIP_BG,
        objectType: 'AudioClip',
        isContainer: false,
        serializedXml: clip.saveAsXML().toXml(),
        barRenderer: createAudioClipBarRenderer(clip, secondsToBeatValue),
      },
    ]);
  }, [addScoreObjects, group.groupId, group.layers, pixelsPerBeat, secondsToBeatValue, tempo, toLocalXY]);

  const menuItemClass = 'cursor-pointer rounded-sm px-3 py-1 text-body text-blue-text outline-none data-[highlighted]:bg-app-highlight data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
  const menuClass = 'z-50 min-w-[220px] rounded border border-blue-border/50 bg-app-menu py-1 shadow-lg';
  const sepClass = 'h-px bg-blue-border/30 my-1';
  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.endX),
    top: Math.min(marquee.startY, marquee.endY),
    width: Math.abs(marquee.endX - marquee.startX),
    height: Math.abs(marquee.endY - marquee.startY),
  } : null;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          ref={containerRef}
          data-group-id={group.groupId}
          data-shortcut-scope="audio-layer-group-canvas"
          className="relative select-none focus:outline-none"
          {...canvasShortcutScope}
          style={cursorOverride ? { cursor: cursorOverride } : undefined}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDrop={(event) => {
            void handleDrop(event);
          }}
        >
          {group.layers.map((layer: ScoreLayerSnapshot, layerIndex) => (
            <div
              key={layer.layerId}
              className="relative border-b border-app-border/40"
              style={{ height: layer.height || DEFAULT_ROW_HEIGHT }}
            >
              {layer.items.map((item: ScoreRowObjectSnapshot) => {
                const displayItem = getDisplayItem(item);
                const isSelected = selectedObjectIds.has(item.objectId);
                const rowHeight = layer.height || DEFAULT_ROW_HEIGHT;
                const objPreview = multiLineObjectPreview?.[item.objectId];
                const previewStartBeats = objPreview?.startBeats ?? displayItem.startBeats;
                const previewDurationBeats = objPreview?.durationBeats ?? displayItem.durationBeats;
                const barWidth = Math.max(previewDurationBeats * pixelsPerBeat, 4);
                const barLeft = previewStartBeats * pixelsPerBeat;
                const audioBar = displayItem.barRenderer.kind === 'audioClip'
                  ? displayItem.barRenderer
                  : null;
                const showFadeHandles = Boolean(
                  audioBar
                  && (
                    hoveredAudioObjectId === item.objectId
                    || gestureRef.current?.activeObjectId === item.objectId
                  )
                );
                const handleTop = 2;
                const fadeInLeft = audioBar
                  ? Math.max(
                    barLeft,
                    Math.min(
                      barLeft + barWidth - FADE_HANDLE_SIZE,
                      barLeft + Math.round(audioBar.fadeInBeats * pixelsPerBeat),
                    ),
                  )
                  : 0;
                const fadeOutLeft = audioBar
                  ? Math.max(
                    barLeft,
                    Math.min(
                      barLeft + barWidth - FADE_HANDLE_SIZE,
                      barLeft + barWidth - Math.round(audioBar.fadeOutBeats * pixelsPerBeat) - FADE_HANDLE_SIZE,
                    ),
                  )
                  : 0;

                return (
                  <Fragment key={item.objectId}>
                    <RenderBar
                      item={displayItem}
                      selected={isSelected}
                      pixelsPerBeat={pixelsPerBeat}
                      pixelsPerSecond={pixelsPerSecond}
                      rowHeight={rowHeight}
                      durationBeats={displayItem.durationBeats}
                    />
                    {showFadeHandles && audioBar && (
                      <>
                        <div
                          data-fade-handle="in"
                          data-object-id={item.objectId}
                          style={{
                            position: 'absolute',
                            left: fadeInLeft,
                            top: handleTop,
                            width: FADE_HANDLE_SIZE,
                            height: FADE_HANDLE_SIZE,
                            backgroundColor: 'var(--color-app-text-strong)',
                            boxShadow: FADE_HANDLE_OUTLINE,
                            cursor: 'e-resize',
                            zIndex: 3,
                          }}
                          onMouseDown={(event) => startFadeHandleDrag(event, item, layerIndex, 'fadeIn')}
                        />
                        <div
                          data-fade-handle="out"
                          data-object-id={item.objectId}
                          style={{
                            position: 'absolute',
                            left: fadeOutLeft,
                            top: handleTop,
                            width: FADE_HANDLE_SIZE,
                            height: FADE_HANDLE_SIZE,
                            backgroundColor: 'var(--color-app-text-strong)',
                            boxShadow: FADE_HANDLE_OUTLINE,
                            cursor: 'w-resize',
                            zIndex: 3,
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
          ))}
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
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className={menuClass}>
          {fadeContextMenu
            ? AUDIO_FADE_TYPE_OPTIONS.map((option) => (
              <ContextMenu.Item
                key={option.value}
                className={menuItemClass}
                onSelect={() => handleFadeTypeSelect(option.value)}
              >
                {option.label}
              </ContextMenu.Item>
            ))
            : (
              <>
                <ContextMenu.Item className={menuItemClass} disabled={clipboard.length === 0} onSelect={handlePaste}>
                  Paste
                </ContextMenu.Item>
                <ContextMenu.Separator className={sepClass} />
                <ContextMenu.Item className={menuItemClass} disabled={!contextMenuPos} onSelect={handleSelectLayer}>
                  Select Layer
                </ContextMenu.Item>
                <ContextMenu.Item className={menuItemClass} disabled={!contextMenuPos} onSelect={handleSelectAllBefore}>
                  Select All Before
                </ContextMenu.Item>
                <ContextMenu.Item className={menuItemClass} disabled={!contextMenuPos} onSelect={handleSelectAllAfter}>
                  Select All After
                </ContextMenu.Item>
              </>
            )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
