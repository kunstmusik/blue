import { createAuditionProjectCopy, type BlueData, type ScoreObject } from '@blue/data';

export interface AuditionEngineHandoff {
  /** Disk render/freeze operations are exclusive with realtime audition. */
  isRenderOperationActive: boolean;
  isRealtimePlaying: () => boolean;
  stopRealtime: () => Promise<void>;
  startRealtime: (data: BlueData) => Promise<boolean>;
}

/**
 * Builds one disposable selected-only project and hands it to the existing
 * realtime lifecycle. The canonical project is never replaced or edited.
 */
export async function auditionSelectedScoreObjects(
  source: BlueData,
  selectedObjects: readonly ScoreObject[],
  engine: AuditionEngineHandoff,
): Promise<boolean> {
  if (engine.isRenderOperationActive || selectedObjects.length === 0) return false;
  if (engine.isRealtimePlaying()) await engine.stopRealtime();

  const auditionData = createAuditionProjectCopy(source, selectedObjects);
  return engine.startRealtime(auditionData);
}
