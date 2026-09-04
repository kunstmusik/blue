import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYER_COLOR,
  normalizeLayerColor,
  isValidLayerColorInput,
  formatLayerColorToHex,
} from './layers/layer-color';
import { SoundLayer } from '../sound-objects/sound-layer';
import { Track } from './track/track';
import { PatternLayer } from './patterns/pattern-layer';

describe('Layer Color Model', () => {
  describe('Layer color normalization and constants', () => {
    it('has the canonical neutral dark gray default (-12566464 / #404040)', () => {
      expect(DEFAULT_LAYER_COLOR).toBe(-12566464);
      expect(0xff404040 | 0).toBe(-12566464);
      expect(formatLayerColorToHex(DEFAULT_LAYER_COLOR)).toBe('#404040');
    });

    it('validates 32-bit integer ranges strictly', () => {
      expect(isValidLayerColorInput(0)).toBe(true);
      expect(isValidLayerColorInput(-12566464)).toBe(true);
      expect(isValidLayerColorInput(0xff404040)).toBe(true);
      expect(isValidLayerColorInput(0x00ffffff)).toBe(true);
      expect(isValidLayerColorInput(-2147483648)).toBe(true);
      expect(isValidLayerColorInput(4294967295)).toBe(true);

      expect(isValidLayerColorInput(NaN)).toBe(false);
      expect(isValidLayerColorInput(Infinity)).toBe(false);
      expect(isValidLayerColorInput(1.5)).toBe(false);
      expect(isValidLayerColorInput('42')).toBe(false);
      expect(isValidLayerColorInput(null)).toBe(false);
      expect(isValidLayerColorInput(undefined)).toBe(false);
      expect(isValidLayerColorInput(4294967296)).toBe(false);
      expect(isValidLayerColorInput(-2147483649)).toBe(false);
    });

    it('normalizes 24-bit RGB and 32-bit ARGB values to opaque signed ARGB', () => {
      // Red: 0xFF0000 -> 0xFFFF0000 | 0 = -65536
      expect(normalizeLayerColor(0xff0000)).toBe(-65536);
      expect(normalizeLayerColor(-65536)).toBe(-65536);
      expect(normalizeLayerColor(0xffff0000)).toBe(-65536);

      // Green: 0x00FF00 -> 0xFF00FF00 | 0 = -16711936
      expect(normalizeLayerColor(0x00ff00)).toBe(-16711936);

      // Blue: 0x0000FF -> 0xFF0000FF | 0 = -16776961
      expect(normalizeLayerColor(0x0000ff)).toBe(-16776961);
    });
  });

  describe('SoundLayer background color', () => {
    it('starts with DEFAULT_LAYER_COLOR', () => {
      const layer = new SoundLayer();
      expect(layer.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
    });

    it('updates and strictly normalizes background color', () => {
      const layer = new SoundLayer();
      layer.setBackgroundColor(0xff0000);
      expect(layer.getBackgroundColor()).toBe(-65536);

      expect(() => layer.setBackgroundColor(NaN)).toThrow();
    });

    it('preserves background color on deepCopy and isolates changes', () => {
      const original = new SoundLayer();
      original.setBackgroundColor(0x00ff00);
      const copy = original.deepCopy();

      expect(copy.getBackgroundColor()).toBe(-16711936);
      copy.setBackgroundColor(0x0000ff);
      expect(copy.getBackgroundColor()).toBe(-16776961);
      expect(original.getBackgroundColor()).toBe(-16711936);
    });
  });

  describe('Track background color', () => {
    it('starts with DEFAULT_LAYER_COLOR', () => {
      const track = new Track();
      expect(track.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
    });

    it('updates and strictly normalizes background color', () => {
      const track = new Track();
      track.setBackgroundColor(0x00ff00);
      expect(track.getBackgroundColor()).toBe(-16711936);

      expect(() => track.setBackgroundColor('invalid' as unknown as number)).toThrow();
    });

    it('preserves background color on deepCopy and isolates changes', () => {
      const original = new Track();
      original.setBackgroundColor(0xff0000);
      const copy = original.deepCopy();

      expect(copy.getBackgroundColor()).toBe(-65536);
      copy.setBackgroundColor(0x0000ff);
      expect(copy.getBackgroundColor()).toBe(-16776961);
      expect(original.getBackgroundColor()).toBe(-65536);
    });
  });

  describe('PatternLayer background color', () => {
    it('starts with DEFAULT_LAYER_COLOR and initializes source object with matching color', () => {
      const patternLayer = new PatternLayer();
      expect(patternLayer.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
      expect(patternLayer.getSoundObject().getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
    });

    it('updates and strictly normalizes background color', () => {
      const patternLayer = new PatternLayer();
      patternLayer.setBackgroundColor(0x0000ff);
      expect(patternLayer.getBackgroundColor()).toBe(-16776961);

      expect(() => patternLayer.setBackgroundColor(undefined as unknown as number)).toThrow();
    });

    it('preserves background color on deepCopy and isolates changes', () => {
      const original = new PatternLayer();
      original.setBackgroundColor(0x123456);
      const copy = original.deepCopy();

      expect(copy.getBackgroundColor()).toBe(normalizeLayerColor(0x123456));
      copy.setBackgroundColor(0x654321);
      expect(copy.getBackgroundColor()).toBe(normalizeLayerColor(0x654321));
      expect(original.getBackgroundColor()).toBe(normalizeLayerColor(0x123456));
    });
  });
});
