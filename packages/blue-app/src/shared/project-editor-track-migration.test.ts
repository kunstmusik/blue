import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AutomationCurve, BlueData, BlueX7, TrackLayerGroup } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createInstrumentSnapshot,
  createProjectEditorSnapshot,
} from './project-editor';

const fixtureDirectory = resolve(
  process.cwd(),
  '../blue-data/src/migration/fixtures/track-layer',
);

describe('Track migration app projection', () => {
  it('preserves source channel associations and mixer state without duplicating channels', () => {
    const source = readFileSync(
      resolve(fixtureDirectory, 'legacy-java-audio-layers.blue.xml'),
      'utf8',
    );
    const data = BlueData.loadFromString(source);
    const snapshot = createProjectEditorSnapshot(data, '/tmp/migrated.blue');
    const group = snapshot.score?.layerGroups[0];

    expect(group?.groupType).toBe('track');
    expect(snapshot.mixer?.channelListGroups).toHaveLength(1);
    expect(snapshot.mixer?.channelListGroups[0]?.channels).toHaveLength(1);
    expect(snapshot.mixer?.channelListGroups[0]?.channels[0]?.association).toBe('java-track-1');
    expect(snapshot.mixer?.channelListGroups[0]?.channels[0]?.postChain[0]).toMatchObject({
      kind: 'send',
      sendChannel: 'Master',
      level: 0.25,
    });
    expect(snapshot.mixer?.channels).toHaveLength(0);

    createProjectEditorSnapshot(data, '/tmp/migrated.blue');
    expect(data.getMixer().getChannelListGroups()).toHaveLength(1);
    expect(data.getMixer().getChannelListGroups()[0]).toHaveLength(1);
  });

  it('migrates BlueX7 automation content into a disjoint Track owner', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    group.setUniqueId('migration-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('migration-track');
    data.getScore().push(group);

    const source = new BlueX7();
    const sourceParameter = source.getParameters().find(
      (parameter) => parameter.getName() === 'common.feedback',
    )!;
    sourceParameter.setAutomationEnabled(true);
    sourceParameter.setCurve(AutomationCurve.STEP);
    sourceParameter.setPoints([{ time: 0, value: 1 }, { time: 8, value: 6 }]);
    const sourceIds = new Set(source.getParameters().map((parameter) => parameter.getUniqueId()));

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceTrackInstrument',
        track: {
          rootGroupId: group.getUniqueId(),
          trackId: track.getUniqueId(),
          projectSessionId: 5,
          projectRevision: 9,
        },
        instrument: createInstrumentSnapshot('source-owner', source),
      },
    }, { projectSessionId: 5, projectRevision: 9 })).toBe(true);

    const migrated = track.getInstrument() as BlueX7;
    const migratedParameter = migrated.getParameters().find(
      (parameter) => parameter.getName() === 'common.feedback',
    )!;
    expect(migrated).toBeInstanceOf(BlueX7);
    expect(migrated.getParameters().every((parameter) => !sourceIds.has(parameter.getUniqueId()))).toBe(true);
    expect(migratedParameter).not.toBe(sourceParameter);
    expect(migratedParameter.isAutomationEnabled()).toBe(true);
    expect(migratedParameter.getCurve()).toBe(AutomationCurve.STEP);
    expect(migratedParameter.getPoints()).toEqual(sourceParameter.getPoints());

    migratedParameter.setPoints([{ time: 2, value: 4 }]);
    expect(sourceParameter.getPoints()).toEqual([{ time: 0, value: 1 }, { time: 8, value: 6 }]);
  });
});
