import { describe, expect, it } from 'vitest';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefLoadMap } from '../serialization/obj-ref-map';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { Note } from './note';
import { NoteList } from './note-list';
import { TimeBehavior } from './time-behavior';
import { applyTimeBehavior } from '../utilities/score';
import { Table, TablePoint } from './jmask-support';
import { PianoRoll } from './piano-roll';
import { PianoNote } from './piano-roll/piano-note';
import { FieldDef } from './piano-roll/field-def';
import { FieldType } from './piano-roll/field-type';
import { SoundLayer } from './sound-layer';
import { ParameterIdList } from '../automation/parameter-id-list';
import {
  createNoteProcessorEntrySnapshot,
  reifyProcessorFromSnapshot,
} from '../note-processors/note-processor-snapshot';
import { AddProcessor } from '../note-processors/add-processor';
import { TuningProcessor } from '../note-processors/tuning-processor';

function naiveTableGetValue(table: Table, time: number): number {
  const sorted = [...table.points].sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return 0.0;
  let a = sorted[0]!;
  if (sorted.length === 1 || time <= 0.0) return a.value;
  let b: TablePoint | null = null;
  for (let i = 1; i < sorted.length; i += 1) {
    b = sorted[i]!;
    if (b.time === time) {
      while (i < sorted.length && sorted[i]!.time === time) {
        b = sorted[i]!;
        i += 1;
      }
      return b.value;
    }
    if (b.time < time) a = b;
    else break;
  }
  if (b === a || b === null) return a.value;
  const r = (time - a.time) / (b.time - a.time);
  if (table.interpolationType === Table.OFF) return a.value;
  if (table.interpolationType === Table.COS) {
    const cx = Math.cos(Math.PI * r + Math.PI) / 2.0 + 0.5;
    return a.value + cx * (b.value - a.value);
  }
  const ex = table.interpolation;
  if (ex === 0.0) return a.value + r * (b.value - a.value);
  if (ex > 0.0 && b.value >= a.value) return a.value + Math.pow(r, ex + 1.0) * (b.value - a.value);
  if (ex > 0.0 && b.value < a.value)
    return b.value + Math.pow(1.0 - r, ex + 1.0) * (a.value - b.value);
  if (ex < 0.0 && b.value >= a.value)
    return b.value + Math.pow(1.0 - r, Math.abs(ex) + 1.0) * (a.value - b.value);
  return a.value + Math.pow(r, Math.abs(ex) + 1.0) * (b.value - a.value);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function naiveTableGetphs(table: Table, xt: number): number {
  const integrate = (x1: number, xe: number, y1: number, y2: number, pw2: number) =>
    x1 * y1 + (Math.pow(x1, 1.0 + pw2) * (y2 - y1)) / ((1.0 + pw2) * Math.pow(xe, pw2));
  const xtr = roundTo(xt, 10);
  const sorted = [...table.points].sort((a, b) => a.time - b.time);
  const size = sorted.length;
  if (size === 0) return 0.0;
  if (size === 1) return xtr * sorted[0]!.value;
  if (xtr <= sorted[0]!.time) {
    const y0 = sorted[0]!.value;
    return sorted[0]!.time * y0 - xtr * y0;
  }
  let index = 0;
  while (index < size && sorted[index]!.time < xtr) index += 1;
  let phsum = 0.0;
  if (table.interpolationType !== Table.OFF) {
    const pw2 = Math.pow(2, table.interpolation);
    for (let k = 0; k < index - 1; k += 1) {
      const p0 = sorted[k]!;
      const p1 = sorted[k + 1]!;
      const dx = p1.time - p0.time;
      phsum += integrate(dx, dx, p0.value, p1.value, pw2);
    }
    const last = sorted[size - 1]!;
    if (xtr >= last.time) {
      phsum += xtr * last.value - last.time * last.value;
    } else {
      const prev = sorted[index - 1]!;
      const curr = sorted[index]!;
      phsum += integrate(xtr - prev.time, curr.time - prev.time, prev.value, curr.value, pw2);
    }
    return phsum;
  }
  for (let k = 0; k < index - 1; k += 1) {
    const p0 = sorted[k]!;
    const p1 = sorted[k + 1]!;
    phsum += p1.time * p0.value - p0.time * p0.value;
  }
  const prev = sorted[index - 1]!;
  phsum += xtr * prev.value - prev.time * prev.value;
  return phsum;
}

function makeTablePoint(time: number, value: number): TablePoint {
  const pt = new TablePoint();
  pt.time = time;
  pt.value = value;
  return pt;
}

describe('Score generation performance parity', () => {
  it('ignores detached points after an equal replacement in the table array', () => {
    const table = new Table();
    const oldPoint = table.points[0]!;
    const originalValue = table.getValue(0);
    const originalPhase = table.getphs(0.25);
    table.points[0] = new TablePoint(oldPoint);
    oldPoint.value = originalValue + 1;
    expect(table.getValue(0)).toBe(originalValue);
    expect(table.getphs(0.25)).toBe(originalPhase);
    table.points[0]!.value = 0;
    expect(table.getValue(0)).toBe(0);
    table.points[0]!.value = -0;
    expect(table.getValue(0)).toBe(-0);
  });

  it('expands custom placeholders formed by earlier Piano Roll macros', () => {
    const roll = new PianoRoll();
    roll.setTimeBehavior(TimeBehavior.NONE);
    roll.setSubjectiveDuration(TimeDuration.beats(4));
    roll.setNoteTemplate('i 1 <START> <DUR> <<START>>');
    const field = new FieldDef();
    field.setFieldName('0.5');
    field.setMinValue(0);
    field.setMaxValue(10);
    field.setDefaultValue(7);
    roll.setFieldDefinitions([field]);
    const note = new PianoNote();
    note.start = 0.5;
    note.duration = 1;
    note.initFields([field]);
    roll.setNotes([note]);
    const generated = roll.generateForCSD(new TimeContext(), new CompileData(), 0, 4);
    expect(generated.getNote(0).getPField(4)).toBe('7');
  });

  it('matches linear Table.getValue and Table.getphs across unsorted points, duplicates, modes, and direct mutations', () => {
    for (const interpolationType of [Table.OFF, Table.ON, Table.COS]) {
      for (const interpolation of [0, 1.5, -1.25]) {
        const distinctTable = new Table(false);
        distinctTable.interpolationType = interpolationType;
        distinctTable.interpolation = interpolation;
        distinctTable.points = [
          makeTablePoint(0.6, 0.9),
          makeTablePoint(0.2, 0.3),
          makeTablePoint(1.0, 0.8),
          makeTablePoint(0.4, 0.5),
          makeTablePoint(0.05, 0.1),
        ];

        const times = [-0.25, 0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.85, 1.0, 1.5];
        for (const t of times) {
          expect(distinctTable.getValue(t)).toBe(naiveTableGetValue(distinctTable, t));
          expect(distinctTable.getphs(t)).toBe(naiveTableGetphs(distinctTable, t));
        }

        const phsBefore = times.map((t) => distinctTable.getphs(t));
        expect(times.map((t) => distinctTable.getphs(t))).toEqual(phsBefore);

        // Mutating point.time in place (e.g. Segment.initialize) must invalidate cache.
        for (const point of distinctTable.points) {
          point.time *= 3;
        }
        const scaledTimes = [-0.5, 0, 0.15, 0.6, 1.2, 1.8, 3.0, 4.0];
        for (const t of scaledTimes) {
          expect(distinctTable.getValue(t)).toBe(naiveTableGetValue(distinctTable, t));
          expect(distinctTable.getphs(t)).toBe(naiveTableGetphs(distinctTable, t));
        }
        expect(distinctTable.getphs(4.0)).not.toBe(phsBefore[9]);

        // Duplicate-time tables preserve exact lookup semantics in getValue.
        const dupTable = new Table(false);
        dupTable.interpolationType = interpolationType;
        dupTable.interpolation = interpolation;
        dupTable.points = [
          makeTablePoint(0.6, 0.9),
          makeTablePoint(0.2, 0.3),
          makeTablePoint(0.6, 0.4),
          makeTablePoint(1.0, 0.8),
          makeTablePoint(0.2, 0.7),
        ];
        for (const t of times) {
          expect(dupTable.getValue(t)).toBe(naiveTableGetValue(dupTable, t));
        }
      }
    }
  });

  it('applies REPEAT and REPEAT_CLASSIC directly without changing note times, truncation, or repeatDur<=0 behavior', () => {
    const buildList = () => {
      const nl = new NoteList();
      nl.add(Note.createNoteFromText('i1 1.5 1 440')!);
      nl.add(Note.createNoteFromText('i1 0 0.5 220')!);
      nl.add(Note.createNoteFromText('i2 0.75 0.5 330')!);
      return nl;
    };

    const repeatNotes = buildList();
    applyTimeBehavior(repeatNotes, TimeBehavior.REPEAT, 4.0, 1.25);
    expect(
      repeatNotes.map((n) => `${n.getPField(1)}@${n.getStartTime()}+${n.getSubjectiveDuration()}`),
    ).toEqual([
      '1@0+0.5',
      '2@0.75+0.5',
      '1@1.25+0.5',
      '2@2+0.5',
      '1@2.5+0.5',
      '2@3.25+0.5',
      '1@3.75+0.25',
    ]);

    const classicNotes = buildList();
    applyTimeBehavior(classicNotes, TimeBehavior.REPEAT_CLASSIC, 4.0, 1.25);
    expect(
      classicNotes.map((n) => `${n.getPField(1)}@${n.getStartTime()}+${n.getSubjectiveDuration()}`),
    ).toEqual([
      '1@0+0.5',
      '2@0.75+0.5',
      '1@1.5+1',
      '1@1.25+0.5',
      '2@2+0.5',
      '1@2.75+1',
      '1@2.5+0.5',
      '2@3.25+0.5',
      '1@4+1',
    ]);

    const untouched = buildList();
    const before = untouched.toScoreText();
    applyTimeBehavior(untouched, TimeBehavior.REPEAT, 4.0, -1, 0);
    expect(untouched.toScoreText()).toBe(before);
  });

  it('matches tokenized PianoRoll template expansion with composite, custom, and bracket fallback templates', () => {
    const roll = new PianoRoll();
    roll.setInstrumentId('lead synth');
    roll.setTimeBehavior(TimeBehavior.NONE);
    roll.setSubjectiveDuration(TimeDuration.beats(4));
    roll.setNoteTemplate('i <INSTR_ID> <START> <DUR> <FREQ> <STEP> <MISSING>');

    const stepDef = new FieldDef();
    stepDef.setFieldName('STEP');
    stepDef.setFieldType(FieldType.DISCRETE);
    stepDef.setMinValue(0);
    stepDef.setMaxValue(12);
    stepDef.setDefaultValue(3);
    roll.setFieldDefinitions([stepDef]);

    const n1 = new PianoNote();
    n1.start = 0.5;
    n1.duration = 0.75;
    n1.octave = 8;
    n1.scaleDegree = 0;
    n1.initFields([stepDef]);
    n1.getFields()[0]!.setValue(4.6);

    const n2 = new PianoNote();
    n2.start = 0.25;
    n2.duration = 0.5;
    n2.octave = 8;
    n2.scaleDegree = 2;
    n2.noteTemplate = 'i"<INSTR_NAME>" <START> -<DUR> [<FREQ> * 2] <STEP>';
    n2.initFields([stepDef]);
    n2.getFields()[0]!.setValue(2.1);

    roll.setNotes([n1, n2]);
    const generated = roll.generateForCSD(new TimeContext(), new CompileData(), 0, 4);
    expect(generated.length).toBe(2);
    expect(generated.getNote(0).getPField(1)).toBe('"lead synth"');
    expect(generated.getNote(0).isTiedNote()).toBe(true);
    expect(generated.getNote(0).getSubjectiveDuration()).toBe(0.5);
    expect(parseFloat(generated.getNote(0).getPField(4)!)).toBeCloseTo(
      roll.getScale().getFrequency(8, 2) * 2,
      5,
    );
    expect(generated.getNote(0).getPField(5)).toBe('2');

    expect(generated.getNote(1).getPField(1)).toBe('"lead synth"');
    expect(generated.getNote(1).getStartTime()).toBe(0.5);
    expect(generated.getNote(1).getPField(5)).toBe('5');
    expect(generated.getNote(1).getPField(6)).toBe('<MISSING>');
  });

  it('batch-loads SoundLayer automation parameterIds and reifies snapshots without XML round-trip drift', () => {
    const xml = `
      <soundLayer name="Test">
        <parameterId>zeta</parameterId>
        <parameterId>Alpha</parameterId>
        <parameterId>beta</parameterId>
      </soundLayer>
    `;
    const layer = SoundLayer.loadFromXML(Element.parse(xml), new ObjRefLoadMap());
    expect(layer.getAutomationParameters().getIds()).toEqual(['Alpha', 'beta', 'zeta']);
    expect(layer.getAutomationParameters().getSelectedIndex()).toBe(0);

    const list = new ParameterIdList();
    list.addParameterIds(['delta', 'alpha', 'delta']);
    expect(list.getIds()).toEqual(['alpha', 'delta']);

    const add = new AddProcessor();
    add.setPfield('5');
    add.setVal('12');
    const reifiedAdd = reifyProcessorFromSnapshot(
      createNoteProcessorEntrySnapshot(add),
    ) as AddProcessor;
    expect(reifiedAdd.getPfield()).toBe('5');
    expect(reifiedAdd.getVal()).toBe('12');

    const tuning = new TuningProcessor();
    tuning.setPfield('4');
    tuning.setBaseFrequency('220');
    tuning.setRatios([1, 1.5, 2]);
    const reifiedTuning = reifyProcessorFromSnapshot(
      createNoteProcessorEntrySnapshot(tuning),
    ) as TuningProcessor;
    expect(reifiedTuning.getBaseFrequency()).toBe('220');
    expect(reifiedTuning.getRatios()).toEqual([1, 1.5, 2]);
  });
});
