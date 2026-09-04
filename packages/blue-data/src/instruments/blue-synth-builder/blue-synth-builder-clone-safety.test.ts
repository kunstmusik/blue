import { describe, expect, it } from 'vitest';

import { Element } from '../../serialization/xml-reader';
import { BlueSynthBuilder } from '../blue-synth-builder';
import { BSBDropdown } from './bsb-dropdown';
import { BSBKnob } from './bsb-knob';
import { collectBsbWidgetIds, collectBsbWidgets } from './bsb-identity';

function buildInstrumentXml({
  graphicInterface,
  parameterList = '<parameterList/>',
  presetGroup = '',
  opcodeList = '<opcodeList/>',
  instrumentText = 'instr 1\n  outc 0.5, 0.5\nendin',
}: {
  graphicInterface: string;
  parameterList?: string;
  presetGroup?: string;
  opcodeList?: string;
  instrumentText?: string;
}): string {
  return `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
    <name>Clone Safety</name>
    <comment></comment>
    <globalOrc></globalOrc>
    <globalSco></globalSco>
    <instrumentText>${instrumentText}</instrumentText>
    <alwaysOnInstrumentText></alwaysOnInstrumentText>
    <graphicInterface>${graphicInterface}</graphicInterface>
    ${parameterList}
    ${presetGroup}
    ${opcodeList}
  </instrument>`;
}

function loadBuilder(xml: string): BlueSynthBuilder {
  return BlueSynthBuilder.loadFromXML(Element.parse(xml));
}

function createExplicitIdBuilder(): BlueSynthBuilder {
  return loadBuilder(
    buildInstrumentXml({
      graphicInterface: `
      <bsbObject type="blue.orchestra.blueSynthBuilder.BSBGroup" uniqueId="root-group">
        <groupName>Root</groupName>
        <x>0</x>
        <y>0</y>
        <width>400</width>
        <height>300</height>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="widget-knob">
          <objectName>gain</objectName>
          <x>10</x>
          <y>20</y>
          <knobWidth>72</knobWidth>
          <value>0.5</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
          <automationAllowed>true</automationAllowed>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBGroup" uniqueId="group-one">
        <groupName>Nested</groupName>
        <x>50</x>
        <y>60</y>
        <width>180</width>
        <height>120</height>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBDropdown" version="2" uniqueId="widget-dropdown">
          <objectName>choice</objectName>
          <x>8</x>
          <y>12</y>
          <selectedIndex>1</selectedIndex>
          <automationAllowed>true</automationAllowed>
          <bsbDropdownItemList>
            <bsbDropdownItem uniqueId="item-a">
              <name>Alpha</name>
              <value>a</value>
            </bsbDropdownItem>
            <bsbDropdownItem uniqueId="item-b">
              <name>Beta</name>
              <value>b</value>
            </bsbDropdownItem>
          </bsbDropdownItemList>
        </bsbObject>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank" uniqueId="widget-bank">
          <objectName>bank</objectName>
          <x>120</x>
          <y>140</y>
          <minimum>0</minimum>
          <maximum>1</maximum>
          <sliderWidth>120</sliderWidth>
          <gap>5</gap>
          <automationAllowed>true</automationAllowed>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider" version="2" uniqueId="bank-slider-0">
            <objectName>bank_0</objectName>
            <value>0.2</value>
          </bsbObject>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider" version="2" uniqueId="bank-slider-1">
            <objectName>bank_1</objectName>
            <value>0.8</value>
          </bsbObject>
        </bsbObject>
      </bsbObject>`,
      parameterList: `<parameterList>
      <parameter uniqueId="gain-param" name="gain" label="Gain" min="0.0" max="1.0" automationEnabled="true" value="0.5">
        <line>
          <linePoint x="0.0" y="0.5"/>
          <linePoint x="1.0" y="0.75"/>
        </line>
      </parameter>
      <parameter uniqueId="choice-param" name="choice" label="Choice" min="0.0" max="1.0" automationEnabled="false" value="1.0">
        <line>
          <linePoint x="0.0" y="1.0"/>
        </line>
      </parameter>
      <parameter uniqueId="bank-0-param" name="bank_0" label="Bank 0" min="0.0" max="1.0" automationEnabled="false" value="0.2">
        <line>
          <linePoint x="0.0" y="0.2"/>
        </line>
      </parameter>
      <parameter uniqueId="bank-1-param" name="bank_1" label="Bank 1" min="0.0" max="1.0" automationEnabled="false" value="0.8">
        <line>
          <linePoint x="0.0" y="0.8"/>
        </line>
      </parameter>
    </parameterList>`,
      presetGroup: `<presetGroup name="Presets" currentPresetUniqueId="preset-1">
      <preset name="Default" uniqueId="preset-1">
        <setting name="gain">ver2:0.5</setting>
        <setting name="choice">id:item-b</setting>
      </preset>
    </presetGroup>`,
      opcodeList: `<opcodeList>
      <udo>
        <style>MODERN</style>
        <opcodeName>clipper</opcodeName>
        <outTypes>a</outTypes>
        <inputArguments>aSig, kAmt</inputArguments>
        <codeBody>aOut = tanh(aSig * kAmt)\nxout aOut</codeBody>
        <comments></comments>
      </udo>
    </opcodeList>`,
      instrumentText: 'instr 1\n  outc &lt;gain&gt;, &lt;gain&gt;\nendin',
    }),
  );
}

function getWidgetIds(builder: BlueSynthBuilder): string[] {
  return collectBsbWidgetIds(builder.getGraphicInterface().getRootGroup());
}

function getParameterIds(builder: BlueSynthBuilder): string[] {
  return builder.getParameters().map((parameter) => parameter.getUniqueId());
}

function getFirstDropdown(builder: BlueSynthBuilder): BSBDropdown {
  const dropdown = collectBsbWidgets(builder.getGraphicInterface().getRootGroup()).find(
    (widget) => widget instanceof BSBDropdown,
  );
  if (!(dropdown instanceof BSBDropdown)) {
    throw new Error('Expected dropdown widget');
  }
  return dropdown;
}

describe('BlueSynthBuilder clone safety', () => {
  it('creates new widgets with ids that do not collide with explicit loaded ids', () => {
    const builder = loadBuilder(
      buildInstrumentXml({
        graphicInterface: `
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <id>w1</id>
          <objectName>gain</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>`,
      }),
    );

    const graphicInterface = builder.getGraphicInterface();
    const widget = graphicInterface.createWidgetByType('BSBLabel');
    if (!widget) {
      throw new Error('Expected widget factory to create a BSBLabel');
    }
    graphicInterface.getRootGroup().addChild(widget);

    const ids = getWidgetIds(builder);
    expect(widget.id).toBeTruthy();
    expect(widget.id).not.toBe('w1');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns unique editing ids to legacy widgets that load without ids', () => {
    const builder = loadBuilder(
      buildInstrumentXml({
        graphicInterface: `
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <objectName>gain</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBGroup">
          <groupName>Nested</groupName>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
            <objectName>nested</objectName>
            <value>0.25</value>
            <minimum>0</minimum>
            <maximum>1</maximum>
          </bsbObject>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank">
          <objectName>bank</objectName>
          <minimum>0</minimum>
          <maximum>1</maximum>
          <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider" version="2">
            <objectName>bank_0</objectName>
            <value>0.1</value>
          </bsbObject>
        </bsbObject>`,
      }),
    );

    const ids = getWidgetIds(builder);

    expect(ids).not.toContain('');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('repairs duplicate loaded widget ids before exposing the interface for editing', () => {
    const builder = loadBuilder(
      buildInstrumentXml({
        graphicInterface: `
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <id>dup</id>
          <objectName>gain</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <id>dup</id>
          <objectName>gain2</objectName>
          <x>20</x>
          <y>30</y>
          <value>0.25</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>`,
      }),
    );

    const widgets = collectBsbWidgets(builder.getGraphicInterface().getRootGroup()) as BSBKnob[];
    const ids = getWidgetIds(builder);

    expect(widgets[0].id).toBe('dup');
    expect(widgets[1].id).toBeTruthy();
    expect(widgets[1].id).not.toBe('dup');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps widget-targeted edits isolated after duplicate-id repair', () => {
    const builder = loadBuilder(
      buildInstrumentXml({
        graphicInterface: `
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <id>dup</id>
          <objectName>gain</objectName>
          <x>10</x>
          <y>20</y>
          <value>0.5</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>
        <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
          <id>dup</id>
          <objectName>gain2</objectName>
          <x>20</x>
          <y>30</y>
          <value>0.25</value>
          <minimum>0</minimum>
          <maximum>1</maximum>
        </bsbObject>`,
      }),
    );

    const [first, second] = collectBsbWidgets(
      builder.getGraphicInterface().getRootGroup(),
    ) as BSBKnob[];

    expect(builder.updateWidgetProperties(first.id, { objectName: 'lead', value: 0.75 })).toBe(
      true,
    );
    expect(first.objectName).toBe('lead');
    expect(first.value).toBe(0.75);
    expect(second.objectName).toBe('gain2');
    expect(second.value).toBe(0.25);

    expect(builder.getGraphicInterface().removeWidget(second.id)).toBe(true);
    expect(builder.getGraphicInterface().findWidgetById(first.id)).toBe(first);
    expect(builder.getGraphicInterface().findWidgetById(second.id)).toBeNull();
  });

  it('rekeys all duplicated BSB identities while preserving musical content', () => {
    const original = createExplicitIdBuilder();
    const duplicate = original.deepCopy() as BlueSynthBuilder;
    const duplicateDropdownIds = getFirstDropdown(duplicate).dropdownItems.map(
      (item) => item.uniqueId,
    );
    const duplicatePreset = duplicate.getPresetGroup()?.getPresets()[0];

    expect(getWidgetIds(duplicate)).not.toEqual(getWidgetIds(original));
    expect(getParameterIds(duplicate)).not.toEqual(getParameterIds(original));
    expect(new Set(getWidgetIds(duplicate)).size).toBe(getWidgetIds(duplicate).length);
    expect(new Set(getParameterIds(duplicate)).size).toBe(getParameterIds(duplicate).length);

    expect(
      collectBsbWidgets(duplicate.getGraphicInterface().getRootGroup()).map(
        (widget) => widget.objectName,
      ),
    ).toEqual(
      collectBsbWidgets(original.getGraphicInterface().getRootGroup()).map(
        (widget) => widget.objectName,
      ),
    );
    expect(duplicate.getParameters().map((parameter) => parameter.getName())).toEqual(
      original.getParameters().map((parameter) => parameter.getName()),
    );
    expect(duplicate.getParameters().map((parameter) => parameter.getPoints())).toEqual(
      original.getParameters().map((parameter) => parameter.getPoints()),
    );

    expect(duplicateDropdownIds).not.toEqual(['item-a', 'item-b']);
    expect(new Set(duplicateDropdownIds).size).toBe(duplicateDropdownIds.length);
    expect(duplicatePreset?.getUniqueId()).toBeTruthy();
    expect(duplicatePreset?.getUniqueId()).not.toBe('preset-1');
    expect(duplicate.getPresetGroup()?.getCurrentPresetUniqueId()).toBe(
      duplicatePreset?.getUniqueId(),
    );
    expect(duplicatePreset?.getValue('choice')).toBe(`id:${duplicateDropdownIds[1]}`);
    expect(original.getPresetGroup()?.getPresets()[0]?.getValue('choice')).toBe('id:item-b');
  });

  it('keeps sibling duplicates isolated when patching by widget id', () => {
    const original = createExplicitIdBuilder();
    const duplicate = original.deepCopy() as BlueSynthBuilder;

    const duplicateKnob = collectBsbWidgets(duplicate.getGraphicInterface().getRootGroup()).find(
      (widget) => widget instanceof BSBKnob && widget.objectName === 'gain',
    );
    const originalKnob = collectBsbWidgets(original.getGraphicInterface().getRootGroup()).find(
      (widget) => widget instanceof BSBKnob && widget.objectName === 'gain',
    );

    if (!(duplicateKnob instanceof BSBKnob) || !(originalKnob instanceof BSBKnob)) {
      throw new Error('Expected both builder trees to contain a gain knob');
    }

    expect(
      duplicate.updateWidgetProperties(duplicateKnob.id, { objectName: 'gain_copy', value: 0.9 }),
    ).toBe(true);

    expect(duplicateKnob.objectName).toBe('gain_copy');
    expect(duplicateKnob.value).toBe(0.9);
    expect(originalKnob.objectName).toBe('gain');
    expect(originalKnob.value).toBe(0.5);
  });

  it('preserves explicit identities through ordinary load and save', () => {
    const original = createExplicitIdBuilder();
    const savedXml = original.saveAsXML().toXml();
    const reloaded = BlueSynthBuilder.loadFromXML(Element.parse(savedXml));

    expect(savedXml).toContain('uniqueId="widget-knob"');
    expect(savedXml).toContain('uniqueId="widget-dropdown"');
    expect(savedXml).toContain('uniqueId="bank-slider-0"');
    expect(savedXml).toContain('uniqueId="gain-param"');
    expect(savedXml).toContain('uniqueId="preset-1"');
    expect(savedXml).toContain('uniqueId="item-a"');
    expect(savedXml).toContain('<setting name="choice">id:item-b</setting>');

    expect(getWidgetIds(reloaded)).toEqual(getWidgetIds(original));
    expect(getParameterIds(reloaded)).toEqual(getParameterIds(original));
    expect(getFirstDropdown(reloaded).dropdownItems.map((item) => item.uniqueId)).toEqual([
      'item-a',
      'item-b',
    ]);
    expect(reloaded.getPresetGroup()?.getCurrentPresetUniqueId()).toBe('preset-1');
  });
});
