import { describe, it, expect } from 'vitest';
import { Mixer } from './mixer';
import { Element } from '../serialization/xml-reader';
import { ChannelList } from './channel-list';
import { Channel } from './channel';

describe('Mixer', () => {
  describe('default state', () => {
    it('is enabled by default', () => {
      const mixer = new Mixer();
      expect(mixer.isEnabled()).toBe(true);
    });

    it('has master channel named Master', () => {
      const mixer = new Mixer();
      expect(mixer.getMaster().getName()).toBe('Master');
    });

    it('initializes Orchestra/SubChannels list names with non-editable defaults', () => {
      const mixer = new Mixer();
      expect(mixer.getChannels().getListName()).toBe('Orchestra');
      expect(mixer.getChannels().isListNameEditSupported()).toBe(false);
      expect(mixer.getSubChannels().getListName()).toBe('SubChannels');
      expect(mixer.getSubChannels().isListNameEditSupported()).toBe(false);
    });
  });

  describe('Java-format enabled child element', () => {
    it('loads <enabled>false</enabled> child element (Java format)', () => {
      const xml = '<mixer><enabled>false</enabled></mixer>';
      const mixer = Mixer.loadFromXML(Element.parse(xml));
      expect(mixer.isEnabled()).toBe(false);
    });

    it('loads <enabled>true</enabled> child element (Java format)', () => {
      const xml = '<mixer><enabled>true</enabled></mixer>';
      const mixer = Mixer.loadFromXML(Element.parse(xml));
      expect(mixer.isEnabled()).toBe(true);
    });

    it('loading an empty mixer element keeps it enabled', () => {
      const xml = '<mixer></mixer>';
      const mixer = Mixer.loadFromXML(Element.parse(xml));
      expect(mixer.isEnabled()).toBe(true);
    });
  });

  describe('saveAsXML writes Java-format output', () => {
    it('writes enabled as child element, not attribute', () => {
      const mixer = new Mixer();
      mixer.setEnabled(true);
      const xml = mixer.saveAsXML().toXml();
      expect(xml).toContain('<enabled>true</enabled>');
      expect(xml).not.toMatch(/enabled="true"/);
    });

    it('writes enabled=false as child element', () => {
      const mixer = new Mixer();
      mixer.setEnabled(false);
      const xml = mixer.saveAsXML().toXml();
      expect(xml).toContain('<enabled>false</enabled>');
      expect(xml).not.toMatch(/enabled="false"/);
    });
  });

  describe('save/load round-trip', () => {
    it('preserves enabled state', () => {
      const mixer = new Mixer();
      mixer.setEnabled(false);
      const xml = mixer.saveAsXML();
      const loaded = Mixer.loadFromXML(xml);
      expect(loaded.isEnabled()).toBe(false);
    });

    it('round-trips through Java-format XML', () => {
      const javaXml = '<mixer><enabled>false</enabled><extraRenderTime>0</extraRenderTime></mixer>';
      const loaded = Mixer.loadFromXML(Element.parse(javaXml));
      expect(loaded.isEnabled()).toBe(false);
      const saved = loaded.saveAsXML().toXml();
      expect(saved).toContain('<enabled>false</enabled>');
    });

    it('loads source channels from Java channelListGroups into channelListGroups, not flat channels', () => {
      const javaXml = [
        '<mixer>',
        '  <enabled>true</enabled>',
        '  <channelListGroups>',
        '    <channelList association="group-1" listName="Audio Layer Group">',
        '      <channel association="layer-1">',
        '        <name>Channel</name>',
        '        <outChannel>Master</outChannel>',
        '        <level>0.0</level>',
        '        <muted>false</muted>',
        '        <solo>false</solo>',
        '        <effectsChain bin="pre"/>',
        '        <effectsChain bin="post"/>',
        '      </channel>',
        '    </channelList>',
        '  </channelListGroups>',
        '  <channelList listName="Orchestra" list="channels"/>',
        '  <channelList listName="SubChannels" list="subChannels"/>',
        '  <channel>',
        '    <name>Master</name>',
        '    <outChannel>Master</outChannel>',
        '    <level>0.0</level>',
        '    <muted>false</muted>',
        '    <solo>false</solo>',
        '    <effectsChain bin="pre"/>',
        '    <effectsChain bin="post"/>',
        '  </channel>',
        '</mixer>',
      ].join('\n');

      const loaded = Mixer.loadFromXML(Element.parse(javaXml));

      // Flat channels list does not include group channels
      expect(loaded.getChannels()).toHaveLength(0);
      // channelListGroups preserves the group structure
      expect(loaded.getChannelListGroups()).toHaveLength(1);
      expect(loaded.getChannelListGroups()[0]).toHaveLength(1);
      expect(loaded.getChannelListGroups()[0]![0]?.getAssociation()).toBe('layer-1');
      // getAllSourceChannels() returns group channels + flat channels
      expect(loaded.getAllSourceChannels()).toHaveLength(1);
      expect(loaded.getAllSourceChannels()[0]?.getAssociation()).toBe('layer-1');
      expect(loaded.getAllSourceChannels()[0]?.getOutChannel()).toBe('Master');
    });

    it('round-trips channelListGroups through save/load', () => {
      const javaXml = [
        '<mixer>',
        '  <channelListGroups>',
        '    <channelList association="group-1" listName="Audio Layer Group">',
        '      <channel association="layer-1"><name>Channel</name><outChannel>Master</outChannel><level>0.0</level><muted>false</muted><solo>false</solo><effectsChain bin="pre"/><effectsChain bin="post"/></channel>',
        '    </channelList>',
        '  </channelListGroups>',
        '  <channelList list="channels"/>',
        '  <channelList list="subChannels"/>',
        '</mixer>',
      ].join('\n');

      const loaded = Mixer.loadFromXML(Element.parse(javaXml));
      const saved = loaded.saveAsXML().toXml();
      expect(saved).toContain('<channelListGroups>');

      const reloaded = Mixer.loadFromXML(Element.parse(saved));
      expect(reloaded.getChannelListGroups()).toHaveLength(1);
      expect(reloaded.getAllSourceChannels()).toHaveLength(1);
      expect(reloaded.getAllSourceChannels()[0]?.getAssociation()).toBe('layer-1');
    });

    it('round-trips channel list metadata fields for grouped channel lists', () => {
      const javaXml = [
        '<mixer>',
        '  <channelListGroups>',
        '    <channelList association="group-1" listName="Audio Layer Group">',
        '      <channel association="layer-1"><name>Layer A</name><outChannel>Master</outChannel><level>0.0</level><muted>false</muted><solo>false</solo><effectsChain bin="pre"/><effectsChain bin="post"/></channel>',
        '    </channelList>',
        '  </channelListGroups>',
        '  <channelList list="channels"/>',
        '  <channelList list="subChannels"/>',
        '</mixer>',
      ].join('\n');
      const loaded = Mixer.loadFromXML(Element.parse(javaXml));
      const group = loaded.getChannelListGroups()[0];
      expect(group?.getAssociation()).toBe('group-1');
      expect(group?.getListName()).toBe('Audio Layer Group');
      expect(group?.isListNameEditSupported()).toBe(true);

      const saved = loaded.saveAsXML().toXml();
      expect(saved).toContain('association="group-1"');
      expect(saved).toContain('listName="Audio Layer Group"');
    });
  });

  describe('deepCopy', () => {
    it('creates independent copy', () => {
      const original = new Mixer();
      const copy = original.deepCopy() as Mixer;
      expect(copy).not.toBe(original);
      expect(copy.isEnabled()).toBe(original.isEnabled());
    });

    it('mutation does not leak', () => {
      const original = new Mixer();
      original.setEnabled(true);
      const copy = original.deepCopy() as Mixer;
      copy.setEnabled(false);
      expect(original.isEnabled()).toBe(true);
    });

    it('includes grouped channels in init statements', () => {
      const mixer = new Mixer();
      const groupList = new ChannelList();
      groupList.setAssociation('group-1');
      groupList.setListName('Audio Layer Group');
      const groupedChannel = new Channel();
      groupedChannel.setAssociation('layer-1');
      groupedChannel.setName('Layer 1');
      groupList.push(groupedChannel);
      mixer.getChannelListGroups().push(groupList);

      const assignments = new Map<Channel, number>();
      assignments.set(groupedChannel, 0);
      assignments.set(mixer.getMaster(), 1);
      const init = mixer.getInitStatements(assignments, 2);

      expect(init).toContain('ga_bluemix_0_0\tinit\t0');
      expect(init).toContain('ga_bluemix_0_1\tinit\t0');
    });

    it('emits metering chn_k statements with stable sanitized subchannel keys and collision resolution', () => {
      const mixer = new Mixer();
      const sub1 = new Channel();
      sub1.setName('My Drums');
      const sub2 = new Channel();
      sub2.setName('My_Drums');
      mixer.getSubChannels().push(sub1);
      mixer.getSubChannels().push(sub2);

      const src = new Channel();
      src.setName('Synth');
      mixer.getChannels().push(src);

      const assignments = new Map<Channel, number>();
      assignments.set(src, 0);
      assignments.set(sub1, 1);
      assignments.set(sub2, 2);
      assignments.set(mixer.getMaster(), 3);

      const init = mixer.getInitStatements(assignments, 2, true);

      // Source channel
      expect(init).toContain('chn_k\t"bm_meter_rms_0_0", 2');
      expect(init).toContain('chn_k\t"bm_meter_peak_0_1", 2');

      // Subchannel 1 (whitespace replaced by underscore)
      expect(init).toContain('chn_k\t"bm_meter_rms_sub_My_Drums_0", 2');
      expect(init).toContain('chn_k\t"bm_meter_peak_sub_My_Drums_1", 2');

      // Subchannel 2 (resolved collision)
      expect(init).toContain('chn_k\t"bm_meter_rms_sub_My_Drums_2_0", 2');
      expect(init).toContain('chn_k\t"bm_meter_peak_sub_My_Drums_2_1", 2');

      // Master channel
      expect(init).toContain('chn_k\t"bm_meter_rms_sub_Master_0", 2');
      expect(init).toContain('chn_k\t"bm_meter_peak_sub_Master_1", 2');
    });
  });
});
