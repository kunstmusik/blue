import { describe, it, expect } from 'vitest';
import { ScratchPadData } from './scratch-pad-data';
import { Element } from './serialization/xml-reader';

describe('ScratchPadData', () => {
  describe('default state', () => {
    it('has empty scratch text', () => {
      const data = new ScratchPadData();
      expect(data.getScratchText()).toBe('');
    });

    it('has word wrap enabled by default', () => {
      const data = new ScratchPadData();
      expect(data.isWordWrapEnabled()).toBe(true);
    });
  });

  describe('loadFromXML', () => {
    it('loads scratchText from XML', () => {
      const xml = '<scratchPadData><scratchText>Hello World</scratchText></scratchPadData>';
      const elem = Element.parse(xml);
      const data = ScratchPadData.loadFromXML(elem);
      expect(data.getScratchText()).toBe('Hello World');
    });

    it('loads isWordWrapEnabled from XML', () => {
      const xml = '<scratchPadData><isWordWrapEnabled>false</isWordWrapEnabled></scratchPadData>';
      const elem = Element.parse(xml);
      const data = ScratchPadData.loadFromXML(elem);
      expect(data.isWordWrapEnabled()).toBe(false);
    });

    it('loads both fields together', () => {
      const xml =
        '<scratchPadData><isWordWrapEnabled>false</isWordWrapEnabled><scratchText>Notes here</scratchText></scratchPadData>';
      const elem = Element.parse(xml);
      const data = ScratchPadData.loadFromXML(elem);
      expect(data.getScratchText()).toBe('Notes here');
      expect(data.isWordWrapEnabled()).toBe(false);
    });
  });

  describe('saveAsXML', () => {
    it('saves scratchText and isWordWrapEnabled', () => {
      const data = new ScratchPadData();
      data.setScratchText('Test notes');
      data.setWordWrapEnabled(false);

      const xml = data.saveAsXML();
      expect(xml.getName()).toBe('scratchPadData');

      const textElem = xml.getElement('scratchText');
      expect(textElem).not.toBeNull();
      expect(textElem!.getTextString()).toBe('Test notes');

      const wrapElem = xml.getElement('isWordWrapEnabled');
      expect(wrapElem).not.toBeNull();
      expect(wrapElem!.getTextString()).toBe('false');
    });
  });

  describe('round-trip', () => {
    it('preserves data through save/load', () => {
      const original = new ScratchPadData();
      original.setScratchText('My scratch notes\nLine 2');
      original.setWordWrapEnabled(false);

      const xml = original.saveAsXML();
      const loaded = ScratchPadData.loadFromXML(xml);

      expect(loaded.getScratchText()).toBe('My scratch notes\nLine 2');
      expect(loaded.isWordWrapEnabled()).toBe(false);
    });
  });

  describe('deepCopy', () => {
    it('copies all fields', () => {
      const original = new ScratchPadData();
      original.setScratchText('Original text');
      original.setWordWrapEnabled(false);

      const copy = original.deepCopy() as ScratchPadData;
      expect(copy.getScratchText()).toBe('Original text');
      expect(copy.isWordWrapEnabled()).toBe(false);
    });

    it('does not share mutable state', () => {
      const original = new ScratchPadData();
      original.setScratchText('Original');
      const copy = original.deepCopy() as ScratchPadData;
      copy.setScratchText('Modified');
      expect(original.getScratchText()).toBe('Original');
    });
  });
});
