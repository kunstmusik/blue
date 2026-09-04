import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { BSBGraphicInterface } from './bsb-graphic-interface';
import { BSBKnob } from './bsb-knob';

describe('BSBGraphicInterface', () => {
  it('reports load-time repairs for legacy widgets without ids', () => {
    const graphicInterface = new BSBGraphicInterface();
    const repairs = graphicInterface.loadFromXML(
      Element.parse(`
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <objectName>gain</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
        </bsbObject>
      </graphicInterface>`),
    );

    const child = graphicInterface.getRootGroup().getChildren()[0];

    expect(repairs).toHaveLength(1);
    expect(repairs[0]?.reason).toBe('missing');
    expect(child?.id).toMatch(/^w-/);
  });

  it('deep-copies without sharing widget instances or grid state objects', () => {
    const graphicInterface = new BSBGraphicInterface();
    const knob = new BSBKnob();
    knob.id = 'widget-knob';
    knob.objectName = 'gain';
    knob.x = 10;
    knob.y = 20;
    knob.value = 0.5;

    graphicInterface.setGridSettings({
      enabled: true,
      snapEnabled: false,
      width: 24,
      height: 18,
      gridStyle: 'LINE',
    });
    graphicInterface.setEditEnabled(false);
    graphicInterface.getRootGroup().addChild(knob);

    const copy = graphicInterface.deepCopy();
    const originalKnob = graphicInterface.findWidgetById('widget-knob');
    const copiedKnob = copy.getRootGroup().getChildren()[0];

    expect(copy).not.toBe(graphicInterface);
    expect(copy.getGridSettings()).toEqual(graphicInterface.getGridSettings());
    expect(copy.getGridSettings()).not.toBe(graphicInterface.getGridSettings());
    expect(copy.isEditEnabled()).toBe(false);
    expect(copiedKnob).toBeInstanceOf(BSBKnob);
    expect(copiedKnob).not.toBe(originalKnob);
    expect(copiedKnob?.id).toBeTruthy();
    expect(copiedKnob?.id).not.toBe('widget-knob');
    expect(copy.findWidgetById('widget-knob')).toBeNull();

    if (!(copiedKnob instanceof BSBKnob) || !(originalKnob instanceof BSBKnob)) {
      throw new Error('Expected copied and original widgets to resolve as knobs');
    }

    copiedKnob.value = 0.9;
    copy.setGridSettings({ width: 40 });

    expect(originalKnob.value).toBe(0.5);
    expect(graphicInterface.getGridSettings().width).toBe(24);
  });
});
