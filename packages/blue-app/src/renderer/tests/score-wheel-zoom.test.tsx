// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  computePixelsPerBeat,
  normalizeWheelDeltaY,
  computeZoomDelta,
  useScoreWheelZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  PINCH_ZOOM_SENSITIVITY,
  WHEEL_ZOOM_SENSITIVITY,
} from "../components/workbench/panels/score/useScoreWheelZoom";
import { useProjectStore } from "../stores/project-store";
import type { ScoreLayerGroupSnapshot } from "../../shared/project-editor";

describe("computePixelsPerBeat", () => {
  it("calculates exact pixels per beat for base and octave zoom iterations", () => {
    expect(computePixelsPerBeat(0)).toBeCloseTo(100, 5);
    expect(computePixelsPerBeat(32)).toBeCloseTo(200, 5);
    expect(computePixelsPerBeat(-32)).toBeCloseTo(50, 5);
    expect(computePixelsPerBeat(64)).toBeCloseTo(400, 5);
  });

  it("clamps pixels per beat to [1, 10000]", () => {
    expect(computePixelsPerBeat(-300)).toBe(1);
    expect(computePixelsPerBeat(300)).toBe(10000);
  });
});

describe("normalizeWheelDeltaY", () => {
  it("returns raw deltaY for pixel mode (deltaMode 0)", () => {
    const event = { deltaY: -12.5, deltaMode: 0 } as WheelEvent;
    expect(normalizeWheelDeltaY(event)).toBe(-12.5);
  });

  it("converts line mode (deltaMode 1) to equivalent pixel delta", () => {
    const event = { deltaY: -3, deltaMode: 1 } as WheelEvent;
    expect(normalizeWheelDeltaY(event)).toBe(-75);
  });

  it("converts page mode (deltaMode 2) to equivalent pixel delta", () => {
    const event = { deltaY: -1, deltaMode: 2 } as WheelEvent;
    expect(normalizeWheelDeltaY(event)).toBe(-400);
  });
});

describe("computeZoomDelta", () => {
  it("computes continuous trackpad pinch zoom delta without sensitivity cliff", () => {
    // Normal pinch out (fingers spreading) -> negative deltaY -> positive zoomDelta (zoom in)
    const pinchOut = {
      ctrlKey: true,
      altKey: false,
      deltaMode: 0,
      deltaY: -10,
    } as WheelEvent;
    expect(computeZoomDelta(pinchOut)).toBe(10 * PINCH_ZOOM_SENSITIVITY);

    // Normal pinch in (fingers pinching) -> positive deltaY -> negative zoomDelta (zoom out)
    const pinchIn = {
      ctrlKey: true,
      altKey: false,
      deltaMode: 0,
      deltaY: 10,
    } as WheelEvent;
    expect(computeZoomDelta(pinchIn)).toBe(-10 * PINCH_ZOOM_SENSITIVITY);

    // Pixel-mode pinch remains linear across the former classifier boundary.
    const fastPinch = {
      ctrlKey: true,
      altKey: false,
      deltaMode: 0,
      deltaY: -50,
    } as WheelEvent;
    expect(computeZoomDelta(fastPinch)).toBe(50 * PINCH_ZOOM_SENSITIVITY);
  });

  it("uses modern wheel direction for Alt + Wheel (wheel up zooms in)", () => {
    // Negative DOM deltaY means wheel up -> positive zoomIterations.
    const wheelUp = {
      ctrlKey: false,
      altKey: true,
      deltaMode: 0,
      deltaY: -100,
    } as WheelEvent;
    expect(computeZoomDelta(wheelUp)).toBeCloseTo(4.0, 4);

    // Positive DOM deltaY means wheel down -> negative zoomIterations.
    const wheelDown = {
      ctrlKey: false,
      altKey: true,
      deltaMode: 0,
      deltaY: 100,
    } as WheelEvent;
    expect(computeZoomDelta(wheelDown)).toBeCloseTo(-4.0, 4);
  });

  it("keeps Ctrl-pinch deltas linear for large pixel-mode events", () => {
    const nearBoundary = {
      ctrlKey: true,
      altKey: false,
      deltaMode: 0,
      deltaY: -49,
    } as WheelEvent;
    const atBoundary = {
      ...nearBoundary,
      deltaY: -50,
    } as WheelEvent;

    expect(computeZoomDelta(nearBoundary)).toBeCloseTo(
      49 * PINCH_ZOOM_SENSITIVITY,
      4,
    );
    expect(computeZoomDelta(atBoundary)).toBeCloseTo(
      50 * PINCH_ZOOM_SENSITIVITY,
      4,
    );
  });

  it("handles smooth scrolling mouse deltas continuously", () => {
    const smoothWheel = {
      ctrlKey: false,
      altKey: true,
      deltaMode: 0,
      deltaY: -4,
    } as WheelEvent;
    expect(computeZoomDelta(smoothWheel)).toBeCloseTo(4 * WHEEL_ZOOM_SENSITIVITY, 4);
  });
});

describe("useScoreWheelZoom hook", () => {
  let domContainer: HTMLDivElement;
  let root: Root;
  let scrollContainer: HTMLDivElement;
  let header: HTMLDivElement;
  const setTimeState = vi.fn();
  const applyPatch = vi.fn();
  const setLayerHeight = vi.fn();

  const mockLayerGroups: ScoreLayerGroupSnapshot[] = [
    {
      groupId: "group-1",
      name: "Group 1",
      layers: [
        { name: "Layer 1", height: 22, scoreObjects: [] },
        { name: "Layer 2", height: 44, scoreObjects: [] },
      ],
    } as any,
  ];

  function TestComponent({
    zoomIterations = 0,
    layerGroups = mockLayerGroups,
  }: {
    zoomIterations?: number;
    layerGroups?: ScoreLayerGroupSnapshot[];
  }) {
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(scrollContainer);
    const timelineHeaderRef = React.useRef<HTMLDivElement | null>(header);
    const ppb = computePixelsPerBeat(zoomIterations);

    useScoreWheelZoom(
      scrollContainerRef,
      timelineHeaderRef,
      zoomIterations,
      ppb,
      true,
      setTimeState,
      layerGroups,
    );

    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    Object.defineProperty(window.navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });

    domContainer = document.createElement("div");
    document.body.appendChild(domContainer);
    root = createRoot(domContainer);

    scrollContainer = document.createElement("div");
    header = document.createElement("div");
    document.body.appendChild(scrollContainer);
    document.body.appendChild(header);

    Object.defineProperty(scrollContainer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    });
    scrollContainer.scrollLeft = 100;
    header.scrollLeft = 100;

    vi.spyOn(useProjectStore, "getState").mockReturnValue({
      applyProjectDocumentPatch: applyPatch,
      setLayerHeight,
    } as any);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    domContainer.remove();
    scrollContainer.remove();
    header.remove();
  });

  it("handles trackpad pinch-to-zoom and updates scroll anchor", () => {
    act(() => {
      root.render(<TestComponent zoomIterations={0} />);
    });

    // Simulate pinch out (zoom in) with cursor at x = 200 (localX = 200 + 100 = 300)
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 100,
      deltaY: -10, // deltaZoom = 5
      ctrlKey: true,
      altKey: false,
    });

    scrollContainer.dispatchEvent(wheelEvent);

    expect(setTimeState).toHaveBeenCalledTimes(1);
    const updater = setTimeState.mock.calls[0][0];
    const updated = updater({ zoomIterations: 0 });
    expect(updated.zoomIterations).toBe(5);

    expect(applyPatch).toHaveBeenCalledWith({
      score: { type: "updateTimeState", patch: { zoomIterations: 5 } },
    });

    // Anchor calculation check:
    // oldPpb = 100, newPpb = computePixelsPerBeat(5) ≈ 111.419
    // scale = 1.11419, localX = 300
    // newScrollLeft = 1.11419 * 300 - 200 ≈ 134.25
    expect(scrollContainer.scrollLeft).toBeGreaterThan(100);
    expect(header.scrollLeft).toBe(scrollContainer.scrollLeft);
  });

  it("composes consecutive pinch events before React rerenders", () => {
    act(() => {
      root.render(<TestComponent zoomIterations={0} />);
    });

    const createPinchEvent = () =>
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 100,
        deltaY: -10,
        ctrlKey: true,
        altKey: false,
      });

    scrollContainer.dispatchEvent(createPinchEvent());
    scrollContainer.dispatchEvent(createPinchEvent());

    const firstUpdater = setTimeState.mock.calls[0][0];
    const secondUpdater = setTimeState.mock.calls[1][0];
    expect(firstUpdater({ zoomIterations: 0 }).zoomIterations).toBe(5);
    expect(secondUpdater({ zoomIterations: 5 }).zoomIterations).toBe(10);
    expect(
      applyPatch.mock.calls.map(([patch]) => patch.score.patch.zoomIterations),
    ).toEqual([5, 10]);
  });

  it("clamps zoom to MAX_ZOOM", () => {
    act(() => {
      root.render(<TestComponent zoomIterations={MAX_ZOOM} />);
    });

    const zoomInEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 100,
      deltaY: -20,
      ctrlKey: true,
      altKey: false,
    });

    scrollContainer.dispatchEvent(zoomInEvent);

    // Because zoom is already at MAX_ZOOM and clamped, newPpb === oldPpb so no state change occurs
    expect(setTimeState).not.toHaveBeenCalled();
  });

  it("clamps zoom to MIN_ZOOM", () => {
    act(() => {
      root.render(<TestComponent zoomIterations={MIN_ZOOM} />);
    });

    const zoomOutEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 100,
      deltaY: 20,
      ctrlKey: true,
      altKey: false,
    });

    scrollContainer.dispatchEvent(zoomOutEvent);

    expect(setTimeState).not.toHaveBeenCalled();
  });

  it("handles Alt + Wheel zoom", () => {
    act(() => {
      root.render(<TestComponent zoomIterations={0} />);
    });

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 100,
      deltaY: -100, // deltaZoom = +4
      ctrlKey: false,
      altKey: true,
    });

    scrollContainer.dispatchEvent(wheelEvent);

    expect(setTimeState).toHaveBeenCalledTimes(1);
    const updater = setTimeState.mock.calls[0][0];
    const updated = updater({ zoomIterations: 0 });
    expect(updated.zoomIterations).toBeCloseTo(4, 4);
  });

  it("handles Shift + Wheel for horizontal scrolling without zooming", () => {
    act(() => {
      root.render(<TestComponent zoomIterations={0} />);
    });

    const shiftScrollEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 100,
      deltaY: 50,
      deltaX: 0,
      shiftKey: true,
    });

    scrollContainer.dispatchEvent(shiftScrollEvent);

    expect(setTimeState).not.toHaveBeenCalled();
    expect(scrollContainer.scrollLeft).toBe(150);
    expect(header.scrollLeft).toBe(150);
  });

  it("handles layer height modifier (Cmd+Scroll on Mac or Ctrl+Scroll on Win/Linux)", () => {
    act(() => {
      root.render(<TestComponent zoomIterations={0} layerGroups={mockLayerGroups} />);
    });

    // Cursor on layer 1 (y: 10px -> within layer 0 [0..22])
    const heightEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 10,
      deltaY: 100, // scroll down -> increase height
      metaKey: true, // Cmd on Mac
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    });

    scrollContainer.dispatchEvent(heightEvent);

    expect(setLayerHeight).toHaveBeenCalledWith("group-1", 0, 1);
    expect(setTimeState).not.toHaveBeenCalled();
  });
});
