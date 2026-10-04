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
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText, readInt, readDouble, readBoolean, readEnum } from '../utilities/xml';
import { BASIC_SOUND_OBJECT_CHILDREN } from './sound-object-utilities';
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
  private _historicalRulerInterval: number | null = null;

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
      this._historicalRulerInterval = other._historicalRulerInterval;
      this._fieldDefinitions = other._fieldDefinitions.map((fd) => {
        const clone = new FieldDef();
        clone.setFieldName(fd.getFieldName());
        clone.setFieldType(fd.getFieldType());
        clone.setMinValue(fd.getMinValue());
        clone.setMaxValue(fd.getMaxValue());
        clone.setDefaultValue(fd.getDefaultValue());
        return clone;
      });
      const definitions = new Map(
        this._fieldDefinitions.map((definition) => [definition.getFieldName(), definition]),
      );
      this._notes = other._notes.map((note) => {
        const copy = new PianoNote(note);
        copy.relinkFields(definitions);
        return copy;
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
    if (this._historicalRulerInterval !== null)
      elem.addElement('timeUnit').setText(String(this._historicalRulerInterval));

    for (const fd of this._fieldDefinitions) {
      elem.addElement(fd.saveAsXML().setName('fieldDef'));
    }
    for (const note of this._notes) {
      elem.addElement(note.saveAsXML().setName('pianoNote'));
    }
    return elem;
  }

  getHistoricalRulerInterval(): number | null {
    return this._historicalRulerInterval;
  }

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): PianoRoll {
    const ctx = context ?? new XmlLoadContext(data);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      type === null ||
      !['PianoRoll', 'blue.soundObject.PianoRoll'].includes(type)
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported PianoRoll type.',
        recovery: 'Supply a supported concrete SoundObject type.',
      });
    checkShape(
      data,
      ['type'],
      [
        ...BASIC_SOUND_OBJECT_CHILDREN,
        'noteTemplate',
        'instrumentId',
        'scale',
        'pchGenerationMethod',
        'transposition',
        'pixelSecond',
        'noteHeight',
        'snapEnabled',
        'snapValueEnum',
        'snapValue',
        'timeDisplay',
        'timeUnit',
        'useGlobalRuler',
        'primaryTimeDisplay',
        'secondaryTimeDisplay',
        'secondaryRulerEnabled',
        'fieldDef',
        'pianoNote',
      ],
      ctx,
      ['fieldDef', 'pianoNote', 'scale'],
    );
    const roll = new PianoRoll();
    roll._fieldDefinitions = [];
    roll._notes = [];
    initBasicFromXML(roll, data, ctx);
    for (const child of data.getElements()) {
      switch (child.getName()) {
        case 'noteTemplate':
          roll._noteTemplate = readText(child, ctx);
          break;
        case 'instrumentId':
          roll._instrumentId = readText(child, ctx);
          break;
        case 'pchGenerationMethod':
          roll._pchGenerationMethod = readInt(child, ctx, 0, 2);
          break;
        case 'transposition':
          roll._transposition = readInt(child, ctx, -2147483648, 2147483647);
          break;
        case 'pixelSecond':
          roll._pixelSecond = readInt(child, ctx, 1, 2147483647);
          break;
        case 'noteHeight':
          roll._noteHeight = readInt(child, ctx, 1, 2147483647);
          break;
        case 'snapEnabled':
          roll._snapEnabled = readBoolean(child, ctx);
          break;
        case 'useGlobalRuler':
          roll._useGlobalRuler = readBoolean(child, ctx);
          break;
        case 'secondaryRulerEnabled':
          roll._secondaryRulerEnabled = readBoolean(child, ctx);
          break;
        case 'primaryTimeDisplay':
          roll._primaryTimeDisplay = readEnum(child, Object.values(TimeBase), ctx);
          break;
        case 'secondaryTimeDisplay':
          roll._secondaryTimeDisplay = readEnum(child, Object.values(TimeBase), ctx);
          break;
        case 'timeUnit':
          roll._historicalRulerInterval = readInt(child, ctx, 1, 2147483647);
          ctx.at(child).diagnostic({
            code: 'SL-H06',
            severity: 'warning',
            value: String(roll._historicalRulerInterval),
            message:
              'Historical timeUnit controlled PianoRoll ruler ticks and labels; the current editor does not apply that interval.',
            recovery:
              'The interval is retained and saved as timeUnit. Use a compatible editor to edit it until the current editor supports historical intervals.',
          });
          break;
      }
    }
    const snap = data.getElement('snapValueEnum');
    const oldSnap = data.getElement('snapValue');
    let currentSnap: SnapValueName | undefined;
    if (snap) {
      const value = readText(snap, ctx);
      const normalized = value === 'QUARTER' ? 'SIXTEENTH' : value;
      if (!isValidSnapValueName(normalized))
        throw ctx.at(snap).error({
          code: 'value',
          value,
          message: 'Unsupported piano-roll snap value.',
          recovery: 'Choose a supported snap enum.',
        });
      currentSnap = normalized;
    }
    let legacySnap: SnapValueName | undefined;
    if (oldSnap) {
      const value = readDouble(oldSnap, ctx);
      if (value <= 0)
        throw ctx.at(oldSnap).error({
          code: 'value',
          value: String(value),
          message: 'Historical snap interval must be positive.',
          recovery: 'Supply a positive snap interval.',
        });
      legacySnap = closestSnapValueMatch(value);
    }
    if (currentSnap && legacySnap && currentSnap !== legacySnap)
      throw ctx.at(oldSnap!).error({
        code: 'conflict',
        message: 'Conflicting snap representations.',
        recovery: 'Keep equivalent snap settings.',
      });
    roll._snapValueEnum = currentSnap ?? legacySnap ?? roll._snapValueEnum;
    const oldDisplay = data.getElement('timeDisplay');
    if (oldDisplay) {
      const value = readInt(oldDisplay, ctx, 0, 1) === 0 ? TimeBase.TIME : TimeBase.BEATS;
      if (data.getElement('primaryTimeDisplay') && value !== roll._primaryTimeDisplay)
        throw ctx.at(oldDisplay).error({
          code: 'conflict',
          message: 'Conflicting ruler display representations.',
          recovery: 'Keep equivalent primary ruler settings.',
        });
      roll._primaryTimeDisplay = value;
    }
    const scales = data.getElements('scale').toArray();
    if (scales.length > 1) {
      const placeholder = scales[0];
      if (
        scales.length !== 2 ||
        placeholder.getAttributeNames().length ||
        placeholder.getElements().toArray().length ||
        placeholder.getTextString().trim() ||
        scales[1].getElements().toArray().length === 0
      )
        throw ctx.at(scales[1]).error({
          code: 'cardinality',
          message: 'Duplicate piano-roll scales.',
          recovery: 'Keep one populated scale.',
        });
      ctx.at(placeholder).diagnostic({
        code: 'SL-H10',
        severity: 'warning',
        message: 'Historical empty serializer scale placeholder normalized.',
        recovery: 'Empty serializer placeholder removed; the populated scale is preserved.',
      });
      roll._scale = Scale.loadFromXML(scales[1], ctx);
    } else if (scales[0]) roll._scale = Scale.loadFromXML(scales[0], ctx);
    const definitions = new Map<string, FieldDef>();
    for (const child of data.getElements('fieldDef')) {
      const definition = FieldDef.loadFromXML(child, ctx);
      const name = definition.getFieldName();
      if (definitions.has(name))
        throw ctx.at(child).error({
          code: 'cardinality',
          member: '@name',
          value: name,
          message: 'Duplicate piano-roll field definition.',
          recovery: 'Declare each field name once.',
        });
      definitions.set(name, definition);
      roll._fieldDefinitions.push(definition);
    }
    for (const child of data.getElements('pianoNote')) {
      const note = PianoNote.loadFromXML(child, definitions, ctx);
      if (note.noteTemplate === roll._noteTemplate) note.noteTemplate = null;
      roll._notes.push(note);
    }
    return context ? roll : requireXmlValue(ctx.result(roll), sink);
  }

  override deepCopy(): SoundObject {
    return new PianoRoll(this);
  }
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
