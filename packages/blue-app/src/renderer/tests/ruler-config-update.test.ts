import { describe, it, expect } from 'vitest';
import type { TimebaseUpdateMode } from '../components/workbench/panels/score/RulerConfigDialog';
import {
  TimeBase,
  TimePosition,
  TimeDuration,
  TimeContext,
  BlueData,
  GenericScore,
} from '@blue/data';
import { applyScoreTimeStatePatch, applyProjectDocumentPatch } from '../../shared/project-editor';
import type { ScoreObjectEditorTargetSnapshot } from '../../shared/project-editor';

interface MockScoreObject {
  startTime: TimePosition;
  duration: TimeDuration;
  timeBase: TimeBase;
}

interface MockMarker {
  time: TimePosition;
  timeBase: TimeBase;
}

function shouldUpdateObject(
  obj: MockScoreObject,
  oldTimeBase: TimeBase,
  mode: TimebaseUpdateMode | null,
): { updateStart: boolean; updateDuration: boolean } {
  if (mode === null) return { updateStart: false, updateDuration: false };
  if (mode === 'UPDATE_ALL') return { updateStart: true, updateDuration: true };
  return {
    updateStart: obj.startTime.getTimeBase() === oldTimeBase,
    updateDuration: obj.duration.getTimeBase() === oldTimeBase,
  };
}

function shouldUpdateMarker(
  marker: MockMarker,
  oldTimeBase: TimeBase,
  mode: TimebaseUpdateMode | null,
): boolean {
  if (mode === null) return false;
  if (mode === 'UPDATE_ALL') return true;
  return marker.time.getTimeBase() === oldTimeBase;
}

describe('Ruler Config Timebase Update Logic', () => {
  const oldTimeBase = TimeBase.BEATS;
  const newTimeBase = TimeBase.SECONDS;

  const objBeatsBeats: MockScoreObject = {
    startTime: TimePosition.beats(4.0),
    duration: TimeDuration.beats(2.0),
    timeBase: TimeBase.BEATS,
  };

  const objBeatsSeconds: MockScoreObject = {
    startTime: TimePosition.beats(4.0),
    duration: TimeDuration.seconds(1.0),
    timeBase: TimeBase.BEATS,
  };

  const objSecondsSeconds: MockScoreObject = {
    startTime: TimePosition.seconds(2.0),
    duration: TimeDuration.seconds(1.0),
    timeBase: TimeBase.SECONDS,
  };

  const markerBeats: MockMarker = {
    time: TimePosition.beats(8.0),
    timeBase: TimeBase.BEATS,
  };

  const markerSeconds: MockMarker = {
    time: TimePosition.seconds(4.0),
    timeBase: TimeBase.SECONDS,
  };

  describe('shouldUpdateObject', () => {
    it('UPDATE_ALL updates all objects regardless of their timebase', () => {
      expect(shouldUpdateObject(objBeatsBeats, oldTimeBase, 'UPDATE_ALL')).toEqual({
        updateStart: true,
        updateDuration: true,
      });
      expect(shouldUpdateObject(objSecondsSeconds, oldTimeBase, 'UPDATE_ALL')).toEqual({
        updateStart: true,
        updateDuration: true,
      });
    });

    it('UPDATE_MATCHING only updates objects matching old timebase', () => {
      expect(shouldUpdateObject(objBeatsBeats, oldTimeBase, 'UPDATE_MATCHING')).toEqual({
        updateStart: true,
        updateDuration: true,
      });
      expect(shouldUpdateObject(objBeatsSeconds, oldTimeBase, 'UPDATE_MATCHING')).toEqual({
        updateStart: true,
        updateDuration: false,
      });
      expect(shouldUpdateObject(objSecondsSeconds, oldTimeBase, 'UPDATE_MATCHING')).toEqual({
        updateStart: false,
        updateDuration: false,
      });
    });

    it('UPDATE_MATCHING per-field: start matches old, duration does not', () => {
      expect(shouldUpdateObject(objBeatsSeconds, oldTimeBase, 'UPDATE_MATCHING')).toEqual({
        updateStart: true,
        updateDuration: false,
      });
    });

    it('null mode skips all updates', () => {
      expect(shouldUpdateObject(objBeatsBeats, oldTimeBase, null)).toEqual({
        updateStart: false,
        updateDuration: false,
      });
      expect(shouldUpdateObject(objSecondsSeconds, oldTimeBase, null)).toEqual({
        updateStart: false,
        updateDuration: false,
      });
    });
  });

  describe('shouldUpdateMarker', () => {
    it('UPDATE_ALL updates all markers regardless of timebase', () => {
      expect(shouldUpdateMarker(markerBeats, oldTimeBase, 'UPDATE_ALL')).toBe(true);
      expect(shouldUpdateMarker(markerSeconds, oldTimeBase, 'UPDATE_ALL')).toBe(true);
    });

    it('UPDATE_MATCHING only updates markers matching old timebase', () => {
      expect(shouldUpdateMarker(markerBeats, oldTimeBase, 'UPDATE_MATCHING')).toBe(true);
      expect(shouldUpdateMarker(markerSeconds, oldTimeBase, 'UPDATE_MATCHING')).toBe(false);
    });

    it('null mode skips all marker updates', () => {
      expect(shouldUpdateMarker(markerBeats, oldTimeBase, null)).toBe(false);
      expect(shouldUpdateMarker(markerSeconds, oldTimeBase, null)).toBe(false);
    });
  });

  describe('combined decision matrix', () => {
    const objects = [objBeatsBeats, objBeatsSeconds, objSecondsSeconds];
    const markers = [markerBeats, markerSeconds];

    function applyUpdate(
      scoreObjectMode: TimebaseUpdateMode | null,
      markerMode: TimebaseUpdateMode | null,
    ) {
      const updatedObjects = objects.map((obj) =>
        shouldUpdateObject(obj, oldTimeBase, scoreObjectMode),
      );
      const updatedMarkers = markers.map((m) => shouldUpdateMarker(m, oldTimeBase, markerMode));
      return { updatedObjects, updatedMarkers };
    }

    it('both UPDATE_ALL: updates everything', () => {
      const result = applyUpdate('UPDATE_ALL', 'UPDATE_ALL');
      expect(result.updatedObjects).toEqual([
        { updateStart: true, updateDuration: true },
        { updateStart: true, updateDuration: true },
        { updateStart: true, updateDuration: true },
      ]);
      expect(result.updatedMarkers).toEqual([true, true]);
    });

    it('both UPDATE_MATCHING: only matching items', () => {
      const result = applyUpdate('UPDATE_MATCHING', 'UPDATE_MATCHING');
      expect(result.updatedObjects).toEqual([
        { updateStart: true, updateDuration: true },
        { updateStart: true, updateDuration: false },
        { updateStart: false, updateDuration: false },
      ]);
      expect(result.updatedMarkers).toEqual([true, false]);
    });

    it('scoreobjects UPDATE_ALL, markers null: updates all objects, no markers', () => {
      const result = applyUpdate('UPDATE_ALL', null);
      expect(result.updatedObjects.every((o) => o.updateStart && o.updateDuration)).toBe(true);
      expect(result.updatedMarkers.every((m) => m === false)).toBe(true);
    });

    it('scoreobjects null, markers UPDATE_ALL: no objects, all markers', () => {
      const result = applyUpdate(null, 'UPDATE_ALL');
      expect(result.updatedObjects.every((o) => !o.updateStart && !o.updateDuration)).toBe(true);
      expect(result.updatedMarkers.every((m) => m === true)).toBe(true);
    });

    it('both null: nothing updated', () => {
      const result = applyUpdate(null, null);
      expect(result.updatedObjects.every((o) => !o.updateStart && !o.updateDuration)).toBe(true);
      expect(result.updatedMarkers.every((m) => m === false)).toBe(true);
    });

    it('scoreobjects UPDATE_MATCHING, markers UPDATE_ALL', () => {
      const result = applyUpdate('UPDATE_MATCHING', 'UPDATE_ALL');
      expect(result.updatedObjects).toEqual([
        { updateStart: true, updateDuration: true },
        { updateStart: true, updateDuration: false },
        { updateStart: false, updateDuration: false },
      ]);
      expect(result.updatedMarkers).toEqual([true, true]);
    });
  });

  describe('applyScoreTimeStatePatch converts sound object time bases', () => {
    function getFirstLayer(score: import('@blue/data').Score) {
      return (score[0] as import('@blue/data').PolyObject)[0];
    }

    it('UPDATE_ALL converts all score objects to new time base', () => {
      const data = new BlueData();
      const score = data.getScore();
      const ctx = score.getTimeContext();

      const layer = getFirstLayer(score);
      const gs = new GenericScore();
      gs.setName('test');
      gs.setStartTime(TimePosition.beats(4));
      gs.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(gs);

      const initialBase = gs.getStartTime().getTimeBase();
      expect(initialBase).toBe(TimeBase.BEATS);

      const changed = applyScoreTimeStatePatch(data, {
        primaryTimeDisplay: TimeBase.BBT,
        scoreObjectUpdateMode: 'UPDATE_ALL',
      });

      expect(changed).toBe(true);
      expect(gs.getStartTime().getTimeBase()).toBe(TimeBase.BBT);
      expect(gs.getStartTime().toBeats(ctx)).toBeCloseTo(4, 2);
      expect(gs.getSubjectiveDuration().getTimeBase()).toBe(TimeBase.BBT);
      expect(gs.getSubjectiveDuration().toBeats(ctx)).toBeCloseTo(2, 2);
    });

    it('UPDATE_MATCHING only converts matching time bases', () => {
      const data = new BlueData();
      const score = data.getScore();
      const layer = getFirstLayer(score);

      const gs1 = new GenericScore();
      gs1.setName('beats-obj');
      gs1.setStartTime(TimePosition.beats(2));
      gs1.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(gs1);

      const gs2 = new GenericScore();
      gs2.setName('seconds-obj');
      gs2.setStartTime(TimePosition.seconds(2));
      gs2.setSubjectiveDuration(TimeDuration.seconds(1));
      layer.push(gs2);

      applyScoreTimeStatePatch(data, {
        primaryTimeDisplay: TimeBase.BBT,
        scoreObjectUpdateMode: 'UPDATE_MATCHING',
      });

      expect(gs1.getStartTime().getTimeBase()).toBe(TimeBase.BBT);
      expect(gs2.getStartTime().getTimeBase()).toBe(TimeBase.SECONDS);
    });

    it('null mode does not convert any score objects', () => {
      const data = new BlueData();
      const score = data.getScore();
      const layer = getFirstLayer(score);

      const gs = new GenericScore();
      gs.setName('test');
      gs.setStartTime(TimePosition.beats(4));
      gs.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(gs);

      applyScoreTimeStatePatch(data, {
        primaryTimeDisplay: TimeBase.BBT,
        scoreObjectUpdateMode: null,
      });

      expect(gs.getStartTime().getTimeBase()).toBe(TimeBase.BEATS);
    });

    it('UPDATE_MATCHING preserves start and duration independently', () => {
      const data = new BlueData();
      const score = data.getScore();
      const ctx = score.getTimeContext();
      const layer = getFirstLayer(score);

      const gs = new GenericScore();
      gs.setName('mixed');
      gs.setStartTime(TimePosition.seconds(2.0));
      gs.setSubjectiveDuration(TimeDuration.beats(3.0));
      layer.push(gs);

      applyScoreTimeStatePatch(data, {
        primaryTimeDisplay: TimeBase.BBT,
        scoreObjectUpdateMode: 'UPDATE_MATCHING',
      });

      expect(gs.getStartTime().getTimeBase()).toBe(TimeBase.SECONDS);
      expect(gs.getSubjectiveDuration().getTimeBase()).toBe(TimeBase.BBT);
      expect(gs.getSubjectiveDuration().toBeats(ctx)).toBeCloseTo(3, 2);
    });

    it('UPDATE_MATCHING with repeat point: only converts matching repeat point', () => {
      const data = new BlueData();
      const score = data.getScore();
      const layer = getFirstLayer(score);

      const gs = new GenericScore();
      gs.setName('with-rp');
      gs.setStartTime(TimePosition.beats(4));
      gs.setSubjectiveDuration(TimeDuration.beats(2));
      gs.setRepeatPoint(TimeDuration.seconds(1.5));
      layer.push(gs);

      const gs2 = new GenericScore();
      gs2.setName('with-rp2');
      gs2.setStartTime(TimePosition.beats(8));
      gs2.setSubjectiveDuration(TimeDuration.beats(2));
      gs2.setRepeatPoint(TimeDuration.beats(1.5));
      layer.push(gs2);

      applyScoreTimeStatePatch(data, {
        primaryTimeDisplay: TimeBase.BBT,
        scoreObjectUpdateMode: 'UPDATE_MATCHING',
      });

      expect(gs.getRepeatPoint()!.getTimeBase()).toBe(TimeBase.SECONDS);
      expect(gs2.getRepeatPoint()!.getTimeBase()).toBe(TimeBase.BBT);
    });
  });

  describe('full pipeline via applyProjectDocumentPatch', () => {
    function getFirstLayer(score: import('@blue/data').Score) {
      return (score[0] as import('@blue/data').PolyObject)[0];
    }

    it('UPDATE_MATCHING through ScorePatch only converts matching objects', () => {
      const data = new BlueData();
      const score = data.getScore();
      const layer = getFirstLayer(score);

      const gsMatching = new GenericScore();
      gsMatching.setName('beats-obj');
      gsMatching.setStartTime(TimePosition.beats(2));
      gsMatching.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(gsMatching);

      const gsNonMatching = new GenericScore();
      gsNonMatching.setName('seconds-obj');
      gsNonMatching.setStartTime(TimePosition.seconds(2));
      gsNonMatching.setSubjectiveDuration(TimeDuration.seconds(1));
      layer.push(gsNonMatching);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTimeState',
          patch: {
            primaryTimeDisplay: TimeBase.BBT,
            scoreObjectUpdateMode: 'UPDATE_MATCHING',
          },
        },
      });

      expect(changed).toBe(true);
      expect(gsMatching.getStartTime().getTimeBase()).toBe(TimeBase.BBT);
      expect(gsNonMatching.getStartTime().getTimeBase()).toBe(TimeBase.SECONDS);
      expect(gsNonMatching.getSubjectiveDuration().getTimeBase()).toBe(TimeBase.SECONDS);
    });

    it('UPDATE_ALL through ScorePatch converts all objects', () => {
      const data = new BlueData();
      const score = data.getScore();
      const layer = getFirstLayer(score);

      const gsMatching = new GenericScore();
      gsMatching.setName('beats-obj');
      gsMatching.setStartTime(TimePosition.beats(2));
      gsMatching.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(gsMatching);

      const gsNonMatching = new GenericScore();
      gsNonMatching.setName('seconds-obj');
      gsNonMatching.setStartTime(TimePosition.seconds(2));
      gsNonMatching.setSubjectiveDuration(TimeDuration.seconds(1));
      layer.push(gsNonMatching);

      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTimeState',
          patch: {
            primaryTimeDisplay: TimeBase.BBT,
            scoreObjectUpdateMode: 'UPDATE_ALL',
          },
        },
      });

      expect(gsMatching.getStartTime().getTimeBase()).toBe(TimeBase.BBT);
      expect(gsNonMatching.getStartTime().getTimeBase()).toBe(TimeBase.BBT);
    });

    it('same primary display does not convert objects', () => {
      const data = new BlueData();
      const score = data.getScore();
      const layer = getFirstLayer(score);

      const gs = new GenericScore();
      gs.setName('test');
      gs.setStartTime(TimePosition.beats(4));
      gs.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(gs);

      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTimeState',
          patch: {
            primaryTimeDisplay: TimeBase.BEATS,
            scoreObjectUpdateMode: 'UPDATE_ALL',
          },
        },
      });

      expect(gs.getStartTime().getTimeBase()).toBe(TimeBase.BEATS);
    });
  });

  describe('marker update decision logic', () => {
    function markerShouldUpdate(
      markerTimeBase: TimeBase,
      oldTimeBase: TimeBase,
      markerMode: TimebaseUpdateMode | null,
    ): boolean {
      if (markerMode === null) return false;
      if (markerMode === 'UPDATE_ALL') return true;
      return markerTimeBase === oldTimeBase;
    }

    it('UPDATE_ALL converts all markers', () => {
      expect(markerShouldUpdate(TimeBase.BEATS, TimeBase.BEATS, 'UPDATE_ALL')).toBe(true);
      expect(markerShouldUpdate(TimeBase.SECONDS, TimeBase.BEATS, 'UPDATE_ALL')).toBe(true);
    });

    it('UPDATE_MATCHING only converts markers matching old timebase', () => {
      expect(markerShouldUpdate(TimeBase.BEATS, TimeBase.BEATS, 'UPDATE_MATCHING')).toBe(true);
      expect(markerShouldUpdate(TimeBase.SECONDS, TimeBase.BEATS, 'UPDATE_MATCHING')).toBe(false);
    });

    it('null mode does not convert any markers', () => {
      expect(markerShouldUpdate(TimeBase.BEATS, TimeBase.BEATS, null)).toBe(false);
    });
  });

  describe('user scenario: manually set object to BBT, then ruler UPDATE_MATCHING', () => {
    function getFirstLayer(score: import('@blue/data').Score) {
      return (score[0] as import('@blue/data').PolyObject)[0];
    }

    function makeTarget(objectId: string): ScoreObjectEditorTargetSnapshot {
      return {
        selectionId: objectId,
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
        supportsTimeBehavior: true,
        supportsRepeatPoint: true,
        supportsNoteProcessorChain: true,
      };
    }

    it('object manually set to BBT is NOT converted when ruler changes from BEATS to BBST with UPDATE_MATCHING', () => {
      const data = new BlueData();
      const score = data.getScore();
      const ctx = score.getTimeContext();
      const layer = getFirstLayer(score);

      const gs1 = new GenericScore();
      gs1.setName('manually-bbt');
      gs1.setStartTime(TimePosition.beats(4));
      gs1.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(gs1);
      const gs1Id = gs1.getName();

      const gs2 = new GenericScore();
      gs2.setName('stayed-beats');
      gs2.setStartTime(TimePosition.beats(8));
      gs2.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(gs2);

      // Step 2: User selects gs1, changes start time to BBT via properties panel
      const target1 = {
        ...makeTarget(gs1Id),
        location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      };
      const beatsValue = gs1.getStartTime().toBeats(ctx);
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSharedProperties',
          target: target1,
          patch: {
            startTime: { value: beatsValue, timeBase: TimeBase.BBT },
          },
        },
      });

      // Verify gs1 start is now BBT
      expect(gs1.getStartTime().getTimeBase()).toBe(TimeBase.BBT);

      // Step 3: User opens ruler config, changes from BEATS to BBST with UPDATE_MATCHING
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTimeState',
          patch: {
            primaryTimeDisplay: TimeBase.BBST,
            scoreObjectUpdateMode: 'UPDATE_MATCHING',
          },
        },
      });

      // gs1 should NOT be converted because its start time is BBT, not BEATS (old ruler)
      expect(gs1.getStartTime().getTimeBase()).toBe(TimeBase.BBT);
      // gs2 should be converted because its start time is BEATS (matches old ruler)
      expect(gs2.getStartTime().getTimeBase()).toBe(TimeBase.BBST);
    });

    it('UPDATE_ALL converts all objects regardless of their timebase', () => {
      const data = new BlueData();
      const score = data.getScore();
      const ctx = score.getTimeContext();
      const layer = getFirstLayer(score);

      const gs1 = new GenericScore();
      gs1.setName('manually-bbt');
      gs1.setStartTime(TimePosition.beats(4));
      gs1.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(gs1);
      const gs1Id = gs1.getName();

      // Manually set gs1 to BBT
      const target1 = {
        ...makeTarget(gs1Id),
        location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      };
      const beatsValue = gs1.getStartTime().toBeats(ctx);
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSharedProperties',
          target: target1,
          patch: {
            startTime: { value: beatsValue, timeBase: TimeBase.BBT },
          },
        },
      });

      expect(gs1.getStartTime().getTimeBase()).toBe(TimeBase.BBT);

      // UPDATE_ALL should convert everything
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTimeState',
          patch: {
            primaryTimeDisplay: TimeBase.BBST,
            scoreObjectUpdateMode: 'UPDATE_ALL',
          },
        },
      });

      expect(gs1.getStartTime().getTimeBase()).toBe(TimeBase.BBST);
    });
  });
});
