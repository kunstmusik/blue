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

  it('hydrates and patches BlueX7 library drafts preserving unknown XML', () => {
    const rawXml = `<instrument type="blue.orchestra.BlueX7" enabled="true" unknownRootAttr="preserveMe">
  <name>FM Lead</name>
  <comment>Original</comment>
  <customVendorData>important</customVendorData>
  <algorithmCommonData>
    <keyTranspose>24</keyTranspose>
    <algorithm>19</algorithm>
    <feedback>6</feedback>
    <operator>true</operator>
    <operator>true</operator>
    <operator>true</operator>
    <operator>true</operator>
    <operator>true</operator>
    <operator>true</operator>
  </algorithmCommonData>
  <lfoData>
    <speed>35</speed>
    <delay>0</delay>
    <PMD>0</PMD>
    <AMD>0</AMD>
    <wave>0</wave>
    <sync>1</sync>
  </lfoData>
  <operator>
    <mode>0</mode>
    <sync>1</sync>
    <freqCoarse>1</freqCoarse>
    <freqFine>0</freqFine>
    <detune>0</detune>
    <breakpoint>0</breakpoint>
    <curveLeft>0</curveLeft>
    <curveRight>0</curveRight>
    <depthLeft>0</depthLeft>
    <depthRight>0</depthRight>
    <keyboardRateScaling>0</keyboardRateScaling>
    <outputLevel>99</outputLevel>
    <velocitySensitivity>0</velocitySensitivity>
    <modulationAmplitude>0</modulationAmplitude>
    <modulationPitch>0</modulationPitch>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
  </operator>
  <operator>
    <mode>0</mode>
    <sync>1</sync>
    <freqCoarse>1</freqCoarse>
    <freqFine>0</freqFine>
    <detune>0</detune>
    <breakpoint>0</breakpoint>
    <curveLeft>0</curveLeft>
    <curveRight>0</curveRight>
    <depthLeft>0</depthLeft>
    <depthRight>0</depthRight>
    <keyboardRateScaling>0</keyboardRateScaling>
    <outputLevel>99</outputLevel>
    <velocitySensitivity>0</velocitySensitivity>
    <modulationAmplitude>0</modulationAmplitude>
    <modulationPitch>0</modulationPitch>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
  </operator>
  <operator>
    <mode>0</mode>
    <sync>1</sync>
    <freqCoarse>1</freqCoarse>
    <freqFine>0</freqFine>
    <detune>0</detune>
    <breakpoint>0</breakpoint>
    <curveLeft>0</curveLeft>
    <curveRight>0</curveRight>
    <depthLeft>0</depthLeft>
    <depthRight>0</depthRight>
    <keyboardRateScaling>0</keyboardRateScaling>
    <outputLevel>99</outputLevel>
    <velocitySensitivity>0</velocitySensitivity>
    <modulationAmplitude>0</modulationAmplitude>
    <modulationPitch>0</modulationPitch>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
  </operator>
  <operator>
    <mode>0</mode>
    <sync>1</sync>
    <freqCoarse>1</freqCoarse>
    <freqFine>0</freqFine>
    <detune>0</detune>
    <breakpoint>0</breakpoint>
    <curveLeft>0</curveLeft>
    <curveRight>0</curveRight>
    <depthLeft>0</depthLeft>
    <depthRight>0</depthRight>
    <keyboardRateScaling>0</keyboardRateScaling>
    <outputLevel>99</outputLevel>
    <velocitySensitivity>0</velocitySensitivity>
    <modulationAmplitude>0</modulationAmplitude>
    <modulationPitch>0</modulationPitch>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
  </operator>
  <operator>
    <mode>0</mode>
    <sync>1</sync>
    <freqCoarse>1</freqCoarse>
    <freqFine>0</freqFine>
    <detune>0</detune>
    <breakpoint>0</breakpoint>
    <curveLeft>0</curveLeft>
    <curveRight>0</curveRight>
    <depthLeft>0</depthLeft>
    <depthRight>0</depthRight>
    <keyboardRateScaling>0</keyboardRateScaling>
    <outputLevel>99</outputLevel>
    <velocitySensitivity>0</velocitySensitivity>
    <modulationAmplitude>0</modulationAmplitude>
    <modulationPitch>0</modulationPitch>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
  </operator>
  <operator>
    <mode>0</mode>
    <sync>1</sync>
    <freqCoarse>1</freqCoarse>
    <freqFine>0</freqFine>
    <detune>0</detune>
    <breakpoint>0</breakpoint>
    <curveLeft>0</curveLeft>
    <curveRight>0</curveRight>
    <depthLeft>0</depthLeft>
    <depthRight>0</depthRight>
    <keyboardRateScaling>0</keyboardRateScaling>
    <outputLevel>99</outputLevel>
    <velocitySensitivity>0</velocitySensitivity>
    <modulationAmplitude>0</modulationAmplitude>
    <modulationPitch>0</modulationPitch>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
    <envelopePoint x="0" y="0"/>
  </operator>
  <envelopePoint x="0" y="0"/>
  <envelopePoint x="0" y="0"/>
  <envelopePoint x="0" y="0"/>
  <envelopePoint x="0" y="0"/>
  <csoundPostCode>blueMixerOut aout, aout</csoundPostCode>
</instrument>`;

    const doc = registry.hydrate('instrument', rawXml, 'blue.orchestra.BlueX7', 'supported');
    expect(doc.kind).toBe('instrument');
    if (doc.kind === 'instrument') {
      expect(doc.snapshot.type).toBe('blueX7');
      expect(doc.snapshot.name).toBe('FM Lead');
    }

    const patched = registry.applyPatch(
      'instrument',
      rawXml,
      {
        kind: 'instrument',
        patch: {
          type: 'updateInstrument',
          assignmentId: 'library-item',
          patch: {
            blueX7: {
              type: 'setCommonField',
              field: 'algorithm',
              value: 7,
            },
          },
        },
      },
    );

    expect(patched.document.kind).toBe('instrument');
    if (patched.document.kind === 'instrument' && patched.document.snapshot.type === 'blueX7') {
      expect(patched.document.snapshot.voice.common.algorithm).toBe(7);
    }
    expect(patched.payloadXml).toContain('unknownRootAttr="preserveMe"');
    expect(patched.payloadXml).toContain('<customVendorData>important</customVendorData>');
    expect(patched.payloadXml).toContain('<algorithm>7</algorithm>');
  });
});
