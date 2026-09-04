import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { TimeBehavior } from './time-behavior';
import { JMask } from './j-mask';
import { loadFieldFromSnapshot } from '../index';
import {
  Constant,
  JavaRandom,
  Linear,
  Parameter,
  Probability,
  Random,
  Table,
} from './jmask-support';

function snapshotJMaskValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => snapshotJMaskValue(entry));
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value;
  }
  if (valueType !== 'object') {
    return value;
  }

  const snapshot: Record<string, unknown> = {};
  const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
  if (ctorName && ctorName !== 'Object') {
    snapshot.kind = ctorName;
  }

  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof childValue === 'function') {
      continue;
    }
    snapshot[key] = snapshotJMaskValue(childValue);
  }

  return snapshot;
}

function buildSeededJMask(seed: number): JMask {
  const jmask = new JMask();
  jmask.setStartTime(TimePosition.beats(1.5));
  jmask.setSubjectiveDuration(TimeDuration.beats(4));
  jmask.setTimeBehavior(TimeBehavior.NONE);
  jmask.setSeedUsed(true);
  jmask.setSeed(seed);

  const field = jmask.getField();
  const instrument = field.getParameter(0);
  const step = field.getParameter(1);
  const duration = field.getParameter(2);

  instrument.setGenerator(new Constant());
  (instrument.getGenerator() as Constant).value = 1;

  step.setGenerator(new Random());
  const stepGenerator = step.getGenerator() as Random;
  stepGenerator.min = 0.75;
  stepGenerator.max = 1.25;

  duration.setGenerator(new Constant());
  (duration.getGenerator() as Constant).value = 0.5;

  return jmask;
}

describe('JMask support model', () => {
  it('generates repeatable notes for the same seed and survives XML round-trip', () => {
    const jmask = buildSeededJMask(1234);
    const context = new TimeContext();

    const notesBefore = jmask.generateNotes(context).toScoreText();
    const saved = jmask.saveAsXML().toXml();
    const loaded = JMask.loadFromXML(Element.parse(saved));
    const notesAfter = loaded.generateNotes(context).toScoreText();

    expect(notesBefore).toBe(notesAfter);
    expect(saved).toContain('<field>');
    expect(saved).toContain('<generator type="blue.soundObject.jmask.Random">');
    expect(saved).toContain('<seedUsed>true</seedUsed>');
    expect(saved).toContain('<seed>1234</seed>');
  });

  it('changes the generated output when the seed changes', () => {
    const context = new TimeContext();
    const first = buildSeededJMask(1234).generateNotes(context).toScoreText();
    const second = buildSeededJMask(9876).generateNotes(context).toScoreText();

    expect(first).not.toBe(second);
  });

  it('creates the expected helper modules for supported generators', () => {
    const constantParameter = Parameter.create(new Constant());
    expect(constantParameter.getAccumulator()).not.toBeNull();
    expect(constantParameter.getMask()).toBeNull();
    expect(constantParameter.getQuantizer()).toBeNull();

    const probabilityParameter = Parameter.create(new Probability());
    expect(probabilityParameter.getAccumulator()).not.toBeNull();
    expect(probabilityParameter.getMask()).not.toBeNull();
    expect(probabilityParameter.getQuantizer()).not.toBeNull();
  });

  it('round-trips table and probability subtype state', () => {
    const table = new Table();
    table.getPoint(0).setValue(0);
    table.getPoint(1).setValue(1);

    const tableXml = table.saveAsXML().toXml();
    const loadedTable = Table.loadFromXML(Element.parse(tableXml));
    expect(loadedTable.getValue(0.5)).toBeCloseTo(0.5, 6);

    const probability = new Probability();
    probability.setSelectedIndex(1);
    const linear = probability.getGenerators()[1] as Linear;
    linear.direction = Linear.INCREASING;

    const probabilityXml = probability.saveAsXML().toXml();
    const loadedProbability = Probability.loadFromXML(Element.parse(probabilityXml));
    expect(loadedProbability.getSelectedIndex()).toBe(1);
    expect((loadedProbability.getSelectedProbabilityGenerator() as Linear).direction).toBe(
      Linear.INCREASING,
    );
  });

  it('rebuilds a field snapshot into live JMask generators', () => {
    const context = new TimeContext();
    const original = buildSeededJMask(1234);
    const fieldSnapshot = snapshotJMaskValue(original.getField()) as Record<string, unknown>;

    const restored = buildSeededJMask(1234);
    restored.setField(loadFieldFromSnapshot(fieldSnapshot));

    expect(restored.getField().getParameter(0).getGenerator()).toBeInstanceOf(Constant);
    expect(restored.getField().getParameter(1).getGenerator()).toBeInstanceOf(Random);
    expect(restored.generateNotes(context).toScoreText()).toBe(
      original.generateNotes(context).toScoreText(),
    );
  });

  it('generates deterministic JavaRandom sequences', () => {
    const first = new JavaRandom(1234);
    const second = new JavaRandom(1234);
    expect(first.nextDouble()).toBeCloseTo(second.nextDouble(), 12);
    expect(first.nextDouble()).toBeCloseTo(second.nextDouble(), 12);
  });
});
