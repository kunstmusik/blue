// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockOpenPanel } = vi.hoisted(() => ({
  mockOpenPanel: vi.fn(),
}));

vi.mock("../../../../stores/workbench-store", () => ({
  useWorkbenchStore: { getState: () => ({ openPanel: mockOpenPanel }) },
}));

import { useRenderAndPlayInterceptor } from "./use-render-and-play";
import { subscribePendingAudioFile } from "./audio-player-bus";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface StatusShape {
  operationId: string;
  kind: "diskRender" | "freeze";
  phase: "preparing" | "rendering" | "completed" | "failed" | "cancelled";
  message: string;
  progress: number | null;
  outputPath: string | null;
  error: string | null;
  action?: "render" | "play" | "open" | null;
}

function Probe(): null {
  useRenderAndPlayInterceptor();
  return null;
}

describe("useRenderAndPlayInterceptor", () => {
  let root: Root;
  let container: HTMLElement;
  let statusCallback: ((status: StatusShape) => void) | null = null;
  let unsubscribeBus: (() => void) | null = null;
  const received: string[] = [];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    received.length = 0;
    mockOpenPanel.mockClear();
    statusCallback = null;

    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      onRenderOperationStatus: (cb: (status: StatusShape) => void) => {
        statusCallback = cb;
        return () => {
          statusCallback = null;
        };
      },
    };

    unsubscribeBus = subscribePendingAudioFile((filePath) => {
      received.push(filePath);
    });

    act(() => {
      root.render(<Probe />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (unsubscribeBus) {
      unsubscribeBus();
      unsubscribeBus = null;
    }
  });

  function emit(status: StatusShape): void {
    act(() => {
      if (statusCallback) statusCallback(status);
    });
  }

  it("opens the audio panel and routes the file on a completed play render", () => {
    emit({
      operationId: "op-1",
      kind: "diskRender",
      phase: "completed",
      message: "done",
      progress: 100,
      outputPath: "/tmp/out.wav",
      error: null,
      action: "play",
    });
    expect(mockOpenPanel).toHaveBeenCalledWith("AudioFilePlayerTopComponent");
    expect(received).toEqual(["/tmp/out.wav"]);
  });

  it("ignores a completed render without the play action", () => {
    emit({
      operationId: "op-2",
      kind: "diskRender",
      phase: "completed",
      message: "done",
      progress: 100,
      outputPath: "/tmp/out.wav",
      error: null,
      action: "render",
    });
    expect(mockOpenPanel).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });

  it("ignores freeze operations", () => {
    emit({
      operationId: "op-3",
      kind: "freeze",
      phase: "completed",
      message: "done",
      progress: 100,
      outputPath: "/tmp/out.wav",
      error: null,
    });
    expect(mockOpenPanel).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });

  it("ignores a play render that has not completed", () => {
    emit({
      operationId: "op-4",
      kind: "diskRender",
      phase: "rendering",
      message: "...",
      progress: 50,
      outputPath: null,
      error: null,
      action: "play",
    });
    expect(mockOpenPanel).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });

  it("ignores a completed play render without an output path", () => {
    emit({
      operationId: "op-5",
      kind: "diskRender",
      phase: "completed",
      message: "done",
      progress: 100,
      outputPath: null,
      error: null,
      action: "play",
    });
    expect(mockOpenPanel).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });
});
