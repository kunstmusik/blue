/**
 * Mixer — the complete mixer with channels, subchannels, effects, and routing.
 * Mirrors the Java Mixer class.
 */
import { Channel } from './channel';
import { ChannelList } from './channel-list';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  readText,
  readBoolean,
  readDouble,
  readEnum,
  parseXmlBoolean,
  parseXmlNumber,
} from '../utilities/xml';

import { BlueDataObject } from '../blue-data-object';
import type { CopyMode } from '../deep-copyable';
import { writeBoolean, writeDouble } from '../utilities/xml';
import {
  DEFAULT_PAN_LAW_DB,
  DEFAULT_PAN_OFF_CENTER_BOOST,
  isValidPanLawDb,
  type PanLawDb,
} from './channel-pan';

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
  private _panningEnabled = true;
  private _panLawDb: PanLawDb = DEFAULT_PAN_LAW_DB;
  private _panOffCenterBoost = DEFAULT_PAN_OFF_CENTER_BOOST;
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

  isPanningEnabled(): boolean {
    return this._panningEnabled;
  }
  setPanningEnabled(enabled: boolean): void {
    if (typeof enabled === 'boolean') this._panningEnabled = enabled;
  }

  getPanLawDb(): PanLawDb {
    return this._panLawDb;
  }
  setPanLawDb(lawDb: PanLawDb): void {
    if (isValidPanLawDb(lawDb)) this._panLawDb = lawDb;
  }

  isPanOffCenterBoost(): boolean {
    return this._panOffCenterBoost;
  }
  setPanOffCenterBoost(boost: boolean): void {
    if (typeof boost === 'boolean') this._panOffCenterBoost = boost;
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
    elem.setAttribute('panningEnabled', this._panningEnabled ? 'true' : 'false');
    elem.setAttribute('panLawDb', String(this._panLawDb));
    elem.setAttribute('panOffCenterBoost', this._panOffCenterBoost ? 'true' : 'false');
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

  static loadFromXML(data: Element, context?: XmlLoadContext, sink?: XmlDiagnosticSink): Mixer {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, 'mixer', ctx);
    checkShape(
      data,
      ['panningEnabled', 'panLawDb', 'panOffCenterBoost'],
      [
        'enabled',
        'enableMeters',
        'meterProfile',
        'channelListGroups',
        'channelList',
        'channels',
        'subChannels',
        'channel',
        'extraRenderTime',
      ],
      ctx,
      ['channelList'],
    );
    const mixer = new Mixer();
    mixer._panningEnabled = false;
    mixer._enableMeters = DEFAULT_LEGACY_METER_ENABLED;
    mixer._meterProfileKey = DEFAULT_LEGACY_METER_PROFILE_KEY;
    const panning = data.getAttribute('panningEnabled');
    if (panning !== null) mixer._panningEnabled = parseXmlBoolean(panning, ctx, '@panningEnabled');
    const boost = data.getAttribute('panOffCenterBoost');
    if (boost !== null)
      mixer._panOffCenterBoost = parseXmlBoolean(boost, ctx, '@panOffCenterBoost');
    const law = data.getAttribute('panLawDb');
    if (law !== null) {
      const value = parseXmlNumber(law, ctx, '@panLawDb');
      if (!isValidPanLawDb(value))
        throw ctx.error({
          code: 'value',
          member: '@panLawDb',
          value: law,
          message: 'Unsupported pan law.',
          recovery: 'Choose 0, -3, -4.5, or -6.',
        });
      mixer._panLawDb = value;
    }
    const enabled = data.getElement('enabled');
    if (enabled) mixer._enabled = readBoolean(enabled, ctx);
    const meters = data.getElement('enableMeters');
    if (meters) mixer._enableMeters = readBoolean(meters, ctx);
    const profile = data.getElement('meterProfile');
    if (profile) mixer._meterProfileKey = readEnum(profile, METER_PROFILE_KEYS, ctx);
    const groups = data.getElement('channelListGroups');
    if (groups) {
      checkShape(groups, [], ['channelList'], ctx, ['channelList']);
      for (const group of groups.getElements('channelList')) {
        if (group.getAttribute('list') !== null)
          throw ctx.at(group).error({
            code: 'member',
            member: '@list',
            message: 'Group channel lists do not have a mixer role.',
            recovery: 'Remove the contextual role attribute.',
          });
        mixer._channelListGroups.push(ChannelList.loadFromXML(group, ctx));
      }
    }
    const roles = new Set<string>();
    for (const child of data.getElements()) {
      const name = child.getName();
      if (!['channelList', 'channels', 'subChannels'].includes(name)) continue;
      const role = name === 'channelList' ? child.getAttribute('list') : name;
      if (role === null || !['channels', 'subChannels', 'SubChannels'].includes(role))
        throw ctx.at(child).error({
          code: 'value',
          member: '@list',
          value: role ?? '',
          message: 'Missing or unsupported mixer channel list role.',
          recovery: 'Choose channels or subChannels.',
        });
      const normalized = role === 'SubChannels' ? 'subChannels' : role;
      if (roles.has(normalized))
        throw ctx.at(child).error({
          code: 'conflict',
          value: role,
          message: 'Competing mixer list representations.',
          recovery: 'Keep one representation of each mixer list.',
        });
      roles.add(normalized);
      const list = ChannelList.loadFromXML(child, ctx);
      if (normalized === 'channels') mixer._channels = list;
      else mixer._subChannels = list;
    }
    mixer._channels.setListNameEditSupported(true);
    mixer._channels.setListName('Orchestra');
    mixer._channels.setListNameEditSupported(false);
    mixer._subChannels.setListNameEditSupported(true);
    mixer._subChannels.setListName('SubChannels');
    mixer._subChannels.setListNameEditSupported(false);
    const master = data.getElement('channel');
    if (master) {
      const channel = Channel.loadFromXML(master, ctx);
      if (channel.getName() !== Mixer.MASTER_CHANNEL)
        throw ctx.at(master).error({
          code: 'value',
          member: 'name',
          value: channel.getName(),
          message: 'The direct mixer channel must be Master.',
          recovery: 'Place ordinary channels in their channel list.',
        });
      mixer._master = channel;
    }
    const extra = data.getElement('extraRenderTime');
    if (extra) mixer._extraRenderTime = readDouble(extra, ctx);
    const targets = new Set([
      Mixer.MASTER_CHANNEL,
      ...mixer._subChannels.map((channel) => channel.getName()),
    ]);
    const channelElements = data.getElements('channel').toArray();
    for (const list of data.getElements()) {
      if (['channelList', 'channels', 'subChannels'].includes(list.getName()))
        channelElements.push(...list.getElements('channel').toArray());
      if (list.getName() === 'channelListGroups') {
        for (const group of list.getElements('channelList'))
          channelElements.push(...group.getElements('channel').toArray());
      }
    }
    for (const channel of channelElements) {
      const sends = channel.getElements('send').toArray();
      for (const chain of channel.getElements('effectsChain'))
        sends.push(...chain.getElements('send').toArray());
      for (const send of sends) {
        const target = send.getElement('sendChannel');
        const name = target ? readText(target, ctx) : Mixer.MASTER_CHANNEL;
        if (!targets.has(name === 'master' ? Mixer.MASTER_CHANNEL : name))
          throw ctx.at(target ?? send).error({
            code: 'reference',
            member: 'sendChannel',
            value: name,
            message: 'Mixer send target does not resolve to Master or a subchannel.',
            recovery: 'Create the target subchannel or select a supported target.',
          });
      }
    }
    return context ? mixer : requireXmlValue(ctx.result(mixer), sink);
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new Mixer();
    copy._enabled = this._enabled;
    copy._enableMeters = this._enableMeters;
    copy._meterProfileKey = this._meterProfileKey;
    copy._panningEnabled = this._panningEnabled;
    copy._panLawDb = this._panLawDb;
    copy._panOffCenterBoost = this._panOffCenterBoost;
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
