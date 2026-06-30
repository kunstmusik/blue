import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { AudioLayer } from './audio-layer';

describe('AudioLayer automation', () => {
  it('persists parameterId children in XML', () => {
    const layer = new AudioLayer();
    layer.setName('Audio Layer 1');
    layer.getAutomationParameters().addParameterId('paramX');
    layer.getAutomationParameters().addParameterId('paramY');

    const xml = layer.saveAsXML();
    const reloaded = AudioLayer.loadFromXML(Element.parse(xml.toXml()));

    expect(reloaded.getAutomationParameters().getIds()).toEqual(['paramX', 'paramY']);
  });

  it('deep copies automation parameter ids', () => {
    const layer = new AudioLayer();
    layer.setName('Original');
    layer.getAutomationParameters().addParameterId('p1');

    const copy = AudioLayer.copyFrom(layer);
    copy.getAutomationParameters().addParameterId('p2');

    expect(layer.getAutomationParameters().getIds()).toEqual(['p1']);
    expect(copy.getAutomationParameters().getIds()).toEqual(['p1', 'p2']);
  });

  it('loads audioLayer without parameterId children', () => {
    const xml = `<audioLayer name="Empty" muted="false" solo="false" heightIndex="0" uniqueId="test-uid"/>`;
    const layer = AudioLayer.loadFromXML(Element.parse(xml));
    expect(layer.getAutomationParameters().getIds()).toEqual([]);
  });

  it('persists selectedIndex through round-trip', () => {
    const layer = new AudioLayer();
    layer.setName('Layer');
    layer.getAutomationParameters().addParameterId('a');
    layer.getAutomationParameters().addParameterId('b');
    layer.getAutomationParameters().setSelectedIndex(1);

    const reloaded = AudioLayer.loadFromXML(Element.parse(layer.saveAsXML().toXml()));
    expect(reloaded.getAutomationParameters().getSelectedIndex()).toBe(1);
  });
});
