import { describe, expect, it, vi } from "vitest";

import type { JavaRuntimeClientContract, JavaScriptSession } from "@blue/data";

import {
  generateDiskCsdForScreen,
  generateRealtimeCsdForScreen,
} from "./csd-generation";

describe("screen CSD generation", () => {
  it("uses the disk profile for the ordinary Generate CSD to Screen action", async () => {
    const session = {} as JavaScriptSession;
    const toDiskCSD = vi.fn(() => "disk-csd");
    const toDiskCSDAsync = vi.fn(async () => "async-disk-csd");

    await expect(
      generateDiskCsdForScreen({ toDiskCSD, toDiskCSDAsync }, session, null),
    ).resolves.toBe("disk-csd");
    expect(toDiskCSD).toHaveBeenCalledWith(session);
    expect(toDiskCSDAsync).not.toHaveBeenCalled();
  });

  it("uses the Java runtime async disk profile when runtime evaluation is required", async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const toDiskCSD = vi.fn(() => "disk-csd");
    const toDiskCSDAsync = vi.fn(async () => "java-runtime-disk-csd");

    await expect(
      generateDiskCsdForScreen(
        { toDiskCSD, toDiskCSDAsync },
        session,
        runtimeClient,
      ),
    ).resolves.toBe("java-runtime-disk-csd");
    expect(toDiskCSDAsync).toHaveBeenCalledWith(session, runtimeClient);
    expect(toDiskCSD).not.toHaveBeenCalled();
  });

  it("uses the realtime profile for the Generate Realtime CSD to Screen action", async () => {
    const session = {} as JavaScriptSession;
    const toCSD = vi.fn(() => "realtime-csd");
    const toCSDAsync = vi.fn(async () => "async-realtime-csd");

    await expect(
      generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, null),
    ).resolves.toBe("realtime-csd");
    expect(toCSD).toHaveBeenCalledWith(session);
    expect(toCSDAsync).not.toHaveBeenCalled();
  });

  it("uses the Java runtime async realtime profile when runtime evaluation is required", async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const toCSD = vi.fn(() => "realtime-csd");
    const toCSDAsync = vi.fn(async () => "java-runtime-realtime-csd");

    await expect(
      generateRealtimeCsdForScreen(
        { toCSD, toCSDAsync },
        session,
        runtimeClient,
      ),
    ).resolves.toBe("java-runtime-realtime-csd");
    expect(toCSDAsync).toHaveBeenCalledWith(session, runtimeClient);
    expect(toCSD).not.toHaveBeenCalled();
  });
});
