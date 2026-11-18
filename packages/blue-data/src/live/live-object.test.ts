import { describe, it, expect } from 'vite-plus/test';
import { LiveObject } from './live-object';
import { Element } from '../serialization/xml-reader';

describe('LiveObject XML round-trip', () => {
  it('saves and loads default LiveObject', () => {
    const original = new LiveObject();
    const xml = original.saveAsXML().toXml();
    const parsed = Element.parse(xml);
    const loaded = LiveObject.loadFromXML(parsed);

    expect(loaded.getKeyTrigger()).toBe(-1);
    expect(loaded.getMidiTrigger()).toBe(-1);
    expect(loaded.isEnabled()).toBe(false);
    expect(loaded.getSoundObject()).toBeNull();
  });

  it('preserves all fields through save/load', () => {
    const original = new LiveObject();
    original.setKeyTrigger(72);
    original.setMidiTrigger(60);
    original.setEnabled(true);

    const xml = original.saveAsXML().toXml();
    const parsed = Element.parse(xml);
    const loaded = LiveObject.loadFromXML(parsed);

    expect(loaded.getKeyTrigger()).toBe(72);
    expect(loaded.getMidiTrigger()).toBe(60);
    expect(loaded.isEnabled()).toBe(true);
    expect(loaded.getUniqueId()).toBe(original.getUniqueId());
  });

  it('preserves uniqueId through save/load', () => {
    const original = new LiveObject();
    const uid = original.getUniqueId();

    const xml = original.saveAsXML().toXml();
    const parsed = Element.parse(xml);
    const loaded = LiveObject.loadFromXML(parsed);

    expect(loaded.getUniqueId()).toBe(uid);
  });

  it('deep copies independently', () => {
    const original = new LiveObject();
    original.setEnabled(true);
    original.setKeyTrigger(50);

    const copy = original.deepCopy() as LiveObject;

    copy.setEnabled(false);
    copy.setKeyTrigger(99);

    expect(original.isEnabled()).toBe(true);
    expect(original.getKeyTrigger()).toBe(50);
  });

  it('reports displayName and soundObjectType correctly when no SoundObject', () => {
    const obj = new LiveObject();
    expect(obj.getDisplayName()).toBe('');
    expect(obj.getSoundObjectType()).toBe('');
    expect(obj.hasSoundObject).toBe(false);
  });

  it('preserves a nested genericScore SoundObject through save/load', () => {
    const original = new LiveObject();
    original.setEnabled(true);
    const xml = `<liveObject uniqueId="${original.getUniqueId()}">
      <keyTrigger>-1</keyTrigger>
      <midiTrigger>-1</midiTrigger>
      <enabled>true</enabled>
      <soundObject type="GenericScore">
        <name>TestSO</name>
        <scoreText>i1 0 1</scoreText>
      </soundObject>
    </liveObject>`;
    const parsed = Element.parse(xml);
    const loaded = LiveObject.loadFromXML(parsed);

    expect(loaded.isEnabled()).toBe(true);
    expect(loaded.getSoundObject()).not.toBeNull();
    expect(loaded.getDisplayName()).toBe('TestSO');
    expect(loaded.getSoundObjectType()).toBe('GenericScore');
    expect(loaded.hasSoundObject).toBe(true);
  });
});
