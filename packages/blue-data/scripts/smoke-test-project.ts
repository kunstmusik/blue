import { writeFileSync, mkdirSync } from 'fs';
import {
  BlueData,
  PolyObject,
  SoundLayer,
  GenericScore,
  PythonObject,
  JavaScriptObject,
  Comment,
  External,
  AudioFile,
  Sound,
  LineObject,
  ZakLineObject,
  PatternObject,
  PianoRoll,
  TrackerObject,
  JMask,
  BlueSynthBuilder,
  TimePosition,
  TimeDuration,
} from '../src/index';
import { BSBHSlider } from '../src/instruments/blue-synth-builder/bsb-hslider';
import { BSBVSlider } from '../src/instruments/blue-synth-builder/bsb-vslider';
import { BSBKnob } from '../src/instruments/blue-synth-builder/bsb-knob';
import { BSBCheckBox } from '../src/instruments/blue-synth-builder/bsb-check-box';
import { BSBLabel } from '../src/instruments/blue-synth-builder/bsb-label';
import { BSBDropdown } from '../src/instruments/blue-synth-builder/bsb-dropdown';
import { BSBXYController } from '../src/instruments/blue-synth-builder/bsb-xy-controller';
import { BSBValue } from '../src/instruments/blue-synth-builder/bsb-value';
import { BSBTextField } from '../src/instruments/blue-synth-builder/bsb-text-field';
import { BSBFileSelector } from '../src/instruments/blue-synth-builder/bsb-file-selector';
import { BSBHSliderBank } from '../src/instruments/blue-synth-builder/bsb-hslider-bank';
import { BSBVSliderBank } from '../src/instruments/blue-synth-builder/bsb-vslider-bank';
import { BSBGroup } from '../src/instruments/blue-synth-builder/bsb-group';

const data = new BlueData();

const props = data.getProjectProperties();
props.title = 'Smoke Test';
props.author = 'blue-electron';
props.sampleRate = '44100';

const score = data.getScore();
const root = new PolyObject(true);
root.setName('Root');
const layer = new SoundLayer();
layer.setName('Layer 0');
root.push(layer);
score.push(root);

const BEATS_PER_MEASURE = 4;
const sobjTypes: Array<{ name: string; obj: () => any }> = [
  {
    name: 'GenericScore',
    obj: () => {
      const o = new GenericScore();
      o.setScoreText('i1 0 1 440 0.5');
      return o;
    },
  },
  {
    name: 'PythonObject',
    obj: () => {
      const o = new PythonObject();
      o.setPythonCode('# python code\nprint("hello")');
      return o;
    },
  },
  {
    name: 'JavaScriptObject',
    obj: () => {
      const o = new JavaScriptObject();
      o.setJavaScriptCode('// js code\nconsole.log("hello")');
      return o;
    },
  },
  {
    name: 'Comment',
    obj: () => {
      const o = new Comment();
      o.setText('This is a comment');
      return o;
    },
  },
  {
    name: 'External',
    obj: () => {
      const o = new External();
      o.setCommandLine('echo');
      o.setText('external text');
      return o;
    },
  },
  {
    name: 'AudioFile',
    obj: () => {
      const o = new AudioFile();
      o.setSoundFileName('test.wav');
      return o;
    },
  },
  {
    name: 'Sound',
    obj: () => {
      const o = new Sound();
      o.setComment('BSB sound');
      return o;
    },
  },
  { name: 'LineObject', obj: () => new LineObject() },
  { name: 'ZakLineObject', obj: () => new ZakLineObject() },
  {
    name: 'PatternObject',
    obj: () => {
      const o = new PatternObject();
      return o;
    },
  },
  { name: 'PianoRoll', obj: () => new PianoRoll() },
  { name: 'TrackerObject', obj: () => new TrackerObject() },
  { name: 'JMask', obj: () => new JMask() },
];

const colors = [
  0xff6699, 0x66ff99, 0x6699ff, 0xffcc66, 0xcc66ff, 0x66ffcc, 0xff9966, 0x9966ff, 0x66ccff,
  0xff66cc, 0xccff66, 0x66ff66, 0xff6666, 0x6666ff,
];

for (let i = 0; i < sobjTypes.length; i++) {
  const { name, obj } = sobjTypes[i];
  const sObj = obj();
  sObj.setName(name);
  sObj.setStartTime(TimePosition.beats(i * BEATS_PER_MEASURE));
  sObj.setSubjectiveDuration(TimeDuration.beats(BEATS_PER_MEASURE));
  sObj.setBackgroundColor(colors[i % colors.length]);
  layer.push(sObj);
}

const bsb = new BlueSynthBuilder();
bsb.setName('All Widgets Synth');
bsb.setInstrumentText(`
  ifreq = p4
  iamp = p5
  aenv linseg 0, 0.01, 1, p3-0.02, 1, 0.01, 0
  aout poscil aenv * iamp * <volume>, ifreq * <pitch>
  outs aout, aout
`);

const gi = bsb.getGraphicInterface().getRootGroup();
gi.backgroundColor = '0x00000033';
gi.borderColor = '0x000000ff';
gi.labelTextColor = '0xffffffff';
const GAP = 10;
const WIDGET_H = 60;

function row(r: number) {
  return r * (WIDGET_H + GAP) + GAP;
}

const hslider = new BSBHSlider();
hslider.objectName = 'volume';
hslider.x = GAP;
hslider.y = row(0);
hslider.value = 0.5;
hslider.minimum = 0;
hslider.maximum = 1;
hslider.sliderWidth = 200;
hslider.resolution = 0.001;
gi.addChild(hslider);

const vslider = new BSBVSlider();
vslider.objectName = 'filter';
vslider.x = 230;
vslider.y = row(0);
vslider.value = 5000;
vslider.minimum = 100;
vslider.maximum = 15000;
vslider.sliderHeight = 130;
vslider.resolution = 1;
gi.addChild(vslider);

const knob = new BSBKnob();
knob.objectName = 'pitch';
knob.x = 310;
knob.y = row(0);
knob.value = 1.0;
knob.minimum = 0.5;
knob.maximum = 2.0;
knob.knobWidth = 50;
gi.addChild(knob);

const checkbox = new BSBCheckBox();
checkbox.objectName = 'enabled';
checkbox.x = GAP;
checkbox.y = row(1);
checkbox.label = 'Enabled';
checkbox.selected = true;
gi.addChild(checkbox);

const label = new BSBLabel();
label.x = 120;
label.y = row(1);
label.label = 'BSB Label Widget';
gi.addChild(label);

const dropdown = new BSBDropdown();
dropdown.objectName = 'waveform';
dropdown.x = GAP;
dropdown.y = row(2);
dropdown.selectedIndex = 0;
dropdown.dropdownItems = [
  { name: 'Sine', value: 'poscil', uniqueId: 'uid-sine' },
  { name: 'Sawtooth', value: 'vco2', uniqueId: 'uid-saw' },
  { name: 'Square', value: 'vco2sq', uniqueId: 'uid-sqr' },
];
gi.addChild(dropdown);

const xy = new BSBXYController();
xy.objectName = 'xypad';
xy.x = 250;
xy.y = row(2);
xy.xValue = 0.5;
xy.yValue = 0.5;
xy.xMin = 0;
xy.xMax = 1;
xy.yMin = 0;
xy.yMax = 1;
xy.width = 120;
xy.height = 100;
gi.addChild(xy);

const val = new BSBValue();
val.objectName = 'baseFreq';
val.x = GAP;
val.y = row(3);
val.value = 440;
val.minimum = 20;
val.maximum = 20000;
gi.addChild(val);

const textField = new BSBTextField();
textField.objectName = 'scoreText';
textField.x = 120;
textField.y = row(3);
textField.textValue = 'i1 0 1 440 0.5';
textField.textFieldWidth = 180;
gi.addChild(textField);

const fileSel = new BSBFileSelector();
fileSel.objectName = 'sampleFile';
fileSel.x = GAP;
fileSel.y = row(4);
fileSel.fileName = 'test.wav';
fileSel.textFieldWidth = 200;
fileSel.stringChannelEnabled = false;
gi.addChild(fileSel);

const hBank = new BSBHSliderBank();
hBank.objectName = 'hbank';
hBank.x = 250;
hBank.y = row(4);
hBank.value = 0.5;
hBank.minimum = 0;
hBank.maximum = 1;
hBank.sliderWidth = 80;
hBank.numberOfSliders = 4;
hBank.gap = 2;
hBank.resolution = 0.01;
gi.addChild(hBank);

const vBank = new BSBVSliderBank();
vBank.objectName = 'vbank';
vBank.x = 360;
vBank.y = row(4);
vBank.value = 0.5;
vBank.minimum = 0;
vBank.maximum = 1;
vBank.sliderHeight = 80;
vBank.numberOfSliders = 4;
vBank.gap = 2;
vBank.resolution = 0.01;
gi.addChild(vBank);

const group = new BSBGroup();
group.x = GAP;
group.y = row(5);
group.width = 420;
group.height = 80;
group.groupName = 'Group Container';
group.backgroundColor = '0x00000033';
group.borderColor = '0x000000ff';
group.labelTextColor = '0xffffffff';
group.titleEnabled = true;
const innerKnob = new BSBKnob();
innerKnob.objectName = 'innerKnob';
innerKnob.x = GAP;
innerKnob.y = GAP;
innerKnob.value = 0.5;
innerKnob.minimum = 0;
innerKnob.maximum = 1;
innerKnob.knobWidth = 40;
group.addChild(innerKnob);
gi.addChild(group);

data.getArrangement().addInstrument(bsb);

const xml = data.saveToString();
const outDir = new URL('../../../fixtures/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const outPath = new URL('../../../fixtures/smoke-test.blue', import.meta.url);
writeFileSync(outPath, xml, 'utf-8');
console.log(`Wrote ${outPath.pathname} (${xml.length} bytes)`);
