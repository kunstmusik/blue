import { describe, expect, it } from 'vitest';
import { Element } from '../../src/serialization/xml-reader';
import { Mixer } from '../../src/mixer/mixer';
import { loadRuntimeMixerFixture } from './runtime-model-fixtures';

describe('mixer runtime parity', () => {
  it('preserves master channel and extra render time across save/load', () => {
    const mixer = loadRuntimeMixerFixture();
    const savedXml = mixer.saveAsXML().toXml();
    const reloaded = Mixer.loadFromXML(Element.parse(savedXml));

    expect(savedXml).toContain('<channelList');
    expect(savedXml).toContain('list="channels"');
    expect(savedXml).toContain('list="subChannels"');
    expect(savedXml).toContain('<extraRenderTime>3.5</extraRenderTime>');
    expect(reloaded.getMaster().getName()).toBe('Master');
    expect(reloaded.getExtraRenderTime()).toBeCloseTo(3.5, 6);
  });

  it('preserves channel metadata and effect/send ordering', () => {
    const mixer = loadRuntimeMixerFixture();
    const channel = mixer.getChannels()[0]!;

    expect(channel.getAssociation()).toBe('pattern-1');
    expect(channel.getLevel()).toBeCloseTo(-3.0, 6);
    expect(channel.getPreEffects()).toHaveLength(1);
    expect(channel.getPostEffects().getSends()).toHaveLength(1);

    const savedXml = mixer.saveAsXML().toXml();
    expect(savedXml).not.toContain('<volume>');
    expect(savedXml).not.toContain('<pan>');
    expect(savedXml).toContain('<level>-3.0</level>');

    const reloaded = Mixer.loadFromXML(Element.parse(savedXml));
    const reloadedChannel = reloaded.getChannels()[0]!;

    expect(reloadedChannel.getAssociation()).toBe('pattern-1');
    expect(reloadedChannel.getLevel()).toBeCloseTo(-3.0, 6);
    expect(reloadedChannel.getPostEffects().getSends()).toHaveLength(1);
  });

  it('tracks explicit subchannel dependencies', () => {
    const mixer = new Mixer();
    expect(mixer.hasSubChannelDependencies()).toBe(false);

    mixer.addSubChannelDependency('Reverb');
    expect(mixer.hasSubChannelDependencies()).toBe(true);
  });
});
