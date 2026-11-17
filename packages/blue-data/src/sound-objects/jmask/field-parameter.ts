import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { parseXmlBoolean } from '../../utilities/xml';
import { formatBlueNumber } from '../../utilities/number-format';
import { NoteList } from '../note-list';
import { Note } from '../note';
import { validateJmaskXml } from './xml-policy';
import {
  JavaRandom,
  type Generator,
  Table,
  Mask,
  Quantizer,
  Accumulator,
  roundTo,
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
import {
  Constant,
  Random,
  Oscillator,
  Segment,
  ItemList,
  Probability,
  loadGeneratorFromXML,
  supportsMask,
  supportsQuantizer,
  supportsAccumulator,
} from './generators';

export class Parameter {
  visible = true;
  generator: Generator | null = null;
  mask: Mask | null = null;
  quantizer: Quantizer | null = null;
  accumulator: Accumulator | null = null;
  name = '';

  constructor(other?: Parameter, forGeneration = false) {
    if (other) {
      this.visible = other.visible;
      this.generator = other.generator?.deepCopy() ?? null;
      this.mask =
        other.mask && (!forGeneration || other.mask.enabled) ? new Mask(other.mask) : null;
      this.quantizer =
        other.quantizer && (!forGeneration || other.quantizer.enabled)
          ? new Quantizer(other.quantizer)
          : null;
      this.accumulator =
        other.accumulator && (!forGeneration || other.accumulator.enabled)
          ? new Accumulator(other.accumulator)
          : null;
      this.name = other.name;
    }
  }

  static create(generator: Generator): Parameter {
    const parameter = new Parameter();
    parameter.setGenerator(generator);
    return parameter;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Parameter {
    validateJmaskXml(data, 'Parameter', context);
    const parameter = new Parameter();

    const visible = data.getAttributeValue('visible');
    if (visible !== null) {
      parameter.visible = parseXmlBoolean(visible, context.at(data), '@visible');
    }

    const name = data.getAttributeValue('name');
    if (name !== null) {
      parameter.name = name;
    }

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'generator': {
          const generator = loadGeneratorFromXML(node);
          parameter.setGenerator(generator ?? new Constant());
          break;
        }
        case 'mask':
          parameter.mask = Mask.loadFromXML(node);
          break;
        case 'quantizer':
          parameter.quantizer = Quantizer.loadFromXML(node);
          break;
        case 'accumulator':
          parameter.accumulator = Accumulator.loadFromXML(node);
          break;
      }
    }

    if (!parameter.generator) {
      parameter.setGenerator(new Constant());
    }

    return parameter;
  }

  setGenerator(generator: Generator): void {
    this.generator = generator;

    if (supportsMask(generator)) {
      this.mask = this.mask ?? new Mask();
    } else {
      this.mask = null;
    }

    if (supportsQuantizer(generator)) {
      this.quantizer = this.quantizer ?? new Quantizer();
    } else {
      this.quantizer = null;
    }

    if (supportsAccumulator(generator)) {
      this.accumulator = this.accumulator ?? new Accumulator();
    } else {
      this.accumulator = null;
    }
  }

  getGenerator(): Generator | null {
    return this.generator;
  }

  setMask(mask: Mask | null): void {
    this.mask = mask;
  }

  getMask(): Mask | null {
    return this.mask;
  }

  setQuantizer(quantizer: Quantizer | null): void {
    this.quantizer = quantizer;
  }

  getQuantizer(): Quantizer | null {
    return this.quantizer;
  }

  setAccumulator(accumulator: Accumulator | null): void {
    this.accumulator = accumulator;
  }

  getAccumulator(): Accumulator | null {
    return this.accumulator;
  }

  setName(name: string): void {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  initialize(duration: number): void {
    this.generator?.initialize(duration);
    if (this.mask) {
      this.mask.duration = duration;
    }
    if (this.quantizer) {
      this.quantizer.duration = duration;
    }
    if (this.accumulator) {
      this.accumulator.duration = duration;
    }
  }

  getValue(time: number, rnd: JavaRandom): number {
    if (!this.generator) {
      return 0.0;
    }

    let value = this.generator.getValue(time, rnd);
    if (this.mask?.enabled) {
      value = this.mask.getValue(time, value);
    }
    if (this.quantizer?.enabled) {
      value = this.quantizer.getValue(time, value);
    }
    if (this.accumulator?.enabled) {
      value = this.accumulator.getValue(time, value);
    }
    return value;
  }

  saveAsXML(): Element {
    const retVal = new Element('parameter');
    retVal.setAttribute('visible', String(this.visible));
    retVal.setAttribute('name', this.name);

    if (this.generator) {
      retVal.addElement(this.generator.saveAsXML());
    }
    if (this.mask) {
      retVal.addElement(this.mask.saveAsXML());
    }
    if (this.quantizer) {
      retVal.addElement(this.quantizer.saveAsXML());
    }
    if (this.accumulator) {
      retVal.addElement(this.accumulator.saveAsXML());
    }

    return retVal;
  }

  deepCopy(): Parameter {
    return new Parameter(this);
  }
}

const BUILTIN_GENERATOR_TYPES = new Set<Function>([
  Constant,
  Random,
  Oscillator,
  Segment,
  ItemList,
  Probability,
]);
const BUILTIN_DISTRIBUTION_TYPES = new Set<Function>([
  Uniform,
  Linear,
  Triangle,
  Exponential,
  Gaussian,
  Cauchy,
  Beta,
  Weibull,
]);

function canPrepareGenerator(generator: Generator | null): boolean {
  if (!generator) return true;
  if (
    !BUILTIN_GENERATOR_TYPES.has(generator.constructor) ||
    ['initialize', 'getValue', 'deepCopy'].some((method) => Object.hasOwn(generator, method))
  )
    return false;
  if (generator.constructor !== Probability) return true;
  const distribution = (generator as Probability).getSelectedProbabilityGenerator();
  return (
    distribution !== undefined &&
    BUILTIN_DISTRIBUTION_TYPES.has(distribution.constructor) &&
    !Object.hasOwn(distribution, 'getValue') &&
    !Object.hasOwn(distribution, 'deepCopy')
  );
}

function prepareTableOwner<T extends object>(owner: T): T {
  const view: T = Object.create(owner);
  for (const [key, value] of Object.entries(owner)) {
    if (value instanceof Table) {
      Object.defineProperty(view, key, { value: value.prepareForGeneration() });
    }
  }
  return view;
}

function prepareGenerator(generator: Generator, duration: number): Generator {
  switch (generator.constructor) {
    case Constant:
    case Random:
      return generator;
    case Segment: {
      const source = generator as Segment;
      // Segment.initialize normally stretches its copied points in place.
      return Object.assign(Object.create(source), {
        table: source.table.prepareForGeneration(duration),
        initialize() {},
      });
    }
    case ItemList: {
      const source = generator as ItemList;
      // Heap mode is the only mode that rewrites the authored ordering.
      return Object.assign(Object.create(source), {
        listItems: source.listType === ItemList.HEAP ? [...source.listItems] : source.listItems,
        index: 0,
        direction: 0,
      });
    }
    case Probability: {
      const source = generator as Probability;
      return Object.assign(Object.create(source), {
        generators: [prepareTableOwner(source.getSelectedProbabilityGenerator())],
        selectedIndex: 0,
        duration: 0,
      });
    }
    default:
      return prepareTableOwner(generator);
  }
}

export type JMaskGenerationMode = 1 | 2;

export class Field {
  parameters: Parameter[] = [];

  constructor(other?: Field | boolean) {
    if (other instanceof Field) {
      this.parameters = other.parameters.map((parameter) => new Parameter(parameter));
      return;
    }

    if (other !== false) {
      this.parameters.push(Parameter.create(new Constant()));
      this.parameters.push(Parameter.create(new Constant()));
      this.parameters.push(Parameter.create(new Constant()));
      this.parameters[0]!.name = 'Instrument ID';
      this.parameters[1]!.name = 'Start';
      this.parameters[2]!.name = 'Duration';
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Field {
    validateJmaskXml(data, 'Field', context);
    const field = new Field(false);
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'parameter') {
        field.parameters.push(Parameter.loadFromXML(node));
      }
    }

    return field;
  }

  getSize(): number {
    return this.parameters.length;
  }

  getElementAt(index: number): Parameter {
    return this.parameters[index]!;
  }

  getParameter(index: number): Parameter {
    return this.parameters[index]!;
  }

  addParameterBefore(index: number, generator: Generator): void {
    this.parameters.splice(index, 0, Parameter.create(generator));
  }

  addParameterAfter(index: number, generator: Generator): void {
    this.parameters.splice(index + 1, 0, Parameter.create(generator));
  }

  removeParameter(index: number): Parameter | null {
    if (index < 0 || index >= this.parameters.length) {
      return null;
    }
    return this.parameters.splice(index, 1)[0] ?? null;
  }

  pushUp(index: number): void {
    if (index > 0 && index < this.parameters.length) {
      const value = this.parameters.splice(index, 1)[0]!;
      this.parameters.splice(index - 1, 0, value);
    }
  }

  pushDown(index: number): void {
    if (index >= 0 && index < this.parameters.length - 1) {
      const value = this.parameters.splice(index + 1, 1)[0]!;
      this.parameters.splice(index, 0, value);
    }
  }

  changeParameter(index: number, generator: Generator): void {
    if (index < 0 || index >= this.parameters.length) {
      return;
    }

    const oldParameter = this.parameters[index]!;
    const parameter = Parameter.create(generator);
    parameter.name = oldParameter.name;
    parameter.visible = oldParameter.visible;
    this.parameters[index] = parameter;
  }

  /** Generate on an isolated copy because generators retain per-run state. */
  generateNotesFromCopy(
    duration: number,
    rnd: JavaRandom,
    mode: JMaskGenerationMode = 1,
  ): NoteList {
    const field = new Field(false);
    if (
      this.parameters.every(
        ({ generator, mask, quantizer, accumulator }) =>
          canPrepareGenerator(generator) &&
          (!mask || mask.constructor === Mask) &&
          (!quantizer || quantizer.constructor === Quantizer) &&
          (!accumulator || accumulator.constructor === Accumulator),
      )
    ) {
      field.parameters = this.parameters.map(({ generator, mask, quantizer, accumulator }) => {
        const run = new Parameter();
        if (generator) run.generator = prepareGenerator(generator, duration);
        if (mask?.enabled) run.mask = prepareTableOwner(mask);
        if (quantizer?.enabled) run.quantizer = prepareTableOwner(quantizer);
        if (accumulator?.enabled) {
          run.accumulator = prepareTableOwner(accumulator);
          run.accumulator.runningValue = 0;
          run.accumulator.firstTime = true;
        }
        return run;
      });
    } else {
      // Custom generators still own their copy and initialization semantics.
      field.parameters = this.parameters.map((parameter) => new Parameter(parameter, true));
    }
    return field.generateNotes(duration, rnd, mode);
  }

  generateNotes(duration: number, rnd: JavaRandom, mode: JMaskGenerationMode = 1): NoteList {
    const noteList = new NoteList();
    if (this.parameters.length === 0) {
      return noteList;
    }

    const parameter2 = this.getParameter(1);
    if (parameter2.generator instanceof Constant && parameter2.generator.value <= 0.0) {
      throw new Error('Error: JMask p2 Constant field must use value > 0.0.');
    }

    for (const parameter of this.parameters) {
      parameter.initialize(duration);
    }

    let xt = 0.0;
    let stepError = 0;
    const numFields = this.parameters.length;

    while (xt < duration) {
      const start = formatBlueNumber(xt);
      // Accumulated step error can put xt below the end even when p2 rounds to it.
      if (mode === 2 && Number(start) >= duration) break;

      const note = Note.createNote(numFields);
      const p1 = Math.max(1, this.getParameter(0).getValue(xt, rnd));
      const instrument = mode === 1 ? roundTo(p1, 0) : p1;
      const instrumentText =
        Number.isFinite(instrument) && !Number.isInteger(instrument)
          ? String(instrument)
          : formatBlueNumber(instrument);
      note.setPField(instrumentText, 1);
      note.setPField(start, 2);

      for (let index = 3; index < numFields + 1; index += 1) {
        const value = this.getParameter(index - 1).getValue(xt, rnd);
        if (index === 3 && value < 0) {
          note.setPField(formatBlueNumber(-value), index);
          note.setTied(true);
        } else {
          note.setPField(formatBlueNumber(value), index);
        }
      }

      const p2 = this.getParameter(1).getValue(xt, rnd);
      if (!Number.isFinite(p2) || p2 <= 0.0) {
        console.warn('[JMask] p2 <= 0; stopping generation to avoid an infinite loop.');
        break;
      }

      if (mode === 2) {
        // Compensate for rounding across steps so an exact end stays at the boundary.
        const adjustedStep = p2 - stepError;
        const nextStart = xt + adjustedStep;
        stepError = nextStart - xt - adjustedStep;
        xt = nextStart;
      } else {
        xt += p2;
      }
      noteList.add(note);
    }

    return noteList;
  }

  saveAsXML(): Element {
    const retVal = new Element('field');
    for (const parameter of this.parameters) {
      retVal.addElement(parameter.saveAsXML());
    }
    return retVal;
  }

  deepCopy(): Field {
    return new Field(this);
  }
}
