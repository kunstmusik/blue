import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';

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
});
