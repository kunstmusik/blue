import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { Channel } from './mixer/channel';
import { GenericInstrument } from './instruments/generic-instrument';
import { Send } from './mixer/send';
import { Effect } from './mixer/effect';

describe('BlueData CSD render copy safety', () => {
  it('does not mutate the live arrangement or mixer state during render', () => {
    const data = new BlueData();

    const arrangement = new Arrangement();
    const activeInstrument = new GenericInstrument();
    activeInstrument.setName('Active');
    activeInstrument.setText('aout oscili p4, p5');
    arrangement.addInstrument(activeInstrument, '1');

    const disabledInstrument = new GenericInstrument();
    disabledInstrument.setName('Disabled');
    disabledInstrument.setText('aout oscili p4, p5');
    arrangement.addInstrument(disabledInstrument, '2');
    arrangement.getArrangement()[1]!.enabled = false;

    data.setArrangement(arrangement);

    const channel = new Channel();
    channel.setName('Bus');
    data.getMixer().getChannels().push(channel);

    const liveLevelParameter = channel.getLevelParameter();
    expect(liveLevelParameter.getCompilationVarName()).toBeNull();

    const firstRender = data.toCSD();
    const secondRender = data.toCSD();

    expect(secondRender).toBe(firstRender);
    expect(data.getArrangement().size()).toBe(2);
    expect(data.getArrangement().getArrangement()[1]!.enabled).toBe(false);
    expect(liveLevelParameter.getCompilationVarName()).toBeNull();
  });
});

// ─── Spec 118 T022: optimized generation leaves canonical state untouched ───

describe('mixer optimization copy safety (Spec 118 T022)', () => {
  it('leaves the project XML, authored text, and parameter identities unchanged by optimized generation', () => {
    const data = new BlueData();
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const reverb = new Channel();
    reverb.setName('Reverb');
    reverb.setOutChannel('Master');
    mixer.getSubChannels().push(reverb);
    const source = new Channel();
    source.setName('Track 1');
    source.setOutChannel('Master');
    const send = new Send();
    send.setSendChannel('Reverb');
    send.setLevel(0.42);
    source.getPostEffects().push(send);
    mixer.getChannels().push(source);
    const instrument = new GenericInstrument();
    instrument.setName('Sine');
    instrument.setText('aL oscili 0.2, 440\n  aR oscili 0.2, 441\nblueMixerOut aL, aR');
    data.getArrangement().addInstrument(instrument, '1');

    const beforeXml = data.saveToString();
    const beforeInstrumentText = instrument.getText();
    const sendIdentity = send.getRuntimeIdentity();
    const sendParameter = send.getLevelParameter();

    const realtime = data.toRealtimePlaybackCSD();
    expect(realtime.csdText).toMatch(/^kMixSendGain = /m);
    data.toDiskCSD();
    data.toBlueLiveCSD();

    expect(data.saveToString()).toBe(beforeXml);
    expect(instrument.getText()).toBe(beforeInstrumentText);
    expect(send.getRuntimeIdentity()).toBe(sendIdentity);
    expect(sendParameter.getCompilationVarName()).toBeNull();
  });
});

describe('mixer generation failure copy safety (Spec 118 T051)', () => {
  it('preserves authored content, identities, references and compilation state on success and actual sync/async failure', async () => {
    let reject = false,
      prepared = false;
    class FailingAfterPreparation extends GenericInstrument {
      override generateGlobalOrc(): string {
        prepared = true;
        return this.getGlobalOrc();
      }
      override generateInstrument(): string {
        if (reject) throw new Error('controlled instrument generation failure after preparation');
        return super.generateInstrument();
      }
      override deepCopy(): GenericInstrument {
        const copy = new FailingAfterPreparation();
        copy.setName(this.getName());
        copy.setText(this.getText());
        copy.setGlobalOrc(this.getGlobalOrc());
        copy.setGlobalSco(this.getGlobalSco());
        return copy;
      }
    }
    const data = new BlueData(),
      mixer = data.getMixer();
    mixer.setEnabled(true);
    mixer.setPanningEnabled(false);
    const instrument = new FailingAfterPreparation();
    instrument.setText('  aL init 0.125\n\tblueMixerOut aL, aL\n  ');
    instrument.setGlobalOrc('; significant global whitespace  \n\n');
    instrument.setGlobalSco('; authored score  \n');
    data.getArrangement().addInstrument(instrument, 'Source');
    const source = new Channel();
    source.setName('Source');
    const send = new Send();
    send.setSendChannel('Master');
    send.setLevel(0.42);
    const effect = new Effect();
    effect.setNumIns(2);
    effect.setNumOuts(2);
    effect.setCode('  aout1 = ain1\n\taout2 = ain2\n  ');
    source.getPreEffects().push(effect);
    source.getPostEffects().push(send);
    mixer.getChannels().push(source);
    const parameters = [source.getLevelParameter(), send.getLevelParameter()];
    parameters.forEach((parameter, index) => parameter.setCompilationVarName(`canonical_${index}`));
    const beforeXml = data.saveToString();
    const ids = {
      channel: source.getRuntimeIdentity(),
      send: send.getRuntimeIdentity(),
      parameters: parameters.map((parameter) => parameter.getUniqueId()),
    };
    const verify = () => {
      expect(data.saveToString()).toBe(beforeXml);
      expect(data.getArrangement().getInstrument(0)).toBe(instrument);
      expect(mixer.getChannels()[0]).toBe(source);
      expect(source.getPostEffects()[0]).toBe(send);
      expect(source.getPreEffects()[0]).toBe(effect);
      expect(source.getLevelParameter()).toBe(parameters[0]);
      expect(send.getLevelParameter()).toBe(parameters[1]);
      expect(source.getRuntimeIdentity()).toBe(ids.channel);
      expect(send.getRuntimeIdentity()).toBe(ids.send);
      expect(parameters.map((parameter) => parameter.getUniqueId())).toEqual(ids.parameters);
      expect(parameters.map((parameter) => parameter.getCompilationVarName())).toEqual([
        'canonical_0',
        'canonical_1',
      ]);
    };
    for (const failure of [false, true]) {
      reject = failure;
      for (const generate of [
        () => data.toRealtimePlaybackCSD(),
        () => data.toRealtimePlaybackCSDAsync(),
        () => data.toDiskCSD(),
        () => data.toDiskCSDAsync(),
        () => data.toBlueLiveCSD(),
      ]) {
        prepared = false;
        if (failure)
          await expect(Promise.resolve().then<unknown>(generate)).rejects.toThrow(
            'controlled instrument generation failure after preparation',
          );
        else await generate();
        expect(prepared).toBe(true);
        verify();
      }
    }
  });
});
