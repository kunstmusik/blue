import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { Track } from './track';

describe('Track automation', () => {
  it('persists parameterId children in XML', () => {
    const layer = new Track();
    layer.setName('Track 1');
    layer.getAutomationParameters().addParameterId('paramX');
    layer.getAutomationParameters().addParameterId('paramY');

    const xml = layer.saveAsXML();
    const reloaded = Track.loadFromXML(Element.parse(xml.toXml()));

    expect(reloaded.getAutomationParameters().getIds()).toEqual(['paramX', 'paramY']);
  });

  it('deep copies automation parameter ids', () => {
    const layer = new Track();
    layer.setName('Original');
    layer.getAutomationParameters().addParameterId('p1');

    const copy = new Track(layer);
    copy.getAutomationParameters().addParameterId('p2');

    expect(layer.getAutomationParameters().getIds()).toEqual(['p1']);
    expect(copy.getAutomationParameters().getIds()).toEqual(['p1', 'p2']);
  });

  it('loads a Track without parameterId children', () => {
    const xml = `<track name="Empty" muted="false" solo="false" heightIndex="0" uniqueId="test-uid"/>`;
    const layer = Track.loadFromXML(Element.parse(xml));
    expect(layer.getAutomationParameters().getIds()).toEqual([]);
  });

  it('persists selectedIndex through round-trip', () => {
    const layer = new Track();
    layer.setName('Layer');
    layer.getAutomationParameters().addParameterId('a');
    layer.getAutomationParameters().addParameterId('b');
    layer.getAutomationParameters().setSelectedIndex(1);

    const reloaded = Track.loadFromXML(Element.parse(layer.saveAsXML().toXml()));
    expect(reloaded.getAutomationParameters().getSelectedIndex()).toBe(1);
  });
});
