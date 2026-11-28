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

const TOKEN_PATTERN = /"[^"]*"|\[[^\]]*\]|\S*/g;

type CompiledTemplateToken =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'start' }
  | { readonly kind: 'dur' }
  | { readonly kind: 'freq' }
  | { readonly kind: 'field'; readonly name: string; readonly raw: string };

interface CompiledNoteTemplate {
  readonly baseTemplate: string;
  readonly tokenPlan: readonly CompiledTemplateToken[] | null;
}

function compilePianoNoteTemplate(
  rawTemplate: string,
  instrId: string,
  instrName: string,
): CompiledNoteTemplate {
  const baseTemplate = replaceAll(
    replaceAll(rawTemplate, '<INSTR_ID>', instrId),
    '<INSTR_NAME>',
    instrName,
  );

  const trimmed = baseTemplate.trim();
  let tokenPlan: CompiledTemplateToken[] | null = null;
  if (trimmed.startsWith('i') && !trimmed.includes('[') && !trimmed.includes(']')) {
    const body = trimmed.substring(1);
    const matches = body.match(TOKEN_PATTERN);
    if (matches) {
      const candidate: CompiledTemplateToken[] = [];
      let validFastPath = true;
      for (const rawToken of matches) {
        if (!rawToken) continue;
        if (!rawToken.includes('<') && !rawToken.includes('>')) {
          candidate.push({ kind: 'literal', value: rawToken });
          continue;
        }
        const exact = /^<([^<>]+)>$/.exec(rawToken);
        if (!exact) {
          validFastPath = false;
          break;
        }
        const name = exact[1]!;
        if (name === 'START') {
          candidate.push({ kind: 'start' });
        } else if (name === 'DUR') {
          candidate.push({ kind: 'dur' });
        } else if (name === 'FREQ') {
          candidate.push({ kind: 'freq' });
        } else {
          candidate.push({ kind: 'field', name, raw: rawToken });
        }
      }
      if (validFastPath && candidate.length >= 3) {
        tokenPlan = candidate;
      }
    }
  }

  return { baseTemplate, tokenPlan };
}

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

  /** Creates a default piano roll or copies a supplied instance. */
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

  /** Returns the tuning scale used to interpret note pitches. */
  getScale(): Scale {
    return this._scale;
  }
  /** Sets the tuning scale used to interpret note pitches. */
  setScale(s: Scale): void {
    this._scale = s;
  }

  /** Returns the number of notes stored on the piano roll. */
  getNoteCount(): number {
    return this._notes.length;
  }

  /** Returns the notes currently stored in the piano roll. */
  getNotes(): PianoNote[] {
    return [...this._notes];
  }
  /** Sets the notes stored on the piano roll. */
  setNotes(notes: PianoNote[]): void {
    this._notes = notes;
  }
  /** Adds a note and prepares its per-note field values. */
  addNote(note: PianoNote): void {
    this._notes.push(note);
  }
  /** Removes the supplied note from the piano roll. */
  removeNote(index: number): void {
    this._notes.splice(index, 1);
  }

  /** Returns the Csound text template expanded for each generated note. */
  getNoteTemplate(): string {
    return this._noteTemplate;
  }
  /** Sets the Csound text template expanded for each generated note. */
  setNoteTemplate(t: string): void {
    this._noteTemplate = t;
  }

  /** Returns the instrument ID stored on the piano roll. */
  getInstrumentId(): string {
    return this._instrumentId;
  }
  /** Sets the instrument ID stored on the piano roll. */
  setInstrumentId(id: string): void {
    this._instrumentId = id;
  }

  /** Returns the pitch representation selector. Values 0, 1, and 2 select frequency, octave.pitch-class, and MIDI pitch. */
  getPchGenerationMethod(): number {
    return this._pchGenerationMethod;
  }
  /** Selects how generated notes encode pitch. Use 0 for frequency, 1 for octave.pitch-class, or 2 for MIDI pitch. */
  setPchGenerationMethod(m: number): void {
    this._pchGenerationMethod = m;
  }

  /** Returns the transposition stored on the piano roll. */
  getTransposition(): number {
    return this._transposition;
  }
  /** Sets the transposition stored on the piano roll. */
  setTransposition(t: number): void {
    this._transposition = t;
  }

  /** Returns definitions shared by the notes in this piano roll. */
  getFieldDefinitions(): FieldDef[] {
    return [...this._fieldDefinitions];
  }
  /** Replaces the field definitions associated with the piano roll. */
  setFieldDefinitions(fieldDefs: FieldDef[]): void {
    this._fieldDefinitions = fieldDefs.map(cloneFieldDef);
    this._notes = this._notes.map((note) => rebuildPianoNoteFields(note, this._fieldDefinitions));
  }
  /** Adds a field definition and initializes that field on existing notes. */
  addFieldDef(fd: FieldDef): void {
    this._fieldDefinitions.push(fd);
  }

  /** Returns the horizontal editor scale in pixels per second. */
  getPixelSecond(): number {
    return this._pixelSecond;
  }
  /** Sets the horizontal editor scale in pixels per second. */
  setPixelSecond(v: number): void {
    this._pixelSecond = v;
  }

  /** Returns the note display height in pixels. */
  getNoteHeight(): number {
    return this._noteHeight;
  }
  /** Sets the note display height in pixels. */
  setNoteHeight(v: number): void {
    this._noteHeight = v;
  }

  /** Reports whether the piano roll snaps edits to its grid. */
  isSnapEnabled(): boolean {
    return this._snapEnabled;
  }
  /** Enables or disables snapping to the piano-roll edit grid. */
  setSnapEnabled(v: boolean): void {
    this._snapEnabled = v;
  }

  /** Returns the snap value enum stored on the piano roll. */
  getSnapValueEnum(): SnapValueName {
    return this._snapValueEnum;
  }
  /** Sets the snap value enum stored on the piano roll. */
  setSnapValueEnum(v: SnapValueName): void {
    this._snapValueEnum = v;
  }

  /** Reports whether the piano roll uses the project ruler settings. */
  isUseGlobalRuler(): boolean {
    return this._useGlobalRuler;
  }
  /** Controls whether the piano roll takes its ruler units from the project. */
  setUseGlobalRuler(v: boolean): void {
    this._useGlobalRuler = v;
  }

  /** Returns the primary time display stored on the piano roll. */
  getPrimaryTimeDisplay(): TimeBase {
    return this._primaryTimeDisplay;
  }
  /** Sets the primary time display stored on the piano roll. */
  setPrimaryTimeDisplay(v: TimeBase): void {
    this._primaryTimeDisplay = v;
  }

  /** Returns the secondary time display stored on the piano roll. */
  getSecondaryTimeDisplay(): TimeBase {
    return this._secondaryTimeDisplay;
  }
  /** Sets the secondary time display stored on the piano roll. */
  setSecondaryTimeDisplay(v: TimeBase): void {
    this._secondaryTimeDisplay = v;
  }

  /** Reports whether the secondary piano-roll ruler is displayed. */
  isSecondaryRulerEnabled(): boolean {
    return this._secondaryRulerEnabled;
  }
  /** Shows or hides the secondary piano-roll ruler. */
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

    const numScaleDegrees =
      this._pchGenerationMethod === GENERATE_MIDI ? 12 : this._scale.getNumScaleDegrees();
    const compiledByTemplate = new Map<string, CompiledNoteTemplate>();
    const fieldValues = new Map<string, string>();
    const tokenBuffer: string[] = [];

    for (const note of this._notes) {
      let freq = '';
      let octave = note.octave;
      let scaleDegree = note.scaleDegree + this._transposition;

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

      const rawTemplate = note.noteTemplate || this._noteTemplate;
      let compiled = compiledByTemplate.get(rawTemplate);
      if (!compiled) {
        compiled = compilePianoNoteTemplate(rawTemplate, instrId, this._instrumentId);
        compiledByTemplate.set(rawTemplate, compiled);
      }

      const startStr = note.start.toString();
      const durStr = note.duration.toString();
      const fields = note.getFields();
      fieldValues.clear();
      const tokenPlan =
        freq.length > 0 && fields.every((field) => !/[<>]/.test(field.getFieldDef().getFieldName()))
          ? compiled.tokenPlan
          : null;
      if (tokenPlan !== null) {
        for (const field of fields) {
          const fieldDef = field.getFieldDef();
          const name = fieldDef.getFieldName();
          if (fieldValues.has(name)) continue;
          const val =
            fieldDef.getFieldType() === 'DISCRETE'
              ? Math.round(field.getValue()).toString()
              : field.getValue().toString();
          fieldValues.set(name, val);
        }

        tokenBuffer.length = tokenPlan.length;
        for (let i = 0; i < tokenPlan.length; i++) {
          const slot = tokenPlan[i]!;
          switch (slot.kind) {
            case 'literal':
              tokenBuffer[i] = slot.value;
              break;
            case 'start':
              tokenBuffer[i] = startStr;
              break;
            case 'dur':
              tokenBuffer[i] = durStr;
              break;
            case 'freq':
              tokenBuffer[i] = freq;
              break;
            case 'field':
              tokenBuffer[i] = fieldValues.get(slot.name) ?? slot.raw;
              break;
          }
        }
        const parsed = Note.createFromTokens(tokenBuffer);
        if (parsed) nl.push(parsed);
        continue;
      }

      let rendered = replaceAll(compiled.baseTemplate, '<START>', startStr);
      rendered = replaceAll(rendered, '<DUR>', durStr);
      rendered = replaceAll(rendered, '<FREQ>', freq);
      for (const field of fields) {
        const definition = field.getFieldDef();
        const value =
          definition.getFieldType() === 'DISCRETE'
            ? Math.round(field.getValue())
            : field.getValue();
        rendered = replaceAll(rendered, `<${definition.getFieldName()}>`, value.toString());
      }

      try {
        const parsed = Note.createNoteFromText(rendered);
        if (parsed) nl.push(parsed);
      } catch {
        console.warn(`[PianoRoll] Failed to parse note: ${rendered}`);
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

  /** Generates the piano roll’s Csound notes, awaiting asynchronous generators or processors through the compile context. */
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

  /** Returns the historical ruler interval stored on the piano roll. */
  getHistoricalRulerInterval(): number | null {
    return this._historicalRulerInterval;
  }

  /** Reconstructs the piano roll from its Blue XML element, using the supplied diagnostic context when provided. */
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
