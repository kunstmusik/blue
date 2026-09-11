import { describe, expect, it } from 'vitest';

import { BSBCheckBox } from './bsb-check-box';
import { BSBDropdown } from './bsb-dropdown';
import { BSBHSlider } from './bsb-hslider';
import { BSBHSliderBank } from './bsb-hslider-bank';
import { BSBKnob } from './bsb-knob';
import { BSBValue } from './bsb-value';
import { BSBVSlider } from './bsb-vslider';
import { BSBVSliderBank } from './bsb-vslider-bank';
import { BSBXYController } from './bsb-xy-controller';
import type { BSBWidget } from './bsb-widget';

interface WidgetCopyCase {
  name: string;
  create: () => BSBWidget;
  content: (widget: BSBWidget) => unknown;
  nestedIds?: (widget: BSBWidget) => string[];
  resolution?: (widget: BSBWidget) => string;
  mutate: (widget: BSBWidget) => void;
}

function configureSlider<T extends BSBHSlider | BSBVSlider>(
  slider: T,
  id: string,
  objectName: string,
): T {
  slider.id = id;
  slider.objectName = objectName;
  slider.minimum = 0;
  slider.maximum = 1;
  slider.setResolutionText('0.01');
  slider.value = 0.37;
  return slider;
}

function configureBank<T extends BSBHSliderBank | BSBVSliderBank>(
  bank: T,
  id: string,
  childPrefix: string,
): T {
  bank.id = id;
  bank.objectName = childPrefix;
  bank.minimum = 0;
  bank.maximum = 1;
  bank.numberOfSliders = 2;
  bank.setResolutionText('0.001');
  bank.sliders[0]!.id = `${childPrefix}-0`;
  bank.sliders[1]!.id = `${childPrefix}-1`;
  bank.sliders[0]!.value = 0.123;
  bank.sliders[1]!.value = 0.456;
  return bank;
}

function configureCheckbox(): BSBCheckBox {
  const checkbox = new BSBCheckBox();
  checkbox.id = 'checkbox';
  checkbox.objectName = 'gate';
  checkbox.setValue(1);
  return checkbox;
}

function configureDropdown(): BSBDropdown {
  const dropdown = new BSBDropdown();
  dropdown.id = 'dropdown';
  dropdown.objectName = 'mode';
  dropdown.dropdownItems = [
    { name: 'Sine', value: 'sine', uniqueId: 'mode-sine' },
    { name: 'Noise', value: 'noise', uniqueId: 'mode-noise' },
  ];
  dropdown.setValue(1);
  return dropdown;
}

function configureValue(): BSBValue {
  const value = new BSBValue();
  value.id = 'value';
  value.objectName = 'amount';
  value.setValue(0.42);
  return value;
}

function configureXYController(): BSBXYController {
  const controller = new BSBXYController();
  controller.id = 'xy-controller';
  controller.objectName = 'pad';
  controller.xValue = 0.25;
  controller.yValue = 0.75;
  return controller;
}

const cases: WidgetCopyCase[] = [
  {
    name: 'horizontal slider',
    create: () => configureSlider(new BSBHSlider(), 'h-slider', 'cutoff'),
    content: (widget) => ({ value: widget.value }),
    resolution: (widget) => (widget as BSBHSlider).getResolutionText(),
    mutate: (widget) => {
      widget.value = 0.99;
    },
  },
  {
    name: 'vertical slider',
    create: () => configureSlider(new BSBVSlider(), 'v-slider', 'depth'),
    content: (widget) => ({ value: widget.value }),
    resolution: (widget) => (widget as BSBVSlider).getResolutionText(),
    mutate: (widget) => {
      widget.value = 0.99;
    },
  },
  {
    name: 'horizontal slider bank',
    create: () => configureBank(new BSBHSliderBank(), 'h-bank', 'harmonics'),
    content: (widget) =>
      (widget as BSBHSliderBank).sliders.map((slider) => ({ value: slider.value })),
    nestedIds: (widget) => (widget as BSBHSliderBank).sliders.map((slider) => slider.id),
    resolution: (widget) => (widget as BSBHSliderBank).getResolutionText(),
    mutate: (widget) => {
      (widget as BSBHSliderBank).sliders[0]!.value = 0.99;
    },
  },
  {
    name: 'vertical slider bank',
    create: () => configureBank(new BSBVSliderBank(), 'v-bank', 'partials'),
    content: (widget) =>
      (widget as BSBVSliderBank).sliders.map((slider) => ({ value: slider.value })),
    nestedIds: (widget) => (widget as BSBVSliderBank).sliders.map((slider) => slider.id),
    resolution: (widget) => (widget as BSBVSliderBank).getResolutionText(),
    mutate: (widget) => {
      (widget as BSBVSliderBank).sliders[0]!.value = 0.99;
    },
  },
  {
    name: 'knob control',
    create: () => {
      const knob = new BSBKnob();
      knob.id = 'knob-gain';
      knob.objectName = 'gain';
      knob.value = 0.75;
      return knob;
    },
    content: (widget) => ({ value: widget.value }),
    mutate: (widget) => {
      widget.value = 0.99;
    },
  },
  {
    name: 'checkbox control',
    create: configureCheckbox,
    content: (widget) => ({ value: widget.value, selected: (widget as BSBCheckBox).selected }),
    mutate: (widget) => {
      (widget as BSBCheckBox).setValue(0);
    },
  },
  {
    name: 'dropdown control',
    create: configureDropdown,
    content: (widget) => ({
      value: widget.value,
      selectedIndex: (widget as BSBDropdown).selectedIndex,
      items: (widget as BSBDropdown).dropdownItems.map(({ name, value }) => ({ name, value })),
    }),
    nestedIds: (widget) => (widget as BSBDropdown).dropdownItems.map((item) => item.uniqueId),
    mutate: (widget) => {
      (widget as BSBDropdown).dropdownItems[0]!.name = 'Changed';
    },
  },
  {
    name: 'value control',
    create: configureValue,
    content: (widget) => ({
      value: widget.value,
      defaultValue: (widget as BSBValue).defaultValue,
    }),
    mutate: (widget) => {
      (widget as BSBValue).setValue(0.99);
    },
  },
  {
    name: 'XY controller',
    create: configureXYController,
    content: (widget) => ({
      xValue: (widget as BSBXYController).xValue,
      yValue: (widget as BSBXYController).yValue,
    }),
    mutate: (widget) => {
      (widget as BSBXYController).xValue = 0.99;
    },
  },
];

describe('BSB history copies preserve parameter-widget identity and state', () => {
  it.each(cases)(
    '$name keeps history identities and detached state',
    ({ create, content, nestedIds, resolution, mutate }) => {
      const source = create();
      const historyCopy = source.deepCopy('history');

      expect(historyCopy.id).toBe(source.id);
      expect(content(historyCopy)).toEqual(content(source));
      if (resolution) expect(resolution(historyCopy)).toBe(resolution(source));
      if (nestedIds) expect(nestedIds(historyCopy)).toEqual(nestedIds(source));

      mutate(historyCopy);
      expect(content(historyCopy)).not.toEqual(content(source));
      if (resolution) {
        if ('setResolutionText' in historyCopy) {
          (
            historyCopy as BSBHSlider | BSBVSlider | BSBHSliderBank | BSBVSliderBank
          ).setResolutionText('0.2');
        }
        expect(resolution(source)).not.toBe('0.2');
      }
    },
  );

  it.each(cases)(
    '$name gets independent duplication identities',
    ({ create, content, nestedIds, resolution }) => {
      const source = create();
      const duplicate = source.deepCopy();

      expect(duplicate.id).not.toBe(source.id);
      expect(content(duplicate)).toEqual(content(source));
      if (resolution) expect(resolution(duplicate)).toBe(resolution(source));
      if (nestedIds) {
        expect(nestedIds(duplicate)).toHaveLength(nestedIds(source).length);
        expect(nestedIds(duplicate)).not.toEqual(nestedIds(source));
        expect(new Set(nestedIds(duplicate)).size).toBe(nestedIds(duplicate).length);
      }
    },
  );
});
