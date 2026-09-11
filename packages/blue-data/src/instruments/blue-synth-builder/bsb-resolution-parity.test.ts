import { describe, expect, it } from 'vitest';

import { Element } from '../../serialization/xml-reader';
import { BlueSynthBuilder } from '../blue-synth-builder';
import { BSBKnob } from './bsb-knob';
import { BSBHSlider } from './bsb-hslider';
import { BSBHSliderBank } from './bsb-hslider-bank';
import { saveBsbWidgetAsXML } from './bsb-group';

function buildParameterSyncFixture(): BlueSynthBuilder {
  const bsb = new BlueSynthBuilder();
  const knob = new BSBKnob();
  knob.id = 'widget-knob-gain';
  knob.objectName = 'gain';
  knob.setValue(0.5);
  knob.minimum = 0;
  knob.maximum = 1;
  bsb.getGraphicInterface().getRootGroup().addChild(knob);

  const slider = new BSBHSlider();
  slider.id = 'widget-slider-cutoff';
  slider.objectName = 'cutoff';
  slider.value = 0.4;
  slider.minimum = 0;
  slider.maximum = 1;
  slider.setResolutionText('0.10');
  bsb.getGraphicInterface().getRootGroup().addChild(slider);

  const bank = new BSBHSliderBank();
  bank.id = 'widget-bank-harmonics';
  bank.objectName = 'harmonics';
  bank.minimum = 0;
  bank.maximum = 1;
  bank.setResolutionText('0.01');
  bsb.getGraphicInterface().getRootGroup().addChild(bank);

  // Seed the parameter list from the widgets.
  bsb.getParameters();
  return bsb;
}

describe('BSB exact resolution ownership', () => {
  it('preserves slider bdresolution text through load, snapping, copy, and save', () => {
    const slider = new BSBHSlider();
    slider.loadFromXML(
      Element.parse(`<bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
      <objectName>cutoff</objectName>
      <value>0.37</value>
      <minimum>0</minimum>
      <maximum>1</maximum>
      <bdresolution>0.10</bdresolution>
      <automationAllowed>true</automationAllowed>
    </bsbObject>`),
    );

    expect(slider.getResolutionText()).toBe('0.10');
    expect(slider.value).toBe(0.3);

    const copy = slider.deepCopy() as BSBHSlider;
    expect(copy.getResolutionText()).toBe('0.10');
    copy.setResolutionText('0.20');
    expect(slider.getResolutionText()).toBe('0.10');
    expect(copy.getResolutionText()).toBe('0.20');

    const saved = saveBsbWidgetAsXML(slider);
    expect(saved.getElement('bdresolution')?.getTextString()).toBe('0.10');
  });

  it('uses the bank resolution for every child slider and preserves large scales', () => {
    const bank = new BSBHSliderBank();
    bank.loadFromXML(
      Element.parse(`<bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSliderBank">
      <objectName>harmonics</objectName>
      <minimum>0</minimum>
      <maximum>1</maximum>
      <bdresolution>1E-7</bdresolution>
      <bsbObject type="blue.orchestra.blueSynthBuilder.BSBHSlider">
        <value>0.37</value>
        <minimum>0</minimum>
        <maximum>1</maximum>
        <bdresolution>0.1</bdresolution>
      </bsbObject>
    </bsbObject>`),
    );

    expect(bank.getResolutionText()).toBe('1E-7');
    expect(bank.sliders).toHaveLength(1);
    expect(bank.sliders[0]?.getResolutionText()).toBe('1E-7');
    expect(bank.sliders[0]?.value).toBe(0.37);

    const saved = saveBsbWidgetAsXML(bank);
    expect(saved.getElement('bdresolution')?.getTextString()).toBe('1E-7');
    expect(saved.getElement('bsbObject')?.getElement('bdresolution')?.getTextString()).toBe('1E-7');
  });

  it('parameter sync creates missing parameters with the widget-derived resolution (T128)', () => {
    const bsb = buildParameterSyncFixture();
    const parameters = bsb.getParameters();

    // Knob parameters are created with the Java initializeParameters default.
    const knob = parameters.find((candidate) => candidate.getName() === 'gain');
    expect(knob?.getResolutionText()).toBe('-1');

    // Slider parameters are created from the widget's exact resolution.
    const slider = parameters.find((candidate) => candidate.getName() === 'cutoff');
    expect(slider?.getResolutionText()).toBe('0.10');

    // Bank slider parameters share the bank resolution.
    const bankSlider = parameters.find((candidate) => candidate.getName() === 'harmonics_0');
    expect(bankSlider?.getResolutionText()).toBe('0.01');
  });

  it('parameter sync preserves an existing parameter resolution like Java initializeParameters (T128)', () => {
    const bsb = buildParameterSyncFixture();

    // A committed automation-resolution edit on the knob parameter (which has
    // no widget resolution property) must survive every parameter sync.
    const knob = bsb.getParameters().find((candidate) => candidate.getName() === 'gain');
    knob?.setResolutionText('0.25');
    expect(
      bsb
        .getParameters()
        .find((candidate) => candidate.getName() === 'gain')
        ?.getResolutionText(),
    ).toBe('0.25');

    // The parameter-owned slider resolution is equally durable until the
    // widget's resolution property itself is edited.
    const slider = bsb.getParameters().find((candidate) => candidate.getName() === 'cutoff');
    slider?.setResolutionText('0.50');
    expect(
      bsb
        .getParameters()
        .find((candidate) => candidate.getName() === 'cutoff')
        ?.getResolutionText(),
    ).toBe('0.50');
  });

  it('a widget resolution property edit explicitly pushes to backing parameters (T128)', () => {
    const bsb = buildParameterSyncFixture();
    const root = bsb.getGraphicInterface().getRootGroup();
    const slider = root
      .getChildren()
      .find(
        (child): child is BSBHSlider =>
          child instanceof BSBHSlider && child.objectName === 'cutoff',
      );
    const bank = root
      .getChildren()
      .find(
        (child): child is BSBHSliderBank =>
          child instanceof BSBHSliderBank && child.objectName === 'harmonics',
      );
    if (!slider || !bank) throw new Error('slider fixtures missing');

    expect(bsb.updateWidgetProperties(slider.id, { resolution: '0.20' })).toBe(true);
    expect(
      bsb
        .getParameters()
        .find((candidate) => candidate.getName() === 'cutoff')
        ?.getResolutionText(),
    ).toBe('0.20');

    expect(bsb.updateWidgetProperties(bank.id, { resolution: '0.02' })).toBe(true);
    expect(
      bsb
        .getParameters()
        .find((candidate) => candidate.getName() === 'harmonics_0')
        ?.getResolutionText(),
    ).toBe('0.02');
  });
});
