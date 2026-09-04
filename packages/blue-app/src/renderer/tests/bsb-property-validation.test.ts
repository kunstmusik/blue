import { describe, it, expect } from 'vitest';
import { validateNumericProperty } from '../components/workbench/panels/orchestra/bsb/BSBPropertySheet';
import type { BsbWidgetNodeSnapshot } from '../../shared/project-editor';

function makeWidget(
  overrides: Partial<BsbWidgetNodeSnapshot> & { type: string },
): BsbWidgetNodeSnapshot {
  return {
    id: overrides.id ?? 'w1',
    type: overrides.type,
    objectName: overrides.objectName ?? 'test',
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 60,
    height: overrides.height ?? 24,
    value: overrides.value ?? 0,
    minimum: overrides.minimum ?? 0,
    maximum: overrides.maximum ?? 1,
    editable: overrides.editable ?? true,
    properties: overrides.properties ?? {},
    children: overrides.children,
  };
}

describe('validateNumericProperty', () => {
  describe('position properties', () => {
    it('clamps negative x to 0', () => {
      expect(validateNumericProperty('x', '-5', makeWidget({ type: 'BSBHSlider' }))).toBe('0');
    });

    it('clamps negative y to 0', () => {
      expect(validateNumericProperty('y', '-10', makeWidget({ type: 'BSBHSlider' }))).toBe('0');
    });

    it('accepts zero x', () => {
      expect(validateNumericProperty('x', '0', makeWidget({ type: 'BSBHSlider' }))).toBe('0');
    });

    it('accepts positive x', () => {
      expect(validateNumericProperty('x', '42', makeWidget({ type: 'BSBHSlider' }))).toBe('42');
    });
  });

  describe('dimension properties', () => {
    const dimProps = [
      'width',
      'height',
      'sliderWidth',
      'sliderHeight',
      'knobWidth',
      'canvasWidth',
      'canvasHeight',
    ];

    for (const prop of dimProps) {
      describe(prop, () => {
        it('clamps negative to 1', () => {
          expect(validateNumericProperty(prop, '-5', makeWidget({ type: 'BSBHSlider' }))).toBe('1');
        });

        it('clamps 0 to 1', () => {
          expect(validateNumericProperty(prop, '0', makeWidget({ type: 'BSBHSlider' }))).toBe('1');
        });

        it('clamps 0.5 to 1 (rounded)', () => {
          expect(validateNumericProperty(prop, '0.5', makeWidget({ type: 'BSBHSlider' }))).toBe(
            '1',
          );
        });

        it('accepts 1', () => {
          expect(validateNumericProperty(prop, '1', makeWidget({ type: 'BSBHSlider' }))).toBe('1');
        });

        it('accepts and rounds 100.7', () => {
          expect(validateNumericProperty(prop, '100.7', makeWidget({ type: 'BSBHSlider' }))).toBe(
            '101',
          );
        });
      });
    }
  });

  describe('textFieldWidth', () => {
    it('clamps negative to 5', () => {
      expect(
        validateNumericProperty('textFieldWidth', '-1', makeWidget({ type: 'BSBTextField' })),
      ).toBe('5');
    });

    it('clamps 0 to 5', () => {
      expect(
        validateNumericProperty('textFieldWidth', '0', makeWidget({ type: 'BSBTextField' })),
      ).toBe('5');
    });

    it('clamps 4 to 5', () => {
      expect(
        validateNumericProperty('textFieldWidth', '4', makeWidget({ type: 'BSBTextField' })),
      ).toBe('5');
    });

    it('accepts 5', () => {
      expect(
        validateNumericProperty('textFieldWidth', '5', makeWidget({ type: 'BSBTextField' })),
      ).toBe('5');
    });

    it('accepts 100', () => {
      expect(
        validateNumericProperty('textFieldWidth', '100', makeWidget({ type: 'BSBTextField' })),
      ).toBe('100');
    });
  });

  describe('numberOfSliders', () => {
    it('clamps negative to 1', () => {
      expect(
        validateNumericProperty('numberOfSliders', '-3', makeWidget({ type: 'BSBHSliderBank' })),
      ).toBe('1');
    });

    it('clamps 0 to 1', () => {
      expect(
        validateNumericProperty('numberOfSliders', '0', makeWidget({ type: 'BSBHSliderBank' })),
      ).toBe('1');
    });

    it('accepts 1', () => {
      expect(
        validateNumericProperty('numberOfSliders', '1', makeWidget({ type: 'BSBHSliderBank' })),
      ).toBe('1');
    });

    it('rounds 3.7 to 4', () => {
      expect(
        validateNumericProperty('numberOfSliders', '3.7', makeWidget({ type: 'BSBHSliderBank' })),
      ).toBe('4');
    });
  });

  describe('fontSize', () => {
    it('clamps below 8 to 8', () => {
      expect(validateNumericProperty('fontSize', '3', makeWidget({ type: 'BSBDropdown' }))).toBe(
        '8',
      );
    });

    it('clamps above 36 to 36', () => {
      expect(validateNumericProperty('fontSize', '50', makeWidget({ type: 'BSBDropdown' }))).toBe(
        '36',
      );
    });

    it('accepts 8', () => {
      expect(validateNumericProperty('fontSize', '8', makeWidget({ type: 'BSBDropdown' }))).toBe(
        '8',
      );
    });

    it('accepts 36', () => {
      expect(validateNumericProperty('fontSize', '36', makeWidget({ type: 'BSBDropdown' }))).toBe(
        '36',
      );
    });

    it('rounds 12.5 to 13', () => {
      expect(validateNumericProperty('fontSize', '12.5', makeWidget({ type: 'BSBDropdown' }))).toBe(
        '13',
      );
    });
  });

  describe('gap / resolution / selectedIndex', () => {
    it('clamps negative gap to 0', () => {
      expect(validateNumericProperty('gap', '-5', makeWidget({ type: 'BSBHSliderBank' }))).toBe(
        '0',
      );
    });

    it('accepts zero gap', () => {
      expect(validateNumericProperty('gap', '0', makeWidget({ type: 'BSBHSliderBank' }))).toBe('0');
    });

    it('clamps negative resolution to 0', () => {
      expect(
        validateNumericProperty('resolution', '-0.1', makeWidget({ type: 'BSBHSlider' })),
      ).toBe('0');
    });

    it('clamps negative selectedIndex to 0', () => {
      expect(
        validateNumericProperty('selectedIndex', '-1', makeWidget({ type: 'BSBDropdown' })),
      ).toBe('0');
    });
  });

  describe('minimum / maximum (ClampedValue)', () => {
    it('rejects minimum >= maximum', () => {
      const w = makeWidget({ type: 'BSBHSlider', minimum: 0, maximum: 1 });
      expect(validateNumericProperty('minimum', '2', w)).toBeNull();
    });

    it('rejects minimum == maximum', () => {
      const w = makeWidget({ type: 'BSBHSlider', minimum: 0, maximum: 1 });
      expect(validateNumericProperty('minimum', '1', w)).toBeNull();
    });

    it('accepts minimum < maximum', () => {
      const w = makeWidget({ type: 'BSBHSlider', minimum: 0, maximum: 1 });
      expect(validateNumericProperty('minimum', '0.5', w)).toBe('0.5');
    });

    it('rejects maximum <= minimum', () => {
      const w = makeWidget({ type: 'BSBHSlider', minimum: 0, maximum: 1 });
      expect(validateNumericProperty('maximum', '-1', w)).toBeNull();
    });

    it('rejects maximum == minimum', () => {
      const w = makeWidget({ type: 'BSBHSlider', minimum: 0, maximum: 1 });
      expect(validateNumericProperty('maximum', '0', w)).toBeNull();
    });

    it('accepts maximum > minimum', () => {
      const w = makeWidget({ type: 'BSBHSlider', minimum: 0, maximum: 1 });
      expect(validateNumericProperty('maximum', '2', w)).toBe('2');
    });
  });

  describe('XMin / XMax / YMin / YMax (XYController)', () => {
    it('rejects XMin >= XMax', () => {
      const w = makeWidget({ type: 'BSBXYController', properties: { xMin: 0, xMax: 1 } });
      expect(validateNumericProperty('XMin', '2', w)).toBeNull();
    });

    it('accepts XMin < XMax', () => {
      const w = makeWidget({ type: 'BSBXYController', properties: { xMin: 0, xMax: 1 } });
      expect(validateNumericProperty('XMin', '0.5', w)).toBe('0.5');
    });

    it('rejects XMax <= XMin', () => {
      const w = makeWidget({ type: 'BSBXYController', properties: { xMin: 0, xMax: 1 } });
      expect(validateNumericProperty('XMax', '-1', w)).toBeNull();
    });

    it('accepts XMax > XMin', () => {
      const w = makeWidget({ type: 'BSBXYController', properties: { xMin: 0, xMax: 1 } });
      expect(validateNumericProperty('XMax', '2', w)).toBe('2');
    });

    it('rejects YMin >= YMax', () => {
      const w = makeWidget({ type: 'BSBXYController', properties: { yMin: 0, yMax: 1 } });
      expect(validateNumericProperty('YMin', '5', w)).toBeNull();
    });

    it('rejects YMax <= YMin', () => {
      const w = makeWidget({ type: 'BSBXYController', properties: { yMin: 0, yMax: 1 } });
      expect(validateNumericProperty('YMax', '0', w)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(validateNumericProperty('x', '', makeWidget({ type: 'BSBHSlider' }))).toBeNull();
    });

    it('returns null for bare minus sign', () => {
      expect(validateNumericProperty('x', '-', makeWidget({ type: 'BSBHSlider' }))).toBeNull();
    });

    it('returns null for NaN text', () => {
      expect(validateNumericProperty('x', 'abc', makeWidget({ type: 'BSBHSlider' }))).toBeNull();
    });

    it('passes through unknown numeric properties', () => {
      expect(validateNumericProperty('value', '0.5', makeWidget({ type: 'BSBHSlider' }))).toBe(
        '0.5',
      );
    });

    it('passes through defaultValue without constraint', () => {
      expect(
        validateNumericProperty('defaultValue', '-100', makeWidget({ type: 'BSBValue' })),
      ).toBe('-100');
    });

    it('passes through font editor numeric fields without clamping', () => {
      expect(validateNumericProperty('font.size', '7.25', makeWidget({ type: 'BSBKnob' }))).toBe(
        '7.25',
      );
      expect(validateNumericProperty('labelFont.style', '2', makeWidget({ type: 'BSBKnob' }))).toBe(
        '2',
      );
    });
  });
});
