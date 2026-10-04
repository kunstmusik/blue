import { describe, expect, it } from 'vitest';
import '../sound-objects/register-sound-object-types';
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

    it('defaults missing backgroundColor and rejects malformed values', () => {
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
      expect(() => PolyObject.loadFromXML(malformedXml)).toThrow();

      const partialNumericXml = Element.parse(`
        <polyObject>
          <soundLayer name="Layer 1">
            <backgroundColor>-12566464px</backgroundColor>
          </soundLayer>
        </polyObject>
      `);
      expect(() => PolyObject.loadFromXML(partialNumericXml)).toThrow();
    });

    it('rejects unknown SoundLayer attributes and children', () => {
      expect(() =>
        PolyObject.loadFromXML(
          Element.parse('<polyObject><soundLayer customAttr="x"/></polyObject>'),
        ),
      ).toThrow();
      expect(() =>
        PolyObject.loadFromXML(
          Element.parse('<polyObject><soundLayer><future/></soundLayer></polyObject>'),
        ),
      ).toThrow();
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

    it('rejects unsupported nested SoundObjects', () => {
      expect(() =>
        PolyObject.loadFromXML(
          Element.parse(
            '<polyObject><soundLayer><soundObject type="foreign"/></soundLayer></polyObject>',
          ),
        ),
      ).toThrow();
    });
  });

  describe('Track XML', () => {
    it('round-trips custom signed backgroundColor', () => {
      const trackXml = `
        <track name="Track 1" muted="false" solo="false" heightIndex="0" uniqueId="trk-1" automationSelectedIndex="0">
          <backgroundColor>-16711936</backgroundColor>
        </track>
      `;
      const elem = Element.parse(trackXml);
      const track = Track.loadFromXML(elem);
      expect(track.getBackgroundColor()).toBe(-16711936);

      const saved = track.saveAsXML();
      expect(saved.getTextString('backgroundColor')).toBe('-16711936');

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

    it('defaults missing Track color and rejects invalid or partial numeric values', () => {
      const missingXml = Element.parse('<track name="Track 1" uniqueId="trk-1" />');
      const track1 = Track.loadFromXML(missingXml);
      expect(track1.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const invalidXml = Element.parse(`
        <track name="Track 1" uniqueId="trk-1">
          <backgroundColor>garbage</backgroundColor>
        </track>
      `);
      expect(() => Track.loadFromXML(invalidXml)).toThrow();

      const partialXml = Element.parse(`
        <track name="Track 1" uniqueId="trk-1">
          <backgroundColor>-16711936suffix</backgroundColor>
        </track>
      `);
      expect(() => Track.loadFromXML(partialXml)).toThrow();
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

    it('defaults missing PatternLayer color and rejects invalid or partial numeric values', () => {
      const missingXml = Element.parse('<patternLayer name="Pat 1" />');
      const layer1 = PatternLayer.loadFromXML(missingXml);
      expect(layer1.getBackgroundColor()).toBe(DEFAULT_LAYER_COLOR);

      const invalidXml = Element.parse(`
        <patternLayer name="Pat 1">
          <backgroundColor>invalid</backgroundColor>
        </patternLayer>
      `);
      expect(() => PatternLayer.loadFromXML(invalidXml)).toThrow();

      const partialXml = Element.parse(`
        <patternLayer name="Pat 1">
          <backgroundColor>-65536px</backgroundColor>
        </patternLayer>
      `);
      expect(() => PatternLayer.loadFromXML(partialXml)).toThrow();
    });

    it('rejects unknown PatternLayer attributes and children', () => {
      expect(() =>
        PatternLayer.loadFromXML(Element.parse('<patternLayer customAttr="x"/>')),
      ).toThrow();
      expect(() =>
        PatternLayer.loadFromXML(Element.parse('<patternLayer><future/></patternLayer>')),
      ).toThrow();
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

    it('rejects unsupported source SoundObjects', () => {
      expect(() =>
        PatternLayer.loadFromXML(
          Element.parse('<patternLayer><soundObject type="foreign"/></patternLayer>'),
        ),
      ).toThrow();
    });
  });
});
