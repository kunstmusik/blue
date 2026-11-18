import { describe, expect, it } from 'vite-plus/test';
import { Element } from '../../src/serialization/xml-reader';
import { EffectsChain } from '../../src/mixer/effects-chain';
import { Effect } from '../../src/mixer/effect';
import { Send } from '../../src/mixer/send';

describe('EffectsChain', () => {
  it('preserves effect and send order when loading Java mixer XML', () => {
    const xml = new Element('effectsChain');

    const effectA = xml.addElement('effect');
    effectA.addElement('name').setText('First');

    const send = xml.addElement('send');
    send.addElement('sendChannel').setText('Reverb');
    send.addElement('level').setText('0.5');

    const effectB = xml.addElement('effect');
    effectB.addElement('name').setText('Second');

    const chain = EffectsChain.loadFromXML(xml);

    expect(chain).toHaveLength(3);
    expect(chain[0]).toBeInstanceOf(Effect);
    expect(chain[1]).toBeInstanceOf(Send);
    expect(chain[2]).toBeInstanceOf(Effect);
  });
});
