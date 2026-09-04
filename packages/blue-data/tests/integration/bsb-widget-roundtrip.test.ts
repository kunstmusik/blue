import { describe, it, expect } from 'vitest';
import { Element } from '../../src/serialization/xml-reader';
import { BSBHSlider } from '../../src/instruments/blue-synth-builder/bsb-hslider';
import { BSBVSlider } from '../../src/instruments/blue-synth-builder/bsb-vslider';
import { BSBKnob } from '../../src/instruments/blue-synth-builder/bsb-knob';
import { BSBCheckBox } from '../../src/instruments/blue-synth-builder/bsb-check-box';
import { BSBDropdown } from '../../src/instruments/blue-synth-builder/bsb-dropdown';
import { BSBValue } from '../../src/instruments/blue-synth-builder/bsb-value';
import { BSBGroup } from '../../src/instruments/blue-synth-builder/bsb-group';
import { BSBLabel } from '../../src/instruments/blue-synth-builder/bsb-label';
import { BSBTextField } from '../../src/instruments/blue-synth-builder/bsb-text-field';
import { BSBFileSelector } from '../../src/instruments/blue-synth-builder/bsb-file-selector';
import { BSBXYController } from '../../src/instruments/blue-synth-builder/bsb-xy-controller';
import { BSBLineObject } from '../../src/instruments/blue-synth-builder/bsb-line-object';
import { BSBSubChannelDropdown } from '../../src/instruments/blue-synth-builder/bsb-subchannel-dropdown';
import { BSBHSliderBank } from '../../src/instruments/blue-synth-builder/bsb-hslider-bank';
import { BSBVSliderBank } from '../../src/instruments/blue-synth-builder/bsb-vslider-bank';
import { BSBCompilationUnit } from '../../src/instruments/blue-synth-builder/bsb-compilation-unit';
import { saveBsbWidgetAsXML } from '../../src/instruments/blue-synth-builder/bsb-group';
import type { BSBWidget } from '../../src/instruments/blue-synth-builder/bsb-widget';

function bsbWrap(innerXml: string): string {
  return `<bsbObject type="placeholder">${innerXml}</bsbObject>`;
}

function parseAndLoad<T extends BSBWidget>(Ctor: new () => T, innerXml: string): T {
  const widget = new Ctor();
  widget.loadFromXML(Element.parse(bsbWrap(innerXml)));
  return widget;
}

function roundTrip(widget: BSBWidget): Element {
  const xml = saveBsbWidgetAsXML(widget);
  return Element.parse(xml.toXml());
}

describe('BSB Widget XML Round-Trip', () => {
  describe('BSBHSlider', () => {
    it('parses all fields from Java XML', () => {
      const w = parseAndLoad(
        BSBHSlider,
        `
        <objectName>gain</objectName><x>10</x><y>20</y>
        <comment>my slider</comment>
        <automationAllowed>true</automationAllowed>
        <minimum>0</minimum><maximum>1</maximum><value>0.5</value>
        <sliderWidth>200</sliderWidth>
        <bdresolution>0.01</bdresolution>
        <randomizable>true</randomizable>
        <valueDisplayEnabled>false</valueDisplayEnabled>
      `,
      );
      expect(w.objectName).toBe('gain');
      expect(w.x).toBe(10);
      expect(w.y).toBe(20);
      expect(w.comment).toBe('my slider');
      expect(w.automationAllowed).toBe(true);
      expect(w.value).toBe(0.5);
      expect(w.sliderWidth).toBe(200);
      expect(w.resolution).toBeCloseTo(0.01);
      expect(w.randomizable).toBe(true);
      expect(w.valueDisplayEnabled).toBe(false);
    });

    it('survives save→re-parse round-trip', () => {
      const w = parseAndLoad(
        BSBHSlider,
        `
        <objectName>vol</objectName><x>5</x><y>15</y>
        <comment>test</comment><automationAllowed>false</automationAllowed>
        <minimum>-1</minimum><maximum>1</maximum><value>0.3</value>
        <sliderWidth>150</sliderWidth><bdresolution>0.05</bdresolution>
        <randomizable>false</randomizable><valueDisplayEnabled>true</valueDisplayEnabled>
      `,
      );
      const rt = roundTrip(w);
      const w2 = new BSBHSlider();
      w2.loadFromXML(rt);
      expect(w2.objectName).toBe('vol');
      expect(w2.comment).toBe('test');
      expect(w2.automationAllowed).toBe(false);
      expect(w2.sliderWidth).toBe(150);
      expect(w2.resolution).toBeCloseTo(0.05);
      expect(w2.randomizable).toBe(false);
      expect(w2.valueDisplayEnabled).toBe(true);
    });
  });

  describe('BSBVSlider', () => {
    it('parses all fields', () => {
      const w = parseAndLoad(
        BSBVSlider,
        `
        <objectName>freq</objectName><x>0</x><y>0</y>
        <comment>vert</comment><automationAllowed>true</automationAllowed>
        <minimum>20</minimum><maximum>20000</maximum><value>440</value>
        <sliderHeight>300</sliderHeight><bdresolution>1</bdresolution>
        <randomizable>true</randomizable><valueDisplayEnabled>true</valueDisplayEnabled>
      `,
      );
      expect(w.sliderHeight).toBe(300);
      expect(w.value).toBe(440);
      expect(w.comment).toBe('vert');
    });
  });

  describe('BSBKnob', () => {
    it('parses knobWidth but not knobHeight', () => {
      const w = parseAndLoad(
        BSBKnob,
        `
        <objectName>knob1</objectName><x>10</x><y>10</y>
        <automationAllowed>true</automationAllowed>
        <minimum>0</minimum><maximum>1</maximum><value>0.7</value>
        <knobWidth>80</knobWidth>
        <randomizable>true</randomizable><valueDisplayEnabled>true</valueDisplayEnabled>
        <label>Volume</label><labelEnabled>true</labelEnabled>
        <font><name>Arial</name><size>14</size><style>1</style></font>
      `,
      );
      expect(w.knobWidth).toBe(80);
      expect(w.label).toBe('Volume');
      expect(w.labelEnabled).toBe(true);
      expect(w.labelFont.name).toBe('Arial');
      expect(w.labelFont.size).toBe(14);
      expect(w.labelFont.style).toBe(1);
      expect((w as any).knobHeight).toBeUndefined();
    });

    it('defaults labelEnabled to false', () => {
      const w = parseAndLoad(
        BSBKnob,
        `
        <objectName>k</objectName><x>0</x><y>0</y>
        <minimum>0</minimum><maximum>1</maximum><value>0</value>
        <knobWidth>60</knobWidth>
      `,
      );
      expect(w.labelEnabled).toBe(false);
    });
  });

  describe('BSBCheckBox', () => {
    it('parses selected + label (not checkedVal/uncheckedVal)', () => {
      const w = parseAndLoad(
        BSBCheckBox,
        `
        <objectName>mute</objectName><x>5</x><y>5</y>
        <comment>mute toggle</comment>
        <automationAllowed>true</automationAllowed>
        <label>Mute</label><selected>true</selected>
        <randomizable>false</randomizable>
      `,
      );
      expect(w.label).toBe('Mute');
      expect(w.selected).toBe(true);
      expect(w.randomizable).toBe(false);
      expect(w.comment).toBe('mute toggle');
      expect((w as any).checkedVal).toBeUndefined();
      expect((w as any).uncheckedVal).toBeUndefined();
    });

    it('collects "1" or "0" replacements', () => {
      const w = parseAndLoad(
        BSBCheckBox,
        `
        <objectName>flag</objectName><x>0</x><y>0</y>
        <label>Flag</label><selected>true</selected>
      `,
      );
      const unit = new BSBCompilationUnit();
      w.collectReplacements(unit);
      const result = unit.replaceBSBValues('<flag>');
      expect(result).toBe('1');
    });
  });

  describe('BSBDropdown', () => {
    it('parses items, fontSize, selectedIndex', () => {
      const w = parseAndLoad(
        BSBDropdown,
        `
        <objectName>waveform</objectName><x>0</x><y>0</y>
        <automationAllowed>true</automationAllowed>
        <selectedIndex>1</selectedIndex><fontSize>14</fontSize>
        <randomizable>true</randomizable>
        <bsbDropdownItemList>
          <bsbDropdownItem uniqueId="abc"><name>Sine</name><value>0</value></bsbDropdownItem>
          <bsbDropdownItem uniqueId="def"><name>Saw</name><value>1</value></bsbDropdownItem>
        </bsbDropdownItemList>
      `,
      );
      expect(w.selectedIndex).toBe(1);
      expect(w.fontSize).toBe(14);
      expect(w.dropdownItems).toHaveLength(2);
      expect(w.dropdownItems[0].name).toBe('Sine');
      expect(w.dropdownItems[1].value).toBe('1');
    });

    it('migrates legacy Swing HTML dropdown labels into plain text plus fontSize', () => {
      const w = parseAndLoad(
        BSBDropdown,
        `
        <objectName>waveform</objectName><x>0</x><y>0</y>
        <selectedIndex>0</selectedIndex>
        <bsbDropdownItemList>
          <bsbDropdownItem uniqueId="abc"><name>&lt;html&gt;&lt;font size=&quot;+1&quot;&gt;Mode A&lt;/font&gt;&lt;/html&gt;</name><value>0</value></bsbDropdownItem>
          <bsbDropdownItem uniqueId="def"><name>Mode B</name><value>1</value></bsbDropdownItem>
        </bsbDropdownItemList>
      `,
      );

      expect(w.fontSize).toBe(18);
      expect(w.dropdownItems[0].name).toBe('Mode A');
      expect(w.dropdownItems[1].name).toBe('Mode B');
    });
  });

  describe('BSBValue', () => {
    it('parses defaultValue (not precision)', () => {
      const w = parseAndLoad(
        BSBValue,
        `
        <objectName>val1</objectName><x>0</x><y>0</y>
        <automationAllowed>true</automationAllowed>
        <minimum>0</minimum><maximum>100</maximum><defaultValue>42</defaultValue>
      `,
      );
      expect(w.defaultValue).toBe(42);
      expect(w.minimum).toBe(0);
      expect(w.maximum).toBe(100);
      expect((w as any).precision).toBeUndefined();
    });
  });

  describe('BSBGroup', () => {
    it('parses groupName, colors, titleEnabled, font, children', () => {
      const w = parseAndLoad(
        BSBGroup,
        `
        <objectName></objectName><x>0</x><y>0</y>
        <comment>my group</comment>
        <groupName>Oscillators</groupName>
        <backgroundColor>rgba(255,0,0,0.5)</backgroundColor>
        <borderColor>#FF0000</borderColor>
        <labelTextColor>#FFFFFF</labelTextColor>
        <titleEnabled>true</titleEnabled>
        <width>400</width><height>300</height>
        <font><name>Roboto</name><size>12</size><style>0</style></font>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
          <objectName>inner</objectName><x>5</x><y>5</y>
          <minimum>0</minimum><maximum>1</maximum><value>0.5</value>
          <sliderWidth>100</sliderWidth>
        </bsbObject>
      `,
      );
      expect(w.groupName).toBe('Oscillators');
      expect(w.backgroundColor).toBe('rgba(255,0,0,0.5)');
      expect(w.borderColor).toBe('#FF0000');
      expect(w.labelTextColor).toBe('#FFFFFF');
      expect(w.titleEnabled).toBe(true);
      expect(w.width).toBe(400);
      expect(w.height).toBe(300);
      expect(w.getChildren()).toHaveLength(1);
      expect(w.comment).toBe('my group');
    });
  });

  describe('BSBLabel', () => {
    it('reads "label" element (not "labelText")', () => {
      const w = new BSBLabel();
      w.loadFromXML(
        Element.parse(`
        <bsbObject type="placeholder" version="2">
          <objectName></objectName><x>10</x><y>20</y>
          <comment>a label</comment>
          <label>Hello World</label>
          <font><name>Monospace</name><size>10</size><style>0</style></font>
        </bsbObject>
      `),
      );
      expect(w.label).toBe('Hello World');
      expect(w.font.name).toBe('Monospace');
      expect(w.comment).toBe('a label');
      expect((w as any).labelText).toBeUndefined();
    });

    it('migrates legacy Swing HTML labels into plain text and bold Roboto font metadata', () => {
      const w = parseAndLoad(
        BSBLabel,
        `
        <objectName></objectName><x>10</x><y>20</y>
        <label>&lt;html&gt;&lt;font size=&quot;+1&quot;&gt;Amp Env&lt;/font&gt;&lt;/html&gt;</label>
      `,
      );

      expect(w.label).toBe('Amp Env');
      expect(w.font).toEqual({ name: 'Roboto', size: 18, style: 1 });
    });
  });

  describe('BSBTextField', () => {
    it('reads "value" element (not "textFieldValue")', () => {
      const w = parseAndLoad(
        BSBTextField,
        `
        <objectName>filename</objectName><x>0</x><y>0</y>
        <comment>file name</comment>
        <value>test.wav</value><textFieldWidth>200</textFieldWidth>
      `,
      );
      expect(w.textValue).toBe('test.wav');
      expect(w.textFieldWidth).toBe(200);
      expect(w.comment).toBe('file name');
      expect((w as any).textFieldValue).toBeUndefined();
    });
  });

  describe('BSBFileSelector', () => {
    it('reads fileName and textFieldWidth', () => {
      const w = parseAndLoad(
        BSBFileSelector,
        `
        <objectName>sfile</objectName><x>0</x><y>0</y>
        <comment>pick file</comment>
        <fileName>/path/to/file.wav</fileName>
        <textFieldWidth>250</textFieldWidth>
        <stringChannelEnabled>true</stringChannelEnabled>
      `,
      );
      expect(w.fileName).toBe('/path/to/file.wav');
      expect(w.textFieldWidth).toBe(250);
      expect(w.stringChannelEnabled).toBe(true);
      expect(w.comment).toBe('pick file');
      expect((w as any).selectedPath).toBeUndefined();
    });
  });

  describe('BSBXYController', () => {
    it('reads xMin/xMax/yMin/yMax (not xMinimum etc.)', () => {
      const w = parseAndLoad(
        BSBXYController,
        `
        <objectName>xy1</objectName><x>0</x><y>0</y>
        <automationAllowed>true</automationAllowed>
        <width>200</width><height>150</height>
        <xMin>-1</xMin><xMax>1</xMax><yMin>0</yMin><yMax>100</yMax>
        <xValue>0.5</xValue><yValue>50</yValue>
        <randomizable>true</randomizable><valueDisplayEnabled>true</valueDisplayEnabled>
      `,
      );
      expect(w.xMin).toBe(-1);
      expect(w.xMax).toBe(1);
      expect(w.yMin).toBe(0);
      expect(w.yMax).toBe(100);
      expect(w.xValue).toBe(0.5);
      expect(w.yValue).toBe(50);
      expect(w.width).toBe(200);
      expect(w.height).toBe(150);
      expect((w as any).xMinimum).toBeUndefined();
    });
  });

  describe('BSBLineObject', () => {
    it('parses canvas dimensions, line data, separatorType', () => {
      const w = parseAndLoad(
        BSBLineObject,
        `
        <objectName>env1</objectName><x>0</x><y>0</y>
        <comment>envelope</comment>
        <canvasWidth>300</canvasWidth><canvasHeight>200</canvasHeight>
        <xMax>1</xMax>
        <relativeXValues>true</relativeXValues>
        <leadingZero>true</leadingZero>
        <separatorType>Comma</separatorType>
        <locked>false</locked>
        <lines>
          <line varName="line0" min="0" max="1" color="#000000">
            <linePoint x="0" y="0"/><linePoint x="0.5" y="1"/><linePoint x="1" y="0"/>
          </line>
        </lines>
      `,
      );
      expect(w.canvasWidth).toBe(300);
      expect(w.canvasHeight).toBe(200);
      expect(w.xMax).toBe(1);
      expect(w.relativeXValues).toBe(true);
      expect(w.leadingZero).toBe(true);
      expect(w.separatorType).toBe('Comma');
      expect(w.locked).toBe(false);
      expect(w.lines).toHaveLength(1);
      expect(w.lines[0].varName).toBe('line0');
      expect(w.lines[0].points).toHaveLength(3);
      expect(w.comment).toBe('envelope');
      expect((w as any).x2).toBeUndefined();
    });
  });

  describe('BSBSubChannelDropdown', () => {
    it('parses channelOutput', () => {
      const w = parseAndLoad(
        BSBSubChannelDropdown,
        `
        <objectName>sub1</objectName><x>0</x><y>0</y>
        <comment>sub chan</comment>
        <channelOutput>Channel 1</channelOutput>
      `,
      );
      expect(w.channelOutput).toBe('Channel 1');
      expect(w.comment).toBe('sub chan');
    });
  });

  describe('BSBHSliderBank', () => {
    it('derives slider count from child bsbObject elements', () => {
      const w = parseAndLoad(
        BSBHSliderBank,
        `
        <objectName>bank1</objectName><x>0</x><y>0</y>
        <automationAllowed>true</automationAllowed>
        <minimum>0</minimum><maximum>1</maximum><bdresolution>0.1</bdresolution>
        <sliderWidth>80</sliderWidth><gap>10</gap>
        <randomizable>true</randomizable><valueDisplayEnabled>true</valueDisplayEnabled>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
          <objectName>bank1_0</objectName><x>0</x><y>0</y>
          <minimum>0</minimum><maximum>1</maximum><value>0.2</value>
          <sliderWidth>80</sliderWidth>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
          <objectName>bank1_1</objectName><x>0</x><y>0</y>
          <minimum>0</minimum><maximum>1</maximum><value>0.7</value>
          <sliderWidth>80</sliderWidth>
        </bsbObject>
      `,
      );
      expect(w.numberOfSliders).toBe(2);
      expect(w.sliderWidth).toBe(80);
      expect(w.gap).toBe(10);
      expect(w.sliders[0].value).toBeCloseTo(0.2);
      expect(w.sliders[1].value).toBeCloseTo(0.7);
      expect((w as any).sliderCount).toBeUndefined();
    });
  });

  describe('BSBVSliderBank', () => {
    it('derives slider count from child bsbObject elements', () => {
      const w = parseAndLoad(
        BSBVSliderBank,
        `
        <objectName>vb1</objectName><x>0</x><y>0</y>
        <automationAllowed>true</automationAllowed>
        <minimum>0</minimum><maximum>1</maximum><bdresolution>0.1</bdresolution>
        <sliderHeight>120</sliderHeight><gap>5</gap>
        <randomizable>true</randomizable><valueDisplayEnabled>true</valueDisplayEnabled>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBVSlider">
          <objectName>vb1_0</objectName><x>0</x><y>0</y>
          <minimum>0</minimum><maximum>1</maximum><value>0.5</value>
          <sliderHeight>120</sliderHeight>
        </bsbObject>
      `,
      );
      expect(w.numberOfSliders).toBe(1);
      expect(w.sliderHeight).toBe(120);
      expect(w.gap).toBe(5);
      expect((w as any).sliderCount).toBeUndefined();
    });
  });

  describe('comment field on base class', () => {
    it('is read from XML for all widget types', () => {
      const types = [
        { Ctor: BSBHSlider, type: 'blue.orchestra.blueSynthBuilder.BSBHSlider' },
        { Ctor: BSBVSlider, type: 'blue.orchestra.blueSynthBuilder.BSBVSlider' },
        { Ctor: BSBKnob, type: 'blue.orchestra.blueSynthBuilder.BSBKnob' },
        { Ctor: BSBCheckBox, type: 'blue.orchestra.blueSynthBuilder.BSBCheckBox' },
        { Ctor: BSBDropdown, type: 'blue.orchestra.blueSynthBuilder.BSBDropdown' },
        { Ctor: BSBValue, type: 'blue.orchestra.blueSynthBuilder.BSBValue' },
        { Ctor: BSBLabel, type: 'blue.orchestra.blueSynthBuilder.BSBLabel' },
        { Ctor: BSBTextField, type: 'blue.orchestra.blueSynthBuilder.BSBTextField' },
        {
          Ctor: BSBSubChannelDropdown,
          type: 'blue.orchestra.blueSynthBuilder.BSBSubChannelDropdown',
        },
      ];
      for (const { Ctor, type } of types) {
        const xml = `<bsbObject type="${type}">
          <objectName>test</objectName><x>0</x><y>0</y>
          <comment>hello world</comment>
          <minimum>0</minimum><maximum>1</maximum><value>0</value>
        </bsbObject>`;
        const w = new Ctor();
        w.loadFromXML(Element.parse(xml));
        expect(w.comment, `comment missing for ${type}`).toBe('hello world');
      }
    });
  });

  describe('automationAllowed field', () => {
    it('defaults to false when absent from XML', () => {
      const w = parseAndLoad(
        BSBHSlider,
        `
        <objectName>a</objectName><x>0</x><y>0</y>
        <minimum>0</minimum><maximum>1</maximum><value>0</value>
        <sliderWidth>100</sliderWidth>
      `,
      );
      expect(w.automationAllowed).toBe(false);
    });

    it('reads explicit true value', () => {
      const w = parseAndLoad(
        BSBHSlider,
        `
        <objectName>a</objectName><x>0</x><y>0</y>
        <automationAllowed>true</automationAllowed>
        <minimum>0</minimum><maximum>1</maximum><value>0</value>
        <sliderWidth>100</sliderWidth>
      `,
      );
      expect(w.automationAllowed).toBe(true);
    });
  });

  describe('legacy element name aliases', () => {
    it('BSBXYController reads xMin (not xMinimum)', () => {
      const w = parseAndLoad(
        BSBXYController,
        `
        <objectName>xy</objectName><x>0</x><y>0</y>
        <xMin>-5</xMin><xMax>5</xMax><yMin>0</yMin><yMax>1</yMax>
        <xValue>0</xValue><yValue>0.5</yValue>
      `,
      );
      expect(w.xMin).toBe(-5);
      expect(w.xMax).toBe(5);
    });
  });

  describe('deepCopy', () => {
    function populateSlider(): BSBHSlider {
      const w = new BSBHSlider();
      w.id = 'test-id';
      w.objectName = 'mySlider';
      w.x = 42;
      w.y = 99;
      w.value = 0.75;
      w.minimum = -1;
      w.maximum = 1;
      w.sliderWidth = 200;
      w.valueDisplayEnabled = true;
      w.comment = 'test comment';
      return w;
    }

    it('copies all primitive properties of a slider', () => {
      const orig = populateSlider();
      const copy = orig.deepCopy();
      expect(copy).not.toBe(orig);
      expect(copy.id).toBeTruthy();
      expect(copy.id).not.toBe('test-id');
      expect(copy.objectName).toBe('mySlider');
      expect(copy.x).toBe(42);
      expect(copy.y).toBe(99);
      expect(copy.value).toBe(0.75);
      expect(copy.minimum).toBe(-1);
      expect(copy.maximum).toBe(1);
      expect(copy.sliderWidth).toBe(200);
      expect(copy.valueDisplayEnabled).toBe(true);
      expect(copy.comment).toBe('test comment');
    });

    it('modifying copy does not affect original', () => {
      const orig = populateSlider();
      const copy = orig.deepCopy();
      copy.objectName = 'changed';
      copy.value = 0;
      copy.x = 0;
      expect(orig.objectName).toBe('mySlider');
      expect(orig.value).toBe(0.75);
      expect(orig.x).toBe(42);
    });

    it('deep copies BSBKnob with labelFont', () => {
      const orig = new BSBKnob();
      orig.id = 'knob1';
      orig.objectName = 'myKnob';
      orig.x = 10;
      orig.y = 20;
      orig.value = 0.5;
      orig.knobWidth = 80;
      orig.labelEnabled = true;
      orig.labelFont = { name: 'Courier', size: 14, style: 1 };
      const copy = orig.deepCopy();
      expect(copy.objectName).toBe('myKnob');
      expect(copy.knobWidth).toBe(80);
      expect(copy.labelFont).toEqual({ name: 'Courier', size: 14, style: 1 });
      expect(copy.labelFont).not.toBe(orig.labelFont);
      copy.labelFont.name = 'Arial';
      expect(orig.labelFont.name).toBe('Courier');
    });

    it('deep copies BSBDropdown with dropdownItems', () => {
      const orig = new BSBDropdown();
      orig.id = 'dd1';
      orig.objectName = 'mode';
      orig.dropdownItems = [
        { uniqueId: 'a', name: 'Chorus', value: '1' },
        { uniqueId: 'b', name: 'Flange', value: '2' },
      ];
      const copy = orig.deepCopy();
      expect(copy.objectName).toBe('mode');
      expect(copy.dropdownItems).toHaveLength(2);
      expect(copy.dropdownItems[0].name).toBe('Chorus');
      expect(copy.dropdownItems.map((item) => item.uniqueId)).not.toEqual(['a', 'b']);
      expect(copy.dropdownItems).not.toBe(orig.dropdownItems);
      copy.dropdownItems[0].name = 'Changed';
      expect(orig.dropdownItems[0].name).toBe('Chorus');
    });

    it('deep copies BSBGroup with children recursively', () => {
      const orig = new BSBGroup();
      orig.id = 'grp1';
      orig.objectName = '';
      orig.x = 100;
      orig.y = 50;
      orig.width = 300;
      orig.height = 200;
      orig.groupName = 'Effects';
      orig.borderColor = '#FF0000';
      orig.font = { name: 'Verdana', size: 14, style: 0 };

      const child = new BSBHSlider();
      child.id = 'child1';
      child.objectName = 'innerSlider';
      child.x = 10;
      child.y = 20;
      child.value = 0.5;

      const nestedGroup = new BSBGroup();
      nestedGroup.id = 'nested1';
      nestedGroup.objectName = '';
      nestedGroup.x = 10;
      nestedGroup.y = 60;
      nestedGroup.width = 200;
      nestedGroup.height = 100;
      nestedGroup.groupName = 'Sub';

      const deepChild = new BSBCheckBox();
      deepChild.id = 'deep1';
      deepChild.objectName = 'deepCheck';
      deepChild.x = 5;
      deepChild.y = 5;
      deepChild.selected = true;

      nestedGroup.addChild(deepChild);
      orig.addChild(child);
      orig.addChild(nestedGroup);

      const copy = orig.deepCopy();
      expect(copy.id).toBeTruthy();
      expect(copy.id).not.toBe('grp1');
      expect(copy.objectName).toBe('');
      expect(copy.width).toBe(300);
      expect(copy.height).toBe(200);
      expect(copy.groupName).toBe('Effects');
      expect(copy.borderColor).toBe('#FF0000');
      expect(copy.font).toEqual({ name: 'Verdana', size: 14, style: 0 });
      expect(copy.font).not.toBe(orig.font);

      const copyChildren = copy.getChildren();
      expect(copyChildren).toHaveLength(2);

      const copiedSlider = copyChildren[0] as BSBHSlider;
      expect(copiedSlider.objectName).toBe('innerSlider');
      expect(copiedSlider.value).toBe(0.5);
      expect(copiedSlider.id).toBeTruthy();
      expect(copiedSlider.id).not.toBe('child1');

      const copiedNested = copyChildren[1] as BSBGroup;
      expect(copiedNested.groupName).toBe('Sub');
      expect(copiedNested.id).toBeTruthy();
      expect(copiedNested.id).not.toBe('nested1');
      const nestedChildren = copiedNested.getChildren();
      expect(nestedChildren).toHaveLength(1);
      const copiedDeep = nestedChildren[0] as BSBCheckBox;
      expect(copiedDeep.objectName).toBe('deepCheck');
      expect(copiedDeep.selected).toBe(true);
      expect(copiedDeep.id).toBeTruthy();
      expect(copiedDeep.id).not.toBe('deep1');

      copiedSlider.value = 0;
      expect((orig.getChildren()[0] as BSBHSlider).value).toBe(0.5);
    });

    it('deep copies all 16 widget types', () => {
      const types: [new () => any, string][] = [
        [BSBHSlider, 'hslider'],
        [BSBVSlider, 'vslider'],
        [BSBKnob, 'knob'],
        [BSBCheckBox, 'checkbox'],
        [BSBLabel, 'label'],
        [BSBTextField, 'textfield'],
        [BSBDropdown, 'dropdown'],
        [BSBSubChannelDropdown, 'subdropdown'],
        [BSBValue, 'value'],
        [BSBXYController, 'xy'],
        [BSBGroup, 'group'],
        [BSBFileSelector, 'fileselector'],
        [BSBLineObject, 'lineobject'],
        [BSBHSliderBank, 'hsliderbank'],
        [BSBVSliderBank, 'vsliderbank'],
      ];
      for (const [Ctor, name] of types) {
        const w = new Ctor();
        w.id = `${name}-id`;
        w.objectName = name;
        w.x = 10;
        w.y = 20;
        w.value = 0.5;
        const copy = w.deepCopy();
        expect(copy.id).toBeTruthy();
        expect(copy.id).not.toBe(`${name}-id`);
        expect(copy.objectName).toBe(name);
        expect(copy.x).toBe(10);
        expect(copy.y).toBe(20);
        expect(copy.value).toBe(0.5);
        expect(copy).not.toBe(w);
      }
    });
  });
});
