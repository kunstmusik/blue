import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import {
  getNotes,
  applyNoteProcessorChain,
  applyNoteProcessorChainAsync,
  applyTimeBehavior,
  setScoreStart,
} from '../utilities/score';

export interface ExternalCommandExecutor {
  execute(commandLine: string, textBody: string, projectDir: string | null): string;
}

let _executor: ExternalCommandExecutor | null = null;

export function setExternalCommandExecutor(executor: ExternalCommandExecutor | null): void {
  _executor = executor;
}

export function getExternalCommandExecutor(): ExternalCommandExecutor | null {
  return _executor;
}

export class External extends AbstractSoundObject {
  private _commandLine = '';
  private _text = '';
  private _syntaxType = 'Python';

  constructor(other?: External) {
    super();
    this.setName('External');
    this._syntaxType = 'Python';
    this._backgroundColor = 0x404040;
    if (other) {
      this.copyFrom(other);
      this._commandLine = other._commandLine;
      this._text = other._text;
      this._syntaxType = other._syntaxType;
    }
  }

  getCommandLine(): string {
    return this._commandLine;
  }
  setCommandLine(cmd: string): void {
    this._commandLine = cmd;
  }

  getText(): string {
    return this._text;
  }
  setText(text: string): void {
    this._text = text;
  }

  getSyntaxType(): string {
    return this._syntaxType;
  }
  setSyntaxType(type: string): void {
    this._syntaxType = type;
  }

  override generateForCSD(
    context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    if (this._commandLine.trim().length === 0 && this._text.trim().length === 0) {
      return new NoteList();
    }

    const executor = _executor;
    if (!executor) {
      return new NoteList();
    }

    let rawScore: string;
    try {
      rawScore = executor.execute(this._commandLine, this._text, null);
    } catch (ex) {
      console.warn(
        'External.generateForCSD: command execution failed:',
        ex instanceof Error ? ex.message : String(ex),
      );
      return new NoteList();
    }

    return this.processRawScore(rawScore, context);
  }

  private processRawScore(rawScore: string, context: TimeContext): NoteList {
    const noteList = getNotes(rawScore);
    const processed = applyNoteProcessorChain(noteList, this.getNoteProcessorChain());
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(processed, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(processed, startTime);

    return processed;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    if (this._commandLine.trim().length === 0 && this._text.trim().length === 0) {
      return new NoteList();
    }

    const executor = _executor;
    if (!executor) {
      return new NoteList();
    }

    let rawScore: string;
    try {
      rawScore = executor.execute(this._commandLine, this._text, null);
    } catch (ex) {
      console.warn(
        'External.generateForCSDAsync: command execution failed:',
        ex instanceof Error ? ex.message : String(ex),
      );
      return new NoteList();
    }

    const noteList = getNotes(rawScore);
    const processed = await applyNoteProcessorChainAsync(
      noteList,
      this.getNoteProcessorChain(),
      compileData,
    );
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTimeOffset = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(processed, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(processed, startTimeOffset);

    return processed;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.External');
    elem.addElement('text').setText(this._text);
    elem.addElement('commandLine').setText(this._commandLine);
    elem.addElement('syntaxType').setText(this._syntaxType);
    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): External {
    const obj = new External();
    initBasicFromXML(obj, data);

    const text = data.getTextString('text');
    if (text !== null) obj._text = text;

    const cmd = data.getTextString('commandLine');
    if (cmd !== null) obj._commandLine = cmd;

    const syntax = data.getTextString('syntaxType');
    if (syntax !== null) obj._syntaxType = syntax;

    return obj;
  }

  override deepCopy(): SoundObject {
    return new External(this);
  }
}
