import { formatForBase } from '../../../../time/time-unit-logic';
import type { TempoMapSnapshot } from '../../../../../shared/project-editor';
import { useMemo, useRef, useCallback, useState, useEffect, type RefObject } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { MarkerSnapshot, MeterMapSnapshot } from '../../../../../shared/project-editor';
import { getProjectDocumentId, useProjectStore } from '../../../../stores/project-store';
import type { SnapValueName } from '@blue/data';
import { snapValueToBeats } from '@blue/data';
import { createFrameSnapContext, snapBeatToGrid } from './snap-grid-utils';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../hooks/host-portals';
import { attachHostGesture } from '../../../../lib/host-gesture';
import {
  finishProjectGesture,
  registerHistoryEditorSettlement,
} from '../../../../lib/history-scope-router';

const AUTO_SCROLL_EDGE_THRESHOLD = 24;
const AUTO_SCROLL_MAX_STEP = 32;

function sameMarker(left: MarkerSnapshot | undefined, right: MarkerSnapshot | undefined): boolean {
  return Boolean(
    left &&
    right &&
    left.markerId === right.markerId &&
    left.name === right.name &&
    left.timeBase === right.timeBase &&
    Math.abs(left.time - right.time) < 1e-7,
  );
}

function sameMarkerTarget(
  expectedMarkers: MarkerSnapshot[],
  currentMarkers: MarkerSnapshot[],
  index: number,
  target: MarkerSnapshot | undefined,
): boolean {
  if (!sameMarker(target, currentMarkers[index])) return false;
  const matches = (markers: MarkerSnapshot[]) =>
    markers.flatMap((marker, i) => (sameMarker(marker, target) ? [i] : []));
  const expectedMatches = matches(expectedMarkers);
  return (
    expectedMatches.length < 2 ||
    JSON.stringify(matches(currentMarkers)) === JSON.stringify(expectedMatches)
  );
}

interface Props {
  markers: MarkerSnapshot[];
  totalBeats: number;
  pixelsPerBeat: number;
  rowVisible: boolean;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  meterMap: MeterMapSnapshot;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  rootTimelineOnly: boolean;
  tempo: number;
  tempoMap?: TempoMapSnapshot;
  smpteFrameRate: number;
  smpteDropFrame?: boolean;
  timeDisplay?: string;
  sampleRate: number;
}

type DragState =
  | {
      type: 'marker';
      sourceIndex: number;
      startMouseBeats: number;
      startMarkerBeats: number;
    }
  | { type: 'render-start' }
  | null;

export default function MarkersBar({
  markers,
  totalBeats,
  pixelsPerBeat,
  rowVisible,
  snapEnabled,
  snapValue,
  meterMap,
  scrollContainerRef,
  rootTimelineOnly,
  tempo,
  tempoMap,
  smpteFrameRate,
  smpteDropFrame = false,
  timeDisplay = 'BEATS',
  sampleRate,
}: Props) {
  const frameSnapContext = useMemo(
    () => createFrameSnapContext(tempoMap, smpteFrameRate, tempo),
    [tempoMap, smpteFrameRate, tempo],
  );
  const applyPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState>(null);
  const [draggingSourceIndex, setDraggingSourceIndex] = useState<number | null>(null);

  const snapBeats = useCallback(
    (beats: number, shiftHeld: boolean) => {
      if (!snapEnabled || shiftHeld) return beats;
      const sv = snapValueToBeats(snapValue, tempo, smpteFrameRate, sampleRate, pixelsPerBeat);
      if (sv <= 0) return beats;
      return snapBeatToGrid(beats, 'nearest', snapValue, sv, meterMap, frameSnapContext);
    },
    [
      snapEnabled,
      snapValue,
      meterMap,
      tempo,
      smpteFrameRate,
      sampleRate,
      pixelsPerBeat,
      frameSnapContext,
    ],
  );

  const xToBeats = useCallback(
    (clientX: number) => {
      const element = rowRef.current;
      if (!element) return 0;

      const rect = element.getBoundingClientRect();
      const x = Math.max(0, clientX - rect.left);
      return x / pixelsPerBeat;
    },
    [pixelsPerBeat],
  );

  const autoScroll = useCallback(
    (clientX: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let delta = 0;

      if (clientX < rect.left + AUTO_SCROLL_EDGE_THRESHOLD) {
        delta = clientX - (rect.left + AUTO_SCROLL_EDGE_THRESHOLD);
      } else if (clientX > rect.right - AUTO_SCROLL_EDGE_THRESHOLD) {
        delta = clientX - (rect.right - AUTO_SCROLL_EDGE_THRESHOLD);
      }

      if (delta === 0) return;

      const step =
        Math.sign(delta) * Math.min(AUTO_SCROLL_MAX_STEP, Math.max(6, Math.abs(delta) * 0.35));

      const nextScrollLeft = Math.max(0, container.scrollLeft + step);
      if (nextScrollLeft !== container.scrollLeft) {
        container.scrollLeft = nextScrollLeft;
      }
    },
    [scrollContainerRef],
  );

  const clearDrag = useCallback(() => {
    unregisterSettlementRef.current?.();
    unregisterSettlementRef.current = null;
    activeLiveGroupRef.current = null;
    dragStateRef.current = null;
    setDraggingSourceIndex(null);
  }, []);

  const hostGestureDisposerRef = useRef<(() => void) | null>(null);
  const unregisterSettlementRef = useRef<(() => void) | null>(null);
  const activeLiveGroupRef = useRef<{
    documentId: string;
    sessionId: number;
    gestureId: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      unregisterSettlementRef.current?.();
      unregisterSettlementRef.current = null;
      hostGestureDisposerRef.current?.();
      hostGestureDisposerRef.current = null;
      if (activeLiveGroupRef.current) {
        const { documentId, sessionId, gestureId, label } = activeLiveGroupRef.current;
        activeLiveGroupRef.current = null;
        void finishProjectGesture({
          documentId,
          sessionId,
          gestureId,
          label,
          phase: 'end',
        });
      }
      clearDrag();
    };
  }, [clearDrag]);

  const startMarkerDrag = useCallback(
    (sourceIndex: number, clientX: number, startMarkerBeats: number, host?: EventTarget | null) => {
      if (!rootTimelineOnly) return;
      hostGestureDisposerRef.current?.();

      const gestureId = `marker-${crypto.randomUUID()}`;
      const documentId = getProjectDocumentId() ?? '';
      const sessionId = useProjectStore.getState().sessionId;
      const startMouseBeats = xToBeats(clientX);
      let hasStartedLiveGroup = false;
      let expectedMarker = markers.find((marker) => marker.sourceIndex === sourceIndex);
      let expectedMarkers = useProjectStore.getState().score.markers;
      const ownsTarget = () =>
        sameMarkerTarget(
          expectedMarkers,
          useProjectStore.getState().score.markers,
          sourceIndex,
          expectedMarker,
        );

      dragStateRef.current = {
        type: 'marker',
        sourceIndex,
        startMouseBeats,
        startMarkerBeats,
      };
      setDraggingSourceIndex(sourceIndex);

      const hostEl = (host as HTMLElement) ?? rowRef.current;
      const hostDoc = hostEl?.ownerDocument ?? document;
      if (typeof registerHistoryEditorSettlement === 'function') {
        unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
          unregisterSettlementRef.current?.();
          unregisterSettlementRef.current = null;
          hostGestureDisposerRef.current?.();
          hostGestureDisposerRef.current = null;
          if (hasStartedLiveGroup && ownsTarget()) {
            activeLiveGroupRef.current = null;
            await finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Move Marker',
              phase: 'end',
            });
          }
          clearDrag();
          return useProjectStore?.getState?.()?.flushPendingPatches?.();
        });
      }

      hostGestureDisposerRef.current = attachHostGesture({
        host: hostEl,
        onMove: (moveEvent) => {
          const currentDocId = getProjectDocumentId() ?? '';
          const currentSessionId = useProjectStore.getState().sessionId;
          if (documentId !== currentDocId || sessionId !== currentSessionId || !ownsTarget()) {
            hostGestureDisposerRef.current?.();
            clearDrag();
            return;
          }
          autoScroll(moveEvent.clientX);
          const currentMouseBeats = xToBeats(moveEvent.clientX);
          const draggedBeats = startMarkerBeats + (currentMouseBeats - startMouseBeats);
          const beats = Math.max(0, snapBeats(draggedBeats, moveEvent.shiftKey));
          const phase = hasStartedLiveGroup ? 'update' : 'begin';
          hasStartedLiveGroup = true;
          activeLiveGroupRef.current = { documentId, sessionId, gestureId, label: 'Move Marker' };
          applyPatch(
            {
              score: {
                type: 'updateMarker',
                sourceIndex,
                patch: { timeBeats: beats },
              },
            },
            { label: 'Move Marker', gestureId, phase },
          );
          expectedMarkers = useProjectStore.getState().score.markers;
          expectedMarker = expectedMarkers[sourceIndex];
        },
        onRelease: () => {
          unregisterSettlementRef.current?.();
          unregisterSettlementRef.current = null;
          hostGestureDisposerRef.current = null;
          if (hasStartedLiveGroup && ownsTarget()) {
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Move Marker',
              phase: 'end',
            });
          }
          clearDrag();
        },
        onEscape: () => {
          unregisterSettlementRef.current?.();
          unregisterSettlementRef.current = null;
          hostGestureDisposerRef.current = null;
          if (hasStartedLiveGroup && ownsTarget()) {
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Move Marker',
              phase: 'cancel',
            });
          }
          clearDrag();
        },
        onBlur: () => {
          unregisterSettlementRef.current?.();
          unregisterSettlementRef.current = null;
          hostGestureDisposerRef.current = null;
          if (hasStartedLiveGroup && ownsTarget()) {
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Move Marker',
              phase: 'cancel',
            });
          }
          clearDrag();
        },
        onCancel: () => {
          unregisterSettlementRef.current?.();
          unregisterSettlementRef.current = null;
          hostGestureDisposerRef.current = null;
          if (hasStartedLiveGroup && ownsTarget()) {
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Move Marker',
              phase: 'cancel',
            });
          }
          clearDrag();
        },
      });
    },
    [rootTimelineOnly, xToBeats, autoScroll, snapBeats, applyPatch, clearDrag, markers],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rootTimelineOnly || e.button !== 0) return;

      e.preventDefault();
      hostGestureDisposerRef.current?.();

      if (e.shiftKey) {
        const gestureId = `marker-${crypto.randomUUID()}`;
        const documentId = getProjectDocumentId() ?? '';
        const sessionId = useProjectStore.getState().sessionId;
        const beats = Math.max(0, snapBeats(xToBeats(e.clientX), false));
        const sourceIndex = markers.length;

        applyPatch(
          {
            score: { type: 'addMarker', timeBeats: beats },
          },
          { label: 'Add Marker', gestureId, phase: 'begin' },
        );
        let expectedMarkers = useProjectStore.getState().score.markers;
        let expectedMarker = expectedMarkers[sourceIndex];
        const ownsTarget = () =>
          sameMarkerTarget(
            expectedMarkers,
            useProjectStore.getState().score.markers,
            sourceIndex,
            expectedMarker,
          );

        activeLiveGroupRef.current = { documentId, sessionId, gestureId, label: 'Add Marker' };
        dragStateRef.current = {
          type: 'marker',
          sourceIndex,
          startMouseBeats: beats,
          startMarkerBeats: beats,
        };
        setDraggingSourceIndex(sourceIndex);

        const hostDoc = e.currentTarget.ownerDocument ?? document;
        if (typeof registerHistoryEditorSettlement === 'function') {
          unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            hostGestureDisposerRef.current?.();
            hostGestureDisposerRef.current = null;
            activeLiveGroupRef.current = null;
            if (ownsTarget()) {
              await finishProjectGesture({
                documentId,
                sessionId,
                gestureId,
                label: 'Add Marker',
                phase: 'end',
              });
            }
            clearDrag();
            return useProjectStore?.getState?.()?.flushPendingPatches?.();
          });
        }

        hostGestureDisposerRef.current = attachHostGesture({
          host: e.currentTarget,
          onMove: (moveEvent) => {
            const currentDocId = getProjectDocumentId() ?? '';
            const currentSessionId = useProjectStore.getState().sessionId;
            if (documentId !== currentDocId || sessionId !== currentSessionId || !ownsTarget()) {
              hostGestureDisposerRef.current?.();
              clearDrag();
              return;
            }
            autoScroll(moveEvent.clientX);
            const currentMouseBeats = xToBeats(moveEvent.clientX);
            const draggedBeats = beats + (currentMouseBeats - beats);
            const nextBeats = Math.max(0, snapBeats(draggedBeats, moveEvent.shiftKey));
            applyPatch(
              {
                score: {
                  type: 'updateMarker',
                  sourceIndex,
                  patch: { timeBeats: nextBeats },
                },
              },
              { label: 'Add Marker', gestureId, phase: 'update' },
            );
            expectedMarkers = useProjectStore.getState().score.markers;
            expectedMarker = expectedMarkers[sourceIndex];
          },
          onRelease: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            if (ownsTarget()) {
              void finishProjectGesture({
                documentId,
                sessionId,
                gestureId,
                label: 'Add Marker',
                phase: 'end',
              });
            }
            clearDrag();
          },
          onEscape: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            if (ownsTarget()) {
              void finishProjectGesture({
                documentId,
                sessionId,
                gestureId,
                label: 'Add Marker',
                phase: 'cancel',
              });
            }
            clearDrag();
          },
          onBlur: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            if (ownsTarget()) {
              void finishProjectGesture({
                documentId,
                sessionId,
                gestureId,
                label: 'Add Marker',
                phase: 'cancel',
              });
            }
            clearDrag();
          },
          onCancel: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            if (ownsTarget()) {
              void finishProjectGesture({
                documentId,
                sessionId,
                gestureId,
                label: 'Add Marker',
                phase: 'cancel',
              });
            }
            clearDrag();
          },
        });
      } else {
        const gestureId = `render-start-${crypto.randomUUID()}`;
        const documentId = getProjectDocumentId() ?? '';
        const sessionId = useProjectStore.getState().sessionId;
        const beats = Math.max(0, snapBeats(xToBeats(e.clientX), e.shiftKey));

        applyPatch(
          {
            transport: { renderStartTime: beats, renderEndTime: -1 },
          },
          { label: 'Set Render Start Time', gestureId, phase: 'begin' },
        );
        activeLiveGroupRef.current = {
          documentId,
          sessionId,
          gestureId,
          label: 'Set Render Start Time',
        };
        dragStateRef.current = { type: 'render-start' };

        const hostDoc = e.currentTarget.ownerDocument ?? document;
        if (typeof registerHistoryEditorSettlement === 'function') {
          unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            hostGestureDisposerRef.current?.();
            hostGestureDisposerRef.current = null;
            activeLiveGroupRef.current = null;
            await finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Set Render Start Time',
              phase: 'end',
            });
            clearDrag();
            return useProjectStore?.getState?.()?.flushPendingPatches?.();
          });
        }

        hostGestureDisposerRef.current = attachHostGesture({
          host: e.currentTarget,
          onMove: (moveEvent) => {
            const currentDocId = getProjectDocumentId() ?? '';
            const currentSessionId = useProjectStore.getState().sessionId;
            if (documentId !== currentDocId || sessionId !== currentSessionId) {
              hostGestureDisposerRef.current?.();
              clearDrag();
              return;
            }
            autoScroll(moveEvent.clientX);
            const nextBeats = Math.max(
              0,
              snapBeats(xToBeats(moveEvent.clientX), moveEvent.shiftKey),
            );
            applyPatch(
              {
                transport: { renderStartTime: nextBeats, renderEndTime: -1 },
              },
              { label: 'Set Render Start Time', gestureId, phase: 'update' },
            );
          },
          onRelease: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Set Render Start Time',
              phase: 'end',
            });
            clearDrag();
          },
          onEscape: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Set Render Start Time',
              phase: 'cancel',
            });
            clearDrag();
          },
          onBlur: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Set Render Start Time',
              phase: 'cancel',
            });
            clearDrag();
          },
          onCancel: () => {
            unregisterSettlementRef.current?.();
            unregisterSettlementRef.current = null;
            activeLiveGroupRef.current = null;
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Set Render Start Time',
              phase: 'cancel',
            });
            clearDrag();
          },
        });
      }
    },
    [rootTimelineOnly, snapBeats, xToBeats, markers.length, applyPatch, autoScroll, clearDrag],
  );

  if (!rowVisible) return null;

  return (
    <div
      ref={rowRef}
      className="relative h-5 overflow-visible border-b border-app-border/50 bg-app-canvas cursor-crosshair select-none"
      style={{ minWidth: totalBeats * pixelsPerBeat }}
      onMouseDown={handleMouseDown}
    >
      {markers.map((marker) => (
        <MarkerWidget
          key={`${marker.sourceIndex}-${marker.name}`}
          marker={marker}
          timeLabel={formatForBase(
            marker.time,
            timeDisplay,
            {
              ...frameSnapContext,
              meterEntries: meterMap?.entries ?? [],
              sampleRate,
              smpteDropFrame,
            },
            false,
          )}
          sourceIndex={marker.sourceIndex}
          pixelsPerBeat={pixelsPerBeat}
          onStartDrag={startMarkerDrag}
          isDragging={draggingSourceIndex === marker.sourceIndex}
        />
      ))}
    </div>
  );
}

function MarkerWidget({
  marker,
  sourceIndex,
  pixelsPerBeat,
  onStartDrag,
  isDragging,
  timeLabel,
}: {
  marker: MarkerSnapshot;
  sourceIndex: number;
  pixelsPerBeat: number;
  onStartDrag: (
    sourceIndex: number,
    clientX: number,
    startMarkerBeats: number,
    host?: EventTarget | null,
  ) => void;
  isDragging: boolean;
  timeLabel: string;
}) {
  const applyPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(marker.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const left = marker.time * pixelsPerBeat;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      onStartDrag(sourceIndex, e.clientX, marker.time, e.currentTarget);
    },
    [onStartDrag, sourceIndex, marker.time],
  );

  const beginRename = useCallback(() => {
    setRenameValue(marker.name);
    setRenaming(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [marker.name]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      beginRename();
    },
    [beginRename],
  );

  const commitRename = useCallback(() => {
    setRenaming(false);
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== marker.name) {
      applyPatch({
        score: { type: 'updateMarker', sourceIndex, patch: { name: trimmed } },
      });
    }
  }, [renameValue, marker.name, sourceIndex, applyPatch]);

  const handleRemove = useCallback(() => {
    applyPatch({
      score: { type: 'removeMarker', sourceIndex },
    });
  }, [sourceIndex, applyPatch]);

  const ctxItemClass =
    'cursor-pointer rounded-sm px-3 py-1 text-role-body text-app-text outline-none data-[highlighted]:bg-app-highlight';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className="absolute top-0 h-5 flex items-stretch overflow-visible"
          style={{ left, zIndex: isDragging ? 20 : 10 }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          <div className="inline-flex h-5 w-max max-w-none items-center border border-app-warning/80 bg-app-warning/70 pr-[3px] shadow-inner">
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="shrink-0 left-0 top-0 absolute"
            >
              <polygon
                points="0,0 0,10 10,0"
                fill="#ffd68a"
                stroke="#fdbe0b"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            {renaming ? (
              <input
                ref={inputRef}
                className="ml-1 h-4 rounded-sm border border-app-warning/60 bg-app-text-strong/40 px-1 text-role-body text-black outline-none"
                style={{ width: Math.max(72, renameValue.length * 8) }}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitRename();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="ml-1 text-role-body text-black whitespace-nowrap select-none"
                title={`${marker.name} [${timeLabel}]`}
              >
                {marker.name}
              </span>
            )}
          </div>
        </div>
      </ContextMenu.Trigger>
      <PopoutContextMenuPortal>
        <ContextMenu.Content className="editor-context-menu" {...portalEventIsolationProps}>
          <ContextMenu.Item className={ctxItemClass} onSelect={handleRemove}>
            Remove
          </ContextMenu.Item>
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
  );
}
