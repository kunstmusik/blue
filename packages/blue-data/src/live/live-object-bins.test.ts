import { describe, it, expect } from 'vitest';
import { LiveObjectBins } from './live-object-bins';
import { LiveObject } from './live-object';
import { Element } from '../serialization/xml-reader';

describe('LiveObjectBins', () => {
  it('creates default grid (1 column x 8 rows)', () => {
    const bins = new LiveObjectBins();
    expect(bins.getColumnCount()).toBe(1);
    expect(bins.getRowCount()).toBe(8);
  });

  it('creates custom grid', () => {
    const bins = new LiveObjectBins(3, 4);
    expect(bins.getColumnCount()).toBe(3);
    expect(bins.getRowCount()).toBe(4);
  });

  it('sets and gets live objects', () => {
    const bins = new LiveObjectBins(2, 2);
    const obj = new LiveObject();
    obj.setEnabled(true);
    bins.setLiveObject(1, 0, obj);

    expect(bins.getLiveObject(1, 0)).toBe(obj);
    expect(bins.getLiveObject(0, 0)).toBeNull();
  });

  it('returns null for out-of-bounds access', () => {
    const bins = new LiveObjectBins(1, 1);
    expect(bins.getLiveObject(-1, 0)).toBeNull();
    expect(bins.getLiveObject(0, 5)).toBeNull();
    expect(bins.getLiveObject(5, 0)).toBeNull();
  });

  describe('insertRow', () => {
    it('inserts a row at the specified index', () => {
      const bins = new LiveObjectBins(1, 2);
      const obj = new LiveObject();
      bins.setLiveObject(0, 0, obj);
      bins.insertRow(1);

      expect(bins.getRowCount()).toBe(3);
      expect(bins.getLiveObject(0, 0)).toBe(obj);
      expect(bins.getLiveObject(0, 1)).toBeNull();
      expect(bins.getLiveObject(0, 2)).toBeNull();
    });

    it('clamps negative index to 0', () => {
      const bins = new LiveObjectBins(1, 2);
      const obj = new LiveObject();
      bins.setLiveObject(0, 0, obj);
      bins.insertRow(-1);

      expect(bins.getRowCount()).toBe(3);
      expect(bins.getLiveObject(0, 0)).toBeNull();
      expect(bins.getLiveObject(0, 1)).toBe(obj);
    });
  });

  describe('removeRow', () => {
    it('removes a row', () => {
      const bins = new LiveObjectBins(1, 3);
      const obj0 = new LiveObject();
      const obj2 = new LiveObject();
      bins.setLiveObject(0, 0, obj0);
      bins.setLiveObject(0, 2, obj2);
      bins.removeRow(1);

      expect(bins.getRowCount()).toBe(2);
      expect(bins.getLiveObject(0, 0)).toBe(obj0);
      expect(bins.getLiveObject(0, 1)).toBe(obj2);
    });

    it('does not remove the last row', () => {
      const bins = new LiveObjectBins(1, 1);
      expect(bins.removeRow(0)).toBe(false);
      expect(bins.getRowCount()).toBe(1);
    });

    it('reports invalid row removal as a no-op', () => {
      const bins = new LiveObjectBins(1, 2);
      expect(bins.removeRow(-1)).toBe(false);
      expect(bins.removeRow(2)).toBe(false);
      expect(bins.getRowCount()).toBe(2);
    });
  });

  describe('insertColumn', () => {
    it('inserts a column at the specified index', () => {
      const bins = new LiveObjectBins(2, 1);
      const obj = new LiveObject();
      bins.setLiveObject(0, 0, obj);
      bins.insertColumn(1);

      expect(bins.getColumnCount()).toBe(3);
      expect(bins.getLiveObject(0, 0)).toBe(obj);
      expect(bins.getLiveObject(1, 0)).toBeNull();
    });
  });

  describe('removeColumn', () => {
    it('removes a column', () => {
      const bins = new LiveObjectBins(3, 1);
      const obj0 = new LiveObject();
      const obj2 = new LiveObject();
      bins.setLiveObject(0, 0, obj0);
      bins.setLiveObject(2, 0, obj2);
      bins.removeColumn(1);

      expect(bins.getColumnCount()).toBe(2);
      expect(bins.getLiveObject(0, 0)).toBe(obj0);
      expect(bins.getLiveObject(1, 0)).toBe(obj2);
    });

    it('does not remove the last column', () => {
      const bins = new LiveObjectBins(1, 1);
      expect(bins.removeColumn(0)).toBe(false);
      expect(bins.getColumnCount()).toBe(1);
    });

    it('reports invalid column removal as a no-op', () => {
      const bins = new LiveObjectBins(2, 1);
      expect(bins.removeColumn(-1)).toBe(false);
      expect(bins.removeColumn(2)).toBe(false);
      expect(bins.getColumnCount()).toBe(2);
    });
  });

  describe('XML round-trip', () => {
    it('round-trips an empty grid', () => {
      const original = new LiveObjectBins(2, 3);
      const xml = original.saveAsXML().toXml();
      const parsed = Element.parse(xml);
      const loaded = LiveObjectBins.loadFromXML(parsed);

      expect(loaded.getColumnCount()).toBe(2);
      expect(loaded.getRowCount()).toBe(3);
    });

    it('round-trips a grid with live objects', () => {
      const original = new LiveObjectBins(2, 2);
      const obj = new LiveObject();
      obj.setEnabled(true);
      obj.setKeyTrigger(65);
      original.setLiveObject(1, 1, obj);

      const xml = original.saveAsXML().toXml();
      const parsed = Element.parse(xml);
      const loaded = LiveObjectBins.loadFromXML(parsed);

      expect(loaded.getColumnCount()).toBe(2);
      expect(loaded.getRowCount()).toBe(2);
      expect(loaded.getLiveObject(1, 1)).not.toBeNull();
      expect(loaded.getLiveObject(1, 1)!.isEnabled()).toBe(true);
      expect(loaded.getLiveObject(1, 1)!.getKeyTrigger()).toBe(65);
      expect(loaded.getLiveObject(0, 0)).toBeNull();
    });
  });

  describe('enabled set helpers', () => {
    it('returns enabled live objects', () => {
      const bins = new LiveObjectBins(2, 2);
      const obj1 = new LiveObject();
      obj1.setEnabled(true);
      const obj2 = new LiveObject();
      obj2.setEnabled(false);
      const obj3 = new LiveObject();
      obj3.setEnabled(true);
      bins.setLiveObject(0, 0, obj1);
      bins.setLiveObject(0, 1, obj2);
      bins.setLiveObject(1, 1, obj3);

      const enabled = bins.getEnabledLiveObjectSet();
      expect(enabled).toHaveLength(2);
      expect(enabled).toContain(obj1);
      expect(enabled).toContain(obj3);
    });

    it('sets enabled state from a set of live objects', () => {
      const bins = new LiveObjectBins(1, 3);
      const obj0 = new LiveObject();
      const obj1 = new LiveObject();
      const obj2 = new LiveObject();
      bins.setLiveObject(0, 0, obj0);
      bins.setLiveObject(0, 1, obj1);
      bins.setLiveObject(0, 2, obj2);

      expect(bins.setEnabledFromLiveObjectSet([obj1])).toBe(true);

      expect(obj0.isEnabled()).toBe(false);
      expect(obj1.isEnabled()).toBe(true);
      expect(obj2.isEnabled()).toBe(false);
    });

    it('reports repeated enabled-set application as a semantic no-op', () => {
      const bins = new LiveObjectBins(1, 1);
      const obj = new LiveObject();
      obj.setEnabled(true);
      bins.setLiveObject(0, 0, obj);

      expect(bins.setEnabledFromLiveObjectSet([obj])).toBe(false);
    });

    it('finds objects by uniqueId', () => {
      const bins = new LiveObjectBins(1, 1);
      const obj = new LiveObject();
      bins.setLiveObject(0, 0, obj);

      expect(bins.getLiveObjectByUniqueId(obj.getUniqueId())).toBe(obj);
      expect(bins.getLiveObjectByUniqueId('nonexistent')).toBeNull();
      expect(bins.getLiveObjectByUniqueId(null)).toBeNull();
    });
  });

  describe('deepCopy', () => {
    it('creates independent copy', () => {
      const bins = new LiveObjectBins(1, 1);
      const obj = new LiveObject();
      obj.setEnabled(true);
      bins.setLiveObject(0, 0, obj);

      const copy = bins.deepCopy() as LiveObjectBins;
      copy.getLiveObject(0, 0)!.setEnabled(false);
      copy.insertRow(0);

      expect(obj.isEnabled()).toBe(true);
      expect(bins.getRowCount()).toBe(1);
    });
  });
});
