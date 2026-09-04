import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { BlueDataObject } from '../blue-data-object';
import { readInt, writeInt, readBoolean, writeBoolean } from '../utilities/xml';
import { loadSoundObjectFromXML } from '../sound-objects/sound-object-registry';
import '../sound-objects/register-sound-object-types';
import type { SoundObject } from '../sound-objects/sound-object';

function generateUniqueId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 2147483647)}`;
}

export class LiveObject implements BlueDataObject {
  private _uniqueId: string;
  private _keyTrigger = -1;
  private _midiTrigger = -1;
  private _enabled = false;
  private _soundObject: SoundObject | null = null;

  constructor() {
    this._uniqueId = generateUniqueId();
  }

  getUniqueId(): string {
    return this._uniqueId;
  }

  setUniqueId(id: string): void {
    this._uniqueId = id;
  }

  getKeyTrigger(): number {
    return this._keyTrigger;
  }

  setKeyTrigger(v: number): void {
    this._keyTrigger = v;
  }

  getMidiTrigger(): number {
    return this._midiTrigger;
  }

  setMidiTrigger(v: number): void {
    this._midiTrigger = v;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  setEnabled(v: boolean): void {
    this._enabled = v;
  }

  getSoundObject(): SoundObject | null {
    return this._soundObject;
  }

  setSoundObject(sObj: SoundObject | null): void {
    this._soundObject = sObj;
  }

  getDisplayName(): string {
    return this._soundObject?.getName() ?? '';
  }

  getSoundObjectType(): string {
    if (!this._soundObject) return '';
    return (
      ((this._soundObject as unknown as Record<string, unknown>).constructor?.name as string) ?? ''
    );
  }

  get hasSoundObject(): boolean {
    return this._soundObject !== null;
  }

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element('liveObject');
    elem.setAttribute('uniqueId', this._uniqueId);
    elem.addElement(writeInt('keyTrigger', this._keyTrigger));
    elem.addElement(writeInt('midiTrigger', this._midiTrigger));
    elem.addElement(writeBoolean('enabled', this._enabled));
    if (this._soundObject) {
      elem.addElement(this._soundObject.saveAsXML(objRefMap));
    }
    return elem;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): LiveObject {
    const obj = new LiveObject();
    const uniqueId = data.getAttribute('uniqueId');
    if (uniqueId) {
      obj._uniqueId = uniqueId;
    }
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const name = node.getName();
      switch (name) {
        case 'keyTrigger':
          obj._keyTrigger = readInt(node);
          break;
        case 'midiTrigger':
          obj._midiTrigger = readInt(node);
          break;
        case 'enabled':
          obj._enabled = readBoolean(node);
          break;
        case 'soundObject': {
          const sObj = loadSoundObjectFromXML(node, objRefMap);
          if (sObj) obj._soundObject = sObj;
          break;
        }
      }
    }
    return obj;
  }

  deepCopy(): BlueDataObject {
    const copy = new LiveObject();
    copy._uniqueId = this._uniqueId;
    copy._keyTrigger = this._keyTrigger;
    copy._midiTrigger = this._midiTrigger;
    copy._enabled = this._enabled;
    if (this._soundObject) {
      copy._soundObject = this._soundObject.deepCopy() as SoundObject;
    }
    return copy;
  }
}
