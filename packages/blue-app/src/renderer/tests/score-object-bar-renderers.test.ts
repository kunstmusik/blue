import { describe, it, expect } from 'vitest';
import {
  argbToRGB,
  activeRepeatPointBeats,
  brighten,
  darken,
  isBright,
  javaAwtBrighter,
  javaAwtDarker,
  rgbToCSS,
  selectedBaseColor,
  selectedFillColor,
  selectedHeaderColor,
  textColorForBackground,
  waveColorForBackground,
  fadeColorForBackground,
} from '../components/workbench/panels/score/bar-renderers/color-utils';
import {
  getAudioFadeValue,
  buildFadePolygon,
} from '../components/workbench/panels/score/bar-renderers/audio-fade-renderer';
import {
  computeThumbnailCache,
  computeNoteRects,
} from '../components/workbench/panels/score/bar-renderers/piano-roll-thumbnail-utils';
import { computeRepeatMarkers } from '../components/workbench/panels/score/bar-renderers/repeat-marker-utils';
import { activeRepeatPointBeats as getActiveRepeatPointBeats } from '../components/workbench/panels/score/bar-renderers/ScoreObjectBar';
import type { AudioFadeType } from '../../shared/project-editor';

describe('color-utils', () => {
  it('argbToRGB strips alpha channel', () => {
    expect(argbToRGB(0xff404040)).toBe(0x404040);
    expect(argbToRGB(0x00ffffff)).toBe(0xffffff);
  });

  it('brighten increases RGB values', () => {
    const rgb = 0x808080;
    const brighter = brighten(rgb, 1.5);
    const r = (brighter >> 16) & 0xff;
    const g = (brighter >> 8) & 0xff;
    const b = brighter & 0xff;
    expect(r).toBeGreaterThan(0x80);
    expect(g).toBeGreaterThan(0x80);
    expect(b).toBeGreaterThan(0x80);
  });

  it('darken decreases RGB values', () => {
    const rgb = 0x808080;
    const darker = darken(rgb, 0.5);
    const r = (darker >> 16) & 0xff;
    expect(r).toBeLessThan(0x80);
  });

  it('isBright detects bright colors', () => {
    expect(isBright(0xffffff)).toBe(true);
    expect(isBright(0x000000)).toBe(false);
    expect(isBright(0x808080)).toBe(false);
  });

  it('textColorForBackground returns appropriate contrast', () => {
    expect(textColorForBackground(0xffffffff)).toBe('#000000');
    expect(textColorForBackground(0xff000000)).toBe('#ffffff');
  });

  it('rgbToCSS formats correctly', () => {
    expect(rgbToCSS(0xff0000)).toBe('#ff0000');
    expect(rgbToCSS(0x000101)).toBe('#000101');
  });

  it('waveColorForBackground contrasts', () => {
    expect(waveColorForBackground(0xffffff)).toBeTruthy();
    expect(waveColorForBackground(0x000000)).toBeTruthy();
  });

  it('fadeColorForBackground returns appropriate alpha', () => {
    expect(fadeColorForBackground(0xffffff)).toBe('rgba(0,0,0,0.251)');
    expect(fadeColorForBackground(0x000000)).toBe('rgba(255,255,255,0.251)');
  });

  it('javaAwtBrighter matches Java Color.brighter()', () => {
    expect(javaAwtBrighter(0x404040)).toBe(0x5b5b5b);
    expect(javaAwtBrighter(javaAwtBrighter(0x404040))).toBe(0x828282);
  });

  it('javaAwtDarker matches Java Color.darker()', () => {
    expect(javaAwtDarker(0x404040)).toBe(0x2c2c2c);
  });

  it('selectedBaseColor matches Java selected background brightening', () => {
    expect(selectedBaseColor(0xff404040)).toBe(0x828282);
  });

  it('selectedFillColor uses the brightened color as the gradient base', () => {
    expect(selectedFillColor(0xff404040)).toContain('#9c9c9c');
    expect(selectedFillColor(0xff404040)).toContain('#828282');
  });

  it('selectedHeaderColor darkens the selected base color', () => {
    expect(selectedHeaderColor(0xff404040)).toBe('#1e1e1e');
  });
});

describe('repeat-marker-utils', () => {
  it('only returns an active repeat point for repeat behaviors', () => {
    expect(getActiveRepeatPointBeats('REPEAT', 4)).toBe(4);
    expect(getActiveRepeatPointBeats('REPEAT_CLASSIC', 4)).toBe(4);
    expect(getActiveRepeatPointBeats('SCALE', 4)).toBeNull();
    expect(getActiveRepeatPointBeats('NONE', 4)).toBeNull();
  });

  it('returns empty triangles for null repeat point', () => {
    const result = computeRepeatMarkers(null, 10, 100, 44);
    expect(result.triangles).toHaveLength(0);
  });

  it('returns empty triangles for zero repeat point', () => {
    const result = computeRepeatMarkers(0, 10, 100, 44);
    expect(result.triangles).toHaveLength(0);
  });

  it('computes repeat marker positions', () => {
    const result = computeRepeatMarkers(4.0, 16.0, 100, 44);
    expect(result.triangles.length).toBeGreaterThan(0);
    expect(result.triangles[0].x).toBe(400);
    expect(result.triangles[0].yTop).toBe(0);
    expect(result.triangles[0].yBottom).toBe(40);
  });

  it('stops at duration boundary', () => {
    const result = computeRepeatMarkers(4.0, 4.0, 100, 44);
    expect(result.triangles).toHaveLength(1);
  });
});

describe('audio-fade-renderer', () => {
  const tolerance = 0.01;

  it('LINEAR fade-in returns x', () => {
    expect(getAudioFadeValue(0, 'LINEAR', true)).toBeCloseTo(0, tolerance);
    expect(getAudioFadeValue(0.5, 'LINEAR', true)).toBeCloseTo(0.5, tolerance);
    expect(getAudioFadeValue(1, 'LINEAR', true)).toBeCloseTo(1, tolerance);
  });

  it('LINEAR fade-out returns 1-x', () => {
    expect(getAudioFadeValue(0, 'LINEAR', false)).toBeCloseTo(1, tolerance);
    expect(getAudioFadeValue(0.5, 'LINEAR', false)).toBeCloseTo(0.5, tolerance);
    expect(getAudioFadeValue(1, 'LINEAR', false)).toBeCloseTo(0, tolerance);
  });

  it('CONSTANT_POWER fade-in follows sin curve', () => {
    expect(getAudioFadeValue(0, 'CONSTANT_POWER', true)).toBeCloseTo(0, tolerance);
    expect(getAudioFadeValue(1, 'CONSTANT_POWER', true)).toBeCloseTo(1, tolerance);
    const mid = getAudioFadeValue(0.5, 'CONSTANT_POWER', true);
    expect(mid).toBeGreaterThan(0.5);
  });

  it('CONSTANT_POWER fade-out follows cos curve', () => {
    expect(getAudioFadeValue(0, 'CONSTANT_POWER', false)).toBeCloseTo(1, tolerance);
    expect(getAudioFadeValue(1, 'CONSTANT_POWER', false)).toBeCloseTo(0, tolerance);
  });

  it('FAST fade-in starts near 0 and ends near 1', () => {
    const start = getAudioFadeValue(0, 'FAST', true);
    const end = getAudioFadeValue(1, 'FAST', true);
    expect(start).toBeLessThan(0.01);
    expect(end).toBeGreaterThan(0.99);
  });

  it('FAST fade-out starts near 1 and ends near 0', () => {
    const start = getAudioFadeValue(0, 'FAST', false);
    const end = getAudioFadeValue(1, 'FAST', false);
    expect(start).toBeGreaterThan(0.99);
    expect(end).toBeLessThan(0.01);
  });

  it('buildFadePolygon returns null for zero fade', () => {
    expect(buildFadePolygon(0, 100, 44, 'LINEAR', true, 0)).toBeNull();
  });

  it('buildFadePolygon returns points string for valid fade', () => {
    const poly = buildFadePolygon(1.0, 100, 44, 'LINEAR', true, 0);
    expect(poly).toBeTruthy();
    expect(poly).toContain(',');
  });
});

describe('piano-roll-thumbnail-utils', () => {
  it('computeThumbnailCache returns null for empty notes', () => {
    expect(computeThumbnailCache([], 12)).toBeNull();
  });

  it('computeThumbnailCache computes min/max/range', () => {
    const notes = [
      { octave: 5, scaleDegree: 0, startBeats: 0, durationBeats: 1 },
      { octave: 5, scaleDegree: 4, startBeats: 1, durationBeats: 1 },
    ];
    const cache = computeThumbnailCache(notes, 12)!;
    expect(cache.min).toBe(60);
    expect(cache.max).toBe(64);
    expect(cache.range).toBe(5);
    expect(cache.notesDurationBeats).toBe(2);
  });

  it('computeNoteRects returns empty for insufficient height', () => {
    const notes = [{ octave: 5, scaleDegree: 0, startBeats: 0, durationBeats: 1 }];
    const cache = computeThumbnailCache(notes, 12)!;
    const rects = computeNoteRects(notes, 12, cache, 'SCALE', null, 200, 22, 22, 100);
    expect(rects).toHaveLength(0);
  });

  it('computeNoteRects returns rects for SCALE behavior', () => {
    const notes = [
      { octave: 5, scaleDegree: 0, startBeats: 0, durationBeats: 1 },
      { octave: 5, scaleDegree: 4, startBeats: 1, durationBeats: 1 },
    ];
    const cache = computeThumbnailCache(notes, 12)!;
    const rects = computeNoteRects(notes, 12, cache, 'SCALE', null, 200, 60, 22, 100);
    expect(rects.length).toBe(2);
    expect(rects[0].y).toBe(44);
    expect(rects[1].y).toBe(35);
    expect(rects[0].y).toBeGreaterThan(rects[1].y);
  });

  it('computeNoteRects REPEAT tiles notes across bar width', () => {
    const notes = [{ octave: 5, scaleDegree: 0, startBeats: 0, durationBeats: 1 }];
    const cache = computeThumbnailCache(notes, 12)!;
    const rects = computeNoteRects(notes, 12, cache, 'REPEAT', 2, 400, 60, 22, 100);
    expect(rects.length).toBeGreaterThanOrEqual(2);
    expect(rects[0].x).toBeLessThan(rects[1].x);
  });

  it('computeNoteRects REPEAT_CLASSIC tiles with final truncation', () => {
    const notes = [{ octave: 5, scaleDegree: 0, startBeats: 0, durationBeats: 1 }];
    const cache = computeThumbnailCache(notes, 12)!;
    const rects = computeNoteRects(notes, 12, cache, 'REPEAT_CLASSIC', 2, 400, 60, 22, 100);
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('computeNoteRects NONE uses raw pixel positioning', () => {
    const notes = [{ octave: 5, scaleDegree: 0, startBeats: 0, durationBeats: 1 }];
    const cache = computeThumbnailCache(notes, 12)!;
    const rects = computeNoteRects(notes, 12, cache, 'NONE', null, 200, 60, 22, 100);
    expect(rects.length).toBe(1);
    expect(rects[0].x).toBe(0);
    expect(rects[0].width).toBe(100);
  });
});
