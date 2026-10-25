import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { BlueSynthBuilder } from './instruments/blue-synth-builder';
import { GenericInstrument } from './instruments/generic-instrument';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { Channel } from './mixer/channel';
import { Send } from './mixer/send';

function createProjectWithInstrument(): BlueData {
  const data = new BlueData();
  const instr = new GenericInstrument();
  instr.setName('TestInstr');
  instr.setText('aout oscili p4, p5\n  out aout');
  data.getArrangement().addInstrument(instr, '1');
  return data;
}

describe('Blue Live CSD generation', () => {
  it('generates a valid CSD from a minimal project', () => {
    const data = new BlueData();
    const result = data.toBlueLiveCSD();

    expect(result.csdText).toContain('<CsoundSynthesizer>');
    expect(result.csdText).toContain('</CsoundSynthesizer>');
    expect(result.csdText).toContain('<CsInstruments>');
    expect(result.csdText).toContain('</CsInstruments>');
    expect(result.csdText).toContain('<CsScore>');
    expect(result.csdText).toContain('</CsScore>');
  });

  it('uses 36000 second duration in the score', () => {
    const data = new BlueData();
    const result = data.toBlueLiveCSD();

    expect(result.csdText).toContain('e 36000');
  });

  it('includes always-on instruments in the score when present', () => {
    const data = new BlueData();
    const instr = new BlueSynthBuilder();
    instr.setName('AlwaysOnInstr');
    instr.setInstrumentText('aout oscili 0.25, 440\nout aout');
    instr.setAlwaysOnInstrumentText('aout oscili 0.25, 220\nblueMixerOut aout');
    data.getArrangement().addInstrument(instr, '1');

    const result = data.toBlueLiveCSD();
    expect(result.csdText).toContain('i2 0 36000');
  });

  it('includes blueAllNotesOff instrument in the orchestra', () => {
    const data = createProjectWithInstrument();
    const result = data.toBlueLiveCSD();

    expect(result.csdText).toContain('instr blueAllNotesOff');
    expect(result.csdText).toContain('turnoff2');
  });

  it('blueAllNotesOff turns off numeric instrument IDs', () => {
    const data = createProjectWithInstrument();
    const result = data.toBlueLiveCSD();

    expect(result.csdText).toMatch(/turnoff2 \d+, 0, 1/);
  });

  it('includes orchestra header with sr, ksmps, nchnls', () => {
    const data = new BlueData();
    const result = data.toBlueLiveCSD();

    expect(result.csdText).toMatch(/sr=/);
    expect(result.csdText).toMatch(/ksmps=/);
    expect(result.csdText).toMatch(/nchnls=/);
  });

  it('includes project UDOs in the orchestra', () => {
    const data = new BlueData();
    const udo = new OpcodeDefinition();
    udo.setName('myUDO');
    udo.setOutTypes('a');
    udo.setInTypes('a');
    udo.setCode('xin\n  xout = xin\n  xout');
    data.getOpcodeList().addOpcode(udo);

    const result = data.toBlueLiveCSD();
    expect(result.csdText).toContain('myUDO');
  });

  it('includes global orchestra and score text', () => {
    const data = new BlueData();
    data.getGlobalOrcSco().setGlobalOrc('giGlobal init 1');
    data.getGlobalOrcSco().setGlobalSco('f1 0 1024 10 1');

    const result = data.toBlueLiveCSD();
    expect(result.csdText).toContain('giGlobal init 1');
    expect(result.csdText).toContain('f1 0 1024 10 1');
  });

  it('keeps arrangement global orchestra text in CsInstruments, not CsScore', () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setName('HasGlobalOrc');
    instr.setText('aout oscili p4, p5\n  out aout');
    instr.setGlobalOrc('giArr init 2');
    data.getArrangement().addInstrument(instr, '1');

    const result = data.toBlueLiveCSD();
    const instruments =
      result.csdText.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/)?.[1] ?? '';
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)?.[1] ?? '';

    expect(instruments).toContain('giArr init 2');
    expect(score).not.toContain('giArr init 2');
  });

  it('uses named always-on ids for non-numeric arrangement ids', () => {
    const data = new BlueData();
    const instr = new BlueSynthBuilder();
    instr.setName('NamedAlwaysOn');
    instr.setInstrumentText('aout oscili 0.25, 440\nout aout');
    instr.setAlwaysOnInstrumentText('aout oscili 0.25, 330\nblueMixerOut aout');
    data.getArrangement().addInstrument(instr, 'PadBus');

    const result = data.toBlueLiveCSD();
    expect(result.csdText).toContain('instr PadBus_alwaysOn');
    expect(result.csdText).toContain('i "PadBus_alwaysOn" 0 36000');
  });

  it('generates empty CSD for a default BlueData', () => {
    const data = new BlueData();
    const result = data.toBlueLiveCSD();

    expect(result.csdText).toBeDefined();
    expect(result.csdText.length).toBeGreaterThan(0);
    expect(result.parameters).toBeDefined();
    expect(result.stringChannels).toBeDefined();
  });
});
describe('Blue Live compiled MIDI target catalog', () => {
  it('returns a deterministic empty catalog when no instruments are enabled', () => {
    const data = new BlueData();
    const result = data.toBlueLiveCSD();
    expect(result.midiInstrumentTargets).toEqual([]);
  });

  it('includes enabled Orchestra assignments as orchestra targets and excludes disabled ones', () => {
    const data = new BlueData();
    const enabled = new GenericInstrument();
    enabled.setName('Enabled');
    enabled.setText('out aout');
    const other = new GenericInstrument();
    other.setName('Other');
    other.setText('out aout');
    data.getArrangement().addInstrument(enabled, '1');
    data.getArrangement().addInstrument(other, '2');
    // Disable the assignment (InstrumentAssignment.enabled), not the instrument.
    data.getArrangement().updateAssignment('2', { enabled: false });

    const result = data.toBlueLiveCSD();
    const targets = result.midiInstrumentTargets ?? [];
    const orch = targets.filter((t) => t.kind === 'orchestra');
    expect(orch).toHaveLength(1);
    expect(orch[0]).toMatchObject({ kind: 'orchestra', assignmentId: '1' });
    expect(targets.some((t) => t.kind === 'orchestra' && t.assignmentId === '2')).toBe(false);
  });

  it('does not mutate the canonical Arrangement or write target ids into saved XML', () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    const sizeBefore = data.getArrangement().size();
    const xmlBefore = data.saveToString();

    data.toBlueLiveCSD();

    expect(data.getArrangement().size()).toBe(sizeBefore);
    expect(data.saveToString()).toBe(xmlBefore);
    expect(data.saveToString()).not.toContain('midiInstrumentTargets');
    expect(data.saveToString()).not.toContain('track-instrument');
  });

  it('rebuilds the catalog without stale entries after instrument replacement', () => {
    const data = new BlueData();
    const first = new GenericInstrument();
    first.setText('out aout');
    data.getArrangement().addInstrument(first, '1');

    const firstResult = data.toBlueLiveCSD();
    expect(firstResult.midiInstrumentTargets).toHaveLength(1);

    data.getArrangement().replaceInstrument('1', new GenericInstrument());
    const replaced = data.toBlueLiveCSD();
    expect(replaced.midiInstrumentTargets).toHaveLength(1);
    expect(replaced.midiInstrumentTargets?.[0]).toMatchObject({
      kind: 'orchestra',
      assignmentId: '1',
    });
  });
});

// ─── Spec 118 T021: optimized send paths in BlueLive generation ───

describe('Blue Live mixer optimization parity (Spec 118 T021)', () => {
  function createLiveSendProject(): BlueData {
    const data = new BlueData();
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const bus = new Channel();
    bus.setName('Bus');
    bus.setOutChannel('Master');
    mixer.getSubChannels().push(bus);
    const source = new Channel();
    source.setName('Track 1');
    source.setAssociation('track-1');
    source.setOutChannel('Master');
    for (const [chain, level, pre] of [
      [source.getPreEffects(), 0.35, true],
      [source.getPostEffects(), 0.5, false],
    ] as const) {
      const send = new Send();
      send.setSendChannel('Bus');
      send.setLevel(level);
      chain.push(send);
    }
    mixer.getChannels().push(source);
    const instrument = new GenericInstrument();
    instrument.setName('Sine');
    instrument.setText('aL oscili 0.2, 440\naR oscili 0.2, 441\nblueMixerOut aL, aR');
    data.getArrangement().addInstrument(instrument, '1');
    return data;
  }

  it('uses combined send gains in BlueLive and stays deterministic across rebuilds', () => {
    const data = createLiveSendProject();
    const first = data.toBlueLiveCSD();
    const second = data.toBlueLiveCSD();
    expect(second.csdText).toBe(first.csdText);
    expect((first.csdText.match(/^kMixSendGain = /gm) ?? []).length).toBe(2);
    // One batched clear of the full accumulator set.
    const clearLines = first.csdText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('clear '));
    expect(clearLines).toHaveLength(1);
    expect(clearLines[0]).toContain('ga_bluemix_0_0');
    expect(clearLines[0]).toContain('ga_bluesub_Master_1');
  });

  it('keeps gate ordinals consumed identically: combined statements do not shift gate numbering', () => {
    const data = createLiveSendProject();
    const result = data.toBlueLiveCSD();
    const gates = result.mixerGateBindings?.gates ?? [];
    expect(gates.map((gate) => gate.ordinal)).toEqual(gates.map((_gate, index) => index));
  });
});
