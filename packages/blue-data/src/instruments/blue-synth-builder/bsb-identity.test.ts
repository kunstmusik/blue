import { describe, expect, it } from 'vitest';

import { BSBGroup } from './bsb-group';
import { BSBHSliderBank } from './bsb-hslider-bank';
import { BSBKnob } from './bsb-knob';
import { BSBVSlider } from './bsb-vslider';
import {
  collectBsbWidgetIds,
  collectBsbWidgets,
  findBsbWidgetById,
  normalizeBsbWidgetIds,
} from './bsb-identity';

function createNestedIdentityTree(): BSBGroup {
  const root = new BSBGroup();

  const nestedGroup = new BSBGroup();
  nestedGroup.id = 'group-a';

  const nestedKnob = new BSBKnob();
  nestedKnob.id = 'knob-a';
  nestedGroup.addChild(nestedKnob);

  const sliderBank = new BSBHSliderBank();
  sliderBank.id = 'bank-a';
  sliderBank.numberOfSliders = 2;
  sliderBank.sliders[0].id = 'slider-a';
  sliderBank.sliders[1].id = 'slider-b';

  root.addChild(nestedGroup);
  root.addChild(sliderBank);
  return root;
}

describe('bsb identity helpers', () => {
  it('traverses nested groups and slider-bank child sliders', () => {
    const root = createNestedIdentityTree();

    expect(collectBsbWidgets(root).map((widget) => widget.id)).toEqual([
      'group-a',
      'knob-a',
      'bank-a',
      'slider-a',
      'slider-b',
    ]);

    expect(findBsbWidgetById(root, 'slider-b')).toBe(
      (root.getChildren()[1] as BSBHSliderBank).sliders[1],
    );
  });

  it('repairs missing and duplicate widget ids deterministically', () => {
    const root = new BSBGroup();

    const first = new BSBKnob();
    first.id = 'dup';
    first.objectName = 'first';

    const second = new BSBGroup();
    second.id = 'dup';

    const third = new BSBVSlider();
    third.id = '';

    const sliderBank = new BSBHSliderBank();
    sliderBank.id = '';
    sliderBank.numberOfSliders = 2;
    sliderBank.sliders[0].id = 'dup';
    sliderBank.sliders[1].id = '';

    root.addChild(first);
    root.addChild(second);
    root.addChild(third);
    root.addChild(sliderBank);

    const repairs = normalizeBsbWidgetIds(root);
    const ids = collectBsbWidgetIds(root);

    expect(first.id).toBe('dup');
    expect(second.id).toBeTruthy();
    expect(second.id).not.toBe('dup');
    expect(third.id).toBeTruthy();
    expect(sliderBank.id).toBeTruthy();
    expect(sliderBank.sliders[0].id).toBeTruthy();
    expect(sliderBank.sliders[0].id).not.toBe('dup');
    expect(sliderBank.sliders[1].id).toBeTruthy();
    expect(new Set(ids).size).toBe(ids.length);
    expect(repairs.map((repair) => repair.reason)).toEqual([
      'duplicate',
      'missing',
      'missing',
      'duplicate',
      'missing',
    ]);
  });
});
