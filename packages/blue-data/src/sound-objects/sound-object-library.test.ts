import { describe, it, expect } from 'vitest';
import { SoundObjectLibrary } from './sound-object-library';
import { GenericScore } from './generic-score';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import './register-sound-object-types';

describe('SoundObjectLibrary', () => {
  describe('default state', () => {
    it('has empty library', () => {
      const lib = new SoundObjectLibrary();
      expect(lib.size()).toBe(0);
      expect(lib.getAllObjects()).toEqual([]);
    });
  });

  describe('addObject', () => {
    it('adds objects and returns id', () => {
      const lib = new SoundObjectLibrary();
      const obj = new GenericScore();
      obj.setName('Test');
      const id = lib.addObject(obj);
      expect(id).toBeTruthy();
      expect(lib.size()).toBe(1);
    });
  });

  describe('loadFromXML', () => {
    it('loads empty library', () => {
      const xml = '<soundObjectLibrary></soundObjectLibrary>';
      const elem = Element.parse(xml);
      const lib = SoundObjectLibrary.loadFromXML(elem);
      expect(lib.size()).toBe(0);
    });

    it('loads library with sound objects', () => {
      const xml = `<soundObjectLibrary>
        <soundObject type="GenericScore" objRefId="lib_0">
          <name>Test Score</name>
          <scoreText>i1 0 1 440</scoreText>
        </soundObject>
      </soundObjectLibrary>`;
      const elem = Element.parse(xml);
      const objRefMap = new ObjRefLoadMap();
      const lib = SoundObjectLibrary.loadFromXML(elem, objRefMap);
      expect(lib.size()).toBe(1);
      expect(lib.getObject(0)?.getName()).toBe('Test Score');
    });

    it('registers objects in objRefMap', () => {
      const xml = `<soundObjectLibrary>
        <soundObject type="GenericScore" objRefId="lib_0">
          <name>Test</name>
          <scoreText>i1 0 1 440</scoreText>
        </soundObject>
      </soundObjectLibrary>`;
      const elem = Element.parse(xml);
      const objRefMap = new ObjRefLoadMap();
      SoundObjectLibrary.loadFromXML(elem, objRefMap);
      expect(objRefMap.has('lib_0')).toBe(true);
    });
  });

  describe('saveAsXML', () => {
    it('saves as soundObjectLibrary element', () => {
      const lib = new SoundObjectLibrary();
      const xml = lib.saveAsXML();
      expect(xml.getName()).toBe('soundObjectLibrary');
    });

    it('saves objects with objRefId', () => {
      const lib = new SoundObjectLibrary();
      const obj = new GenericScore();
      obj.setName('Test');
      lib.addObject(obj);

      const objRefMap = new ObjRefSaveMap();
      const xml = lib.saveAsXML(objRefMap);
      const children = xml.getElements();
      let count = 0;
      while (children.hasMoreElements()) {
        const child = children.next();
        count++;
        expect(child.getAttribute('objRefId')).toBeTruthy();
      }
      expect(count).toBe(1);
    });

    it('seeds the save map with the stable library ID before serialization', () => {
      const lib = new SoundObjectLibrary();
      const obj = new GenericScore();
      const stableId = lib.addObject(obj);
      const objRefMap = new ObjRefSaveMap();

      const xml = lib.saveAsXML(objRefMap);
      const child = xml.getElements().next();

      expect(child.getAttribute('objRefId')).toBe(stableId);
      expect(objRefMap.getId(obj)).toBe(stableId);
    });
  });

  describe('round-trip', () => {
    it('preserves library through save/load', () => {
      const lib = new SoundObjectLibrary();
      const obj = new GenericScore();
      obj.setName('Round Trip Test');
      obj.setScoreText('i1 0 1 440');
      lib.addObject(obj);

      const objRefMap = new ObjRefSaveMap();
      const xml = lib.saveAsXML(objRefMap);

      const loadMap = new ObjRefLoadMap();
      const loaded = SoundObjectLibrary.loadFromXML(xml, loadMap);

      expect(loaded.size()).toBe(1);
      expect(loaded.getObject(0)?.getName()).toBe('Round Trip Test');
    });
  });

  describe('deepCopy', () => {
    it('creates independent copy', () => {
      const lib = new SoundObjectLibrary();
      const obj = new GenericScore();
      obj.setName('Original');
      lib.addObject(obj);

      const copy = lib.deepCopy() as SoundObjectLibrary;
      expect(copy.size()).toBe(1);
      expect(copy).not.toBe(lib);
    });
  });

  describe('stable entry identity (SPEC 037)', () => {
    describe('getEntries', () => {
      it('returns entries with libraryId and object', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();
        obj.setName('Entry Test');
        const id = lib.addObject(obj);

        const entries = lib.getEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0].libraryId).toBe(id);
        expect(entries[0].object).toBe(obj);
      });

      it('returns multiple entries in insertion order', () => {
        const lib = new SoundObjectLibrary();
        const a = new GenericScore();
        a.setName('A');
        const b = new GenericScore();
        b.setName('B');
        lib.addObject(a);
        lib.addObject(b);

        const entries = lib.getEntries();
        expect(entries).toHaveLength(2);
        expect(entries[0].object.getName()).toBe('A');
        expect(entries[1].object.getName()).toBe('B');
        expect(entries[0].libraryId).not.toBe(entries[1].libraryId);
      });
    });

    describe('findIdForObject', () => {
      it('returns the ID for an object in the library', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();
        const id = lib.addObject(obj);

        expect(lib.findIdForObject(obj)).toBe(id);
      });

      it('returns null for an object not in the library', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();

        expect(lib.findIdForObject(obj)).toBeNull();
      });
    });

    describe('containsObject', () => {
      it('returns true for an object in the library', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();
        lib.addObject(obj);

        expect(lib.containsObject(obj)).toBe(true);
      });

      it('returns false for an object not in the library', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();

        expect(lib.containsObject(obj)).toBe(false);
      });
    });

    describe('getObjectById', () => {
      it('resolves objects using the internal ID map without objRefMap', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();
        obj.setName('ById');
        const id = lib.addObject(obj);

        const found = lib.getObjectById(id);
        expect(found).toBe(obj);
        expect(found?.getName()).toBe('ById');
      });

      it('returns undefined for unknown ID without objRefMap', () => {
        const lib = new SoundObjectLibrary();

        expect(lib.getObjectById('lib_999')).toBeUndefined();
      });

      it('falls back to objRefMap when provided', () => {
        const lib = new SoundObjectLibrary();
        const objRefMap = new ObjRefLoadMap();
        const obj = new GenericScore();
        obj.setName('RefMap');
        objRefMap.register('external_0', obj);

        const found = lib.getObjectById('external_0', objRefMap);
        expect(found).toBe(obj);
      });
    });

    describe('deepCopy preserves IDs', () => {
      it('preserves library IDs through deepCopy', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();
        obj.setName('CopyId');
        const id = lib.addObject(obj);

        const copy = lib.deepCopy() as SoundObjectLibrary;
        expect(copy.size()).toBe(1);

        const copiedObj = copy.getObject(0)!;
        expect(copiedObj).not.toBe(obj);
        expect(copiedObj.getName()).toBe('CopyId');
        expect(copy.findIdForObject(copiedObj)).toBe(id);
      });

      it('preserves multiple IDs in order through deepCopy', () => {
        const lib = new SoundObjectLibrary();
        const a = new GenericScore();
        a.setName('First');
        const b = new GenericScore();
        b.setName('Second');
        const idA = lib.addObject(a);
        const idB = lib.addObject(b);

        const copy = lib.deepCopy() as SoundObjectLibrary;
        const entries = copy.getEntries();
        expect(entries).toHaveLength(2);
        expect(entries[0].libraryId).toBe(idA);
        expect(entries[1].libraryId).toBe(idB);
      });
    });

    describe('loadFromXML tracks IDs', () => {
      it('tracks IDs from objRefId attributes', () => {
        const xml = `<soundObjectLibrary>
          <soundObject type="GenericScore" objRefId="lib_5">
            <name>XML Tracked</name>
            <scoreText>i1 0 1 440</scoreText>
          </soundObject>
        </soundObjectLibrary>`;
        const elem = Element.parse(xml);
        const lib = SoundObjectLibrary.loadFromXML(elem);

        expect(lib.size()).toBe(1);
        const obj = lib.getObject(0)!;
        expect(obj.getName()).toBe('XML Tracked');
        expect(lib.findIdForObject(obj)).toBe('lib_5');
      });

      it('advances nextId past loaded IDs', () => {
        const xml = `<soundObjectLibrary>
          <soundObject type="GenericScore" objRefId="lib_10">
            <name>High ID</name>
            <scoreText>i1 0 1 440</scoreText>
          </soundObject>
        </soundObjectLibrary>`;
        const elem = Element.parse(xml);
        const lib = SoundObjectLibrary.loadFromXML(elem);

        const newObj = new GenericScore();
        newObj.setName('After Load');
        const newId = lib.addObject(newObj);
        expect(newId).toBe('lib_11');
      });

      it('preserves IDs through XML round-trip', () => {
        const lib = new SoundObjectLibrary();
        const obj = new GenericScore();
        obj.setName('RoundTrip ID');
        obj.setScoreText('i1 0 1 440');
        lib.addObject(obj);

        const savedEntries = lib.getEntries();
        const savedId = savedEntries[0].libraryId;

        const xml = lib.saveAsXML();

        const loaded = SoundObjectLibrary.loadFromXML(xml);
        const loadedObj = loaded.getObject(0)!;
        expect(loaded.findIdForObject(loadedObj)).toBe(savedId);
      });
    });

    describe('fingerprint fallback', () => {
      it('resolves only one matching definition', () => {
        const lib = new SoundObjectLibrary();
        const object = new GenericScore();
        object.setName('Unique');
        lib.addObject(object);
        const fingerprint = lib.createFingerprint(object);

        expect(lib.findUniqueByFingerprint(fingerprint)).toBe(object);
      });

      it('returns undefined for ambiguous matching definitions', () => {
        const lib = new SoundObjectLibrary();
        const first = new GenericScore();
        first.setName('Duplicate');
        first.setScoreText('i1 0 1');
        const second = first.deepCopy();
        lib.addObject(first);
        lib.addObject(second);

        expect(lib.findUniqueByFingerprint(lib.createFingerprint(first))).toBeUndefined();
      });
    });
  });
});
