import { describe, expect, it } from 'vitest';
import {
  Effect,
  GenericInstrument,
  GenericScore,
  OpcodeDefinition,
} from '@blue/data';
import { LibraryEditorAdapterRegistry } from './editor-adapters';

describe('Library editor adapters', () => {
  const registry = new LibraryEditorAdapterRegistry();

  it('hydrates the four supported native document kinds without renderer XML', () => {
    const instrument = new GenericInstrument();
    instrument.setName('Pad');
    const udo = new OpcodeDefinition();
    udo.setName('SoftClip');
    const effect = new Effect();
    effect.setName('Delay');
    const soundObject = new GenericScore();
    soundObject.setName('Phrase');

    expect(registry.hydrate('instrument', instrument.saveAsXML().toXml(), 'GenericInstrument', 'supported').kind).toBe('instrument');
    expect(registry.hydrate('udo', udo.saveAsXML().toXml(), 'OpcodeDefinition', 'supported').kind).toBe('udo');
    expect(registry.hydrate('effect', effect.saveAsXML().toXml(), 'Effect', 'supported').kind).toBe('effect');
    expect(registry.hydrate('soundObject', soundObject.saveAsXML().toXml(), 'GenericScore', 'supported').kind).toBe('soundObject');
  });

  it('keeps unsupported payload bytes in a read-only document', () => {
    const rawXml = '<soundObject type="FutureObject">\n  <future/>\n</soundObject>';
    expect(registry.hydrate('soundObject', rawXml, 'FutureObject', 'unsupported')).toEqual({
      kind: 'unsupported',
      libraryType: 'soundObject',
      objectType: 'FutureObject',
      message: 'This item is preserved but cannot be edited safely by this version of Blue.',
      rawXml,
    });
  });

  it('applies typed native patches and returns a refreshed document', () => {
    const udo = new OpcodeDefinition();
    udo.setName('Before');
    const result = registry.applyPatch(
      'udo',
      udo.saveAsXML().toXml(),
      { kind: 'udo', patch: { type: 'update', index: 0, patch: { name: 'After' } } },
    );
    expect(result.document).toMatchObject({ kind: 'udo', snapshot: { name: 'After' } });
    expect(result.payloadXml).toContain('After');
  });
});
