/**
 * PythonObject — a SoundObject that generates notes via Jython/Python code.
 * Mirrors the Java PythonObject class.
 *
 * Phase 8: Data preservation only (load/save XML).
 * CSD generation is skipped in browser; Java subprocess in Node.js.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { getJavaRuntimeClient, type JavaRuntimeClientContract, type JavaRuntimeError } from '../java-runtime';
import { applyNoteProcessorChainAsync, applyTimeBehavior, getNotes, setScoreStart } from '../utilities/score';

function formatRuntimeError(message: string, error?: JavaRuntimeError): string {
  const baseMessage = error?.message?.trim().length ? error.message : message;
  if (error?.line == null) {
    return baseMessage;
  }

  if (error.column == null) {
    return `${baseMessage} (line ${error.line})`;
  }

  return `${baseMessage} (line ${error.line}, column ${error.column})`;
}

export class PythonObject extends AbstractSoundObject {
  private _pythonCode = '';
  private _onLoadProcessable = false;

  constructor() {
    super();
    this.setName('PythonObject');
    this._pythonCode = 'score = "i1 0 2 3 4 5"';
    this._backgroundColor = 0x404040;
  }

  getPythonCode(): string { return this._pythonCode; }
  setPythonCode(code: string): void { this._pythonCode = code; }

  isOnLoadProcessable(): boolean { return this._onLoadProcessable; }
  setOnLoadProcessable(val: boolean): void { this._onLoadProcessable = val; }

  processOnLoad(_context: TimeContext): void {
    if (!this._onLoadProcessable) return;
    console.warn('PythonObject.processOnLoad skipped: requires Java runtime');
  }

  async processOnLoadAsync(
    context: TimeContext,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    if (!this._onLoadProcessable) {
      return;
    }

    if (!runtimeClient) {
      throw new Error('PythonObject.processOnLoad requires a Java runtime session');
    }

    const response = await runtimeClient.evaluateJythonScoreObject({
      code: this._pythonCode,
      blueDuration: this.getSubjectiveDuration().toBeats(context),
    });

    if (!response.ok) {
      throw new Error(formatRuntimeError('Failed to evaluate Python on-load code', response.error));
    }
  }

  override generateForCSD(
    _context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    console.warn('PythonObject.generateForCSD skipped: requires Java runtime');
    return new NoteList();
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    const runtimeClient = getJavaRuntimeClient(compileData);
    if (!runtimeClient) {
      throw new Error('PythonObject.generateForCSD requires a Java runtime session');
    }

    const response = await runtimeClient.evaluateJythonScoreObject({
      code: this._pythonCode,
      blueDuration: this.getSubjectiveDuration().toBeats(context),
    });

    if (!response.ok) {
      throw new Error(formatRuntimeError('Failed to evaluate Python score object', response.error));
    }

    const noteList = getNotes(response.result?.scoreText ?? '');
    const processed = await applyNoteProcessorChainAsync(noteList, this.getNoteProcessorChain(), compileData);
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(
      processed,
      this.getTimeBehavior(),
      duration,
      repeatPointBeats,
    );
    setScoreStart(processed, startTime);

    return processed;
  }

  // ─── XML ───

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.PythonObject');
    elem.addElement('pythonCode').setText(this._pythonCode);
    elem.setAttribute('onLoadProcessable', this._onLoadProcessable.toString());
    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): PythonObject {
    const obj = new PythonObject();
    initBasicFromXML(obj, data);

    const code = data.getTextString('pythonCode');
    if (code !== null) obj.setPythonCode(code);

    const olp = data.getAttribute('onLoadProcessable');
    if (olp) obj.setOnLoadProcessable(olp.toLowerCase() === 'true');

    return obj;
  }

  override deepCopy(): SoundObject {
    const copy = new PythonObject();
    copy.copyFrom(this);
    copy._pythonCode = this._pythonCode;
    copy._onLoadProcessable = this._onLoadProcessable;
    return copy;
  }
}
