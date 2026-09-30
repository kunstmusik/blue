/**
 * AudioFile — a SoundObject that plays an audio file via diskin2.
 * Mirrors the Java AudioFile class.
 *
 * Generates a diskin2-based GenericInstrument added to the arrangement
 * and a single i-statement note with skip time as p4.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { Note } from './note';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { TimeBehavior } from './time-behavior';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { GenericInstrument } from '../instruments/generic-instrument';
import type { ScoreGenerationOptions } from '../score/score-generation-options';

export class AudioFile extends AbstractSoundObject {
  private _soundFileName = '';
  private _csoundPostCode = '\touts\taChannel1, aChannel1';
  private _useCustomWindowSize = false;
  private _windowSize = 8;

  constructor(other?: AudioFile) {
    super();
    this.setName('Audio File');
    this._soundFileName = '';
    this._csoundPostCode = '\touts\taChannel1, aChannel1';
    this._useCustomWindowSize = false;
    this._windowSize = 8;
    this._backgroundColor = 0x404040;
    if (other) {
      this.copyFrom(other);
      this._soundFileName = other._soundFileName;
      this._csoundPostCode = other._csoundPostCode;
      this._useCustomWindowSize = other._useCustomWindowSize;
      this._windowSize = other._windowSize;
    }
  }

  getSoundFileName(): string {
    return this._soundFileName;
  }
  setSoundFileName(name: string): void {
    this._soundFileName = name;
  }

  getCsoundPostCode(): string {
    return this._csoundPostCode;
  }
  setCsoundPostCode(code: string): void {
    this._csoundPostCode = code;
  }

  useCustomWindowSize(): boolean {
    return this._useCustomWindowSize;
  }
  setUseCustomWindowSize(val: boolean): void {
    this._useCustomWindowSize = val;
  }

  getWindowSize(): number {
    return this._windowSize;
  }
  setWindowSize(size: number): void {
    this._windowSize = size;
  }

  override getTimeBehavior(): TimeBehavior {
    return TimeBehavior.NOT_SUPPORTED;
  }

  getRangeOriginBeats(context: TimeContext): number | null | undefined {
    if (this.getNoteProcessorChain().getProcessors().length > 0) return undefined;
    if (!this._soundFileName) return null;
    const duration = this.getSubjectiveDuration().toBeats(context);
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return this.getStartTime().toBeats(context);
  }

  override generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptions,
  ): NoteList {
    if (!this._soundFileName) {
      return new NoteList();
    }

    const instr = this.generateInstrument();
    if (!instr) {
      return new NoteList();
    }

    const instrumentNumber = compileData.addInstrument(instr);
    if (options?.trackId) {
      compileData.addInstrSourceId(instr, options.trackId);
    }

    return this.generateNotes(
      context,
      instrumentNumber,
      startTime,
      endTime,
      options?.beatOrigin ?? 0,
      options?.normalizationOrigin,
    );
  }

  generateInstrument(): GenericInstrument | null {
    const instrText = this.generateInstrumentText();
    if (!instrText) {
      return null;
    }
    const temp = new GenericInstrument();
    temp.setName(this.getName());
    temp.setText(instrText);
    return temp;
  }

  private generateInstrumentText(): string {
    const channelVars = this.getChannelVariables();
    const sfName = this._soundFileName.replace(/\\/g, '/').replace(/"/g, '\\"');
    return `${channelVars}\tdiskin2\t"${sfName}", 1, p4\n${this._csoundPostCode}\n`;
  }

  private getChannelVariables(): string {
    const matches = [...this._csoundPostCode.matchAll(/aChannel(\d+)/g)];
    const indices = matches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n) && n > 0);
    const maxChan = indices.length > 0 ? Math.max(1, ...indices) : 1;
    return Array.from({ length: maxChan }, (_, i) => `aChannel${i + 1}`).join(', ');
  }

  private generateNotes(
    context: TimeContext,
    instrumentNumber: number,
    renderStart: number,
    renderEnd: number,
    beatOrigin: number,
    normalizationOrigin?: ScoreGenerationOptions['normalizationOrigin'],
  ): NoteList {
    const notes = new NoteList();
    const subjectiveDuration = this._subjectiveDuration.toBeats(context);
    let newDur = subjectiveDuration;

    if (renderEnd > 0 && renderEnd < subjectiveDuration) {
      newDur = renderEnd;
    }
    newDur -= renderStart;

    if (!Number.isFinite(newDur) || newDur <= 0) {
      return notes;
    }

    const objectStart = this._startTime.toBeats(context);
    const absoluteObjectStart = beatOrigin + objectStart;
    const fileOffsetSeconds =
      context.beatsToSeconds(absoluteObjectStart + renderStart) -
      context.beatsToSeconds(absoluteObjectStart);

    const note = new Note();
    note.setPField(String(instrumentNumber), 1);
    note.setStartTime(objectStart + renderStart);
    note.setSubjectiveDuration(newDur);
    note.setPField(String(fileOffsetSeconds), 4);
    if (normalizationOrigin) {
      note.setFileSeekProvenance({
        pField: 4,
        absoluteObjectStartBeat: absoluteObjectStart,
        originalDurationBeats: subjectiveDuration,
        generatedOffsetSeconds: fileOffsetSeconds,
        normalizationOrigin,
      });
    }
    notes.add(note);

    return notes;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.AudioFile');
    elem.addElement('soundFileName').setText(this._soundFileName);
    elem.addElement('csoundPostCode').setText(this._csoundPostCode);
    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): AudioFile {
    const obj = new AudioFile();
    initBasicFromXML(obj, data);

    const sf = data.getTextString('soundFileName');
    if (sf !== null) obj._soundFileName = sf;

    const post = data.getTextString('csoundPostCode');
    if (post !== null) obj._csoundPostCode = post;

    return obj;
  }

  override deepCopy(): SoundObject {
    return new AudioFile(this);
  }
}
