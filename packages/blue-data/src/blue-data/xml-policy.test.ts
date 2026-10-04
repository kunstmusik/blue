import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';
import { readProjectXml } from './xml-policy';
import { XmlLoadError } from '../serialization/xml-load';

describe('project XML candidate acceptance', () => {
  const source = { kind: 'project' as const, label: 'original-synthetic.blue' };

  it('accepts a current candidate with significant code whitespace', () => {
    const original = new BlueData();
    original.getGlobalOrcSco().setGlobalOrc('  ; original synthetic code\n\n');
    const result = readProjectXml(original.saveToString(), source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.getGlobalOrcSco().getGlobalOrc()).toBe('  ; original synthetic code\n\n');
    expect(result.diagnostics).toEqual([]);
  });

  it.each([
    ['<wrong/>', '/wrong', 'root'],
    ['<blueData future="x"/>', '/blueData/@future', 'member'],
    ['<blueData><future/></blueData>', '/blueData/future[1]', 'member'],
    [
      '<blueData><renderStartTime>2junk</renderStartTime></blueData>',
      '/blueData/renderStartTime[1]',
      'value',
    ],
    [
      '<blueData><loopRendering>yes</loopRendering></blueData>',
      '/blueData/loopRendering[1]',
      'value',
    ],
    ['<blueData><tables/><tables/></blueData>', '/blueData/tables[2]', 'cardinality'],
    ['<blueData version="2.3.bad"/>', '/blueData/@version', 'value'],
    [
      '<blueData><projectProperties><title future="x">a</title></projectProperties></blueData>',
      '/blueData/projectProperties[1]/title[1]/@future',
      'member',
    ],
    [
      '<blueData><projectProperties><copyToMediaFileOnImport>true</copyToMediaFileOnImport><copyToMediaFolderOnImport>false</copyToMediaFolderOnImport></projectProperties></blueData>',
      '/blueData/projectProperties[1]/copyToMediaFolderOnImport[1]',
      'conflict',
    ],
  ])('rejects %s with a contextual report and no value', (xml, path, code) => {
    const result = readProjectXml(xml, source);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(result.diagnostics[0]).toMatchObject({ source, path, code, severity: 'error' });
    expect(() => BlueData.loadFromString(xml)).toThrow(XmlLoadError);
  });
});

// Missing historical settings default; malformed present settings reject.

function legacyProjectXml(): string {
  return new BlueData().saveToString().replace(/ panningEnabled="true"/, '');
}

function projectXmlWithoutScoreElement(): string {
  return new BlueData().saveToString().replace(/<score[\s\S]*?<\/score>/, '');
}

describe('xml-policy mixer panning compatibility (Spec 112)', () => {
  it('loads a legacy mixer with a missing panningEnabled attribute as disabled', () => {
    const data = BlueData.loadFromString(legacyProjectXml());
    expect(data.getMixer().isPanningEnabled()).toBe(false);
  });

  it('rejects invalid panningEnabled attribute values', () => {
    for (const invalid of ['yes', '1', 'enabled', '2', 'not-true']) {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panningEnabled="true"/, ` panningEnabled="${invalid}"`);
      expect(() => BlueData.loadFromString(xml)).toThrow(XmlLoadError);
    }
  });

  it('accepts the case-insensitive true attribute leniently', () => {
    for (const value of ['true', 'TRUE', 'True']) {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panningEnabled="true"/, ` panningEnabled="${value}"`);
      expect(BlueData.loadFromString(xml).getMixer().isPanningEnabled()).toBe(true);
    }
  });

  it('keeps an explicit panningEnabled value through load and save', () => {
    const enabled = new BlueData();
    expect(enabled.getMixer().isPanningEnabled()).toBe(true);
    expect(enabled.saveToString()).toContain('panningEnabled="true"');

    const disabled = BlueData.loadFromString(
      enabled.saveToString().replace(/ panningEnabled="true"/, ' panningEnabled="false"'),
    );
    expect(disabled.getMixer().isPanningEnabled()).toBe(false);
    expect(disabled.saveToString()).toContain('panningEnabled="false"');
    expect(disabled.saveToString()).not.toContain('panningEnabled="true"');
  });

  it('keeps explicit Mixer panning when the score is absent', () => {
    const data = BlueData.loadFromString(projectXmlWithoutScoreElement());
    expect(data.getMixer().isPanningEnabled()).toBe(true);
    // The Mixer setting remains authoritative even when the score element is absent.
    expect(data.saveToString()).toContain('panningEnabled="true"');
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
    expect(secondPass.getMixer().isPanningEnabled()).toBe(false);
  });

  it('rejects unknown plugin content around a panning-enabled score', () => {
    const data = new BlueData();
    data.getMixer().setPanningEnabled(true);
    const xmlRoot = data.saveAsXML();
    xmlRoot.getElement('pluginData')?.addElement('legacyPanningPlugin').setText('keep-me');

    const xml = xmlRoot.toXml();
    expect(xml).toContain('panningEnabled="true"');

    const report = readProjectXml(xml);
    expect(report.ok).toBe(false);
    expect(report).not.toHaveProperty('value');
    expect(report.diagnostics[0].path).toContain('legacyPanningPlugin');
  });

  it('migrates legacy score-owned panning attributes into Mixer state', () => {
    const xml = new BlueData()
      .saveToString()
      .replace('<mixer panningEnabled="true" panLawDb="-3" panOffCenterBoost="false">', '<mixer>')
      .replace(
        '<score trackLayerMuteSoloMode="audio">',
        '<score trackLayerMuteSoloMode="audio" panningEnabled="true" panLawDb="-6" panOffCenterBoost="true">',
      );

    const data = BlueData.loadFromString(xml);
    expect(data.getMixer().isPanningEnabled()).toBe(true);
    expect(data.getMixer().getPanLawDb()).toBe(-6);
    expect(data.getMixer().isPanOffCenterBoost()).toBe(true);

    const saved = data.saveToString();
    expect(saved).toContain('<mixer panningEnabled="true" panLawDb="-6" panOffCenterBoost="true">');
    expect(saved).not.toContain('<score trackLayerMuteSoloMode="audio" panningEnabled=');
  });

  describe('xml-policy pan laws, boost, and channel stereo compatibility (Spec 113 T038, T042)', () => {
    it('falls back to default -3 dB and unboosted when Mixer attributes are absent', () => {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panLawDb="[^"]*"/, '')
        .replace(/ panOffCenterBoost="[^"]*"/, '');
      const data = BlueData.loadFromString(xml);
      expect(data.getMixer().getPanLawDb()).toBe(-3);
      expect(data.getMixer().isPanOffCenterBoost()).toBe(false);
    });

    it('rejects invalid present Mixer attributes', () => {
      const xml = new BlueData()
        .saveToString()
        .replace(/ panLawDb="[^"]*"/, ' panLawDb="-5"')
        .replace(/ panOffCenterBoost="[^"]*"/, ' panOffCenterBoost="invalid"');
      expect(() => BlueData.loadFromString(xml)).toThrow(XmlLoadError);
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

    it('rejects malformed present channel stereo values', () => {
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

      expect(() => BlueData.loadFromString(xml)).toThrow();
    });
  });
});
