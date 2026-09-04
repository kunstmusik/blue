import { describe, expect, it } from 'vitest';
import { createDefaultBlueX7Voice } from '../blue-x7';
import { BLUE_X7_PARAMETER_DESCRIPTORS } from './parameter-catalog';
import { buildBlueX7VoiceTransport } from './voice-transport';
import { extractBlueX7VoiceBody, generateBlueX7Target } from './csound-target-generator';

describe('BlueX7 Csound target generator', () => {
  it('emits a complete static direct-array target without live transport machinery', () => {
    const voice = createDefaultBlueX7Voice();
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const target = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
    });

    expect(target.match(/iBlueX7Voice\[\d+\] = /g)).toHaveLength(155);
    expect(target).toContain('iBlueX7Voice[134] = 18');
    expect(target).toContain('iBlueX7Voice[125] = 4');
    expect(target).toContain('aout = bluex7_voice(iBlueX7MidiNote, i(p5), iBlueX7Voice');
    expect(target).not.toContain('tabw');
    expect(target).not.toContain('chnget');
    expect(target).not.toContain('kBlueX7Hold');
  });

  it('binds all catalog parameters to direct globals and uses one domain epoch', () => {
    const voice = createDefaultBlueX7Voice();
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const parameters = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => ({
      key: descriptor.key,
      symbol: `gk_blue_auto${index}`,
    }));
    const target = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
      parameters,
      changeStrategy: 'epoch',
      epochSymbol: 'gk_blue_x7_epoch_0',
    });

    expect(target).toContain('iBlueX7Voice[134] = i(gk_blue_auto0) - 1');
    expect(target).toContain('iBlueX7Voice[125] = i(gk_blue_auto39) + 7');
    expect(target).toContain('kBlueX7Dirty = (gk_blue_x7_epoch_0 != kBlueX7EpochSeen ? 1 : 0)');
    expect(target).toContain('kFbAmt = (gk_blue_auto1 == 0 ? 0 : 2 ^ (gk_blue_auto1 - 8))');
    expect(target).toContain('(gk_blue_auto40 > 0 ? 1 : 0)');
    expect(target).not.toMatch(/changed gk_blue_auto/);
    expect(target).not.toContain('chnget');
  });

  it('keeps the live inline target free of a 155-slot k-rate voice copy', () => {
    const voice = createDefaultBlueX7Voice();
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const parameters = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => ({
      key: descriptor.key,
      symbol: `gk_blue_auto${index}`,
    }));
    const target = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
      parameters,
      layout: 'inline',
      changeStrategy: 'epoch',
      epochSymbol: 'gk_blue_x7_epoch_0',
    });

    expect(target).not.toContain('kBlueX7LiveVoice');
    expect(target).not.toContain('kBlueX7LiveOperatorState');
    expect(target).toContain('kBlueX7LivePegRate[] init 4');
    expect(target).toContain('kBlueX7LiveOutputLevelSeen[] init 6');
    expect(target).toContain('gk_blue_auto19');
    expect(target).toContain('kBlueX7LiveOutputLevelSeen[0] = iBlueX7Voice[121]');
    expect(target).toContain('kBlueX7Op1NewOl = gk_blue_auto35');
    expect(target).toContain('kBlueX7LiveMaskLocal =');
  });

  it('can inline the shared voice body without leaving an opcode return', () => {
    const voice = createDefaultBlueX7Voice();
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const target = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
      layout: 'inline',
    });
    expect(extractBlueX7VoiceBody()).toContain('iAlgo    = iVoice[134]');
    expect(target).toContain('aout = aOut');
    expect(target).not.toContain('xout aOut');
    expect(target).not.toContain('opcode bluex7_voice');
  });

  it('calls the statically selected algorithm UDO directly, keeping the dispatcher for runtime switches', () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 5;
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    const target = generateBlueX7Target({
      voice: transport.voice,
      operatorMask: transport.operatorMask,
      layout: 'inline',
    });
    expect(target).toContain('if iAlgo == 4 then');
    expect(target).toContain('aOut = dx7_algo_05(kGain, kDph, iPh0A, kFbAmt)');
    // common.algorithm is a next-note parameter; notes started after a
    // runtime channel edit must still reach the dispatcher fallback.
    expect(target).toContain('aOut = dx7_render_algorithm(iAlgo, kGain, kDph, iPh0A, kFbAmt)');

    const outOfRange = [...transport.voice];
    outOfRange[134] = 99;
    const fallback = generateBlueX7Target({
      voice: outOfRange,
      operatorMask: transport.operatorMask,
      layout: 'inline',
    });
    expect(fallback).toContain('aOut = dx7_render_algorithm(iAlgo, kGain, kDph, iPh0A, kFbAmt)');
    expect(fallback).not.toContain('dx7_algo_');
  });

  it('rejects incomplete live bindings and invalid Csound symbols', () => {
    const voice = createDefaultBlueX7Voice();
    const transport = buildBlueX7VoiceTransport(voice, voice.common.operatorEnabled);
    expect(() =>
      generateBlueX7Target({
        voice: transport.voice,
        operatorMask: transport.operatorMask,
        parameters: [{ key: 'common.algorithm', symbol: 'gk_valid' }],
        epochSymbol: 'gk_epoch',
        changeStrategy: 'epoch',
      }),
    ).toThrow(/151 resolved parameters/);
    expect(() =>
      generateBlueX7Target({
        voice: transport.voice,
        operatorMask: transport.operatorMask,
        parameters: BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor) => ({
          key: descriptor.key,
          symbol: 'gk-invalid',
        })),
      }),
    ).toThrow(/invalid Csound global symbol/);
  });
});
