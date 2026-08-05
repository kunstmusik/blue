import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import { createProjectEditorSnapshot } from './project-editor';

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
});
