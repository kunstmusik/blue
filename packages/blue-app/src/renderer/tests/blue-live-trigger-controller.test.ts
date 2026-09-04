import { afterEach, describe, expect, it } from 'vitest';
import { BlueData, GenericScore, LiveObject, LiveObjectBins } from '@blue/data';
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
  for (let attempt = 0; attempt < 20; attempt++) {
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
