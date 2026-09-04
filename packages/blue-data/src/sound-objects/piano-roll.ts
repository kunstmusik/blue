/**
 * PianoRoll — generates notes from a piano roll grid.
 * Mirrors the Java PianoRoll class.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { Note } from './note';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { TimeBase } from '../time/time-base';
import { closestSnapValueMatch, isValidSnapValueName } from '../time/snap-value';
import type { SnapValueName } from '../time/snap-value';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { TimeBehavior } from './time-behavior';
import { replaceAll } from '../utilities/text';
import { Scale } from './piano-roll/scale';
import { PianoNote } from './piano-roll/piano-note';
import { FieldDef } from './piano-roll/field-def';
import { FieldType } from './piano-roll/field-type';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { applyTimeBehavior, setScoreStart } from '../utilities/score';

const GENERATE_FREQUENCY = 0;
const GENERATE_PCH = 1;
const GENERATE_MIDI = 2;

export class PianoRoll extends AbstractSoundObject {
  private _scale = new Scale();
  private _notes: PianoNote[] = [];
  private _noteTemplate = 'i <INSTR_ID> <START> <DUR> <FREQ> <AMP>';
  private _instrumentId = '1';
  private _pchGenerationMethod = GENERATE_FREQUENCY;
  private _transposition = 0;
  private _fieldDefinitions: FieldDef[] = [];
  private _pixelSecond = 64;
  private _noteHeight = 15;
  private _snapEnabled = true;
  private _snapValueEnum: SnapValueName = 'SIXTEENTH';
  private _useGlobalRuler = false;
  private _primaryTimeDisplay: TimeBase = TimeBase.BBF;
  private _secondaryTimeDisplay: TimeBase = TimeBase.TIME;
  private _secondaryRulerEnabled = false;

  constructor(other?: PianoRoll) {
    super();
    this.setName('PianoRoll');
    this._timeBehavior = TimeBehavior.REPEAT;
    this._repeatPoint = TimeDuration.beats(4);
    if (!other) {
      const ampField = new FieldDef();
      ampField.setFieldName('AMP');
      ampField.setFieldType(FieldType.CONTINUOUS);
      this._fieldDefinitions = [ampField];
    }
    if (other) {
      this.copyFrom(other);
      this._scale = new Scale(other._scale);
      this._notes = other._notes.map((n) => new PianoNote(n));
      this._noteTemplate = other._noteTemplate;
      this._instrumentId = other._instrumentId;
      this._pchGenerationMethod = other._pchGenerationMethod;
      this._transposition = other._transposition;
      this._pixelSecond = other._pixelSecond;
      this._noteHeight = other._noteHeight;
      this._snapEnabled = other._snapEnabled;
      this._snapValueEnum = other._snapValueEnum;
      this._useGlobalRuler = other._useGlobalRuler;
      this._primaryTimeDisplay = other._primaryTimeDisplay;
      this._secondaryTimeDisplay = other._secondaryTimeDisplay;
      this._secondaryRulerEnabled = other._secondaryRulerEnabled;
      this._fieldDefinitions = other._fieldDefinitions.map((fd) => {
        const clone = new FieldDef();
        clone.setFieldName(fd.getFieldName());
        clone.setFieldType(fd.getFieldType());
        clone.setMinValue(fd.getMinValue());
        clone.setMaxValue(fd.getMaxValue());
        clone.setDefaultValue(fd.getDefaultValue());
        return clone;
      });
    }
  }

  getScale(): Scale {
    return this._scale;
  }
  setScale(s: Scale): void {
    this._scale = s;
  }

  getNotes(): PianoNote[] {
    return [...this._notes];
  }
  setNotes(notes: PianoNote[]): void {
    this._notes = notes;
  }
  addNote(note: PianoNote): void {
    this._notes.push(note);
  }
  removeNote(index: number): void {
    this._notes.splice(index, 1);
  }

  getNoteTemplate(): string {
    return this._noteTemplate;
  }
  setNoteTemplate(t: string): void {
    this._noteTemplate = t;
  }

  getInstrumentId(): string {
    return this._instrumentId;
  }
  setInstrumentId(id: string): void {
    this._instrumentId = id;
  }

  getPchGenerationMethod(): number {
    return this._pchGenerationMethod;
  }
  setPchGenerationMethod(m: number): void {
    this._pchGenerationMethod = m;
  }

  getTransposition(): number {
    return this._transposition;
  }
  setTransposition(t: number): void {
    this._transposition = t;
  }

  getFieldDefinitions(): FieldDef[] {
    return [...this._fieldDefinitions];
  }
  setFieldDefinitions(fieldDefs: FieldDef[]): void {
    this._fieldDefinitions = fieldDefs.map(cloneFieldDef);
    this._notes = this._notes.map((note) => rebuildPianoNoteFields(note, this._fieldDefinitions));
  }
  addFieldDef(fd: FieldDef): void {
    this._fieldDefinitions.push(fd);
  }

  getPixelSecond(): number {
    return this._pixelSecond;
  }
  setPixelSecond(v: number): void {
    this._pixelSecond = v;
  }

  getNoteHeight(): number {
    return this._noteHeight;
  }
  setNoteHeight(v: number): void {
    this._noteHeight = v;
  }

  isSnapEnabled(): boolean {
    return this._snapEnabled;
  }
  setSnapEnabled(v: boolean): void {
    this._snapEnabled = v;
  }

  getSnapValueEnum(): SnapValueName {
    return this._snapValueEnum;
  }
  setSnapValueEnum(v: SnapValueName): void {
    this._snapValueEnum = v;
  }

  isUseGlobalRuler(): boolean {
    return this._useGlobalRuler;
  }
  setUseGlobalRuler(v: boolean): void {
    this._useGlobalRuler = v;
  }

  getPrimaryTimeDisplay(): TimeBase {
    return this._primaryTimeDisplay;
  }
  setPrimaryTimeDisplay(v: TimeBase): void {
    this._primaryTimeDisplay = v;
  }

  getSecondaryTimeDisplay(): TimeBase {
    return this._secondaryTimeDisplay;
  }
  setSecondaryTimeDisplay(v: TimeBase): void {
    this._secondaryTimeDisplay = v;
  }

  isSecondaryRulerEnabled(): boolean {
    return this._secondaryRulerEnabled;
  }
  setSecondaryRulerEnabled(v: boolean): void {
    this._secondaryRulerEnabled = v;
  }

  override getTimeBehavior(): TimeBehavior {
    return this._timeBehavior;
  }

  private generateRawNotes(): NoteList {
    const nl = new NoteList();
    let instrId = this._instrumentId.trim();

    // Quote if not numeric
    if (isNaN(parseInt(instrId, 10))) {
      instrId = `"${instrId}"`;
    }

    for (const note of this._notes) {
      let freq = '';
      let octave = note.octave;
      let scaleDegree = note.scaleDegree + this._transposition;
      const numScaleDegrees =
        this._pchGenerationMethod === GENERATE_MIDI ? 12 : this._scale.getNumScaleDegrees();

      // Normalize scale degree
      if (scaleDegree >= numScaleDegrees) {
        octave += Math.floor(scaleDegree / numScaleDegrees);
        scaleDegree = scaleDegree % numScaleDegrees;
      }
      if (scaleDegree < 0) {
        const octaveDiff = Math.floor((scaleDegree * -1) / numScaleDegrees) + 1;
        scaleDegree = scaleDegree % numScaleDegrees;
        octave -= octaveDiff;
        scaleDegree = numScaleDegrees + scaleDegree;
      }

      // Calculate frequency
      switch (this._pchGenerationMethod) {
        case GENERATE_FREQUENCY:
          freq = this._scale.getFrequency(octave, scaleDegree).toString();
          break;
        case GENERATE_PCH:
          freq = `${octave}.${scaleDegree}`;
          break;
        case GENERATE_MIDI:
          freq = (octave * 12 + scaleDegree).toString();
          break;
      }

      let template = note.noteTemplate || this._noteTemplate;
      template = replaceAll(template, '<INSTR_ID>', instrId);
      template = replaceAll(template, '<INSTR_NAME>', this._instrumentId);
      template = replaceAll(template, '<START>', note.start.toString());
      template = replaceAll(template, '<DUR>', note.duration.toString());
      template = replaceAll(template, '<FREQ>', freq);

      // Substitute custom field values
      for (const field of note.getFields()) {
        const fieldDef = field.getFieldDef();
        const key = `<${fieldDef.getFieldName()}>`;
        const val =
          fieldDef.getFieldType() === 'DISCRETE'
            ? Math.round(field.getValue()).toString()
            : field.getValue().toString();
        template = replaceAll(template, key, val);
      }

      try {
        const parsed = Note.createNoteFromText(template);
        if (parsed) nl.push(parsed);
      } catch {
        console.warn(`[PianoRoll] Failed to parse note: ${template}`);
      }
    }

    nl.sortByStartTime();
    return nl;
  }

  private applyTimeAndOffset(nl: NoteList, context: TimeContext): void {
    const duration = this._subjectiveDuration.toBeats(context);
    const rpBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;
    applyTimeBehavior(nl, this._timeBehavior, duration, rpBeats);

    const startTime = this._startTime.toBeats(context);
    setScoreStart(nl, startTime);
  }

  override generateForCSD(
    context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    const nl = this.generateRawNotes();
    const npc = this.getNoteProcessorChain();
    npc.apply(nl);
    this.applyTimeAndOffset(nl, context);
    return nl;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    const nl = this.generateRawNotes();
    const npc = this.getNoteProcessorChain();
    await npc.applyAsync(nl, compileData);
    this.applyTimeAndOffset(nl, context);
    return nl;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.PianoRoll');
    elem.addElement('noteTemplate').setText(this._noteTemplate);
    elem.addElement('instrumentId').setText(this._instrumentId);
    elem.addElement('scale').setText('');
    elem.addElement(this._scale.saveAsXML().setName('scale'));
    elem.addElement('pchGenerationMethod').setText(this._pchGenerationMethod.toString());
    elem.addElement('transposition').setText(this._transposition.toString());
    elem.addElement('pixelSecond').setText(this._pixelSecond.toString());
    elem.addElement('noteHeight').setText(this._noteHeight.toString());
    elem.addElement('snapEnabled').setText(this._snapEnabled.toString());
    elem.addElement('snapValueEnum').setText(this._snapValueEnum);
    elem.addElement('useGlobalRuler').setText(this._useGlobalRuler.toString());
    elem.addElement('primaryTimeDisplay').setText(this._primaryTimeDisplay);
    elem.addElement('secondaryTimeDisplay').setText(this._secondaryTimeDisplay);
    elem.addElement('secondaryRulerEnabled').setText(this._secondaryRulerEnabled.toString());

    for (const fd of this._fieldDefinitions) {
      elem.addElement(fd.saveAsXML().setName('fieldDef'));
    }
    for (const note of this._notes) {
      elem.addElement(note.saveAsXML().setName('pianoNote'));
    }
    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): PianoRoll {
    const pr = new PianoRoll();
    pr._fieldDefinitions = [];
    pr._notes = [];

    initBasicFromXML(pr, data);

    const fieldTypes = new Map<string, FieldDef>();

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'noteTemplate':
          pr._noteTemplate = node.getTextString();
          break;
        case 'instrumentId':
          pr._instrumentId = node.getTextString();
          break;
        case 'scale':
          pr._scale = Scale.loadFromXML(node);
          break;
        case 'fieldDef': {
          const fd = FieldDef.loadFromXML(node);
          fieldTypes.set(fd.getFieldName(), fd);
          pr._fieldDefinitions.push(fd);
          break;
        }
        case 'pianoNote': {
          const pn = PianoNote.loadFromXML(node, fieldTypes);
          // Clear note template if it matches the default
          if (pn.getNoteTemplate() === pr._noteTemplate) {
            pn.setNoteTemplate(null);
          }
          pr._notes.push(pn);
          break;
        }
        case 'pchGenerationMethod':
          pr._pchGenerationMethod = parseInt(node.getTextString(), 10);
          break;
        case 'transposition':
          pr._transposition = parseInt(node.getTextString(), 10);
          break;
        case 'pixelSecond':
          pr._pixelSecond = parseInt(node.getTextString(), 10) || 64;
          break;
        case 'noteHeight':
          pr._noteHeight = parseInt(node.getTextString(), 10) || 15;
          break;
        case 'snapEnabled':
          pr._snapEnabled = node.getTextString() !== 'false';
          break;
        case 'snapValue': {
          const legacyValue = parseFloat(node.getTextString());
          pr._snapValueEnum = Number.isFinite(legacyValue)
            ? closestSnapValueMatch(legacyValue)
            : 'BEAT';
          break;
        }
        case 'snapValueEnum': {
          const text = node.getTextString();
          pr._snapValueEnum = isValidSnapValueName(text) ? text : 'BEAT';
          break;
        }
        case 'useGlobalRuler':
          pr._useGlobalRuler = node.getTextString() === 'true';
          break;
        case 'primaryTimeDisplay':
          pr._primaryTimeDisplay = parseTimeBase(node.getTextString(), TimeBase.BBF);
          break;
        case 'secondaryTimeDisplay':
          pr._secondaryTimeDisplay = parseTimeBase(node.getTextString(), TimeBase.TIME);
          break;
        case 'secondaryRulerEnabled':
          pr._secondaryRulerEnabled = node.getTextString() === 'true';
          break;
      }
    }

    return pr;
  }

  override deepCopy(): SoundObject {
    return new PianoRoll(this);
  }
}

function parseTimeBase(value: string, fallback: TimeBase): TimeBase {
  return Object.values(TimeBase).includes(value as TimeBase) ? (value as TimeBase) : fallback;
}

function cloneFieldDef(fieldDef: FieldDef): FieldDef {
  const clone = new FieldDef();
  clone.setFieldName(fieldDef.getFieldName());
  clone.setFieldType(fieldDef.getFieldType());
  clone.setMinValue(fieldDef.getMinValue());
  clone.setMaxValue(fieldDef.getMaxValue());
  clone.setDefaultValue(fieldDef.getDefaultValue());
  return clone;
}

function rebuildPianoNoteFields(note: PianoNote, fieldDefs: FieldDef[]): PianoNote {
  const rebuilt = new PianoNote();
  rebuilt.setOctave(note.getOctave());
  rebuilt.setScaleDegree(note.getScaleDegree());
  rebuilt.setStart(note.getStart());
  rebuilt.setDuration(note.getDuration());
  rebuilt.setNoteTemplate(note.getNoteTemplate());

  rebuilt.initFields(fieldDefs);

  const previousFields = note.getFields();
  const nextFields = rebuilt.getFields();
  const previousValuesByFieldName = new Map(
    previousFields.map((field) => [field.getFieldDef().getFieldName(), field.getValue()]),
  );

  for (let index = 0; index < nextFields.length; index += 1) {
    const nextFieldDef = fieldDefs[index];
    const previousField = previousFields[index];
    const nextValue = nextFieldDef
      ? (previousValuesByFieldName.get(nextFieldDef.getFieldName()) ?? previousField?.getValue())
      : previousField?.getValue();

    if (nextValue !== undefined) {
      nextFields[index]!.setValue(nextValue);
    }
  }

  return rebuilt;
}
