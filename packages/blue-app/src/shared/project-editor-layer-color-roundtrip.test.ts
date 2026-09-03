import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import { Element } from '@blue/data';
import {
  createTestProjectWithLayers,
} from './project-editor-layer-color-test-utils';
import {
  createScoreDocumentSnapshot,
} from './project-editor/snapshot-score';

describe('Bridge Layer & Item Color Roundtrip (US4)', () => {
  it('preserves exact layer and item colors across save and reopen for SoundLayer, Track, and PatternLayer', () => {
    const {
      data,
      soundLayer,
      track,
      patternLayer,
    } = createTestProjectWithLayers();

    // Set custom distinct colors on each layer type
    soundLayer.setBackgroundColor(-65536); // Red
    soundLayer[0].setBackgroundColor(-16711936); // Green

    track.setBackgroundColor(-16776961); // Blue
    track[0].setBackgroundColor(-256); // Yellow

    patternLayer.setBackgroundColor(-16711681); // Cyan
    patternLayer.getSoundObject().setBackgroundColor(-65281); // Magenta

    // Serialize to XML
    const xmlElement = data.saveAsXML();
    const xmlText = xmlElement.toXml();

    // Reopen from XML
    const reloadedData = BlueData.loadFromString(xmlText);
    const reloadedSnapshot = createScoreDocumentSnapshot(reloadedData);

    // Assert layer snapshot colors
    const polyGroupSnapshot = reloadedSnapshot.layerGroups.find((g) => g.groupType === 'polyObject')!;
    const trackGroupSnapshot = reloadedSnapshot.layerGroups.find((g) => g.groupType === 'track')!;
    const patternGroupSnapshot = reloadedSnapshot.layerGroups.find((g) => g.groupType === 'patterns')!;

    expect(polyGroupSnapshot.layers[0].backgroundColor).toBe(-65536);
    expect(polyGroupSnapshot.layers[0].items[0].backgroundColor).toBe(-16711936);

    expect(trackGroupSnapshot.layers[0].backgroundColor).toBe(-16776961);
    expect(trackGroupSnapshot.layers[0].items[0].backgroundColor).toBe(-256);

    expect(patternGroupSnapshot.layers[0].backgroundColor).toBe(-16711681);
    const patLayer: any = patternGroupSnapshot.layers[0];
    expect(patLayer.sourceObject.backgroundColor).toBe(-65281);
  });
});
