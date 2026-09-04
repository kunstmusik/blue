import { BlueData } from '../blue-data';
import type { ScoreObject } from './score-object';
import { Track } from './track/track';
import { TrackLayerGroup } from './track/track-layer-group';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { Score } from './score';
import type { LayerGroup } from './layers/layer-group';
import type { Layer } from './layers/layer';

/**
 * Creates the disposable project used by Java Blue's Audition ScoreObjects
 * action. The source graph is never mutated: BlueData.deepCopy() owns all
 * project state in the returned render document, then this helper removes
 * every score item that was not selected.
 */
export function createAuditionProjectCopy(
  source: BlueData,
  selectedObjects: readonly ScoreObject[],
): BlueData {
  if (selectedObjects.length === 0) {
    throw new Error('Audition requires at least one selected score object');
  }
  if (new Set(selectedObjects).size !== selectedObjects.length) {
    throw new Error('Audition selection contains duplicate score objects');
  }

  const selected = new Set(selectedObjects);
  const available = collectTimelineScoreObjects(source.getScore());
  for (const object of selectedObjects) {
    if (!available.has(object)) {
      throw new Error('Selected score object is not part of the current project');
    }
  }

  const copy = source.deepCopy() as BlueData;
  const retainedGroups: LayerGroup<Layer>[] = [];
  const sourceScore = source.getScore();
  const copiedScore = copy.getScore();

  for (let index = 0; index < sourceScore.length; index += 1) {
    const sourceGroup = sourceScore[index];
    const copiedGroup = copiedScore[index];
    if (!sourceGroup || !copiedGroup) continue;

    if (sourceGroup instanceof PolyObject && copiedGroup instanceof PolyObject) {
      if (filterPolyObject(sourceGroup, copiedGroup, selected)) retainedGroups.push(copiedGroup);
      continue;
    }

    if (sourceGroup instanceof TrackLayerGroup && copiedGroup instanceof TrackLayerGroup) {
      if (filterTrackLayerGroup(sourceGroup, copiedGroup, selected))
        retainedGroups.push(copiedGroup);
    }
  }

  copiedScore.splice(0, copiedScore.length, ...retainedGroups);
  setRenderWindow(copy, selectedObjects, sourceScore);
  return copy;
}

function collectTimelineScoreObjects(score: Score): Set<ScoreObject> {
  const result = new Set<ScoreObject>();
  for (const group of score) {
    if (group instanceof PolyObject) {
      collectPolyObjectScoreObjects(group, result);
    } else if (group instanceof TrackLayerGroup) {
      for (const track of group) {
        for (const object of track) result.add(object);
      }
    }
  }
  return result;
}

function collectPolyObjectScoreObjects(polyObject: PolyObject, result: Set<ScoreObject>): void {
  for (const layer of polyObject) {
    for (const object of layer) {
      result.add(object);
      if (object instanceof PolyObject) collectPolyObjectScoreObjects(object, result);
    }
  }
}

function filterPolyObject(
  source: PolyObject,
  copy: PolyObject,
  selected: Set<ScoreObject>,
): boolean {
  if (selected.has(source)) {
    clearPolyObjectMuteSolo(copy);
    return true;
  }

  for (let layerIndex = source.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const sourceLayer = source[layerIndex];
    const copyLayer = copy[layerIndex];
    if (!sourceLayer || !copyLayer || !filterSoundLayer(sourceLayer, copyLayer, selected)) {
      copy.removeLayers(layerIndex, layerIndex);
      continue;
    }
    copyLayer.setMuted(false);
    copyLayer.setSolo(false);
  }

  return copy.length > 0;
}

function filterSoundLayer(
  source: SoundLayer,
  copy: SoundLayer,
  selected: Set<ScoreObject>,
): boolean {
  for (let objectIndex = source.length - 1; objectIndex >= 0; objectIndex -= 1) {
    const sourceObject = source[objectIndex];
    const copyObject = copy[objectIndex];
    if (!sourceObject || !copyObject) {
      copy.splice(objectIndex, 1);
      continue;
    }

    if (selected.has(sourceObject)) {
      if (copyObject instanceof PolyObject) clearPolyObjectMuteSolo(copyObject);
      continue;
    }

    if (sourceObject instanceof PolyObject && copyObject instanceof PolyObject) {
      if (filterPolyObject(sourceObject, copyObject, selected)) continue;
    }

    copy.splice(objectIndex, 1);
  }
  return copy.length > 0;
}

function filterTrackLayerGroup(
  source: TrackLayerGroup,
  copy: TrackLayerGroup,
  selected: Set<ScoreObject>,
): boolean {
  for (let trackIndex = source.length - 1; trackIndex >= 0; trackIndex -= 1) {
    const sourceTrack = source[trackIndex];
    const copyTrack = copy[trackIndex];
    if (!sourceTrack || !copyTrack || !filterTrack(sourceTrack, copyTrack, selected)) {
      copy.removeLayers(trackIndex, trackIndex);
      continue;
    }
    copyTrack.setMuted(false);
    copyTrack.setSolo(false);
  }
  return copy.length > 0;
}

function filterTrack(source: Track, copy: Track, selected: Set<ScoreObject>): boolean {
  for (let objectIndex = source.length - 1; objectIndex >= 0; objectIndex -= 1) {
    const sourceObject = source[objectIndex];
    const copyObject = copy[objectIndex];
    if (!sourceObject || !copyObject || !selected.has(sourceObject)) {
      copy.splice(objectIndex, 1);
      continue;
    }
    if (copyObject instanceof PolyObject) clearPolyObjectMuteSolo(copyObject);
  }
  return copy.length > 0;
}

function clearPolyObjectMuteSolo(polyObject: PolyObject): void {
  for (const layer of polyObject) {
    layer.setMuted(false);
    layer.setSolo(false);
    for (const object of layer) {
      if (object instanceof PolyObject) clearPolyObjectMuteSolo(object);
    }
  }
}

function setRenderWindow(
  copy: BlueData,
  selectedObjects: readonly ScoreObject[],
  sourceScore: Score,
): void {
  const context = sourceScore.getTimeContext();
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const object of selectedObjects) {
    const objectStart = object.getStartTime().toBeats(context);
    const objectEnd = objectStart + object.getSubjectiveDuration().toBeats(context);
    start = Math.min(start, objectStart);
    end = Math.max(end, objectEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('Selected score objects do not have a finite render range');
  }

  if (copy.getMixer().isEnabled()) end += copy.getMixer().getExtraRenderTime();
  copy.setLoopRendering(false);
  copy.setRenderStartTime(start);
  copy.setRenderEndTime(end);
}
