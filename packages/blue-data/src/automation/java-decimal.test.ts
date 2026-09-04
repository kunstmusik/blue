import { describe, expect, it } from 'vitest';

import {
  javaDecimalEquals,
  javaDecimalFromBinary64,
  javaDecimalIsQuantizationActive,
  javaDecimalRemainder,
  javaDecimalSetScaleFloor,
  javaDecimalSetScaleHalfUp,
  javaDecimalStripTrailingZeros,
  javaDecimalSubtract,
  javaDecimalToBinary64,
  normalizeLegacyResolution,
  parseJavaDecimal,
  quantizeToResolutionJava,
  snapToResolutionJava,
  type JavaDecimal,
  type JavaDecimalResult,
} from './java-decimal';

function parseOk(text: string): JavaDecimal {
  return mustOk(parseJavaDecimal(text), text);
}

function mustOk(result: JavaDecimalResult, context: string): JavaDecimal {
  if (!result.ok) throw new Error(`operation failed for ${context}: ${result.code}`);
  return result.value;
}

describe('parseJavaDecimal (Java BigDecimal(String) grammar)', () => {
  it.each([
    // [text, coefficient, scale, canonicalText]
    ['0.1', '1', 1, '0.1'],
    ['0.10', '10', 2, '0.10'],
    ['1e-7', '1', 7, '1E-7'],
    ['1E+3', '1', -3, '1E+3'],
    ['0.00', '0', 2, '0.00'],
    ['.5', '5', 1, '0.5'],
    ['5.', '5', 0, '5'],
    ['5.e3', '5', -3, '5E+3'],
    ['+.5', '5', 1, '0.5'],
    ['+3.25', '325', 2, '3.25'],
    ['-0.0', '0', 1, '0.0'],
    ['-0', '0', 0, '0'],
    ['007', '7', 0, '7'],
    ['0.000005678', '5678', 9, '0.000005678'],
    ['0.0000005678', '5678', 10, '5.678E-7'],
    ['0e+5', '0', -5, '0E+5'],
    ['1e+0', '1', 0, '1'],
    ['1E-2147483647', '1', 2147483647, '1E-2147483647'],
    ['1E+2147483648', '1', -2147483648, '1E+2147483648'],
    ['12345.6789', '123456789', 4, '12345.6789'],
    ['-0.000000000000000000000001', '-1', 24, '-1E-24'],
    ['0.123456789012345678901234', '123456789012345678901234', 24, '0.123456789012345678901234'],
  ])('parses %s as (%s, %d) -> %s', (text, coefficient, scale, canonicalText) => {
    const value = parseOk(text);
    expect(value.coefficient).toBe(coefficient);
    expect(value.scale).toBe(scale);
    expect(value.canonicalText).toBe(canonicalText);
  });

  it.each([
    'abc',
    '1.2.3',
    '',
    ' 0.1',
    '0.1 ',
    '+',
    '.',
    'e5',
    '0x10',
    '1_000',
    'NaN',
    'Infinity',
    '1e',
    '1e+',
    '--1',
  ])('rejects invalid syntax %s', (text) => {
    const result = parseJavaDecimal(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_DECIMAL_SYNTAX');
  });

  it.each(['1E-2147483648', '1E+2147483649', '0.00000000000000000000000000000001e-2147483647'])(
    'reports scale overflow for %s',
    (text) => {
      const result = parseJavaDecimal(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('DECIMAL_SCALE_OVERFLOW');
    },
  );

  it('rejects non-string input', () => {
    // @ts-expect-error deliberately invalid runtime input
    const result = parseJavaDecimal(0.1);
    expect(result.ok).toBe(false);
  });
});

describe('javaDecimalFromBinary64 (Java new BigDecimal(double))', () => {
  it('constructs 0.1 exactly', () => {
    const result = javaDecimalFromBinary64(0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // new BigDecimal(0.1) = 0.1000000000000000055511151231257827021181583404541015625
    expect(result.value.canonicalText).toBe(
      '0.1000000000000000055511151231257827021181583404541015625',
    );
    expect(result.value.doubleValue).toBe(0.1);
  });

  it('drops the sign of zero', () => {
    const result = javaDecimalFromBinary64(-0.0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.coefficient).toBe('0');
    expect(result.value.scale).toBe(0);
  });

  it('constructs subnormals exactly', () => {
    const result = javaDecimalFromBinary64(4.9e-324);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.doubleValue).toBe(4.9e-324);
    expect(result.value.scale).toBeGreaterThan(1000);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite %s',
    (value) => {
      const result = javaDecimalFromBinary64(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('NON_FINITE_AUTOMATION_INPUT');
    },
  );
});

describe('javaDecimalToBinary64 (Java BigDecimal.doubleValue())', () => {
  it.each([
    ['0.1', 0.1],
    ['1E+3', 1000],
    ['1E-400', 0.0],
    ['-1E-400', -0.0],
    ['1E309', Number.POSITIVE_INFINITY],
    ['-1E309', Number.NEGATIVE_INFINITY],
    ['0.5', 0.5],
    // exact halfway between +0.0 and the minimum subnormal; ties to even -> 0
    ['2.470328229206232720882843964341106861825299013071623822127928412503377536351043E-324', 0.0],
    ['4.9406564584124654417656879286822137207201181583404541015625E-324', 4.9e-324],
  ])('converts %s exactly', (text, expected) => {
    expect(javaDecimalToBinary64(parseOk(text))).toBe(expected);
  });

  it('preserves sign of underflow', () => {
    expect(Object.is(javaDecimalToBinary64(parseOk('-1E-400')), -0.0)).toBe(true);
  });

  it('rounds ties to even at the 52-bit boundary', () => {
    // 2^53 is representable; 2^53 + 1 is halfway between 2^53 and 2^53 + 2 and
    // rounds (ties to even) down to 2^53
    expect(javaDecimalToBinary64(parseOk('9007199254740993'))).toBe(9007199254740992);
    expect(javaDecimalToBinary64(parseOk('9007199254740995'))).toBe(9007199254740996);
  });
});

describe('setScale, remainder, subtract', () => {
  it('floors toward negative infinity', () => {
    expect(mustOk(javaDecimalSetScaleFloor(parseOk('-0.46'), 1), '-0.46').canonicalText).toBe(
      '-0.5',
    );
    expect(mustOk(javaDecimalSetScaleFloor(parseOk('-0.45'), 1), '-0.45').canonicalText).toBe(
      '-0.5',
    );
    expect(mustOk(javaDecimalSetScaleFloor(parseOk('0.46'), 1), '0.46').canonicalText).toBe('0.4');
  });

  it('half-up rounds away from zero on ties', () => {
    expect(mustOk(javaDecimalSetScaleHalfUp(parseOk('2.675'), 5), '2.675').canonicalText).toBe(
      '2.67500',
    );
    expect(mustOk(javaDecimalSetScaleHalfUp(parseOk('0.25'), 1), '0.25').canonicalText).toBe('0.3');
    expect(mustOk(javaDecimalSetScaleHalfUp(parseOk('-0.25'), 1), '-0.25').canonicalText).toBe(
      '-0.3',
    );
  });

  it('pads exactly when increasing scale', () => {
    expect(mustOk(javaDecimalSetScaleFloor(parseOk('5'), 3), '5').canonicalText).toBe('5.000');
  });

  it('computes Java signed remainder and subtraction', () => {
    const v = mustOk(
      javaDecimalSetScaleFloor(mustOk(javaDecimalFromBinary64(0.549), '0.549'), 1),
      '0.549',
    );
    expect(v.canonicalText).toBe('0.5');
    const r = mustOk(javaDecimalRemainder(v, parseOk('0.1')), 'remainder');
    expect(r.canonicalText).toBe('0.0');
    expect(r.scale).toBe(1);
    const q = mustOk(javaDecimalSubtract(v, r), 'subtract');
    expect(q.canonicalText).toBe('0.5');
    expect(q.doubleValue).toBe(0.5);
  });

  it('strips trailing zeros like Java', () => {
    expect(javaDecimalStripTrailingZeros(parseOk('2.67500')).canonicalText).toBe('2.675');
    expect(javaDecimalStripTrailingZeros(parseOk('0.00000')).canonicalText).toBe('0');
    expect(javaDecimalStripTrailingZeros(parseOk('0e+5')).canonicalText).toBe('0');
    expect(javaDecimalStripTrailingZeros(parseOk('100')).canonicalText).toBe('1E+2');
  });
});

describe('activation and legacy normalization', () => {
  it('activates only for positive double values', () => {
    expect(javaDecimalIsQuantizationActive(parseOk('0.1'))).toBe(true);
    expect(javaDecimalIsQuantizationActive(parseOk('0.10'))).toBe(true);
    expect(javaDecimalIsQuantizationActive(parseOk('1E+3'))).toBe(true);
    expect(javaDecimalIsQuantizationActive(parseOk('-1'))).toBe(false);
    expect(javaDecimalIsQuantizationActive(parseOk('0'))).toBe(false);
    expect(javaDecimalIsQuantizationActive(parseOk('0.00'))).toBe(false);
    // positive decimal that underflows to +0.0 is unquantized
    expect(javaDecimalIsQuantizationActive(parseOk('1E-400'))).toBe(false);
  });

  it.each([
    // Java-verified: new BigDecimal(double).setScale(5, HALF_UP).stripTrailingZeros()
    ['0.1', '0.1'],
    ['0.10', '0.1'],
    ['0.05', '0.05'],
    ['0.000001', '0'],
    ['-0.000001', '0'],
    ['0.123456789', '0.12346'],
    ['1234567.89', '1234567.89'],
    ['1e22', '1E+22'],
    ['3.7e-8', '0'],
    ['0.999999', '1'],
    ['1.5', '1.5'],
    ['2.675', '2.675'],
    ['-2.675', '-2.675'],
    ['1e-3', '0.001'],
    ['0.07', '0.07'],
    ['0', '0'],
    ['-0.0', '0'],
    ['0.0', '0'],
  ])('normalizes legacy %s to %s', (legacyText, expectedCanonical) => {
    const result = normalizeLegacyResolution(Number(legacyText));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.canonicalText).toBe(expectedCanonical);
  });
});

describe('quantizeToResolutionJava (Java Line.getValue quantization)', () => {
  it('quantizes 0.549 to the 0.1 grid as 0.5', () => {
    expect(quantizeToResolutionJava(0.549, parseOk('0.1'))).toBe(0.5);
  });

  it('floors negative values toward negative infinity', () => {
    expect(quantizeToResolutionJava(-0.46, parseOk('0.1'))).toBe(-0.5);
  });

  it('returns null for non-finite values', () => {
    expect(quantizeToResolutionJava(Number.NaN, parseOk('0.1'))).toBeNull();
    expect(quantizeToResolutionJava(Number.POSITIVE_INFINITY, parseOk('0.1'))).toBeNull();
  });

  it('supports scale greater than 18 and negative scale', () => {
    const y = 0.450000099;
    const scale19 = quantizeToResolutionJava(y, parseOk('0.0000000000000000001'));
    expect(scale19).not.toBeNull();
    const negative = quantizeToResolutionJava(1234.5, parseOk('1E+3'));
    expect(negative).toBe(1000);
  });

  it('supports an active exact resolution with a scale above 2000', () => {
    const largeScaleResolution = `1.${'0'.repeat(3000)}`;
    const parsed = parseOk(largeScaleResolution);
    expect(parsed.scale).toBe(3000);
    expect(quantizeToResolutionJava(1.9, parsed)).toBe(1);
  });
});

describe('snapToResolutionJava (Java LineUtils.snapToResolution)', () => {
  it('clamps boundaries before snapping', () => {
    expect(snapToResolutionJava(1.4, 0.0, 1.0, parseOk('0.1'))).toBe(1.0);
    expect(snapToResolutionJava(-0.2, 0.0, 1.0, parseOk('0.1'))).toBe(0.0);
  });

  it('snaps with HALF_UP on the offset grid', () => {
    expect(snapToResolutionJava(0.37, 0.0, 1.0, parseOk('0.1'))).toBe(0.4);
    expect(snapToResolutionJava(0.25, 0.0, 1.0, parseOk('0.5'))).toBe(0.0);
    // Java-verified: (0.97 offset) HALF_UP-snaps to 1.0, then 1.0 + (-1.0) = 0.0
    expect(snapToResolutionJava(-0.03, -1.0, 1.0, parseOk('0.1'))).toBe(0.0);
  });

  it('returns the clamped value unchanged for inactive resolutions', () => {
    expect(snapToResolutionJava(0.37, 0.0, 1.0, parseOk('-1'))).toBe(0.37);
    expect(snapToResolutionJava(0.37, 0.0, 1.0, parseOk('0'))).toBe(0.37);
  });
});

describe('javaDecimalEquals', () => {
  it('compares coefficient and scale identity', () => {
    expect(javaDecimalEquals(parseOk('0.1'), parseOk('0.1'))).toBe(true);
    expect(javaDecimalEquals(parseOk('0.1'), parseOk('0.10'))).toBe(false);
    expect(javaDecimalEquals(parseOk('1'), parseOk('1E+3'))).toBe(false);
  });
});
