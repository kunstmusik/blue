import { writeFileSync, mkdirSync } from 'fs';
import { BlueData, PolyObject, SoundLayer, JMask, TimePosition, TimeDuration } from '../src/index';
import {
  Field,
  Parameter,
  Constant,
  Random,
  ItemList,
  Segment,
  Oscillator,
  Probability,
  Mask,
  Quantizer,
  Accumulator,
  Table,
  TablePoint,
} from '../src/sound-objects/jmask-support';

const data = new BlueData();
const props = data.getProjectProperties();
props.title = 'JMask Generator Test';
props.author = 'blue-electron';

const score = data.getScore();
const root = new PolyObject(true);
root.setName('Root');
const layer = new SoundLayer();
layer.setName('Layer 0');
root.push(layer);
score.push(root);

const jmask = new JMask();
jmask.setName('All Generators');
jmask.setStartTime(TimePosition.beats(0));
jmask.setSubjectiveDuration(TimeDuration.beats(4));
jmask.setSeedUsed(true);
jmask.setSeed(42);

const field = jmask.getField();

const p1 = Parameter.create(new Constant());
p1.setName('Instrument ID');
(p1.getGenerator() as Constant).value = 1.0;
field.parameters[0] = p1;

const p2 = Parameter.create(new Constant());
p2.setName('Start');
(p2.getGenerator() as Constant).value = 0.5;
field.parameters[1] = p2;

const p3 = Parameter.create(new Constant());
p3.setName('Duration');
(p3.getGenerator() as Constant).value = 0.5;
field.parameters[2] = p3;

const p4 = Parameter.create(new Constant());
p4.setName('p4-Constant');
(p4.getGenerator() as Constant).value = 440.0;
const acc4 = p4.getAccumulator()!;
acc4.enabled = true;
acc4.mode = Accumulator.LIMIT;
acc4.low = 200;
acc4.high = 800;
field.parameters.push(p4);

const p5 = Parameter.create(new Random());
p5.setName('p5-Random');
(p5.getGenerator() as Random).min = 0.0;
(p5.getGenerator() as Random).max = 1.0;
const quant5 = p5.getQuantizer()!;
quant5.enabled = true;
quant5.gridSize = 0.25;
quant5.strength = 0.8;
const acc5 = p5.getAccumulator()!;
acc5.enabled = true;
acc5.mode = Accumulator.WRAP;
acc5.low = 0;
acc5.high = 5;
field.parameters.push(p5);

const p6 = Parameter.create(new ItemList());
p6.setName('p6-ItemList');
const il = p6.getGenerator() as ItemList;
il.listType = ItemList.CYCLE;
il.listItems = [1, 2, 3, 4, 5];
field.parameters.push(p6);

const p7 = Parameter.create(new Segment());
p7.setName('p7-Segment');
const seg = p7.getGenerator() as Segment;
seg.table = new Table();
seg.table.min = 0;
seg.table.max = 1;
seg.table.interpolationType = Table.ON;
seg.table.interpolation = 0;
seg.table.points = [
  (() => {
    const p = new TablePoint();
    p.time = 0;
    p.value = 0;
    return p;
  })(),
  (() => {
    const p = new TablePoint();
    p.time = 0.5;
    p.value = 1;
    return p;
  })(),
  (() => {
    const p = new TablePoint();
    p.time = 1;
    p.value = 0;
    return p;
  })(),
];
const quant7 = p7.getQuantizer()!;
quant7.enabled = true;
quant7.gridSize = 0.1;
field.parameters.push(p7);

const p8 = Parameter.create(new Oscillator());
p8.setName('p8-Oscillator');
const osc = p8.getGenerator() as Oscillator;
osc.oscillatorType = Oscillator.SINE;
osc.phaseInit = 0.0;
osc.frequency = 2.0;
osc.freqTableEnabled = false;
osc.exponent = 1.0;
const mask8 = p8.getMask()!;
mask8.enabled = true;
mask8.high = 1.0;
mask8.low = 0.0;
mask8.mapValue = 1.0;
const quant8 = p8.getQuantizer()!;
quant8.enabled = true;
quant8.gridSize = 0.5;
const acc8 = p8.getAccumulator()!;
acc8.enabled = true;
acc8.mode = Accumulator.MIRROR;
acc8.low = -2;
acc8.high = 2;
field.parameters.push(p8);

const p9 = Parameter.create(new Probability());
p9.setName('p9-Probability');
((prob) => {
  prob.selectedIndex = 0;
})(p9.getGenerator() as Probability);
const mask9 = p9.getMask()!;
mask9.enabled = true;
mask9.high = 1.0;
mask9.low = 0.0;
const quant9 = p9.getQuantizer()!;
quant9.enabled = true;
quant9.gridSize = 0.25;
quant9.strength = 0.8;
const acc9 = p9.getAccumulator()!;
acc9.enabled = true;
acc9.mode = Accumulator.WRAP;
acc9.low = 0;
acc9.high = 10;
field.parameters.push(p9);

layer.push(jmask);

const xml = data.saveToString();
const outDir = new URL('../../../fixtures/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const outPath = new URL('../../../fixtures/jmask-all-generators.blue', import.meta.url);
writeFileSync(outPath, xml, 'utf-8');
console.log(`Wrote ${outPath.pathname} (${xml.length} bytes)`);
