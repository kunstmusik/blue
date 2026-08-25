import { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Check, ChevronRight, ChevronDown, ChevronLeft, Plus } from "lucide-react";
import { getProjectDocumentRevision, useProjectStore } from "../../../stores/project-store";
import type {
  ScoreDocumentSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreLayerSnapshot,
  ScoreRowObjectSnapshot,
  PolyObjectLayerGroupSnapshot,
} from "./score/types";
import { DEFAULT_ROW_HEIGHT } from "./score/types";
import { computePatternExtentBeats } from "./score/layer-groups/patterns-timeline-utils";
import type { TempoMapPatch, MeterMapPatch, NoteProcessorChainSnapshot, ScoreAutomationPatch } from "../../../../shared/project-editor";
import type { SnapValueName } from "@blue/data";
import type { RulerConfigChanges } from "./score/RulerConfigDialog";
import SplitPane from "./orchestra/SplitPane";
import ScoreToolbar from "./score/ScoreToolbar";
import RulerConfigDialog from "./score/RulerConfigDialog";
import ScoreManagerDialog from "./score/ScoreManagerDialog";
import AutomationTargetMenu from "./score/automation/AutomationTargetMenu";
import TempoMapEditorDialog from "./score/TempoMapEditorDialog";
import MeterMapEditorDialog from "./score/MeterMapEditorDialog";
import ColumnHeader from "./score/ColumnHeader";
import LayerPanel from "./score/LayerPanel";
import { useScorePathState } from "./score/useScorePathState";
import { useScoreWheelZoom, computePixelsPerBeat } from "./score/useScoreWheelZoom";
import { useScoreSelectionStore } from "../../../stores/score-selection-store";
import { useMidiRoutingStore } from "../../../stores/midi-routing-store";
import { useLayerSelectionStore } from "../../../stores/layer-selection-store";
import { useScoreRulerSelection } from "./score/useScoreRulerSelection";
import { getFollowScrollTarget } from "./score/follow-playback";
import { usePlaybackStore } from "../../../stores/playback-store";
import ScoreOverlayLines from "./score/ScoreOverlayLines";
import NoteProcessorChainDialog from "./score-object/note-processors/NoteProcessorChainDialog";
import TrackInstrumentControl from "./score/TrackInstrumentControl";
import ColorPickerButton from "../../ColorPicker";
import PatternLayerHeader from "./score/PatternLayerHeader";
import LayerRemovalConfirmationDialog from "./score/LayerRemovalConfirmationDialog";
import { secondsToBeats as tempoMapSecondsToBeats } from "./score/tempo-map-utils";
import {
  buildLayerRemovalPlan,
  buildSelectionKey,
  createMoveLayerRangePatch,
  createRemoveLayerRangesPatch,
  deriveSelectedLayerRanges,
  flattenVisibleLayers,
  getLayerOperationAvailability,
  getLayerSelectionId,
  getPushDisabledReasonLabel,
  type LayerRemovalPlan,
  type VisibleLayerRef,
} from "./score/layer-selection-utils";

type ChainDialogTarget =
  | { scope: 'soundLayer'; groupId: string; layerIndex: number }
  | { scope: 'track'; groupId: string; trackId: string; layerIndex: number }
  | { scope: 'layerGroup'; groupId: string }
  | { scope: 'rootScore' };

function ChainDialogWrapper({ target, onClose }: { target: ChainDialogTarget; onClose: () => void }) {
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const score = useProjectStore((s) => s.score);
  const projectSessionId = useProjectStore((s) => s.sessionId);
  const projectRevision = getProjectDocumentRevision();

  const title = target.scope === 'rootScore'
    ? 'Root Score - Note Processors'
    : target.scope === 'layerGroup'
      ? 'Layer Group - Note Processors'
      : `Layer ${target.layerIndex + 1} - Note Processors`;

  const emptyChain: NoteProcessorChainSnapshot = {
    processors: [],
    hasUnsupportedProcessors: false,
    hasDeferredProcessors: false,
  };

  let existingChain: NoteProcessorChainSnapshot | undefined;
  if (target.scope === 'rootScore') {
    existingChain = score.rootNoteProcessorChain;
  } else if (target.scope === 'layerGroup') {
    const group = score.layerGroups.find((g) => g.groupId === target.groupId);
    existingChain = group?.noteProcessorChain;
  } else if (target.scope === 'track') {
    const group = score.layerGroups.find((g) => g.groupId === target.groupId && g.groupType === 'track');
    existingChain = group?.layers.find((layer) => layer.layerId === target.trackId)?.noteProcessorChain;
  } else {
    const group = score.layerGroups.find((g) => g.groupId === target.groupId);
    const layer = group?.layers[target.layerIndex];
    existingChain = layer?.noteProcessorChain;
  }

  const chain = existingChain ?? emptyChain;

  const handleCommit = useCallback((updated: NoteProcessorChainSnapshot) => {
    if (target.scope === 'soundLayer') {
      void applyProjectDocumentPatch({
        score: { type: 'replaceScopedNoteProcessorChain', scope: 'soundLayer', groupId: target.groupId, layerIndex: target.layerIndex, chain: updated },
      });
    } else if (target.scope === 'track') {
      void applyProjectDocumentPatch({
        score: {
          type: 'replaceTrackNoteProcessorChain',
          track: {
            rootGroupId: target.groupId,
            trackId: target.trackId,
            projectSessionId,
            projectRevision,
          },
          chain: updated,
        },
      });
    } else if (target.scope === 'layerGroup') {
      void applyProjectDocumentPatch({
        score: { type: 'replaceScopedNoteProcessorChain', scope: 'layerGroup', groupId: target.groupId, chain: updated },
      });
    } else {
      void applyProjectDocumentPatch({
        score: { type: 'replaceScopedNoteProcessorChain', scope: 'rootScore', chain: updated },
      });
    }
  }, [target, applyProjectDocumentPatch, projectRevision, projectSessionId]);

  return (
    <NoteProcessorChainDialog
      title={title}
      chain={chain}
      onClose={onClose}
      onCommit={handleCommit}
    />
  );
}

type ScoreMode = "score" | "singleLine" | "multiLine";

const GROUP_SPACER = 36;

export default function ScorePanel() {
  const loaded = useProjectStore((s) => s.loaded);
  const score = useProjectStore((s) => s.score);
  const sessionId = useProjectStore((s) => s.sessionId);
  const transport = useProjectStore((s) => s.transport);
  const lastScorePatch = useProjectStore((s) => s.lastScorePatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);

  const [mode, setMode] = useState<ScoreMode>("score");
  const [snapEnabled, setSnapEnabled] = useState(score.timeState.snapEnabled);
  const [snapValue, setSnapValue] = useState<SnapValueName>(
    score.timeState.snapValue as SnapValueName,
  );
  const [rulerDialogOpen, setRulerDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [tempoMapEditorOpen, setTempoMapEditorOpen] = useState(false);
  const [meterMapEditorOpen, setMeterMapEditorOpen] = useState(false);
  const [chainDialogTarget, setChainDialogTarget] = useState<ChainDialogTarget | null>(null);

  const [timeState, setTimeState] = useState(score.timeState);

  const {
    session,
    scrollContainerRef,
    navigateToGroup,
    navigateToRoot,
    navigateToSegment,
    resetSession,
  } = useScorePathState();

  useEffect(() => {
    useScoreSelectionStore.getState().clearSelection();
  }, [session.activeGroupId]);

  useEffect(() => {
    setTimeState(score.timeState);
    setSnapEnabled(score.timeState.snapEnabled);
    setSnapValue(score.timeState.snapValue as SnapValueName);
  }, [score.timeState]);

  // Snap toggle/value are part of the project's TimeState (Java parity). Persist
  // them through an updateTimeState patch so they survive the canonical project
  // refresh that follows automation/score edits (otherwise the local toggle is
  // clobbered back to the document's previous value).
  const handleSnapToggle = useCallback((enabled: boolean) => {
    setSnapEnabled(enabled);
    void useProjectStore.getState().applyProjectDocumentPatch({
      score: { type: 'updateTimeState', patch: { snapEnabled: enabled } },
    });
  }, []);

  const handleSnapValueChange = useCallback((value: SnapValueName) => {
    setSnapValue(value);
    void useProjectStore.getState().applyProjectDocumentPatch({
      score: { type: 'updateTimeState', patch: { snapValue: value } },
    });
  }, []);

  useEffect(() => {
    resetSession();
  }, [sessionId, resetSession]);

  useEffect(() => {
    const handler = () => setTempoMapEditorOpen(true);
    window.addEventListener('blue-edit-tempo-map', handler);
    return () => window.removeEventListener('blue-edit-tempo-map', handler);
  }, []);

  useEffect(() => {
    const handler = () => setMeterMapEditorOpen(true);
    window.addEventListener('blue-edit-meter-map', handler);
    return () => window.removeEventListener('blue-edit-meter-map', handler);
  }, []);

  const leftHeaderRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const [nestedSnapshot, setNestedSnapshot] = useState<PolyObjectLayerGroupSnapshot | null>(null);
  const [scrollOverlayLeft, setScrollOverlayLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Follow-navigation provenance (FR-007): programmatic horizontal writes
  // record their expected target per scroll surface so the scroll events they
  // induce are consumed instead of being classified as user navigation.
  const expectedHorizontalScrollsRef = useRef<{ body: number | null; header: number | null }>({
    body: null,
    header: null,
  });
  const lastScrollPositionsRef = useRef<{
    body: { left: number; top: number } | null;
    header: { left: number; top: number } | null;
  }>({ body: null, header: null });

  /**
   * Classifies a native scroll event on one of the two horizontal scroll
   * surfaces. Matching an expected automatic target consumes it; an otherwise
   * unexplained horizontal delta is user navigation and suspends active
   * follow. Vertical-only movement never suspends (FR-008).
   */
  const classifyHorizontalScroll = useCallback((source: 'body' | 'header', el: HTMLElement) => {
    // Before any scroll event, both surfaces sit at the origin.
    const last = lastScrollPositionsRef.current[source] ?? { left: 0, top: 0 };
    const next = { left: el.scrollLeft, top: el.scrollTop };
    lastScrollPositionsRef.current[source] = next;

    const expected = expectedHorizontalScrollsRef.current[source];
    if (expected !== null && Math.abs(next.left - expected) < 1) {
      expectedHorizontalScrollsRef.current[source] = null;
      return;
    }

    if (next.left === last.left) {
      return;
    }

    const playback = usePlaybackStore.getState();
    if (playback.isPlaying && playback.followPlayback) {
      playback.suspendFollowForSession();
    }
  }, []);

  /** Marks an unmatched horizontal delta as explicit user navigation. */
  const suspendForUserNavigation = useCallback(() => {
    const playback = usePlaybackStore.getState();
    if (playback.isPlaying && playback.followPlayback) {
      playback.suspendFollowForSession();
    }
  }, []);

  /**
   * Records a programmatic horizontal scroll target so the scroll events it
   * induces on both surfaces are consumed rather than suspending follow.
   */
  const markExpectedHorizontalScroll = useCallback((nextScrollLeft: number) => {
    expectedHorizontalScrollsRef.current = { body: nextScrollLeft, header: nextScrollLeft };
  }, []);

  const synchronizeHorizontalScroll = useCallback((nextScrollLeft: number) => {
    const timeline = scrollContainerRef.current;
    const header = timelineHeaderRef.current;

    if (timeline && timeline.scrollLeft !== nextScrollLeft) {
      timeline.scrollLeft = nextScrollLeft;
    }

    const resolvedScrollLeft = timeline?.scrollLeft ?? nextScrollLeft;
    if (header && header.scrollLeft !== resolvedScrollLeft) {
      header.scrollLeft = resolvedScrollLeft;
    }
    setScrollOverlayLeft(resolvedScrollLeft);
  }, [scrollContainerRef]);

  const applyProgrammaticHorizontalScroll = useCallback((nextScrollLeft: number) => {
    markExpectedHorizontalScroll(nextScrollLeft);
    synchronizeHorizontalScroll(nextScrollLeft);
  }, [markExpectedHorizontalScroll, synchronizeHorizontalScroll]);

  /**
   * Scroll-origin callback for wheel/gesture handling: cursor-anchored and
   * pinch zoom reposition the viewport without suspending follow (FR-008),
   * while Shift+wheel horizontal movement is user navigation (FR-005).
   */
  const handleWheelScrollOrigin = useCallback((
    origin: 'user-navigation' | 'view-scale',
    expectedScrollLeft?: number,
  ) => {
    if (origin === 'view-scale' && typeof expectedScrollLeft === 'number') {
      markExpectedHorizontalScroll(expectedScrollLeft);
      return;
    }
    suspendForUserNavigation();
  }, [markExpectedHorizontalScroll, suspendForUserNavigation]);

  const activeSegment = session.segments[session.segments.length - 1];

  useEffect(() => {
    const activeGroupId = activeSegment?.groupId;
    const activeLocation = activeSegment?.location;

    if (!activeGroupId || !activeLocation) {
      setNestedSnapshot(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await flushPendingPatches();
        const snap = await window.blueAPI.getNestedPolyObjectSnapshot(activeLocation);
        if (!cancelled) {
          setNestedSnapshot(snap);
        }
      } catch {
        if (!cancelled) {
          setNestedSnapshot(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSegment?.groupId, activeSegment?.location, lastScorePatch, flushPendingPatches]);

  const effectiveLayerGroups: ScoreLayerGroupSnapshot[] =
    session.activeGroupId && nestedSnapshot
      ? [nestedSnapshot]
      : score.layerGroups;

  const scopeKey = `${sessionId}:${session.activeGroupId ?? 'root'}`;
  const visibleLayers = useMemo(
    () => flattenVisibleLayers(effectiveLayerGroups, scopeKey),
    [effectiveLayerGroups, scopeKey],
  );

  useEffect(() => {
    useLayerSelectionStore.getState().reconcile(scopeKey, visibleLayers);
  }, [scopeKey, visibleLayers]);

  const pixelsPerBeat = computePixelsPerBeat(timeState.zoomIterations);

  useScoreWheelZoom(scrollContainerRef, timelineHeaderRef, timeState.zoomIterations, pixelsPerBeat, loaded, setTimeState, effectiveLayerGroups, handleWheelScrollOrigin);

  // Track the scroll container width so totalBeats can fill the visible area when zoomed out.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollContainerRef]);

  const totalBeats = Math.max(
    computeTotalBeats(score),
    containerWidth > 0 ? Math.ceil(containerWidth / pixelsPerBeat) + 16 : 0,
  );
  const initialTempo = transport.tempoMap.points[0]?.tempo ?? 60;

  const isRootTimeline = !session.activeGroupId;

  const { handleMouseDown: rulerMouseDown } = useScoreRulerSelection({
    pixelsPerBeat,
    totalBeats,
    snapEnabled,
    snapValue,
    meterMap: transport.meterMap,
    rootTimelineOnly: isRootTimeline,
    scrollContainerRef,
    tempo: initialTempo,
    smpteFrameRate: timeState.smpteFrameRate || 24,
    sampleRate: transport.sampleRate,
    onUserNavigation: suspendForUserNavigation,
  });

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackStatus = usePlaybackStore((s) => s.status);
  const playbackClock = usePlaybackStore((s) => s.clock);
  const clockElapsed = usePlaybackStore((s) => s.display.elapsedSeconds);
  const followPlayback = usePlaybackStore((s) => s.followPlayback);
  const transportAnchor = usePlaybackStore((s) => s.transportAnchor);
  const stopAuditioning = usePlaybackStore((s) => s.stopAuditioning);
  const scrollToBeatTarget = useProjectStore((s) => s.scrollToBeatTarget);
  const clearScrollTarget = useProjectStore((s) => s.setScrollToBeatTarget);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      usePlaybackStore.getState().tickDisplay();
    }, 33);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const livePlayheadTransport = transportAnchor ?? transport;
  const hasLivePlaybackClock =
    playbackClock !== null &&
    (playbackStatus === 'playing' || playbackStatus === 'stopping');

  const timePointerBeats = hasLivePlaybackClock && clockElapsed >= 0
    ? livePlayheadTransport.renderStartTime
      + tempoMapSecondsToBeats(clockElapsed, livePlayheadTransport.tempoMap)
    : null;

  // Follow playback (Java ScoreTopComponent parity): keep the viewport
  // stationary while the playhead is visible; when it reaches or passes the
  // right edge — or lands outside the viewport after a seek/wrap — jump so
  // the playhead becomes the left edge, clamped to the scroll range. Only
  // writes on a boundary/catch-up event, never per display tick.
  useEffect(() => {
    if (!isRootTimeline || timePointerBeats == null) {
      return;
    }

    const timeline = scrollContainerRef.current;
    if (!timeline) {
      return;
    }

    const pointerPixel = timePointerBeats * pixelsPerBeat;
    const targetScrollLeft = getFollowScrollTarget({
      isPlaybackActive: isPlaying,
      isFollowEnabled: followPlayback,
      pointerPixel,
      scrollLeft: timeline.scrollLeft,
      clientWidth: timeline.clientWidth,
      scrollWidth: timeline.scrollWidth,
    });

    if (targetScrollLeft === null || targetScrollLeft === timeline.scrollLeft) {
      return;
    }

    applyProgrammaticHorizontalScroll(targetScrollLeft);
  }, [
    followPlayback,
    isPlaying,
    isRootTimeline,
    timePointerBeats,
    pixelsPerBeat,
    scrollContainerRef,
    applyProgrammaticHorizontalScroll,
  ]);

  useEffect(() => {
    if (scrollToBeatTarget == null || !scrollContainerRef.current) return;
    const pointerPixel = scrollToBeatTarget * pixelsPerBeat;
    const w = scrollContainerRef.current.clientWidth;
    const newX = Math.max(0, pointerPixel - (w / 8));
    // Marker/rewind navigation is explicit user navigation even though the
    // resulting scroll is applied programmatically (FR-005).
    suspendForUserNavigation();
    applyProgrammaticHorizontalScroll(newX);
    clearScrollTarget(null);
  }, [scrollToBeatTarget, pixelsPerBeat, scrollContainerRef, clearScrollTarget, applyProgrammaticHorizontalScroll, suspendForUserNavigation]);

  useLayoutEffect(() => {
    const timeline = scrollContainerRef.current;
    if (timeline) {
      // Body/header alignment after layout changes is layout-sync, never user
      // navigation; consume the events it induces on both surfaces.
      markExpectedHorizontalScroll(timeline.scrollLeft);
      synchronizeHorizontalScroll(timeline.scrollLeft);
    }
  }, [session.activeGroupId, pixelsPerBeat, totalBeats, scrollContainerRef, synchronizeHorizontalScroll, markExpectedHorizontalScroll]);

  const handleTimelineScroll = useCallback(() => {
    const timeline = scrollContainerRef.current;
    const left = leftHeaderRef.current;
    if (timeline) {
      if (left) left.scrollTop = timeline.scrollTop;
      classifyHorizontalScroll('body', timeline);
      // Aligning the header below writes horizontally; mark it expected so
      // the induced header scroll event is not classified as navigation.
      expectedHorizontalScrollsRef.current.header = timeline.scrollLeft;
      synchronizeHorizontalScroll(timeline.scrollLeft);
    }
  }, [scrollContainerRef, synchronizeHorizontalScroll, classifyHorizontalScroll]);

  // Clicking the empty score background (the scroll container showing through
  // below the last layer row, when there are fewer layers than the viewport)
  // deselects and starts a marquee selection, mirroring the per-group canvas
  // marquee but anchored at the scroll-content origin so it can select objects
  // in any group. Only fires when the click lands directly on the background
  // (target === currentTarget); clicks on rows/objects hit the child canvases.
  const [bgMarquee, setBgMarquee] = useState<{
    startClientX: number;
    startClientY: number;
    endClientX: number;
    endClientY: number;
    additive: boolean;
  } | null>(null);
  const bgMarqueeRef = useRef(bgMarquee);
  bgMarqueeRef.current = bgMarquee;

  const contentXY = useCallback(
    (clientX: number, clientY: number) => {
      const el = scrollContainerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return { x: clientX - rect.left + el.scrollLeft, y: clientY - rect.top + el.scrollTop };
    },
    [scrollContainerRef],
  );

  const handleTimelineBackgroundMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.metaKey || e.ctrlKey) return;
    useLayerSelectionStore.getState().clear();
    if (!e.shiftKey) {
      useScoreSelectionStore.getState().clearSelection();
    }
    setBgMarquee({
      startClientX: e.clientX,
      startClientY: e.clientY,
      endClientX: e.clientX,
      endClientY: e.clientY,
      additive: e.shiftKey,
    });
  }, []);

  const handleBgMarqueeMove = useCallback((clientX: number, clientY: number) => {
    setBgMarquee((prev) => (prev ? { ...prev, endClientX: clientX, endClientY: clientY } : prev));
  }, []);

  const handleBgMarqueeUp = useCallback(() => {
    const m = bgMarqueeRef.current;
    setBgMarquee(null);
    if (!m) return;
    const start = contentXY(m.startClientX, m.startClientY);
    const end = contentXY(m.endClientX, m.endClientY);
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    // A click without movement (zero-area rect) is just a deselect, already done.
    if (right - left < 1 && bottom - top < 1) return;

    const startBeats = left / pixelsPerBeat;
    const endBeats = right / pixelsPerBeat;
    const hitItems: Array<{ objectId: string; editorTarget: ScoreRowObjectSnapshot["editorTarget"] }> = [];
    let groupYOff = 0;
    for (const lg of effectiveLayerGroups) {
      for (const layer of lg.layers) {
        const h = layer.height || DEFAULT_ROW_HEIGHT;
        const layerTop = groupYOff;
        const layerBottom = groupYOff + h;
        if (layerBottom > top && layerTop < bottom) {
          for (const item of layer.items) {
            const itemEnd = item.startBeats + item.durationBeats;
            if (item.startBeats < endBeats && itemEnd > startBeats) {
              hitItems.push({ objectId: item.objectId, editorTarget: item.editorTarget });
            }
          }
        }
        groupYOff += h;
      }
      groupYOff += GROUP_SPACER;
    }

    if (hitItems.length === 0) return;
    const store = useScoreSelectionStore.getState();
    if (m.additive) {
      // Shift = additive: union with the existing selection.
      const merged = { ...store.selectedObjectTargets };
      for (const it of hitItems) merged[it.objectId] = it.editorTarget;
      store.setSelection(
        Object.entries(merged).map(([objectId, editorTarget]) => ({ objectId, editorTarget })),
      );
    } else {
      store.setSelection(hitItems);
    }
  }, [contentXY, effectiveLayerGroups, pixelsPerBeat]);

  // Capture-phase window listeners keep the marquee alive outside the panel and
  // are not blocked by child canvases' stopPropagation.
  const bgMarqueeMoveRef = useRef(handleBgMarqueeMove);
  const bgMarqueeUpRef = useRef(handleBgMarqueeUp);
  bgMarqueeMoveRef.current = handleBgMarqueeMove;
  bgMarqueeUpRef.current = handleBgMarqueeUp;
  const bgMarqueeActive = bgMarquee !== null;
  useLayoutEffect(() => {
    if (!bgMarqueeActive) return;
    const onMove = (e: MouseEvent) => bgMarqueeMoveRef.current(e.clientX, e.clientY);
    const onUp = () => bgMarqueeUpRef.current();
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
    };
  }, [bgMarqueeActive]);

  const handleTimelineHeaderScroll = useCallback(() => {
    const header = timelineHeaderRef.current;
    if (header) {
      classifyHorizontalScroll('header', header);
      // Synchronizing the body below writes horizontally; mark it expected so
      // the induced body scroll event is not classified as navigation.
      expectedHorizontalScrollsRef.current.body = header.scrollLeft;
      synchronizeHorizontalScroll(header.scrollLeft);
    }
  }, [synchronizeHorizontalScroll, classifyHorizontalScroll]);

  const handleLeftHeaderScroll = useCallback(() => {
    const timeline = scrollContainerRef.current;
    const left = leftHeaderRef.current;
    if (timeline && left) {
      timeline.scrollTop = left.scrollTop;
    }
  }, [scrollContainerRef]);

  const handleRulerConfigApply = useCallback((changes: RulerConfigChanges) => {
    setTimeState((prev) => ({
      ...prev,
      primaryTimeDisplay: changes.primaryTimeDisplay,
      secondaryRulerEnabled: changes.secondaryRulerEnabled,
      secondaryTimeDisplay: changes.secondaryTimeDisplay,
      smpteFrameRate: changes.smpteFrameRate,
    }));
    useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateTimeState',
        patch: {
          primaryTimeDisplay: changes.primaryTimeDisplay,
          secondaryRulerEnabled: changes.secondaryRulerEnabled,
          secondaryTimeDisplay: changes.secondaryTimeDisplay,
          smpteFrameRate: changes.smpteFrameRate,
          scoreObjectUpdateMode: changes.scoreObjectUpdateMode,
          markerUpdateMode: changes.markerUpdateMode,
        },
      },
    });
  }, []);

  const handleRowVisibilityChange = useCallback((key: RowVisibilityKey, value: boolean) => {
    setTimeState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTempoEnabledChange = useCallback((enabled: boolean) => {
    useProjectStore.getState().applyProjectDocumentPatch({ transport: { tempoMap: { enabled } } });
  }, []);

  const handleTempoVisibleChange = useCallback((visible: boolean) => {
    useProjectStore.getState().applyProjectDocumentPatch({ transport: { tempoMap: { visible } } });
  }, []);

  const handleTempoPatch = useCallback((patch: TempoMapPatch) => {
    useProjectStore.getState().applyProjectDocumentPatch({ transport: { tempoMapPatch: patch } });
  }, []);

  const handleMeterPatch = useCallback((patch: MeterMapPatch) => {
    useProjectStore.getState().applyProjectDocumentPatch({ transport: { meterMapPatch: patch } });
  }, []);

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-app-text-muted text-role-body">
        No project loaded
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-app-bg text-app-text">
      <ScoreToolbar
        mode={mode}
        onModeChange={setMode}
        pathSegments={session.segments}
        onNavigateToSegment={navigateToSegment}
        onNavigateToRoot={navigateToRoot}
        snapEnabled={snapEnabled}
        snapValue={snapValue}
        onSnapToggle={handleSnapToggle}
        onSnapValueChange={handleSnapValueChange}
        onRulerConfig={() => setRulerDialogOpen(true)}
        onOpenNoteProcessorChain={(scope, groupId) => {
          if (scope === 'rootScore') {
            setChainDialogTarget({ scope: 'rootScore' });
          } else if (groupId) {
            setChainDialogTarget({ scope: 'layerGroup', groupId });
          }
        }}
        getSegmentNoteProcessorChain={(index: number) => {
          if (index === 0) return score.rootNoteProcessorChain;
          const group = effectiveLayerGroups.find((g) => g.groupId === session.segments[index]?.groupId);
          return group?.noteProcessorChain;
        }}
      />
      <SplitPane
        ariaLabel="Resize score layer headers and timeline"
        className="flex-1 min-h-0 bg-app-canvas"
        firstClassName="min-h-0"
        secondClassName="min-w-0"
        splitId="score.main"
        controlledPane="first"
        defaultSizePx={200}
        minFirstSize={80}
        minSecondSize={200}
        orientation="horizontal"
        first={
          <LeftPanel
            timeState={timeState}
            tempoMapEnabled={transport.tempoMap.enabled}
            tempoMapVisible={transport.tempoMap.visible}
            onTempoEnabledChange={handleTempoEnabledChange}
            onTempoVisibleChange={handleTempoVisibleChange}
            onRowVisibilityChange={handleRowVisibilityChange}
            layerGroups={effectiveLayerGroups}
            visibleLayers={visibleLayers}
            scopeKey={scopeKey}
            projectSessionId={sessionId}
            projectRevision={getProjectDocumentRevision()}
            leftHeaderRef={leftHeaderRef}
            onLeftScroll={handleLeftHeaderScroll}
            onManage={() => setManageDialogOpen(true)}
            onLayerGroupNoteProcessorChain={(groupId) => setChainDialogTarget({ scope: 'layerGroup', groupId })}
            onSoundLayerNoteProcessorChain={(groupId, layerIndex, trackId) => setChainDialogTarget(
              trackId ? { scope: 'track', groupId, trackId, layerIndex } : { scope: 'soundLayer', groupId, layerIndex },
            )}
          />
        }
        second={
          <div className="h-full w-full flex flex-col">
            <div
              ref={timelineHeaderRef}
              data-score-timeline-header
              className="shrink-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onScroll={handleTimelineHeaderScroll}
            >
              <ColumnHeader
                timeState={timeState}
                markers={score.markers}
                meters={transport.meterMap.entries}
                meterMap={transport.meterMap}
                tempoMap={transport.tempoMap}
                totalBeats={totalBeats}
                pixelsPerBeat={pixelsPerBeat}
                sampleRate={transport.sampleRate}
                renderStartTime={transport.renderStartTime}
                renderEndTime={transport.renderEndTime}
                snapEnabled={snapEnabled}
                snapValue={snapValue}
                timePointerBeats={timePointerBeats}
                scrollContainerRef={scrollContainerRef}
                rootTimelineOnly={isRootTimeline}
                tempo={initialTempo}
                rulerMouseDown={rulerMouseDown}
                onTempoPatch={handleTempoPatch}
                onMeterPatch={handleMeterPatch}
              />
            </div>
            <div className="relative flex-1 min-h-0">
              <div
                ref={scrollContainerRef}
                data-library-autoscroll
                className="score-timeline-scroll absolute inset-0 overflow-auto"
                onScroll={handleTimelineScroll}
                onMouseDownCapture={() => {
                  void stopAuditioning();
                }}
                onMouseDown={handleTimelineBackgroundMouseDown}
              >
                <LayerPanel
                  layerGroups={effectiveLayerGroups}
                  onOpenNested={navigateToGroup}
                  projectSessionId={sessionId}
                  projectRevision={getProjectDocumentRevision()}
                  scoreRootGroupId={activeSegment?.scorePath?.rootGroupId}
                  scoreContainerPath={activeSegment?.scorePath?.containerPath}
                  mode={mode}
                  pixelsPerBeat={pixelsPerBeat}
                  totalBeats={totalBeats}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  meterMap={transport.meterMap}
                  tempoMap={transport.tempoMap}
                  tempo={
                    transport.tempoMap.points.length > 0
                      ? transport.tempoMap.points[0].tempo
                      : 60
                  }
                  smpteFrameRate={timeState.smpteFrameRate || 24}
                />
              </div>
              <ScoreOverlayLines
                renderStartTime={transport.renderStartTime}
                renderEndTime={transport.renderEndTime}
                timePointerBeats={timePointerBeats}
                pixelsPerBeat={pixelsPerBeat}
                totalBeats={totalBeats}
                scrollLeft={scrollOverlayLeft}
              />
              {(() => {
                if (!bgMarquee) return null;
                const rect = scrollContainerRef.current?.getBoundingClientRect();
                if (!rect) return null;
                return (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: Math.min(bgMarquee.startClientX, bgMarquee.endClientX) - rect.left,
                      top: Math.min(bgMarquee.startClientY, bgMarquee.endClientY) - rect.top,
                      width: Math.abs(bgMarquee.endClientX - bgMarquee.startClientX),
                      height: Math.abs(bgMarquee.endClientY - bgMarquee.startClientY),
                      zIndex: 20,
                      backgroundColor:
                        "color-mix(in srgb, var(--color-app-text-strong) 6%, var(--color-app-clear))",
                      border:
                        "1px solid color-mix(in srgb, var(--color-app-text-strong) 50%, var(--color-app-clear))",
                    }}
                  />
                );
              })()}
            </div>
          </div>
        }
      />

      {rulerDialogOpen && (
        <RulerConfigDialog
          timeState={timeState}
          onApply={handleRulerConfigApply}
          onClose={() => setRulerDialogOpen(false)}
        />
      )}

      {manageDialogOpen && (
        <ScoreManagerDialog
          score={score}
          onClose={() => setManageDialogOpen(false)}
        />
      )}

      {tempoMapEditorOpen && (
        <TempoMapEditorDialog
          tempoMap={transport.tempoMap}
          timeContext={{
            meterEntries: transport.meterMap.entries.map((entry) => ({
              measure: entry.measure,
              numBeats: entry.numBeats,
              beatLength: entry.beatLength,
            })),
            tempoEnabled: transport.tempoMap.enabled,
            initialTempo: transport.tempoMap.points[0]?.tempo ?? 60,
            sampleRate: transport.sampleRate,
          }}
          onCommit={handleTempoPatch}
          onClose={() => setTempoMapEditorOpen(false)}
        />
      )}

      {meterMapEditorOpen && (
        <MeterMapEditorDialog
          meterMap={transport.meterMap}
          onCommit={handleMeterPatch}
          onClose={() => setMeterMapEditorOpen(false)}
        />
      )}
      {chainDialogTarget && (
        <ChainDialogWrapper
          target={chainDialogTarget}
          onClose={() => setChainDialogTarget(null)}
        />
      )}
    </div>
  );
}

interface LeftPanelProps {
  timeState: ScoreDocumentSnapshot["timeState"];
  tempoMapEnabled: boolean;
  tempoMapVisible: boolean;
  onTempoEnabledChange: (enabled: boolean) => void;
  onTempoVisibleChange: (visible: boolean) => void;
  onRowVisibilityChange: (key: 'tempoRowVisible' | 'meterRowVisible' | 'markersRowVisible', value: boolean) => void;
  layerGroups: ScoreLayerGroupSnapshot[];
  visibleLayers?: VisibleLayerRef[];
  scopeKey?: string;
  projectSessionId: number;
  projectRevision: number;
  leftHeaderRef: React.RefObject<HTMLDivElement | null>;
  onLeftScroll: () => void;
  onManage: () => void;
  onLayerGroupNoteProcessorChain: (groupId: string) => void;
  onSoundLayerNoteProcessorChain: (groupId: string, layerIndex: number, trackId?: string) => void;
}

function LeftPanel({
  timeState,
  tempoMapEnabled,
  tempoMapVisible,
  onTempoEnabledChange,
  onTempoVisibleChange,
  onRowVisibilityChange,
  layerGroups,
  visibleLayers,
  scopeKey,
  projectSessionId,
  projectRevision,
  leftHeaderRef,
  onLeftScroll,
  onManage,
  onLayerGroupNoteProcessorChain,
  onSoundLayerNoteProcessorChain,
}: LeftPanelProps) {
  const visibleGroups = layerGroups;
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const [pendingRemovalPlan, setPendingRemovalPlan] = useState<LayerRemovalPlan | null>(null);

  const handleRemovalConfirm = useCallback((deleteEmptyLayerGroups: boolean) => {
    if (!pendingRemovalPlan) return;
    void applyProjectDocumentPatch({
      score: createRemoveLayerRangesPatch(pendingRemovalPlan, deleteEmptyLayerGroups),
    });
    setPendingRemovalPlan(null);
  }, [applyProjectDocumentPatch, pendingRemovalPlan]);

  return (
    <div className="h-full flex flex-col bg-blue-surface border-r border-blue-border/40">
      <div className="shrink-0 flex flex-col">
        {timeState.tempoRowVisible && (
          <>
            <RowHeader onContextMenu={onRowVisibilityChange} rowVisibility={timeState}>
              <label className="flex items-center gap-1.5 text-role-callout text-blue-muted cursor-pointer select-none">
                <input type="checkbox" className="w-2.5 h-2.5" checked={tempoMapEnabled} onChange={(e) => onTempoEnabledChange(e.target.checked)} />
                Use Tempo
              </label>
              <button
                className="group w-fit h-3.5 flex items-center justify-center cursor-pointer text-blue-muted hover:text-white"
                title="Toggle tempo editor"
                onClick={() => onTempoVisibleChange(!tempoMapVisible)}
              >
                {tempoMapVisible ? <ChevronDown size={10} className="text-blue-text group-hover:text-white" /> : <ChevronRight size={10} className="group-hover:text-white" />}
              </button>
            </RowHeader>
            {tempoMapVisible && (
              <div className="border-b border-app-border-muted bg-blue-surface/30" style={{ height: 80 }} />
            )}
          </>
        )}
        {timeState.meterRowVisible && (
          <RowHeader onContextMenu={onRowVisibilityChange} borderLeft rowVisibility={timeState}>
            <span className="text-role-callout text-blue-muted">Time Signature</span>
          </RowHeader>
        )}
        {timeState.markersRowVisible && (
          <RowHeader onContextMenu={onRowVisibilityChange} borderLeft rowVisibility={timeState}>
            <span className="text-role-callout text-blue-muted">Markers</span>
          </RowHeader>
        )}
        <RowHeader onContextMenu={onRowVisibilityChange} center rowVisibility={timeState}>
          <button
            className="text-role-callout text-blue-muted hover:text-blue-text px-2 py-0 border border-blue-border/30 rounded-sm bg-blue-surface/50 hover:bg-blue-surface"
            onClick={onManage}
          >
            Manage
          </button>
        </RowHeader>
        {timeState.secondaryRulerEnabled && (
          <div className="h-5 border-b border-app-border-muted bg-blue-surface/30" />
        )}
      </div>

      <div
        ref={leftHeaderRef}
        data-layer-headers-list
        tabIndex={0}
        className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden focus:outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={onLeftScroll}
        onFocus={() => useLayerSelectionStore.getState().setKeyboardFocus(true)}
        onBlur={() => useLayerSelectionStore.getState().setKeyboardFocus(false)}
        onKeyDown={(event) => {
          const eventTarget = event.target as HTMLElement | null;
          if (eventTarget?.closest('input, textarea, [contenteditable="true"]')) {
            return;
          }

          const currentVisibleLayers = visibleLayers ?? [];
          if (event.altKey && event.key === 'ArrowUp') {
            event.preventDefault();
            const ranges = useLayerSelectionStore.getState().getSelectedRanges(currentVisibleLayers);
            const availability = getLayerOperationAvailability(visibleGroups, ranges);
            if (availability.canPushUp && ranges.length === 1) {
              const r = ranges[0]!;
              void applyProjectDocumentPatch({
                score: createMoveLayerRangePatch(r, r.startIndex - 1),
              });
            }
          } else if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault();
            const ranges = useLayerSelectionStore.getState().getSelectedRanges(currentVisibleLayers);
            const availability = getLayerOperationAvailability(visibleGroups, ranges);
            if (availability.canPushDown && ranges.length === 1) {
              const r = ranges[0]!;
              void applyProjectDocumentPatch({
                score: createMoveLayerRangePatch(r, r.startIndex + 1),
              });
            }
          } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            const ranges = useLayerSelectionStore.getState().getSelectedRanges(currentVisibleLayers);
            if (ranges.length > 0) {
              const plan = buildLayerRemovalPlan(visibleGroups, ranges);
              if (plan.totalLayerCount > 0) {
                setPendingRemovalPlan(plan);
              }
            }
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            useLayerSelectionStore.getState().moveFocus('up', currentVisibleLayers, event.shiftKey, scopeKey);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            useLayerSelectionStore.getState().moveFocus('down', currentVisibleLayers, event.shiftKey, scopeKey);
          }
        }}
      >
        {visibleGroups.map((group, gi) => {
          const spacer = (
            <SpacerPanel
              key={`spacer-${group.groupId}`}
              groupId={group.groupId}
              groupIndex={gi}
              totalGroups={visibleGroups.length}
              layerCount={group.layers.length}
              onNoteProcessorChain={group.groupType === 'polyObject' ? () => onLayerGroupNoteProcessorChain(group.groupId) : undefined}
              noteProcessorChain={group.noteProcessorChain}
            />
          );

          return (
            <div key={group.groupId}>
              {group.groupType === 'patterns'
                ? group.layers.map((layer, li) => (
                  <PatternLayerHeader
                    key={layer.layerId}
                    layer={layer}
                    groupId={group.groupId}
                    layerIndex={li}
                    layerCount={group.layers.length}
                    layerGroups={visibleGroups}
                    visibleLayers={visibleLayers}
                    scopeKey={scopeKey}
                  />
                ))
                : group.layers.map((layer, li) => (
                  <SoundLayerHeader
                    key={layer.layerId}
                    layer={layer}
                    groupType={group.groupType}
                    groupId={group.groupId}
                    layerIndex={li}
                    layerCount={group.layers.length}
                    layerGroups={visibleGroups}
                    rootGroupIndex={gi}
                    projectSessionId={projectSessionId}
                    projectRevision={projectRevision}
                    visibleLayers={visibleLayers}
                    scopeKey={scopeKey}
                    onNoteProcessorChain={(groupId, layerIndex) => onSoundLayerNoteProcessorChain(
                      groupId,
                      layerIndex,
                      group.groupType === 'track' ? layer.layerId : undefined,
                    )}
                    noteProcessorChain={layer.noteProcessorChain}
                  />
                ))}
              {spacer}
            </div>
          );
        })}
      </div>
      {pendingRemovalPlan && (
        <LayerRemovalConfirmationDialog
          plan={pendingRemovalPlan}
          onCancel={() => setPendingRemovalPlan(null)}
          onConfirm={handleRemovalConfirm}
        />
      )}
    </div>
  );
}

type RowVisibilityKey = 'tempoRowVisible' | 'meterRowVisible' | 'markersRowVisible';

function RowHeader({
  onContextMenu,
  borderLeft,
  center,
  children,
  rowVisibility,
}: {
  onContextMenu: (key: RowVisibilityKey, value: boolean) => void;
  borderLeft?: boolean;
  center?: boolean;
  children: React.ReactNode;
  rowVisibility: { tempoRowVisible: boolean; meterRowVisible: boolean; markersRowVisible: boolean };
}) {
  const ctxItemClass = 'editor-context-menu__item';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`h-5 border-b border-app-border-muted flex items-center ${center ? 'justify-center' : 'justify-end pr-2'} bg-blue-surface/30 ${borderLeft ? 'border-l-2 border-l-blue-border/30' : !center ? 'gap-1' : ''}`}
        >
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu">
          <ContextMenu.CheckboxItem
            className={ctxItemClass}
            checked={rowVisibility.tempoRowVisible}
            onCheckedChange={(checked) => onContextMenu('tempoRowVisible', checked === true)}
            onPointerDown={(e) => e.preventDefault()}
          >
            <ContextMenu.ItemIndicator className="flex items-center justify-center w-4">
              <Check size={12} strokeWidth={2.5} />
            </ContextMenu.ItemIndicator>
            Show Tempo Row
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem
            className={ctxItemClass}
            checked={rowVisibility.meterRowVisible}
            onCheckedChange={(checked) => onContextMenu('meterRowVisible', checked === true)}
            onPointerDown={(e) => e.preventDefault()}
          >
            <ContextMenu.ItemIndicator className="flex items-center justify-center w-4">
              <Check size={12} strokeWidth={2.5} />
            </ContextMenu.ItemIndicator>
            Show Meter Row
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem
            className={ctxItemClass}
            checked={rowVisibility.markersRowVisible}
            onCheckedChange={(checked) => onContextMenu('markersRowVisible', checked === true)}
            onPointerDown={(e) => e.preventDefault()}
          >
            <ContextMenu.ItemIndicator className="flex items-center justify-center w-4">
              <Check size={12} strokeWidth={2.5} />
            </ContextMenu.ItemIndicator>
            Show Markers Row
          </ContextMenu.CheckboxItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function SpacerPanel({
  groupId,
  groupIndex,
  totalGroups,
  layerCount,
  onNoteProcessorChain,
  noteProcessorChain,
}: {
  groupId: string;
  groupIndex: number;
  totalGroups: number;
  layerCount: number;
  onNoteProcessorChain?: () => void;
  noteProcessorChain?: NoteProcessorChainSnapshot;
}) {
  const addLayer = useProjectStore((s) => s.addLayer);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const ctxItemClass = 'editor-context-menu__item';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className="group relative flex items-center justify-center border-b border-app-border-muted bg-blue-surface/10 hover:bg-blue-surface/30 cursor-pointer"
          style={{ height: GROUP_SPACER }}
          onDoubleClick={() => addLayer(groupId, layerCount - 1)}
        >
          <Plus className="h-3.5 w-3.5 text-blue-muted opacity-0 group-hover:opacity-60 select-none" />
          {onNoteProcessorChain && (
            <button
              className="relative w-4 h-4 text-role-callout font-bold text-blue-muted hover:text-blue-text opacity-0 group-hover:opacity-100"
              title="Layer Group Note Processors"
              onClick={(e) => {
                e.stopPropagation();
                onNoteProcessorChain();
              }}
            >
              N
              {noteProcessorChain && noteProcessorChain.processors.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-red-500" />
              )}
            </button>
          )}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu">
          <ContextMenu.Item
            className={ctxItemClass}
            onSelect={() => addLayer(groupId, layerCount - 1)}
          >
            Add Layer
          </ContextMenu.Item>
          {groupIndex > 0 && (
            <ContextMenu.Item
              className={ctxItemClass}
              onSelect={() => {
                void applyProjectDocumentPatch({
                  score: { type: 'moveLayerGroup', groupId, targetIndex: groupIndex - 1 },
                });
              }}
            >
              Move Layer Group Up
            </ContextMenu.Item>
          )}
          {groupIndex < totalGroups - 1 && (
            <ContextMenu.Item
              className={ctxItemClass}
              onSelect={() => {
                void applyProjectDocumentPatch({
                  score: { type: 'moveLayerGroup', groupId, targetIndex: groupIndex + 1 },
                });
              }}
            >
              Move Layer Group Down
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function SoundLayerHeader({
  layer,
  groupType,
  groupId,
  layerIndex,
  layerCount,
  layerGroups,
  rootGroupIndex,
  projectSessionId,
  projectRevision,
  visibleLayers,
  scopeKey,
  onNoteProcessorChain,
  noteProcessorChain,
}: {
  layer: ScoreLayerSnapshot;
  groupType: ScoreLayerGroupSnapshot['groupType'];
  groupId: string;
  layerIndex: number;
  layerCount: number;
  layerGroups?: ScoreLayerGroupSnapshot[];
  rootGroupIndex: number;
  projectSessionId: number;
  projectRevision: number;
  visibleLayers?: VisibleLayerRef[];
  scopeKey?: string;
  onNoteProcessorChain?: (groupId: string, layerIndex: number) => void;
  noteProcessorChain?: NoteProcessorChainSnapshot;
}) {
  const setLayerMute = useProjectStore((s) => s.setLayerMute);
  const setLayerSolo = useProjectStore((s) => s.setLayerSolo);
  const renameLayer = useProjectStore((s) => s.renameLayer);
  const setLayerHeight = useProjectStore((s) => s.setLayerHeight);
  const addLayer = useProjectStore((s) => s.addLayer);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);

  const layerSelectionId = getLayerSelectionId(layer);
  const selectionKey = buildSelectionKey(groupId, layerSelectionId);
  const selectedKeys = useLayerSelectionStore((state) => state.selectedKeys);
  const isLayerSelected = selectedKeys.has(selectionKey);
  const selectSingle = useLayerSelectionStore((state) => state.selectSingle);
  const extendTo = useLayerSelectionStore((state) => state.extendTo);

  const fallbackVisibleLayers = useMemo((): VisibleLayerRef[] => [
    {
      scopeKey: scopeKey ?? 'test',
      groupId,
      groupType,
      layerSelectionId,
      layerId: layer.layerId,
      localIndex: layerIndex,
      globalIndex: layerIndex,
      layer,
    },
  ], [groupId, groupType, layer, layerIndex, layerSelectionId, scopeKey]);
  const effectiveVisibleLayers = visibleLayers ?? fallbackVisibleLayers;

  const midiFocused = useMidiRoutingStore((state) => (
    groupType === 'track'
    && state.focusedTarget?.kind === 'track'
    && state.focusedTarget.projectSessionId === projectSessionId
    && state.focusedTarget.rootGroupId === groupId
    && state.focusedTarget.trackId === layer.layerId
  ));

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const height = layer.height || 44;
  const heightIndex = Math.round(height / 22) - 1;
  const showNoteProcessorButton = groupType === 'polyObject' || groupType === 'track';
  const showLayerHeightMenu = groupType === 'polyObject' || groupType === 'track';
  const showAutomationButton = (groupType === 'polyObject' || groupType === 'track') && !!layer.automation;
  const selectedAutomationParameter = layer.automation?.parameters.find(
    (parameter) => parameter.parameterId === layer.automation?.selectedParameterId,
  );
  const showAutomationFooter = showAutomationButton
    && height >= 44
    && !!selectedAutomationParameter
    && (layer.automation?.parameterIds.length ?? 0) > 0;
  const trackInstrument = groupType === 'track' && 'instrument' in layer ? layer.instrument : null;

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (editValue.trim() && editValue !== layer.name) {
      renameLayer(layer.layerId, editValue.trim());
    }
  }, [layer.layerId, layer.name, editValue, renameLayer]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(layer.name);
  }, [layer.name]);

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(layer.name);
      setEditing(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [layer.name],
  );

  const btnClass = (active: boolean, activeBg: string) =>
    `w-5 h-4 text-role-callout font-bold rounded-sm border border-app-border/30 flex items-center justify-center ${active ? activeBg + " text-black" : "bg-transparent text-app-text-muted hover:text-app-text"}`;

  const ctxItemClass = 'editor-context-menu__item';

  const layerRef = {
    rootGroupIndex,
    groupId,
    layerId: layer.layerId,
    layerIndex,
    layerKind: groupType === 'track'
        ? 'track' as const
        : 'soundObject' as const,
  };

  const dispatchAutomationPatch = (patch: ScoreAutomationPatch) => {
    void (async () => {
      await applyProjectDocumentPatch({ score: patch });
      await flushPendingPatches();
    })();
  };

  const handleAutomationPrevNext = (direction: -1 | 1) => {
    if (!layer.automation || layer.automation.parameterIds.length === 0) {
      return;
    }
    const ids = layer.automation.parameterIds;
    const currentIndex = Math.max(0, ids.indexOf(layer.automation.selectedParameterId ?? ''));
    const nextIndex = (currentIndex + direction + ids.length) % ids.length;
    dispatchAutomationPatch({
      type: 'selectLayerAutomation',
      layer: layerRef,
      parameterId: ids[nextIndex],
    });
  };

  const handleAutomationColorChange = (hex: string) => {
    if (!selectedAutomationParameter) {
      return;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lineColor = (0xff << 24) | (r << 16) | (g << 8) | b;
    dispatchAutomationPatch({
      type: 'setAutomationLineColor',
      parameterId: selectedAutomationParameter.parameterId,
      lineColor,
    });
  };

  const selectedAutomationColor = selectedAutomationParameter
    ? `#${((selectedAutomationParameter.lineColor >>> 0) & 0x00ffffff).toString(16).padStart(6, '0')}`
    : '#808080';

  const isFocusKey = useLayerSelectionStore((state) => state.focusKey === selectionKey);
  const keyboardFocus = useLayerSelectionStore((state) => state.keyboardFocus);

  const singleLayerRange = {
    groupId,
    groupType,
    startIndex: layerIndex,
    endIndex: layerIndex,
    layerSelectionIds: [layerSelectionId],
    count: 1,
  };

  const currentRanges = isLayerSelected
    ? deriveSelectedLayerRanges(effectiveVisibleLayers, selectedKeys)
    : [singleLayerRange];
  const effectiveLayerGroups = layerGroups ?? useProjectStore.getState().score.layerGroups;
  const availability = getLayerOperationAvailability(effectiveLayerGroups, currentRanges);
  const removalPlan = buildLayerRemovalPlan(effectiveLayerGroups, currentRanges);
  const [pendingRemovalPlan, setPendingRemovalPlan] = useState<LayerRemovalPlan | null>(null);

  const getContextRanges = () => {
    const currentSelectedKeys = useLayerSelectionStore.getState().selectedKeys;
    return currentSelectedKeys.has(selectionKey)
      ? deriveSelectedLayerRanges(effectiveVisibleLayers, currentSelectedKeys)
      : [singleLayerRange];
  };

  const handleRemovalConfirm = useCallback((deleteEmptyLayerGroups: boolean) => {
    if (!pendingRemovalPlan) return;
    void applyProjectDocumentPatch({
      score: createRemoveLayerRangesPatch(pendingRemovalPlan, deleteEmptyLayerGroups),
    });
    setPendingRemovalPlan(null);
  }, [applyProjectDocumentPatch, pendingRemovalPlan]);

  return (
    <>
    <ContextMenu.Root onOpenChange={(open) => {
      if (open && !isLayerSelected) {
        selectSingle(selectionKey, effectiveVisibleLayers, scopeKey);
      }
    }}>
      <ContextMenu.Trigger asChild>
        <div
          tabIndex={-1}
          data-score-layer-header
          data-layer-id={layer.layerId}
          data-layer-selection-id={layerSelectionId}
          data-midi-focused={midiFocused ? 'true' : undefined}
          data-keyboard-focused={isFocusKey && keyboardFocus ? 'true' : undefined}
          aria-selected={isLayerSelected ? 'true' : 'false'}
          data-selected-layer={isLayerSelected ? 'true' : undefined}
          className={[
            'relative flex items-start overflow-hidden border-b border-l-2 border-app-border-muted select-none focus:outline-none',
            isLayerSelected ? 'border-l-app-accent bg-app-selection' : 'border-l-transparent',
            midiFocused ? 'ring-1 ring-inset ring-app-accent/70' : '',
            isFocusKey && keyboardFocus ? 'ring-1 ring-app-accent/80' : '',
          ].filter(Boolean).join(' ')}
          style={{ height }}
          onDoubleClick={startEdit}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            const target = event.target as HTMLElement;
            if (target.closest('button, input, [data-track-instrument-control]')) return;
            if (event.shiftKey) {
              extendTo(selectionKey, effectiveVisibleLayers, scopeKey);
            } else {
              selectSingle(selectionKey, effectiveVisibleLayers, scopeKey);
            }
            event.currentTarget.focus();
          }}
          onPointerDown={(event) => {
            if (groupType !== 'track' || event.button !== 0) return;
            const target = event.target as HTMLElement;
            if (target.closest('button, [data-track-instrument-control]')) return;
            useMidiRoutingStore.getState().focusTrack({
              projectSessionId,
              rootGroupId: groupId,
              trackId: layer.layerId,
              displayName: layer.name || `Track ${layerIndex + 1}`,
            });
          }}
        >
          {groupType === 'track' && (
            <TrackInstrumentControl
              groupId={groupId}
              trackId={layer.layerId}
              instrument={trackInstrument}
              projectSessionId={projectSessionId}
              projectRevision={projectRevision}
              displayName={layer.name}
            />
          )}
          {editing ? (
            <input
              ref={inputRef}
              className="flex-1 min-w-0 px-1 text-role-body bg-blue-surface/60 text-blue-text outline-none border border-blue-accent/40 rounded-sm mx-1 mt-0.5"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              onBlur={commitEdit}
            />
          ) : (
            <span className={`flex-1 min-w-0 px-1.5 text-role-body text-blue-text truncate pointer-events-none mt-0.5 ${isLayerSelected ? 'text-app-text-strong' : ''}`}>
              {layer.name}
            </span>
          )}
          <div className="shrink-0 flex items-start gap-px mr-1 pt-0.5">
            <button
              className={btnClass(!!layer.muted, 'bg-app-warning')}
              title="Mute"
              style={layer.muted ? { color: 'var(--color-app-text-strong)' } : {}}
              onClick={(e) => {
                e.stopPropagation();
                setLayerMute(groupId, layerIndex, !(layer.muted ?? false));
              }}
            >
              M
            </button>
            <button
              className={btnClass(!!layer.solo, 'bg-app-success')}
              title="Solo"
              style={layer.solo ? { color: 'var(--color-app-text-strong)' } : {}}
              onClick={(e) => {
                e.stopPropagation();
                setLayerSolo(groupId, layerIndex, !(layer.solo ?? false));
              }}
            >
              S
            </button>
            {showNoteProcessorButton && (
              <button
                className={`relative w-5 h-4 text-role-callout font-bold rounded-sm border flex items-center justify-center ${
                  noteProcessorChain && noteProcessorChain.processors.length > 0
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-transparent border-app-border/30 text-app-text-muted hover:text-app-text'
                }`}
                title="Note Processors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onNoteProcessorChain) {
                    onNoteProcessorChain(groupId, layerIndex);
                  }
                }}
              >
                N
              </button>
            )}
            {showAutomationButton && (
              <AutomationTargetMenu
                trigger={
                  <button
                    className={btnClass(false, "")}
                    title="Automation"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    A
                  </button>
                }
                automation={layer.automation}
                layerRef={layerRef}
                onPatch={(patch) => {
                  dispatchAutomationPatch(patch);
                }}
              />
            )}
          </div>
          {showAutomationFooter && (
            <div className="absolute left-1 right-1 top-5 flex h-4 items-center gap-1 text-role-callout text-app-text-muted">
              <ColorPickerButton
                value={selectedAutomationColor}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                title="Automation line color"
                ariaLabel="Automation line color"
                onChange={handleAutomationColorChange}
              />
              <span
                className="max-w-[70px] truncate"
                title={
                  selectedAutomationParameter.targetPath && selectedAutomationParameter.targetPath.length > 0
                    ? selectedAutomationParameter.targetPath.join(' > ')
                    : (selectedAutomationParameter.displayName || selectedAutomationParameter.name)
                }
              >
                {selectedAutomationParameter.displayName || selectedAutomationParameter.name}
              </span>
              <button
                className="w-3.5 h-3.5 bg-blue-surface/40 hover:bg-blue-surface/80 rounded border border-blue-border/30 flex items-center justify-center text-role-callout"
                title="Previous Parameter"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAutomationPrevNext(-1);
                }}
              >
                <ChevronLeft className="h-2.5 w-2.5" />
              </button>
              <button
                className="w-3.5 h-3.5 bg-blue-surface/40 hover:bg-blue-surface/80 rounded border border-blue-border/30 flex items-center justify-center text-role-callout"
                title="Next Parameter"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAutomationPrevNext(1);
                }}
              >
                <ChevronRight className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
         </div>
       </ContextMenu.Trigger>
       <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu">
          {availability.canAdd && (
            <>
              <ContextMenu.Item
                className={ctxItemClass}
                data-layer-add-above
                onSelect={() => addLayer(groupId, layerIndex - 1)}
              >
                Add Layer Above
              </ContextMenu.Item>
              <ContextMenu.Item
                className={ctxItemClass}
                data-layer-add-below
                onSelect={() => addLayer(groupId, layerIndex)}
              >
                Add Layer Below
              </ContextMenu.Item>
            </>
          )}
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item
            className={ctxItemClass}
            disabled={removalPlan.totalLayerCount === 0}
            onSelect={() => {
              const ranges = getContextRanges();
              const plan = buildLayerRemovalPlan(effectiveLayerGroups, ranges);
              if (plan.totalLayerCount === 0) return;
              setPendingRemovalPlan(plan);
            }}
          >
            {removalPlan.totalLayerCount > 1 ? `Remove ${removalPlan.totalLayerCount} Layers` : 'Remove Layer'}
          </ContextMenu.Item>
          <ContextMenu.Item
            className={ctxItemClass}
            disabled={!availability.canPushUp}
            data-push-disabled-reason={getPushDisabledReasonLabel(availability.pushUpDisabledReason)}
            title={getPushDisabledReasonLabel(availability.pushUpDisabledReason)}
            onSelect={() => {
              const ranges = getContextRanges();
              const avail = getLayerOperationAvailability(effectiveLayerGroups, ranges);
              if (!avail.canPushUp || ranges.length !== 1) return;
              const r = ranges[0]!;
              void applyProjectDocumentPatch({
                score: createMoveLayerRangePatch(r, r.startIndex - 1),
              });
            }}
          >
            Push Up
          </ContextMenu.Item>
          <ContextMenu.Item
            className={ctxItemClass}
            disabled={!availability.canPushDown}
            data-push-disabled-reason={getPushDisabledReasonLabel(availability.pushDownDisabledReason)}
            title={getPushDisabledReasonLabel(availability.pushDownDisabledReason)}
            onSelect={() => {
              const ranges = getContextRanges();
              const avail = getLayerOperationAvailability(effectiveLayerGroups, ranges);
              if (!avail.canPushDown || ranges.length !== 1) return;
              const r = ranges[0]!;
              void applyProjectDocumentPatch({
                score: createMoveLayerRangePatch(r, r.startIndex + 1),
              });
            }}
          >
            Push Down
          </ContextMenu.Item>
          {showLayerHeightMenu && (
            <>
              <ContextMenu.Separator className="editor-context-menu__separator" />
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger
                  className={`${ctxItemClass} editor-context-menu__subtrigger`}
                >
                  <span>Layer Height</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent className="editor-context-menu">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                      <ContextMenu.Item
                        key={idx}
                        className={ctxItemClass}
                        onSelect={() => setLayerHeight(groupId, layerIndex, idx)}
                      >
                        <span className="w-4 flex items-center justify-center mr-1">
                          {heightIndex === idx && <Check className="w-3 h-3 text-app-accent" />}
                        </span>
                        <span>{idx + 1}</span>
                      </ContextMenu.Item>
                    ))}
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
    {pendingRemovalPlan && (
      <LayerRemovalConfirmationDialog
        plan={pendingRemovalPlan}
        onCancel={() => setPendingRemovalPlan(null)}
        onConfirm={handleRemovalConfirm}
      />
    )}
    </>
  );
}

function computeTotalBeats(score: ScoreDocumentSnapshot): number {
  let maxBeat = 64;
  for (const lg of score.layerGroups) {
    if (lg.groupType === 'patterns') {
      // Active pattern cells live outside the generic items envelope; keep
      // their derived extent horizontally reachable on the shared timeline.
      maxBeat = Math.max(maxBeat, computePatternExtentBeats(lg));
      continue;
    }
    for (const layer of lg.layers) {
      for (const item of layer.items) {
        maxBeat = Math.max(maxBeat, item.startBeats + item.durationBeats);
      }
    }
  }
  return maxBeat + 16;
}
