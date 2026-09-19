import { describe, expect, it } from 'vitest';
import { Mixer } from '../mixer/mixer';
import { Element } from '../serialization/xml-reader';
import { BlueData } from '../blue-data';

describe('Mixer panningEnabled configuration and serialization (T027, T028)', () => {
  it('defaults to true on newly created Mixer', () => {
    const mixer = new Mixer();
    expect(mixer.isPanningEnabled()).toBe(true);
  });

  it('preserves panningEnabled across deepCopy', () => {
    const mixer = new Mixer();
    mixer.setPanningEnabled(false);
    const copy = mixer.deepCopy() as Mixer;
    expect(copy.isPanningEnabled()).toBe(false);

    mixer.setPanningEnabled(true);
    const copy2 = mixer.deepCopy() as Mixer;
    expect(copy2.isPanningEnabled()).toBe(true);
  });

  it('serializes panningEnabled as attribute on mixer element', () => {
    const mixer = new Mixer();
    mixer.setPanningEnabled(true);
    const xml = mixer.saveAsXML();
    expect(xml.getAttribute('panningEnabled')).toBe('true');

    mixer.setPanningEnabled(false);
    const xmlFalse = mixer.saveAsXML();
    expect(xmlFalse.getAttribute('panningEnabled')).toBe('false');
  });

  it('loads absent panningEnabled as false (legacy behavior)', () => {
    const elem = new Element('mixer');
    const loaded = Mixer.loadFromXML(elem);
    expect(loaded.isPanningEnabled()).toBe(false);
  });

  it('loads invalid panningEnabled values as false', () => {
    for (const invalid of ['1', 'yes', 'enabled', '', 'null', 'TRUE_EXTRA']) {
      const elem = new Element('mixer');
      elem.setAttribute('panningEnabled', invalid);
      const loaded = Mixer.loadFromXML(elem);
      expect(loaded.isPanningEnabled()).toBe(false);
    }
  });

  it('loads explicit true and false correctly', () => {
    const elemTrue = new Element('mixer');
    elemTrue.setAttribute('panningEnabled', 'true');
    expect(Mixer.loadFromXML(elemTrue).isPanningEnabled()).toBe(true);

    const elemFalse = new Element('mixer');
    elemFalse.setAttribute('panningEnabled', 'false');
    expect(Mixer.loadFromXML(elemFalse).isPanningEnabled()).toBe(false);
  });

  it('loads project XML without <score> as false', () => {
    const xml = [
      '<blueData version="2.8.0">',
      '  <projectProperties>',
      '    <title>No Score</title>',
      '  </projectProperties>',
      '</blueData>',
    ].join('\n');
    const data = BlueData.loadFromString(xml);
    expect(data.getMixer().isPanningEnabled()).toBe(false);
  });
});

describe('Mixer panLawDb and panOffCenterBoost configuration and serialization (T010, T013)', () => {
  it('defaults to -3 dB and boost false on newly created Mixer', () => {
    const mixer = new Mixer();
    expect(mixer.getPanLawDb()).toBe(-3);
    expect(mixer.isPanOffCenterBoost()).toBe(false);
  });

  it('preserves panLawDb and panOffCenterBoost across deepCopy', () => {
    const mixer = new Mixer();
    mixer.setPanLawDb(-6);
    mixer.setPanOffCenterBoost(true);
    mixer.setPanningEnabled(false);

    const copy = mixer.deepCopy() as Mixer;
    expect(copy.getPanLawDb()).toBe(-6);
    expect(copy.isPanOffCenterBoost()).toBe(true);
    expect(copy.isPanningEnabled()).toBe(false);

    mixer.setPanLawDb(-4.5);
    mixer.setPanOffCenterBoost(false);
    const copy2 = mixer.deepCopy() as Mixer;
    expect(copy2.getPanLawDb()).toBe(-4.5);
    expect(copy2.isPanOffCenterBoost()).toBe(false);
  });

  it('serializes panLawDb and panOffCenterBoost as attributes on mixer element', () => {
    const mixer = new Mixer();
    mixer.setPanLawDb(-6);
    mixer.setPanOffCenterBoost(true);
    const xml = mixer.saveAsXML();
    expect(xml.getAttribute('panLawDb')).toBe('-6');
    expect(xml.getAttribute('panOffCenterBoost')).toBe('true');

    mixer.setPanLawDb(0);
    mixer.setPanOffCenterBoost(false);
    const xml2 = mixer.saveAsXML();
    expect(xml2.getAttribute('panLawDb')).toBe('0');
    expect(xml2.getAttribute('panOffCenterBoost')).toBe('false');
  });

  it('loads absent panLawDb and panOffCenterBoost with defaults', () => {
    const elem = new Element('mixer');
    const loaded = Mixer.loadFromXML(elem);
    expect(loaded.getPanLawDb()).toBe(-3);
    expect(loaded.isPanOffCenterBoost()).toBe(false);
  });

  it('loads invalid panLawDb values with default fallback', () => {
    for (const invalid of [
      '-1',
      '-5',
      'foo',
      '',
      'null',
      '3',
      '-3garbage',
      '-4.5xyz',
      '0abc',
      '--3',
    ]) {
      const elem = new Element('mixer');
      elem.setAttribute('panLawDb', invalid);
      const loaded = Mixer.loadFromXML(elem);
      expect(loaded.getPanLawDb()).toBe(-3);
    }
  });

  it('loads invalid panOffCenterBoost values as false', () => {
    for (const invalid of ['1', 'yes', 'enabled', '', 'null']) {
      const elem = new Element('mixer');
      elem.setAttribute('panOffCenterBoost', invalid);
      const loaded = Mixer.loadFromXML(elem);
      expect(loaded.isPanOffCenterBoost()).toBe(false);
    }
  });

  it('loads explicit valid panLawDb and panOffCenterBoost values', () => {
    for (const law of ['0', '-3', '-4.5', '-6']) {
      const elem = new Element('mixer');
      elem.setAttribute('panLawDb', law);
      elem.setAttribute('panOffCenterBoost', 'true');
      const loaded = Mixer.loadFromXML(elem);
      expect(loaded.getPanLawDb()).toBe(Number(law));
      expect(loaded.isPanOffCenterBoost()).toBe(true);
    }
  });

  it('preserves pan law and boost settings even when panningEnabled is false', () => {
    const mixer = new Mixer();
    mixer.setPanningEnabled(false);
    mixer.setPanLawDb(-4.5);
    mixer.setPanOffCenterBoost(true);

    const xml = mixer.saveAsXML();
    const loaded = Mixer.loadFromXML(xml);
    expect(loaded.isPanningEnabled()).toBe(false);
    expect(loaded.getPanLawDb()).toBe(-4.5);
    expect(loaded.isPanOffCenterBoost()).toBe(true);
  });
});
