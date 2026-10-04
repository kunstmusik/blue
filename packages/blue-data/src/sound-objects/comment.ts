/**
 * Comment — a non-generating SoundObject for score annotations.
 * Mirrors the Java Comment class.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import {
  checkShape,
  readText,
  readInt,
  readBoolean,
  readEnum,
  parseXmlBoolean,
} from '../utilities/xml';
import { BASIC_SOUND_OBJECT_CHILDREN } from './sound-object-utilities';
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

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): Comment {
    const ctx = context ?? new XmlLoadContext(data);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      type === null ||
      !['Comment', 'blue.soundObject.Comment'].includes(type)
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported Comment type.',
        recovery: 'Supply a supported concrete SoundObject type.',
      });
    checkShape(data, ['type'], [...BASIC_SOUND_OBJECT_CHILDREN, ...['commentText']], ctx);
    const obj = new Comment();
    const commentTextElement = data.getElement('commentText');
    if (commentTextElement) readText(commentTextElement, ctx);
    initBasicFromXML(obj, data, ctx);

    const text = data.getTextString('commentText');
    if (text !== null) obj._commentText = text;

    return context ? obj : requireXmlValue(ctx.result(obj), sink);
  }

  override deepCopy(): SoundObject {
    return new Comment(this);
  }
}
