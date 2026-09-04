/**
 * FrozenSoundObject — a sound object that has been "frozen" into an audio file.
 * Mirrors the Java FrozenSoundObject class.
 *
 * Plays a generated audio artifact via a diskin2 instrument while retaining the
 * original nested SoundObject for unfreeze. Persists the nested source in Java
 * Blue-compatible XML so freeze/unfreeze survives save/reopen.
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
import { loadSoundObjectFromXML } from './sound-object-registry';
import type { ScoreGenerationOptions } from '../score/score-generation-options';

const FSO_INSTR_NAME = 'Frozen SoundObject Player Instrument';
const FSO_COMPILE_VAR = 'frozenSoundObject.hasBeenCompiled';

export class FrozenSoundObject extends AbstractSoundObject {
  private _frozenSoundObject: SoundObject | null = null;
  private _frozenWaveFileName = '';
  private _numChannels = 0;

  constructor(other?: FrozenSoundObject) {
    super();
    if (other) {
      this.copyFrom(other);
      this._frozenWaveFileName = other._frozenWaveFileName;
      this._numChannels = other._numChannels;
      this._frozenSoundObject = other._frozenSoundObject?.deepCopy() ?? null;
    }
  }

  getFrozenSoundObject(): SoundObject | null {
    return this._frozenSoundObject;
  }
  setFrozenSoundObject(sObj: SoundObject | null): void {
    this._frozenSoundObject = sObj;
  }

  getFrozenWaveFileName(): string {
    return this._frozenWaveFileName;
  }
  setFrozenWaveFileName(name: string): void {
    this._frozenWaveFileName = name;
  }

  getNumChannels(): number {
    return this._numChannels;
  }
  setNumChannels(n: number): void {
    this._numChannels = n;
  }

  override getTimeBehavior(): TimeBehavior {
    return TimeBehavior.NOT_SUPPORTED;
  }

  // ─── CSD Generation ───

  /**
   * Build the diskin2 instrument text for the stored channel count.
   * Returns null when numChannels is invalid (matching Java's error contract).
   */
  private generateInstrumentText(): string | null {
    if (this._numChannels <= 0) {
      return null;
    }

    const channelVars: string[] = [];
    for (let i = 1; i <= this._numChannels; i++) {
      channelVars.push(`aChannel${i}`);
    }
    const channelVariables = channelVars.join(', ');

    const opcode = this._numChannels === 1 ? 'out' : 'outc';
    return `${channelVariables}\tdiskin2\tp4, 1, p5\n\t${opcode}\t${channelVariables}\n`;
  }

  override generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptions,
  ): NoteList {
    if (!this._frozenWaveFileName) {
      return new NoteList();
    }

    const instrumentNumber = this.generateInstruments(compileData, options?.trackId);
    if (instrumentNumber === 0) {
      return new NoteList();
    }

    return this.generateNotes(context, instrumentNumber, startTime, endTime);
  }

  private generateInstruments(compileData: CompileData, trackId?: string): number {
    const compileKey = trackId ? `${FSO_COMPILE_VAR}:${trackId}` : FSO_COMPILE_VAR;
    const compiled = compileData.getCompilationVariable(compileKey);
    if (typeof compiled === 'number') {
      return compiled;
    }

    const instrText = this.generateInstrumentText();
    if (instrText === null) {
      throw new Error(
        `FrozenSoundObject: unable to generate instrument text (numChannels=${this._numChannels})`,
      );
    }

    const instr = new GenericInstrument();
    instr.setName(FSO_INSTR_NAME);
    instr.setText(instrText);

    const instrId = compileData.addInstrument(instr);
    if (trackId) compileData.addInstrSourceId(instr, trackId);
    compileData.setCompilationVariable(compileKey, instrId);
    return instrId;
  }

  private generateNotes(
    context: TimeContext,
    instrumentNumber: number,
    renderStart: number,
    renderEnd: number,
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

    const sfName = this._frozenWaveFileName.replace(/\\/g, '/');

    const note = new Note();
    note.setPField(String(instrumentNumber), 1);
    note.setStartTime(this._startTime.toBeats(context) + renderStart);
    note.setSubjectiveDuration(newDur);
    note.setPField(`"${sfName}"`, 4);
    note.setPField(String(renderStart), 5);
    notes.add(note);

    return notes;
  }

  // ─── XML Serialization ───

  override saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.FrozenSoundObject');
    elem.addElement('numChannels').setText(this._numChannels.toString());
    elem.addElement('frozenWaveFileName').setText(this._frozenWaveFileName);

    if (this._frozenSoundObject) {
      const nested = this._frozenSoundObject.saveAsXML(objRefMap);
      elem.addElement(nested);
    }

    return elem;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): FrozenSoundObject {
    const obj = new FrozenSoundObject();
    initBasicFromXML(obj, data);

    const channels = data.getTextString('numChannels');
    if (channels) obj._numChannels = parseInt(channels, 10);

    const frozenFile = data.getTextString('frozenWaveFileName');
    if (frozenFile !== null) obj._frozenWaveFileName = frozenFile;

    const nestedElement = data.getElement('soundObject');
    if (nestedElement) {
      obj._frozenSoundObject = loadSoundObjectFromXML(nestedElement, objRefMap);
    }

    return obj;
  }

  override deepCopy(): SoundObject {
    return new FrozenSoundObject(this);
  }
}
