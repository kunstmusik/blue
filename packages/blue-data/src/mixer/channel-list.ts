/**
 * ChannelList — ordered list of mixer channels.
 * Mirrors the Java ChannelList class.
 */
import { Channel } from './channel';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';

import { BlueDataObject } from '../blue-data-object';
import type { CopyMode } from '../deep-copyable';

export class ChannelList extends Array<Channel> implements BlueDataObject {
  private _association: string | null = null;
  private _listName = '';
  private _listNameEditSupported = true;

  /** Returns the persistent association with a project source. */
  getAssociation(): string | null {
    return this._association;
  }

  /** Sets the persistent association with a project source. */
  setAssociation(association: string | null): void {
    this._association = association;
  }

  /** Returns the list name stored on the channel list. */
  getListName(): string {
    return this._listName;
  }

  /** Sets the list name stored on the channel list. */
  setListName(listName: string): void {
    if (!this._listNameEditSupported) {
      throw new Error(
        'Error: Attempted to edit Channel List name for group that does not support it.',
      );
    }
    this._listName = listName;
  }

  /** Reports whether the host should let users rename the list. */
  isListNameEditSupported(): boolean {
    return this._listNameEditSupported;
  }

  /** Sets the list name edit supported stored on the channel list. */
  setListNameEditSupported(listNameEditSupported: boolean): void {
    this._listNameEditSupported = listNameEditSupported;
  }

  saveAsXML(): Element {
    const elem = new Element('channelList');
    if (this._association !== null) {
      elem.setAttribute('association', this._association);
    }
    elem.setAttribute('listName', this._listName);
    for (const channel of this) {
      elem.addElement(channel.saveAsXML().setName('channel'));
    }
    return elem;
  }

  /** Reconstructs the channel list from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): ChannelList {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, ['channelList', 'channels', 'subChannels'], ctx);
    checkShape(data, ['association', 'listName', 'list'], ['channel'], ctx, ['channel']);
    const role = data.getAttribute('list');
    if (role !== null && !['channels', 'subChannels', 'SubChannels'].includes(role))
      throw ctx.error({
        code: 'value',
        member: '@list',
        value: role,
        message: 'Unsupported channel list role.',
        recovery: 'Choose channels or subChannels.',
      });
    const list = new ChannelList();

    const association = data.getAttribute('association');
    if (association !== null && association !== 'null') {
      list.setAssociation(association);
    }

    const listName = data.getAttribute('listName');
    if (listName !== null && listName !== 'null') {
      list.setListName(listName);
    }

    const channels = data.getElements('channel');
    while (channels.hasMoreElements()) {
      list.push(Channel.loadFromXML(channels.next(), ctx));
    }
    return context ? list : requireXmlValue(ctx.result(list), sink);
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new ChannelList();
    copy._association = this._association;
    copy._listName = this._listName;
    copy._listNameEditSupported = this._listNameEditSupported;
    for (const ch of this) {
      copy.push(ch.deepCopy(mode) as Channel);
    }
    return copy;
  }
}
