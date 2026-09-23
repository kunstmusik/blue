import type { AudioFadeType } from '../../../../../../shared/project-editor';

const PI_2 = Math.PI * 0.5;

function ampdb(db: number): number {
  return Math.pow(10.0, db * 0.05);
}

function dbamp(amp: number): number {
  return 20 * Math.log10(amp);
}

export function getAudioFadeValue(x: number, fadeType: AudioFadeType, fadeIn: boolean): number {
  const cx = Math.max(0, Math.min(1, x));

  if (fadeIn) {
    switch (fadeType) {
      case 'LINEAR':
        return cx;
      case 'CONSTANT_POWER':
        return Math.sin(cx * PI_2);
      case 'S_CURVE':
        return (1 - Math.cos(cx * Math.PI)) * 0.5;
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
      case 'S_CURVE':
        return (1 + Math.cos(cx * Math.PI)) * 0.5;
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
