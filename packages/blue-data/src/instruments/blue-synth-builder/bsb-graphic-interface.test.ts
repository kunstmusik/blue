import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { BSBGraphicInterface } from './bsb-graphic-interface';
import { BSBKnob } from './bsb-knob';
import { BSBGroup } from './bsb-group';

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

  it('round-trips authored widget ranges and group colors without normalization', () => {
    const graphicInterface = new BSBGraphicInterface();
    const repairs = graphicInterface.loadFromXML(
      Element.parse(`
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBGroup" version="2" groupName="Panel">
          <objectName>panel</objectName>
          <backgroundColor>0x18304866</backgroundColor>
          <borderColor>0xFF0000</borderColor>
          <labelTextColor>0x00FF00</labelTextColor>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
            <objectName>gain</objectName>
            <x>10</x>
            <y>20</y>
            <value>0.375</value>
            <minimum>-1.5</minimum>
            <maximum>2.25</maximum>
          </bsbObject>
        </bsbObject>
      </graphicInterface>`),
    );

    const loadedGroup = graphicInterface.getRootGroup();
    const loadedKnob = loadedGroup.getChildren()[0];

    expect(repairs).toHaveLength(1);
    expect(repairs[0]?.reason).toBe('missing');
    expect(loadedGroup).toBeInstanceOf(BSBGroup);
    expect(loadedGroup.backgroundColor).toBe('rgba(24,48,72,0.4)');
    expect(loadedGroup.borderColor).toBe('#FF0000');
    expect(loadedGroup.labelTextColor).toBe('#00FF00');
    expect(loadedKnob).toBeInstanceOf(BSBKnob);
    if (!(loadedKnob instanceof BSBKnob)) {
      throw new Error('Expected the group child to resolve as a knob');
    }
    expect(loadedKnob.objectName).toBe('gain');
    expect(loadedKnob.value).toBe(0.375);
    expect(loadedKnob.minimum).toBe(-1.5);
    expect(loadedKnob.maximum).toBe(2.25);

    const reloaded = new BSBGraphicInterface();
    const secondRepairs = reloaded.loadFromXML(graphicInterface.saveAsXML());
    const reloadedGroup = reloaded.getRootGroup();
    const reloadedKnob = reloadedGroup.getChildren()[0];

    expect(secondRepairs).toHaveLength(0);
    expect(reloadedGroup.backgroundColor).toBe('rgba(24,48,72,0.4)');
    expect(reloadedGroup.borderColor).toBe('#FF0000');
    expect(reloadedGroup.labelTextColor).toBe('#00FF00');
    if (!(reloadedKnob instanceof BSBKnob)) {
      throw new Error('Expected the reloaded group child to resolve as a knob');
    }
    expect(reloadedKnob.objectName).toBe('gain');
    expect(reloadedKnob.value).toBe(0.375);
    expect(reloadedKnob.minimum).toBe(-1.5);
    expect(reloadedKnob.maximum).toBe(2.25);
  });
});
