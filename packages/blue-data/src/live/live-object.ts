import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { BlueDataObject } from '../blue-data-object';
import {
  checkRoot,
  checkShape,
  readInt,
  writeInt,
  readBoolean,
  writeBoolean,
} from '../utilities/xml';
import { loadSoundObjectFromXML } from '../sound-objects/sound-object-registry';
import '../sound-objects/register-sound-object-types';
import type { SoundObject } from '../sound-objects/sound-object';
import type { CopyMode } from '../deep-copyable';

function generateUniqueId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 2147483647)}`;
}

export class LiveObject implements BlueDataObject {
  private _uniqueId: string;
  private _keyTrigger = -1;
  private _midiTrigger = -1;
  private _enabled = false;
  private _soundObject: SoundObject | null = null;

  /** Creates an unassigned Live cell with a persistent ID. */
  constructor() {
    this._uniqueId = generateUniqueId();
  }

  /** Returns the persistent identifier. */
  getUniqueId(): string {
    return this._uniqueId;
  }

  /** Sets the persistent identifier. */
  setUniqueId(id: string): void {
    this._uniqueId = id;
  }

  /** Returns the key trigger stored on the Blue Live cell. */
  getKeyTrigger(): number {
    return this._keyTrigger;
  }

  /** Sets the key trigger stored on the Blue Live cell. */
  setKeyTrigger(v: number): void {
    this._keyTrigger = v;
  }

  /** Returns the MIDI trigger stored on the Blue Live cell. */
  getMidiTrigger(): number {
    return this._midiTrigger;
  }

  /** Sets the MIDI trigger stored on the Blue Live cell. */
  setMidiTrigger(v: number): void {
    this._midiTrigger = v;
  }

  /** Reports whether the Blue Live cell is enabled. */
  isEnabled(): boolean {
    return this._enabled;
  }

  /** Sets the enabled stored on the Blue Live cell. */
  setEnabled(v: boolean): void {
    this._enabled = v;
  }

  /** Returns the sound object stored on the Blue Live cell. */
  getSoundObject(): SoundObject | null {
    return this._soundObject;
  }

  /** Sets the sound object stored on the Blue Live cell. */
  setSoundObject(sObj: SoundObject | null): void {
    this._soundObject = sObj;
  }

  /** Returns the human-readable display label. */
  getDisplayName(): string {
    return this._soundObject?.getName() ?? '';
  }

  /** Reports the type of sound object currently assigned to this cell. */
  getSoundObjectType(): string {
    if (!this._soundObject) return '';
    return (
      ((this._soundObject as unknown as Record<string, unknown>).constructor?.name as string) ?? ''
    );
  }

  /** Returns the has sound object. */
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

  /** Reconstructs the Blue Live cell from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    context = new XmlLoadContext(data),
  ): LiveObject {
    checkRoot(data, 'liveObject', context);
    checkShape(
      data,
      ['uniqueId'],
      ['keyTrigger', 'midiTrigger', 'enabled', 'soundObject'],
      context,
    );
    const obj = new LiveObject();
    const uniqueId = data.getAttribute('uniqueId');
    if (uniqueId !== null && uniqueId.trim() === '')
      throw context.at(data).error({
        code: 'value',
        member: '@uniqueId',
        value: uniqueId,
        message: 'Live object ID must be nonempty.',
        recovery: 'Supply a nonempty ID or omit a historical ID.',
      });
    if (uniqueId) {
      obj._uniqueId = uniqueId;
    }
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const name = node.getName();
      switch (name) {
        case 'keyTrigger':
          obj._keyTrigger = readInt(node, context, -1, 2147483647);
          break;
        case 'midiTrigger':
          obj._midiTrigger = readInt(node, context, -1, 127);
          break;
        case 'enabled':
          obj._enabled = readBoolean(node, context);
          break;
        case 'soundObject': {
          obj._soundObject = loadSoundObjectFromXML(node, objRefMap, context);
          break;
        }
      }
    }
    return obj;
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const copy = new LiveObject();
    copy._uniqueId = this._uniqueId;
    copy._keyTrigger = this._keyTrigger;
    copy._midiTrigger = this._midiTrigger;
    copy._enabled = this._enabled;
    if (this._soundObject) {
      copy._soundObject = this._soundObject.deepCopy(mode);
    }
    return copy;
  }
}
