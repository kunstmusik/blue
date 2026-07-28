import { Note } from '../note';
import { NoteList } from '../note-list';
import { replaceAll } from '../../utilities/text';
import { Column, PitchColumn, AmpColumn } from './column';
import { TrackerNote } from './tracker-note';
import { Element } from '../../serialization/xml-reader';

export class Track {
  private _name = '';
  private _noteTemplate = 'i <INSTR_ID> <START> <DUR> <pch> <db>';
  private _instrumentId = '1';
  private _columns: Column[] = [];
  private _trackerNotes: TrackerNote[] = [];

  constructor(init = true) {
    if (init) {
      this.addColumn(new PitchColumn());
      this.addColumn(new AmpColumn());
    }
  }

  static fromOther(other: Track): Track {
    const track = new Track(false);
    track._name = other._name;
    track._noteTemplate = other._noteTemplate;
    track._instrumentId = other._instrumentId;
    for (const col of other._columns) {
      track._columns.push(new Column(col));
    }
    for (const note of other._trackerNotes) {
      track._trackerNotes.push(new TrackerNote(note));
    }
    return track;
  }

  resizeSteps(steps: number): void {
    if (steps < this._trackerNotes.length) {
      this._trackerNotes.splice(steps);
    } else {
      const numToAdd = steps - this._trackerNotes.length;
      for (let i = 0; i < numToAdd; i++) {
        this._trackerNotes.push(this.createNewNote());
      }
    }
  }

  private createNewNote(): TrackerNote {
    const note = new TrackerNote();
    for (let i = 0; i < this._columns.length; i++) {
      note.addColumn();
    }
    return note;
  }

  getColumn(index: number): Column | null {
    if (index === 0) return null;
    return this._columns[index - 1] ?? null;
  }

  getNumColumns(): number {
    return 1 + this._columns.length;
  }

  getNumSteps(): number {
    return this._trackerNotes.length;
  }

  getTrackerNote(rowIndex: number): TrackerNote {
    return this._trackerNotes[rowIndex];
  }

  setName(name: string): void { this._name = name; }
  getName(): string { return this._name; }

  getNoteTemplate(): string { return this._noteTemplate; }
  setNoteTemplate(template: string): void { this._noteTemplate = template; }

  getInstrumentId(): string { return this._instrumentId; }
  setInstrumentId(id: string): void { this._instrumentId = id; }

  addColumn(col: Column): void {
    this._columns.push(col);
    for (const note of this._trackerNotes) {
      note.addColumn();
    }
  }

  removeColumn(col: Column): void {
    const index = this._columns.indexOf(col);
    if (index < 0) return;

    for (const note of this._trackerNotes) {
      note.removeColumn(index);
    }
    this._columns.splice(index, 1);
  }

  generateNotes(stepsPerBeat: number): NoteList {
    const retVal = new NoteList();
    let instrId = this._instrumentId;

    if (isNaN(parseFloat(instrId))) {
      instrId = `"${instrId}"`;
    }

    let noteTemplate = replaceAll(this._noteTemplate, '<INSTR_ID>', instrId);
    noteTemplate = replaceAll(noteTemplate, '<INSTR_NAME>', this._instrumentId);

    for (let i = 0; i < this._trackerNotes.length; i++) {
      const trNote = this._trackerNotes[i];

      if (trNote.isActive() && !trNote.isOff()) {
        let noteStr = noteTemplate;
        let dur = 1;

        for (let j = i + 1; j < this._trackerNotes.length; j++) {
          const temp = this._trackerNotes[j];
          if (temp.isActive() || temp.isOff()) {
            break;
          }
          dur++;
        }

        const noteStart = i / stepsPerBeat;
        const noteDur = dur / stepsPerBeat;
        const durStr = trNote.isTied() ? `-${noteDur}` : noteDur.toString();

        noteStr = replaceAll(noteStr, '<START>', noteStart.toString());
        noteStr = replaceAll(noteStr, '<DUR>', durStr);

        for (let j = 1; j < this.getNumColumns(); j++) {
          const col = this.getColumn(j);
          if (!col) continue;

          const colPlaceholder = `<${col.getName()}>`;
          let newValue = trNote.getValue(j);

          if (newValue.trim().length === 0) {
            newValue = col.getDefaultValue();
          }

          if (col.getType() === Column.TYPE_BLUE_PCH && col.isOutputFrequency()) {
            const parts = newValue.split('.');
            if (parts.length === 2) {
              const octave = parseInt(parts[0], 10);
              const scaleDegree = parseInt(parts[1], 10);
              const freq = col.getScale().getFrequency(octave, scaleDegree);
              newValue = freq.toString();
            }
          }

          noteStr = replaceAll(noteStr, colPlaceholder, newValue);
        }

        const note = Note.createNoteFromText(noteStr);
        if (note) {
          retVal.add(note);
        }
      }
    }

    return retVal;
  }

  saveAsXML(): Element {
    const retVal = new Element('track');
    retVal.addElement('name').setText(this._name);
    retVal.addElement('noteTemplate').setText(this._noteTemplate);
    retVal.addElement('instrumentId').setText(this._instrumentId);

    const colElement = retVal.addElement('columns');
    for (const col of this._columns) {
      colElement.addElement(col.saveAsXML());
    }

    const trNotesElement = retVal.addElement('trackerNotes');
    for (const note of this._trackerNotes) {
      trNotesElement.addElement(note.saveAsXML());
    }

    return retVal;
  }

  static loadFromXML(data: Element): Track {
    const retVal = new Track(false);
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      switch (nodeName) {
        case 'name':
          retVal._name = node.getTextString() ?? '';
          break;
        case 'noteTemplate':
          retVal._noteTemplate = node.getTextString() ?? '';
          break;
        case 'instrumentId':
          retVal._instrumentId = node.getTextString() ?? '';
          break;
        case 'columns': {
          const nodes2 = node.getElements();
          while (nodes2.hasMoreElements()) {
            retVal.addColumn(Column.loadFromXML(nodes2.next()));
          }
          break;
        }
        case 'trackerNotes': {
          const nodes2 = node.getElements();
          while (nodes2.hasMoreElements()) {
            retVal._trackerNotes.push(TrackerNote.loadFromXML(nodes2.next()));
          }
          break;
        }
      }
    }
    return retVal;
  }

  insertNote(start: number): void {
    this._trackerNotes.splice(start, 0, this.createNewNote());
    this._trackerNotes.pop();
  }

  removeNote(start: number): void {
    this._trackerNotes.splice(start, 1);
    this._trackerNotes.push(this.createNewNote());
  }

  clearNotes(): void {
    for (const note of this._trackerNotes) {
      note.clear();
    }
  }
}
