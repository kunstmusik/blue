import { describe, expect, it, vi } from "vitest";
import {
  buildWaveformEnvelope,
  drawWaveformEnvelope,
} from "./AudioPlayerWaveform";

describe("buildWaveformEnvelope", () => {
  it("builds one ordered envelope spanning the canvas", () => {
    const points = buildWaveformEnvelope(
      {
        min: [-0.8, 0.4, -0.2],
        max: [-0.4, 0.7, 0.3],
      },
      90,
      60,
    );

    expect(points.map((point) => point.x)).toEqual([0, 45, 90]);
    expect(points.every((point) => point.yTop <= point.yBottom)).toBe(true);
    expect(points[0]?.yTop).toBeCloseTo(41.2);
    expect(points[0]?.yBottom).toBeCloseTo(52.4);
  });

  it("keeps full-scale peaks inside the canvas", () => {
    const points = buildWaveformEnvelope({ min: [-2], max: [2] }, 100, 64);

    expect(points).toEqual([{ x: 50, yTop: 2, yBottom: 62 }]);
  });

  it("draws one closed path instead of isolated bucket rectangles", () => {
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const drawn = drawWaveformEnvelope(
      context,
      { min: [-0.8, 0.4, -0.2], max: [-0.4, 0.7, 0.3] },
      90,
      60,
    );

    expect(drawn).toBe(true);
    expect(context.beginPath).toHaveBeenCalledOnce();
    expect(context.closePath).toHaveBeenCalledOnce();
    expect(context.fill).toHaveBeenCalledOnce();
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.lineTo).toHaveBeenCalledTimes(5);
    expect(context.fillRect).not.toHaveBeenCalled();
  });
});
