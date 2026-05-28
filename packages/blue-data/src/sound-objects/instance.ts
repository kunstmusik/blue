/**
 * Instance — references a SoundObject from the SoundObjectLibrary.
 * Mirrors the Java Instance class.
 *
 * Delegates note generation to the referenced SoundObject, then applies
 * its own note processor chain and time behavior.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { setScoreStart } from '../utilities/score';

export class Instance extends AbstractSoundObject {
  private _soundObject: SoundObject | null = null;
  private _libraryId = '';

  constructor(other?: Instance) {
    super();
    this.setName('Instance: ');
    if (other) {
      this.copyFrom(other);
      this._libraryId = other._libraryId;
      // Note: _soundObject reference is shared (same as Java copy constructor)
      this._soundObject = other._soundObject;
    }
  }

  getSoundObject(): SoundObject | null { return this._soundObject; }
  setSoundObject(sObj: SoundObject): void {
    this._soundObject = sObj;
    this.setName(sObj.getName());
    this.setBackgroundColor(sObj.getBackgroundColor());
  }

  getLibraryId(): string { return this._libraryId; }
  setLibraryId(id: string): void { this._libraryId = id; }


  override generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList {
    if (!this._soundObject) {
      return new NoteList();
    }

    const nl = this._soundObject.generateForCSD(context, compileData, startTime, endTime);

    // Apply note processor chain
    const npc = this.getNoteProcessorChain();
    npc.apply(nl);

    // Apply time behavior
    const duration = this._subjectiveDuration.toBeats(context);
    const rpBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;
    // Note: full time behavior application needs ScoreUtilities — simplified for Phase 11
    setScoreStart(nl, this._startTime.toBeats(context));

    return nl;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): Promise<NoteList> {
    if (!this._soundObject) {
      return new NoteList();
    }

    const nl = this._soundObject.generateForCSDAsync
      ? await this._soundObject.generateForCSDAsync(context, compileData, startTime, endTime)
      : this._soundObject.generateForCSD(context, compileData, startTime, endTime);

    const npc = this.getNoteProcessorChain();
    npc.apply(nl);
    setScoreStart(nl, this._startTime.toBeats(context));

    return nl;
  }

  override saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.Instance');

    const refElem = elem.addElement('soundObjectReference');
    if (this._soundObject && objRefMap) {
      refElem.setAttribute('soundObjectLibraryID', objRefMap.getId(this._soundObject));
    } else {
      refElem.setAttribute('soundObjectLibraryID', this._libraryId || 'null');
    }

    return elem;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): Instance {
    const obj = new Instance();
    initBasicFromXML(obj, data);

    const refNode = data.getElement('soundObjectReference');
    if (refNode) {
      const id = refNode.getAttribute('soundObjectLibraryID') ?? 'null';
      if (id === 'null' || !id) {
        // Unresolved reference — store as library id for later resolution
        obj._libraryId = '';
      } else if (objRefMap && objRefMap.has(id)) {
        obj._soundObject = objRefMap.get(id) as SoundObject;
        obj._libraryId = id;
      } else {
        obj._libraryId = id;
        // Will be resolved in second pass by caller
      }
    }

    return obj;
  }

  override deepCopy(): SoundObject {
    const copy = new Instance(this);
    return copy;
  }
}
