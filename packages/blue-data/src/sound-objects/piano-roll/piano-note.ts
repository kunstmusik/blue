/**
 * PianoNote — a single note in the piano roll.
 */
import { Field } from './field';
import { FieldDef } from './field-def';
import { Element } from '../../serialization/xml-reader';

export class PianoNote {
  octave = 8;
  scaleDegree = 0;
  start = 0;
  duration = 1;
  noteTemplate: string | null = null;
  private _fields: Field[] = [];

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

  getDuration(): number {
    return this.duration;
  }
  setDuration(v: number): void {
    this.duration = v;
  }

  getOctave(): number {
    return this.octave;
  }
  setOctave(v: number): void {
    this.octave = v;
  }

  getScaleDegree(): number {
    return this.scaleDegree;
  }
  setScaleDegree(v: number): void {
    this.scaleDegree = v;
  }

  getStart(): number {
    return this.start;
  }
  setStart(v: number): void {
    this.start = v;
  }

  getNoteTemplate(): string | null {
    return this.noteTemplate;
  }
  setNoteTemplate(t: string | null): void {
    this.noteTemplate = t;
  }

  getFields(): Field[] {
    return [...this._fields];
  }

  initFields(fieldDefs: FieldDef[]): void {
    this._fields = fieldDefs.map((fd) => {
      const f = new Field(fd);
      return f;
    });
  }

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

  static loadFromXML(data: Element, fieldTypes: Map<string, FieldDef>): PianoNote {
    const note = new PianoNote();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'octave':
          note.octave = parseInt(node.getTextString(), 10);
          break;
        case 'scaleDegree':
          note.scaleDegree = parseInt(node.getTextString(), 10);
          break;
        case 'start':
          note.start = parseFloat(node.getTextString());
          break;
        case 'duration':
          note.duration = parseFloat(node.getTextString());
          break;
        case 'noteTemplate':
          note.noteTemplate = node.getTextString();
          break;
        case 'field':
          note._fields.push(Field.loadFromXML(node, fieldTypes));
          break;
      }
    }
    return note;
  }
}
