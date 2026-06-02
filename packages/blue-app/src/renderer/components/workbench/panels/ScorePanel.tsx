import { useRef, useCallback, useState, useEffect } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Check, ChevronRight, ChevronDown } from "lucide-react";
import { useProjectStore } from "../../../stores/project-store";
import type {
  ScoreDocumentSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreLayerSnapshot,
  PolyObjectLayerGroupSnapshot,
} from "./score/types";
import type { TempoMapSnapshot, TempoMapPatch, MeterMapPatch, NoteProcessorChainSnapshot } from "../../../../shared/project-editor";
import type { SnapValueName } from "@blue/data";
import type { RulerConfigChanges } from "./score/RulerConfigDialog";
import SplitPane from "./orchestra/SplitPane";
import ScoreToolbar from "./score/ScoreToolbar";
import RulerConfigDialog from "./score/RulerConfigDialog";
import ScoreManagerDialog from "./score/ScoreManagerDialog";
import TempoMapEditorDialog from "./score/TempoMapEditorDialog";
import MeterMapEditorDialog from "./score/MeterMapEditorDialog";
import ColumnHeader from "./score/ColumnHeader";
import LayerPanel from "./score/LayerPanel";
import { useScorePathState } from "./score/useScorePathState";
import { useScoreSelectionStore } from "../../../stores/score-selection-store";
import { useScoreRulerSelection } from "./score/useScoreRulerSelection";
import { usePlaybackStore } from "../../../stores/playback-store";
import ScoreOverlayLines from "./score/ScoreOverlayLines";
import NoteProcessorChainDialog from "./score-object/note-processors/NoteProcessorChainDialog";

type ChainDialogTarget =
  | { scope: 'soundLayer'; groupId: string; layerIndex: number }
  | { scope: 'layerGroup'; groupId: string }
  | { scope: 'rootScore' };

function ChainDialogWrapper({ target, onClose }: { target: ChainDialogTarget; onClose: () => void }) {
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const score = useProjectStore((s) => s.score);

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
    } else if (target.scope === 'layerGroup') {
      void applyProjectDocumentPatch({
        score: { type: 'replaceScopedNoteProcessorChain', scope: 'layerGroup', groupId: target.groupId, chain: updated },
      });
    } else {
      void applyProjectDocumentPatch({
        score: { type: 'replaceScopedNoteProcessorChain', scope: 'rootScore', chain: updated },
      });
    }
  }, [target, applyProjectDocumentPatch]);

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
  const [chainDialogTarget, setChainDialogTarget] = useState<{ scope: 'soundLayer'; groupId: string; layerIndex: number } | { scope: 'layerGroup'; groupId: string } | { scope: 'rootScore' } | null>(null);

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

  const pixelsPerBeat = computePixelsPerBeat(timeState.zoomIterations);
  const totalBeats = computeTotalBeats(score);
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
  });

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackStatus = usePlaybackStore((s) => s.status);
  const playbackClock = usePlaybackStore((s) => s.clock);
  const clockElapsed = usePlaybackStore((s) => s.display.elapsedSeconds);
  const followPlayback = usePlaybackStore((s) => s.followPlayback);
  const transportAnchor = usePlaybackStore((s) => s.transportAnchor);
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
      + elapsedSecondsToBeats(clockElapsed, livePlayheadTransport.tempoMap)
    : null;

  useEffect(() => {
    if (
      !followPlayback ||
      !isPlaying ||
      !isRootTimeline ||
      timePointerBeats == null
    ) {
      return;
    }

    const timeline = scrollContainerRef.current;
    if (!timeline) {
      return;
    }

    const pointerPixel = timePointerBeats * pixelsPerBeat;
    const leadPadding = Math.max(96, timeline.clientWidth * 0.35);
    const leftVisible = timeline.scrollLeft + 48;
    const rightVisible = timeline.scrollLeft + timeline.clientWidth - leadPadding;

    if (pointerPixel >= leftVisible && pointerPixel <= rightVisible) {
      return;
    }

    const targetScrollLeft = Math.max(0, pointerPixel - leadPadding);
    if (Math.abs(targetScrollLeft - timeline.scrollLeft) < 1) {
      return;
    }

    timeline.scrollLeft = targetScrollLeft;
  }, [
    followPlayback,
    isPlaying,
    isRootTimeline,
    timePointerBeats,
    pixelsPerBeat,
    scrollContainerRef,
  ]);

  useEffect(() => {
    if (scrollToBeatTarget == null || !scrollContainerRef.current) return;
    const pointerPixel = scrollToBeatTarget * pixelsPerBeat;
    const w = scrollContainerRef.current.clientWidth;
    const newX = Math.max(0, pointerPixel - (w / 8));
    scrollContainerRef.current.scrollLeft = newX;
    clearScrollTarget(null);
  }, [scrollToBeatTarget, pixelsPerBeat, scrollContainerRef, clearScrollTarget]);

  const handleTimelineScroll = useCallback(() => {
    const timeline = scrollContainerRef.current;
    const left = leftHeaderRef.current;
    const header = timelineHeaderRef.current;
    if (timeline) {
      if (left) left.scrollTop = timeline.scrollTop;
      if (header) header.scrollLeft = timeline.scrollLeft;
      setScrollOverlayLeft(timeline.scrollLeft);
    }
  }, [scrollContainerRef]);

  const handleTimelineHeaderScroll = useCallback(() => {
    const timeline = scrollContainerRef.current;
    const header = timelineHeaderRef.current;
    if (timeline && header) {
      timeline.scrollLeft = header.scrollLeft;
    }
  }, [scrollContainerRef]);

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
      <div className="h-full flex items-center justify-center text-app-text-muted text-sm">
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
        onSnapToggle={setSnapEnabled}
        onSnapValueChange={setSnapValue}
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
        initialSplit={0.19}
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
            leftHeaderRef={leftHeaderRef}
            onLeftScroll={handleLeftHeaderScroll}
            onManage={() => setManageDialogOpen(true)}
            onLayerGroupNoteProcessorChain={(groupId) => setChainDialogTarget({ scope: 'layerGroup', groupId })}
            onSoundLayerNoteProcessorChain={(groupId, layerIndex) => setChainDialogTarget({ scope: 'soundLayer', groupId, layerIndex })}
          />
        }
        second={
          <div className="h-full w-full flex flex-col">
            <div
              ref={timelineHeaderRef}
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
                className="score-timeline-scroll absolute inset-0 overflow-auto"
                onScroll={handleTimelineScroll}
              >
                <LayerPanel
                  layerGroups={effectiveLayerGroups}
                  onOpenNested={navigateToGroup}
                  pixelsPerBeat={pixelsPerBeat}
                  totalBeats={totalBeats}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  meterMap={transport.meterMap}
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
  leftHeaderRef: React.RefObject<HTMLDivElement | null>;
  onLeftScroll: () => void;
  onManage: () => void;
  onLayerGroupNoteProcessorChain: (groupId: string) => void;
  onSoundLayerNoteProcessorChain: (groupId: string, layerIndex: number) => void;
}

function LeftPanel({
  timeState,
  tempoMapEnabled,
  tempoMapVisible,
  onTempoEnabledChange,
  onTempoVisibleChange,
  onRowVisibilityChange,
  layerGroups,
  leftHeaderRef,
  onLeftScroll,
  onManage,
  onLayerGroupNoteProcessorChain,
  onSoundLayerNoteProcessorChain,
}: LeftPanelProps) {
  const visibleGroups = layerGroups;

  return (
    <div className="h-full flex flex-col bg-blue-surface border-r border-blue-border/40">
      <div className="shrink-0 flex flex-col">
        {timeState.tempoRowVisible && (
          <>
            <RowHeader onContextMenu={onRowVisibilityChange} rowVisibility={timeState}>
              <label className="flex items-center gap-1.5 text-micro text-blue-muted cursor-pointer select-none">
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
              <div className="border-b border-blue-border/20 bg-blue-surface/30" style={{ height: 80 }} />
            )}
          </>
        )}
        {timeState.meterRowVisible && (
          <RowHeader onContextMenu={onRowVisibilityChange} borderLeft rowVisibility={timeState}>
            <span className="text-micro text-blue-muted">Time Signature</span>
          </RowHeader>
        )}
        {timeState.markersRowVisible && (
          <RowHeader onContextMenu={onRowVisibilityChange} borderLeft rowVisibility={timeState}>
            <span className="text-micro text-blue-muted">Markers</span>
          </RowHeader>
        )}
        <RowHeader onContextMenu={onRowVisibilityChange} center rowVisibility={timeState}>
          <button
            className="text-micro text-blue-muted hover:text-blue-text px-2 py-0 border border-blue-border/30 rounded-sm bg-blue-surface/50 hover:bg-blue-surface"
            onClick={onManage}
          >
            Manage
          </button>
        </RowHeader>
        {timeState.secondaryRulerEnabled && (
          <div className="h-5 border-b border-blue-border/20 bg-blue-surface/30" />
        )}
      </div>

      <div
        ref={leftHeaderRef}
        className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={onLeftScroll}
      >
        {visibleGroups.map((group, gi) => {
          const spacer = (
            <SpacerPanel
              key={`spacer-${group.groupId}`}
              groupId={group.groupId}
              groupIndex={gi}
              totalGroups={visibleGroups.length}
              layerCount={group.layers.length}
              onNoteProcessorChain={group.groupType === 'audio' ? undefined : () => onLayerGroupNoteProcessorChain(group.groupId)}
              noteProcessorChain={group.noteProcessorChain}
            />
          );

          return (
            <div key={group.groupId}>
              {group.layers.map((layer, li) => (
                <SoundLayerHeader
                  key={layer.layerId}
                  layer={layer}
                  groupType={group.groupType}
                  groupId={group.groupId}
                  layerIndex={li}
                  onNoteProcessorChain={onSoundLayerNoteProcessorChain}
                  noteProcessorChain={layer.noteProcessorChain}
                />
              ))}
              {spacer}
            </div>
          );
        })}
      </div>

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
  const ctxItemClass =
    'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1 text-body text-blue-text outline-none data-[highlighted]:bg-app-highlight';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`h-5 border-b border-blue-border/20 flex items-center ${center ? 'justify-center' : 'justify-end pr-2'} bg-blue-surface/30 ${borderLeft ? 'border-l-2 border-l-blue-border/30' : !center ? 'gap-1' : ''}`}
        >
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-45 rounded-md border border-blue-border/50 bg-app-menu p-1 shadow-xl">
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
  const ctxItemClass =
    'cursor-pointer rounded-sm px-3 py-1 text-body text-blue-text outline-none data-[highlighted]:bg-app-highlight';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className="group relative flex items-center justify-center border-b border-blue-border/10 bg-blue-surface/10 hover:bg-blue-surface/30 cursor-pointer"
          style={{ height: GROUP_SPACER }}
          onDoubleClick={() => addLayer(groupId, layerCount - 1)}
        >
          <span className="text-sm text-blue-muted opacity-0 group-hover:opacity-60 select-none">
            +
          </span>
          {onNoteProcessorChain && (
            <button
              className="relative w-4 h-4 text-tiny font-bold text-blue-muted hover:text-blue-text opacity-0 group-hover:opacity-100"
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
        <ContextMenu.Content className="z-50 min-w-45 rounded border border-blue-border/50 bg-app-menu py-1 shadow-lg">
          <ContextMenu.Item
            className={ctxItemClass}
            onSelect={() => addLayer(groupId, layerCount - 1)}
          >
            Add Layer
          </ContextMenu.Item>
          {groupIndex > 0 && (
            <ContextMenu.Item
              className={ctxItemClass}
              onSelect={() => alert("Not yet implemented")}
            >
              Move Layer Group Up
            </ContextMenu.Item>
          )}
          {groupIndex < totalGroups - 1 && (
            <ContextMenu.Item
              className={ctxItemClass}
              onSelect={() => alert("Not yet implemented")}
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
  onNoteProcessorChain,
  noteProcessorChain,
}: {
  layer: ScoreLayerSnapshot;
  groupType: ScoreLayerGroupSnapshot['groupType'];
  groupId: string;
  layerIndex: number;
  onNoteProcessorChain?: (groupId: string, layerIndex: number) => void;
  noteProcessorChain?: NoteProcessorChainSnapshot;
}) {
  const setLayerMute = useProjectStore((s) => s.setLayerMute);
  const setLayerSolo = useProjectStore((s) => s.setLayerSolo);
  const renameLayer = useProjectStore((s) => s.renameLayer);
  const setLayerHeight = useProjectStore((s) => s.setLayerHeight);
  const addLayer = useProjectStore((s) => s.addLayer);
  const removeLayer = useProjectStore((s) => s.removeLayer);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const height = layer.height || 44;
  const heightIndex = Math.round(height / 22) - 1;
  const showNoteProcessorButton = groupType !== 'audio';
  const showLayerHeightMenu = groupType === 'audio' || groupType === 'polyObject';

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
    `w-5 h-4 text-tiny font-bold rounded-sm border border-app-border/30 flex items-center justify-center ${active ? activeBg + " text-black" : "bg-transparent text-app-text-muted hover:text-app-text"}`;

  const ctxItemClass =
    "rounded-sm px-3 py-1 text-body text-app-text outline-none cursor-pointer data-[highlighted]:bg-app-highlight";

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className="flex items-start overflow-hidden border-b border-app-border/20 select-none"
          style={{ height }}
          onDoubleClick={startEdit}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="flex-1 min-w-0 px-1 text-ui bg-blue-surface/60 text-blue-text outline-none border border-blue-accent/40 rounded-sm mx-1 mt-0.5"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              onBlur={commitEdit}
            />
          ) : (
            <span className="flex-1 min-w-0 px-1.5 text-ui text-blue-text truncate pointer-events-none leading-4 mt-0.5">
              {layer.name}
            </span>
          )}
          <div className="shrink-0 flex items-start gap-px mr-1 pt-0.5">
            <button
              className={btnClass(!!layer.muted, 'bg-app-warning')}
              title="Mute"
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
                className={`relative w-5 h-4 text-tiny font-bold rounded-sm border flex items-center justify-center ${
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
            <button
              className={btnClass(false, "")}
              title="Automation"
              onClick={(e) => {
                e.stopPropagation();
                alert("Not yet implemented");
              }}
            >
              A
            </button>
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-45 rounded border border-app-border/50 bg-app-menu py-1 shadow-lg">
          <ContextMenu.Item
            className={ctxItemClass}
            onSelect={() => addLayer(groupId, layerIndex - 1)}
          >
            Add Layer Above
          </ContextMenu.Item>
          <ContextMenu.Item
            className={ctxItemClass}
            onSelect={() => addLayer(groupId, layerIndex)}
          >
            Add Layer Below
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-app-border/30" />
          <ContextMenu.Item
            className={ctxItemClass}
            onSelect={() => removeLayer(groupId, layerIndex)}
          >
            Remove Layer
          </ContextMenu.Item>
          <ContextMenu.Item
            className={ctxItemClass}
            onSelect={() => alert("Not yet implemented")}
          >
            Push Up
          </ContextMenu.Item>
          <ContextMenu.Item
            className={ctxItemClass}
            onSelect={() => alert("Not yet implemented")}
          >
            Push Down
          </ContextMenu.Item>
          {showLayerHeightMenu && (
            <>
              <ContextMenu.Separator className="my-1 h-px bg-app-border/30" />
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger
                  className={`flex items-center justify-between ${ctxItemClass}`}
                >
                  Layer Height
                  <span className="text-tiny opacity-60 ml-2">▸</span>
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent className="z-50 min-w-30 rounded border border-app-border/50 bg-app-menu py-1 shadow-lg">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                      <ContextMenu.Item
                        key={idx}
                        className={`${ctxItemClass} ${heightIndex === idx - 1 ? 'bg-app-accent/20 font-medium' : ''}`}
                        onSelect={() => setLayerHeight(groupId, layerIndex, idx - 1)}
                      >
                        {idx}
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
  );
}

function computePixelsPerBeat(zoomIterations: number): number {
  const pixelSecond = 100 * Math.exp(Math.log(2) * (zoomIterations / 32.0));
  return Math.max(10, Math.min(pixelSecond, 2000));
}

function computeTotalBeats(score: ScoreDocumentSnapshot): number {
  let maxBeat = 64;
  for (const lg of score.layerGroups) {
    for (const layer of lg.layers) {
      for (const item of layer.items) {
        maxBeat = Math.max(maxBeat, item.startBeats + item.durationBeats);
      }
    }
  }
  return maxBeat + 16;
}

function elapsedSecondsToBeats(seconds: number, tempoMap: TempoMapSnapshot): number {
  if (!tempoMap.enabled || tempoMap.points.length === 0) {
    return seconds;
  }
  const points = [...tempoMap.points].sort((a, b) => a.beat - b.beat);
  const t0 = points[0]!.tempo;
  if (points.length === 1) {
    return seconds * (t0 / 60);
  }
  const cumSec: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const deltaBeats = cur.beat - prev.beat;
    if (deltaBeats <= 0) { cumSec.push(cumSec[i - 1]!); continue; }
    const f1 = 60 / prev.tempo;
    const accel = (60 / cur.tempo - f1) / deltaBeats;
    cumSec.push(cumSec[i - 1]! + f1 * deltaBeats + 0.5 * accel * deltaBeats * deltaBeats);
  }
  let idx = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (seconds >= cumSec[i]!) { idx = i; break; }
  }
  const p = points[idx]!;
  const elapsed = seconds - cumSec[idx]!;
  if (idx >= points.length - 1) {
    return p.beat + elapsed * (p.tempo / 60);
  }
  const next = points[idx + 1]!;
  const f1 = 60 / p.tempo;
  const accel = (60 / next.tempo - f1) / (next.beat - p.beat);
  if (accel === 0) return p.beat + elapsed / f1;
  const disc = f1 * f1 + 2 * accel * elapsed;
  return p.beat + (Math.sqrt(Math.max(0, disc)) - f1) / accel;
}
