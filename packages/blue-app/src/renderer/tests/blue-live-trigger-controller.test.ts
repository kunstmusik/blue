import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, GenericScore, LiveObject, LiveObjectBins, PythonObject } from '@blue/data';
import { createModernProject, createRuntimeBackedLiveData } from '@blue/data';
import {
  BlueLiveTriggerController,
  type BlueLiveTriggerControllerAccessors,
} from '../../main/blue-live-trigger-controller';
import {
  createDeferredPreparation as createDeferred,
  createBlueLiveTriggerHarness,
  type BlueLiveTriggerHarness,
} from './helpers/blue-live-trigger-harness';

function buildAccessors(harness: BlueLiveTriggerHarness): BlueLiveTriggerControllerAccessors {
  return {
    getCanonicalProject: () => harness.canonicalProject.data,
    getProjectSessionId: () => harness.canonicalProject.sessionId,
    getDocumentRevision: () => harness.canonicalProject.revision,
    getBlueLiveSession: () => harness.engine,
    getJavaScriptSession: () => null,
    getJavaRuntimeSessionManager: () => ({
      ensureReady: async () => harness.javaRuntime,
    }),
    getCurrentFilePath: () => null,
  };
}

async function waitForJythonScoreCall(
  harness: BlueLiveTriggerHarness,
  expectedCalls: number,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (harness.javaRuntime.calls.jythonScore === expectedCalls) {
      return;
    }
    await Promise.resolve();
  }
  expect(harness.javaRuntime.calls.jythonScore).toBe(expectedCalls);
}

describe('BlueLiveTriggerController (US1 selected/enabled submission)', () => {
  let harness: BlueLiveTriggerHarness;
  let controller: BlueLiveTriggerController;

  afterEach(() => {
    harness?.reset();
  });

  function setup(data: BlueData): void {
    harness = createBlueLiveTriggerHarness(data);
    harness.engine.start();
    controller = new BlueLiveTriggerController(buildAccessors(harness));
  }

  it('rejects when no project is loaded', async () => {
    harness = createBlueLiveTriggerHarness(null);
    harness.engine.start();
    controller = new BlueLiveTriggerController(buildAccessors(harness));
    const result = await controller.trigger({ mode: 'enabled' });
    expect(result.status).toBe('rejected');
    expect(result.code).toBe('no-project');
  });

  it('rejects when Blue Live is not running', async () => {
    setup(createModernProject());
    harness.engine.stop();
    const result = await controller.trigger({ mode: 'enabled' });
    expect(result.status).toBe('rejected');
    expect(result.code).toBe('not-running');
  });

  it('rejects an invalid request', async () => {
    setup(createModernProject());
    const result = await controller.trigger({ mode: 'selected', liveObjectId: '  ' });
    expect(result.status).toBe('rejected');
    expect(result.code).toBe('invalid-request');
  });

  it('submits an enabled batch and reports counts', async () => {
    setup(createModernProject());
    const result = await controller.trigger({ mode: 'enabled' });
    expect(result.status).toBe('submitted');
    expect(result.ok).toBe(true);
    expect(result.targetCount).toBe(3);
    expect(result.noteCount).toBe(3);
    expect(harness.engine.submissions).toHaveLength(1);
  });

  it('submits a selected disabled cell regardless of enabled flag', async () => {
    setup(createModernProject());
    const result = await controller.trigger({ mode: 'selected', liveObjectId: 'lo-00' });
    expect(result.status).toBe('submitted');
    expect(result.targetCount).toBe(1);
  });

  it('returns target-not-found for a missing selected id', async () => {
    setup(createModernProject());
    const result = await controller.trigger({ mode: 'selected', liveObjectId: 'missing' });
    expect(result.status).toBe('rejected');
    expect(result.code).toBe('target-not-found');
  });

  it('returns empty when no cells are enabled', async () => {
    const data = new BlueData();
    setup(data);
    const result = await controller.trigger({ mode: 'enabled' });
    expect(result.status).toBe('empty');
    expect(result.ok).toBe(true);
    expect(harness.engine.submissions).toHaveLength(0);
  });

  it('returns empty without an engine call when targets generate zero notes', async () => {
    const data = new BlueData();
    const bins = new LiveObjectBins(1, 1);
    const target = new LiveObject();
    const score = new GenericScore();
    score.setScoreText('');
    target.setUniqueId('empty-score');
    target.setEnabled(true);
    target.setSoundObject(score);
    bins.setLiveObject(0, 0, target);
    data.getLiveData().setLiveObjectBins(bins);
    setup(data);

    const result = await controller.trigger({ mode: 'enabled' });

    expect(result.status).toBe('empty');
    expect(result.targetCount).toBe(1);
    expect(result.noteCount).toBe(0);
    expect(harness.engine.submissions).toHaveLength(0);
  });

  it('returns busy when a job is already in flight', async () => {
    const fixture = createRuntimeBackedLiveData();
    setup(fixture.data);
    const deferred = createDeferred();
    harness.javaRuntime.setOptions({ waitFor: deferred.promise });
    const first = controller.trigger({ mode: 'selected', liveObjectId: 'rt-py' });
    await waitForJythonScoreCall(harness, 1);
    const second = await controller.trigger({ mode: 'enabled' });
    expect(second.status).toBe('busy');
    deferred.resolve();
    await first;
  });

  it('acquires the Java runtime and submits its exact generated score', async () => {
    const fixture = createRuntimeBackedLiveData();
    setup(fixture.data);
    harness.javaRuntime.setOptions({ scoreText: 'i7 3 2 0.5' });

    const result = await controller.trigger({ mode: 'selected', liveObjectId: 'rt-py' });

    expect(result.status).toBe('submitted');
    expect(harness.javaRuntime.calls.jythonScore).toBe(1);
    expect(harness.engine.submissions).toHaveLength(1);
    expect(harness.engine.submissions[0]?.scoreText.trim()).toBe('i7\t3.0\t2\t0.5');
  });

  it('returns engine-rejected when submission fails', async () => {
    setup(createModernProject());
    harness.engine.submitOk = false;
    const result = await controller.trigger({ mode: 'enabled' });
    expect(result.status).toBe('failed');
    expect(result.code).toBe('engine-rejected');
  });

  it('does not mutate the canonical project during a trigger', async () => {
    const data = createModernProject();
    const before = data.saveToString();
    setup(data);
    await controller.trigger({ mode: 'enabled' });
    expect(data.saveToString()).toBe(before);
  });
});

describe('BlueLiveTriggerController (US2 stale fence)', () => {
  let harness: BlueLiveTriggerHarness;
  let controller: BlueLiveTriggerController;

  afterEach(() => {
    harness?.reset();
  });

  function setup(data: BlueData): void {
    harness = createBlueLiveTriggerHarness(data);
    harness.engine.start();
    controller = new BlueLiveTriggerController(buildAccessors(harness));
  }

  it('returns stale-session when the Blue Live session generation changes during preparation', async () => {
    const fixture = createRuntimeBackedLiveData();
    setup(fixture.data);
    const deferred = createDeferred();
    harness.javaRuntime.setOptions({ waitFor: deferred.promise });
    const triggerPromise = controller.trigger({ mode: 'selected', liveObjectId: 'rt-py' });
    await waitForJythonScoreCall(harness, 1);
    harness.engine.recompile();
    deferred.resolve();
    const result = await triggerPromise;
    expect(result.status).toBe('stale');
    expect(result.code).toBe('stale-session');
    expect(harness.engine.submissions).toHaveLength(0);
  });

  it('returns stale-document when the document revision changes during preparation', async () => {
    const fixture = createRuntimeBackedLiveData();
    setup(fixture.data);
    const deferred = createDeferred();
    harness.javaRuntime.setOptions({ waitFor: deferred.promise });
    const triggerPromise = controller.trigger({ mode: 'selected', liveObjectId: 'rt-py' });
    await waitForJythonScoreCall(harness, 1);
    harness.canonicalProject.advanceRevision();
    deferred.resolve();
    const result = await triggerPromise;
    expect(result.status).toBe('stale');
    expect(result.code).toBe('stale-document');
    expect(harness.engine.submissions).toHaveLength(0);
  });

  it('returns stale-document when the project is replaced during preparation', async () => {
    const fixture = createRuntimeBackedLiveData();
    setup(fixture.data);
    const deferred = createDeferred();
    harness.javaRuntime.setOptions({ waitFor: deferred.promise });
    const triggerPromise = controller.trigger({ mode: 'selected', liveObjectId: 'rt-py' });
    await waitForJythonScoreCall(harness, 1);
    harness.canonicalProject.replaceData(new BlueData());
    deferred.resolve();
    const result = await triggerPromise;
    expect(result.status).toBe('stale');
    expect(result.code).toBe('stale-document');
    expect(harness.engine.submissions).toHaveLength(0);
  });
});

describe('BlueLiveTriggerController stress (SC-003/SC-004)', () => {
  it('100 revision changes during preparation submit zero stale events', async () => {
    const fixture = createRuntimeBackedLiveData();
    const harness = createBlueLiveTriggerHarness(fixture.data);
    harness.engine.start();
    const controller = new BlueLiveTriggerController(buildAccessors(harness));

    for (let i = 0; i < 100; i++) {
      const deferred = createDeferred();
      harness.javaRuntime.setOptions({ waitFor: deferred.promise });
      const triggerPromise = controller.trigger({ mode: 'selected', liveObjectId: 'rt-py' });
      await waitForJythonScoreCall(harness, i + 1);
      harness.canonicalProject.advanceRevision();
      deferred.resolve();
      const result = await triggerPromise;
      expect(result.status).toBe('stale');
      expect(result.code).toBe('stale-document');
    }
    expect(harness.engine.submissions).toHaveLength(0);
    harness.reset();
  });

  it('100 stop/recompile/project-replacement cycles submit zero obsolete events', async () => {
    const fixture = createRuntimeBackedLiveData();
    const harness = createBlueLiveTriggerHarness(fixture.data);
    harness.engine.start();
    const controller = new BlueLiveTriggerController(buildAccessors(harness));

    for (let i = 0; i < 100; i++) {
      const deferred = createDeferred();
      harness.javaRuntime.setOptions({ waitFor: deferred.promise });
      const triggerPromise = controller.trigger({ mode: 'selected', liveObjectId: 'rt-py' });
      await waitForJythonScoreCall(harness, i + 1);
      controller.closeGate();
      harness.engine.stop();
      harness.canonicalProject.replaceData(fixture.data);
      harness.engine.start();
      controller.openGate();
      deferred.resolve();
      const result = await triggerPromise;
      expect(result.status).toBe('stale');
      expect(result.code).toBe('stale-document');
    }
    expect(harness.engine.submissions).toHaveLength(0);
    harness.reset();
  });
});

describe('BlueLiveTriggerController Repeat scheduling', () => {
  let harness: BlueLiveTriggerHarness;
  let controller: BlueLiveTriggerController;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    controller?.stopRepeatSchedule();
    harness?.reset();
    vi.useRealTimers();
  });

  it('triggers enabled cells every Repeat beats and stops when disabled', async () => {
    const data = createModernProject();
    data.getLiveData().setTempo(120);
    data.getLiveData().setRepeat(2);
    data.getLiveData().setRepeatEnabled(true);
    harness = createBlueLiveTriggerHarness(data);
    harness.engine.start();
    controller = new BlueLiveTriggerController(buildAccessors(harness));

    expect(controller.syncRepeatSchedule()).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(999);
    expect(harness.engine.submissions).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(harness.engine.submissions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(harness.engine.submissions).toHaveLength(3);

    data.getLiveData().setRepeatEnabled(false);
    expect(controller.syncRepeatSchedule()).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(harness.engine.submissions).toHaveLength(3);
  });

  it('preserves elapsed repeat phase when Tempo or Repeat changes live', async () => {
    const data = createModernProject();
    data.getLiveData().setTempo(120);
    data.getLiveData().setRepeat(4);
    data.getLiveData().setRepeatEnabled(true);
    harness = createBlueLiveTriggerHarness(data);
    harness.engine.start();
    controller = new BlueLiveTriggerController(buildAccessors(harness));

    controller.syncRepeatSchedule();
    await vi.advanceTimersByTimeAsync(1900);
    data.getLiveData().setRepeat(2);
    controller.syncRepeatSchedule();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.engine.submissions).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(harness.engine.submissions).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(300);
    data.getLiveData().setTempo(240);
    controller.syncRepeatSchedule();
    await vi.advanceTimersByTimeAsync(199);
    expect(harness.engine.submissions).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.engine.submissions).toHaveLength(3);
  });

  it('queues repeat ticks that arrive while another trigger is busy', async () => {
    const data = new BlueData();
    const bins = new LiveObjectBins(1, 1);
    const pythonObject = new PythonObject();
    pythonObject.setPythonCode('score = "i1 0 1 440"');
    const liveObject = new LiveObject();
    liveObject.setUniqueId('repeat-python');
    liveObject.setEnabled(true);
    liveObject.setSoundObject(pythonObject);
    bins.setLiveObject(0, 0, liveObject);
    data.getLiveData().setLiveObjectBins(bins);
    data.getLiveData().setTempo(300);
    data.getLiveData().setRepeat(1);
    data.getLiveData().setRepeatEnabled(true);
    harness = createBlueLiveTriggerHarness(data);
    harness.engine.start();
    controller = new BlueLiveTriggerController(buildAccessors(harness));

    const deferred = createDeferred();
    harness.javaRuntime.setOptions({ waitFor: deferred.promise });
    const manualTrigger = controller.trigger({ mode: 'selected', liveObjectId: 'repeat-python' });
    await waitForJythonScoreCall(harness, 1);
    controller.syncRepeatSchedule();
    await vi.advanceTimersByTimeAsync(600);

    expect(harness.javaRuntime.calls.jythonScore).toBe(1);
    expect(harness.engine.submissions).toHaveLength(0);

    deferred.resolve();
    expect((await manualTrigger).status).toBe('submitted');
    await waitForJythonScoreCall(harness, 4);
    for (let attempt = 0; attempt < 200 && harness.engine.submissions.length < 4; attempt += 1) {
      await Promise.resolve();
    }
    expect(harness.engine.submissions).toHaveLength(4);
  });

  it('does not schedule while the session is stopped and cancels on gate closure', async () => {
    const data = createModernProject();
    data.getLiveData().setRepeatEnabled(true);
    harness = createBlueLiveTriggerHarness(data);
    controller = new BlueLiveTriggerController(buildAccessors(harness));

    controller.syncRepeatSchedule();
    await vi.advanceTimersByTimeAsync(5000);
    expect(harness.engine.submissions).toHaveLength(0);

    harness.engine.start();
    controller.syncRepeatSchedule();
    controller.closeGate();
    await vi.advanceTimersByTimeAsync(5000);
    expect(harness.engine.submissions).toHaveLength(0);
  });
});
