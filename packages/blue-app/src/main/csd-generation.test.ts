import { describe, expect, it, vi } from 'vitest';

import type { JavaRuntimeClientContract, JavaScriptSession } from '@blue/data';

import { generateDiskCsdForScreen, generateRealtimeCsdForScreen } from './csd-generation';

describe('screen CSD generation', () => {
  it('uses the disk profile for the ordinary Generate CSD to Screen action', async () => {
    const session = {} as JavaScriptSession;
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const toDiskCSDAsync = vi.fn(async () => 'async-disk-csd');

    await expect(
      generateDiskCsdForScreen({ toDiskCSD, toDiskCSDAsync }, session, null),
    ).resolves.toBe('disk-csd');
    expect(toDiskCSD).toHaveBeenCalledWith(session, undefined);
    expect(toDiskCSDAsync).not.toHaveBeenCalled();
  });

  it('uses the Java runtime async disk profile when runtime evaluation is required', async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const toDiskCSDAsync = vi.fn(async () => 'java-runtime-disk-csd');

    await expect(
      generateDiskCsdForScreen({ toDiskCSD, toDiskCSDAsync }, session, runtimeClient),
    ).resolves.toBe('java-runtime-disk-csd');
    expect(toDiskCSDAsync).toHaveBeenCalledWith(session, runtimeClient, undefined);
    expect(toDiskCSD).not.toHaveBeenCalled();
  });

  it('uses the realtime profile for the Generate Realtime CSD to Screen action', async () => {
    const session = {} as JavaScriptSession;
    const toCSD = vi.fn(() => 'realtime-csd');
    const toCSDAsync = vi.fn(async () => 'async-realtime-csd');

    await expect(generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, null)).resolves.toBe(
      'realtime-csd',
    );
    expect(toCSD).toHaveBeenCalledWith(session, undefined);
    expect(toCSDAsync).not.toHaveBeenCalled();
  });

  it('uses the Java runtime async realtime profile when runtime evaluation is required', async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const toCSD = vi.fn(() => 'realtime-csd');
    const toCSDAsync = vi.fn(async () => 'java-runtime-realtime-csd');

    await expect(
      generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, runtimeClient),
    ).resolves.toBe('java-runtime-realtime-csd');
    expect(toCSDAsync).toHaveBeenCalledWith(session, runtimeClient, undefined);
    expect(toCSD).not.toHaveBeenCalled();
  });

  it('keeps in-flight CSD output bound to the project that initiated it', async () => {
    let resolveOriginal!: (value: string) => void;
    const original = {
      toDiskCSD: vi.fn(() => 'original-sync'),
      toDiskCSDAsync: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveOriginal = resolve;
          }),
      ),
    };
    const replacement = {
      toDiskCSD: vi.fn(() => 'replacement-sync'),
      toDiskCSDAsync: vi.fn(async () => 'replacement-async'),
    };
    const runtimeClient = {} as JavaRuntimeClientContract;

    const originalOutput = generateDiskCsdForScreen(original, undefined, runtimeClient);
    const replacementOutput = generateDiskCsdForScreen(replacement, undefined, runtimeClient);
    resolveOriginal('original-async');

    await expect(originalOutput).resolves.toBe('original-async');
    await expect(replacementOutput).resolves.toBe('replacement-async');
    expect(original.toDiskCSDAsync).toHaveBeenCalledOnce();
    expect(replacement.toDiskCSDAsync).toHaveBeenCalledOnce();
  });

  it('generates CSD output deterministically regardless of manual configuration', async () => {
    const session = {} as JavaScriptSession;
    const csdText =
      '<CsoundSynthesizer>\n<CsInstruments>\ninstr 1\n  a1 oscili 0.5, 440\nendin\n</CsInstruments>\n</CsoundSynthesizer>';
    const toCSD = vi.fn(() => csdText);
    const toCSDAsync = vi.fn(async () => csdText);

    const first = await generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, null);
    const second = await generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, null);

    expect(first).toBe(csdText);
    expect(second).toBe(csdText);
    expect(first).toBe(second);
  });

  it('forwards the detached layout manifest for screen CSD generation (T012, T015, T081)', async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const manifest = { observations: new Map() } as any;

    const diskMock = {
      toDiskCSD: vi.fn(() => 'disk-sync'),
      toDiskCSDAsync: vi.fn(async () => 'disk-async'),
    };
    await generateDiskCsdForScreen(diskMock, session, null, manifest);
    expect(diskMock.toDiskCSD).toHaveBeenCalledWith(session, manifest);

    await generateDiskCsdForScreen(diskMock, session, runtimeClient, manifest);
    expect(diskMock.toDiskCSDAsync).toHaveBeenCalledWith(session, runtimeClient, manifest);

    const realtimeMock = {
      toCSD: vi.fn(() => 'rt-sync'),
      toCSDAsync: vi.fn(async () => 'rt-async'),
    };
    await generateRealtimeCsdForScreen(realtimeMock, session, null, manifest);
    expect(realtimeMock.toCSD).toHaveBeenCalledWith(session, manifest);

    await generateRealtimeCsdForScreen(realtimeMock, session, runtimeClient, manifest);
    expect(realtimeMock.toCSDAsync).toHaveBeenCalledWith(session, runtimeClient, manifest);
  });
});
