import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { BlueSynthBuilder } from '../blue-synth-builder';
import { BlueX7 } from '../blue-x7';
import { BSBGraphicInterface } from './bsb-graphic-interface';
import { saveBsbWidgetAsXML, loadBsbWidgetFromXML } from './bsb-group';
import { Preset } from './preset';
import { PresetGroup } from './preset-group';
import { Sound } from '../../sound-objects/sound';

const widget = (type: string, body = '', attrs = '') =>
  Element.parse(
    `<bsbObject type="blue.orchestra.blueSynthBuilder.${type}" ${attrs}>${body}</bsbObject>`,
  );

describe('BSB local XML contracts', () => {
  it.each([
    ['BSBKnob', '<value>1junk</value>'],
    ['BSBKnob', '<value>0</value><future>lost</future>'],
    ['BSBTextField', '<minimum>0</minimum>'],
    ['BSBGroup', '<titleEnabled>yes</titleEnabled>'],
    ['BSBGroup', '<backgroundColor>nonsense</backgroundColor>'],
    ['BSBXYController', '<width>1.5</width>'],
    ['BSBDropdown', '<fontSize>40</fontSize>'],
    ['BSBKnob', '<font><size>0</size></font>'],
    ['BSBLineObject', '<separatorType>BAD</separatorType>'],
    ['BSBHSliderBank', '<bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob"/>'],
  ])('rejects invalid %s owner data', (type, body) => {
    expect(() => loadBsbWidgetFromXML(widget(type, body))).toThrow();
  });
  it.each([
    ['None', 'NONE'],
    ['Comma', 'COMMA'],
    ['Single Quote', 'SINGLE_QUOTE'],
  ])('accepts Java separator display value %s and writes %s', (value, canonical) => {
    const line = loadBsbWidgetFromXML(
      widget('BSBLineObject', `<separatorType>${value}</separatorType>`),
    )!;
    expect(saveBsbWidgetAsXML(line).getTextString('separatorType')).toBe(canonical);
  });
  it.each([
    'BSBGroup',
    'BSBKnob',
    'BSBHSlider',
    'BSBVSlider',
    'BSBHSliderBank',
    'BSBVSliderBank',
    'BSBValue',
    'BSBCheckBox',
    'BSBDropdown',
    'BSBXYController',
    'BSBLabel',
    'BSBTextField',
    'BSBFileSelector',
    'BSBSubChannelDropdown',
    'BSBLineObject',
  ])('writes only supported typed fields for %s', (type) => {
    const gi = new BSBGraphicInterface();
    const value = gi.createWidgetByType(type)!;
    (value as unknown as Record<string, unknown>).futureField = 'unsupported';
    const xml = saveBsbWidgetAsXML(value);
    expect(xml.getElement('futureField')).toBeNull();
    const loaded = loadBsbWidgetFromXML(xml);
    expect(loaded.constructor.name).toBe(type);
  });
  it('keeps an existing interface unchanged after failed acceptance', () => {
    const gi = new BSBGraphicInterface();
    const before = gi.saveAsXML().toXml();
    expect(() =>
      gi.loadFromXML(
        Element.parse(
          '<graphicInterface><gridSettings><width>bad</width></gridSettings></graphicInterface>',
        ),
      ),
    ).toThrow();
    expect(gi.saveAsXML().toXml()).toBe(before);
  });
  it('preserves finite writer values independently of the editing range', () => {
    const value = loadBsbWidgetFromXML(
      widget(
        'BSBValue',
        '<minimum>20</minimum><maximum>20000</maximum><defaultValue>0</defaultValue>',
      ),
    )!;
    expect(saveBsbWidgetAsXML(value).getTextString('defaultValue')).toBe('0');
    const knob = loadBsbWidgetFromXML(
      widget(
        'BSBKnob',
        '<minimum>0</minimum><maximum>1</maximum><value>880</value>',
        'version="2"',
      ),
    )!;
    expect(knob.value).toBe(880);
  });
  it('synchronizes slider-bank owned bounds without discarding the child value', () => {
    const bank = loadBsbWidgetFromXML(
      widget(
        'BSBHSliderBank',
        '<minimum>10</minimum><maximum>20</maximum><bdresolution>-1</bdresolution><bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider" version="2"><value>15</value></bsbObject>',
      ),
    )!;
    const child = (
      bank as unknown as { sliders: Array<{ minimum: number; maximum: number; value: number }> }
    ).sliders[0];
    expect(child).toMatchObject({ minimum: 10, maximum: 20, value: 15 });
  });
  it('rejects unknown widget dispatch', () => {
    expect(() => loadBsbWidgetFromXML(widget('FutureWidget'))).toThrow();
  });
  it('normalizes omitted-version knob and XY values once', () => {
    const knob = loadBsbWidgetFromXML(
      widget('BSBKnob', '<minimum>10</minimum><maximum>20</maximum><value>0.25</value>'),
    )!;
    expect(knob.value).toBe(12.5);
    const xy = loadBsbWidgetFromXML(
      widget('BSBXYController', '<xMin>10</xMin><xMax>20</xMax><xValue>0.25</xValue>'),
    )!;
    expect((xy as unknown as { xValue: number }).xValue).toBe(12.5);
  });
  it.each(['1', '01', '+1', ' 1 '])(
    'applies historical knob and XY range conversion for numeric version spelling %s',
    (version) => {
      const knobXml = widget(
        'BSBKnob',
        '<minimum>10</minimum><maximum>20</maximum><value>0.25</value>',
        `version="${version}"`,
      );
      const knob = loadBsbWidgetFromXML(knobXml)!;
      expect(knob.value).toBe(12.5);
      expect(saveBsbWidgetAsXML(knob).getAttribute('version')).toBe('2');
      expect(loadBsbWidgetFromXML(saveBsbWidgetAsXML(knob)).value).toBe(12.5);

      const xyXml = widget(
        'BSBXYController',
        '<xMin>10</xMin><xMax>20</xMax><xValue>0.25</xValue><yMin>-4</yMin><yMax>4</yMax><yValue>0.75</yValue>',
        `version="${version}"`,
      );
      const xy = loadBsbWidgetFromXML(xyXml) as unknown as {
        xValue: number;
        yValue: number;
      };
      expect(xy).toMatchObject({ xValue: 12.5, yValue: 2 });

      const instrument = Element.parse(
        `<instrument type="blue.orchestra.BlueSynthBuilder"><graphicInterface>${knobXml.toXml()}${xyXml.toXml()}</graphicInterface></instrument>`,
      );
      const standalone = BlueSynthBuilder.loadFromXML(instrument);
      const standaloneWidgets = standalone.getGraphicInterface().getRootGroup().getChildren();
      expect(standaloneWidgets[0]!.value).toBe(12.5);
      expect(standaloneWidgets[1]).toMatchObject({ xValue: 12.5, yValue: 2 });
      const embedded = Sound.loadFromXML(
        Element.parse(
          `<soundObject type="blue.soundObject.Sound">${instrument.toXml()}</soundObject>`,
        ),
      );
      const saved = embedded.saveAsXML();
      expect(Sound.loadFromXML(saved).getBlueSynthBuilder().saveAsXML().toXml()).toBe(
        embedded.getBlueSynthBuilder().saveAsXML().toXml(),
      );
      const embeddedWidgets = embedded
        .getBlueSynthBuilder()
        .getGraphicInterface()
        .getRootGroup()
        .getChildren();
      expect(embeddedWidgets[0]!.value).toBe(12.5);
      expect(embeddedWidgets[1]).toMatchObject({ xValue: 12.5, yValue: 2 });
    },
  );
  it.each(['2', '02', '+2', ' 2 '])(
    'keeps version-2 knob and XY values absolute for numeric spelling %s',
    (version) => {
      const knob = loadBsbWidgetFromXML(
        widget(
          'BSBKnob',
          '<minimum>10</minimum><maximum>20</maximum><value>0.25</value>',
          `version="${version}"`,
        ),
      )!;
      expect(knob.value).toBe(0.25);
      const xy = loadBsbWidgetFromXML(
        widget(
          'BSBXYController',
          '<xMin>10</xMin><xMax>20</xMax><xValue>0.25</xValue><yMin>-4</yMin><yMax>4</yMax><yValue>0.75</yValue>',
          `version="${version}"`,
        ),
      ) as unknown as { xValue: number; yValue: number };
      expect(xy).toMatchObject({ xValue: 0.25, yValue: 0.75 });
    },
  );
  it('uses historical omitted-grid defaults and rejects conflicting roots', () => {
    const gi = new BSBGraphicInterface();
    gi.loadFromXML(Element.parse('<graphicInterface/>'));
    expect(gi.getGridSettings()).toMatchObject({
      gridStyle: 'NONE',
      snapEnabled: false,
      width: 10,
      height: 10,
    });
    expect(() =>
      gi.loadFromXML(
        Element.parse(
          '<graphicInterface><bsbObject type="blue.orchestra.blueSynthBuilder.BSBGroup"/><bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob"/></graphicInterface>',
        ),
      ),
    ).toThrow();
  });
  it('rejects unsupported grids rather than caching them', () => {
    expect(() =>
      new BSBGraphicInterface().loadFromXML(
        Element.parse(
          '<graphicInterface><gridSettings><future>lost</future></gridSettings></graphicInterface>',
        ),
      ),
    ).toThrow();
  });
  it('preserves scalar setting whitespace and rejects duplicate keys', () => {
    const preset = Preset.loadFromXML(
      Element.parse('<preset name="P"><setting name="knob">  ver2:0.5\n</setting></preset>'),
    );
    expect(preset.getValue('knob')).toBe('  ver2:0.5\n');
    expect(() =>
      Preset.loadFromXML(
        Element.parse(
          '<preset><setting name="x">1</setting><setting name="x">2</setting></preset>',
        ),
      ),
    ).toThrow();
    expect(() =>
      Preset.loadFromXML(Element.parse('<preset><setting name="x"><future/></setting></preset>')),
    ).toThrow();
  });
  it('validates preset reference after reading the complete tree', () => {
    const group = PresetGroup.loadFromXML(
      Element.parse(
        '<presetGroup currentPresetUniqueId="p"><presetGroup><preset uniqueId="p"/></presetGroup></presetGroup>',
      ),
    );
    expect(group.findPresetByUniqueId('p')).not.toBeNull();
    expect(() =>
      PresetGroup.loadFromXML(Element.parse('<presetGroup currentPresetUniqueId="missing"/>')),
    ).toThrow();
  });
  it('rejects both BSB parameter list aliases and unexpected instrument fields', () => {
    expect(() =>
      BlueSynthBuilder.loadFromXML(
        Element.parse(
          '<instrument type="blue.orchestra.BlueSynthBuilder"><parameterList/><bsbParameterList/></instrument>',
        ),
      ),
    ).toThrow();
    expect(() =>
      BlueSynthBuilder.loadFromXML(
        Element.parse('<instrument type="blue.orchestra.BlueSynthBuilder"><future/></instrument>'),
      ),
    ).toThrow();
  });
});

describe('BlueX7 voice XML contracts', () => {
  it('requires complete arrays and containers', () => {
    expect(() =>
      BlueX7.loadFromXML(Element.parse('<instrument type="blue.orchestra.BlueX7"/>')),
    ).toThrow();
    const xml = new BlueX7().saveAsXML();
    xml.removeElements('operator');
    expect(() => BlueX7.loadFromXML(xml)).toThrow();
  });
  it('rejects unknown voice members and malformed domains', () => {
    const unknown = new BlueX7().saveAsXML();
    unknown.getElement('lfoData')!.addElement('future');
    expect(() => BlueX7.loadFromXML(unknown)).toThrow();
    const bad = new BlueX7().saveAsXML();
    bad.getElement('algorithmCommonData')!.getElement('algorithm')!.setText('33');
    expect(() => BlueX7.loadFromXML(bad)).toThrow();
  });
  it('retains complete voice and significant post-code through canonical output', () => {
    const xml = new BlueX7().saveAsXML();
    xml.getElement('csoundPostCode')!.setText('  aout = aout\n');
    const loaded = BlueX7.loadFromXML(xml);
    expect(loaded.saveAsXML().getTextString('csoundPostCode')).toBe('  aout = aout\n');
  });
});
