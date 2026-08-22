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
export const MIN_ZOOM = -213;
export const MAX_ZOOM = 213;

/** Sensitivity for trackpad pinch gestures (iterations per pixel of deltaY). */
export const PINCH_ZOOM_SENSITIVITY = 0.5;

/**
 * Sensitivity for mouse wheel zoom (iterations per pixel of deltaY; ~4 iterations per 100px notch).
 * Negative deltaY (wheel up) intentionally zooms in to match modern desktop applications.
 */
export const WHEEL_ZOOM_SENSITIVITY = 0.04;

/** Java Blue LAYER_HEIGHT constant used to derive heightIndex from pixel height. */
const LAYER_HEIGHT = 22;

/**
 * Normalizes wheel event deltaY to approximate pixels based on deltaMode.
 */
export function normalizeWheelDeltaY(e: WheelEvent): number {
  if (e.deltaMode === 1) {
    // DOM_DELTA_LINE (typically ~20-25px per line)
    return e.deltaY * 25;
  }
  if (e.deltaMode === 2) {
    // DOM_DELTA_PAGE
    return e.deltaY * 400;
  }
  return e.deltaY;
}

/**
 * Computes the change in zoomIterations for a given wheel event.
 * Negative deltaY zooms in for both Alt+wheel and Ctrl+pinch, following the
 * modern desktop convention rather than Java Blue's legacy wheel direction.
 */
export function computeZoomDelta(e: WheelEvent): number {
  const normalizedDelta = normalizeWheelDeltaY(e);
  const sensitivity =
    e.ctrlKey && !e.altKey ? PINCH_ZOOM_SENSITIVITY : WHEEL_ZOOM_SENSITIVITY;
  return -normalizedDelta * sensitivity;
}

/**
 * Attaches non-passive `wheel` listeners to the score scroll container and
 * timeline header to handle:
 *
 * 1. **Alt + wheel** → horizontal zoom (wheel up zooms in)
 * 2. **Ctrl + wheel / trackpad pinch** → horizontal zoom (cross-platform fallback & trackpad pinch)
 * 3. **Shift + wheel** → horizontal scroll
 * 4. **Cmd + wheel (Mac) / Ctrl + wheel (Win/Linux)** → adjust layer height under cursor
 *
 * Zoom is cursor-anchored: the timeline point under the pointer stays fixed
 * after the scale change, matching Java Blue's ScoreMouseWheelListener
 * anchoring. Zoom direction intentionally follows the modern desktop
 * convention: wheel up and pinch out both zoom in.
 */
/**
 * Scroll-origin provenance for follow playback: cursor-anchored zoom writes
 * report `view-scale` with the expected post-zoom scroll position so the
 * induced scroll events do not suspend follow, while Shift+wheel horizontal
 * movement reports `user-navigation`.
 */
export type ScoreWheelScrollOriginNotifier = (
  origin: 'user-navigation' | 'view-scale',
  expectedScrollLeft?: number,
) => void;

export function useScoreWheelZoom(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  timelineHeaderRef: RefObject<HTMLDivElement | null>,
  zoomIterations: number,
  pixelsPerBeat: number,
  loaded: boolean,
  setTimeState: Dispatch<SetStateAction<ScoreTimeStateSnapshot>>,
  effectiveLayerGroups: ScoreLayerGroupSnapshot[],
  onScrollOrigin?: ScoreWheelScrollOriginNotifier,
): void {
  // Keep mutable refs so the handler always sees the latest values without
  // needing to re-attach the listener on every render.
  const zoomRef = useRef(zoomIterations);
  const renderedZoomRef = useRef(zoomIterations);
  const ppbRef = useRef(pixelsPerBeat);
  // Do not overwrite a synchronously accumulated wheel delta with a render
  // that still carries the previous state value.
  if (renderedZoomRef.current !== zoomIterations) {
    zoomRef.current = zoomIterations;
    renderedZoomRef.current = zoomIterations;
  }
  ppbRef.current = pixelsPerBeat;

  const onScrollOriginRef = useRef(onScrollOrigin);
  onScrollOriginRef.current = onScrollOrigin;

  // Keep a mutable ref of layer groups to avoid re-attaching listeners
  const layersRef = useRef(effectiveLayerGroups);
  layersRef.current = effectiveLayerGroups;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const header = timelineHeaderRef.current;

    const handleWheel = (e: WheelEvent) => {
      // Determine platform-specific modifier for layer height adjustment (Cmd on Mac, Ctrl on Win/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isHeightModifier = isMac ? e.metaKey : (e.ctrlKey && !e.altKey);

      // ── 1. Layer Height Adjustment (Cmd + Scroll on Mac, Ctrl + Scroll on Win/Linux) ──
      // Note: On Mac, pinch-to-zoom sets e.ctrlKey = true and e.metaKey = false, so it won't trigger this.
      if (isHeightModifier && !e.altKey && !e.shiftKey && (isMac || e.deltaMode !== 0 || Math.abs(e.deltaY) >= 50)) {
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

        const deltaZoom = computeZoomDelta(e);
        if (deltaZoom === 0) return;

        const currentZoom = Math.max(MIN_ZOOM, Math.min(zoomRef.current, MAX_ZOOM));
        const oldPpb = computePixelsPerBeat(currentZoom);

        const newZoom = Math.max(MIN_ZOOM, Math.min(currentZoom + deltaZoom, MAX_ZOOM));
        const newPpb = computePixelsPerBeat(newZoom);

        if (newPpb === oldPpb) return;

        // Native wheel events can arrive before React commits the previous
        // state update, so compose the next event from this pending value.
        zoomRef.current = newZoom;

        const containerRect = container.getBoundingClientRect();
        const cursorOffsetInContainer = e.clientX - containerRect.left;
        const localX = cursorOffsetInContainer + container.scrollLeft;

        const scale = newPpb / oldPpb;
        const newScrollLeft = Math.max(0, scale * localX - cursorOffsetInContainer);
        onScrollOriginRef.current?.('view-scale', newScrollLeft);
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

        onScrollOriginRef.current?.('user-navigation');
        const scrollDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        container.scrollLeft += scrollDelta;
        if (header) header.scrollLeft = container.scrollLeft;
        return;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    const headerCleanup = header
      ? (header.addEventListener("wheel", handleWheel, { passive: false }), () => header.removeEventListener("wheel", handleWheel))
      : undefined;

    return () => {
      container.removeEventListener("wheel", handleWheel);
      headerCleanup?.();
    };
  }, [scrollContainerRef.current, timelineHeaderRef.current, loaded]);
}
