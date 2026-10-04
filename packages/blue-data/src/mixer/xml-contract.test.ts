import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { Mixer } from './mixer';
import { Channel } from './channel';
import { Effect } from './effect';
import { EffectsChain } from './effects-chain';
import { Send } from './send';
import { UDOStyle } from '../opcodes/udo-style';

describe('mixer XML acceptance contracts', () => {
  it.each([
    '<mixer extra="x"/>',
    '<mixer><unknown/></mixer>',
    '<mixer panningEnabled="yes"/>',
    '<mixer panLawDb="-5"/>',
    '<mixer><meterProfile>other</meterProfile></mixer>',
    '<mixer><extraRenderTime>1x</extraRenderTime></mixer>',
    '<mixer><channelList list="other"/></mixer>',
    '<mixer><channelList list="channels"/><channels/></mixer>',
    '<mixer><channelList list="subChannels"/><channelList list="SubChannels"/></mixer>',
    '<mixer><channel><name>ordinary</name></channel></mixer>',
  ])('rejects unsupported mixer input %s', (xml) => {
    expect(() => Mixer.loadFromXML(Element.parse(xml))).toThrow();
  });
  it('normalizes historical wrappers and master names', () => {
    const mixer = Mixer.loadFromXML(
      Element.parse(
        '<mixer><channels><channel><name>one</name></channel></channels><subChannels/><channel><name>master</name></channel></mixer>',
      ),
    );
    expect(mixer.getChannels()[0].getName()).toBe('one');
    expect(mixer.getMaster().getName()).toBe('Master');
    expect(mixer.saveAsXML().getElement('channels')).toBeNull();
    expect(mixer.isPanningEnabled()).toBe(false);
    expect(mixer.isEnableMeters()).toBe(false);
  });
  it.each([
    '<channel><pan>2</pan></channel>',
    '<channel><muted>yes</muted></channel>',
    '<channel><stereoPanMode>invalid</stereoPanMode></channel>',
    '<channel><level>1x</level></channel>',
    '<channel><effectsChain bin="other"/></channel>',
    '<channel><effectsChain bin="post"/><effectsChain/></channel>',
    '<channel><effectsChain bin="post"/><send/></channel>',
    '<channel><effectsChain bin="pre"/><effectsChain bin="pre"/></channel>',
    '<channel><parameter><name>Unknown</name></parameter></channel>',
    '<channel association="a"><association>b</association></channel>',
  ])('rejects unsupported channel input %s', (xml) => {
    expect(() => Channel.loadFromXML(Element.parse(xml))).toThrow();
  });
  it('orders an unbinned chain before legacy direct sends without duplicate output', () => {
    const channel = Channel.loadFromXML(
      Element.parse(
        '<channel><effectsChain><effect><name>first</name></effect></effectsChain><send><sendChannel>Master</sendChannel></send></channel>',
      ),
    );
    expect(
      channel.getPostEffects().map((item) => (item instanceof Effect ? item.getName() : 'send')),
    ).toEqual(['first', 'send']);
    expect(
      channel
        .saveAsXML()
        .getElements('effectsChain')
        .toArray()
        .map((e) => e.getAttribute('bin')),
    ).toEqual(['pre', 'post']);
  });
  it.each([
    '<effect><style>invalid</style></effect>',
    '<effect><numIns>-1</numIns></effect>',
    '<effect><numOuts>2x</numOuts></effect>',
    '<effect><enabled>maybe</enabled></effect>',
    '<effect><parameterList/><bsbParameterList/></effect>',
    '<effect><unknown/></effect>',
    '<effect><code><nested/></code></effect>',
  ])('rejects unsupported effect input %s', (xml) => {
    expect(() => Effect.loadFromXML(Element.parse(xml))).toThrow();
  });
  it('normalizes the historical effect parameter list and preserves code whitespace', () => {
    const effect = Effect.loadFromXML(
      Element.parse('<effect><code>  aout = ain\n</code><bsbParameterList/></effect>'),
    );
    expect(effect.getStyle()).toBe(UDOStyle.CLASSIC);
    expect(effect.getCode()).toBe('  aout = ain\n');
    expect(effect.saveAsXML().getElement('parameterList')).not.toBeNull();
  });
  it('writes the compatibility chain into a single canonical post bin', () => {
    const channel = new Channel();
    channel.getEffectsChain().push(new Effect());
    const output = channel.saveAsXML();
    expect(
      output
        .getElements('effectsChain')
        .toArray()
        .map((chain) => chain.getAttribute('bin')),
    ).toEqual(['pre', 'post']);
    expect(Channel.loadFromXML(output).getPostEffects()).toHaveLength(1);
  });
  it('rejects unresolved sends at the complete mixer boundary', () => {
    expect(() =>
      Mixer.loadFromXML(
        Element.parse(
          '<mixer><channelList list="channels"><channel><name>one</name><effectsChain bin="post"><send><sendChannel>missing</sendChannel></send></effectsChain></channel></channelList></mixer>',
        ),
      ),
    ).toThrow();
  });
  it('rejects unknown chain items and send members', () => {
    expect(() =>
      EffectsChain.loadFromXML(Element.parse('<effectsChain><unknown/></effectsChain>')),
    ).toThrow();
    expect(() => Send.loadFromXML(Element.parse('<send><level>1garbage</level></send>'))).toThrow();
    expect(() =>
      Send.loadFromXML(Element.parse('<send><targetChannelId>bus</targetChannelId></send>')),
    ).toThrow();
  });
});
