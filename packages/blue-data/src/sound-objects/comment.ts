/**
 * Comment — a non-generating SoundObject for score annotations.
 * Mirrors the Java Comment class.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { TimeBehavior } from './time-behavior';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';

export class Comment extends AbstractSoundObject {
  private _commentText = '';

  constructor(other?: Comment) {
    super();
    this.setName('Comment');
    this._backgroundColor = 0x404040;
    if (other) {
      this.copyFrom(other);
      this._commentText = other._commentText;
    }
  }

  getText(): string {
    return this._commentText;
  }
  setText(text: string): void {
    this._commentText = text;
  }

  override getTimeBehavior(): TimeBehavior {
    return TimeBehavior.NOT_SUPPORTED;
  }

  override generateForCSD(
    _context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    return new NoteList();
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.Comment');
    elem.addElement('commentText').setText(this._commentText);
    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): Comment {
    const obj = new Comment();
    initBasicFromXML(obj, data);

    const text = data.getTextString('commentText');
    if (text !== null) obj._commentText = text;

    return obj;
  }

  override deepCopy(): SoundObject {
    return new Comment(this);
  }
}
