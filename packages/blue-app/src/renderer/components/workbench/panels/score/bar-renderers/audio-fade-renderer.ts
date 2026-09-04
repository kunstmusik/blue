import type { AudioFadeType } from '../../../../../../shared/project-editor';

type CubicCoefficients = {
  a: number;
  b: number;
  c: number;
  d: number;
};

const PI_2 = Math.PI * 0.5;

function pointAt(points: number[], index: number): number {
  return points[index] ?? 0;
}

function ampdb(db: number): number {
  return Math.pow(10.0, db * 0.05);
}

function dbamp(amp: number): number {
  return 20 * Math.log10(amp);
}

function getSymmetricCurvePoints(): number[] {
  const points = new Array(20).fill(0);
  points[0] = 0.0;
  points[1] = 1.0;
  points[2] = 0.5;
  points[3] = 0.6;

  for (let i = 2; i < 9; i++) {
    const coef = 0.3 * Math.pow(0.5, i);
    const ix = 0.7 + 0.3 * (i / 9.0);
    const index = i * 2;
    points[index] = ix;
    points[index + 1] = coef;
  }

  points[18] = 1.0;
  points[19] = 0.0000001;
  return points;
}

function reverseCurve(points: number[]): number[] {
  const len = points.length;
  const reversed = new Array(len).fill(0);
  const duration = pointAt(points, len - 2);

  for (let i = 0; i < len; i += 2) {
    const inputIndex = len - i - 2;
    reversed[i] = duration - pointAt(points, inputIndex);
    reversed[i + 1] = pointAt(points, inputIndex + 1);
  }

  return reversed;
}

function calcCubicCoefficients(points: number[]): CubicCoefficients[] {
  const pointCount = points.length / 2;
  const coefficients: CubicCoefficients[] = [];
  let previousSlope = 0.0;

  for (let i = 0; i < pointCount; i++) {
    if (i === 0) {
      const slope0 =
        (pointAt(points, 2) - pointAt(points, 0)) / (pointAt(points, 3) - pointAt(points, 1));
      const slope1 =
        (pointAt(points, 4) - pointAt(points, 2)) / (pointAt(points, 5) - pointAt(points, 3));
      const firstPointSlope = slope0 * slope1 < 0 ? 0 : 2.0 / (slope1 + slope0);

      previousSlope =
        3.0 *
          ((pointAt(points, 3) - pointAt(points, 1)) /
            (2.0 * (pointAt(points, 2) - pointAt(points, 0)))) -
        firstPointSlope * 0.5;
      continue;
    }

    const pointOffset = i * 2;
    const xDelta = pointAt(points, pointOffset) - pointAt(points, pointOffset - 2);
    const xDelta2 = xDelta * xDelta;
    const yDelta = pointAt(points, pointOffset + 1) - pointAt(points, pointOffset - 1);
    let pointSlope: number;

    if (i === pointCount - 1) {
      pointSlope = (3 * yDelta) / (2 * xDelta) - previousSlope * 0.5;
    } else {
      const slopeBefore =
        (pointAt(points, pointOffset + 2) - pointAt(points, pointOffset)) /
        (pointAt(points, pointOffset + 3) - pointAt(points, pointOffset + 1));
      const slopeAfter = xDelta / yDelta;
      pointSlope = slopeAfter * slopeBefore < 0.0 ? 0.0 : 2 / (slopeAfter + slopeBefore);
    }

    const secondDerivativeLeft =
      (-2 * (pointSlope + 2 * previousSlope)) / xDelta + (6 * yDelta) / xDelta2;
    const secondDerivativeRight =
      (2 * (2 * pointSlope + previousSlope)) / xDelta - (6 * yDelta) / xDelta2;

    const d = (secondDerivativeRight - secondDerivativeLeft) / (6 * xDelta);
    const c =
      (pointAt(points, pointOffset) * secondDerivativeLeft -
        pointAt(points, pointOffset - 2) * secondDerivativeRight) /
      (2 * xDelta);

    const prevX = pointAt(points, pointOffset - 2);
    const currentX = pointAt(points, pointOffset);
    const prevY = pointAt(points, pointOffset - 1);
    const prevX2 = prevX * prevX;
    const prevX3 = prevX2 * prevX;
    const currentX2 = currentX * currentX;
    const currentX3 = currentX2 * currentX;

    const b = (yDelta - c * (currentX2 - prevX2) - d * (currentX3 - prevX3)) / xDelta;

    coefficients.push({
      a: prevY - b * prevX - c * prevX2 - d * prevX3,
      b,
      c,
      d,
    });
    previousSlope = pointSlope;
  }

  return coefficients;
}

const SYMMETRIC_OUT_POINTS = getSymmetricCurvePoints();
const SYMMETRIC_IN_POINTS = reverseCurve(SYMMETRIC_OUT_POINTS);
const SYMMETRIC_IN_COEFFICIENTS = calcCubicCoefficients(SYMMETRIC_IN_POINTS);
const SYMMETRIC_OUT_COEFFICIENTS = calcCubicCoefficients(SYMMETRIC_OUT_POINTS);

function calcSymmetric(x: number, coefficients: CubicCoefficients[], points: number[]): number {
  if (x <= pointAt(points, 0)) return pointAt(points, 1);
  if (x >= pointAt(points, points.length - 2)) return pointAt(points, points.length - 1);

  const pointCount = points.length / 2;
  let cubicCoefficients = coefficients[0] ?? { a: 0, b: 0, c: 0, d: 0 };

  for (let i = 1; i < pointCount && x > pointAt(points, i * 2); i++) {
    const next = coefficients[Math.min(i, coefficients.length - 1)];
    if (next) {
      cubicCoefficients = next;
    }
  }

  const x2 = x * x;
  const x3 = x2 * x;
  return (
    cubicCoefficients.a +
    x * cubicCoefficients.b +
    x2 * cubicCoefficients.c +
    x3 * cubicCoefficients.d
  );
}

export function getAudioFadeValue(x: number, fadeType: AudioFadeType, fadeIn: boolean): number {
  const cx = Math.max(0, Math.min(1, x));

  if (fadeIn) {
    switch (fadeType) {
      case 'LINEAR':
        return cx;
      case 'CONSTANT_POWER':
        return Math.sin(cx * PI_2);
      case 'SYMMETRIC':
        return calcSymmetric(cx, SYMMETRIC_IN_COEFFICIENTS, SYMMETRIC_IN_POINTS);
      case 'FAST':
        return 0.001 * ampdb(60.0 * cx);
      case 'SLOW': {
        const coef = ampdb(-1.0) * Math.pow(ampdb(1.0), cx);
        const coef2 = ampdb(-80.0) * Math.pow(ampdb(80.0), cx);
        return ampdb(dbamp(coef) * cx + dbamp(coef2) * (1 - cx));
      }
    }
  } else {
    switch (fadeType) {
      case 'LINEAR':
        return 1.0 - cx;
      case 'CONSTANT_POWER':
        return Math.cos(cx * PI_2);
      case 'SYMMETRIC':
        return calcSymmetric(cx, SYMMETRIC_OUT_COEFFICIENTS, SYMMETRIC_OUT_POINTS);
      case 'FAST':
        return Math.pow(ampdb(-60.0), cx);
      case 'SLOW': {
        const coef = Math.pow(ampdb(-1.0), cx);
        const coef2 = Math.pow(ampdb(-80.0), cx);
        return ampdb(dbamp(coef) * (1 - cx) + dbamp(coef2) * cx);
      }
    }
  }

  return fadeIn ? cx : 1.0 - cx;
}

export function buildFadePolygon(
  fadeTimeBeats: number,
  pixelsPerBeat: number,
  barHeight: number,
  fadeType: AudioFadeType,
  fadeIn: boolean,
  xOffset: number,
): string | null {
  const len = Math.trunc(fadeTimeBeats * pixelsPerBeat);
  if (len < 2) return null;

  const h = barHeight - 4;
  if (h <= 0) return null;

  const dlen = len;
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < len; i++) {
    const xNorm = i / dlen;
    const fadeY = getAudioFadeValue(xNorm, fadeType, fadeIn);
    points.push({
      x: i + xOffset,
      y: Math.trunc((1.0 - fadeY) * h),
    });
  }

  if (fadeIn) {
    points.push({ x: xOffset + len, y: 0 });
    points.push({ x: xOffset, y: 0 });
    points.push({ x: xOffset, y: h });
  } else {
    points.push({ x: xOffset + len, y: h });
    points.push({ x: xOffset + len, y: 0 });
    points.push({ x: xOffset, y: 0 });
  }

  return points.map((p, i) => `${i === 0 ? '' : ','}${p.x},${p.y}`).join('');
}
