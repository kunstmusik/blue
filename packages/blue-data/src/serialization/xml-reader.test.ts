import { describe, it, expect } from 'vitest';
import { Element, Elements } from '../serialization/xml-reader';

describe('Element', () => {
  describe('creation', () => {
    it('creates an element with a name', () => {
      const elem = new Element('blueData');
      expect(elem.getName()).toBe('blueData');
    });
  });

  describe('attributes', () => {
    it('sets and gets attributes', () => {
      const elem = new Element('blueData');
      elem.setAttribute('version', '2.9.0');
      expect(elem.getAttribute('version')).toBe('2.9.0');
      expect(elem.getAttributeValue('version')).toBe('2.9.0');
    });

    it('returns null for missing attributes', () => {
      const elem = new Element('blueData');
      expect(elem.getAttribute('missing')).toBeNull();
    });

    it('returns default value when provided', () => {
      const elem = new Element('blueData');
      expect(elem.getAttribute('missing', 'default')).toBe('default');
    });
  });

  describe('text content', () => {
    it('sets and gets text', () => {
      const elem = new Element('name');
      elem.setText('Test Project');
      expect(elem.getTextString()).toBe('Test Project');
    });
  });

  describe('child elements', () => {
    it('adds child elements by name', () => {
      const parent = new Element('blueData');
      const child = parent.addElement('projectProperties');
      expect(child.getName()).toBe('projectProperties');
      expect(child).toBeInstanceOf(Element);
    });

    it('adds existing element as child', () => {
      const parent = new Element('blueData');
      const child = new Element('score');
      parent.addElement(child);
      expect(parent.getElement('score')).toBe(child);
    });

    it('gets first child by name', () => {
      const parent = new Element('blueData');
      parent.addElement('projectProperties');
      parent.addElement('score');
      const found = parent.getElement('score');
      expect(found).not.toBeNull();
      expect(found!.getName()).toBe('score');
    });

    it('gets all children', () => {
      const parent = new Element('blueData');
      parent.addElement('projectProperties');
      parent.addElement('score');
      parent.addElement('mixer');
      const children = parent.getElements();
      expect(children.size).toBe(3);
    });

    it('gets children filtered by name', () => {
      const parent = new Element('blueData');
      parent.addElement('audioClip');
      parent.addElement('audioClip');
      parent.addElement('parameterId');
      const clips = parent.getElements('audioClip');
      expect(clips.size).toBe(2);
    });
  });

  describe('removeElement', () => {
    it('removes first child by name', () => {
      const parent = new Element('blueData');
      parent.addElement('tempo');
      const removed = parent.removeElement('tempo');
      expect(removed).not.toBeNull();
      expect(removed!.getName()).toBe('tempo');
      expect(parent.getElement('tempo')).toBeNull();
    });

    it('returns null for non-existent child', () => {
      const parent = new Element('blueData');
      expect(parent.removeElement('missing')).toBeNull();
    });
  });

  describe('removeElements', () => {
    it('removes all children by name', () => {
      const parent = new Element('patternsLayerGroup');
      parent.addElement('patternLayer');
      parent.addElement('patternLayer');
      parent.addElement('noteProcessorChain');
      const removed = parent.removeElements('patternLayer');
      expect(removed.size).toBe(2);
      expect(parent.getElements('patternLayer').size).toBe(0);
    });
  });

  describe('parsing', () => {
    it('parses simple XML', () => {
      const xml = '<blueData version="2.9.0"><name>Test</name></blueData>';
      const elem = Element.parse(xml);
      expect(elem.getName()).toBe('blueData');
      expect(elem.getAttribute('version')).toBe('2.9.0');
      expect(elem.getElement('name')!.getTextString()).toBe('Test');
    });

    it('parses nested elements', () => {
      const xml = '<root><parent><child>value</child></parent></root>';
      const elem = Element.parse(xml);
      const parent = elem.getElement('parent');
      expect(parent).not.toBeNull();
      const child = parent!.getElement('child');
      expect(child).not.toBeNull();
      expect(child!.getTextString()).toBe('value');
    });

    it('parses attributes on nested elements', () => {
      const xml = '<blueData><audioLayer name="Layer1" muted="true"></audioLayer></blueData>';
      const elem = Element.parse(xml);
      const layer = elem.getElement('audioLayer');
      expect(layer!.getAttribute('name')).toBe('Layer1');
      expect(layer!.getAttribute('muted')).toBe('true');
    });
  });

  describe('XML serialization', () => {
    it('serializes simple element', () => {
      const elem = new Element('name');
      elem.setText('Test');
      const xml = elem.toXml();
      expect(xml).toContain('<name>');
      expect(xml).toContain('Test');
      expect(xml).toContain('</name>');
    });

    it('serializes attributes', () => {
      const elem = new Element('blueData');
      elem.setAttribute('version', '2.9.0');
      const xml = elem.toXml();
      expect(xml).toContain('version="2.9.0"');
    });

    it('serializes nested structure', () => {
      const parent = new Element('blueData');
      parent.setAttribute('version', '2.9.0');
      parent.addElement('name').setText('Test');
      parent.addElement('score');
      const xml = parent.toXml();
      expect(xml).toContain('<blueData');
      expect(xml).toContain('<name>Test</name>');
      expect(xml).toContain('<score');
    });

    it('serializes empty element as self-closing', () => {
      const elem = new Element('empty');
      const xml = elem.toXml();
      expect(xml).toContain('<empty/>');
    });

    it('escapes XML special characters', () => {
      const elem = new Element('text');
      elem.setText('a < b & c > d');
      const xml = elem.toXml();
      expect(xml).toContain('a &lt; b &amp; c &gt; d');
    });

    it('round-trips parsed XML', () => {
      const original =
        '<blueData version="2.9.0"><name>Test</name><score><timeContext><tempo>60</tempo></timeContext></score></blueData>';
      const parsed = Element.parse(original);
      const serialized = parsed.toXml();
      const reparsed = Element.parse(serialized);
      expect(reparsed.getAttribute('version')).toBe('2.9.0');
      expect(reparsed.getElement('name')!.getTextString()).toBe('Test');
    });
  });
});

describe('Elements', () => {
  it('iterates over children', () => {
    const parent = new Element('root');
    parent.addElement('a');
    parent.addElement('b');
    parent.addElement('c');

    const elems = parent.getElements();
    const names: string[] = [];
    for (const elem of elems) {
      names.push(elem.getName());
    }
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('hasMoreElements works correctly', () => {
    const parent = new Element('root');
    parent.addElement('a');
    const elems = parent.getElements();
    expect(elems.hasMoreElements()).toBe(true);
    elems.next();
    expect(elems.hasMoreElements()).toBe(false);
  });

  it('toArray returns all children', () => {
    const parent = new Element('root');
    parent.addElement('a');
    parent.addElement('b');
    const elems = parent.getElements();
    const arr = elems.toArray();
    expect(arr.length).toBe(2);
    expect(arr[0].getName()).toBe('a');
    expect(arr[1].getName()).toBe('b');
  });
});
