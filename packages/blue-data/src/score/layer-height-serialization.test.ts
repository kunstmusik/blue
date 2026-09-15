import { describe, it, expect } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { Track } from './track/track';
import { TrackLayerGroup } from './track/track-layer-group';
import {
  parseCustomHeight,
  resolveEffectiveHeight,
  resolveExplicitHeight,
  calculateNearestHeightIndex,
  isPresetHeight,
  LAYER_HEIGHT_MIN,
  LAYER_HEIGHT_MAX,
} from './layer-height-policy';
import { GenericScore } from '../sound-objects/generic-score';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';

describe('Layer Height Serialization & Model Policy', () => {
  describe('Layer Height Policy', () => {
    it('strictly parses valid custom height values in range [22, 660]', () => {
      expect(parseCustomHeight(22)).toBe(22);
      expect(parseCustomHeight(660)).toBe(660);
      expect(parseCustomHeight(57)).toBe(57);
      expect(parseCustomHeight('57')).toBe(57);
      expect(parseCustomHeight('  120  ')).toBe(120);

      // Invalid strings
      expect(parseCustomHeight('57px')).toBeNull();
      expect(parseCustomHeight('57.5')).toBeNull();
      expect(parseCustomHeight('1e2')).toBeNull();
      expect(parseCustomHeight('+57')).toBeNull();
      expect(parseCustomHeight('-57')).toBeNull();
      expect(parseCustomHeight('')).toBeNull();
      expect(parseCustomHeight('   ')).toBeNull();
      expect(parseCustomHeight('abc')).toBeNull();

      // Out of bounds
      expect(parseCustomHeight(21)).toBeNull();
      expect(parseCustomHeight(661)).toBeNull();
      expect(parseCustomHeight(-10)).toBeNull();
      expect(parseCustomHeight(0)).toBeNull();
      expect(parseCustomHeight(NaN)).toBeNull();
      expect(parseCustomHeight(Infinity)).toBeNull();
      expect(parseCustomHeight(null)).toBeNull();
      expect(parseCustomHeight(undefined)).toBeNull();
    });

    it('identifies fixed presets for soundLayer and track', () => {
      expect(isPresetHeight(22, 'soundLayer')).toBe(true);
      expect(isPresetHeight(44, 'soundLayer')).toBe(true);
      expect(isPresetHeight(198, 'soundLayer')).toBe(true);
      expect(isPresetHeight(220, 'soundLayer')).toBe(false); // 220 is not a preset for SoundLayer (max 198)

      expect(isPresetHeight(22, 'track')).toBe(true);
      expect(isPresetHeight(198, 'track')).toBe(true);
      expect(isPresetHeight(220, 'track')).toBe(true); // 220 is a preset for Track (index 9)
      expect(isPresetHeight(242, 'track')).toBe(false);

      expect(isPresetHeight(57, 'soundLayer')).toBe(false);
      expect(isPresetHeight(57, 'track')).toBe(false);
    });

    it('calculates nearest fallback index with positive midpoint ties rounding up', () => {
      // 57 / 22 = 2.5909... -> round is 3 -> index 2
      expect(calculateNearestHeightIndex(57, 'soundLayer')).toBe(2);
      expect(calculateNearestHeightIndex(57, 'track')).toBe(2);

      // 55 / 22 = 2.5 -> round is 3 -> index 2 (positive midpoint tie rounds upward)
      expect(calculateNearestHeightIndex(55, 'soundLayer')).toBe(2);
      expect(calculateNearestHeightIndex(55, 'track')).toBe(2);

      // 33 / 22 = 1.5 -> round is 2 -> index 1
      expect(calculateNearestHeightIndex(33, 'soundLayer')).toBe(1);

      // 220 for SoundLayer: clamped to 8
      expect(calculateNearestHeightIndex(220, 'soundLayer')).toBe(8);
      // 220 for Track: index 9
      expect(calculateNearestHeightIndex(220, 'track')).toBe(9);

      // 660: clamped to 8 for SoundLayer, 9 for Track
      expect(calculateNearestHeightIndex(660, 'soundLayer')).toBe(8);
      expect(calculateNearestHeightIndex(660, 'track')).toBe(9);
    });

    it('resolves explicit heights omitting preset customHeight', () => {
      // Preset 66 -> customHeight undefined
      const preset = resolveExplicitHeight(66, 'soundLayer');
      expect(preset.heightIndex).toBe(2);
      expect(preset.customHeight).toBeUndefined();

      // Non-preset 57 -> customHeight 57
      const custom = resolveExplicitHeight(57, 'soundLayer');
      expect(custom.heightIndex).toBe(2);
      expect(custom.customHeight).toBe(57);

      // Track 220 is a preset
      const track220 = resolveExplicitHeight(220, 'track');
      expect(track220.heightIndex).toBe(9);
      expect(track220.customHeight).toBeUndefined();

      // SoundLayer 220 is NOT a preset
      const sl220 = resolveExplicitHeight(220, 'soundLayer');
      expect(sl220.heightIndex).toBe(8);
      expect(sl220.customHeight).toBe(220);
    });
  });

  describe('SoundLayer XML Serialization & Fallback', () => {
    it('loads legacy SoundLayer without customHeight and preserves effective height', () => {
      const xml = `
        <blue.soundObject.PolyObject name="test">
          <defaultHeightIndex>0</defaultHeightIndex>
          <soundLayer name="Layer 1" muted="false" solo="false" heightIndex="1">
            <backgroundColor>-1</backgroundColor>
            <noteProcessorChain/>
          </soundLayer>
        </blue.soundObject.PolyObject>
      `;
      const elem = Element.parse(xml);
      const poly = PolyObject.loadFromXML(elem);
      expect(poly.length).toBe(1);
      const layer = poly[0];
      expect(layer.getHeightIndex()).toBe(1);
      expect(layer.getCustomHeight()).toBeUndefined();
      expect(layer.getLayerHeight()).toBe(44);

      // Saving should NOT add customHeight
      const saved = poly.saveAsXML();
      const savedLayer = saved.getElement('soundLayer')!;
      expect(savedLayer.getAttribute('customHeight')).toBeNull();
      expect(savedLayer.getAttribute('heightIndex')).toBe('1');
    });

    it('preserves legacy SoundLayer heights above 660 (e.g. index 40 -> 902)', () => {
      const xml = `
        <blue.soundObject.PolyObject name="test">
          <defaultHeightIndex>0</defaultHeightIndex>
          <soundLayer name="Layer 1" muted="false" solo="false" heightIndex="40">
            <backgroundColor>-1</backgroundColor>
            <noteProcessorChain/>
          </soundLayer>
        </blue.soundObject.PolyObject>
      `;
      const elem = Element.parse(xml);
      const poly = PolyObject.loadFromXML(elem);
      const layer = poly[0];
      expect(layer.getHeightIndex()).toBe(40);
      expect(layer.getCustomHeight()).toBeUndefined();
      expect(layer.getLayerHeight()).toBe(902);

      // Reserialization preserves heightIndex="40" with no customHeight
      const saved = poly.saveAsXML();
      const savedLayer = saved.getElement('soundLayer')!;
      expect(savedLayer.getAttribute('heightIndex')).toBe('40');
      expect(savedLayer.getAttribute('customHeight')).toBeNull();
    });

    it('loads customHeight="57" and serializes it accurately', () => {
      const xml = `
        <blue.soundObject.PolyObject name="test">
          <defaultHeightIndex>0</defaultHeightIndex>
          <soundLayer name="Layer 1" muted="false" solo="false" heightIndex="2" customHeight="57">
            <backgroundColor>-1</backgroundColor>
            <noteProcessorChain/>
          </soundLayer>
        </blue.soundObject.PolyObject>
      `;
      const elem = Element.parse(xml);
      const poly = PolyObject.loadFromXML(elem);
      const layer = poly[0];
      expect(layer.getHeightIndex()).toBe(2);
      expect(layer.getCustomHeight()).toBe(57);
      expect(layer.getLayerHeight()).toBe(57);

      const saved = poly.saveAsXML();
      const savedLayer = saved.getElement('soundLayer')!;
      expect(savedLayer.getAttribute('customHeight')).toBe('57');
      expect(savedLayer.getAttribute('heightIndex')).toBe('2');
    });

    it('preserves malformed customHeight as unknown attribute and clears it on explicit edit', () => {
      const xml = `
        <blue.soundObject.PolyObject name="test">
          <defaultHeightIndex>0</defaultHeightIndex>
          <soundLayer name="Layer 1" muted="false" solo="false" heightIndex="1" customHeight="57px">
            <backgroundColor>-1</backgroundColor>
            <noteProcessorChain/>
          </soundLayer>
        </blue.soundObject.PolyObject>
      `;
      const elem = Element.parse(xml);
      const poly = PolyObject.loadFromXML(elem);
      const layer = poly[0];
      expect(layer.getCustomHeight()).toBeUndefined();
      expect(layer.getLayerHeight()).toBe(44); // falls back to heightIndex 1 -> 44
      expect(layer.getUnknownAttributes().get('customHeight')).toBe('57px');

      // Saving without edit preserves verbatim malformed attribute
      const saved = poly.saveAsXML();
      const savedLayer = saved.getElement('soundLayer')!;
      expect(savedLayer.getAttribute('customHeight')).toBe('57px');

      // No-op edit (effective height 44) does NOT clear malformed attribute
      const noOpResult = layer.setExplicitHeight(44);
      expect(noOpResult).toBe(false);
      expect(layer.getUnknownAttributes().get('customHeight')).toBe('57px');

      // Real edit clears malformed attribute
      const editResult = layer.setExplicitHeight(57);
      expect(editResult).toBe(true);
      expect(layer.getCustomHeight()).toBe(57);
      expect(layer.getUnknownAttributes().has('customHeight')).toBe(false);

      const savedAfterEdit = poly.saveAsXML();
      const savedLayerAfterEdit = savedAfterEdit.getElement('soundLayer')!;
      expect(savedLayerAfterEdit.getAttribute('customHeight')).toBe('57');
    });

    it('supports boundary values 22 and 660', () => {
      const layer = new SoundLayer();
      layer.setExplicitHeight(22);
      expect(layer.getLayerHeight()).toBe(22);
      expect(layer.getHeightIndex()).toBe(0);
      expect(layer.getCustomHeight()).toBeUndefined(); // 22 is preset 0

      layer.setExplicitHeight(660);
      expect(layer.getLayerHeight()).toBe(660);
      expect(layer.getHeightIndex()).toBe(8); // clamped to 8
      expect(layer.getCustomHeight()).toBe(660); // 660 is not a preset for SoundLayer
    });

    it('propagates customHeight through deepCopy and history copy', () => {
      const layer = new SoundLayer();
      layer.setExplicitHeight(57);

      const dupCopy = layer.deepCopy('duplication');
      expect(dupCopy.getCustomHeight()).toBe(57);
      expect(dupCopy.getLayerHeight()).toBe(57);
      expect(dupCopy.getHeightIndex()).toBe(2);

      const histCopy = layer.deepCopy('history');
      expect(histCopy.getCustomHeight()).toBe(57);
      expect(histCopy.getLayerHeight()).toBe(57);
      expect(histCopy.getHeightIndex()).toBe(2);
    });
  });

  describe('Track XML Serialization & Clamping', () => {
    it('loads legacy Track without customHeight and preserves load clamp', () => {
      const xml = `
        <track name="Track 1" muted="false" solo="false" heightIndex="40" uniqueId="test-track-1" automationSelectedIndex="0">
          <backgroundColor>-1</backgroundColor>
          <noteProcessorChain/>
        </track>
      `;
      const elem = Element.parse(xml);
      const track = Track.loadFromXML(elem);
      // Track load clamps index to HEIGHT_MAX_INDEX (9)
      expect(track.getHeightIndex()).toBe(9);
      expect(track.getCustomHeight()).toBeUndefined();
      expect(track.getLayerHeight()).toBe(220);

      const saved = track.saveAsXML();
      expect(saved.getAttribute('heightIndex')).toBe('9');
      expect(saved.getAttribute('customHeight')).toBeNull();
    });

    it('loads Track with customHeight="333" and round-trips exactly', () => {
      const xml = `
        <track name="Track 1" muted="false" solo="false" heightIndex="9" customHeight="333" uniqueId="test-track-1" automationSelectedIndex="0">
          <backgroundColor>-1</backgroundColor>
          <noteProcessorChain/>
        </track>
      `;
      const elem = Element.parse(xml);
      const track = Track.loadFromXML(elem);
      expect(track.getHeightIndex()).toBe(9);
      expect(track.getCustomHeight()).toBe(333);
      expect(track.getLayerHeight()).toBe(333);

      const saved = track.saveAsXML();
      expect(saved.getAttribute('heightIndex')).toBe('9');
      expect(saved.getAttribute('customHeight')).toBe('333');
    });

    it('preserves malformed Track customHeight until a real edit', () => {
      const xml = `
        <track name="Track 1" muted="false" solo="false" heightIndex="1" customHeight="bad_value" uniqueId="test-track-1" automationSelectedIndex="0">
          <backgroundColor>-1</backgroundColor>
          <noteProcessorChain/>
        </track>
      `;
      const elem = Element.parse(xml);
      const track = Track.loadFromXML(elem);
      expect(track.getCustomHeight()).toBeUndefined();
      expect(track.getLayerHeight()).toBe(44);

      // Verbatim preservation
      const saved = track.saveAsXML();
      expect(saved.getAttribute('customHeight')).toBe('bad_value');

      // Real edit clears bad value
      track.setExplicitHeight(57);
      expect(track.getCustomHeight()).toBe(57);
      const savedAfter = track.saveAsXML();
      expect(savedAfter.getAttribute('customHeight')).toBe('57');
    });

    it('handles Track preset 220 without customHeight', () => {
      const track = new Track();
      track.setExplicitHeight(220);
      expect(track.getHeightIndex()).toBe(9);
      expect(track.getCustomHeight()).toBeUndefined();
      expect(track.getLayerHeight()).toBe(220);

      const saved = track.saveAsXML();
      expect(saved.getAttribute('heightIndex')).toBe('9');
      expect(saved.getAttribute('customHeight')).toBeNull();
    });

    it('propagates Track customHeight through deepCopy and history copy', () => {
      const track = new Track();
      track.setExplicitHeight(150);

      const dup = track.deepCopy('duplication');
      expect(dup.getCustomHeight()).toBe(150);
      expect(dup.getLayerHeight()).toBe(150);

      const hist = track.deepCopy('history');
      expect(hist.getCustomHeight()).toBe(150);
      expect(hist.getLayerHeight()).toBe(150);
    });
  });

  describe('Group Defaults', () => {
    it('clamps PolyObject defaultHeightIndex to 0-8', () => {
      const poly = new PolyObject();
      poly.setDefaultHeightIndex(2);
      expect(poly.getDefaultHeightIndex()).toBe(2);

      poly.setDefaultHeightIndex(-5);
      expect(poly.getDefaultHeightIndex()).toBe(0);

      poly.setDefaultHeightIndex(20);
      expect(poly.getDefaultHeightIndex()).toBe(8);
    });

    it('creates new SoundLayer with group default height index and no customHeight', () => {
      const poly = new PolyObject();
      poly.setDefaultHeightIndex(3);
      poly.newLayerAt(0);
      const layer = poly[0];
      expect(layer.getHeightIndex()).toBe(3);
      expect(layer.getCustomHeight()).toBeUndefined();
      expect(layer.getLayerHeight()).toBe(88);
    });

    it('preserves an invalid imported PolyObject default while new layers fall back to 22px', () => {
      const poly = PolyObject.loadFromXML(
        Element.parse(
          '<blue.soundObject.PolyObject><defaultHeightIndex>99</defaultHeightIndex></blue.soundObject.PolyObject>',
        ),
      );

      expect(poly.getDefaultHeightIndex()).toBe(99);
      poly.newLayerAt(0);
      expect(poly[0]?.getLayerHeight()).toBe(22);
      expect(poly.saveAsXML().getElement('defaultHeightIndex')?.getTextString()).toBe('99');
    });

    it('clamps TrackLayerGroup defaultHeightIndex to 0-9', () => {
      const group = new TrackLayerGroup();
      group.setDefaultHeightIndex(5);
      expect(group.getDefaultHeightIndex()).toBe(5);

      group.setDefaultHeightIndex(-1);
      expect(group.getDefaultHeightIndex()).toBe(0);

      group.setDefaultHeightIndex(20);
      expect(group.getDefaultHeightIndex()).toBe(9);
    });

    it('creates new Track with group default height index and no customHeight', () => {
      const group = new TrackLayerGroup();
      group.setDefaultHeightIndex(4);
      const track = group.newLayerAt(0);
      expect(track.getHeightIndex()).toBe(4);
      expect(track.getCustomHeight()).toBeUndefined();
      expect(track.getLayerHeight()).toBe(110);
    });

    it('preserves an invalid imported Track default while new tracks fall back to 22px', () => {
      const group = TrackLayerGroup.loadFromXML(
        Element.parse(
          '<trackLayerGroup><defaultHeightIndex>99</defaultHeightIndex><tracks/></trackLayerGroup>',
        ),
      );

      expect(group.getDefaultHeightIndex()).toBe(99);
      const track = group.newLayerAt(0);
      expect(track.getLayerHeight()).toBe(22);
      expect(group.saveAsXML().getElement('defaultHeightIndex')?.getTextString()).toBe('99');
    });
  });

  describe('CSD Generation Invariance', () => {
    it('produces identical CSD output regardless of layer height resizing', () => {
      const poly = new PolyObject(true);
      const layer = new SoundLayer();
      layer.setHeightIndex(1); // 44px

      const scoreObj = new GenericScore();
      scoreObj.setScoreText('i1 0 2 0.5 440\n');
      layer.push(scoreObj);
      poly.push(layer);

      const context = new TimeContext();
      const compileData = new CompileData();

      // CSD with layer at 44px
      const csd1 = poly.generateForCSD(context, compileData, 0, 10);
      const text1 = csd1.toString();

      // Resize layer to custom 57px
      layer.setExplicitHeight(57);
      expect(layer.getLayerHeight()).toBe(57);

      const csd2 = poly.generateForCSD(context, compileData, 0, 10);
      const text2 = csd2.toString();

      expect(text1).toBe(text2);

      // Resize layer to 150px
      layer.setExplicitHeight(150);
      const csd3 = poly.generateForCSD(context, compileData, 0, 10);
      expect(csd3.toString()).toBe(text1);
    });
  });
});
