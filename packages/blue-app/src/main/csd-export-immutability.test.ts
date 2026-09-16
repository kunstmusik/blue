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
import {
  ProjectRuntimeReconciliation,
  type RuntimeBinding,
  type RuntimeWorkOperation,
} from './project-runtime-reconciliation';

// Spec 111 T073: export derivation stays detached from a dirty canonical project,
// its attached runtime reconciliation, and its publication/history state.
// Successful, failed, and cancelled CSD saves and disk renders —
// synchronous and asynchronous generation alike — leave project XML, dirty
// state, history cursor/entry count, and object identity exactly as they were,
// and never publish a history entry or a runtime outcome.

interface RuntimeHarness {
  readonly reconciliation: ProjectRuntimeReconciliation;
  readonly outcomes: ProjectRuntimeOutcomeSnapshot[];
  readonly timelineOperations: RuntimeWorkOperation[];
  readonly blueLiveOperations: RuntimeWorkOperation[];
}

interface ProjectRuntimeOutcomeSnapshot {
  readonly performanceKind: 'timeline' | 'blueLive';
  readonly generation: number;
  readonly desiredRevision: number;
  readonly appliedRevision?: number;
  readonly status: string;
  readonly message?: string;
  readonly affectedOwnerIds?: string[];
}

interface ExportFixture {
  readonly session: ProjectSession;
  readonly history: ProjectHistory;
  readonly recorder: FakePublicationRecorder;
  readonly contextA: MockHistoryContext;
  readonly data: BlueData;
  readonly runtime: RuntimeHarness;
}

function snapshotRuntimeOutcome(
  outcome: ProjectRuntimeOutcomeSnapshot | null,
): ProjectRuntimeOutcomeSnapshot | null {
  if (!outcome) return null;
  return {
    ...outcome,
    ...(outcome.affectedOwnerIds ? { affectedOwnerIds: [...outcome.affectedOwnerIds] } : {}),
  };
}

function createRuntimeHarness(): RuntimeHarness {
  const outcomes: ProjectRuntimeOutcomeSnapshot[] = [];
  const timelineOperations: RuntimeWorkOperation[] = [];
  const blueLiveOperations: RuntimeWorkOperation[] = [];
  const binding: RuntimeBinding = { kind: 'mixer-gates', signature: 'export-test-topology' };
  const bindings = new Map<string, RuntimeBinding>([['mixer-gates::gates', binding]]);
  const makeClient = (operations: RuntimeWorkOperation[]) => ({
    async applyOperation(operation: RuntimeWorkOperation) {
      operations.push(structuredClone(operation));
      return { status: 'applied' as const };
    },
  });
  const reconciliation = new ProjectRuntimeReconciliation({
    onOutcome: (outcome) => outcomes.push(snapshotRuntimeOutcome(outcome)!),
    resolveMixerGates: () => ({ signature: 'export-test-topology', values: [1] }),
  });
  reconciliation.registerPerformance('timeline', 11, makeClient(timelineOperations), bindings);
  reconciliation.registerPerformance('blueLive', 22, makeClient(blueLiveOperations), bindings);
  return { reconciliation, outcomes, timelineOperations, blueLiveOperations };
}

async function setupHistory(): Promise<ExportFixture> {
  const session = new ProjectSession();
  const data = new BlueData();
  data.getMixer().setEnabled(true);
  const channel = new Channel();
  channel.setName('A');
  data.getMixer().getChannels().push(channel);
  session.replace(data, '/tmp/immutability.blue');
  const recorder = new FakePublicationRecorder();
  const runtime = createRuntimeHarness();
  const history = new ProjectHistory({
    session,
    publishUpdated: (evt) => recorder.record(evt),
    reconciliation: runtime.reconciliation,
  });
  const contextA = new MockHistoryContext('ctx-a');
  const committed = await history.commit(
    contextA.nextCommitRequest(session.read().documentId!, 0, 'Prepare dirty export baseline', [
      { mixer: { type: 'updateChannel', channelId: 'master', patch: { muted: true } } },
    ]),
  );
  expect(committed.status).toBe('committed');
  expect(history.isDirty()).toBe(true);
  expect(history.getCursor()).toBe(1);
  expect(history.getEntries()).toHaveLength(1);
  expect(recorder.events).toHaveLength(1);
  expect(runtime.timelineOperations).toHaveLength(1);
  expect(runtime.blueLiveOperations).toHaveLength(1);
  expect(runtime.outcomes.filter((outcome) => outcome.status === 'applied')).toHaveLength(2);
  return { session, history, recorder, contextA, data, runtime };
}

interface CapturedState {
  xml: string;
  dirty: boolean;
  historyLength: number;
  historyCursor: number;
  historyEntries: readonly unknown[];
  revision: number;
  stateId: string | null;
  mixerRef: ReturnType<BlueData['getMixer']>;
  channelRef: Channel;
  masterRef: Channel;
  runtimeOutcomes: readonly ProjectRuntimeOutcomeSnapshot[];
  timelineOperations: readonly RuntimeWorkOperation[];
  blueLiveOperations: readonly RuntimeWorkOperation[];
  publicationEvents: readonly unknown[];
}

function capture(fixture: ExportFixture): CapturedState {
  const { data, history, runtime, recorder, session } = fixture;
  return {
    xml: data.saveToString(),
    dirty: history.isDirty(),
    historyLength: history.read().length,
    historyCursor: history.getCursor(),
    historyEntries: history.getEntries().map((entry) => ({
      entryId: entry.entryId,
      label: entry.label,
      beforeStateId: entry.beforeStateId,
      afterStateId: entry.afterStateId,
      kind: entry.record.kind,
      changedTargets: entry.changedTargets,
    })),
    revision: session.read().revision,
    stateId: session.read().stateId,
    mixerRef: data.getMixer(),
    channelRef: data.getMixer().getChannels()[0]!,
    masterRef: data.getMixer().getMaster(),
    runtimeOutcomes: runtime.outcomes.map((outcome) => ({
      ...outcome,
      ...(outcome.affectedOwnerIds ? { affectedOwnerIds: [...outcome.affectedOwnerIds] } : {}),
    })),
    timelineOperations: runtime.timelineOperations.map((operation) => structuredClone(operation)),
    blueLiveOperations: runtime.blueLiveOperations.map((operation) => structuredClone(operation)),
    publicationEvents: recorder.events.map((event) => ({
      documentId: event.documentId,
      sessionId: event.sessionId,
      revision: event.revision,
      stateId: event.stateId,
      isDirty: event.isDirty,
      history: event.history,
    })),
  };
}

function expectUnchanged(fixture: ExportFixture, before: CapturedState): void {
  const { data, history, runtime, recorder, session } = fixture;
  expect(data.saveToString()).toBe(before.xml);
  expect(history.isDirty()).toBe(before.dirty);
  expect(history.read().length).toBe(before.historyLength);
  expect(history.getCursor()).toBe(before.historyCursor);
  expect(
    history.getEntries().map((entry) => ({
      entryId: entry.entryId,
      label: entry.label,
      beforeStateId: entry.beforeStateId,
      afterStateId: entry.afterStateId,
      kind: entry.record.kind,
      changedTargets: entry.changedTargets,
    })),
  ).toEqual(before.historyEntries);
  expect(session.read().revision).toBe(before.revision);
  expect(session.read().stateId).toBe(before.stateId);
  expect(data.getMixer()).toBe(before.mixerRef);
  // Same canonical object: the export never rebuilt or replaced the model.
  expect(data.getMixer().getChannels()[0]).toBe(before.channelRef);
  expect(data.getMixer().getMaster()).toBe(before.masterRef);
  expect(data.getMixer().getMaster().isMuted()).toBe(true);
  expect(runtime.outcomes).toEqual(before.runtimeOutcomes);
  expect(runtime.timelineOperations).toEqual(before.timelineOperations);
  expect(runtime.blueLiveOperations).toEqual(before.blueLiveOperations);
  expect(
    recorder.events.map((event) => ({
      documentId: event.documentId,
      sessionId: event.sessionId,
      revision: event.revision,
      stateId: event.stateId,
      isDirty: event.isDirty,
      history: event.history,
    })),
  ).toEqual(before.publicationEvents);
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

describe('export immutability across save and render flows (Spec 111 T073)', () => {
  let outputDirectory: string;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-t073-'));
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  describe('saveGeneratedCsdToDisk', () => {
    it('cancelled dialogs change nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);

      const result = await saveGeneratedCsdToDisk({
        currentData: data,
        mainWindow: { webContents: { send: vi.fn() } } as never,
        dialogApi: {
          showSaveDialog: async () => ({ canceled: true, filePath: undefined }) as never,
        },
      });

      expect(result).toBeNull();
      expectUnchanged(fixture, before);
    });

    it('a successful synchronous save changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);
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
      expectUnchanged(fixture, before);
    });

    it('a successful asynchronous save (runtime client) changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);
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
      expectUnchanged(fixture, before);
    });

    it('a failed write rejects and changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);

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

      expectUnchanged(fixture, before);
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
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);

      const result = await executeRenderToDisk(
        buildContext(data, () => true),
        { type: 'render' } as never,
        'op-cancel',
        statusCallback,
        { runCsound: async () => ({ exitCode: 0, stderr: '' }) },
      );

      expect(result.cancelled).toBe(true);
      expect(result.ok).toBe(false);
      expectUnchanged(fixture, before);
    });

    it('a successful render changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);
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
      expectUnchanged(fixture, before);
    });

    it('a successful asynchronous render changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);
      const outputPath = path.join(outputDirectory, 'render-async-ok.wav');

      const result = await executeRenderToDisk(
        {
          ...buildContext(data),
          outputFile: outputPath,
          javaScriptSession: {} as never,
          javaRuntimeClient: {} as never,
        },
        { type: 'render' } as never,
        'op-async-ok',
        statusCallback,
        {
          runCsound: async () => {
            await writeFile(outputPath, 'fake async wav bytes');
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(result.ok).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expectUnchanged(fixture, before);
    });

    it('a failed Csound run changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);

      const result = await executeRenderToDisk(
        buildContext(data),
        { type: 'render' } as never,
        'op-fail',
        statusCallback,
        { runCsound: async () => ({ exitCode: 1, stderr: 'orchestra compile error' }) },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('orchestra compile error');
      expectUnchanged(fixture, before);
    });

    it('a failed asynchronous Csound run changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);

      const result = await executeRenderToDisk(
        {
          ...buildContext(data),
          javaScriptSession: {} as never,
          javaRuntimeClient: {} as never,
        },
        { type: 'render' } as never,
        'op-async-fail',
        statusCallback,
        { runCsound: async () => ({ exitCode: 1, stderr: 'async orchestra compile error' }) },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('async orchestra compile error');
      expectUnchanged(fixture, before);
    });

    it('a cancelled asynchronous render changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);
      let cancelled = false;

      const result = await executeRenderToDisk(
        {
          ...buildContext(data, () => cancelled),
          javaScriptSession: {} as never,
          javaRuntimeClient: {} as never,
        },
        { type: 'render' } as never,
        'op-async-cancel',
        statusCallback,
        {
          runCsound: async () => {
            cancelled = true;
            return { exitCode: -1, stderr: 'Operation cancelled.' };
          },
        },
      );

      expect(result.cancelled).toBe(true);
      expect(result.ok).toBe(false);
      expectUnchanged(fixture, before);
    });

    it('a CSD generation failure changes nothing', async () => {
      const fixture = await setupHistory();
      const { data } = fixture;
      const before = capture(fixture);
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
      expectUnchanged(fixture, before);
    });
  });
});
