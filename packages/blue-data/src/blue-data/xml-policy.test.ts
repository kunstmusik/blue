import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';

/**
 * Spec 112 T074/T028/T031: the score panning setting is additive XML. New
 * scores persist an explicit attribute; legacy documents (attribute absent,
 * attribute invalid, or no <score> element at all) load disabled, stay clean,
 * and preserve unrelated unknown project XML.
 */

function legacyProjectXml(): string {
  return new BlueData().saveToString().replace(/ panningEnabled="true"/, '');
}

function projectXmlWithoutScoreElement(): string {
  return new BlueData().saveToString().replace(/<score[\s\S]*?<\/score>/, '');
}

describe('xml-policy score panning compatibility (Spec 112)', () => {
  it('loads a legacy score with a missing panningEnabled attribute as disabled', () => {
    const data = BlueData.loadFromString(legacyProjectXml());
    expect(data.getScore().panningEnabled).toBe(false);
  });

  it('loads invalid panningEnabled attribute values as disabled', () => {
    for (const invalid of ['yes', '1', 'enabled', '2', 'not-true']) {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panningEnabled="true"/, ` panningEnabled="${invalid}"`);
      const data = BlueData.loadFromString(xml);
      expect(data.getScore().panningEnabled).toBe(false);
    }
  });

  it('accepts the case-insensitive true attribute leniently', () => {
    for (const value of ['true', 'TRUE', 'True']) {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panningEnabled="true"/, ` panningEnabled="${value}"`);
      expect(BlueData.loadFromString(xml).getScore().panningEnabled).toBe(true);
    }
  });

  it('keeps an explicit panningEnabled value through load and save', () => {
    const enabled = new BlueData();
    expect(enabled.getScore().panningEnabled).toBe(true);
    expect(enabled.saveToString()).toContain('panningEnabled="true"');

    const disabled = BlueData.loadFromString(
      enabled.saveToString().replace(/ panningEnabled="true"/, ' panningEnabled="false"'),
    );
    expect(disabled.getScore().panningEnabled).toBe(false);
    expect(disabled.saveToString()).toContain('panningEnabled="false"');
    expect(disabled.saveToString()).not.toContain('panningEnabled="true"');
  });

  it('loads a document without a <score> element with disabled panning', () => {
    const data = BlueData.loadFromString(projectXmlWithoutScoreElement());
    expect(data.getScore().panningEnabled).toBe(false);
    // The re-persisted document gains an explicit disabled attribute.
    expect(data.saveToString()).toContain('panningEnabled="false"');
  });

  it('leaves a legacy document clean: load adds nothing and re-save is idempotent', () => {
    const legacyXml = legacyProjectXml();
    const reopened = BlueData.loadFromString(legacyXml);

    // First save persists the explicit additive attribute.
    const firstSave = reopened.saveToString();
    expect(firstSave).toContain('panningEnabled="false"');

    // Load/save/load is stable: no further normalization drift.
    const secondPass = BlueData.loadFromString(firstSave);
    expect(secondPass.saveToString()).toBe(firstSave);
    expect(secondPass.getScore().panningEnabled).toBe(false);
  });

  it('preserves unknown project XML around a panning-enabled score', () => {
    const data = new BlueData();
    data.getScore().panningEnabled = true;
    const xmlRoot = data.saveAsXML();
    xmlRoot.getElement('pluginData')?.addElement('legacyPanningPlugin').setText('keep-me');

    const xml = xmlRoot.toXml();
    expect(xml).toContain('panningEnabled="true"');

    const reopened = BlueData.loadFromString(xml);
    expect(reopened.getScore().panningEnabled).toBe(true);
    expect(reopened.saveToString()).toContain('<legacyPanningPlugin>keep-me</legacyPanningPlugin>');
  });

  describe('xml-policy pan laws, boost, and channel stereo compatibility (Spec 113 T038, T042)', () => {
    it('falls back to default -3 dB and unboosted when score attributes are absent', () => {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panLawDb="[^"]*"/, '')
        .replace(/ panOffCenterBoost="[^"]*"/, '');
      const data = BlueData.loadFromString(xml);
      expect(data.getScore().panLawDb).toBe(-3);
      expect(data.getScore().panOffCenterBoost).toBe(false);
    });

    it('falls back to default -3 dB and unboosted when score attributes are invalid', () => {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panLawDb="[^"]*"/, ' panLawDb="-5"')
        .replace(/ panOffCenterBoost="[^"]*"/, ' panOffCenterBoost="invalid"');
      const data = BlueData.loadFromString(xml);
      expect(data.getScore().panLawDb).toBe(-3);
      expect(data.getScore().panOffCenterBoost).toBe(false);
    });

    it('falls back to balance and default scalars when channel stereo tags are missing', () => {
      const data = new BlueData();
      const ch = new Channel();
      ch.setName('TestChan');
      ch.setStereoPanMode('stereoPan');
      ch.setPanWidth(0.7);
      ch.setDualPanLeft(0.2);
      ch.setDualPanRight(0.8);
      data.getMixer().getChannels().push(ch);

      const xml = data
        .saveToString()
        .replace(/<stereoPanMode>.*?<\/stereoPanMode>/g, '')
        .replace(/<panWidth>.*?<\/panWidth>/g, '')
        .replace(/<dualPanLeft>.*?<\/dualPanLeft>/g, '')
        .replace(/<dualPanRight>.*?<\/dualPanRight>/g, '');

      const loaded = BlueData.loadFromString(xml);
      const loadedCh = loaded.getMixer().getChannels()[0]!;
      expect(loadedCh.getStereoPanMode()).toBe('balance');
      expect(loadedCh.getPanWidth()).toBe(1.0);
      expect(loadedCh.getDualPanLeft()).toBe(0.0);
      expect(loadedCh.getDualPanRight()).toBe(1.0);
    });

    it('falls back safely when channel stereo tags contain invalid values', () => {
      const data = new BlueData();
      const ch = new Channel();
      ch.setName('TestChan');
      data.getMixer().getChannels().push(ch);

      const xml = data
        .saveToString()
        .replace(/<stereoPanMode>.*?<\/stereoPanMode>/g, '<stereoPanMode>surround</stereoPanMode>')
        .replace(/<panWidth>.*?<\/panWidth>/g, '<panWidth>2.5</panWidth>')
        .replace(/<dualPanLeft>.*?<\/dualPanLeft>/g, '<dualPanLeft>-0.5</dualPanLeft>')
        .replace(/<dualPanRight>.*?<\/dualPanRight>/g, '<dualPanRight>NaN</dualPanRight>');

      const loaded = BlueData.loadFromString(xml);
      const loadedCh = loaded.getMixer().getChannels()[0]!;
      expect(loadedCh.getStereoPanMode()).toBe('balance');
      expect(loadedCh.getPanWidth()).toBe(1.0);
      expect(loadedCh.getDualPanLeft()).toBe(0.0);
      expect(loadedCh.getDualPanRight()).toBe(1.0);
    });
  });
});
