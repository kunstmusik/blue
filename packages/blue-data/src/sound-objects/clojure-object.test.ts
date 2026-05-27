import { describe, expect, it, vi } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { ClojureObject } from './clojure-object';

describe('ClojureObject', () => {
  it('uses the Java-compatible defaults', () => {
    const obj = new ClojureObject();

    expect(obj.getName()).toBe('(clojure-object)');
    expect(obj.getClojureCode()).toContain(';use symbol blueDuration for duration from blue');
    expect(obj.getClojureCode()).toContain('(def score "i1 0 2 3 4 5")');
    expect(obj.isOnLoadProcessable()).toBe(false);
  });

  it('loads Java XML fields', () => {
    const xml = Element.parse(`<soundObject type="blue.clojure.soundObject.ClojureObject" onLoadProcessable="true">
      <subjectiveDuration>12.0</subjectiveDuration>
      <startTime>0.0</startTime>
      <name>(Clojure Setup Code)</name>
      <backgroundColor>-12566464</backgroundColor>
      <timeBehavior>3</timeBehavior>
      <repeatPoint>4.0</repeatPoint>
      <noteProcessorChain/>
      <clojureCode>(def score "i1 0 4")</clojureCode>
    </soundObject>`);

    const obj = ClojureObject.loadFromXML(xml);

    expect(obj.getName()).toBe('(Clojure Setup Code)');
    expect(obj.getClojureCode()).toBe('(def score "i1 0 4")');
    expect(obj.isOnLoadProcessable()).toBe(true);
    expect(obj.getRepeatPoint()?.getValue()).toBe(4);
  });

  it('saves Java-compatible XML', () => {
    const obj = new ClojureObject();
    obj.setName('Saved');
    obj.setOnLoadProcessable(true);
    obj.setClojureCode('(println :hello)');

    const xml = obj.saveAsXML();

    expect(xml.getName()).toBe('soundObject');
    expect(xml.getAttribute('type')).toBe('blue.clojure.soundObject.ClojureObject');
    expect(xml.getAttribute('onLoadProcessable')).toBe('true');
    expect(xml.getElement('clojureCode')?.getTextString()).toBe('(println :hello)');
  });

  it('round-trips through XML', () => {
    const original = new ClojureObject();
    original.setName('Round Trip');
    original.setOnLoadProcessable(true);
    original.setClojureCode('(def score "i1 0 2 3 4 5")');

    const xml = original.saveAsXML();
    const loaded = ClojureObject.loadFromXML(xml);

    expect(loaded.getName()).toBe('Round Trip');
    expect(loaded.isOnLoadProcessable()).toBe(true);
    expect(loaded.getClojureCode()).toBe('(def score "i1 0 2 3 4 5")');
  });

  it('deep-copies mutable state', () => {
    const original = new ClojureObject();
    original.setClojureCode('(def score "i1 0 1")');
    original.setOnLoadProcessable(true);

    const copy = original.deepCopy() as ClojureObject;
    copy.setClojureCode('(def score "i2 0 1")');
    copy.setOnLoadProcessable(false);

    expect(original.getClojureCode()).toBe('(def score "i1 0 1")');
    expect(original.isOnLoadProcessable()).toBe(true);
  });

  it('warns instead of executing on-load without a runtime bridge', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const obj = new ClojureObject();
    obj.setOnLoadProcessable(true);

    obj.processOnLoad(Element.parse('<timeContext/>') as never);

    expect(warnSpy).toHaveBeenCalledWith(
      'ClojureObject.processOnLoad skipped: requires Java runtime',
    );
    warnSpy.mockRestore();
  });
});