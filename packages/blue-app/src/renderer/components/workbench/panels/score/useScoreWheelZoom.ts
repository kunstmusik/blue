import { useEffect, useRef } from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import { useProjectStore } from "../../../../stores/project-store";
import type { ScoreTimeStateSnapshot, ScoreLayerGroupSnapshot } from "../../../../../shared/project-editor";
import { DEFAULT_ROW_HEIGHT, GROUP_SPACER } from "./types";

/**
 * Pixel-per-beat zoom formula matching Java Blue's TimeState:
 *   pixelSecond = 100 × 2^(zoomIterations / 32)
 *
 * Clamped to [1, 10000] for sanity to prevent layout arithmetic errors,
 * which practically allows unlimited zooming.
 */
export function computePixelsPerBeat(zoomIterations: number): number {
  const pixelSecond = 100 * Math.exp(Math.log(2) * (zoomIterations / 32.0));
  return Math.max(1, Math.min(pixelSecond, 10000));
}

// zoomIterations limits corresponding to the [1, 10000] pixelsPerBeat range
const MIN_ZOOM = -213;
const MAX_ZOOM = 213;

/** Threshold in accumulated deltaY pixels before triggering one zoom step for mouse wheels. */
const DEFAULT_DELTA_THRESHOLD = 30;

/** Java Blue LAYER_HEIGHT constant used to derive heightIndex from pixel height. */
const LAYER_HEIGHT = 22;

/**
 * Attaches non-passive `wheel` and macOS gesture listeners to the score scroll container and
 * timeline header to handle:
 *
 * 1. **Alt + wheel** → horizontal zoom (Java Blue parity)
 * 2. **Ctrl + wheel / trackpad pinch** → horizontal zoom (cross-platform fallback)
 * 3. **macOS Gesture Events (pinch-to-zoom)** → native trackpad pinch gesture zoom
 * 4. **Shift + wheel** → horizontal scroll
 * 5. **Cmd + wheel (Mac) / Ctrl + wheel (Win/Linux)** → adjust layer height under cursor
 *
 * Zoom is cursor-anchored: the timeline point under the pointer stays fixed
 * after the scale change, matching Java Blue's ScoreMouseWheelListener
 * behaviour.
 */
export function useScoreWheelZoom(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  timelineHeaderRef: RefObject<HTMLDivElement | null>,
  zoomIterations: number,
  pixelsPerBeat: number,
  loaded: boolean,
  setTimeState: Dispatch<SetStateAction<ScoreTimeStateSnapshot>>,
  effectiveLayerGroups: ScoreLayerGroupSnapshot[],
): void {
  // Keep mutable refs so the handler always sees the latest values without
  // needing to re-attach the listener on every render.
  const zoomRef = useRef(zoomIterations);
  const ppbRef = useRef(pixelsPerBeat);
  zoomRef.current = zoomIterations;
  ppbRef.current = pixelsPerBeat;

  // Keep a mutable ref of layer groups to avoid re-attaching listeners
  const layersRef = useRef(effectiveLayerGroups);
  layersRef.current = effectiveLayerGroups;

  // Accumulates sub-threshold trackpad/wheel deltas between zoom steps.
  const accumulatorRef = useRef(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const header = timelineHeaderRef.current;

    const handleWheel = (e: WheelEvent) => {
      // Determine platform-specific modifier for layer height adjustment (Cmd on Mac, Ctrl on Win/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isHeightModifier = isMac ? e.metaKey : e.ctrlKey;

      // ── 1. Layer Height Adjustment (Cmd + Scroll on Mac, Ctrl + Scroll on Win/Linux) ──
      if (isHeightModifier && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        const containerRect = container.getBoundingClientRect();
        const localY = e.clientY - containerRect.top + container.scrollTop;

        let groupYOff = 0;
        let targetLayer: { groupId: string; layerIndex: number; heightIndex: number } | null = null;

        for (const lg of layersRef.current) {
          for (let li = 0; li < lg.layers.length; li++) {
            const layer = lg.layers[li];
            const h = layer.height || DEFAULT_ROW_HEIGHT;
            const layerTop = groupYOff;
            const layerBottom = groupYOff + h;

            if (localY >= layerTop && localY <= layerBottom) {
              let rawHeight = typeof layer.height === 'number' ? layer.height : DEFAULT_ROW_HEIGHT;
              if (isNaN(rawHeight)) rawHeight = DEFAULT_ROW_HEIGHT;
              const derivedHeightIndex = Math.max(0, Math.round(rawHeight / LAYER_HEIGHT) - 1);
              targetLayer = {
                groupId: lg.groupId,
                layerIndex: li,
                heightIndex: derivedHeightIndex,
              };
              break;
            }
            groupYOff += h;
          }
          if (targetLayer) break;
          groupYOff += GROUP_SPACER;
        }

        if (targetLayer) {
          // Scrolling down -> increase height index (make taller)
          // Scrolling up -> decrease height index (make shorter)
          const direction = e.deltaY > 0 ? 1 : -1;
          const newHeightIndex = Math.max(0, Math.min(targetLayer.heightIndex + direction, 8));
          if (newHeightIndex !== targetLayer.heightIndex && !isNaN(newHeightIndex)) {
            useProjectStore.getState().setLayerHeight(targetLayer.groupId, targetLayer.layerIndex, newHeightIndex);
          }
        }
        return;
      }

      // ── 2. Zoom Handling (Alt + Scroll or Ctrl + Scroll without Shift) ──
      const isZoom = e.altKey || (e.ctrlKey && !e.shiftKey);
      if (isZoom) {
        e.preventDefault();
        e.stopPropagation();

        // Alt+Scroll: positive deltaY -> zoom in, negative deltaY -> zoom out (Java Blue parity)
        // Ctrl+Scroll (Pinch): negative deltaY -> zoom in, positive deltaY -> zoom out (standard trackpad direction)
        const directionFactor = e.ctrlKey ? -1 : 1;
        accumulatorRef.current += e.deltaY * directionFactor;

        // Smaller threshold for trackpad pinch events (small deltaY)
        const isTrackpadPinch = e.ctrlKey && !e.altKey && Math.abs(e.deltaY) <= 15;
        const threshold = isTrackpadPinch ? 8 : DEFAULT_DELTA_THRESHOLD;

        const steps = Math.trunc(accumulatorRef.current / threshold);
        if (steps === 0) return;
        accumulatorRef.current -= steps * threshold;

        const containerRect = container.getBoundingClientRect();
        const cursorOffsetInContainer = e.clientX - containerRect.left;
        const localX = cursorOffsetInContainer + container.scrollLeft;

        const currentZoom = Math.max(MIN_ZOOM, Math.min(zoomRef.current, MAX_ZOOM));
        const oldPpb = computePixelsPerBeat(currentZoom);

        const newZoom = Math.max(MIN_ZOOM, Math.min(currentZoom + steps, MAX_ZOOM));
        const newPpb = computePixelsPerBeat(newZoom);

        if (newPpb === oldPpb) return;

        const scale = newPpb / oldPpb;
        const newScrollLeft = Math.max(0, scale * localX - cursorOffsetInContainer);
        container.scrollLeft = newScrollLeft;
        if (header) header.scrollLeft = newScrollLeft;

        setTimeState((prev: ScoreTimeStateSnapshot) => ({
          ...prev,
          zoomIterations: newZoom,
        }));

        void useProjectStore.getState().applyProjectDocumentPatch({
          score: { type: "updateTimeState", patch: { zoomIterations: newZoom } },
        });
        return;
      }

      // ── 3. Horizontal Scroll (Shift + wheel) ──
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        const scrollDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        container.scrollLeft += scrollDelta;
        if (header) header.scrollLeft = container.scrollLeft;
        return;
      }
    };

    // ── 4. Native macOS Gesture Listeners (Pinch-to-zoom) ──
    let gestureStartZoom = zoomRef.current;

    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartZoom = Math.max(MIN_ZOOM, Math.min(zoomRef.current, MAX_ZOOM));
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const ge = e as any;

      const scaleFactor = ge.scale;
      if (scaleFactor <= 0) return;

      const deltaZoom = 32 * Math.log2(scaleFactor);
      const newZoom = Math.max(MIN_ZOOM, Math.min(Math.round(gestureStartZoom + deltaZoom), MAX_ZOOM));

      const currentZoom = Math.max(MIN_ZOOM, Math.min(zoomRef.current, MAX_ZOOM));
      const oldPpb = computePixelsPerBeat(currentZoom);
      const newPpb = computePixelsPerBeat(newZoom);

      if (newPpb === oldPpb) return;

      const containerRect = container.getBoundingClientRect();
      const cursorOffsetInContainer = ge.clientX - containerRect.left;
      const localX = cursorOffsetInContainer + container.scrollLeft;

      const scale = newPpb / oldPpb;
      const newScrollLeft = Math.max(0, scale * localX - cursorOffsetInContainer);
      container.scrollLeft = newScrollLeft;
      if (header) header.scrollLeft = newScrollLeft;

      setTimeState((prev: ScoreTimeStateSnapshot) => ({
        ...prev,
        zoomIterations: newZoom,
      }));

      void useProjectStore.getState().applyProjectDocumentPatch({
        score: { type: "updateTimeState", patch: { zoomIterations: newZoom } },
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("gesturestart", handleGestureStart, { passive: false });
    container.addEventListener("gesturechange", handleGestureChange, { passive: false });

    const headerCleanup = header
      ? (header.addEventListener("wheel", handleWheel, { passive: false }), () => header.removeEventListener("wheel", handleWheel))
      : undefined;

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      headerCleanup?.();
    };
  }, [scrollContainerRef.current, timelineHeaderRef.current, loaded]);
}
