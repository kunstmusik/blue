// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitPendingAudioFile,
  subscribePendingAudioFile,
} from "./audio-player-bus";

describe("audio-player-bus", () => {
  afterEach(() => {
    const unsubscribe = subscribePendingAudioFile(() => undefined);
    unsubscribe();
  });

  it("delivers emitted paths to subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingAudioFile(listener);

    emitPendingAudioFile("/tmp/a.wav");
    emitPendingAudioFile("/tmp/b.wav");

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, "/tmp/a.wav");
    expect(listener).toHaveBeenNthCalledWith(2, "/tmp/b.wav");

    unsubscribe();
    emitPendingAudioFile("/tmp/c.wav");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("supports multiple simultaneous subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unA = subscribePendingAudioFile(a);
    const unB = subscribePendingAudioFile(b);

    emitPendingAudioFile("/x.wav");
    expect(a).toHaveBeenCalledWith("/x.wav");
    expect(b).toHaveBeenCalledWith("/x.wav");

    unA();
    emitPendingAudioFile("/y.wav");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    unB();
  });

  it("delivers a path emitted before the panel subscribes", () => {
    emitPendingAudioFile("/tmp/rendered.wav");
    const listener = vi.fn();
    const unsubscribe = subscribePendingAudioFile(listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith("/tmp/rendered.wav");
    unsubscribe();
  });
});
