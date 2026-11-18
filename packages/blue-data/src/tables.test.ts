import { describe, it, expect } from 'vite-plus/test';
import { Tables } from './tables';
import { Element } from './serialization/xml-reader';

describe('Tables', () => {
  describe('constructor and getTables/setTables', () => {
    it('defaults to empty string', () => {
      const t = new Tables();
      expect(t.getTables()).toBe('');
    });

    it('copies from another Tables instance', () => {
      const a = new Tables();
      a.setTables('f 1 0 1024 10 1');
      const b = new Tables(a);
      expect(b.getTables()).toBe('f 1 0 1024 10 1');
    });

    it('setTables replaces the entire text', () => {
      const t = new Tables();
      t.setTables('f 1 0 1024 10 1\nf 2 0 2048 10 1');
      expect(t.getTables()).toBe('f 1 0 1024 10 1\nf 2 0 2048 10 1');
      t.setTables('');
      expect(t.getTables()).toBe('');
    });
  });

  describe('Java-compatible XML round-trip', () => {
    it('saves text content directly in <tables> element (Java format)', () => {
      const t = new Tables();
      t.setTables('f 1 0 1024 10 1\nf 2 0 2048 10 1 0.5');
      const xml = t.saveAsXML();
      expect(xml.getName()).toBe('tables');
      expect(xml.getTextString()).toBe('f 1 0 1024 10 1\nf 2 0 2048 10 1 0.5');
    });

    it('loads text content directly from <tables> element (Java format)', () => {
      const elem = Element.parse('<tables>f 1 0 1024 10 1\nf 2 0 2048 10 1</tables>');
      const t = Tables.loadFromXML(elem);
      expect(t.getTables()).toBe('f 1 0 1024 10 1\nf 2 0 2048 10 1');
    });

    it('loads empty <tables></tables> from Java format', () => {
      const elem = Element.parse('<tables></tables>');
      const t = Tables.loadFromXML(elem);
      expect(t.getTables()).toBe('');
    });

    it('round-trips text through save and load', () => {
      const original = new Tables();
      original.setTables('f 1 0 1024 10 1\nf 2 0 2048 10 1 0.5 0.25');
      const xml = original.saveAsXML();
      const loaded = Tables.loadFromXML(xml);
      expect(loaded.getTables()).toBe('f 1 0 1024 10 1\nf 2 0 2048 10 1 0.5 0.25');
    });

    it('round-trips empty tables', () => {
      const original = new Tables();
      const xml = original.saveAsXML();
      const loaded = Tables.loadFromXML(xml);
      expect(loaded.getTables()).toBe('');
    });
  });

  describe('null input handling', () => {
    it('returns empty Tables when given null', () => {
      const t = Tables.loadFromXML(null);
      expect(t.getTables()).toBe('');
    });
  });

  describe('CSD generation usage', () => {
    it('getTables returns the same text used in CSD score output', () => {
      const t = new Tables();
      t.setTables('f 1 0 1024 10 1\nf 3 0 512 -7 0 256 1 256 0');
      expect(t.getTables()).toBe('f 1 0 1024 10 1\nf 3 0 512 -7 0 256 1 256 0');
    });
  });
});
