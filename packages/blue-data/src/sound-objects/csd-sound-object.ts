/**
 * CSDSoundObject — a SoundObject containing an embedded CSD file.
 * Mirrors the Java CSDSoundObject class.
 *
 * Phase 8: Data preservation (load/save XML). CSD generation extracts
 * orchestra/score sections from the embedded CSD.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText } from '../utilities/xml';
import { BASIC_SOUND_OBJECT_CHILDREN } from './sound-object-utilities';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';

export class CSDSoundObject extends AbstractSoundObject {
  private _csdText = '';

  getCsdText(): string {
    return this._csdText;
  }
  setCsdText(text: string): void {
    this._csdText = text;
  }

  override generateForCSD(
    _context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    // For Phase 8: return empty. Full CSD extraction in Phase 9.
    return new NoteList();
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'CSDSoundObject');
    elem.addElement('csdText').setText(this._csdText);
    return elem;
  }

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): CSDSoundObject {
    const context = providedContext ?? new XmlLoadContext(data);
    if (
      data.getName() !== 'soundObject' ||
      !['CSDSoundObject', 'blue.soundObject.CSDSoundObject'].includes(
        data.getAttribute('type') ?? '',
      )
    )
      throw context.at(data).error({
        code: 'type',
        member: '@type',
        value: data.getAttribute('type') ?? '',
        message: 'Unsupported CSDSoundObject root/type.',
        recovery: 'Supply the declared concrete SoundObject root and type.',
      });
    checkShape(data, ['type'], [...BASIC_SOUND_OBJECT_CHILDREN, ...['csdText']], context);
    const object = new CSDSoundObject();
    initBasicFromXML(object, data, context);
    const csdText = data.getElement('csdText');
    if (csdText) object._csdText = readText(csdText, context);
    return providedContext ? object : requireXmlValue(context.result(object), sink);
  }

  override deepCopy(): SoundObject {
    const copy = new CSDSoundObject();
    copy.copyFrom(this);
    copy._csdText = this._csdText;
    return copy;
  }
}
