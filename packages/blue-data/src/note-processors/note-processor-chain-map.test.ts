import { describe, it, expect } from 'vite-plus/test';
import { NoteProcessorChainMap } from './note-processor-chain-map';
import { NoteProcessorChain } from './note-processor-chain';
import { Element } from '../serialization/xml-reader';

describe('NoteProcessorChainMap', () => {
  describe('default state', () => {
    it('has no chains', () => {
      const map = new NoteProcessorChainMap();
      expect(map.getChainNames()).toEqual([]);
    });
  });

  describe('chain management', () => {
    it('stores and retrieves chains by name', () => {
      const map = new NoteProcessorChainMap();
      const chain = new NoteProcessorChain();
      map.setChain('myChain', chain);
      expect(map.getChain('myChain')).toBe(chain);
    });

    it('returns undefined for unknown chain', () => {
      const map = new NoteProcessorChainMap();
      expect(map.getChain('unknown')).toBeUndefined();
    });

    it('returns all chain names', () => {
      const map = new NoteProcessorChainMap();
      map.setChain('chain1', new NoteProcessorChain());
      map.setChain('chain2', new NoteProcessorChain());
      const names = map.getChainNames();
      expect(names).toContain('chain1');
      expect(names).toContain('chain2');
      expect(names.length).toBe(2);
    });
  });

  describe('loadFromXML', () => {
    it('loads empty map', () => {
      const xml = '<noteProcessorChainMap></noteProcessorChainMap>';
      const elem = Element.parse(xml);
      const map = NoteProcessorChainMap.loadFromXML(elem);
      expect(map.getChainNames()).toEqual([]);
    });

    it('loads named chains', () => {
      const xml = `<noteProcessorChainMap>
        <noteProcessorChain name="chain1"/>
        <noteProcessorChain name="chain2"/>
      </noteProcessorChainMap>`;
      const elem = Element.parse(xml);
      const map = NoteProcessorChainMap.loadFromXML(elem);
      expect(map.getChainNames()).toContain('chain1');
      expect(map.getChainNames()).toContain('chain2');
    });
  });

  describe('saveAsXML', () => {
    it('saves as noteProcessorChainMap element', () => {
      const map = new NoteProcessorChainMap();
      const xml = map.saveAsXML();
      expect(xml.getName()).toBe('noteProcessorChainMap');
    });

    it('saves named chains', () => {
      const map = new NoteProcessorChainMap();
      map.setChain('chain1', new NoteProcessorChain());
      map.setChain('chain2', new NoteProcessorChain());

      const xml = map.saveAsXML();
      const children = xml.getElements();
      let count = 0;
      while (children.hasMoreElements()) {
        children.next();
        count++;
      }
      expect(count).toBe(2);
    });
  });

  describe('round-trip', () => {
    it('preserves chains through save/load', () => {
      const original = new NoteProcessorChainMap();
      original.setChain('chain1', new NoteProcessorChain());
      original.setChain('chain2', new NoteProcessorChain());

      const xml = original.saveAsXML();
      const loaded = NoteProcessorChainMap.loadFromXML(xml);

      expect(loaded.getChainNames()).toContain('chain1');
      expect(loaded.getChainNames()).toContain('chain2');
      expect(loaded.getChainNames().length).toBe(2);
    });
  });

  describe('deepCopy', () => {
    it('creates independent copy', () => {
      const original = new NoteProcessorChainMap();
      original.setChain('chain1', new NoteProcessorChain());

      const copy = original.deepCopy() as NoteProcessorChainMap;
      expect(copy.getChain('chain1')).toBeDefined();
      expect(copy.getChain('chain1')).not.toBe(original.getChain('chain1'));
    });
  });
});
