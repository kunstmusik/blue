import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Element } from '../serialization/xml-reader';
import { hasLegacyMixerStateAtLoad } from './xml-policy';

describe('Score mute/solo mode XML compatibility', () => {
  it.each(['', '<score/>'])('loads a Java-style project %s as Event', (scoreXml) => {
    const data = BlueData.loadFromString(
      `<blueData version="2.8.0">${scoreXml}<mixer><enabled>true</enabled></mixer></blueData>`,
    );
    expect(data.getScore().trackLayerMuteSoloMode).toBe('event');
    const saved = Element.parse(data.saveToString());
    expect(saved.getElement('score')?.getAttribute('trackLayerMuteSoloMode')).toBe('event');
    expect(BlueData.loadFromString(data.saveToString()).getScore().trackLayerMuteSoloMode).toBe(
      'event',
    );
  });

  it('loads a Java audio-layer fixture with Event behavior', () => {
    const source = readFileSync(
      join(__dirname, '../migration/fixtures/track-layer/legacy-java-audio-layers.blue.xml'),
      'utf8',
    );
    expect(BlueData.loadFromString(source).getScore().trackLayerMuteSoloMode).toBe('event');
  });

  it('saves the new-project Audio default on Score, not ProjectProperties', () => {
    const data = new BlueData();
    const saved = Element.parse(data.saveToString());
    expect(saved.getElement('score')?.getAttribute('trackLayerMuteSoloMode')).toBe('audio');
    expect(saved.getElement('projectProperties')?.toXml()).not.toContain('trackLayerMuteSoloMode');
  });

  it('shows the legacy active-channel notice only for a load without the mode', () => {
    const flags =
      '<channelList list="channels"><channel><name>Legacy</name><muted>true</muted></channel></channelList>';
    const legacy = BlueData.loadFromString(
      `<blueData version="2.8.0"><mixer><enabled>true</enabled>${flags}</mixer></blueData>`,
    );
    expect(hasLegacyMixerStateAtLoad(legacy)).toBe(true);
    expect(hasLegacyMixerStateAtLoad(BlueData.loadFromString(legacy.saveToString()))).toBe(false);

    const modern = BlueData.loadFromString(
      `<blueData version="2.8.0"><score trackLayerMuteSoloMode="audio"/>` +
        `<mixer><enabled>true</enabled>${flags}</mixer></blueData>`,
    );
    expect(hasLegacyMixerStateAtLoad(modern)).toBe(false);
  });

  it('ignores stored master solo when deciding the legacy notice', () => {
    const data = BlueData.loadFromString(
      '<blueData version="2.8.0"><mixer><enabled>true</enabled><channel><name>Master</name><solo>true</solo></channel></mixer></blueData>',
    );
    expect(hasLegacyMixerStateAtLoad(data)).toBe(false);
  });
});
