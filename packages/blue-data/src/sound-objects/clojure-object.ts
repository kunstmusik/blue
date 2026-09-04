import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import {
  getJavaRuntimeClient,
  type JavaRuntimeClientContract,
  type JavaRuntimeError,
} from '../java-runtime';
import {
  applyNoteProcessorChainAsync,
  applyTimeBehavior,
  getNotes,
  setScoreStart,
} from '../utilities/score';

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

export class ClojureObject extends AbstractSoundObject {
  private _clojureCode = '';
  private _onLoadProcessable = false;

  constructor() {
    super();
    this.setName('(clojure-object)');
    this._clojureCode =
      ';use symbol blueDuration for duration from blue\n' + '(def score "i1 0 2 3 4 5")';
    this._backgroundColor = 0x404040;
  }

  getClojureCode(): string {
    return this._clojureCode;
  }

  setClojureCode(code: string): void {
    this._clojureCode = code;
  }

  isOnLoadProcessable(): boolean {
    return this._onLoadProcessable;
  }

  setOnLoadProcessable(value: boolean): void {
    this._onLoadProcessable = value;
  }

  processOnLoad(_context: TimeContext): void {
    if (!this._onLoadProcessable) {
      return;
    }

    console.warn('ClojureObject.processOnLoad skipped: requires Java runtime');
  }

  async processOnLoadAsync(
    _context: TimeContext,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    if (!this._onLoadProcessable) {
      return;
    }

    if (!runtimeClient) {
      throw new Error('ClojureObject.processOnLoad requires a Java runtime session');
    }

    const response = await runtimeClient.evaluateClojure({
      code: this._clojureCode,
    });

    if (!response.ok) {
      throw new Error(
        formatRuntimeError('Failed to evaluate Clojure on-load code', response.error),
      );
    }
  }

  override generateForCSD(
    _context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    console.warn('ClojureObject.generateForCSD skipped: requires Java runtime');
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
      throw new Error('ClojureObject.generateForCSD requires a Java runtime session');
    }

    const response = await runtimeClient.evaluateClojureScoreObject({
      code: this._clojureCode,
      blueDuration: this.getSubjectiveDuration().toBeats(context),
    });

    if (!response.ok) {
      throw new Error(
        formatRuntimeError('Failed to evaluate Clojure score object', response.error),
      );
    }

    const noteList = getNotes(response.result?.scoreText ?? '');
    const processed = await applyNoteProcessorChainAsync(
      noteList,
      this.getNoteProcessorChain(),
      compileData,
    );
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(processed, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(processed, startTime);

    return processed;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.clojure.soundObject.ClojureObject');
    elem.addElement('clojureCode').setText(this._clojureCode);
    elem.setAttribute('onLoadProcessable', this._onLoadProcessable.toString());
    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): ClojureObject {
    const obj = new ClojureObject();
    initBasicFromXML(obj, data);

    const code = data.getTextString('clojureCode');
    if (code !== null) {
      obj.setClojureCode(code);
    }

    const onLoadProcessable = data.getAttribute('onLoadProcessable');
    if (onLoadProcessable) {
      obj.setOnLoadProcessable(onLoadProcessable.toLowerCase() === 'true');
    }

    return obj;
  }

  override deepCopy(): SoundObject {
    const copy = new ClojureObject();
    copy.copyFrom(this);
    copy._clojureCode = this._clojureCode;
    copy._onLoadProcessable = this._onLoadProcessable;
    return copy;
  }
}
