/**
 * Mixer — the complete mixer with channels, subchannels, effects, and routing.
 * Mirrors the Java Mixer class.
 */
import { Channel } from './channel';
import { ChannelList } from './channel-list';
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import { writeBoolean, writeDouble } from '../utilities/xml';

export class Mixer implements BlueDataObject {
  static readonly MASTER_CHANNEL = 'Master';

  private _enabled = true;
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
  getInitStatements(channelIdAssignments: Map<Channel, number>, nchnls: number): string {
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

  deepCopy(): BlueDataObject {
    const copy = new Mixer();
    copy._enabled = this._enabled;
    copy._channelListGroups = this._channelListGroups.map((cl) => cl.deepCopy() as ChannelList);
    copy._channels = this._channels.deepCopy() as ChannelList;
    copy._subChannels = this._subChannels.deepCopy() as ChannelList;
    copy._master = this._master.deepCopy() as Channel;
    copy._extraRenderTime = this._extraRenderTime;
    copy._subChannelDependencies = new Set(this._subChannelDependencies);
    return copy;
  }
}
