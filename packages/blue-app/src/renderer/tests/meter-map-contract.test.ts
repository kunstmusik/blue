import { describe, expect, it } from 'vitest';
import type { MeterMapPatch, MeterMapSnapshot, MeterSnapshot } from '../../shared/project-editor';
import {
  createMeterMapSnapshot,
  createScoreDocumentSnapshot,
  applyProjectDocumentPatch,
} from '../../shared/project-editor';
import {
  BlueData,
  GenericScore,
  MeterMap,
  Meter,
  MeasureMeterPair,
  TimeDuration,
  TimePosition,
} from '@blue/data';
import {
  deriveSnapLineBeats,
  snapBeatToGrid,
} from '../components/workbench/panels/score/snap-grid-utils';

function makeSingleEntrySnapshot(): MeterMapSnapshot {
  return {
    entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
  };
}

function makeMixedMeterSnapshot(): MeterMapSnapshot {
  return {
    entries: [
      { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
      { measure: 5, numBeats: 3, beatLength: 4, startBeat: 16 },
      { measure: 9, numBeats: 7, beatLength: 8, startBeat: 28 },
    ],
  };
}

describe('Meter snapshot creation', () => {
  it('creates snapshot from a MeterMap with accumulated startBeat values', () => {
    const meterMap = new MeterMap();
    meterMap.add(new MeasureMeterPair(1, new Meter(4, 4)));
    meterMap.add(new MeasureMeterPair(5, new Meter(3, 4)));

    const snapshot = createMeterMapSnapshot(meterMap);

    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toEqual({
      measure: 1,
      numBeats: 4,
      beatLength: 4,
      startBeat: 0,
    });
    expect(snapshot.entries[1]).toEqual({
      measure: 5,
      numBeats: 3,
      beatLength: 4,
      startBeat: 16,
    });
  });

  it('computes correct startBeat for 7/8 after 4/4 and 3/4', () => {
    const meterMap = new MeterMap();
    meterMap.add(new MeasureMeterPair(1, new Meter(4, 4)));
    meterMap.add(new MeasureMeterPair(5, new Meter(3, 4)));
    meterMap.add(new MeasureMeterPair(9, new Meter(7, 8)));

    const snapshot = createMeterMapSnapshot(meterMap);

    expect(snapshot.entries).toHaveLength(3);
    expect(snapshot.entries[0].startBeat).toBe(0);
    expect(snapshot.entries[1].startBeat).toBe(16);
    expect(snapshot.entries[2].startBeat).toBeCloseTo(28, 6);
  });

  it('creates default snapshot for empty meter map', () => {
    const meterMap = new MeterMap();
    const snapshot = createMeterMapSnapshot(meterMap);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].measure).toBe(1);
    expect(snapshot.entries[0].startBeat).toBe(0);
  });
});

describe('Meter patch validation', () => {
  it('rejects meter-map-set-entry with non-positive measure', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 0,
      numBeats: 4,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects meter-map-set-entry with non-integer measure', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 1.5,
      numBeats: 4,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects meter-map-set-entry with non-positive numBeats', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 3,
      numBeats: 0,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects meter-map-set-entry with non-positive beatLength', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 3,
      numBeats: 4,
      beatLength: 0,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects removing first entry', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = { type: 'meter-map-remove-entry', measure: 1 };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects removing when only one entry remains', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = { type: 'meter-map-remove-entry', measure: 5 };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects update that moves first entry away from measure 1', () => {
    const data = new BlueData();
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(1, new Meter(4, 4)));
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(5, new Meter(3, 4)));
    const patch: MeterMapPatch = {
      type: 'meter-map-update-entry',
      previousMeasure: 1,
      measure: 2,
      numBeats: 4,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects update that moves entry before neighbor', () => {
    const data = new BlueData();
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(1, new Meter(4, 4)));
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(5, new Meter(3, 4)));
    const patch: MeterMapPatch = {
      type: 'meter-map-update-entry',
      previousMeasure: 5,
      measure: 1,
      numBeats: 3,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects update that moves entry past next neighbor', () => {
    const data = new BlueData();
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(1, new Meter(4, 4)));
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(5, new Meter(3, 4)));
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(9, new Meter(7, 8)));
    const patch: MeterMapPatch = {
      type: 'meter-map-update-entry',
      previousMeasure: 5,
      measure: 10,
      numBeats: 3,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects replace with empty entries', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = { type: 'meter-map-replace', entries: [] };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects replace where first entry is not measure 1', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-replace',
      entries: [{ measure: 2, numBeats: 4, beatLength: 4 }],
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects replace with duplicate measures', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-replace',
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4 },
        { measure: 1, numBeats: 3, beatLength: 4 },
      ],
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });

  it('rejects replace with non-ascending measures', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-replace',
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4 },
        { measure: 3, numBeats: 3, beatLength: 4 },
        { measure: 2, numBeats: 7, beatLength: 8 },
      ],
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
  });
});

describe('Meter patch application', () => {
  it('adds a new meter entry', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 5,
      numBeats: 3,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const meterMap = data.getScore().getTimeContext().getMeterMap();
    expect(meterMap.size()).toBe(2);
    expect(meterMap.get(1).measure).toBe(5);
    expect(meterMap.get(1).meter.numBeats).toBe(3);
  });

  it('replaces an existing entry at the same measure via set-entry', () => {
    const data = new BlueData();
    data
      .getScore()
      .getTimeContext()
      .getMeterMap()
      .add(new MeasureMeterPair(5, new Meter(3, 4)));
    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 5,
      numBeats: 6,
      beatLength: 8,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const meterMap = data.getScore().getTimeContext().getMeterMap();
    const entry5 = meterMap.getEntries().find((e) => e.measure === 5);
    expect(entry5).toBeDefined();
    expect(entry5!.meter.numBeats).toBe(6);
    expect(entry5!.meter.beatLength).toBe(8);
  });

  it('updates an existing entry with neighbor-bounded measure', () => {
    const data = new BlueData();
    const mm = data.getScore().getTimeContext().getMeterMap();
    mm.add(new MeasureMeterPair(5, new Meter(3, 4)));
    mm.add(new MeasureMeterPair(9, new Meter(7, 8)));

    const patch: MeterMapPatch = {
      type: 'meter-map-update-entry',
      previousMeasure: 5,
      measure: 7,
      numBeats: 3,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const entries = mm.getEntries();
    const updated = entries.find((e) => e.measure === 7);
    expect(updated).toBeDefined();
    expect(updated!.meter.numBeats).toBe(3);
    expect(entries.find((e) => e.measure === 5)).toBeUndefined();
  });

  it('removes a non-first entry', () => {
    const data = new BlueData();
    const mm = data.getScore().getTimeContext().getMeterMap();
    mm.add(new MeasureMeterPair(5, new Meter(3, 4)));
    mm.add(new MeasureMeterPair(9, new Meter(7, 8)));

    const patch: MeterMapPatch = { type: 'meter-map-remove-entry', measure: 5 };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const entries = mm.getEntries();
    expect(entries.length).toBe(2);
    expect(entries.find((e) => e.measure === 5)).toBeUndefined();
  });

  it('replaces the full meter map', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-replace',
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4 },
        { measure: 5, numBeats: 3, beatLength: 4 },
        { measure: 9, numBeats: 7, beatLength: 8 },
      ],
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const entries = data.getScore().getTimeContext().getMeterMap().getEntries();
    expect(entries.length).toBe(3);
    expect(entries[0].measure).toBe(1);
    expect(entries[1].measure).toBe(5);
    expect(entries[2].measure).toBe(9);
    expect(entries[2].meter.numBeats).toBe(7);
    expect(entries[2].meter.beatLength).toBe(8);
  });

  it('first entry remains immutable after update attempt to measure != 1', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-update-entry',
      previousMeasure: 1,
      measure: 2,
      numBeats: 3,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(false);
    expect(data.getScore().getTimeContext().getMeterMap().get(0).measure).toBe(1);
  });

  it('allows updating first entry signature without changing measure', () => {
    const data = new BlueData();
    const patch: MeterMapPatch = {
      type: 'meter-map-update-entry',
      previousMeasure: 1,
      measure: 1,
      numBeats: 3,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);
    expect(data.getScore().getTimeContext().getMeterMap().get(0).meter.numBeats).toBe(3);
  });

  it('preserves score object global beats while re-encoding BBF starts after inserting a meter entry', () => {
    const data = new BlueData();
    const rootGroup = data.getScore()[0] as unknown as Array<Array<GenericScore>>;
    const layer = rootGroup[0]!;
    const sObj = new GenericScore();
    sObj.setStartTime(TimePosition.bbf(3, 1, 0));
    sObj.setSubjectiveDuration(TimeDuration.bbf(1, 0, 0));
    layer.push(sObj);

    const beforeContext = data.getScore().getTimeContext();
    expect(sObj.getStartTime().toBeats(beforeContext)).toBe(8);
    expect(sObj.getSubjectiveDuration().toBeats(beforeContext)).toBe(4);

    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 2,
      numBeats: 5,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const afterContext = data.getScore().getTimeContext();
    expect(sObj.getStartTime().toBeats(afterContext)).toBe(8);
    expect(sObj.getSubjectiveDuration().toBeats(afterContext)).toBe(4);
    expect(sObj.getStartTime().getBar()).toBe(2);
    expect(sObj.getStartTime().getBeat()).toBe(5);
    expect(sObj.getStartTime().getFraction()).toBe(0);
    expect(sObj.getSubjectiveDuration().getBar()).toBe(0);
    expect(sObj.getSubjectiveDuration().getBeat()).toBe(4);
    expect(sObj.getSubjectiveDuration().getFraction()).toBe(0);
  });

  it('re-encodes the user-reported 5.1.0 BBF start to 4.3.0 after 5/4 starts at measure 2', () => {
    const data = new BlueData();
    const rootGroup = data.getScore()[0] as unknown as Array<Array<GenericScore>>;
    const layer = rootGroup[0]!;
    const sObj = new GenericScore();
    sObj.setStartTime(TimePosition.bbf(5, 1, 0));
    sObj.setSubjectiveDuration(TimeDuration.bbf(1, 0, 0));
    layer.push(sObj);

    const beforeContext = data.getScore().getTimeContext();
    expect(sObj.getStartTime().toBeats(beforeContext)).toBe(16);

    const patch: MeterMapPatch = {
      type: 'meter-map-set-entry',
      measure: 2,
      numBeats: 5,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const afterContext = data.getScore().getTimeContext();
    expect(sObj.getStartTime().toBeats(afterContext)).toBe(16);
    expect(sObj.getStartTime().getBar()).toBe(4);
    expect(sObj.getStartTime().getBeat()).toBe(3);
    expect(sObj.getStartTime().getFraction()).toBe(0);
  });

  it('re-encodes BBF durations when the base meter changes', () => {
    const data = new BlueData();
    const rootGroup = data.getScore()[0] as unknown as Array<Array<GenericScore>>;
    const layer = rootGroup[0]!;
    const sObj = new GenericScore();
    sObj.setStartTime(TimePosition.bbf(2, 1, 0));
    sObj.setSubjectiveDuration(TimeDuration.bbf(1, 0, 0));
    layer.push(sObj);

    const patch: MeterMapPatch = {
      type: 'meter-map-update-entry',
      previousMeasure: 1,
      measure: 1,
      numBeats: 3,
      beatLength: 4,
    };
    expect(applyProjectDocumentPatch(data, { transport: { meterMapPatch: patch } })).toBe(true);

    const afterContext = data.getScore().getTimeContext();
    expect(sObj.getStartTime().toBeats(afterContext)).toBe(4);
    expect(sObj.getSubjectiveDuration().toBeats(afterContext)).toBe(4);
    expect(sObj.getSubjectiveDuration().getBar()).toBe(1);
    expect(sObj.getSubjectiveDuration().getBeat()).toBe(1);
    expect(sObj.getSubjectiveDuration().getFraction()).toBe(0);
  });

  it('preserves score object start time base when moving by absolute beats', () => {
    const data = new BlueData();
    const rootGroup = data.getScore()[0] as unknown as Array<Array<GenericScore>>;
    const layer = rootGroup[0]!;
    const sObj = new GenericScore();
    sObj.setStartTime(TimePosition.bbf(3, 1, 0));
    sObj.setSubjectiveDuration(TimeDuration.bbf(1, 0, 0));
    layer.push(sObj);

    const snapshot = createScoreDocumentSnapshot(data);
    const group = snapshot.layerGroups[0]!;
    const target = group.layers[0]!.items[0]!.editorTarget;

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'moveScoreObjects',
          moves: [
            {
              target,
              targetStartBeats: 16,
              targetLayerIndex: 0,
              targetGroupId: group.groupId,
            },
          ],
        },
      }),
    ).toBe(true);

    const context = data.getScore().getTimeContext();
    expect(String(sObj.getStartTime().getTimeBase())).toBe('BBF');
    expect(sObj.getStartTime().toBeats(context)).toBe(16);
    expect(sObj.getStartTime().getBar()).toBe(5);
    expect(sObj.getStartTime().getBeat()).toBe(1);
  });

  it('preserves score object time bases when resizing through shared properties', () => {
    const data = new BlueData();
    const rootGroup = data.getScore()[0] as unknown as Array<Array<GenericScore>>;
    const layer = rootGroup[0]!;
    const sObj = new GenericScore();
    sObj.setStartTime(TimePosition.bbf(3, 1, 0));
    sObj.setSubjectiveDuration(TimeDuration.bbf(1, 0, 0));
    layer.push(sObj);

    const target =
      createScoreDocumentSnapshot(data).layerGroups[0]!.layers[0]!.items[0]!.editorTarget;

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSharedProperties',
          target,
          patch: {
            startTime: { value: 4, timeBase: 'BBF' },
            subjectiveDuration: { value: 5, timeBase: 'BBF' },
          },
        },
      }),
    ).toBe(true);

    const context = data.getScore().getTimeContext();
    expect(String(sObj.getStartTime().getTimeBase())).toBe('BBF');
    expect(String(sObj.getSubjectiveDuration().getTimeBase())).toBe('BBF');
    expect(sObj.getStartTime().toBeats(context)).toBe(4);
    expect(sObj.getSubjectiveDuration().toBeats(context)).toBe(5);
  });

  it('preserves each selected object start time base when moving across a mixed-meter boundary', () => {
    const data = new BlueData();
    expect(
      applyProjectDocumentPatch(data, {
        transport: {
          meterMapPatch: { type: 'meter-map-set-entry', measure: 2, numBeats: 5, beatLength: 4 },
        },
      }),
    ).toBe(true);

    const rootGroup = data.getScore()[0] as unknown as Array<Array<GenericScore>>;
    const layer = rootGroup[0]!;
    const bbfObj = new GenericScore();
    bbfObj.setStartTime(TimePosition.bbf(1, 1, 0));
    bbfObj.setSubjectiveDuration(TimeDuration.bbf(1, 0, 0));
    const bbtObj = new GenericScore();
    bbtObj.setStartTime(TimePosition.bbt(1, 1, 0));
    bbtObj.setSubjectiveDuration(TimeDuration.bbt(1, 0, 0));
    const beatObj = new GenericScore();
    beatObj.setStartTime(TimePosition.beats(0));
    beatObj.setSubjectiveDuration(TimeDuration.beats(4));
    layer.push(bbfObj, bbtObj, beatObj);

    const snapshot = createScoreDocumentSnapshot(data);
    const group = snapshot.layerGroups[0]!;
    const items = group.layers[0]!.items;
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'moveScoreObjects',
          moves: items.map((item) => ({
            target: item.editorTarget,
            targetStartBeats: 16,
            targetLayerIndex: 0,
            targetGroupId: group.groupId,
          })),
        },
      }),
    ).toBe(true);

    const context = data.getScore().getTimeContext();
    expect(String(bbfObj.getStartTime().getTimeBase())).toBe('BBF');
    expect(bbfObj.getStartTime().toBeats(context)).toBe(16);
    expect(bbfObj.getStartTime().getBar()).toBe(4);
    expect(bbfObj.getStartTime().getBeat()).toBe(3);

    expect(String(bbtObj.getStartTime().getTimeBase())).toBe('BBT');
    expect(bbtObj.getStartTime().toBeats(context)).toBe(16);
    expect(bbtObj.getStartTime().getBar()).toBe(4);
    expect(bbtObj.getStartTime().getBeat()).toBe(3);

    expect(String(beatObj.getStartTime().getTimeBase())).toBe('BEATS');
    expect(beatObj.getStartTime().toBeats(context)).toBe(16);
    expect(beatObj.getStartTime().getValue()).toBe(16);
  });

  it('preserves each selected object start and duration base when resizing across a mixed-meter boundary', () => {
    const data = new BlueData();
    expect(
      applyProjectDocumentPatch(data, {
        transport: {
          meterMapPatch: { type: 'meter-map-set-entry', measure: 2, numBeats: 5, beatLength: 4 },
        },
      }),
    ).toBe(true);

    const rootGroup = data.getScore()[0] as unknown as Array<Array<GenericScore>>;
    const layer = rootGroup[0]!;
    const bbfObj = new GenericScore();
    bbfObj.setStartTime(TimePosition.bbf(1, 1, 0));
    bbfObj.setSubjectiveDuration(TimeDuration.bbf(1, 0, 0));
    const bbtObj = new GenericScore();
    bbtObj.setStartTime(TimePosition.bbt(1, 1, 0));
    bbtObj.setSubjectiveDuration(TimeDuration.bbt(1, 0, 0));
    const beatObj = new GenericScore();
    beatObj.setStartTime(TimePosition.beats(0));
    beatObj.setSubjectiveDuration(TimeDuration.beats(4));
    layer.push(bbfObj, bbtObj, beatObj);

    const items = createScoreDocumentSnapshot(data).layerGroups[0]!.layers[0]!.items;
    const resizeTargets = [
      { item: items[0]!, startTimeBase: 'BBF', durationTimeBase: 'BBF' },
      { item: items[1]!, startTimeBase: 'BBT', durationTimeBase: 'BBT' },
      { item: items[2]!, startTimeBase: 'BEATS', durationTimeBase: 'BEATS' },
    ];

    for (const target of resizeTargets) {
      expect(
        applyProjectDocumentPatch(data, {
          score: {
            type: 'updateSharedProperties',
            target: target.item.editorTarget,
            patch: {
              startTime: { value: 16, timeBase: target.startTimeBase },
              subjectiveDuration: { value: 7, timeBase: target.durationTimeBase },
            },
          },
        }),
      ).toBe(true);
    }

    const context = data.getScore().getTimeContext();
    expect(String(bbfObj.getStartTime().getTimeBase())).toBe('BBF');
    expect(String(bbfObj.getSubjectiveDuration().getTimeBase())).toBe('BBF');
    expect(bbfObj.getStartTime().toBeats(context)).toBe(16);
    expect(bbfObj.getStartTime().getBar()).toBe(4);
    expect(bbfObj.getStartTime().getBeat()).toBe(3);
    expect(bbfObj.getSubjectiveDuration().toBeats(context)).toBe(7);

    expect(String(bbtObj.getStartTime().getTimeBase())).toBe('BBT');
    expect(String(bbtObj.getSubjectiveDuration().getTimeBase())).toBe('BBT');
    expect(bbtObj.getStartTime().toBeats(context)).toBe(16);
    expect(bbtObj.getStartTime().getBar()).toBe(4);
    expect(bbtObj.getStartTime().getBeat()).toBe(3);
    expect(bbtObj.getSubjectiveDuration().toBeats(context)).toBe(7);

    expect(String(beatObj.getStartTime().getTimeBase())).toBe('BEATS');
    expect(String(beatObj.getSubjectiveDuration().getTimeBase())).toBe('BEATS');
    expect(beatObj.getStartTime().toBeats(context)).toBe(16);
    expect(beatObj.getSubjectiveDuration().toBeats(context)).toBe(7);
  });
});

describe('Meter-aware snap grid', () => {
  it('derives BAR snap lines from meter-map measure boundaries', () => {
    const meterMap: MeterMapSnapshot = {
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
        { measure: 2, numBeats: 5, beatLength: 4, startBeat: 4 },
      ],
    };

    expect(deriveSnapLineBeats('BAR', 4, meterMap, 14)).toEqual([0, 4, 9, 14]);
  });

  it('snaps BAR positions to mixed-meter measure boundaries', () => {
    const meterMap: MeterMapSnapshot = {
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
        { measure: 2, numBeats: 5, beatLength: 4, startBeat: 4 },
      ],
    };

    expect(snapBeatToGrid(8.6, 'nearest', 'BAR', 4, meterMap)).toBe(9);
    expect(snapBeatToGrid(8.6, 'floor', 'BAR', 4, meterMap)).toBe(4);
  });

  it('treats AUTO at bar resolution as meter-aware measure boundaries', () => {
    const meterMap: MeterMapSnapshot = {
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
        { measure: 2, numBeats: 5, beatLength: 4, startBeat: 4 },
      ],
    };

    expect(deriveSnapLineBeats('AUTO', 4, meterMap, 14)).toEqual([0, 4, 9, 14]);
    expect(snapBeatToGrid(8.6, 'nearest', 'AUTO', 4, meterMap)).toBe(9);
  });

  it('anchors finer AUTO snap lines from each mixed-meter measure boundary', () => {
    const meterMap: MeterMapSnapshot = {
      entries: [
        { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
        { measure: 2, numBeats: 5, beatLength: 4, startBeat: 4 },
      ],
    };

    expect(deriveSnapLineBeats('AUTO', 2, meterMap, 14)).toEqual([0, 2, 4, 6, 8, 9, 11, 13, 14]);
    expect(snapBeatToGrid(8.6, 'nearest', 'AUTO', 2, meterMap)).toBe(9);
  });
});

describe('Mixed-meter region boundary tests', () => {
  it('computes correct startBeat for 4/4 at 1, 3/4 at 5, 7/8 at 9', () => {
    const meterMap = new MeterMap();
    meterMap.add(new MeasureMeterPair(1, new Meter(4, 4)));
    meterMap.add(new MeasureMeterPair(5, new Meter(3, 4)));
    meterMap.add(new MeasureMeterPair(9, new Meter(7, 8)));

    const snapshot = createMeterMapSnapshot(meterMap);
    expect(snapshot.entries[0].startBeat).toBe(0);
    expect(snapshot.entries[1].startBeat).toBe(16);
    expect(snapshot.entries[2].startBeat).toBeCloseTo(28, 6);
  });

  it('computes correct BBT for beats crossing meter boundaries', () => {
    const meterMap = new MeterMap();
    meterMap.add(new MeasureMeterPair(1, new Meter(4, 4)));
    meterMap.add(new MeasureMeterPair(5, new Meter(3, 4)));

    const bbt = meterMap.beatsToBBT(16, 960);
    expect(bbt.bar).toBe(5);
    expect(bbt.beat).toBe(1);
  });

  it('computes correct BBF for beats in 7/8 region', () => {
    const meterMap = new MeterMap();
    meterMap.add(new MeasureMeterPair(1, new Meter(4, 4)));
    meterMap.add(new MeasureMeterPair(5, new Meter(3, 4)));
    meterMap.add(new MeasureMeterPair(9, new Meter(7, 8)));

    const bbf = meterMap.beatsToBBF(30);
    expect(bbf.bar).toBeGreaterThanOrEqual(9);
  });

  it('derives regions from snapshot with correct boundaries', () => {
    const snapshot = makeMixedMeterSnapshot();

    expect(snapshot.entries[0].startBeat).toBe(0);
    expect(snapshot.entries[1].startBeat).toBe(16);
    expect(snapshot.entries[2].startBeat).toBeCloseTo(28, 6);

    const totalBeats = 40;
    const endBeat0 = snapshot.entries[1].startBeat;
    const endBeat1 = snapshot.entries[2].startBeat;

    expect(endBeat0).toBe(16);
    expect(endBeat1).toBeCloseTo(28, 6);

    const lastEntryEnd = totalBeats;
    expect(lastEntryEnd).toBeGreaterThan(snapshot.entries[2].startBeat);
  });
});

describe('Integration: meter patch variants update canonical snapshot', () => {
  it('multiple patches produce consistent canonical state', () => {
    const data = new BlueData();

    applyProjectDocumentPatch(data, {
      transport: {
        meterMapPatch: { type: 'meter-map-set-entry', measure: 5, numBeats: 3, beatLength: 4 },
      },
    });
    applyProjectDocumentPatch(data, {
      transport: {
        meterMapPatch: { type: 'meter-map-set-entry', measure: 9, numBeats: 7, beatLength: 8 },
      },
    });

    const snapshot = createMeterMapSnapshot(data.getScore().getTimeContext().getMeterMap());
    expect(snapshot.entries).toHaveLength(3);
    expect(snapshot.entries[0].measure).toBe(1);
    expect(snapshot.entries[1].measure).toBe(5);
    expect(snapshot.entries[2].measure).toBe(9);

    expect(snapshot.entries[0].startBeat).toBe(0);
    expect(snapshot.entries[1].startBeat).toBe(16);
    expect(snapshot.entries[2].startBeat).toBeCloseTo(28, 6);
  });
});
