import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import {
  Accumulator,
  Beta,
  Cauchy,
  Constant,
  Exponential,
  Field,
  Gaussian,
  ItemList,
  JavaRandom,
  Linear,
  Mask,
  Oscillator,
  Parameter,
  Probability,
  Quantizer,
  Random,
  Segment,
  Table,
  TablePoint,
  Triangle,
  Uniform,
  Weibull,
  loadFieldFromSnapshot,
} from './jmask-support';
import { JMask } from './j-mask';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';

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
    if (typeof childValue === 'function') continue;
    snapshot[key] = snapshotJMaskValue(childValue);
  }
  return snapshot;
}

function xmlRoundTrip<T>(
  obj: T,
  save: (o: T) => Element,
  load: (e: Element) => T,
  assertExtra?: (restored: T) => void,
): void {
  const xml = save(obj).toXml();
  const restored = load(Element.parse(xml));
  const xmlAgain = save(restored).toXml();
  expect(xmlAgain).toBe(xml);
  if (assertExtra) assertExtra(restored);
}

describe('JMask XML save/load round-trips', () => {
  describe('TablePoint', () => {
    it('round-trips default point', () => {
      const point = new TablePoint();
      xmlRoundTrip(
        point,
        (p) => p.saveAsXML(),
        TablePoint.loadFromXML,
        (r) => {
          expect(r.time).toBe(0);
          expect(r.value).toBeCloseTo(0.5, 10);
        },
      );
    });

    it('round-trips custom point', () => {
      const point = new TablePoint();
      point.time = 0.75;
      point.value = 0.25;
      xmlRoundTrip(
        point,
        (p) => p.saveAsXML(),
        TablePoint.loadFromXML,
        (r) => {
          expect(r.time).toBeCloseTo(0.75, 10);
          expect(r.value).toBeCloseTo(0.25, 10);
        },
      );
    });
  });

  describe('Table', () => {
    it('round-trips default table with two points', () => {
      const table = new Table();
      xmlRoundTrip(
        table,
        (t) => t.saveAsXML(),
        Table.loadFromXML,
        (r) => {
          expect(r.points.length).toBe(2);
          expect(r.points[0]).toBeInstanceOf(TablePoint);
          expect(typeof r.points[0]!.saveAsXML).toBe('function');
          expect(r.min).toBe(0);
          expect(r.max).toBe(1);
        },
      );
    });

    it('round-trips table with extra points and cosine interpolation', () => {
      const table = new Table();
      table.interpolationType = Table.COS;
      table.min = -1;
      table.max = 2;
      table.interpolation = 0.5;
      const mid = new TablePoint();
      mid.time = 0.5;
      mid.value = 1.5;
      table.addPoint(1, mid);
      xmlRoundTrip(
        table,
        (t) => t.saveAsXML(),
        Table.loadFromXML,
        (r) => {
          expect(r.points.length).toBe(3);
          expect(r.interpolationType).toBe(Table.COS);
          expect(r.min).toBe(-1);
          expect(r.max).toBe(2);
          expect(r.interpolation).toBeCloseTo(0.5, 10);
          expect(r.points[1]).toBeInstanceOf(TablePoint);
          expect(r.points[1]!.time).toBeCloseTo(0.5, 10);
          expect(r.points[1]!.value).toBeCloseTo(1.5, 10);
        },
      );
    });

    it('snapshot round-trip produces TablePoint instances with saveAsXML', () => {
      const table = new Table();
      table.getPoint(0).setValue(0.1);
      table.getPoint(1).setValue(0.9);
      const mid = new TablePoint();
      mid.time = 0.5;
      mid.value = 0.5;
      table.addPoint(1, mid);

      const snap = snapshotJMaskValue(table) as Record<string, unknown>;
      expect(snap.kind).toBe('Table');
      const pointsSnap = snap.points as Array<Record<string, unknown>>;
      for (const pt of pointsSnap) {
        expect(pt.kind).toBe('TablePoint');
      }

      const field = new Field(false);
      const param = Parameter.create(new Constant());
      (param.getGenerator() as Constant).value = 1;
      const seg = new Segment();
      field.parameters.push(param);

      const restored = loadFieldFromSnapshot(snapshotJMaskValue(field) as Record<string, unknown>);
      const restoredGen = restored.getParameter(0).getGenerator() as Constant;
      expect(restoredGen).toBeInstanceOf(Constant);
      expect(typeof restoredGen.saveAsXML).toBe('function');
    });
  });

  describe('Constant generator', () => {
    it('round-trips via XML', () => {
      const c = new Constant();
      c.value = 2.5;
      xmlRoundTrip(
        c,
        (o) => o.saveAsXML(),
        Constant.loadFromXML,
        (r) => {
          expect(r.value).toBeCloseTo(2.5, 10);
        },
      );
    });

    it('round-trips via snapshot and loadFieldFromSnapshot', () => {
      const field = new Field(false);
      const param = Parameter.create(new Constant());
      (param.getGenerator() as Constant).value = 42;
      param.name = 'test-const';
      param.visible = false;
      field.parameters.push(param);

      const snap = snapshotJMaskValue(field);
      const restored = loadFieldFromSnapshot(snap as Record<string, unknown>);
      const gen = restored.getParameter(0).getGenerator() as Constant;
      expect(gen).toBeInstanceOf(Constant);
      expect(gen.value).toBeCloseTo(42, 10);
      expect(typeof gen.saveAsXML).toBe('function');
    });
  });

  describe('Random generator', () => {
    it('round-trips via XML', () => {
      const r = new Random();
      r.min = 0.3;
      r.max = 0.7;
      xmlRoundTrip(
        r,
        (o) => o.saveAsXML(),
        Random.loadFromXML,
        (restored) => {
          expect(restored.min).toBeCloseTo(0.3, 10);
          expect(restored.max).toBeCloseTo(0.7, 10);
        },
      );
    });
  });

  describe('Oscillator generator', () => {
    it('round-trips via XML with all fields', () => {
      const osc = new Oscillator();
      osc.oscillatorType = Oscillator.SAW_UP;
      osc.phaseInit = 0.25;
      osc.frequency = 2.0;
      osc.exponent = 1.5;
      osc.freqTableEnabled = true;
      osc.freqTable.getPoint(0).setValue(0.5);
      osc.freqTable.getPoint(1).setValue(1.5);
      xmlRoundTrip(
        osc,
        (o) => o.saveAsXML(),
        Oscillator.loadFromXML,
        (r) => {
          expect(r.oscillatorType).toBe(Oscillator.SAW_UP);
          expect(r.phaseInit).toBeCloseTo(0.25, 10);
          expect(r.frequency).toBeCloseTo(2.0, 10);
          expect(r.exponent).toBeCloseTo(1.5, 10);
          expect(r.freqTableEnabled).toBe(true);
          expect(r.freqTable.points[0]).toBeInstanceOf(TablePoint);
          expect(typeof r.freqTable.points[0]!.saveAsXML).toBe('function');
        },
      );
    });
  });

  describe('Segment generator', () => {
    it('round-trips via XML with table', () => {
      const seg = new Segment();
      const p = new TablePoint();
      p.time = 0.33;
      p.value = 0.77;
      seg.table.addPoint(1, p);
      xmlRoundTrip(
        seg,
        (o) => o.saveAsXML(),
        Segment.loadFromXML,
        (r) => {
          expect(r.table.points.length).toBe(3);
          expect(r.table.points[1]).toBeInstanceOf(TablePoint);
          expect(r.table.points[1]!.time).toBeCloseTo(0.33, 10);
          expect(r.table.points[1]!.value).toBeCloseTo(0.77, 10);
        },
      );
    });
  });

  describe('ItemList generator', () => {
    it('round-trips via XML with items', () => {
      const il = new ItemList();
      il.listType = ItemList.HEAP;
      il.listItems = [1.1, 2.2, 3.3];
      il.direction = 0;
      xmlRoundTrip(
        il,
        (o) => o.saveAsXML(),
        ItemList.loadFromXML,
        (r) => {
          expect(r.listType).toBe(ItemList.HEAP);
          expect(r.listItems).toEqual([1.1, 2.2, 3.3]);
        },
      );
    });

    it('round-trips via XML with Swing mode', () => {
      const il = new ItemList();
      il.listType = ItemList.SWING;
      il.listItems = [10, 20, 30];
      xmlRoundTrip(
        il,
        (o) => o.saveAsXML(),
        ItemList.loadFromXML,
        (r) => {
          expect(r.listType).toBe(ItemList.SWING);
        },
      );
    });
  });

  describe('Mask modifier', () => {
    it('round-trips via XML with tables enabled', () => {
      const mask = new Mask();
      mask.enabled = true;
      mask.mapValue = 0.5;
      mask.high = 0.9;
      mask.low = 0.1;
      mask.highTableEnabled = true;
      mask.lowTableEnabled = true;
      mask.highTable.getPoint(0).setValue(0.8);
      mask.lowTable.getPoint(1).setValue(0.2);
      xmlRoundTrip(
        mask,
        (o) => o.saveAsXML(),
        Mask.loadFromXML,
        (r) => {
          expect(r.enabled).toBe(true);
          expect(r.mapValue).toBeCloseTo(0.5, 10);
          expect(r.highTableEnabled).toBe(true);
          expect(r.lowTableEnabled).toBe(true);
          expect(r.highTable.points[0]).toBeInstanceOf(TablePoint);
          expect(typeof r.highTable.points[0]!.saveAsXML).toBe('function');
          expect(r.lowTable.points[1]).toBeInstanceOf(TablePoint);
        },
      );
    });
  });

  describe('Quantizer modifier', () => {
    it('round-trips via XML with table fields', () => {
      const q = new Quantizer();
      q.enabled = true;
      q.gridSize = 0.25;
      q.strength = 0.75;
      q.offset = 0.1;
      q.gridSizeTableEnabled = true;
      q.strengthTableEnabled = true;
      q.offsetTableEnabled = true;
      xmlRoundTrip(
        q,
        (o) => o.saveAsXML(),
        Quantizer.loadFromXML,
        (r) => {
          expect(r.enabled).toBe(true);
          expect(r.gridSize).toBeCloseTo(0.25, 10);
          expect(r.strength).toBeCloseTo(0.75, 10);
          expect(r.offset).toBeCloseTo(0.1, 10);
          expect(r.gridSizeTableEnabled).toBe(true);
          expect(r.gridSizeTable.points[0]).toBeInstanceOf(TablePoint);
          expect(typeof r.gridSizeTable.points[0]!.saveAsXML).toBe('function');
        },
      );
    });
  });

  describe('Accumulator modifier', () => {
    it('round-trips via XML with all fields', () => {
      const acc = new Accumulator();
      acc.enabled = true;
      acc.mode = Accumulator.MIRROR;
      acc.low = -1;
      acc.high = 2;
      acc.initialValue = 0.5;
      acc.highTableEnabled = true;
      acc.lowTableEnabled = true;
      xmlRoundTrip(
        acc,
        (o) => o.saveAsXML(),
        Accumulator.loadFromXML,
        (r) => {
          expect(r.enabled).toBe(true);
          expect(r.mode).toBe(Accumulator.MIRROR);
          expect(r.low).toBeCloseTo(-1, 10);
          expect(r.high).toBeCloseTo(2, 10);
          expect(r.initialValue).toBeCloseTo(0.5, 10);
          expect(r.highTable.points[0]).toBeInstanceOf(TablePoint);
          expect(typeof r.highTable.points[0]!.saveAsXML).toBe('function');
        },
      );
    });
  });

  describe('Probability sub-generators', () => {
    it('round-trips Uniform', () => {
      xmlRoundTrip(new Uniform(), (o) => o.saveAsXML(), Uniform.loadFromXML);
    });

    it('round-trips Triangle', () => {
      xmlRoundTrip(new Triangle(), (o) => o.saveAsXML(), Triangle.loadFromXML);
    });

    it('round-trips Linear with direction', () => {
      const l = new Linear();
      l.direction = Linear.DECREASING;
      xmlRoundTrip(
        l,
        (o) => o.saveAsXML(),
        Linear.loadFromXML,
        (r) => {
          expect(r.direction).toBe(Linear.DECREASING);
        },
      );
    });

    it('round-trips Exponential with table', () => {
      const e = new Exponential();
      e.direction = Linear.INCREASING;
      e.lambda = 0.7;
      e.lambdaTableEnabled = true;
      e.lambdaTable.getPoint(0).setValue(0.3);
      xmlRoundTrip(
        e,
        (o) => o.saveAsXML(),
        Exponential.loadFromXML,
        (r) => {
          expect(r.lambda).toBeCloseTo(0.7, 10);
          expect(r.lambdaTableEnabled).toBe(true);
          expect(r.lambdaTable.points[0]).toBeInstanceOf(TablePoint);
        },
      );
    });

    it('round-trips Gaussian with sigma and mu tables', () => {
      const g = new Gaussian();
      g.sigma = 0.2;
      g.mu = 0.6;
      g.sigmaTableEnabled = true;
      g.muTableEnabled = true;
      xmlRoundTrip(
        g,
        (o) => o.saveAsXML(),
        Gaussian.loadFromXML,
        (r) => {
          expect(r.sigma).toBeCloseTo(0.2, 10);
          expect(r.mu).toBeCloseTo(0.6, 10);
          expect(r.sigmaTableEnabled).toBe(true);
          expect(r.muTableEnabled).toBe(true);
          expect(r.sigmaTable.points[0]).toBeInstanceOf(TablePoint);
          expect(r.muTable.points[0]).toBeInstanceOf(TablePoint);
        },
      );
    });

    it('round-trips Cauchy with alpha and mu tables', () => {
      const c = new Cauchy();
      c.alpha = 0.15;
      c.mu = 0.55;
      c.alphaTableEnabled = true;
      c.muTableEnabled = true;
      xmlRoundTrip(
        c,
        (o) => o.saveAsXML(),
        Cauchy.loadFromXML,
        (r) => {
          expect(r.alphaTable.points[0]).toBeInstanceOf(TablePoint);
          expect(r.muTable.points[0]).toBeInstanceOf(TablePoint);
        },
      );
    });

    it('round-trips Beta with a and b tables', () => {
      const b = new Beta();
      b.a = 0.2;
      b.b = 0.3;
      b.aTableEnabled = true;
      b.bTableEnabled = true;
      xmlRoundTrip(
        b,
        (o) => o.saveAsXML(),
        Beta.loadFromXML,
        (r) => {
          expect(r.aTable.points[0]).toBeInstanceOf(TablePoint);
          expect(r.bTable.points[0]).toBeInstanceOf(TablePoint);
        },
      );
    });

    it('round-trips Weibull with s and t tables', () => {
      const w = new Weibull();
      w.s = 0.6;
      w.t = 2.5;
      w.sTableEnabled = true;
      w.tTableEnabled = true;
      xmlRoundTrip(
        w,
        (o) => o.saveAsXML(),
        Weibull.loadFromXML,
        (r) => {
          expect(r.sTable.points[0]).toBeInstanceOf(TablePoint);
          expect(r.tTable.points[0]).toBeInstanceOf(TablePoint);
        },
      );
    });
  });

  describe('Probability container', () => {
    it('round-trips with selected index', () => {
      const prob = new Probability();
      prob.setSelectedIndex(3);
      xmlRoundTrip(
        prob,
        (o) => o.saveAsXML(),
        Probability.loadFromXML,
        (r) => {
          expect(r.getSelectedIndex()).toBe(3);
          expect(r.getGenerators().length).toBe(8);
          expect(r.getGenerators()[3]).toBeInstanceOf(Exponential);
        },
      );
    });
  });

  describe('Parameter', () => {
    it('round-trips with generator, mask, quantizer, accumulator', () => {
      const param = Parameter.create(new Oscillator());
      const mask = param.getMask()!;
      mask.enabled = true;
      mask.high = 0.8;
      const quant = param.getQuantizer()!;
      quant.enabled = true;
      quant.gridSize = 0.5;
      const acc = param.getAccumulator()!;
      acc.enabled = true;
      acc.mode = Accumulator.WRAP;
      param.name = 'test-param';
      param.visible = false;

      xmlRoundTrip(
        param,
        (o) => o.saveAsXML(),
        Parameter.loadFromXML,
        (r) => {
          expect(r.name).toBe('test-param');
          expect(r.visible).toBe(false);
          expect(r.getGenerator()).toBeInstanceOf(Oscillator);
          expect(r.getMask()).not.toBeNull();
          expect(r.getMask()!.enabled).toBe(true);
          expect(r.getMask()!.high).toBeCloseTo(0.8, 10);
          expect(r.getMask()!.highTable.points[0]).toBeInstanceOf(TablePoint);
          expect(r.getQuantizer()).not.toBeNull();
          expect(r.getQuantizer()!.enabled).toBe(true);
          expect(r.getAccumulator()).not.toBeNull();
          expect(r.getAccumulator()!.mode).toBe(Accumulator.WRAP);
        },
      );
    });
  });

  describe('Field', () => {
    it('round-trips default field with 3 parameters', () => {
      const field = new Field();
      xmlRoundTrip(
        field,
        (o) => o.saveAsXML(),
        Field.loadFromXML,
        (r) => {
          expect(r.parameters.length).toBe(3);
          expect(r.parameters[0]!.name).toBe('Instrument ID');
          expect(r.parameters[1]!.name).toBe('Start');
          expect(r.parameters[2]!.name).toBe('Duration');
          for (const param of r.parameters) {
            expect(param).toBeInstanceOf(Parameter);
            const gen = param.getGenerator();
            expect(gen).toBeInstanceOf(Constant);
            expect(typeof gen!.saveAsXML).toBe('function');
          }
        },
      );
    });

    it('round-trips field with mixed generator types', () => {
      const field = new Field(false);
      const p1 = Parameter.create(new Constant());
      p1.name = 'p1';
      (p1.getGenerator() as Constant).value = 1;

      const p2 = Parameter.create(new Random());
      p2.name = 'p2';
      (p2.getGenerator() as Random).min = 0.5;
      (p2.getGenerator() as Random).max = 1.5;

      const p3 = Parameter.create(new Segment());
      p3.name = 'p3';
      const segTable = (p3.getGenerator() as Segment).table;
      segTable.getPoint(0).setValue(0);
      segTable.getPoint(1).setValue(1);

      const p4 = Parameter.create(new Probability());
      p4.name = 'p4';
      (p4.getGenerator() as Probability).setSelectedIndex(2);

      field.parameters.push(p1, p2, p3, p4);

      xmlRoundTrip(
        field,
        (o) => o.saveAsXML(),
        Field.loadFromXML,
        (r) => {
          expect(r.parameters.length).toBe(4);
          expect(r.parameters[0]!.getGenerator()).toBeInstanceOf(Constant);
          expect(r.parameters[1]!.getGenerator()).toBeInstanceOf(Random);
          expect(r.parameters[2]!.getGenerator()).toBeInstanceOf(Segment);
          expect(r.parameters[3]!.getGenerator()).toBeInstanceOf(Probability);

          const seg = r.parameters[2]!.getGenerator() as Segment;
          expect(seg.table.points[0]).toBeInstanceOf(TablePoint);
          expect(typeof seg.table.points[0]!.saveAsXML).toBe('function');
        },
      );
    });
  });

  describe('Full JMask save/load', () => {
    it('round-trips JMask with all 6 generator types via XML', () => {
      const jmask = new JMask();
      jmask.setStartTime(TimePosition.beats(0));
      jmask.setSubjectiveDuration(TimeDuration.beats(2));
      jmask.setSeedUsed(true);
      jmask.setSeed(42);

      const field = jmask.getField();
      field.parameters = [];

      const pConst = Parameter.create(new Constant());
      pConst.name = 'p1-const';
      (pConst.getGenerator() as Constant).value = 1;
      field.parameters.push(pConst);

      const pRandom = Parameter.create(new Random());
      pRandom.name = 'p2-random';
      (pRandom.getGenerator() as Random).min = 0.5;
      (pRandom.getGenerator() as Random).max = 1.0;
      field.parameters.push(pRandom);

      const pOsc = Parameter.create(new Oscillator());
      pOsc.name = 'p3-osc';
      const osc = pOsc.getGenerator() as Oscillator;
      osc.oscillatorType = Oscillator.SINE;
      osc.frequency = 2;
      osc.freqTableEnabled = true;
      const freqMid = new TablePoint();
      freqMid.time = 0.5;
      freqMid.value = 1.5;
      osc.freqTable.addPoint(1, freqMid);
      const mask = pOsc.getMask()!;
      mask.enabled = true;
      mask.highTableEnabled = true;
      field.parameters.push(pOsc);

      const pSeg = Parameter.create(new Segment());
      pSeg.name = 'p4-seg';
      (pSeg.getGenerator() as Segment).table.getPoint(0).setValue(0.2);
      const q = pSeg.getQuantizer()!;
      q.enabled = true;
      q.gridSize = 0.25;
      q.gridSizeTableEnabled = true;
      field.parameters.push(pSeg);

      const pItemList = Parameter.create(new ItemList());
      pItemList.name = 'p5-itemlist';
      const il = pItemList.getGenerator() as ItemList;
      il.listType = ItemList.CYCLE;
      il.listItems = [1, 2, 3, 4, 5];
      const acc = pItemList.getAccumulator()!;
      acc.enabled = true;
      acc.mode = Accumulator.LIMIT;
      field.parameters.push(pItemList);

      const pProb = Parameter.create(new Probability());
      pProb.name = 'p6-prob';
      (pProb.getGenerator() as Probability).setSelectedIndex(4);
      field.parameters.push(pProb);

      const xml = jmask.saveAsXML().toXml();
      const loaded = JMask.loadFromXML(Element.parse(xml));
      const xmlAgain = loaded.saveAsXML().toXml();

      expect(xmlAgain).toBe(xml);
      expect(loaded.isSeedUsed()).toBe(true);
      expect(loaded.getSeed()).toBe(42);

      const lf = loaded.getField();
      expect(lf.parameters.length).toBe(6);

      expect(lf.parameters[0]!.getGenerator()).toBeInstanceOf(Constant);
      expect((lf.parameters[0]!.getGenerator() as Constant).value).toBeCloseTo(1, 10);

      expect(lf.parameters[1]!.getGenerator()).toBeInstanceOf(Random);

      const loadedOsc = lf.parameters[2]!.getGenerator() as Oscillator;
      expect(loadedOsc).toBeInstanceOf(Oscillator);
      expect(loadedOsc.freqTable.points.length).toBe(3);
      expect(loadedOsc.freqTable.points[1]).toBeInstanceOf(TablePoint);
      expect(typeof loadedOsc.freqTable.points[1]!.saveAsXML).toBe('function');
      expect(lf.parameters[2]!.getMask()!.enabled).toBe(true);
      expect(lf.parameters[2]!.getMask()!.highTable.points[0]).toBeInstanceOf(TablePoint);

      expect(lf.parameters[3]!.getGenerator()).toBeInstanceOf(Segment);
      expect(lf.parameters[3]!.getQuantizer()!.enabled).toBe(true);
      expect(lf.parameters[3]!.getQuantizer()!.gridSizeTable.points[0]).toBeInstanceOf(TablePoint);

      expect(lf.parameters[4]!.getGenerator()).toBeInstanceOf(ItemList);
      expect(lf.parameters[4]!.getAccumulator()!.enabled).toBe(true);

      expect(lf.parameters[5]!.getGenerator()).toBeInstanceOf(Probability);
    });

    it('round-trips JMask via snapshot → loadFieldFromSnapshot and produces identical XML', () => {
      const jmask = new JMask();
      jmask.setSubjectiveDuration(TimeDuration.beats(4));
      jmask.setSeedUsed(true);
      jmask.setSeed(99);

      const field = jmask.getField();
      const osc = new Oscillator();
      osc.freqTableEnabled = true;
      const freqMid = new TablePoint();
      freqMid.time = 0.5;
      freqMid.value = 2;
      osc.freqTable.addPoint(1, freqMid);
      field.getParameter(0).setGenerator(osc);

      field.getParameter(1).setGenerator(new Random());
      (field.getParameter(1).getGenerator() as Random).min = 0.25;
      (field.getParameter(1).getGenerator() as Random).max = 0.75;

      field.getParameter(2).setGenerator(new Constant());
      (field.getParameter(2).getGenerator() as Constant).value = -1;

      const originalXml = jmask.saveAsXML().toXml();

      const fieldSnapshot = snapshotJMaskValue(field) as Record<string, unknown>;
      const restoredField = loadFieldFromSnapshot(fieldSnapshot);

      for (const param of restoredField.parameters) {
        const gen = param.getGenerator();
        expect(gen).not.toBeNull();
        expect(typeof gen!.saveAsXML).toBe('function');

        if (param.getMask()) {
          expect(typeof param.getMask()!.saveAsXML).toBe('function');
          for (const pt of param.getMask()!.highTable.points) {
            expect(pt).toBeInstanceOf(TablePoint);
            expect(typeof pt.saveAsXML).toBe('function');
          }
          for (const pt of param.getMask()!.lowTable.points) {
            expect(pt).toBeInstanceOf(TablePoint);
            expect(typeof pt.saveAsXML).toBe('function');
          }
        }
        if (param.getQuantizer()) {
          expect(typeof param.getQuantizer()!.saveAsXML).toBe('function');
          for (const pt of param.getQuantizer()!.gridSizeTable.points) {
            expect(pt).toBeInstanceOf(TablePoint);
            expect(typeof pt.saveAsXML).toBe('function');
          }
        }
        if (param.getAccumulator()) {
          expect(typeof param.getAccumulator()!.saveAsXML).toBe('function');
          for (const pt of param.getAccumulator()!.highTable.points) {
            expect(pt).toBeInstanceOf(TablePoint);
            expect(typeof pt.saveAsXML).toBe('function');
          }
        }
      }

      jmask.setField(restoredField);
      const restoredXml = jmask.saveAsXML().toXml();
      expect(restoredXml).toBe(originalXml);
    });

    it('snapshot round-trip preserves all TablePoint instances after adding points (regression)', () => {
      const jmask = new JMask();
      jmask.setSubjectiveDuration(TimeDuration.beats(2));
      jmask.setSeedUsed(true);
      jmask.setSeed(42);

      const field = jmask.getField();
      const seg = new Segment();
      for (const [t, v] of [
        [0.25, 0.4],
        [0.5, 0.6],
        [0.75, 0.3],
      ]) {
        const p = new TablePoint();
        p.time = t;
        p.value = v;
        seg.table.addPoint(seg.table.points.length - 1, p);
      }
      field.getParameter(0).setGenerator(seg);

      const originalXml = jmask.saveAsXML().toXml();
      const snap = snapshotJMaskValue(field) as Record<string, unknown>;
      const restored = loadFieldFromSnapshot(snap);
      jmask.setField(restored);

      expect(() => jmask.saveAsXML().toXml()).not.toThrow();
      expect(jmask.saveAsXML().toXml()).toBe(originalXml);
    });

    it('generates notes after snapshot round-trip with all modifiers', () => {
      const jmask = new JMask();
      jmask.setSubjectiveDuration(TimeDuration.beats(2));
      jmask.setSeedUsed(true);
      jmask.setSeed(42);

      const field = jmask.getField();
      field.getParameter(0).setGenerator(new Constant());
      (field.getParameter(0).getGenerator() as Constant).value = 1;

      const osc = new Oscillator();
      osc.frequency = 1;
      field.getParameter(1).setGenerator(osc);
      field.getParameter(1).getMask()!.enabled = true;
      field.getParameter(1).getMask()!.high = 0.9;
      field.getParameter(1).getMask()!.low = 0.1;

      field.getParameter(2).setGenerator(new Constant());
      (field.getParameter(2).getGenerator() as Constant).value = 0.5;

      const snap = snapshotJMaskValue(field) as Record<string, unknown>;
      const restored = loadFieldFromSnapshot(snap);
      jmask.setField(restored);

      const context = new TimeContext();
      const notes = jmask.generateNotes(context);
      expect(notes.size).toBeGreaterThan(0);
    });

    it('handles snapshot with table points that have kind: TablePoint', () => {
      const field = new Field(false);
      const seg = new Segment();
      seg.table.getPoint(0).setValue(0.1);
      seg.table.getPoint(1).setValue(0.9);
      const param = Parameter.create(seg);
      param.name = 'seg-param';
      field.parameters.push(param);

      const snap = snapshotJMaskValue(field) as Record<string, unknown>;
      const restored = loadFieldFromSnapshot(snap);
      const restoredSeg = restored.getParameter(0).getGenerator() as Segment;
      expect(restoredSeg).toBeInstanceOf(Segment);
      expect(restoredSeg.table.points[0]).toBeInstanceOf(TablePoint);
      expect(typeof restoredSeg.table.points[0]!.saveAsXML).toBe('function');
      expect(() => restoredSeg.saveAsXML()).not.toThrow();
    });

    it('snapshot round-trip with nested table in Mask produces valid saveAsXML', () => {
      const field = new Field(false);
      const param = Parameter.create(new Oscillator());
      param.name = 'osc-with-mask';
      const mask = param.getMask()!;
      mask.enabled = true;
      mask.highTableEnabled = true;
      mask.highTable.getPoint(0).setValue(0.5);
      mask.highTable.getPoint(1).setValue(0.9);
      const lowMid = new TablePoint();
      lowMid.time = 0.5;
      lowMid.value = 0.2;
      mask.lowTable.addPoint(1, lowMid);
      field.parameters.push(param);

      const snap = snapshotJMaskValue(field) as Record<string, unknown>;
      const restored = loadFieldFromSnapshot(snap);
      const rParam = restored.getParameter(0);
      expect(rParam.getMask()!.lowTable.points.length).toBe(3);
      expect(rParam.getMask()!.lowTable.points[1]).toBeInstanceOf(TablePoint);
      expect(typeof rParam.getMask()!.lowTable.points[1]!.saveAsXML).toBe('function');

      const jmask = new JMask();
      jmask.setField(restored);
      jmask.setSubjectiveDuration(TimeDuration.beats(1));
      expect(() => jmask.saveAsXML().toXml()).not.toThrow();
    });

    it('snapshot round-trip with Quantizer table produces valid saveAsXML', () => {
      const field = new Field(false);
      const param = Parameter.create(new Random());
      param.name = 'rand-with-quant';
      const quant = param.getQuantizer()!;
      quant.enabled = true;
      quant.gridSizeTableEnabled = true;
      quant.gridSizeTable.getPoint(0).setValue(0.1);
      const mid = new TablePoint();
      mid.time = 0.5;
      mid.value = 0.3;
      quant.gridSizeTable.addPoint(1, mid);
      field.parameters.push(param);

      const snap = snapshotJMaskValue(field) as Record<string, unknown>;
      const restored = loadFieldFromSnapshot(snap);
      const rParam = restored.getParameter(0);
      expect(rParam.getQuantizer()!.gridSizeTable.points.length).toBe(3);
      expect(rParam.getQuantizer()!.gridSizeTable.points[1]).toBeInstanceOf(TablePoint);

      const jmask = new JMask();
      jmask.setField(restored);
      jmask.setSubjectiveDuration(TimeDuration.beats(1));
      expect(() => jmask.saveAsXML().toXml()).not.toThrow();
    });

    it('snapshot round-trip with Accumulator table produces valid saveAsXML', () => {
      const field = new Field(false);
      const param = Parameter.create(new Constant());
      param.name = 'const-with-acc';
      (param.getGenerator() as Constant).value = 0.1;
      const acc = param.getAccumulator()!;
      acc.enabled = true;
      acc.mode = Accumulator.WRAP;
      acc.high = 2;
      acc.low = -1;
      acc.highTableEnabled = true;
      acc.highTable.getPoint(0).setValue(1.5);
      field.parameters.push(param);

      const snap = snapshotJMaskValue(field) as Record<string, unknown>;
      const restored = loadFieldFromSnapshot(snap);
      const rParam = restored.getParameter(0);
      expect(rParam.getAccumulator()!.highTable.points[0]).toBeInstanceOf(TablePoint);

      const jmask = new JMask();
      jmask.setField(restored);
      jmask.setSubjectiveDuration(TimeDuration.beats(1));
      expect(() => jmask.saveAsXML().toXml()).not.toThrow();
    });
  });
});
