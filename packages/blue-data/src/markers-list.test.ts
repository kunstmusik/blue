import { describe, it, expect } from 'vitest';
import { MarkersList } from './markers-list';
import { Element } from './serialization/xml-reader';
import { TimePosition } from './time/time-position';

describe('MarkersList', () => {
  describe('default state', () => {
    it('has empty markers list', () => {
      const list = new MarkersList();
      expect(list.getMarkers()).toEqual([]);
      expect(list.size()).toBe(0);
    });
  });

  describe('loadFromXML', () => {
    it('loads empty markersList', () => {
      const xml = '<markersList></markersList>';
      const elem = Element.parse(xml);
      const list = MarkersList.loadFromXML(elem);
      expect(list.getMarkers()).toEqual([]);
    });

    it('preserves unknown child elements for lossless round-trip', () => {
      const xml =
        '<markersList><marker name="A" time="1.5"/><marker name="B" time="3.0"/></markersList>';
      const elem = Element.parse(xml);
      const list = MarkersList.loadFromXML(elem);
      const saved = list.saveAsXML();
      const children = saved.getElements();
      let count = 0;
      while (children.hasMoreElements()) {
        children.next();
        count++;
      }
      expect(count).toBe(2);
    });

    it('reads marker names and times from loaded XML', () => {
      const xml =
        '<markersList><marker name="Intro">2.0</marker><marker name="Chorus">8.5</marker></markersList>';
      const elem = Element.parse(xml);
      const list = MarkersList.loadFromXML(elem);
      expect(list.size()).toBe(2);
      expect(list.getMarkerName(0)).toBe('Intro');
      expect(list.getMarkerTime(0)).toBe(2.0);
      expect(list.getMarkerName(1)).toBe('Chorus');
      expect(list.getMarkerTime(1)).toBe(8.5);
    });

    it('reads nested TimePosition marker XML', () => {
      const xml =
        '<markersList><marker name="Intro"><time type="BEATS"><csoundBeats>64</csoundBeats></time></marker></markersList>';
      const elem = Element.parse(xml);
      const list = MarkersList.loadFromXML(elem);

      expect(list.size()).toBe(1);
      expect(list.getMarkerName(0)).toBe('Intro');
      expect(list.getMarkerTimePosition(0).getTimeBase()).toBe('BEATS');
      expect(list.getMarkerTimePosition(0).getCsoundBeats()).toBe(64);
      expect(list.getMarkerTime(0)).toBe(64);
    });
  });

  describe('saveAsXML', () => {
    it('saves as markersList element', () => {
      const list = new MarkersList();
      const xml = list.saveAsXML();
      expect(xml.getName()).toBe('markersList');
    });
  });

  describe('round-trip', () => {
    it('preserves markers through save/load', () => {
      const xml = '<markersList><marker name="A" time="1.5"/></markersList>';
      const elem = Element.parse(xml);
      const list = MarkersList.loadFromXML(elem);

      const saved = list.saveAsXML();
      const loaded = MarkersList.loadFromXML(saved);
      expect(loaded.size()).toBe(1);
      expect(loaded.getMarkerName(0)).toBe('A');
    });
  });

  describe('deepCopy', () => {
    it('creates independent copy', () => {
      const original = new MarkersList();
      const copy = original.deepCopy() as MarkersList;
      expect(copy).not.toBe(original);
      expect(copy.size()).toBe(original.size());
    });

    it('copy mutations do not affect original', () => {
      const original = new MarkersList();
      original.addMarker('Test', 4.0);
      const copy = original.deepCopy() as MarkersList;
      copy.addMarker('Copy', 8.0);
      expect(original.size()).toBe(1);
      expect(copy.size()).toBe(2);
    });
  });

  describe('addMarker', () => {
    it('adds a marker and returns index', () => {
      const list = new MarkersList();
      const idx = list.addMarker('Verse', 16.0);
      expect(idx).toBe(0);
      expect(list.size()).toBe(1);
      expect(list.getMarkerName(0)).toBe('Verse');
      expect(list.getMarkerTime(0)).toBe(16.0);
    });

    it('appends multiple markers in order', () => {
      const list = new MarkersList();
      list.addMarker('A', 1.0);
      list.addMarker('B', 2.0);
      list.addMarker('C', 3.0);
      expect(list.size()).toBe(3);
      expect(list.getMarkerName(0)).toBe('A');
      expect(list.getMarkerName(2)).toBe('C');
    });

    it('round-trips added markers through XML', () => {
      const list = new MarkersList();
      list.addMarker('Intro', 0.0);
      list.addMarker('Outro', 32.0);
      const saved = list.saveAsXML();
      const loaded = MarkersList.loadFromXML(saved);
      expect(loaded.size()).toBe(2);
      expect(loaded.getMarkerName(0)).toBe('Intro');
      expect(loaded.getMarkerTime(0)).toBe(0.0);
      expect(loaded.getMarkerName(1)).toBe('Outro');
      expect(loaded.getMarkerTime(1)).toBe(32.0);
    });
  });

  describe('removeMarker', () => {
    it('removes marker by index', () => {
      const list = new MarkersList();
      list.addMarker('A', 1.0);
      list.addMarker('B', 2.0);
      list.addMarker('C', 3.0);
      list.removeMarker(1);
      expect(list.size()).toBe(2);
      expect(list.getMarkerName(0)).toBe('A');
      expect(list.getMarkerName(1)).toBe('C');
    });

    it('ignores out-of-range index', () => {
      const list = new MarkersList();
      list.addMarker('A', 1.0);
      list.removeMarker(-1);
      list.removeMarker(5);
      expect(list.size()).toBe(1);
    });
  });

  describe('setMarkerName', () => {
    it('updates marker name', () => {
      const list = new MarkersList();
      list.addMarker('Old', 4.0);
      list.setMarkerName(0, 'New');
      expect(list.getMarkerName(0)).toBe('New');
    });
  });

  describe('setMarkerTime', () => {
    it('updates marker time', () => {
      const list = new MarkersList();
      list.addMarker('M', 4.0);
      list.setMarkerTime(0, 12.5);
      expect(list.getMarkerTime(0)).toBe(12.5);
    });
  });

  describe('TimePosition helpers', () => {
    it('preserves the marker timebase when setting a TimePosition', () => {
      const xml =
        '<markersList><marker name="Intro"><time type="SECONDS"><totalSeconds>4</totalSeconds></time></marker></markersList>';
      const list = MarkersList.loadFromXML(Element.parse(xml));

      list.setMarkerTimePosition(0, TimePosition.seconds(8));

      const marker = list.getMarker(0);
      expect(marker?.getElement('time')?.getAttributeValue('type')).toBe('SECONDS');
      expect(marker?.getElement('time')?.getTextString('totalSeconds')).toBe('8');
    });

    it('creates new markers using nested TimePosition XML', () => {
      const list = new MarkersList();

      list.addMarkerPosition('Verse', TimePosition.seconds(12));

      const marker = list.getMarker(0);
      expect(marker?.getElement('time')?.getAttributeValue('type')).toBe('SECONDS');
      expect(marker?.getElement('time')?.getTextString('totalSeconds')).toBe('12');
    });
  });
});
