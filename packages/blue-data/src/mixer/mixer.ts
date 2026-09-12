/**
 * Mixer — the complete mixer with channels, subchannels, effects, and routing.
 * Mirrors the Java Mixer class.
 */
import { Channel } from './channel';
import { ChannelList } from './channel-list';
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import type { CopyMode } from '../deep-copyable';
import { writeBoolean, writeDouble } from '../utilities/xml';

export type MeterProfileKey =
  | 'peak-rms-mixing-plus-6'
  | 'peak-rms-linear-plus-6'
  | 'k20-rms-peak'
  | 'k14-rms-peak'
  | 'k12-rms-peak';

export const METER_PROFILE_KEYS: readonly MeterProfileKey[] = [
  'peak-rms-mixing-plus-6',
  'peak-rms-linear-plus-6',
  'k20-rms-peak',
  'k14-rms-peak',
  'k12-rms-peak',
] as const;

export const DEFAULT_NEW_METER_ENABLED = true;
export const DEFAULT_NEW_METER_PROFILE_KEY: MeterProfileKey = 'peak-rms-mixing-plus-6';

export const DEFAULT_LEGACY_METER_ENABLED = false;
export const DEFAULT_LEGACY_METER_PROFILE_KEY: MeterProfileKey = 'peak-rms-linear-plus-6';

export function isMeterProfileKey(value: unknown): value is MeterProfileKey {
  return typeof value === 'string' && METER_PROFILE_KEYS.includes(value as MeterProfileKey);
}

export class Mixer implements BlueDataObject {
  static readonly MASTER_CHANNEL = 'Master';

  private _enabled = true;
  private _enableMeters = DEFAULT_NEW_METER_ENABLED;
  private _meterProfileKey: MeterProfileKey = DEFAULT_NEW_METER_PROFILE_KEY;
  private _channelListGroups: ChannelList[] = [];
  private _channels = new ChannelList();
  private _subChannels = new ChannelList();
  private _master = new Channel();
  private _extraRenderTime = 0;
  private _subChannelDependencies = new Set<string>();

  constructor() {
    this._master.setName(Mixer.MASTER_CHANNEL);
    this._channels.setListName('Orchestra');
    this._channels.setListNameEditSupported(false);
    this._subChannels.setListName('SubChannels');
    this._subChannels.setListNameEditSupported(false);
  }

  isEnabled(): boolean {
    return this._enabled;
  }
  setEnabled(e: boolean): void {
    this._enabled = e;
  }

  isEnableMeters(): boolean {
    return this._enableMeters;
  }
  setEnableMeters(enable: boolean): void {
    this._enableMeters = enable;
  }

  getMeterProfileKey(): MeterProfileKey {
    return this._meterProfileKey;
  }
  setMeterProfileKey(key: MeterProfileKey): void {
    this._meterProfileKey = isMeterProfileKey(key) ? key : DEFAULT_LEGACY_METER_PROFILE_KEY;
  }

  getExtraRenderTime(): number {
    return this._extraRenderTime;
  }
  setExtraRenderTime(t: number): void {
    this._extraRenderTime = t;
  }

  getChannelListGroups(): ChannelList[] {
    return this._channelListGroups;
  }
  clearChannelListGroups(): void {
    this._channelListGroups = [];
  }
  getChannels(): ChannelList {
    return this._channels;
  }
  getSubChannels(): ChannelList {
    return this._subChannels;
  }
  getMaster(): Channel {
    return this._master;
  }
  setMaster(master: Channel): void {
    this._master = master;
  }

  /**
   * Get Csound variable name for a channel output.
   */
  static getChannelVar(channelId: number, outputIndex: number): string {
    return `ga_bluemix_${channelId}_${outputIndex}`;
  }

  /**
   * Get Csound variable name for a subchannel output.
   */
  static getSubChannelVar(name: string, outputIndex: number): string {
    const safeName = name.replace(/\s+/g, '_');
    return `ga_bluesub_${safeName}_${outputIndex}`;
  }

  addSubChannelDependency(_name: string): void {
    if (_name) {
      this._subChannelDependencies.add(_name);
    }
  }

  getAllSourceChannels(): Channel[] {
    const result: Channel[] = [];
    for (const group of this._channelListGroups) {
      result.push(...group);
    }
    result.push(...this._channels);
    return result;
  }

  /**
   * Generate Csound init statements for all mixer channels.
   * Mirrors Java's Mixer.getInitStatements().
   *
   * Output format:
   *   ga_bluemix_0_0 init 0
   *   ga_bluemix_0_1 init 0
   *   ...
   *   ga_bluesub_Reverb_0 init 0
   *   ...
   *   ga_bluesub_Master_0 init 0
   */
  getInitStatements(
    channelIdAssignments: Map<Channel, number>,
    nchnls: number,
    emitMetering = false,
  ): string {
    const lines: string[] = [];

    // Source channels: ga_bluemix_{id}_{ch}
    for (const channel of this.getAllSourceChannels()) {
      const id = channelIdAssignments.get(channel);
      if (id === undefined) continue;
      for (let ch = 0; ch < nchnls; ch++) {
        lines.push(`ga_bluemix_${id}_${ch}\tinit\t0`);
      }
    }

    // Sub channels: ga_bluesub_{name}_{ch}
    for (const subChannel of this._subChannels) {
      const id = channelIdAssignments.get(subChannel);
      if (id === undefined) continue;
      const name = subChannel.getName().replace(/\s+/g, '_');
      for (let ch = 0; ch < nchnls; ch++) {
        lines.push(`ga_bluesub_${name}_${ch}\tinit\t0`);
      }
    }

    // Master channel: ga_bluesub_Master_{ch}
    for (let ch = 0; ch < nchnls; ch++) {
      lines.push(`ga_bluesub_Master_${ch}\tinit\t0`);
    }

    if (emitMetering) {
      for (const channel of this.getAllSourceChannels()) {
        const id = channelIdAssignments.get(channel);
        if (id === undefined) continue;
        for (let ch = 0; ch < nchnls; ch++) {
          lines.push(`chn_k\t"bm_meter_rms_${id}_${ch}", 2`);
          lines.push(`chn_k\t"bm_meter_peak_${id}_${ch}", 2`);
        }
      }

      const subMeterKeys = buildSubChannelMeterKeys(Array.from(this._subChannels));
      for (const subChannel of this._subChannels) {
        const id = channelIdAssignments.get(subChannel);
        if (id === undefined) continue;
        const key =
          subMeterKeys.get(subChannel) ?? `sub_${subChannel.getName().replace(/\s+/g, '_')}`;
        for (let ch = 0; ch < nchnls; ch++) {
          lines.push(`chn_k\t"bm_meter_rms_${key}_${ch}", 2`);
          lines.push(`chn_k\t"bm_meter_peak_${key}_${ch}", 2`);
        }
      }

      for (let ch = 0; ch < nchnls; ch++) {
        lines.push(`chn_k\t"bm_meter_rms_sub_Master_${ch}", 2`);
        lines.push(`chn_k\t"bm_meter_peak_sub_Master_${ch}", 2`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check if the mixer has sub channel dependencies that need rendering.
   */
  hasSubChannelDependencies(): boolean {
    return this._subChannelDependencies.size > 0;
  }

  saveAsXML(): Element {
    const elem = new Element('mixer');
    elem.addElement(writeBoolean('enabled', this._enabled));
    elem.addElement(writeBoolean('enableMeters', this._enableMeters));
    elem.addElement('meterProfile').setText(this._meterProfileKey);

    if (this._channelListGroups.length > 0) {
      const groupsElem = elem.addElement('channelListGroups');
      for (const cl of this._channelListGroups) {
        groupsElem.addElement(cl.saveAsXML());
      }
    }

    const channelsElem = this._channels.saveAsXML();
    channelsElem.setAttribute('list', 'channels');
    elem.addElement(channelsElem);

    const subChannelsElem = this._subChannels.saveAsXML();
    subChannelsElem.setAttribute('list', 'subChannels');
    elem.addElement(subChannelsElem);

    elem.addElement(this._master.saveAsXML());
    elem.addElement(writeDouble('extraRenderTime', this._extraRenderTime));
    return elem;
  }

  static loadFromXML(data: Element): Mixer {
    const mixer = new Mixer();

    const appendChannels = (target: ChannelList, source: ChannelList) => {
      for (const channel of source) {
        target.push(channel);
      }
    };

    const enabledElem = data.getElement('enabled');
    if (enabledElem) {
      mixer._enabled = enabledElem.getTextString() !== 'false';
    }

    const enableMetersElem = data.getElement('enableMeters');
    if (enableMetersElem) {
      mixer._enableMeters = enableMetersElem.getTextString().trim().toLowerCase() === 'true';
    } else {
      mixer._enableMeters = DEFAULT_LEGACY_METER_ENABLED;
    }

    const meterProfileElem = data.getElement('meterProfile');
    if (meterProfileElem) {
      const rawKey = meterProfileElem.getTextString().trim();
      mixer._meterProfileKey = isMeterProfileKey(rawKey)
        ? rawKey
        : DEFAULT_LEGACY_METER_PROFILE_KEY;
    } else {
      mixer._meterProfileKey = DEFAULT_LEGACY_METER_PROFILE_KEY;
    }

    const channelListGroups = data.getElement('channelListGroups');
    if (channelListGroups) {
      const groupedLists = channelListGroups.getElements('channelList');
      while (groupedLists.hasMoreElements()) {
        mixer._channelListGroups.push(ChannelList.loadFromXML(groupedLists.next()));
      }
    }

    const channelLists = data.getElements('channelList');
    while (channelLists.hasMoreElements()) {
      const clNode = channelLists.next();
      const listAttr = clNode.getAttribute('list') ?? '';
      const loaded = ChannelList.loadFromXML(clNode);
      if (listAttr === 'subChannels' || listAttr === 'SubChannels') {
        appendChannels(mixer._subChannels, loaded);
      } else {
        appendChannels(mixer._channels, loaded);
      }
    }

    if (mixer._channels.length === 0) {
      const chNode = data.getElement('channels');
      if (chNode) {
        mixer._channels = ChannelList.loadFromXML(chNode);
      }
    }
    if (mixer._subChannels.length === 0) {
      const subChNode = data.getElement('subChannels');
      if (subChNode) {
        mixer._subChannels = ChannelList.loadFromXML(subChNode);
      }
    }

    mixer._channels.setListNameEditSupported(true);
    mixer._channels.setListName('Orchestra');
    mixer._channels.setListNameEditSupported(false);

    mixer._subChannels.setListNameEditSupported(true);
    mixer._subChannels.setListName('SubChannels');
    mixer._subChannels.setListNameEditSupported(false);

    const channelNodes = data.getElements('channel');
    while (channelNodes.hasMoreElements()) {
      const chNode = channelNodes.next();
      const ch = Channel.loadFromXML(chNode);
      const chName = ch.getName();
      if (chName === Mixer.MASTER_CHANNEL || chName === 'master') {
        mixer._master = ch;
      }
    }

    const extraTime = data.getTextString('extraRenderTime');
    if (extraTime) mixer._extraRenderTime = parseFloat(extraTime);

    return mixer;
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new Mixer();
    copy._enabled = this._enabled;
    copy._enableMeters = this._enableMeters;
    copy._meterProfileKey = this._meterProfileKey;
    copy._channelListGroups = this._channelListGroups.map((cl) => cl.deepCopy(mode) as ChannelList);
    copy._channels = this._channels.deepCopy(mode) as ChannelList;
    copy._subChannels = this._subChannels.deepCopy(mode) as ChannelList;
    copy._master = this._master.deepCopy(mode) as Channel;
    copy._extraRenderTime = this._extraRenderTime;
    copy._subChannelDependencies = new Set(this._subChannelDependencies);
    return copy;
  }
}

export const MAX_SUB_METER_KEY_BYTES = 42;

export function truncateUtf8(str: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  if (bytes.length <= maxBytes) return str;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let decoded = decoder.decode(bytes.subarray(0, maxBytes));
  if (decoded.endsWith('\uFFFD')) {
    decoded = decoded.slice(0, -1);
  }
  return decoded;
}

export function buildSubChannelMeterKeys(subChannels: Channel[]): Map<Channel, string> {
  const map = new Map<Channel, string>();
  const usedKeys = new Set<string>();
  const encoder = new TextEncoder();

  for (const subChannel of subChannels) {
    const rawBase = `sub_${subChannel.getName().replace(/\s+/g, '_')}`;
    let counter = 1;
    let key = '';

    while (true) {
      const suffix = counter > 1 ? `_${counter}` : '';
      const suffixBytes = encoder.encode(suffix).length;
      const allowedBaseBytes = MAX_SUB_METER_KEY_BYTES - suffixBytes;
      const base = truncateUtf8(rawBase, allowedBaseBytes);
      key = `${base}${suffix}`;
      if (!usedKeys.has(key)) {
        break;
      }
      counter += 1;
    }

    usedKeys.add(key);
    map.set(subChannel, key);
  }
  return map;
}
