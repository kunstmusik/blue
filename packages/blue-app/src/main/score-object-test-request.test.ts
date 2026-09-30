import { describe, expect, it, vi } from 'vitest';
import { BlueData } from '@blue/data';
import type { ScoreObjectEditorRequest, ScoreObjectTestResult } from '../shared/project-editor';
import { createDeferred } from './project-history-test-support';
import type { ScoreObjectTestOptions } from './score-object-test';
import {
  runScoreObjectTestRequest,
  type ScoreObjectTestProjectState,
} from './score-object-test-request';

const objectiveDurationRequest = {
  target: {} as ScoreObjectEditorRequest['target'],
  mode: 'objective-duration',
  expectedProjectRevision: 4,
  expectedProjectSessionId: 11,
} satisfies ScoreObjectEditorRequest;

describe('runScoreObjectTestRequest project fence', () => {
  it.each(['revision', 'sessionId'] as const)(
    'discards a completed measurement if the project %s changes while generation is pending',
    async (field) => {
      const project: ScoreObjectTestProjectState = {
        data: new BlueData(),
        revision: 4,
        sessionId: 11,
      };
      const generationStarted = createDeferred<void>();
      const generationResult = createDeferred<ScoreObjectTestResult>();
      const testScoreObject = vi.fn(
        (
          _data: BlueData | null,
          _request: ScoreObjectEditorRequest,
          _options?: ScoreObjectTestOptions,
        ): Promise<ScoreObjectTestResult> => {
          generationStarted.resolve();
          return generationResult.promise;
        },
      );
      const prepareJavaRuntime = vi.fn(async () => null);

      const resultPromise = runScoreObjectTestRequest(objectiveDurationRequest, {
        getProjectState: () => project,
        prepareJavaRuntime,
        testScoreObject,
      });
      await generationStarted.promise;
      project[field] += 1;
      generationResult.resolve({
        ok: true,
        output: 'i1\t0.0\t6\t440',
        objectiveDurationBeats: 6,
      });

      await expect(resultPromise).resolves.toMatchObject({
        ok: false,
        output: '',
        error: 'The project changed while measuring duration. Run the command again.',
      });
      expect(prepareJavaRuntime).toHaveBeenCalledWith(project.data);
      expect(testScoreObject).toHaveBeenCalledTimes(1);
    },
  );
});
