import { describe, expect, it, vi } from 'vitest';
import { createModernProject } from '@blue/data';
import {
  BlueLiveTriggerController,
  stopBlueLiveForProjectReplacement,
} from '../../main/blue-live-trigger-controller';
import {
  createBlueLiveTriggerHarness,
  createDeferredPreparation,
} from './helpers/blue-live-trigger-harness';

describe('Blue Live project replacement lifecycle', () => {
  it('closes trigger admission and awaits engine stop before replacement continues', async () => {
    const harness = createBlueLiveTriggerHarness(createModernProject());
    harness.engine.start();
    const controller = new BlueLiveTriggerController({
      getCanonicalProject: () => harness.canonicalProject.data,
      getProjectSessionId: () => harness.canonicalProject.sessionId,
      getDocumentRevision: () => harness.canonicalProject.revision,
      getBlueLiveSession: () => harness.engine,
      getJavaScriptSession: () => null,
      getJavaRuntimeSessionManager: () => null,
      getCurrentFilePath: () => null,
    });
    const deferred = createDeferredPreparation();
    const stop = vi.fn(async () => {
      await deferred.promise;
      return {
        status: 'stopped' as const,
        running: false,
        sessionId: harness.engine.sessionId,
      };
    });
    let replacementEligible = false;

    const replacement = stopBlueLiveForProjectReplacement(controller, { stop }).then(() => {
      replacementEligible = true;
    });

    expect(replacementEligible).toBe(false);
    const rejected = await controller.trigger({ mode: 'enabled' });
    expect(rejected.status).toBe('rejected');
    expect(rejected.code).toBe('not-running');

    deferred.resolve();
    await replacement;
    expect(stop).toHaveBeenCalledOnce();
    expect(replacementEligible).toBe(true);
  });
});
