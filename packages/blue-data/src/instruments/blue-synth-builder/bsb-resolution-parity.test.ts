import { describe, expect, it } from 'vitest';

import { Element } from '../../serialization/xml-reader';
import { BSBHSlider } from './bsb-hslider';
import { BSBHSliderBank } from './bsb-hslider-bank';
import { saveBsbWidgetAsXML } from './bsb-group';

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
});
