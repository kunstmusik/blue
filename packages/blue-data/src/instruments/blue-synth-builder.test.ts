import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { assignParameterNames } from '../automation/parameter-helper';
import { BlueSynthBuilder } from './blue-synth-builder';
import { UDOStyle } from '../opcodes/udo-style';
import { BSBCheckBox } from './blue-synth-builder/bsb-check-box';
import { BSBDropdown } from './blue-synth-builder/bsb-dropdown';
import { BSBFileSelector } from './blue-synth-builder/bsb-file-selector';
import { BSBGroup } from './blue-synth-builder/bsb-group';
import { BSBHSlider } from './blue-synth-builder/bsb-hslider';
import { BSBHSliderBank } from './blue-synth-builder/bsb-hslider-bank';
import { BSBKnob } from './blue-synth-builder/bsb-knob';
import { BSBLabel } from './blue-synth-builder/bsb-label';
import {
  BSBLineObject,
  createDefaultBsbLine,
  normalizeBsbLinePatch,
} from './blue-synth-builder/bsb-line-object';
import { BSBVSlider } from './blue-synth-builder/bsb-vslider';
import { BSBVSliderBank } from './blue-synth-builder/bsb-vslider-bank';

describe('BlueSynthBuilder', () => {
  it('uses Java Blue default instrument name', () => {
    expect(new BlueSynthBuilder().getName()).toBe('untitled');
  });

  it('preserves loaded graphic interface XML and opcode lists', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Builder</name>
      <comment>builder comment</comment>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" uniqueId="amp-id">
          <objectName>amp</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const savedXml = instrument.saveAsXML().toXml();

    expect(instrument.getName()).toBe('Builder');
    expect(instrument.getComment()).toBe('builder comment');
    expect(savedXml).toContain('<graphicInterface>');
    expect(savedXml).toContain('blue.orchestra.blueSynthBuilder.BSBKnob');
    expect(savedXml).toContain('<objectName>amp</objectName>');
    expect(savedXml).toContain('<opcodeList/>');
  });

  it('updates loaded widget values and serializes the edited interface', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Builder</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>amp</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    expect(instrument.updateWidgetValue('amp', 0.75)).toBe(true);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<objectName>amp</objectName>');
    expect(savedXml).toContain('<value>0.75</value>');
  });

  it('keeps widget ids stable across XML round-trips', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Stable Ids</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>amp</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const firstId = instrument.getGraphicInterface().getRootGroup().getChildren()[0]?.id;
    const savedXml = instrument.saveAsXML().toXml();

    const reloaded = BlueSynthBuilder.loadFromXML(Element.parse(savedXml));
    const secondId = reloaded.getGraphicInterface().getRootGroup().getChildren()[0]?.id;

    expect(firstId).toBeTruthy();
    expect(savedXml).toContain(`uniqueId="${firstId}"`);
    expect(savedXml).not.toContain('<id>');
    expect(secondId).toBe(firstId);
  });

  it('loads persisted widget uniqueIds from XML when present', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Explicit Id</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" uniqueId="knob1-id">
          <objectName>amp</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    expect(instrument.getGraphicInterface().getRootGroup().getChildren()[0]?.id).toBe('knob1-id');
  });

  it('still accepts legacy child id elements for widget identity', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Legacy Id</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <id>legacy-knob-id</id>
          <objectName>amp</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    expect(instrument.getGraphicInterface().getRootGroup().getChildren()[0]?.id).toBe('legacy-knob-id');

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('uniqueId="legacy-knob-id"');
    expect(savedXml).not.toContain('<id>legacy-knob-id</id>');
  });

  it('accepts widget patches using ids persisted through save and reload', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Patch By Id</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>amp</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const initial = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widgetId = initial.getGraphicInterface().getRootGroup().getChildren()[0]?.id ?? '';
    const savedXml = initial.saveAsXML().toXml();

    const reparsed = BlueSynthBuilder.loadFromXML(Element.parse(savedXml));
    expect(reparsed.updateWidgetProperties(widgetId, { objectName: 'gain' })).toBe(true);
    expect(reparsed.getGraphicInterface().getRootGroup().getChildren()[0]?.objectName).toBe('gain');
  });

  it('synthesizes missing BSB parameters from automatable widgets', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Generated Params</name>
      <instrumentText>&lt;knob&gt;\n&lt;bank_0&gt;\n&lt;bank_1&gt;\n&lt;padX&gt;\n&lt;padY&gt;\n&lt;env_curve&gt;</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <objectName>knob</objectName>
          <x>0</x><y>0</y>
          <automationAllowed>true</automationAllowed>
          <minimum>0</minimum><maximum>1</maximum>
          <value>0.25</value>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank">
          <objectName>bank</objectName>
          <x>0</x><y>0</y>
          <automationAllowed>true</automationAllowed>
          <minimum>0</minimum><maximum>1</maximum>
          <bdresolution>0.1</bdresolution>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider" version="2">
            <objectName/>
            <x>0</x><y>0</y>
            <automationAllowed>true</automationAllowed>
            <minimum>0</minimum><maximum>1</maximum>
            <value>0.1</value>
            <bdresolution>0.1</bdresolution>
          </bsbObject>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider" version="2">
            <objectName/>
            <x>0</x><y>0</y>
            <automationAllowed>true</automationAllowed>
            <minimum>0</minimum><maximum>1</maximum>
            <value>0.2</value>
            <bdresolution>0.1</bdresolution>
          </bsbObject>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBXYController" version="2">
          <objectName>pad</objectName>
          <x>0</x><y>0</y>
          <automationAllowed>true</automationAllowed>
          <xValue>0.3</xValue>
          <yValue>0.7</yValue>
          <xMin>0</xMin><xMax>1</xMax>
          <yMin>0</yMin><yMax>1</yMax>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBLineObject">
          <objectName>env</objectName>
          <x>0</x><y>0</y>
          <lines>
            <line name="curve" varName="curve" version="2" max="1" min="0" bdresolution="-1" color="-8355712" rightBound="true" endPointsLinked="false">
              <linePoint x="0" y="0.2"/>
              <linePoint x="1" y="0.8"/>
            </line>
          </lines>
        </bsbObject>
      </graphicInterface>
      <parameterList/>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const parameterNames = instrument.getParameters().map((parameter) => parameter.getName());

    expect(parameterNames).toEqual(['knob', 'bank_0', 'bank_1', 'padX', 'padY']);
    expect(parameterNames).not.toContain('pad');
    expect(parameterNames).not.toContain('env_curve');

    assignParameterNames(instrument.getParameters());

    const rendered = instrument.generateInstrument();
    expect(rendered).toContain('gk_blue_auto0');
    expect(rendered).toContain('gk_blue_auto1');
    expect(rendered).toContain('gk_blue_auto2');
    expect(rendered).toContain('gk_blue_auto3');
    expect(rendered).toContain('gk_blue_auto4');
    expect(rendered).toContain('0.0 0.2 1 0.8');

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<parameterList>');
    expect(savedXml).toContain('name="knob"');
    expect(savedXml).toContain('name="bank_0"');
    expect(savedXml).toContain('name="bank_1"');
    expect(savedXml).toContain('name="padX"');
    expect(savedXml).toContain('name="padY"');
    expect(savedXml).not.toContain('name="pad"');
    expect(savedXml).not.toContain('name="env_curve"');
  });

  it('loads and saves preset groups with round-trip fidelity', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Preset Test</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>amp</objectName>
          <x>10</x><y>20</y>
          <value>0.5</value>
          <minimum>0</minimum><maximum>1</maximum>
        </bsbObject>
      </graphicInterface>
      <presetGroup name="My Presets" currentPresetUniqueId="p1">
        <preset name="Default" uniqueId="p1">
          <setting name="amp">ver2:0.8</setting>
        </preset>
      </presetGroup>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const pg = instrument.getPresetGroup();
    expect(pg).not.toBeNull();
    expect(pg!.getPresetGroupName()).toBe('My Presets');
    expect(pg!.getPresets()).toHaveLength(1);
    expect(pg!.getPresets()[0].getValue('amp')).toBe('ver2:0.8');

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('name="My Presets"');
    expect(savedXml).toContain('ver2:0.8');

    const reloaded = BlueSynthBuilder.loadFromXML(Element.parse(savedXml));
    expect(reloaded.getPresetGroup()!.getPresets()[0].getValue('amp')).toBe('ver2:0.8');
  });

  it('applies presets to update widget values', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Preset Apply</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>amp</objectName>
          <x>10</x><y>20</y>
          <value>0.5</value>
          <minimum>0</minimum><maximum>1</maximum>
        </bsbObject>
      </graphicInterface>
      <presetGroup name="Presets">
        <preset name="Loud" uniqueId="loud1">
          <setting name="amp">ver2:0.9</setting>
        </preset>
      </presetGroup>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    expect(instrument.applyPreset('loud1')).toBe(true);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<value>0.9</value>');
    expect(instrument.getPresetGroup()!.getCurrentPresetUniqueId()).toBe('loud1');
  });

  it('loads grid settings and editEnabled from graphic interface', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="false">
      <name>Grid Test</name>
      <instrumentText>code</instrumentText>
      <graphicInterface editEnabled="false">
        <gridSettings>
          <width>20</width>
          <height>20</height>
          <gridStyle>LINE</gridStyle>
          <snapGridEnabled>false</snapGridEnabled>
        </gridSettings>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>k1</objectName>
          <x>0</x><y>0</y>
          <value>0</value>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    expect(instrument.isEditEnabled()).toBe(false);
    expect(instrument.getGraphicInterface().isEditEnabled()).toBe(false);

    const gs = instrument.getGraphicInterface().getGridSettings();
    expect(gs.width).toBe(20);
    expect(gs.height).toBe(20);
    expect(gs.gridStyle).toBe('LINE');
    expect(gs.snapEnabled).toBe(false);
    expect(gs.enabled).toBe(true);
  });

  it('updates widget properties via updateWidgetProperties', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Prop Test</name>
      <instrumentText>aout oscili &lt;gain&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>gain</objectName>
          <x>10</x><y>20</y>
          <value>0.5</value>
          <minimum>0</minimum><maximum>1</maximum>
          <knobWidth>60</knobWidth>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const rootGroup = instrument.getGraphicInterface().getRootGroup();
    const widget = rootGroup.getChildren()[0]!;
    expect(widget).toBeDefined();

    expect(instrument.updateWidgetProperties(widget.id, { objectName: 'volume', x: 50 })).toBe(true);
    expect(widget.objectName).toBe('volume');
    expect(widget.x).toBe(50);
  });

  it('preserves preset group when performing widget edits', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Preserve Test</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>amp</objectName>
          <x>0</x><y>0</y><value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <presetGroup name="Presets">
        <preset name="A" uniqueId="pa">
          <setting name="amp">ver2:0.8</setting>
        </preset>
      </presetGroup>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0]!;
    instrument.updateWidgetProperties(widget.id, { value: 0.3 });

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('name="Presets"');
    expect(savedXml).toContain('ver2:0.8');
  });

  it('updates text field and file selector properties through widget patches', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>String Widgets</name>
      <instrumentText>Smsg sprintf \"%s %s\", \"&lt;textField&gt;\", \"&lt;fileSelect&gt;\"</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBTextField">
          <objectName>textField</objectName>
          <x>0</x><y>0</y>
          <value>hello</value>
          <textFieldWidth>120</textFieldWidth>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBFileSelector">
          <objectName>fileSelect</objectName>
          <x>0</x><y>40</y>
          <fileName>audio/test.wav</fileName>
          <textFieldWidth>150</textFieldWidth>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widgets = instrument.getGraphicInterface().getRootGroup().getChildren();
    const textField = widgets[0]!;
    const fileSelector = widgets[1]!;

    expect(instrument.updateWidgetProperties(textField.id, { textValue: 'updated text' })).toBe(true);
    expect(instrument.updateWidgetProperties(fileSelector.id, { fileName: 'samples/new.wav' })).toBe(true);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<value>updated text</value>');
    expect(savedXml).not.toContain('<textValue>updated text</textValue>');
    expect(savedXml).toContain('<fileName>samples/new.wav</fileName>');
  });

  it('serializes BSBValue defaultValue tags and applies raw preset values', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Value Preset</name>
      <instrumentText>kval = &lt;meter&gt;</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBValue">
          <objectName>meter</objectName>
          <x>0</x><y>0</y>
          <minimum>0</minimum>
          <maximum>1</maximum>
          <defaultValue>0.25</defaultValue>
        </bsbObject>
      </graphicInterface>
      <presetGroup name="Value Presets">
        <preset name="Hot" uniqueId="hot">
          <setting name="meter">0.75</setting>
        </preset>
      </presetGroup>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    expect(instrument.applyPreset('hot')).toBe(true);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<defaultValue>0.75</defaultValue>');
    expect(savedXml).not.toContain('<value>0.75</value>');
  });

  it('applies colon-separated slider bank presets to child slider values', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Bank Preset</name>
      <instrumentText>kout = &lt;bank_0&gt; + &lt;bank_1&gt;</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank">
          <objectName>bank</objectName>
          <x>0</x><y>0</y>
          <minimum>0</minimum>
          <maximum>1</maximum>
          <sliderWidth>120</sliderWidth>
          <gap>5</gap>
          <bdresolution>-1</bdresolution>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
            <objectName>bank_0</objectName>
            <value>0.2</value>
          </bsbObject>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
            <objectName>bank_1</objectName>
            <value>0.7</value>
          </bsbObject>
        </bsbObject>
      </graphicInterface>
      <presetGroup name="Bank Presets">
        <preset name="Alt" uniqueId="alt">
          <setting name="bank">0.15:0.85</setting>
        </preset>
      </presetGroup>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    expect(instrument.applyPreset('alt')).toBe(true);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<value>0.15</value>');
    expect(savedXml).toContain('<value>0.85</value>');
  });

  it('updates line object line data through widget patches', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Line Object</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBLineObject">
          <objectName>curve</objectName>
          <x>0</x><y>0</y>
          <canvasWidth>200</canvasWidth>
          <canvasHeight>120</canvasHeight>
          <lines>
            <line varName="curveA" min="0" max="1" color="#ff0000">
              <linePoint x="0" y="0.25"/>
              <linePoint x="1" y="0.75"/>
            </line>
          </lines>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0]!;

    expect(
      instrument.updateWidgetProperties(widget.id, {
        lines: [
          {
            varName: 'curveA',
            min: 0,
            max: 1,
            color: '#00ff00',
            points: [
              { x: 0, y: 0.2 },
              { x: 0.5, y: 0.5 },
              { x: 1, y: 0.8 },
            ],
          },
        ],
      }),
    ).toBe(true);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<lines>');
    expect(savedXml).toContain('<linePoint x="0.5" y="0.5"/>');
  });

  it('uses Java line defaults for new BSB LineObject lines', () => {
    const first = createDefaultBsbLine();
    const second = createDefaultBsbLine([first]);

    expect(first.varName).toBe('line0');
    expect(first.color).toBe('#20dd00');
    expect(first.rightBound).toBe(true);
    expect(first.points).toEqual([
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    ]);

    expect(second.varName).toBe('line1');
    expect(second.color).toBe('#0000ff');
  });

  it('normalizes patched BSB LineObject lines with unique Java-style names and linked endpoints', () => {
    const lines = normalizeBsbLinePatch([
      { varName: 'line0', color: '#808080', points: [{ x: 0, y: 0.25 }, { x: 1, y: 0.75 }] },
      { varName: 'line0', endPointsLinked: true, points: [{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }] },
      { points: [] },
    ]);

    expect(lines.map((line) => line.varName)).toEqual(['line0', 'line1', 'line2']);
    expect(lines[1].rightBound).toBe(true);
    expect(lines[1].points[1].y).toBe(0.2);
    expect(lines[2].color).toBe('#FFA500');
  });

  it('parses and saves Java-style BSB line metadata', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Java Line Object</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBLineObject">
          <objectName>curve</objectName>
          <x>0</x><y>0</y>
          <canvasWidth>200</canvasWidth>
          <canvasHeight>120</canvasHeight>
          <separatorType>COMMA</separatorType>
          <lines>
            <line name="env" varName="line0" version="2" max="1.0" min="0.0" bdresolution="-1" color="-65536" rightBound="false" endPointsLinked="false">
              <linePoint x="0.0" y="0.25"/>
              <linePoint x="1.0" y="0.75"/>
            </line>
          </lines>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0]! as any;
    expect(widget.lines[0].varName).toBe('env');
    expect(widget.lines[0].color).toBe('#FF0000');
    expect(widget.separatorType).toBe('Comma');

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<separatorType>COMMA</separatorType>');
    expect(savedXml).toContain('line name="env"');
    expect(savedXml).toContain('color="-65536"');
  });

  it('parses legacy text-encoded BSB line points', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Legacy Line Points</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBLineObject">
          <objectName>curve</objectName>
          <lines>
            <line name="legacy" min="0" max="1" color="#00ff00">
              <points>0,0.1 0.5,0.6 1,0.2</points>
            </line>
          </lines>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0]! as any;

    expect(widget.lines[0].varName).toBe('legacy');
    expect(widget.lines[0].points).toEqual([
      { x: 0, y: 0.1 },
      { x: 0.5, y: 0.6 },
      { x: 1, y: 0.2 },
    ]);
  });

  it('updates slider bank child values through slider bank patches', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Slider Bank</name>
      <instrumentText>aout = &lt;bank_0&gt; + &lt;bank_1&gt;</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank">
          <objectName>bank</objectName>
          <x>0</x><y>0</y>
          <minimum>0</minimum>
          <maximum>1</maximum>
          <sliderWidth>120</sliderWidth>
          <gap>5</gap>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
            <objectName>bank_0</objectName>
            <value>0.2</value>
          </bsbObject>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
            <objectName>bank_1</objectName>
            <value>0.7</value>
          </bsbObject>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0]!;

    expect(instrument.updateSliderBankValue(widget.id, 1, 0.42)).toBe(true);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<value>0.42</value>');
  });

  it('round-trips opcode list text', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>UDO Test</name>
      <instrumentText>code</instrumentText>
      <graphicInterface/>
      <opcodeList>
        <opcode name="myUDO">
          <signature>k,k</signature>
          <code>  xout a + b</code>
        </opcode>
      </opcodeList>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const text = instrument.getOpcodeListText();
    expect(text.length).toBeGreaterThan(0);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<opcodeList>');
  });

  it('converts instrument UDO styles using the shared utility semantics', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>UDO Convert</name>
      <instrumentText>code</instrumentText>
      <graphicInterface/>
      <opcodeList>
        <opcode>
          <opcodeName>saturate</opcodeName>
          <outTypes>a</outTypes>
          <inTypes>ak</inTypes>
          <style>CLASSIC</style>
          <codeBody>aSig, kDrive	xin
aOut = tanh(aSig * kDrive)
xout aOut</codeBody>
        </opcode>
      </opcodeList>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));

    expect(instrument.convertUdoStyle(0, UDOStyle.MODERN)).toBe(true);
    let udo = instrument.getOpcodeList().getOpcode(0);
    expect(udo?.getStyle()).toBe(UDOStyle.MODERN);
    expect(udo?.getInputArguments()).toBe('aSig, kDrive');
    expect(udo?.getInTypes()).toBe('');
    expect(udo?.getCode()).not.toContain('xin');

    expect(instrument.convertUdoStyle(0, UDOStyle.CLASSIC)).toBe(true);
    udo = instrument.getOpcodeList().getOpcode(0);
    expect(udo?.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(udo?.getInputArguments()).toBe('');
    expect(udo?.getInTypes()).toBe('ak');
    expect(udo?.getCode()).toContain('aSig, kDrive\txin');
  });

  it('preserves graphic interface XML through edit cycles', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Preserve</name>
      <instrumentText>aout oscili &lt;amp&gt;, 440</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>amp</objectName>
          <x>10</x><y>20</y>
          <value>0.5</value>
          <minimum>0</minimum><maximum>1</maximum>
          <knobWidth>60</knobWidth>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    instrument.updateWidgetValue('amp', 0.9);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('BSBKnob');
    expect(savedXml).toContain('amp');
    expect(savedXml).toContain('0.9');
    expect(savedXml).toContain('knobWidth');
  });

  it('preserves preset data when performing interface edits', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Preserve Presets</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>k1</objectName>
          <x>0</x><y>0</y><value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <presetGroup name="Bank">
        <preset name="A" uniqueId="pa">
          <setting name="k1">ver2:0.8</setting>
        </preset>
        <presetGroup name="Sub">
          <preset name="B" uniqueId="pb">
            <setting name="k1">ver2:0.3</setting>
          </preset>
        </presetGroup>
      </presetGroup>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0]!;
    instrument.updateWidgetProperties(widget.id, { objectName: 'k1_renamed' });

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('name="Bank"');
    expect(savedXml).toContain('name="Sub"');
    expect(savedXml).toContain('ver2:0.8');
    expect(savedXml).toContain('ver2:0.3');
  });

  it('rescales widget and automation parameter values when widget bounds change', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Range Rescale</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="gain-id">
          <objectName>gain</objectName>
          <x>0</x><y>0</y>
          <automationAllowed>true</automationAllowed>
          <value>0.5</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>
      </graphicInterface>
      <parameterList>
        <parameter uniqueId="gain-param" name="gain" min="0.0" max="1.0" automationEnabled="false">
          <line>
            <linePoint x="0.0" y="0.5"/>
            <linePoint x="1.0" y="0.5"/>
          </line>
        </parameter>
      </parameterList>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0] as BSBKnob;

    expect(instrument.updateWidgetProperties(widget.id, { maximum: 10 })).toBe(true);

    const parameter = instrument.getParameters().find((candidate) => candidate.getName() === 'gain');
    expect(widget.value).toBe(5);
    expect(parameter?.getMaximum()).toBe(10);
    expect(parameter?.getFixedValue()).toBe(5);
    expect(parameter?.getPoints()).toEqual([
      { time: 0, value: 5 },
      { time: 1, value: 5 },
    ]);
  });

  it('exposes Java default constructor values for the common BSB widgets', () => {
    const label = new BSBLabel();
    const knob = new BSBKnob();
    const fileSelector = new BSBFileSelector();
    const hSlider = new BSBHSlider();
    const vSlider = new BSBVSlider();
    const hBank = new BSBHSliderBank();
    const vBank = new BSBVSliderBank();
    const dropdown = new BSBDropdown();
    const group = new BSBGroup();

    expect(label.label).toBe('label');

    expect(knob.labelEnabled).toBe(true);
    expect(fileSelector.stringChannelEnabled).toBe(true);

    expect(hSlider.sliderWidth).toBe(150);
    expect(vSlider.sliderHeight).toBe(150);

    expect(hBank.sliderWidth).toBe(150);
    expect(hBank.numberOfSliders).toBe(1);
    expect(hBank.sliders).toHaveLength(1);

    expect(vBank.sliderHeight).toBe(150);
    expect(vBank.numberOfSliders).toBe(1);
    expect(vBank.sliders).toHaveLength(1);

    expect(dropdown.fontSize).toBe(12);
    dropdown.setFontSize(99);
    expect(dropdown.fontSize).toBe(36);
    dropdown.setFontSize(7);
    expect(dropdown.fontSize).toBe(8);

    expect(group.backgroundColor).toBe('rgba(0,0,0,0.2)');
    expect(group.borderColor).toBe('#000000');
    expect(group.labelTextColor).toBe('#FFFFFF');
  });

  it('keeps legacy XML fallback values for label and string-channel flags', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Legacy Flags</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>gain</objectName>
          <label>Gain</label>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBFileSelector">
          <objectName>file</objectName>
          <fileName>test.wav</fileName>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBCheckBox">
          <objectName>gate</objectName>
          <selected>true</selected>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widgets = instrument.getGraphicInterface().getRootGroup().getChildren();
    const knob = widgets[0] as BSBKnob;
    const fileSelector = widgets[1] as BSBFileSelector;
    const checkbox = widgets[2] as BSBCheckBox;

    expect(knob.labelEnabled).toBe(false);
    expect(fileSelector.stringChannelEnabled).toBe(false);
    expect(checkbox.selected).toBe(true);
    expect(checkbox.value).toBe(1);
  });

  it('round-trips group colors through Java-compatible XML encoding', () => {
    const group = new BSBGroup();
    group.groupName = 'Color Group';
    group.backgroundColor = '#102030';
    group.borderColor = '#445566';
    group.labelTextColor = '#778899';

    const xml = group.saveAsXML().toXml();
    expect(xml).toContain('<backgroundColor>0x102030ff</backgroundColor>');
    expect(xml).toContain('<borderColor>0x445566ff</borderColor>');
    expect(xml).toContain('<labelTextColor>0x778899ff</labelTextColor>');

    const reloaded = new BSBGroup();
    reloaded.loadFromXML(Element.parse(xml));
    expect(reloaded.backgroundColor).toBe('#102030');
    expect(reloaded.borderColor).toBe('#445566');
    expect(reloaded.labelTextColor).toBe('#778899');
  });

  it('rounds integer-shaped BSB geometry before serializing XML', () => {
    const group = new BSBGroup();
    group.x = 68.9140625;
    group.y = 12.4;
    group.width = 120.6;
    group.height = 45.5;

    const knob = new BSBKnob();
    knob.objectName = 'gain';
    knob.x = 10.49;
    knob.y = 20.5;
    knob.knobWidth = 60.9;

    const dropdown = new BSBDropdown();
    dropdown.objectName = 'choice';
    dropdown.x = 5.2;
    dropdown.y = 6.8;
    dropdown.selectedIndex = 1.6;
    dropdown.fontSize = 12.9;

    group.addChild(knob);
    group.addChild(dropdown);

    const xml = group.saveAsXML().toXml();

    expect(xml).not.toContain('68.9140625');
    expect(xml).toContain('<x>69</x>');
    expect(xml).toContain('<y>12</y>');
    expect(xml).toContain('<width>121</width>');
    expect(xml).toContain('<height>46</height>');
    expect(xml).toContain('<knobWidth>61</knobWidth>');
    expect(xml).toContain('<selectedIndex>2</selectedIndex>');
    expect(xml).toContain('<fontSize>13</fontSize>');

    const reloaded = new BSBGroup();
    reloaded.loadFromXML(Element.parse(xml));
    expect(reloaded.getChildren()).toHaveLength(2);
    const [reloadedKnob, reloadedDropdown] = reloaded.getChildren() as [BSBKnob, BSBDropdown];

    expect(reloaded.x).toBe(69);
    expect(reloaded.y).toBe(12);
    expect(reloaded.width).toBe(121);
    expect(reloaded.height).toBe(46);
    expect(reloadedKnob.x).toBe(10);
    expect(reloadedKnob.y).toBe(21);
    expect(reloadedKnob.knobWidth).toBe(61);
    expect(reloadedDropdown.x).toBe(5);
    expect(reloadedDropdown.y).toBe(7);
    expect(reloadedDropdown.selectedIndex).toBe(2);
    expect(reloadedDropdown.fontSize).toBe(13);
  });

  it('preserves dropdown uniqueIds and font size clamps through widget patches', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Dropdown Test</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBDropdown">
          <objectName>choice</objectName>
          <x>0</x><y>0</y>
          <selectedIndex>0</selectedIndex>
          <fontSize>99</fontSize>
          <bsbDropdownItemList>
            <bsbDropdownItem uniqueId="item-a">
              <name>Alpha</name>
              <value>a</value>
            </bsbDropdownItem>
          </bsbDropdownItemList>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0] as BSBDropdown;
    expect(widget.fontSize).toBe(36);

    expect(
      instrument.updateWidgetProperties(widget.id, {
        dropdownItems: [
          { name: 'Alpha', value: 'a', uniqueId: 'item-a' },
          { name: 'Beta', value: 'b' },
        ],
      }),
    ).toBe(true);

    expect(widget.dropdownItems[0].uniqueId).toBe('item-a');
    expect(widget.dropdownItems[1].uniqueId).toMatch(/^dropdown-/);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('uniqueId="item-a"');
    expect(savedXml).toContain('<fontSize>36</fontSize>');
  });

  it('migrates every legacy Java stripHTML path during builder loads', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Legacy HTML</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBLabel">
          <objectName></objectName>
          <x>0</x><y>0</y>
          <label>&lt;html&gt;&lt;font size=&quot;+1&quot;&gt;Amp&amp;nbsp;Env&lt;/font&gt;&lt;/html&gt;</label>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBDropdown">
          <objectName>choice</objectName>
          <x>0</x><y>24</y>
          <selectedIndex>0</selectedIndex>
          <bsbDropdownItemList>
            <bsbDropdownItem uniqueId="item-a">
              <name>&lt;html&gt;&lt;font size=&quot;+1&quot;&gt;Mode A&lt;/font&gt;&lt;/html&gt;</name>
              <value>a</value>
            </bsbDropdownItem>
            <bsbDropdownItem uniqueId="item-b">
              <name>&lt;html&gt;&lt;b&gt;Mode B&lt;/b&gt;&lt;/html&gt;</name>
              <value>b</value>
            </bsbDropdownItem>
          </bsbDropdownItemList>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widgets = instrument.getGraphicInterface().getRootGroup().getChildren();
    const label = widgets[0] as BSBLabel;
    const dropdown = widgets[1] as BSBDropdown;

    expect(label.label).toBe('Amp Env');
    expect(label.font).toEqual({ name: 'Roboto', size: 18, style: 1 });
    expect(dropdown.fontSize).toBe(18);
    expect(dropdown.dropdownItems.map((item) => item.name)).toEqual(['Mode A', 'Mode B']);

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<label>Amp Env</label>');
    expect(savedXml).toContain('<name>Roboto</name>');
    expect(savedXml).toContain('<size>18.0</size>');
    expect(savedXml).toContain('<style>1</style>');
    expect(savedXml).toContain('<name>Mode A</name>');
    expect(savedXml).toContain('<name>Mode B</name>');
    expect(savedXml).not.toContain('&lt;html&gt;');
  });

  it('keeps label font patches durable across later widget updates', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Font Test</name>
      <instrumentText>code</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob">
          <objectName>gain</objectName>
          <x>0</x><y>0</y>
          <value>0.5</value>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const widget = instrument.getGraphicInterface().getRootGroup().getChildren()[0] as BSBKnob;

    expect(
      instrument.updateWidgetProperties(widget.id, {
        'labelFont.name': 'Georgia',
        'labelFont.size': 16,
        'labelFont.style': 1,
      }),
    ).toBe(true);

    expect(
      instrument.updateWidgetProperties(widget.id, {
        value: 0.75,
      }),
    ).toBe(true);

    expect(widget.labelFont).toEqual({ name: 'Georgia', size: 16, style: 1 });

    const savedXml = instrument.saveAsXML().toXml();
    expect(savedXml).toContain('<font>');
    expect(savedXml).toContain('<name>Georgia</name>');
    expect(savedXml).toContain('<size>16.0</size>');
    expect(savedXml).toContain('<style>1</style>');
  });

  it('keeps slider-bank child counts and derived replacement keys aligned', () => {
    const xml = `<instrument type="blue.orchestra.BlueSynthBuilder">
      <name>Bank Keys</name>
      <instrumentText>aout = &lt;bank_0&gt; + &lt;bank_1&gt; + &lt;bank_2&gt;</instrumentText>
      <graphicInterface>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank">
          <objectName>bank</objectName>
          <x>0</x><y>0</y>
          <minimum>0</minimum>
          <maximum>1</maximum>
          <sliderWidth>120</sliderWidth>
          <gap>5</gap>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
            <objectName>bank_0</objectName>
            <value>0.1</value>
          </bsbObject>
        </bsbObject>
      </graphicInterface>
      <opcodeList/>
    </instrument>`;

    const instrument = BlueSynthBuilder.loadFromXML(Element.parse(xml));
    const bank = instrument.getGraphicInterface().getRootGroup().getChildren()[0] as BSBHSliderBank;

    expect(bank.sliders).toHaveLength(1);

    expect(
      instrument.updateWidgetProperties(bank.id, {
        numberOfSliders: 3,
      }),
    ).toBe(true);

    expect(bank.sliders).toHaveLength(3);
    bank.sliders[0].setValue(0.1);
    bank.sliders[1].setValue(0.2);
    bank.sliders[2].setValue(0.3);

    expect(bank.getPresetValue()).toBe('0.1:0.2:0.3');
    expect(instrument.generateInstrument()).toBe('aout = 0.1 + 0.2 + 0.3');
  });
});
