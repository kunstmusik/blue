import { describe, expect, it } from 'vitest';
import { Parameter } from '../../automation/parameter';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { BSBCheckBox } from './bsb-check-box';
import { BSBDropdown } from './bsb-dropdown';
import { BSBFileSelector } from './bsb-file-selector';
import { BSBGroup } from './bsb-group';
import { BSBHSlider } from './bsb-hslider';
import { BSBHSliderBank } from './bsb-hslider-bank';
import { BSBKnob } from './bsb-knob';
import { BSBLabel } from './bsb-label';
import { BSBLineObject } from './bsb-line-object';
import { BSBSubChannelDropdown } from './bsb-subchannel-dropdown';
import { BSBTextField } from './bsb-text-field';
import { BSBValue } from './bsb-value';
import { BSBVSlider } from './bsb-vslider';
import { BSBVSliderBank } from './bsb-vslider-bank';
import { BSBXYController } from './bsb-xy-controller';

function createParameter(name: string, compilationVarName: string): Parameter {
  const parameter = new Parameter();
  parameter.setName(name);
  parameter.setCompilationVarName(compilationVarName);
  return parameter;
}

function compileTemplate(template: string, configure: (unit: BSBCompilationUnit) => void): string {
  const unit = new BSBCompilationUnit();
  configure(unit);
  return unit.replaceBSBValues(template);
}

describe('BSB compilation replacements', () => {
  it('uses parameter-backed replacements for single-value numeric widgets', () => {
    const numericWidgets = [
      (() => {
        const widget = new BSBKnob();
        widget.objectName = 'knob';
        widget.value = 0.25;
        return { token: 'knob', widget, compilationVarName: 'gk_knob' };
      })(),
      (() => {
        const widget = new BSBHSlider();
        widget.objectName = 'hslider';
        widget.value = 0.5;
        return { token: 'hslider', widget, compilationVarName: 'gk_hslider' };
      })(),
      (() => {
        const widget = new BSBVSlider();
        widget.objectName = 'vslider';
        widget.value = 0.75;
        return { token: 'vslider', widget, compilationVarName: 'gk_vslider' };
      })(),
      (() => {
        const widget = new BSBValue();
        widget.objectName = 'value';
        widget.defaultValue = 0.9;
        widget.value = 0.9;
        return { token: 'value', widget, compilationVarName: 'gk_value' };
      })(),
    ];

    for (const { token, widget, compilationVarName } of numericWidgets) {
      const compiled = compileTemplate(`<${token}>`, (unit) => {
        widget.collectReplacements(unit, [createParameter(token, compilationVarName)]);
      });
      expect(compiled).toBe(compilationVarName);
    }
  });

  it('uses parameter-backed replacements for checkboxes and Java fallback values otherwise', () => {
    const widget = new BSBCheckBox();
    widget.objectName = 'checkbox';
    widget.selected = true;

    const parameterBacked = compileTemplate('<checkbox>', (unit) => {
      widget.collectReplacements(unit, [createParameter('checkbox', 'gk_checkbox')]);
    });
    expect(parameterBacked).toBe('gk_checkbox');

    const literal = compileTemplate('<checkbox>', (unit) => {
      widget.collectReplacements(unit);
    });
    expect(literal).toBe('1');
  });

  it('uses parameter-backed replacements for dropdowns and preserves Java fallback rules', () => {
    const widget = new BSBDropdown();
    widget.objectName = 'dropdown';
    widget.dropdownItems = [
      { name: 'First', value: '10', uniqueId: '1' },
      { name: 'Second', value: '20', uniqueId: '2' },
    ];
    widget.selectedIndex = 1;
    widget.automationAllowed = true;

    const parameterBacked = compileTemplate('<dropdown>', (unit) => {
      widget.collectReplacements(unit, [createParameter('dropdown', 'gk_dropdown')]);
    });
    expect(parameterBacked).toBe('gk_dropdown');

    const automationFallback = compileTemplate('<dropdown>', (unit) => {
      widget.collectReplacements(unit);
    });
    expect(automationFallback).toBe('1');

    widget.automationAllowed = false;
    const itemValueFallback = compileTemplate('<dropdown>', (unit) => {
      widget.collectReplacements(unit);
    });
    expect(itemValueFallback).toBe('20');
  });

  it('uses parameter-backed replacements for XY controller axes', () => {
    const widget = new BSBXYController();
    widget.objectName = 'xy';
    widget.xValue = 0.25;
    widget.yValue = 0.75;

    const parameterBacked = compileTemplate('<xyX>,<xyY>', (unit) => {
      widget.collectReplacements(unit, [
        createParameter('xyX', 'gk_xy_x'),
        createParameter('xyY', 'gk_xy_y'),
      ]);
    });
    expect(parameterBacked).toBe('gk_xy_x,gk_xy_y');

    const literal = compileTemplate('<xyX>,<xyY>', (unit) => {
      widget.collectReplacements(unit);
    });
    expect(literal).toBe('0.25,0.75');
  });

  it('uses parameter-backed replacements for slider bank entries', () => {
    const horizontal = new BSBHSliderBank();
    horizontal.objectName = 'hbank';
    horizontal.numberOfSliders = 2;
    horizontal.sliders[0].value = 0.1;
    horizontal.sliders[1].value = 0.2;

    const vertical = new BSBVSliderBank();
    vertical.objectName = 'vbank';
    vertical.numberOfSliders = 2;
    vertical.sliders[0].value = 0.3;
    vertical.sliders[1].value = 0.4;

    const parameterBacked = compileTemplate('<hbank_0>,<hbank_1>,<vbank_0>,<vbank_1>', (unit) => {
      horizontal.collectReplacements(unit, [
        createParameter('hbank_0', 'gk_hbank_0'),
        createParameter('hbank_1', 'gk_hbank_1'),
      ]);
      vertical.collectReplacements(unit, [
        createParameter('vbank_0', 'gk_vbank_0'),
        createParameter('vbank_1', 'gk_vbank_1'),
      ]);
    });
    expect(parameterBacked).toBe('gk_hbank_0,gk_hbank_1,gk_vbank_0,gk_vbank_1');

    const literal = compileTemplate('<hbank_0>,<hbank_1>,<vbank_0>,<vbank_1>', (unit) => {
      horizontal.collectReplacements(unit);
      vertical.collectReplacements(unit);
    });
    expect(literal).toBe('0.1,0.2,0.3,0.4');
  });

  it('preserves Java string and text widget replacement behavior', () => {
    const textField = new BSBTextField();
    textField.objectName = 'textField';
    textField.textValue = 'hello world';

    const fileSelector = new BSBFileSelector();
    fileSelector.objectName = 'fileSelect';
    fileSelector.fileName = 'audio\\clip.wav';

    const stringChannelSelector = new BSBFileSelector();
    stringChannelSelector.objectName = 'stringFile';
    stringChannelSelector.fileName = 'media/sample.wav';
    stringChannelSelector.stringChannelEnabled = true;
    const stringChannel = stringChannelSelector.getStringChannel();
    if (!stringChannel) {
      throw new Error('Expected string channel to be available for file selector');
    }
    stringChannel.channelName = 'gS_blue_str0';

    const subChannel = new BSBSubChannelDropdown();
    subChannel.objectName = 'subChannel';
    subChannel.channelOutput = 'Bus A';

    const compiled = compileTemplate(
      '<textField>|<fileSelect>|<stringFile>|<subChannel>',
      (unit) => {
        textField.collectReplacements(unit);
        fileSelector.collectReplacements(unit);
        stringChannelSelector.collectReplacements(unit);
        subChannel.collectReplacements(unit);
      },
    );

    expect(compiled).toBe('hello world|audio/clip.wav|gS_blue_str0|Bus A');
  });

  it('preserves line object replacements and label no-op behavior', () => {
    const lineObject = new BSBLineObject();
    lineObject.objectName = 'line';
    lineObject.lines = [
      {
        varName: 'curveA',
        min: 0,
        max: 1,
        color: '#ff0000',
        points: [
          { x: 0, y: 0.2 },
          { x: 1, y: 0.8 },
        ],
      },
    ];

    const label = new BSBLabel();
    label.objectName = 'label';

    const compiled = compileTemplate('<line_curveA>|<label>', (unit) => {
      lineObject.collectReplacements(unit);
      label.collectReplacements(unit);
    });

    expect(compiled).toBe('0.0 0.2 1 0.8|<label>');
  });

  it('propagates parameter-backed replacements through BSB groups', () => {
    const group = new BSBGroup();

    const knob = new BSBKnob();
    knob.objectName = 'groupKnob';
    knob.value = 0.2;

    const checkbox = new BSBCheckBox();
    checkbox.objectName = 'groupCheck';
    checkbox.selected = true;

    group.addChild(knob);
    group.addChild(checkbox);

    const compiled = compileTemplate('<groupKnob>|<groupCheck>', (unit) => {
      group.collectReplacements(unit, [
        createParameter('groupKnob', 'gk_group_knob'),
        createParameter('groupCheck', 'gk_group_check'),
      ]);
    });

    expect(compiled).toBe('gk_group_knob|gk_group_check');
  });
});
