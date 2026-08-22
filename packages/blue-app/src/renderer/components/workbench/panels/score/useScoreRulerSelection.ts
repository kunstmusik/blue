import { useRef, useCallback, useState, useEffect, type RefObject } from 'react';
import { useProjectStore } from '../../../../stores/project-store';
import type { SnapValueName } from '@blue/data';
import { snapValueToBeats } from '@blue/data';
import type { MeterMapSnapshot } from '../../../../../shared/project-editor';
import { snapBeatToGrid } from './snap-grid-utils';

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
  smpteFrameRate,
  sampleRate,
  onUserNavigation,
}: UseScoreRulerSelectionOptions) {
  const applyPatch = useProjectStore((s) => s.applyProjectDocumentPatch);

  const onUserNavigationRef = useRef(onUserNavigation);
  onUserNavigationRef.current = onUserNavigation;

  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(-1);
  const dragStartBeats = useRef(-1);
  const dragElementRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);

  const xToBeats = useCallback((clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, clientX - rect.left);
    return x / pixelsPerBeat;
  }, [pixelsPerBeat]);

  const snapBeats = useCallback((beats: number, shiftHeld: boolean) => {
    if (!snapEnabled || shiftHeld) return beats;
    const sv = snapValueToBeats(
      snapValue,
      tempo,
      smpteFrameRate,
      sampleRate,
      pixelsPerBeat,
    );
    if (sv <= 0) return beats;
    return snapBeatToGrid(beats, 'nearest', snapValue, sv, meterMap);
  }, [snapEnabled, snapValue, meterMap, tempo, smpteFrameRate, sampleRate, pixelsPerBeat]);

  const autoScroll = useCallback((clientX: number) => {
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

    const step = Math.sign(delta) * Math.min(
      AUTO_SCROLL_MAX_STEP,
      Math.max(6, Math.abs(delta) * 0.35),
    );

    const nextScrollLeft = Math.max(0, container.scrollLeft + step);
    if (nextScrollLeft !== container.scrollLeft) {
      onUserNavigationRef.current?.();
      container.scrollLeft = nextScrollLeft;
    }
  }, [scrollContainerRef]);

  const clearDrag = useCallback(() => {
    dragStartX.current = -1;
    dragStartBeats.current = -1;
    dragElementRef.current = null;
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const handleDragMove = useCallback((clientX: number, shiftHeld: boolean) => {
    if (dragStartX.current < 0 || !rootTimelineOnly) return;

    const dragElement = dragElementRef.current;
    if (!dragElement) return;

    autoScroll(clientX);

    if (!draggingRef.current && Math.abs(clientX - dragStartX.current) > DRAG_THRESHOLD) {
      draggingRef.current = true;
      setDragging(true);
    }

    if (!draggingRef.current) return;

    const beats = snapBeats(xToBeats(clientX, dragElement), shiftHeld);
    const start = Math.min(dragStartBeats.current, beats);
    const end = Math.max(dragStartBeats.current, beats);
    applyPatch({
      transport: {
        renderStartTime: Math.max(0, start),
        renderEndTime: Math.max(0, end),
      },
    });
  }, [rootTimelineOnly, autoScroll, snapBeats, xToBeats, applyPatch]);

  const handleDragEnd = useCallback(() => {
    if (dragStartX.current < 0 || !rootTimelineOnly) {
      clearDrag();
      return;
    }

    if (!draggingRef.current && dragStartBeats.current >= 0) {
      applyPatch({
        transport: {
          renderStartTime: Math.max(0, dragStartBeats.current),
          renderEndTime: -1,
        },
      });
    }

    clearDrag();
  }, [rootTimelineOnly, applyPatch, clearDrag]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootTimelineOnly || e.button !== 0) return;

    // Pressing the ruler is explicit horizontal navigation on the root
    // timeline; suspend active follow before any drag or auto-scroll runs.
    onUserNavigationRef.current?.();

    dragElementRef.current = e.currentTarget;
    const beats = snapBeats(xToBeats(e.clientX, e.currentTarget), e.shiftKey);
    dragStartX.current = e.clientX;
    dragStartBeats.current = beats;
    draggingRef.current = false;
    setDragging(false);
  }, [rootTimelineOnly, snapBeats, xToBeats]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (dragStartX.current >= 0) {
        handleDragMove(event.clientX, event.shiftKey);
      }
    };

    const onMouseUp = () => {
      if (dragStartX.current >= 0) {
        handleDragEnd();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleDragMove, handleDragEnd]);

  return {
    handleMouseDown,
    dragging,
  };
}
