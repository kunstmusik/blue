import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { BSBGraphicInterface } from './bsb-graphic-interface';
import { BSBKnob } from './bsb-knob';
import { BSBGroup } from './bsb-group';
import { XmlLoadContext, XmlLoadError } from '../../serialization/xml-load';

describe('BSBGraphicInterface', () => {
  it('warns and omits only the exact retired empty uniqueNameManager helper', () => {
    const root = Element.parse(
      '<graphicInterface><uniqueNameManager defaultPrefix="bsbObj" nameIndex="20">\n  \t</uniqueNameManager></graphicInterface>',
    );
    const context = new XmlLoadContext(root);
    const graphicInterface = new BSBGraphicInterface();
    graphicInterface.loadFromXML(root, context);
    expect(context.result(graphicInterface).diagnostics).toMatchObject([
      {
        code: 'R-BSB-UNIQUE-NAME-STATE',
        severity: 'warning',
        member: 'uniqueNameManager',
        value: '20',
      },
    ]);
    expect(graphicInterface.saveAsXML().getElement('uniqueNameManager')).toBeNull();

    for (const manager of [
      '<uniqueNameManager defaultPrefix="other" nameIndex="20"/>',
      '<uniqueNameManager defaultPrefix="bsbObj" nameIndex="-2"/>',
      '<uniqueNameManager defaultPrefix="bsbObj" nameIndex="20"><extra/></uniqueNameManager>',
      '<uniqueNameManager defaultPrefix="bsbObj" nameIndex="20" future="x"/>',
      '<uniqueNameManager defaultPrefix="bsbObj" nameIndex="20junk"/>',
      '<uniqueNameManager defaultPrefix="bsbObj" nameIndex="2147483648"/>',
      '<uniqueNameManager defaultPrefix="bsbObj"/>',
    ]) {
      expect(() =>
        new BSBGraphicInterface().loadFromXML(
          Element.parse(`<graphicInterface>${manager}</graphicInterface>`),
        ),
      ).toThrow();
    }

    expect(() =>
      new BSBGraphicInterface().loadFromXML(
        Element.parse(
          '<graphicInterface><uniqueNameManager defaultPrefix="bsbObj" nameIndex="20"/><uniqueNameManager defaultPrefix="bsbObj" nameIndex="21"/></graphicInterface>',
        ),
      ),
    ).toThrow();
  });

  it.each([
    ['plain text', 'retired state'],
    ['CDATA', '<![CDATA[retired state]]>'],
  ])(
    'rejects meaningful %s inside the retired helper without mutating the input',
    (_kind, text) => {
      const root = Element.parse(
        `<graphicInterface><uniqueNameManager defaultPrefix="bsbObj" nameIndex="20">${text}</uniqueNameManager></graphicInterface>`,
      );
      const original = root.toXml();
      const context = new XmlLoadContext(root, { kind: 'instrument', label: 'direct-bsb.xml' });

      let error: unknown;
      try {
        new BSBGraphicInterface().loadFromXML(root, context);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(XmlLoadError);
      expect((error as XmlLoadError).diagnostics[0]).toMatchObject({
        code: 'value',
        severity: 'error',
        source: { kind: 'instrument', label: 'direct-bsb.xml' },
        path: '/graphicInterface/uniqueNameManager[1]',
        member: '#text',
        value: 'retired state',
      });
      expect(root.toXml()).toBe(original);
    },
  );

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
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBGroup" groupName="Panel">
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
