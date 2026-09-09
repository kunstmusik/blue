/**
 * ChannelList — ordered list of mixer channels.
 * Mirrors the Java ChannelList class.
 */
import { Channel } from './channel';
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import type { CopyMode } from '../deep-copyable';

export class ChannelList extends Array<Channel> implements BlueDataObject {
  private _association: string | null = null;
  private _listName = '';
  private _listNameEditSupported = true;

  getAssociation(): string | null {
    return this._association;
  }

  setAssociation(association: string | null): void {
    this._association = association;
  }

  getListName(): string {
    return this._listName;
  }

  setListName(listName: string): void {
    if (!this._listNameEditSupported) {
      throw new Error(
        'Error: Attempted to edit Channel List name for group that does not support it.',
      );
    }
    this._listName = listName;
  }

  isListNameEditSupported(): boolean {
    return this._listNameEditSupported;
  }

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

  static loadFromXML(data: Element): ChannelList {
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
      list.push(Channel.loadFromXML(channels.next()));
    }
    return list;
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
