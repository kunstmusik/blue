import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { Track } from './track/track';
import { PatternLayer } from './patterns/pattern-layer';
import { DEFAULT_LAYER_COLOR, normalizeLayerColor } from './layers/layer-color';

describe('Layer Color XML Serialization (US4)', () => {
  describe('SoundLayer / PolyObject XML', () => {
    it('round-trips custom signed backgroundColor in PolyObject soundLayer', () => {
      const poly = new PolyObject();
      const layer = new SoundLayer();
      layer.setBackgroundColor(-65536); // 0xFFFF0000
      poly.push(layer);

      const xml = poly.saveAsXML();
      const layerElem = xml.getElement('soundLayer');
      expect(layerElem).toBeDefined();
      expect(layerElem!.getTextString('backgroundColor')).toBe('-65536');

      const reloaded = PolyObject.loadFromXML(xml);
      expect(Array.from(reloaded)[0].getBackgroundColor()).toBe(-65536);
    });

    it('falls back to DEFAULT_LAYER_COLOR when backgroundColor is missing or malformed', () => {
      const missingXml = Element.parse(`
        <polyObject>
          <soundLayer name="Layer 1">
          </soundLayer>
        </polyObject>
      `);
      const poly1 = PolyObject.loadFromXML(missingXml);
      expect(Array.from(poly1)[0].getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const malformedXml = Element.parse(`
        <polyObject>
          <soundLayer name="Layer 1">
            <backgroundColor>not-a-number</backgroundColor>
          </soundLayer>
        </polyObject>
      `);
      const poly2 = PolyObject.loadFromXML(malformedXml);
      expect(Array.from(poly2)[0].getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const partialNumericXml = Element.parse(`
        <polyObject>
          <soundLayer name="Layer 1">
            <backgroundColor>-12566464px</backgroundColor>
          </soundLayer>
        </polyObject>
      `);
      const poly3 = PolyObject.loadFromXML(partialNumericXml);
      expect(Array.from(poly3)[0].getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
    });

    it('preserves unknown attributes and children across load and save', () => {
      const xml = Element.parse(`
        <polyObject>
          <soundLayer name="Layer 1" customAttr="myValue">
            <backgroundColor>-65536</backgroundColor>
            <customSoundLayerPlugin param="value">content</customSoundLayerPlugin>
          </soundLayer>
        </polyObject>
      `);
      const poly = PolyObject.loadFromXML(xml);
      const layer = Array.from(poly)[0];
      expect(layer.getBackgroundColor()).toBe(-65536);
      expect(layer.getUnknownAttributes().get('customAttr')).toBe('myValue');
      expect(layer.getUnknownChildren()).toHaveLength(1);

      const saved = poly.saveAsXML();
      const savedLayer = saved.getElement('soundLayer')!;
      expect(savedLayer.getAttribute('customAttr')).toBe('myValue');
      expect(savedLayer.getElement('customSoundLayerPlugin')).toBeDefined();
      expect(savedLayer.getTextString('backgroundColor')).toBe('-65536');

      // Exactly one backgroundColor element
      const colorNodes: Element[] = [];
      const nodes = savedLayer.getElements();
      while (nodes.hasMoreElements()) {
        const n = nodes.next();
        if (n.getName() === 'backgroundColor') colorNodes.push(n);
      }
      expect(colorNodes).toHaveLength(1);
    });

    it('emits exactly one backgroundColor element on save', () => {
      const poly = new PolyObject();
      const layer = new SoundLayer();
      layer.setBackgroundColor(-16711936);
      poly.push(layer);

      const xml = poly.saveAsXML();
      const layerElem = xml.getElement('soundLayer')!;
      const colorNodes: Element[] = [];
      const nodes = layerElem.getElements();
      while (nodes.hasMoreElements()) {
        const node = nodes.next();
        if (node.getName() === 'backgroundColor') {
          colorNodes.push(node);
        }
      }
      expect(colorNodes.length).toBe(1);
      expect(colorNodes[0].getTextString()).toBe('-16711936');
    });

    it('preserves an unsupported soundObject child when the loader returns null', () => {
      const xml = Element.parse(`
        <polyObject>
          <soundLayer name="Layer 1">
            <soundObject type="com.example.UnsupportedSoundObject" custom="keep-me">
              <name>Unsupported source</name>
              <unsupportedPayload>opaque content</unsupportedPayload>
            </soundObject>
          </soundLayer>
        </polyObject>
      `);

      const poly = PolyObject.loadFromXML(xml);
      const saved = poly.saveAsXML().toXml();

      expect(saved).toContain('type="com.example.UnsupportedSoundObject"');
      expect(saved).toContain('custom="keep-me"');
      expect(saved).toContain('<unsupportedPayload>opaque content</unsupportedPayload>');
    });
  });

  describe('Track XML', () => {
    it('round-trips custom signed backgroundColor and preserves unknown children', () => {
      const trackXml = `
        <track name="Track 1" muted="false" solo="false" heightIndex="0" uniqueId="trk-1" automationSelectedIndex="0">
          <backgroundColor>-16711936</backgroundColor>
          <customExtensionPlugin id="ext-1">test</customExtensionPlugin>
        </track>
      `;
      const elem = Element.parse(trackXml);
      const track = Track.loadFromXML(elem);
      expect(track.getBackgroundColor()).toBe(-16711936);

      const saved = track.saveAsXML();
      expect(saved.getTextString('backgroundColor')).toBe('-16711936');
      expect(saved.getElement('customExtensionPlugin')).toBeDefined();

      // Ensure backgroundColor is not duplicated into unknownChildren
      const colorNodes: Element[] = [];
      const nodes = saved.getElements();
      while (nodes.hasMoreElements()) {
        const node = nodes.next();
        if (node.getName() === 'backgroundColor') {
          colorNodes.push(node);
        }
      }
      expect(colorNodes.length).toBe(1);
    });

    it('falls back to DEFAULT_LAYER_COLOR when Track backgroundColor is missing, invalid, or partially numeric', () => {
      const missingXml = Element.parse('<track name="Track 1" uniqueId="trk-1" />');
      const track1 = Track.loadFromXML(missingXml);
      expect(track1.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const invalidXml = Element.parse(`
        <track name="Track 1" uniqueId="trk-1">
          <backgroundColor>garbage</backgroundColor>
        </track>
      `);
      const track2 = Track.loadFromXML(invalidXml);
      expect(track2.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const partialXml = Element.parse(`
        <track name="Track 1" uniqueId="trk-1">
          <backgroundColor>-16711936suffix</backgroundColor>
        </track>
      `);
      const track3 = Track.loadFromXML(partialXml);
      expect(track3.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
    });
  });

  describe('PatternLayer XML', () => {
    it('round-trips custom signed backgroundColor', () => {
      const layer = new PatternLayer();
      layer.setBackgroundColor(-65536);
      const saved = layer.saveAsXML();
      expect(saved.getTextString('backgroundColor')).toBe('-65536');

      const reloaded = PatternLayer.loadFromXML(saved);
      expect(reloaded.getBackgroundColor()).toBe(-65536);
    });

    it('falls back to DEFAULT_LAYER_COLOR when PatternLayer backgroundColor is missing, invalid, or partially numeric', () => {
      const missingXml = Element.parse('<patternLayer name="Pat 1" />');
      const layer1 = PatternLayer.loadFromXML(missingXml);
      expect(layer1.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const invalidXml = Element.parse(`
        <patternLayer name="Pat 1">
          <backgroundColor>invalid</backgroundColor>
        </patternLayer>
      `);
      const layer2 = PatternLayer.loadFromXML(invalidXml);
      expect(layer2.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const partialXml = Element.parse(`
        <patternLayer name="Pat 1">
          <backgroundColor>-65536px</backgroundColor>
        </patternLayer>
      `);
      const layer3 = PatternLayer.loadFromXML(partialXml);
      expect(layer3.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);
    });

    it('preserves unknown attributes and children across load and save', () => {
      const xml = Element.parse(`
        <patternLayer name="Pat 1" customAttr="customVal">
          <backgroundColor>-65536</backgroundColor>
          <patternExtraData id="p1">extra</patternExtraData>
        </patternLayer>
      `);
      const layer = PatternLayer.loadFromXML(xml);
      expect(layer.getBackgroundColor()).toBe(-65536);
      expect(layer.getUnknownAttributes().get('customAttr')).toBe('customVal');
      expect(layer.getUnknownChildren()).toHaveLength(1);

      const saved = layer.saveAsXML();
      expect(saved.getAttribute('customAttr')).toBe('customVal');
      expect(saved.getElement('patternExtraData')).toBeDefined();
      expect(saved.getTextString('backgroundColor')).toBe('-65536');

      const colorNodes: Element[] = [];
      const nodes = saved.getElements();
      while (nodes.hasMoreElements()) {
        const n = nodes.next();
        if (n.getName() === 'backgroundColor') colorNodes.push(n);
      }
      expect(colorNodes).toHaveLength(1);
    });

    it('emits exactly one backgroundColor child on save', () => {
      const layer = new PatternLayer();
      layer.setBackgroundColor(-16776961);
      const saved = layer.saveAsXML();
      const colorNodes: Element[] = [];
      const nodes = saved.getElements();
      while (nodes.hasMoreElements()) {
        const node = nodes.next();
        if (node.getName() === 'backgroundColor') {
          colorNodes.push(node);
        }
      }
      expect(colorNodes.length).toBe(1);
      expect(colorNodes[0].getTextString()).toBe('-16776961');
    });

    it('preserves an unsupported source soundObject instead of saving a synthetic fallback', () => {
      const xml = Element.parse(`
        <patternLayer name="Pat 1">
          <soundObject type="com.example.UnsupportedSoundObject" custom="keep-me">
            <name>Unsupported source</name>
            <unsupportedPayload>opaque content</unsupportedPayload>
          </soundObject>
          <patternData>
            <patternData-boolean>true</patternData-boolean>
          </patternData>
        </patternLayer>
      `);

      const layer = PatternLayer.loadFromXML(xml);
      const saved = layer.saveAsXML().toXml();

      expect(saved).toContain('type="com.example.UnsupportedSoundObject"');
      expect(saved).toContain('custom="keep-me"');
      expect(saved).toContain('<unsupportedPayload>opaque content</unsupportedPayload>');
      expect(saved).not.toContain('type="blue.soundObject.GenericScore"');
    });
  });
});
