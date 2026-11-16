import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import {
  writeBoolean,
  writeDouble,
  writeInt,
  readBoolean,
  readDouble,
  readInt,
} from '../../utilities/xml';
import { jmaskType, validateJmaskXml } from './xml-policy';
import { clamp } from '../../utilities/math-utils';
import {
  JavaRandom,
  type Generator,
  type Maskable,
  type Quantizable,
  type Accumulatable,
  type ProbabilityGenerator,
  Table,
  remainder,
} from './core-table-modifiers';
import {
  Uniform,
  Triangle,
  Linear,
  Exponential,
  Gaussian,
  Cauchy,
  Beta,
  Weibull,
} from './probability-distributions';

export class Constant implements Generator, Accumulatable {
  value = 1.0;

  constructor(other?: Constant) {
    if (other) {
      this.value = other.value;
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Constant {
    validateJmaskXml(data, 'Constant', context);
    const constant = new Constant();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'value') {
        constant.value = readDouble(node);
      }
    }
    return constant;
  }

  initialize(_duration: number): void {}

  getValue(_time: number, _rnd: JavaRandom): number {
    return this.value;
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Constant');
    retVal.addElement(writeDouble('value', this.value));
    return retVal;
  }

  deepCopy(): Constant {
    return new Constant(this);
  }
}

export class Random implements Generator, Quantizable, Accumulatable {
  min = 0.0;
  max = 1.0;

  constructor(other?: Random) {
    if (other) {
      this.min = other.min;
      this.max = other.max;
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Random {
    validateJmaskXml(data, 'Random', context);
    const random = new Random();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'min':
          random.min = readDouble(node);
          break;
        case 'max':
          random.max = readDouble(node);
          break;
      }
    }
    return random;
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    return this.min + (this.max - this.min) * rnd.nextDouble();
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Random');
    retVal.addElement(writeDouble('min', this.min));
    retVal.addElement(writeDouble('max', this.max));
    return retVal;
  }

  deepCopy(): Random {
    return new Random(this);
  }
}

export class Oscillator implements Generator, Maskable, Quantizable, Accumulatable {
  static readonly SINE = 0;
  static readonly COSINE = 1;
  static readonly SAW_UP = 2;
  static readonly SAW_DOWN = 3;
  static readonly SQUARE = 4;
  static readonly TRIANGLE = 5;
  static readonly POW_UP = 6;
  static readonly POW_DOWN = 7;
  static readonly FUNCTIONS = [
    'Sine',
    'Cosine',
    'Saw (Increasing)',
    'Saw (Decreasing)',
    'Square',
    'Triangle',
    'Power Function (Increasing)',
    'Power Function (Decreasing)',
  ];

  oscillatorType = Oscillator.SINE;
  phaseInit = 0.0;
  frequency = 1.0;
  freqTable = new Table();
  freqTableEnabled = false;
  exponent = 1.0;

  constructor(other?: Oscillator) {
    if (other) {
      this.oscillatorType = other.oscillatorType;
      this.phaseInit = other.phaseInit;
      this.frequency = other.frequency;
      this.freqTable = new Table(other.freqTable);
      this.freqTableEnabled = other.freqTableEnabled;
      this.exponent = other.exponent;
      return;
    }

    this.freqTable.setMin(0.001, false);
    this.freqTable.setMax(10.0, false);
    this.freqTable.getPoint(0).setValue(1.0);
    this.freqTable.getPoint(1).setValue(1.0);
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Oscillator {
    validateJmaskXml(data, 'Oscillator', context);
    const oscillator = new Oscillator();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'oscillatorType':
          oscillator.oscillatorType = readInt(node);
          break;
        case 'phaseInit':
          oscillator.phaseInit = readDouble(node);
          break;
        case 'frequency':
          oscillator.frequency = readDouble(node);
          break;
        case 'freqTableEnabled':
          oscillator.freqTableEnabled = readBoolean(node);
          break;
        case 'table':
          oscillator.freqTable = Table.loadFromXML(node);
          break;
        case 'exponent':
          oscillator.exponent = readDouble(node);
          break;
      }
    }
    return oscillator;
  }

  initialize(_duration: number): void {}

  private getPhase(time: number): number {
    if (!this.freqTableEnabled) {
      return this.phaseInit + time * this.frequency;
    }
    return this.phaseInit + this.freqTable.getphs(time);
  }

  private sin(phase: number): number {
    return Math.sin(Math.PI * 2 * phase) * 0.5 + 0.5;
  }

  private cos(phase: number): number {
    return Math.cos(Math.PI * 2 * phase) * 0.5 + 0.5;
  }

  private sawUp(phase: number): number {
    return Math.abs(remainder(phase, 1.0));
  }

  private sawDown(phase: number): number {
    return 1.0 - Math.abs(remainder(phase, 1.0));
  }

  private square(phase: number): number {
    const x = Math.abs(remainder(phase, 1.0));
    return x < 0.5 ? 1.0 : 0.0;
  }

  private triangle(phase: number): number {
    const x = Math.abs(remainder(phase, 1.0));
    return x < 0.5 ? 2.0 * x : 2.0 * (1.0 - x);
  }

  private powerUp(phase: number): number {
    return Math.pow(Math.abs(remainder(phase, 1.0)), Math.pow(2.0, this.exponent));
  }

  private powerDown(phase: number): number {
    return Math.pow(1.0 - Math.abs(remainder(phase, 1.0)), Math.pow(2.0, this.exponent));
  }

  getValue(time: number, _rnd: JavaRandom): number {
    const phase = this.getPhase(time);
    switch (this.oscillatorType) {
      case Oscillator.COSINE:
        return this.cos(phase);
      case Oscillator.SAW_UP:
        return this.sawUp(phase);
      case Oscillator.SAW_DOWN:
        return this.sawDown(phase);
      case Oscillator.SQUARE:
        return this.square(phase);
      case Oscillator.TRIANGLE:
        return this.triangle(phase);
      case Oscillator.POW_UP:
        return this.powerUp(phase);
      case Oscillator.POW_DOWN:
        return this.powerDown(phase);
      case Oscillator.SINE:
      default:
        return this.sin(phase);
    }
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Oscillator');
    retVal.addElement(writeInt('oscillatorType', this.oscillatorType));
    retVal.addElement(writeDouble('phaseInit', this.phaseInit));
    retVal.addElement(writeDouble('frequency', this.frequency));
    retVal.addElement(writeBoolean('freqTableEnabled', this.freqTableEnabled));
    retVal.addElement(this.freqTable.saveAsXML());
    retVal.addElement(writeDouble('exponent', this.exponent));
    return retVal;
  }

  deepCopy(): Oscillator {
    return new Oscillator(this);
  }
}

export class Segment implements Generator, Quantizable, Accumulatable {
  table = new Table();

  constructor(other?: Segment) {
    if (other) {
      this.table = new Table(other.table);
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Segment {
    validateJmaskXml(data, 'Segment', context);
    const segment = new Segment();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'table') {
        segment.table = Table.loadFromXML(node);
      }
    }
    return segment;
  }

  initialize(duration: number): void {
    for (const point of this.table.points) {
      point.time *= duration;
    }
  }

  getValue(time: number, _rnd: JavaRandom): number {
    return this.table.getValue(time);
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Segment');
    retVal.addElement(this.table.saveAsXML());
    return retVal;
  }

  deepCopy(): Segment {
    return new Segment(this);
  }
}

export class ItemList implements Generator, TableLike, Accumulatable {
  static readonly CYCLE = 0;
  static readonly SWING = 1;
  static readonly RANDOM = 2;
  static readonly HEAP = 3;
  static readonly MODES = ['Cycle', 'Swing', 'Random', 'Heap'];

  listType = ItemList.CYCLE;
  listItems: number[] = [];
  index = 0;
  direction = 0;

  constructor(other?: ItemList) {
    if (other) {
      this.listType = other.listType;
      this.index = other.index;
      this.direction = other.direction;
      this.listItems = [...other.listItems];
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): ItemList {
    validateJmaskXml(data, 'ItemList', context);
    const itemList = new ItemList();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'listType':
          itemList.listType = readInt(node);
          break;
        case 'listItems': {
          const items = node.getElements();
          while (items.hasMoreElements()) {
            const itemNode = items.next();
            if (itemNode.getName() === 'item') {
              itemList.listItems.push(parseFloat(itemNode.getTextString()));
            }
          }
          break;
        }
        case 'index':
          itemList.index = readInt(node);
          break;
        case 'direction':
          itemList.direction = readInt(node);
          break;
      }
    }
    return itemList;
  }

  initialize(_duration: number): void {
    this.index = 0;
    this.direction = 0;
  }

  private shuffleItems(): void {
    for (let index = this.listItems.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.listItems[index], this.listItems[swapIndex]] = [
        this.listItems[swapIndex]!,
        this.listItems[index]!,
      ];
    }
  }

  getValue(_time: number, rnd: JavaRandom): number {
    if (this.listItems.length === 0) {
      return 0.0;
    }

    if (this.listItems.length === 1) {
      return this.listItems[0]!;
    }

    switch (this.listType) {
      case ItemList.CYCLE: {
        const value = this.listItems[this.index]!;
        this.index += 1;
        if (this.index >= this.listItems.length) {
          this.index = 0;
        }
        return value;
      }
      case ItemList.SWING: {
        const value = this.listItems[this.index]!;
        if (this.direction === 0) {
          this.index += 1;
          if (this.index >= this.listItems.length) {
            this.index -= 2;
            this.direction = 1;
          }
        } else {
          this.index -= 1;
          if (this.index < 0) {
            this.index = 1;
            this.direction = 0;
          }
        }
        return value;
      }
      case ItemList.RANDOM: {
        this.index = Math.floor(rnd.nextDouble() * this.listItems.length);
        return this.listItems[this.index]!;
      }
      case ItemList.HEAP: {
        if (this.index === 0) {
          this.shuffleItems();
        }
        const value = this.listItems[this.index]!;
        this.index += 1;
        if (this.index >= this.listItems.length) {
          this.index = 0;
        }
        return value;
      }
      default:
        return this.listItems[this.index]!;
    }
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.ItemList');
    retVal.addElement(writeInt('listType', this.listType));
    retVal.addElement(writeInt('index', this.index));
    retVal.addElement(writeInt('direction', this.direction));

    const items = new Element('listItems');
    for (const item of this.listItems) {
      items.addElement('item').setText(String(item));
    }
    retVal.addElement(items);
    return retVal;
  }

  deepCopy(): ItemList {
    return new ItemList(this);
  }
}

interface TableLike {
  listType: number;
  listItems: number[];
  index: number;
  direction: number;
}

export class Probability implements Generator, Maskable, Quantizable, Accumulatable {
  generators: ProbabilityGenerator[] = [
    new Uniform(),
    new Linear(),
    new Triangle(),
    new Exponential(),
    new Gaussian(),
    new Cauchy(),
    new Beta(),
    new Weibull(),
  ];
  selectedIndex = 0;
  private duration = 0;

  constructor(other?: Probability) {
    if (other) {
      this.selectedIndex = other.selectedIndex;
      this.generators = other.generators.map((generator) => generator.deepCopy());
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Probability {
    validateJmaskXml(data, 'Probability', context);
    const probability = new Probability();
    const nodes = data.getElements();
    let generatorIndex = 0;

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'selectedIndex':
          probability.selectedIndex = readInt(node);
          break;
        case 'probabilityGenerator': {
          const generator = loadProbabilityGeneratorFromXML(node);
          if (generator && generatorIndex < probability.generators.length) {
            probability.generators[generatorIndex] = generator;
          }
          generatorIndex += 1;
          break;
        }
      }
    }

    return probability;
  }

  initialize(duration: number): void {
    this.duration = duration;
  }

  getValue(time: number, rnd: JavaRandom): number {
    const generator = this.generators[this.selectedIndex] ?? this.generators[0]!;
    const localTime = this.duration !== 0 ? time / this.duration : 0;
    return generator.getValue(localTime, rnd);
  }

  getGenerators(): ProbabilityGenerator[] {
    return this.generators;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  setSelectedIndex(selectedIndex: number): void {
    this.selectedIndex = clamp(selectedIndex, 0, this.generators.length - 1);
  }

  getSelectedProbabilityGenerator(): ProbabilityGenerator {
    return this.generators[this.selectedIndex] ?? this.generators[0]!;
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Probability');
    retVal.addElement(writeInt('selectedIndex', this.selectedIndex));
    for (const generator of this.generators) {
      retVal.addElement(generator.saveAsXML());
    }
    return retVal;
  }

  deepCopy(): Probability {
    return new Probability(this);
  }
}

export class GeneratorEntry {
  constructor(
    public generatorName: string,
    public generatorClass: new () => Generator,
  ) {}

  toString(): string {
    return this.generatorName;
  }

  createGenerator(): Generator {
    return new this.generatorClass();
  }
}

export class GeneratorRegistry {
  private static entries: GeneratorEntry[] | null = null;

  static getGeneratorEntries(): GeneratorEntry[] {
    if (this.entries === null) {
      this.entries = [
        new GeneratorEntry('Constant', Constant),
        new GeneratorEntry('Item List', ItemList),
        new GeneratorEntry('Segment', Segment),
        new GeneratorEntry('Random', Random),
        new GeneratorEntry('Probability', Probability),
        new GeneratorEntry('Oscillator', Oscillator),
      ];
    }

    return this.entries;
  }
}

export function supportsMask(generator: Generator): boolean {
  return generator instanceof Oscillator || generator instanceof Probability;
}

export function supportsQuantizer(generator: Generator): boolean {
  return (
    generator instanceof Random ||
    generator instanceof Oscillator ||
    generator instanceof Segment ||
    generator instanceof Probability
  );
}

export function supportsAccumulator(generator: Generator): boolean {
  return (
    generator instanceof Constant ||
    generator instanceof Random ||
    generator instanceof Oscillator ||
    generator instanceof Segment ||
    generator instanceof ItemList ||
    generator instanceof Probability
  );
}

const GENERATOR_LOADERS: Record<string, (data: Element) => Generator> = {
  Constant: (data) => Constant.loadFromXML(data),
  ItemList: (data) => ItemList.loadFromXML(data),
  Segment: (data) => Segment.loadFromXML(data),
  Random: (data) => Random.loadFromXML(data),
  Probability: (data) => Probability.loadFromXML(data),
  Oscillator: (data) => Oscillator.loadFromXML(data),
};

const PROBABILITY_GENERATOR_LOADERS: Record<string, (data: Element) => ProbabilityGenerator> = {
  Uniform: (data) => Uniform.loadFromXML(data),
  Linear: (data) => Linear.loadFromXML(data),
  Triangle: (data) => Triangle.loadFromXML(data),
  Exponential: (data) => Exponential.loadFromXML(data),
  Gaussian: (data) => Gaussian.loadFromXML(data),
  Cauchy: (data) => Cauchy.loadFromXML(data),
  Beta: (data) => Beta.loadFromXML(data),
  Weibull: (data) => Weibull.loadFromXML(data),
};

export function loadGeneratorFromXML(data: Element, context = new XmlLoadContext(data)): Generator {
  const type = jmaskType(data, false, context);
  const loader = GENERATOR_LOADERS[type];
  return loader(data);
}

export function loadProbabilityGeneratorFromXML(
  data: Element,
  context = new XmlLoadContext(data),
): ProbabilityGenerator {
  const type = jmaskType(data, true, context);
  const loader = PROBABILITY_GENERATOR_LOADERS[type];
  return loader(data);
}
