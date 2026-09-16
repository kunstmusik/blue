// @vitest-environment jsdom

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, Channel } from '@blue/data';
import { saveGeneratedCsdToDisk } from './csd-export';
import { executeRenderToDisk } from './render-to-disk';
import type { DiskRenderSettingsSnapshot } from '../shared/program-settings';
import { ProjectHistory } from './project-history';
import { ProjectSession } from './project-session';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';

// Spec 111 T071: export derivation stays detached from the canonical project
// and history. Successful, failed, and cancelled CSD saves and disk renders —
// synchronous and asynchronous generation alike — leave project XML, dirty
// state, history cursor/entry count, and object identity exactly as they were,
// and never publish a history entry or a runtime outcome.

function setupHistory() {
  const session = new ProjectSession();
  const data = new BlueData();
  data.getMixer().setEnabled(true);
  const channel = new Channel();
  channel.setName('A');
  data.getMixer().getChannels().push(channel);
  session.replace(data, '/tmp/immutability.blue');
  const recorder = new FakePublicationRecorder();
  const history = new ProjectHistory({
    session,
    publishUpdated: (evt) => recorder.record(evt),
  });
  const contextA = new MockHistoryContext('ctx-a');
  return { session, history, recorder, contextA, data };
}

interface CapturedState {
  xml: string;
  dirty: boolean;
  historyLength: number;
  channelRef: Channel;
}

function capture(data: BlueData, history: ProjectHistory): CapturedState {
  return {
    xml: data.saveToString(),
    dirty: history.isDirty(),
    historyLength: history.read().length,
    channelRef: data.getMixer().getChannels()[0]!,
  };
}

function expectUnchanged(data: BlueData, history: ProjectHistory, before: CapturedState): void {
  expect(data.saveToString()).toBe(before.xml);
  expect(history.isDirty()).toBe(before.dirty);
  expect(history.read().length).toBe(before.historyLength);
  // Same canonical object: the export never rebuilt or replaced the model.
  expect(data.getMixer().getChannels()[0]).toBe(before.channelRef);
  expect(data.getMixer().getChannels()[0]!.isMuted()).toBe(false);
}

function diskRenderSettings(): DiskRenderSettingsSnapshot {
  return {
    csoundExecutable: 'csound',
    defaultSr: '',
    defaultKsmps: '',
    defaultNchnls: '',
    useZeroDbfs: false,
    zeroDbfs: '',
    fileFormatEnabled: false,
    fileFormat: '',
    sampleFormatEnabled: false,
    sampleFormat: '',
    savePeakInformation: false,
    ditherOutput: false,
    rewriteHeader: false,
    noteAmpsEnabled: true,
    outOfRangeEnabled: true,
    warningsEnabled: true,
    benchmarkEnabled: true,
    completeOverride: false,
    advancedSettings: '',
  } as unknown as DiskRenderSettingsSnapshot;
}

describe('export immutability across save and render flows (Spec 111 T071)', () => {
  let outputDirectory: string;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-t071-'));
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  describe('saveGeneratedCsdToDisk', () => {
    it('cancelled dialogs change nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);

      const result = await saveGeneratedCsdToDisk({
        currentData: data,
        mainWindow: { webContents: { send: vi.fn() } } as never,
        dialogApi: {
          showSaveDialog: async () => ({ canceled: true, filePath: undefined }) as never,
        },
      });

      expect(result).toBeNull();
      expectUnchanged(data, history, before);
    });

    it('a successful synchronous save changes nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);
      const target = path.join(outputDirectory, 'saved.csd');

      const result = await saveGeneratedCsdToDisk({
        currentData: data,
        mainWindow: { webContents: { send: vi.fn() } } as never,
        dialogApi: {
          showSaveDialog: async () => ({ canceled: false, filePath: target }) as never,
        },
        writeFile: async (file, text) => {
          await writeFile(file as string, text as string, 'utf-8');
        },
      });

      expect(result).toBe(target);
      expect(existsSync(target)).toBe(true);
      // The written artifact is the generated disk CSD, not project XML.
      expect(await readFile(target, 'utf-8')).toBe(data.toDiskCSD());
      expectUnchanged(data, history, before);
    });

    it('a successful asynchronous save (runtime client) changes nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);
      const target = path.join(outputDirectory, 'saved-async.csd');

      const result = await saveGeneratedCsdToDisk({
        currentData: data,
        mainWindow: { webContents: { send: vi.fn() } } as never,
        dialogApi: {
          showSaveDialog: async () => ({ canceled: false, filePath: target }) as never,
        },
        writeFile: async (file, text) => {
          await writeFile(file as string, text as string, 'utf-8');
        },
        runtimeClient: {} as never,
      });

      expect(result).toBe(target);
      expectUnchanged(data, history, before);
    });

    it('a failed write rejects and changes nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);

      await expect(
        saveGeneratedCsdToDisk({
          currentData: data,
          mainWindow: { webContents: { send: vi.fn() } } as never,
          dialogApi: {
            showSaveDialog: async () =>
              ({ canceled: false, filePath: path.join(outputDirectory, 'x.csd') }) as never,
          },
          writeFile: async () => {
            throw new Error('disk full');
          },
        }),
      ).rejects.toThrow('disk full');

      expectUnchanged(data, history, before);
    });
  });

  describe('executeRenderToDisk', () => {
    function buildContext(data: BlueData, isCancelled?: () => boolean) {
      return {
        data,
        projectDirectory: outputDirectory,
        diskRender: diskRenderSettings(),
        general: { messageColorsEnabled: false },
        outputFile: path.join(outputDirectory, 'render-out.wav'),
        isCancelled,
      };
    }

    const statusCallback = vi.fn();

    it('a cancelled render before generation changes nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);

      const result = await executeRenderToDisk(
        buildContext(data, () => true),
        { type: 'render' } as never,
        'op-cancel',
        statusCallback,
        { runCsound: async () => ({ exitCode: 0, stderr: '' }) },
      );

      expect(result.cancelled).toBe(true);
      expect(result.ok).toBe(false);
      expectUnchanged(data, history, before);
    });

    it('a successful render changes nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);
      const outputPath = path.join(outputDirectory, 'render-ok.wav');

      const result = await executeRenderToDisk(
        { ...buildContext(data), outputFile: outputPath },
        { type: 'render' } as never,
        'op-ok',
        statusCallback,
        {
          runCsound: async () => {
            // The Csound seam produces the output file on success.
            await writeFile(outputPath, 'fake wav bytes');
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(result.ok).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expectUnchanged(data, history, before);
    });

    it('a failed Csound run changes nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);

      const result = await executeRenderToDisk(
        buildContext(data),
        { type: 'render' } as never,
        'op-fail',
        statusCallback,
        { runCsound: async () => ({ exitCode: 1, stderr: 'orchestra compile error' }) },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('orchestra compile error');
      expectUnchanged(data, history, before);
    });

    it('a CSD generation failure changes nothing', async () => {
      const { data, history } = setupHistory();
      const before = capture(data, history);
      const breakingData = new Proxy(data, {
        get(target, prop) {
          if (prop === 'toDiskCSD') {
            return () => {
              throw new Error('generation exploded');
            };
          }
          return Reflect.get(target as object, prop, target as object);
        },
      }) as BlueData;

      const result = await executeRenderToDisk(
        buildContext(breakingData),
        { type: 'render' } as never,
        'op-genfail',
        statusCallback,
        { runCsound: async () => ({ exitCode: 0, stderr: '' }) },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('generation exploded');
      expectUnchanged(data, history, before);
    });
  });
});
