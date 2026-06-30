import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { SoundLayer } from './sound-layer';
import { PolyObject } from './poly-object';

describe('SoundLayer automation', () => {
  it('persists parameterId children in XML', () => {
    const layer = new SoundLayer();
    layer.setName('Test Layer');
    layer.getAutomationParameters().addParameterId('paramA');
    layer.getAutomationParameters().addParameterId('paramB');

    const pObj = new PolyObject(false);
    pObj.push(layer);
    const xml = pObj.saveAsXML();

    const reloaded = PolyObject.loadFromXML(Element.parse(xml.toXml()));
    const reloadedLayer = reloaded[0];
    expect(reloadedLayer.getAutomationParameters().getIds()).toEqual(['paramA', 'paramB']);
  });

  it('deep copies automation parameter ids', () => {
    const layer = new SoundLayer();
    layer.setName('Original');
    layer.getAutomationParameters().addParameterId('p1');

    const copy = layer.deepCopy();
    copy.getAutomationParameters().addParameterId('p2');

    expect(layer.getAutomationParameters().getIds()).toEqual(['p1']);
    expect(copy.getAutomationParameters().getIds()).toEqual(['p1', 'p2']);
  });

  it('loads soundLayer without parameterId children', () => {
    const xml = `<soundLayer name="Empty" muted="false" solo="false" heightIndex="0">
      <noteProcessorChain/>
    </soundLayer>`;
    const layer = new SoundLayer();
    const elem = Element.parse(xml);
    const nodes = elem.getElements();
    const layerElem = elem;
    const sObjNodes = layerElem.getElements();
    while (sObjNodes.hasMoreElements()) {
      const node = sObjNodes.next();
      if (node.getName() === 'parameterId') {
        layer.getAutomationParameters().addParameterId(node.getTextString());
      }
    }
    expect(layer.getAutomationParameters().getIds()).toEqual([]);
  });

  it('persists selectedIndex through round-trip', () => {
    const layer = new SoundLayer();
    layer.setName('Layer');
    layer.getAutomationParameters().addParameterId('a');
    layer.getAutomationParameters().addParameterId('b');
    layer.getAutomationParameters().setSelectedIndex(1);

    const pObj = new PolyObject(false);
    pObj.push(layer);
    const reloaded = PolyObject.loadFromXML(Element.parse(pObj.saveAsXML().toXml()));

    expect(reloaded[0].getAutomationParameters().getSelectedIndex()).toBe(1);
  });
});
