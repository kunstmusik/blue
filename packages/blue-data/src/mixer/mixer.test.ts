import { describe, it, expect } from 'vitest';
import {
  Mixer,
  buildSubChannelMeterKeys,
  METER_PROFILE_KEYS,
  DEFAULT_NEW_METER_ENABLED,
  DEFAULT_NEW_METER_PROFILE_KEY,
  DEFAULT_LEGACY_METER_ENABLED,
  DEFAULT_LEGACY_METER_PROFILE_KEY,
  type MeterProfileKey,
} from './mixer';
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

    it('enforces 42-UTF-8-byte budget and resolves truncation collisions for long names', () => {
      const longName1 = 'VeryLongSubChannelNameThatExceedsTheBudgetAndHasExtraCharsOne';
      const longName2 = 'VeryLongSubChannelNameThatExceedsTheBudgetAndHasExtraCharsTwo';

      const sub1 = new Channel();
      sub1.setName(longName1);
      const sub2 = new Channel();
      sub2.setName(longName2);

      const keys = buildSubChannelMeterKeys([sub1, sub2]);
      const key1 = keys.get(sub1)!;
      const key2 = keys.get(sub2)!;

      const encoder = new TextEncoder();
      expect(encoder.encode(key1).length).toBeLessThanOrEqual(42);
      expect(encoder.encode(key2).length).toBeLessThanOrEqual(42);
      expect(key1).not.toBe(key2);
      expect(key2).toContain('_2');
    });

    it('handles long multibyte Unicode subchannel names safely within budget', () => {
      // 3 bytes per Japanese character
      const unicodeName = 'ミックスサブチャンネル超ロング名称サンプルテストトラック';
      const sub1 = new Channel();
      sub1.setName(unicodeName);
      const sub2 = new Channel();
      sub2.setName(unicodeName);

      const keys = buildSubChannelMeterKeys([sub1, sub2]);
      const key1 = keys.get(sub1)!;
      const key2 = keys.get(sub2)!;

      const encoder = new TextEncoder();
      expect(encoder.encode(key1).length).toBeLessThanOrEqual(42);
      expect(encoder.encode(key2).length).toBeLessThanOrEqual(42);
      expect(key1).not.toBe(key2);

      // Verify valid UTF-8 string decoding without broken characters
      expect(key1).not.toContain('\uFFFD');
      expect(key2).not.toContain('\uFFFD');
    });

    it('handles duplicate channel names without collisions', () => {
      const sub1 = new Channel();
      sub1.setName('Reverb');
      const sub2 = new Channel();
      sub2.setName('Reverb');
      const sub3 = new Channel();
      sub3.setName('Reverb');

      const keys = buildSubChannelMeterKeys([sub1, sub2, sub3]);
      expect(keys.get(sub1)).toBe('sub_Reverb');
      expect(keys.get(sub2)).toBe('sub_Reverb_2');
      expect(keys.get(sub3)).toBe('sub_Reverb_3');
    });
  });

  describe('XML fixture builders (T002)', () => {
    it('creates valid new-project XML fixture', () => {
      const xml = createNewProjectMixerXml();
      const el = Element.parse(xml);
      expect(el.getName()).toBe('mixer');
      expect(el.getTextString('enableMeters')).toBe('true');
      expect(el.getTextString('meterProfile')).toBe('peak-rms-mixing-plus-6');
    });

    it('creates valid legacy XML fixture with missing meter presentation fields', () => {
      const xml = createLegacyMixerXml();
      const el = Element.parse(xml);
      expect(el.getName()).toBe('mixer');
      expect(el.getElement('enableMeters')).toBeNull();
      expect(el.getElement('meterProfile')).toBeNull();
    });

    it('creates valid explicit mixer XML fixture', () => {
      const xml = createExplicitMixerXml(false, 'k14-rms-peak');
      const el = Element.parse(xml);
      expect(el.getTextString('enableMeters')).toBe('false');
      expect(el.getTextString('meterProfile')).toBe('k14-rms-peak');
    });

    it('creates valid invalid-profile XML fixture', () => {
      const xml = createInvalidProfileMixerXml('unknown-custom-curve');
      const el = Element.parse(xml);
      expect(el.getTextString('meterProfile')).toBe('unknown-custom-curve');
    });
  });

  describe('meter presentation model coverage (T006)', () => {
    it('initializes new instances with new-project defaults', () => {
      const mixer = new Mixer();
      expect(mixer.isEnableMeters()).toBe(DEFAULT_NEW_METER_ENABLED);
      expect(mixer.isEnableMeters()).toBe(true);
      expect(mixer.getMeterProfileKey()).toBe(DEFAULT_NEW_METER_PROFILE_KEY);
      expect(mixer.getMeterProfileKey()).toBe('peak-rms-mixing-plus-6');
    });

    it('resolves missing fields on load to legacy defaults independently', () => {
      // Both missing (legacy project)
      const legacyXml = createLegacyMixerXml();
      const legacyMixer = Mixer.loadFromXML(Element.parse(legacyXml));
      expect(legacyMixer.isEnableMeters()).toBe(DEFAULT_LEGACY_METER_ENABLED);
      expect(legacyMixer.isEnableMeters()).toBe(false);
      expect(legacyMixer.getMeterProfileKey()).toBe(DEFAULT_LEGACY_METER_PROFILE_KEY);
      expect(legacyMixer.getMeterProfileKey()).toBe('peak-rms-linear-plus-6');

      // Only enableMeters present (true)
      const onlyEnabledXml =
        '<mixer><enabled>true</enabled><enableMeters>true</enableMeters></mixer>';
      const onlyEnabledMixer = Mixer.loadFromXML(Element.parse(onlyEnabledXml));
      expect(onlyEnabledMixer.isEnableMeters()).toBe(true);
      expect(onlyEnabledMixer.getMeterProfileKey()).toBe('peak-rms-linear-plus-6');

      // Only meterProfile present (k20-rms-peak)
      const onlyProfileXml =
        '<mixer><enabled>true</enabled><meterProfile>k20-rms-peak</meterProfile></mixer>';
      const onlyProfileMixer = Mixer.loadFromXML(Element.parse(onlyProfileXml));
      expect(onlyProfileMixer.isEnableMeters()).toBe(false);
      expect(onlyProfileMixer.getMeterProfileKey()).toBe('k20-rms-peak');
    });

    it('loads and saves explicit true/false and all valid profile keys', () => {
      for (const key of METER_PROFILE_KEYS) {
        for (const enabled of [true, false]) {
          const xml = createExplicitMixerXml(enabled, key);
          const loaded = Mixer.loadFromXML(Element.parse(xml));
          expect(loaded.isEnableMeters()).toBe(enabled);
          expect(loaded.getMeterProfileKey()).toBe(key);

          const saved = loaded.saveAsXML();
          expect(saved.getTextString('enableMeters')).toBe(String(enabled));
          expect(saved.getTextString('meterProfile')).toBe(key);
        }
      }
    });

    it('falls back safely for empty or unknown profile keys', () => {
      // Empty profile key
      const emptyProfileXml = '<mixer><meterProfile></meterProfile></mixer>';
      const emptyMixer = Mixer.loadFromXML(Element.parse(emptyProfileXml));
      expect(emptyMixer.getMeterProfileKey()).toBe('peak-rms-linear-plus-6');

      // Unknown profile key
      const unknownXml = createInvalidProfileMixerXml('custom-broadcast-vu');
      const unknownMixer = Mixer.loadFromXML(Element.parse(unknownXml));
      expect(unknownMixer.getMeterProfileKey()).toBe('peak-rms-linear-plus-6');

      // Setter fallback
      const mixer = new Mixer();
      mixer.setMeterProfileKey('invalid-key' as MeterProfileKey);
      expect(mixer.getMeterProfileKey()).toBe('peak-rms-linear-plus-6');
    });

    it('outputs stable XML without human labels and preserves child ordering', () => {
      const mixer = new Mixer();
      mixer.setEnableMeters(true);
      mixer.setMeterProfileKey('k14-rms-peak');

      const xml = mixer.saveAsXML().toXml();
      expect(xml).toContain('<enableMeters>true</enableMeters>');
      expect(xml).toContain('<meterProfile>k14-rms-peak</meterProfile>');
      expect(xml).not.toContain('K14 (RMS + Peak)');

      // Verify ordering: enabled -> enableMeters -> meterProfile
      const enabledIndex = xml.indexOf('<enabled>');
      const enableMetersIndex = xml.indexOf('<enableMeters>');
      const meterProfileIndex = xml.indexOf('<meterProfile>');
      expect(enabledIndex).toBeLessThan(enableMetersIndex);
      expect(enableMetersIndex).toBeLessThan(meterProfileIndex);
    });

    it('preserves unrelated XML and channel structures through round-trip', () => {
      const xml = [
        '<mixer>',
        '  <enabled>true</enabled>',
        '  <enableMeters>true</enableMeters>',
        '  <meterProfile>k12-rms-peak</meterProfile>',
        '  <channelList list="channels">',
        '    <channel><name>Audio1</name><level>-6.0</level><outChannel>Master</outChannel></channel>',
        '  </channelList>',
        '  <channelList list="subChannels">',
        '    <channel><name>Sub1</name><level>-3.0</level><outChannel>Master</outChannel></channel>',
        '  </channelList>',
        '  <channel><name>Master</name><level>0.0</level></channel>',
        '  <extraRenderTime>1.5</extraRenderTime>',
        '</mixer>',
      ].join('\n');

      const loaded = Mixer.loadFromXML(Element.parse(xml));
      expect(loaded.isEnableMeters()).toBe(true);
      expect(loaded.getMeterProfileKey()).toBe('k12-rms-peak');
      expect(loaded.getChannels()).toHaveLength(1);
      expect(loaded.getChannels()[0]?.getName()).toBe('Audio1');
      expect(loaded.getSubChannels()).toHaveLength(1);
      expect(loaded.getSubChannels()[0]?.getName()).toBe('Sub1');
      expect(loaded.getMaster().getName()).toBe('Master');
      expect(loaded.getExtraRenderTime()).toBe(1.5);

      const saved = loaded.saveAsXML().toXml();
      const reloaded = Mixer.loadFromXML(Element.parse(saved));
      expect(reloaded.isEnableMeters()).toBe(true);
      expect(reloaded.getMeterProfileKey()).toBe('k12-rms-peak');
      expect(reloaded.getChannels()).toHaveLength(1);
      expect(reloaded.getSubChannels()).toHaveLength(1);
      expect(reloaded.getExtraRenderTime()).toBe(1.5);
    });

    it('isolates deepCopy from mutations on original or copy', () => {
      const original = new Mixer();
      original.setEnableMeters(true);
      original.setMeterProfileKey('k20-rms-peak');

      const copy = original.deepCopy() as Mixer;
      expect(copy.isEnableMeters()).toBe(true);
      expect(copy.getMeterProfileKey()).toBe('k20-rms-peak');

      copy.setEnableMeters(false);
      copy.setMeterProfileKey('peak-rms-linear-plus-6');

      expect(original.isEnableMeters()).toBe(true);
      expect(original.getMeterProfileKey()).toBe('k20-rms-peak');
      expect(copy.isEnableMeters()).toBe(false);
      expect(copy.getMeterProfileKey()).toBe('peak-rms-linear-plus-6');
    });

    it('safely tolerates unknown mixer tags and unknown profile keys without dropping channel structures (T035)', () => {
      const xml = [
        '<mixer>',
        '  <enabled>true</enabled>',
        '  <futureUnknownMixerTag value="123"><nested>data</nested></futureUnknownMixerTag>',
        '  <meterProfile>nonexistent-broadcast-scale-v9</meterProfile>',
        '  <channelList list="channels">',
        '    <channel><name>Audio1</name><level>-6.0</level><outChannel>Master</outChannel></channel>',
        '  </channelList>',
        '  <channel><name>Master</name><level>0.0</level></channel>',
        '</mixer>',
      ].join('\n');

      const loaded = Mixer.loadFromXML(Element.parse(xml));
      // Missing enableMeters resolves to legacy default false
      expect(loaded.isEnableMeters()).toBe(false);
      // Unrecognized profile resolves to legacy default peak-rms-linear-plus-6
      expect(loaded.getMeterProfileKey()).toBe('peak-rms-linear-plus-6');
      // Modeled channels loaded intact
      expect(loaded.getChannels()).toHaveLength(1);
      expect(loaded.getChannels()[0]?.getName()).toBe('Audio1');
      expect(loaded.getMaster().getName()).toBe('Master');

      const savedXml = loaded.saveAsXML().toXml();
      expect(savedXml).toContain('<enableMeters>false</enableMeters>');
      expect(savedXml).toContain('<meterProfile>peak-rms-linear-plus-6</meterProfile>');
    });
  });
});

export function createNewProjectMixerXml(overrides?: {
  enableMeters?: boolean;
  meterProfile?: string;
}): string {
  const enableMeters = overrides?.enableMeters ?? true;
  const profile = overrides?.meterProfile ?? 'peak-rms-mixing-plus-6';
  return [
    '<mixer>',
    '  <enabled>true</enabled>',
    `  <enableMeters>${enableMeters}</enableMeters>`,
    `  <meterProfile>${profile}</meterProfile>`,
    '  <channelList list="channels"/>',
    '  <channelList list="subChannels"/>',
    '  <channel><name>Master</name><level>0.0</level></channel>',
    '</mixer>',
  ].join('\n');
}

export function createLegacyMixerXml(overrides?: {
  enabled?: boolean;
  extraRenderTime?: number;
}): string {
  const enabled = overrides?.enabled ?? true;
  const extraRenderTime = overrides?.extraRenderTime ?? 0.0;
  return [
    '<mixer>',
    `  <enabled>${enabled}</enabled>`,
    `  <extraRenderTime>${extraRenderTime}</extraRenderTime>`,
    '  <channelList list="channels"/>',
    '  <channelList list="subChannels"/>',
    '  <channel><name>Master</name><level>0.0</level></channel>',
    '</mixer>',
  ].join('\n');
}

export function createExplicitMixerXml(enableMeters: boolean, meterProfile: string): string {
  return [
    '<mixer>',
    '  <enabled>true</enabled>',
    `  <enableMeters>${enableMeters}</enableMeters>`,
    `  <meterProfile>${meterProfile}</meterProfile>`,
    '  <channelList list="channels"/>',
    '  <channelList list="subChannels"/>',
    '  <channel><name>Master</name><level>0.0</level></channel>',
    '</mixer>',
  ].join('\n');
}

export function createInvalidProfileMixerXml(invalidProfile: string): string {
  return [
    '<mixer>',
    '  <enabled>true</enabled>',
    '  <enableMeters>true</enableMeters>',
    `  <meterProfile>${invalidProfile}</meterProfile>`,
    '  <channelList list="channels"/>',
    '  <channelList list="subChannels"/>',
    '  <channel><name>Master</name><level>0.0</level></channel>',
    '</mixer>',
  ].join('\n');
}
