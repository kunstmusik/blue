import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BlueData } from '../blue-data';
import { LiveObject } from './live-object';
import { LiveObjectBins } from './live-object-bins';
import { LiveObjectSet } from './live-object-set';
import { LiveObjectSetList } from './live-object-set-list';
import { GenericScore } from '../sound-objects/generic-score';
import { Element } from '../serialization/xml-reader';
import { prepareTriggerBatch } from './blue-live-trigger';

describe('LiveObjectSet legacy preservation', () => {
  function createBinsWithObjects(): LiveObjectBins {
    const bins = new LiveObjectBins(1, 4);
    const obj1 = new LiveObject();
    obj1.setUniqueId('keep-1');
    obj1.setEnabled(true);
    obj1.setSoundObject(new GenericScore());
    bins.setLiveObject(0, 0, obj1);

    const obj2 = new LiveObject();
    obj2.setUniqueId('keep-2');
    obj2.setEnabled(false);
    obj2.setSoundObject(new GenericScore());
    bins.setLiveObject(0, 1, obj2);
    return bins;
  }

  it('retains unresolved liveObjectRef identifiers in XML', () => {
    const set = new LiveObjectSet();
    set.setName('Mixed Set');
    set.setLiveObjectIds(['keep-1', 'gone-missing', 'keep-2']);

    const xml = set.saveAsXML();
    const roundTripped = LiveObjectSet.loadFromXML(xml, createBinsWithObjects());

    // All three IDs are retained, including the missing one.
    expect(roundTripped.getLiveObjectIds()).toEqual(['keep-1', 'gone-missing', 'keep-2']);
  });

  it('resolves only existing objects when applying a set with missing references', () => {
    const bins = createBinsWithObjects();
    const set = new LiveObjectSet();
    set.setName('Mixed Set');
    set.setLiveObjectIds(['keep-1', 'gone-missing', 'keep-2']);

    const resolved = set.resolveLiveObjects(bins);
    // Only the two existing objects resolve; the missing ID is ignored safely.
    expect(resolved).toHaveLength(2);
    expect(resolved.map((o) => o.getUniqueId())).toEqual(['keep-1', 'keep-2']);
  });

  it('applying a set only changes the enabled mask', () => {
    const bins = createBinsWithObjects();
    const list = new LiveObjectSetList();
    const set = new LiveObjectSet();
    set.setName('Test');
    set.setLiveObjectIds(['keep-1']);
    list.add(set);

    // Before: keep-1 enabled, keep-2 disabled
    expect(bins.getLiveObject(0, 0)!.isEnabled()).toBe(true);
    expect(bins.getLiveObject(0, 1)!.isEnabled()).toBe(false);

    list.applySet(0, bins);

    // After applying {keep-1}: keep-1 enabled, keep-2 disabled (unchanged mask)
    expect(bins.getLiveObject(0, 0)!.isEnabled()).toBe(true);
    expect(bins.getLiveObject(0, 1)!.isEnabled()).toBe(false);
  });

  it('repeated application of the same set is a semantic no-op for the mask', () => {
    const bins = createBinsWithObjects();
    const list = new LiveObjectSetList();
    const set = new LiveObjectSet();
    set.setName('Test');
    set.setLiveObjectIds(['keep-1']);
    list.add(set);

    list.applySet(0, bins);
    const maskAfterFirst = bins.getEnabledLiveObjectSet().map((o) => o.getUniqueId());

    list.applySet(0, bins);
    const maskAfterSecond = bins.getEnabledLiveObjectSet().map((o) => o.getUniqueId());

    expect(maskAfterSecond).toEqual(maskAfterFirst);
  });
});

describe('LiveData legacy XML round-trip', () => {
  it(
    'preserves covered values from the Java-authored Blue Live MIDI example through trigger-only work',
    { timeout: 30_000 },
    async () => {
      const fixtureXml = fs.readFileSync(
        path.resolve(__dirname, '../../../../examples/features/blueLiveMidi.blue'),
        'utf8',
      );
      const data = BlueData.loadFromString(fixtureXml);
      const liveData = data.getLiveData();
      const target = liveData.getLiveObjectBins().getLiveObject(0, 0);

      expect(liveData.getCommandLine()).toBe('csound -Wdo devaudio -L stdin');
      expect(liveData.isCommandLineEnabled()).toBe(false);
      expect(liveData.isCommandLineOverride()).toBe(false);
      expect(target).not.toBeNull();
      expect(target!.getKeyTrigger()).toBe(-1);
      expect(target!.getMidiTrigger()).toBe(-1);

      const canonicalBefore = data.saveToString();
      const result = await prepareTriggerBatch(
        data.deepCopy() as BlueData,
        'selected',
        target!.getUniqueId(),
      );

      expect(result.kind).toBe('prepared');
      expect(data.saveToString()).toBe(canonicalBefore);

      const reloaded = BlueData.loadFromString(canonicalBefore);
      const reloadedTarget = reloaded.getLiveData().getLiveObjectBins().getLiveObject(0, 0);
      expect(reloaded.getLiveData().getCommandLine()).toBe('csound -Wdo devaudio -L stdin');
      expect(reloadedTarget?.getKeyTrigger()).toBe(-1);
      expect(reloadedTarget?.getMidiTrigger()).toBe(-1);
    },
  );

  it('round-trips sparse bins, key/MIDI metadata, and Repeat values', () => {
    const data = new BlueData();
    const ld = data.getLiveData();
    ld.setTempo(75);
    ld.setRepeat(8);
    ld.setRepeatEnabled(true);
    ld.setLiveCodeText('prints "test\\n"');

    const bins = ld.getLiveObjectBins();
    const obj = new LiveObject();
    obj.setUniqueId('legacy-cell');
    obj.setEnabled(true);
    obj.setKeyTrigger(60);
    obj.setMidiTrigger(1);
    obj.setSoundObject(new GenericScore());
    bins.setLiveObject(0, 3, obj);

    const xml = data.saveToString();
    const reloaded = BlueData.loadFromString(xml);

    const reloadedLd = reloaded.getLiveData();
    expect(reloadedLd.getTempo()).toBe(75);
    expect(reloadedLd.getRepeat()).toBe(8);
    expect(reloadedLd.isRepeatEnabled()).toBe(true);
    expect(reloadedLd.getLiveCodeText()).toBe('prints "test\\n"');

    const reloadedObj = reloadedLd.getLiveObjectBins().getLiveObject(0, 3);
    expect(reloadedObj).not.toBeNull();
    expect(reloadedObj!.getUniqueId()).toBe('legacy-cell');
    expect(reloadedObj!.isEnabled()).toBe(true);
    expect(reloadedObj!.getKeyTrigger()).toBe(60);
    expect(reloadedObj!.getMidiTrigger()).toBe(1);
  });

  it('preserves trigger-only serialization invariance', () => {
    const data = new BlueData();
    const ld = data.getLiveData();
    const bins = ld.getLiveObjectBins();
    const obj = new LiveObject();
    obj.setUniqueId('trigger-cell');
    obj.setEnabled(true);
    obj.setSoundObject(new GenericScore());
    bins.setLiveObject(0, 0, obj);

    const xmlBefore = data.saveToString();
    const reloaded = BlueData.loadFromString(xmlBefore);
    const xmlAfter = reloaded.saveToString();

    expect(xmlAfter).toBe(xmlBefore);
  });
});
