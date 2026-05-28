import { useCallback, useState } from 'react';
import type { ScoreObjectEditorTargetSnapshot } from '../../../../../../shared/project-editor';
import { useProjectStore } from '../../../../../stores/project-store';

export interface ScoreObjectTestState {
  testing: boolean;
  testOutput: string | null;
  testError: string | null;
  runTest: () => Promise<void>;
  clearTestOutput: () => void;
  clearTestError: () => void;
}

export function useScoreObjectTest(target: ScoreObjectEditorTargetSnapshot): ScoreObjectTestState {
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setTesting(true);
    setTestError(null);
    try {
      await flushPendingPatches();
      const result = await window.blueAPI.testScoreObject({ target });
      if (result.ok) {
        setTestOutput(result.output);
      } else {
        setTestError(result.error ?? 'Unknown error');
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }, [flushPendingPatches, target]);
  const clearTestOutput = useCallback(() => setTestOutput(null), []);
  const clearTestError = useCallback(() => setTestError(null), []);

  return {
    testing,
    testOutput,
    testError,
    runTest,
    clearTestOutput,
    clearTestError,
  };
}
