import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { TrackLayerGroup } from '../score/track/track-layer-group';

const packageRelativeFixtureDirectory = resolve(
  process.cwd(),
  'src/migration/fixtures/track-layer',
);
const fixtureDirectory = existsSync(packageRelativeFixtureDirectory)
  ? packageRelativeFixtureDirectory
  : resolve(process.cwd(), 'packages/blue-data/src/migration/fixtures/track-layer');
const fixtureNames = [
  'legacy-java-audio-layers.blue.xml',
  'legacy-typescript-audio-layers.blue.xml',
];

describe('Track layer migration integration', () => {
  it('rejects unrecognized legacy audio content before graph migration', () => {
    const source = readFileSync(resolve(fixtureDirectory, fixtureNames[0]), 'utf8');
    expect(() =>
      BlueData.loadFromString(
        source.replace('<audioLayers>', '<unknownGroupSibling value="preserve-me"/><audioLayers>'),
      ),
    ).toThrow();
    expect(() =>
      BlueData.loadFromString(
        source.replace('<audioLayer name=', '<audioLayer futureTrackAttribute="enabled" name='),
      ),
    ).toThrow();
  });
  for (const fixtureName of fixtureNames) {
    it(`loads, compiles, and reopens ${fixtureName} as canonical Track XML`, () => {
      const source = readFileSync(resolve(fixtureDirectory, fixtureName), 'utf8');
      const data = BlueData.loadFromString(source);
      const group = data.getScore()[0];

      expect(group).toBeInstanceOf(TrackLayerGroup);
      const trackGroup = group as TrackLayerGroup;
      const trackIds = trackGroup.map((track) => track.getUniqueId());
      const associatedChannelIds = data
        .getMixer()
        .getAllSourceChannels()
        .map((channel) => channel.getAssociation())
        .filter((association) => trackIds.includes(association));
      expect(associatedChannelIds).toEqual(trackIds);

      const canonical = data.saveToString();
      expect(canonical).not.toContain('<audioLayerGroup');
      expect(canonical).not.toContain('<audioLayers>');
      expect(canonical).not.toContain('<audioLayer ');
      expect(canonical).toContain('<trackLayerGroup');
      expect(canonical).toContain('<tracks>');

      const reopened = BlueData.loadFromString(canonical);
      expect(reopened.saveToString()).toBe(canonical);
      expect(reopened.toCSD()).toBe(data.toCSD());
    });
  }
});
