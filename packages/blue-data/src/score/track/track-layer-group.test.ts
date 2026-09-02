import { describe, expect, it } from 'vitest';
import { Element } from '../../serialization/xml-reader';
import { PythonObject } from '../../sound-objects/python-object';
import { Score } from '../score';
import { AudioClip } from '../audio/audio-clip';
import { TrackLayerGroup } from './track-layer-group';

class RecordingPythonObject extends PythonObject {
  processOnLoadCalls = 0;
  override processOnLoad(): void {
    this.processOnLoadCalls += 1;
  }

  override async processOnLoadAsync(): Promise<void> {
    this.processOnLoadCalls += 1;
  }
}

describe('TrackLayerGroup', () => {
  it('creates, orders, and deep-copies Track rows', () => {
    const group = new TrackLayerGroup();
    group.setUniqueId('group-a');
    group.setDefaultHeightIndex(2);
    const first = group.newLayerAt(0);
    first.setUniqueId('first');
    const second = group.newLayerAt(1);
    second.setUniqueId('second');

    expect(group.map((track) => track.getUniqueId())).toEqual(['first', 'second']);
    expect(first.getHeightIndex()).toBe(2);

    const copy = group.deepCopy();
    expect(copy).not.toBe(group);
    expect(copy.getUniqueId()).toBe('group-a');
    expect(copy.map((track) => track.getUniqueId())).toEqual(['first', 'second']);
    expect(copy[0]).not.toBe(first);
  });

  it('round-trips the canonical group wrapper', () => {
    const group = new TrackLayerGroup();
    group.setUniqueId('group-roundtrip');
    group.newLayerAt(0).setName('One');
    const loaded = TrackLayerGroup.loadFromXML(Element.parse(group.saveAsXML().toXml()));
    expect(loaded.getUniqueId()).toBe('group-roundtrip');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].getName()).toBe('One');
  });

  it('processes on-load-processable script objects held on Tracks', async () => {
    const score = new Score();
    score.length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const onLoadScript = new RecordingPythonObject();
    onLoadScript.setOnLoadProcessable?.(true);
    track.push(new AudioClip());
    track.push(onLoadScript);
    score.push(group);

    score.processOnLoad();
    expect(onLoadScript.processOnLoadCalls).toBe(1);

    await score.processOnLoadAsync();
    expect(onLoadScript.processOnLoadCalls).toBe(2);
  });
});
