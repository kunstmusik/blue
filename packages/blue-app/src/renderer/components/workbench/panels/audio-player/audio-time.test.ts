import { describe, expect, it } from "vitest";
import { formatAudioTime } from "./audio-time";

describe("formatAudioTime", () => {
  it.each([
    [0, "00:00.000"],
    [0.032834, "00:00.033"],
    [5.004, "00:05.004"],
    [59.9996, "01:00.000"],
    [61.234, "01:01.234"],
    [3600, "60:00.000"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatAudioTime(seconds)).toBe(expected);
  });

  it("uses zero for invalid or negative values", () => {
    expect(formatAudioTime(Number.NaN)).toBe("00:00.000");
    expect(formatAudioTime(-1)).toBe("00:00.000");
  });
});
