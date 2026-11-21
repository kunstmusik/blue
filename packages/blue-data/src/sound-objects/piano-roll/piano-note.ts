/**
 * PianoNote — a single note in the piano roll.
 */
import { Field } from './field';
import { FieldDef } from './field-def';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, readText, readInt, readDouble } from '../../utilities/xml';

/** Pitched piano-roll event with a start, duration, and per-note field values. */
export class PianoNote {
  /** Octave component of the note's scale-based pitch. */
  octave = 8;
  /** Degree within the selected scale period. */
  scaleDegree = 0;
  /** Note start relative to the piano roll, in beats. */
  start = 0;
  /** Note duration in beats. */
  duration = 1;
  /** Per-note score template override, or null to use the piano-roll template. */
  noteTemplate: string | null = null;
  private _fields: Field[] = [];

  /** Creates a default piano note or copies a supplied instance. */
  constructor(other?: PianoNote) {
    if (other) {
      this.octave = other.octave;
      this.scaleDegree = other.scaleDegree;
      this.start = other.start;
      this.duration = other.duration;
      this.noteTemplate = other.noteTemplate;
      // Fields are cloned with the same values but same fieldDef references
      this._fields = other._fields.map((f) => {
        const clone = new Field(f.getFieldDef());
        clone.setValue(f.getValue());
        return clone;
      });
    }
  }

  /** Returns the note's duration in beats. */
  getDuration(): number {
    return this.duration;
  }
  /** Sets the note's duration in beats. */
  setDuration(v: number): void {
    this.duration = v;
  }

  /** Returns the octave stored on the piano note. */
  getOctave(): number {
    return this.octave;
  }
  /** Sets the octave stored on the piano note. */
  setOctave(v: number): void {
    this.octave = v;
  }

  /** Returns the degree of the selected scale. */
  getScaleDegree(): number {
    return this.scaleDegree;
  }
  /** Sets the degree of the selected scale. */
  setScaleDegree(v: number): void {
    this.scaleDegree = v;
  }

  /** Returns the start stored on the piano note. */
  getStart(): number {
    return this.start;
  }
  /** Sets the start stored on the piano note. */
  setStart(v: number): void {
    this.start = v;
  }

  /** Returns the Csound text template expanded for each generated note. */
  getNoteTemplate(): string | null {
    return this.noteTemplate;
  }
  /** Sets the Csound text template expanded for each generated note. */
  setNoteTemplate(t: string | null): void {
    this.noteTemplate = t;
  }

  /** Returns stored values for the piano roll's custom field definitions. */
  getFields(): Field[] {
    return [...this._fields];
  }

  /** Initializes this note's custom fields using the supplied definitions. */
  initFields(fieldDefs: FieldDef[]): void {
    this._fields = fieldDefs.map((fd) => {
      const f = new Field(fd);
      return f;
    });
  }

  /** Associates the note's field values with the current definitions. */
  relinkFields(definitions: Map<string, FieldDef>): void {
    this._fields = this._fields.map((field) => {
      const definition = definitions.get(field.getFieldDef().getFieldName());
      if (!definition) throw new Error('Copied piano note field has no owner definition.');
      const copy = new Field(definition);
      copy.setValue(field.getValue());
      return copy;
    });
  }

  /** Serializes the piano note and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('pianoNote');
    elem.addElement('octave').setText(this.octave.toString());
    elem.addElement('scaleDegree').setText(this.scaleDegree.toString());
    elem.addElement('start').setText(this.start.toString());
    elem.addElement('duration').setText(this.duration.toString());
    if (this.noteTemplate) {
      elem.addElement('noteTemplate').setText(this.noteTemplate);
    }
    for (const f of this._fields) {
      elem.addElement(f.saveAsXML());
    }
    return elem;
  }

  /** Reconstructs the piano note from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    fieldTypes: Map<string, FieldDef>,
    context = new XmlLoadContext(data),
  ): PianoNote {
    checkRoot(data, 'pianoNote', context);
    checkShape(
      data,
      [],
      ['octave', 'scaleDegree', 'start', 'duration', 'noteTemplate', 'field'],
      context,
      ['field'],
    );
    const names = new Set<string>();
    const note = new PianoNote();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'octave':
          note.octave = readInt(node, context);
          break;
        case 'scaleDegree':
          note.scaleDegree = readInt(node, context);
          break;
        case 'start':
          note.start = readDouble(node, context);
          break;
        case 'duration':
          note.duration = readDouble(node, context);
          break;
        case 'noteTemplate':
          note.noteTemplate = readText(node, context);
          break;
        case 'field': {
          const name = node.getAttribute('name') ?? '';
          if (names.has(name))
            throw context.at(node).error({
              code: 'cardinality',
              member: '@name',
              value: name,
              message: 'Duplicate piano note field.',
              recovery: 'Keep one value per field definition.',
            });
          names.add(name);
          note._fields.push(Field.loadFromXML(node, fieldTypes, context));
          break;
        }
      }
    }
    if (note.duration < 0)
      throw context.error({
        code: 'value',
        member: 'duration',
        message: 'Note duration must be nonnegative.',
        recovery: 'Supply a nonnegative duration.',
      });
    for (const [name, definition] of fieldTypes) {
      if (!names.has(name)) note._fields.push(new Field(definition));
    }
    return note;
  }
}
