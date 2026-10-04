import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, XmlLoadError } from '../serialization/xml-load';
import { ObjectBuilder } from './object-builder';
import { FrozenSoundObject } from './frozen-sound-object';
import { PolyObject } from './poly-object';
import { PatternLayer } from '../score/patterns/pattern-layer';
import { Track } from '../score/track/track';
import { Mixer } from '../mixer/mixer';
import { Effect } from '../mixer/effect';
import { AudioFile } from './audio-file';
import { PianoRoll } from './piano-roll';
import './register-sound-object-types';

const warningObject =
  '<soundObject type="ObjectBuilder"><syntaxType>Python</syntaxType></soundObject>';
const warningEffect =
  '<effect><opcodeList><udo><style>MODERN</style><inTypes/></udo></opcodeList></effect>';
const wrappers = [
  {
    label: 'ObjectBuilder',
    xml: warningObject,
    load: (root: Element, context?: XmlLoadContext) =>
      ObjectBuilder.loadFromXML(root, undefined, context),
  },
  {
    label: 'FrozenSoundObject',
    xml: '<soundObject type="FrozenSoundObject">' + warningObject + '</soundObject>',
    load: (root: Element, context?: XmlLoadContext) =>
      FrozenSoundObject.loadFromXML(root, undefined, context),
  },
  {
    label: 'PolyObject',
    xml:
      '<soundObject type="PolyObject"><soundLayer>' + warningObject + '</soundLayer></soundObject>',
    load: (root: Element, context?: XmlLoadContext) =>
      PolyObject.loadFromXML(root, undefined, context),
  },
  {
    label: 'PatternLayer',
    xml: '<patternLayer>' + warningObject + '</patternLayer>',
    load: (root: Element, context?: XmlLoadContext) =>
      PatternLayer.loadFromXML(root, undefined, context),
  },
  {
    label: 'Track',
    xml: '<track>' + warningObject + '</track>',
    load: (root: Element, context?: XmlLoadContext) => Track.loadFromXML(root, undefined, context),
  },
  {
    label: 'Effect',
    xml: warningEffect,
    load: (root: Element, context?: XmlLoadContext) => Effect.loadFromXML(root, context),
  },
  {
    label: 'Mixer',
    xml:
      '<mixer><channel><name>Master</name><effectsChain bin="post">' +
      warningEffect +
      '</effectsChain></channel></mixer>',
    load: (root: Element, context?: XmlLoadContext) => Mixer.loadFromXML(root, context),
  },
];
describe('nested XML acceptance operation boundaries', () => {
  it.each(wrappers)(
    '$label requires a handler for direct warnings and preserves nested context/input',
    ({ xml, load }) => {
      const root = Element.parse(xml);
      const original = root.toXml();
      expect(() => load(root)).toThrow(XmlLoadError);
      const source = { kind: 'project' as const, label: 'nested diagnostic fixture' };
      const context = new XmlLoadContext(root, source);
      const result = context.result(load(root, context));
      expect(result.ok).toBe(true);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].source).toEqual(source);
      expect(result.diagnostics[0].path).toMatch(/\/(syntaxType|inTypes)\[1\]$/);
      expect(root.toXml()).toBe(original);
    },
  );
  it.each([
    { label: 'Mixer', load: () => Mixer.loadFromXML(Element.parse('<unexpected/>')) },
    { label: 'Effect', load: () => Effect.loadFromXML(Element.parse('<unexpected/>')) },
    {
      label: 'AudioFile',
      load: () => AudioFile.loadFromXML(Element.parse('<unexpected type="AudioFile"/>')),
    },
    {
      label: 'PianoRoll',
      load: () => PianoRoll.loadFromXML(Element.parse('<unexpected type="PianoRoll"/>')),
    },
  ])('$label rejects an unexpected direct root', ({ load }) => {
    expect(load).toThrow(XmlLoadError);
  });
});
