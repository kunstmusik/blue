import { describe, it, expect } from 'vitest';
import {
  getAllSoundObjectTypeDescriptors,
  getTrackPlacementForSoundObject,
  loadSoundObjectFromXML,
  normalizeClassName,
  registerSoundObjectType,
} from './sound-object-registry';
import { Element } from '../serialization/xml-reader';
import './register-sound-object-types';
import { GenericScore } from './generic-score';

describe('SoundObjectRegistry', () => {
  describe('normalizeClassName', () => {
    it('strips Java package prefix', () => {
      expect(normalizeClassName('blue.soundObject.GenericScore')).toBe('GenericScore');
    });

    it('handles nested packages', () => {
      expect(normalizeClassName('blue.soundObject.PolyObject')).toBe('PolyObject');
    });

    it('returns short name as-is', () => {
      expect(normalizeClassName('GenericScore')).toBe('GenericScore');
    });

    it('handles null', () => {
      expect(normalizeClassName(null)).toBe('');
    });

    it('handles empty string', () => {
      expect(normalizeClassName('')).toBe('');
    });
  });

  describe('loadSoundObjectFromXML', () => {
    it('loads GenericScore by short name', () => {
      const xml = '<soundObject type="GenericScore"><name>Test</name><scoreText>i1 0 1 440</scoreText></soundObject>';
      const elem = Element.parse(xml);
      const obj = loadSoundObjectFromXML(elem);
      expect(obj).not.toBeNull();
      expect(obj?.getName()).toBe('Test');
    });

    it('loads GenericScore by Java full class name', () => {
      const xml = '<soundObject type="blue.soundObject.GenericScore"><name>Test</name><scoreText>i1 0 1 440</scoreText></soundObject>';
      const elem = Element.parse(xml);
      const obj = loadSoundObjectFromXML(elem);
      expect(obj).not.toBeNull();
      expect(obj?.getName()).toBe('Test');
    });

    it('returns null for unknown type', () => {
      const xml = '<soundObject type="UnknownType"><name>Test</name></soundObject>';
      const elem = Element.parse(xml);
      const obj = loadSoundObjectFromXML(elem);
      expect(obj).toBeNull();
    });

    it('returns null for missing type', () => {
      const xml = '<soundObject><name>Test</name></soundObject>';
      const elem = Element.parse(xml);
      const obj = loadSoundObjectFromXML(elem);
      expect(obj).toBeNull();
    });
  });

  describe('Track placement descriptors', () => {
    it('declares a complete descriptor for every built-in registration', () => {
      const descriptors = getAllSoundObjectTypeDescriptors();
      const names = new Set(descriptors.map((descriptor) => descriptor.typeName));
      const expected = [
        'GenericScore', 'PolyObject', 'PythonObject', 'ClojureObject', 'JavaScriptObject',
        'CSDSoundObject', 'Comment', 'AudioFile', 'Sound', 'External', 'Instance',
        'LineObject', 'ZakLineObject', 'PatternObject', 'PianoRoll', 'JMask',
        'TrackerObject', 'FrozenSoundObject', 'ObjectBuilder',
      ];

      expect(expected.every((name) => names.has(name))).toBe(true);
      for (const descriptor of descriptors) {
        expect(['compatible', 'incompatible']).toContain(descriptor.trackPlacement);
        expect(['assignable', 'propagated', 'preserve', 'none']).toContain(
          descriptor.instrumentTargetBehavior,
        );
        if (descriptor.trackPlacement === 'incompatible') {
          expect(descriptor.trackPlacementReason).toBeTruthy();
        }
      }
    });

    it('denies unknown sound-object classes by default', () => {
      const unknown = { constructor: { name: 'UnregisteredSoundObject' } } as unknown as GenericScore;
      const placement = getTrackPlacementForSoundObject(unknown);
      expect(placement.compatible).toBe(false);
      expect(placement.reason).toContain('not registered');
    });

    it('returns the declared descriptor for a built-in object', () => {
      const placement = getTrackPlacementForSoundObject(new GenericScore());
      expect(placement.compatible).toBe(true);
      expect(placement.descriptor?.instrumentTargetBehavior).toBe('assignable');
    });
  });
});
