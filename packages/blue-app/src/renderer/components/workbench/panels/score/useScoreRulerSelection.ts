import type { TempoMapSnapshot } from '../../../../../shared/project-editor';
import { useMemo, useRef, useCallback, useState, useEffect, type RefObject } from 'react';
import { getProjectDocumentId, useProjectStore } from '../../../../stores/project-store';
import type { SnapValueName } from '@blue/data';
import { snapValueToBeats } from '@blue/data';
import type { MeterMapSnapshot } from '../../../../../shared/project-editor';
import { createFrameSnapContext, snapBeatToGrid } from './snap-grid-utils';
import { attachHostGesture } from '../../../../lib/host-gesture';
import {
  finishProjectGesture,
  registerHistoryEditorSettlement,
} from '../../../../lib/history-scope-router';

const DRAG_THRESHOLD = 5;
const AUTO_SCROLL_EDGE_THRESHOLD = 24;
const AUTO_SCROLL_MAX_STEP = 32;

interface UseScoreRulerSelectionOptions {
  pixelsPerBeat: number;
  totalBeats: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  meterMap: MeterMapSnapshot;
  rootTimelineOnly: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  tempo: number;
  tempoMap?: TempoMapSnapshot;
  smpteFrameRate: number;
  sampleRate: number;
  /**
   * Invoked for explicit user horizontal navigation (ruler press/drag and the
   * drag auto-scroll) so active follow playback can be suspended without
   * changing transport semantics.
   */
  onUserNavigation?: () => void;
}

export function useScoreRulerSelection({
  pixelsPerBeat,
  snapEnabled,
  snapValue,
  meterMap,
  rootTimelineOnly,
  scrollContainerRef,
  tempo,
  tempoMap,
  smpteFrameRate,
  sampleRate,
  onUserNavigation,
}: UseScoreRulerSelectionOptions) {
  const frameSnapContext = useMemo(
    () => createFrameSnapContext(tempoMap, smpteFrameRate, tempo),
    [tempoMap, smpteFrameRate, tempo],
  );
  const applyPatch = useProjectStore((s) => s.applyProjectDocumentPatch);

  const onUserNavigationRef = useRef(onUserNavigation);
  onUserNavigationRef.current = onUserNavigation;

  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(-1);
  const dragStartBeats = useRef(-1);
  const dragElementRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);

  const xToBeats = useCallback(
    (clientX: number, element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, clientX - rect.left);
      return x / pixelsPerBeat;
    },
    [pixelsPerBeat],
  );

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
        onUserNavigationRef.current?.();
        container.scrollLeft = nextScrollLeft;
      }
    },
    [scrollContainerRef],
  );

  const hostGestureDisposerRef = useRef<(() => void) | null>(null);
  const unregisterSettlementRef = useRef<(() => void) | null>(null);
  const activeLiveGroupRef = useRef<{
    documentId: string;
    sessionId: number;
    gestureId: string;
    label: string;
  } | null>(null);

  const clearDrag = useCallback(() => {
    unregisterSettlementRef.current?.();
    unregisterSettlementRef.current = null;
    activeLiveGroupRef.current = null;
    dragStartX.current = -1;
    dragStartBeats.current = -1;
    dragElementRef.current = null;
    draggingRef.current = false;
    setDragging(false);
  }, []);

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rootTimelineOnly || e.button !== 0) return;

      onUserNavigationRef.current?.();
      hostGestureDisposerRef.current?.();

      const dragElement = e.currentTarget;
      dragElementRef.current = dragElement;
      const beats = snapBeats(xToBeats(e.clientX, dragElement), e.shiftKey);
      dragStartX.current = e.clientX;
      dragStartBeats.current = beats;
      draggingRef.current = false;
      setDragging(false);

      const gestureId = `ruler-${crypto.randomUUID()}`;
      const documentId =
        typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
      const sessionId = useProjectStore.getState().sessionId;
      let hasStartedRangeGroup = false;

      unregisterSettlementRef.current?.();
      if (typeof registerHistoryEditorSettlement === 'function') {
        const hostDoc = dragElement.ownerDocument ?? document;
        unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
          if (hasStartedRangeGroup) {
            await finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Select Render Range',
              phase: 'end',
            });
          }
          clearDrag();
          return useProjectStore.getState().flushPendingPatches?.();
        });
      }

      hostGestureDisposerRef.current = attachHostGesture({
        host: dragElement,
        onMove: (moveEvent) => {
          const currentDocId =
            typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
          const currentSessionId = useProjectStore.getState().sessionId;
          if (currentDocId !== documentId || currentSessionId !== sessionId) {
            hostGestureDisposerRef.current?.();
            clearDrag();
            return;
          }

          autoScroll(moveEvent.clientX);

          if (
            !draggingRef.current &&
            Math.abs(moveEvent.clientX - dragStartX.current) > DRAG_THRESHOLD
          ) {
            draggingRef.current = true;
            setDragging(true);
          }

          if (!draggingRef.current) return;

          const currentBeats = snapBeats(
            xToBeats(moveEvent.clientX, dragElement),
            moveEvent.shiftKey,
          );
          const start = Math.min(dragStartBeats.current, currentBeats);
          const end = Math.max(dragStartBeats.current, currentBeats);
          const phase = hasStartedRangeGroup ? 'update' : 'begin';
          hasStartedRangeGroup = true;
          activeLiveGroupRef.current = {
            documentId,
            sessionId,
            gestureId,
            label: 'Select Render Range',
          };

          applyPatch(
            {
              transport: {
                renderStartTime: Math.max(0, start),
                renderEndTime: Math.max(0, end),
              },
            },
            { label: 'Select Render Range', gestureId, phase },
          );
        },
        onRelease: () => {
          const currentDocId =
            typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
          const currentSessionId = useProjectStore.getState().sessionId;
          if (currentDocId === documentId && currentSessionId === sessionId) {
            if (hasStartedRangeGroup) {
              void finishProjectGesture({
                documentId,
                sessionId,
                gestureId,
                label: 'Select Render Range',
                phase: 'end',
              });
            } else if (dragStartBeats.current >= 0) {
              applyPatch(
                {
                  transport: {
                    renderStartTime: Math.max(0, dragStartBeats.current),
                    renderEndTime: -1,
                  },
                },
                { label: 'Set Render Start Time', phase: 'single' },
              );
            }
          }
          clearDrag();
        },
        onEscape: () => {
          if (hasStartedRangeGroup) {
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Select Render Range',
              phase: 'cancel',
            });
          }
          clearDrag();
        },
        onBlur: () => {
          if (hasStartedRangeGroup) {
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Select Render Range',
              phase: 'cancel',
            });
          }
          clearDrag();
        },
        onCancel: () => {
          if (hasStartedRangeGroup) {
            void finishProjectGesture({
              documentId,
              sessionId,
              gestureId,
              label: 'Select Render Range',
              phase: 'cancel',
            });
          }
          clearDrag();
        },
      });
    },
    [rootTimelineOnly, snapBeats, xToBeats, autoScroll, applyPatch, clearDrag],
  );

  return {
    handleMouseDown,
    dragging,
  };
}
