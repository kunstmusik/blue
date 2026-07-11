/**
 * Pure helper to build a temporary BlueData for freezing a single SoundObject.
 *
 * Mirrors the Java FreezeUnfreezeAction.freezeSoundObject algorithm:
 *   1. Deep-copy the source project (preserving arrangement, mixer, tempo map, etc.)
 *   2. Replace the score with a scratch PolyObject containing only the deep-copied source
 *   3. Set the render window to [objStart, objStart + subjectiveDuration + mixerExtraRenderTime]
 *
 * The original project and source object are never mutated — the deep copy
 * isolates the temporary render context.
 */
import { BlueData } from '../blue-data';
import { PolyObject } from '../sound-objects/poly-object';
import type { SoundObject } from '../sound-objects/sound-object';

export interface FreezeRenderDataResult {
  /** Temporary project for CSD generation and rendering. */
  tempData: BlueData;
  /** Start time in beats of the source object. */
  startTimeBeats: number;
  /** End time in beats (including mixer extra render time). */
  endTimeBeats: number;
}

/**
 * Build a temporary BlueData for freezing the given source SoundObject.
 *
 * @param sourceData The canonical project (not mutated).
 * @param sourceObject The SoundObject to freeze (not mutated; deep-copied internally).
 * @returns A temporary project with the isolated object and appropriate render window.
 */
export function buildFreezeRenderData(
  sourceData: BlueData,
  sourceObject: SoundObject,
): FreezeRenderDataResult {
  const context = sourceData.getScore().getTimeContext();

  const startTimeBeats = sourceObject.getStartTime().toBeats(context);
  const subjectiveDuration = sourceObject.getSubjectiveDuration().toBeats(context);
  let endTimeBeats = startTimeBeats + subjectiveDuration;

  const mixer = sourceData.getMixer();
  if (mixer.isEnabled()) {
    endTimeBeats += mixer.getExtraRenderTime();
  }

  const xml = sourceData.saveToString();
  const tempData = BlueData.loadFromString(xml);

  const tempObj = sourceObject.deepCopy();
  const tempPObj = new PolyObject(true);
  const sLayer = tempPObj.newLayerAt(-1);
  sLayer.push(tempObj);

  const tempScore = tempData.getScore();
  tempScore.length = 0;
  tempScore.push(tempPObj);

  tempData.setRenderStartTime(startTimeBeats);
  tempData.setRenderEndTime(endTimeBeats);
  // A freeze is intentionally scoped to its selected source object. The
  // project-level disk-render convenience setting must not widen this window.
  tempData.getProjectProperties().diskAlwaysRenderEntireProject = false;

  return { tempData, startTimeBeats, endTimeBeats };
}
