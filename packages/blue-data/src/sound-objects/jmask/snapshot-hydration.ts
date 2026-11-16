import {
  type Generator,
  type ProbabilityGenerator,
  TablePoint,
  Table,
  DoubleOrTable,
  Mask,
  Quantizer,
  Accumulator,
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
import { Constant, Random, Oscillator, Segment, ItemList, Probability } from './generators';
import { Parameter, Field } from './field-parameter';

function loadSnapshotIntoObject<T extends object>(target: T, snapshot: Record<string, unknown>): T {
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === 'kind' || typeof value === 'function') {
      continue;
    }
    (target as Record<string, unknown>)[key] = loadJMaskSnapshotValue(value);
  }
  return target;
}

function loadParameterSnapshot(snapshot: Record<string, unknown>): Parameter {
  const parameter = new Parameter();

  const generatorSnapshot = snapshot.generator;
  if (generatorSnapshot !== undefined) {
    const generator = loadJMaskSnapshotValue(generatorSnapshot);
    if (generator && typeof generator === 'object') {
      parameter.setGenerator(generator as Generator);
    } else {
      parameter.setGenerator(new Constant());
    }
  } else {
    parameter.setGenerator(new Constant());
  }

  return loadSnapshotIntoObject(parameter, snapshot);
}

function loadFieldSnapshot(snapshot: Record<string, unknown>): Field {
  const field = new Field(false);
  return loadSnapshotIntoObject(field, snapshot);
}

function loadTablePointSnapshot(snapshot: Record<string, unknown>): TablePoint {
  return loadSnapshotIntoObject(new TablePoint(), snapshot);
}

function loadTableSnapshot(snapshot: Record<string, unknown>): Table {
  return loadSnapshotIntoObject(new Table(), snapshot);
}

function loadDoubleOrTableSnapshot(snapshot: Record<string, unknown>): DoubleOrTable {
  const value = typeof snapshot.value === 'number' ? snapshot.value : 0.0;
  return loadSnapshotIntoObject(new DoubleOrTable(value), snapshot);
}

function loadMaskSnapshot(snapshot: Record<string, unknown>): Mask {
  return loadSnapshotIntoObject(new Mask(), snapshot);
}

function loadQuantizerSnapshot(snapshot: Record<string, unknown>): Quantizer {
  return loadSnapshotIntoObject(new Quantizer(), snapshot);
}

function loadAccumulatorSnapshot(snapshot: Record<string, unknown>): Accumulator {
  return loadSnapshotIntoObject(new Accumulator(), snapshot);
}

function loadProbabilitySnapshot(snapshot: Record<string, unknown>): Probability {
  return loadSnapshotIntoObject(new Probability(), snapshot);
}

function loadGeneratorSnapshot(snapshot: Record<string, unknown>): Generator | null {
  const kind = typeof snapshot.kind === 'string' ? snapshot.kind : '';
  switch (kind) {
    case 'Constant':
      return loadSnapshotIntoObject(new Constant(), snapshot);
    case 'Random':
      return loadSnapshotIntoObject(new Random(), snapshot);
    case 'Oscillator':
      return loadSnapshotIntoObject(new Oscillator(), snapshot);
    case 'Segment':
      return loadSnapshotIntoObject(new Segment(), snapshot);
    case 'ItemList':
      return loadSnapshotIntoObject(new ItemList(), snapshot);
    case 'Probability':
      return loadProbabilitySnapshot(snapshot);
    default:
      return null;
  }
}

function loadProbabilityGeneratorSnapshot(
  snapshot: Record<string, unknown>,
): ProbabilityGenerator | null {
  const kind = typeof snapshot.kind === 'string' ? snapshot.kind : '';
  switch (kind) {
    case 'Uniform':
      return loadSnapshotIntoObject(new Uniform(), snapshot);
    case 'Linear':
      return loadSnapshotIntoObject(new Linear(), snapshot);
    case 'Triangle':
      return loadSnapshotIntoObject(new Triangle(), snapshot);
    case 'Exponential':
      return loadSnapshotIntoObject(new Exponential(), snapshot);
    case 'Gaussian':
      return loadSnapshotIntoObject(new Gaussian(), snapshot);
    case 'Cauchy':
      return loadSnapshotIntoObject(new Cauchy(), snapshot);
    case 'Beta':
      return loadSnapshotIntoObject(new Beta(), snapshot);
    case 'Weibull':
      return loadSnapshotIntoObject(new Weibull(), snapshot);
    default:
      return null;
  }
}

function loadJMaskSnapshotValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => loadJMaskSnapshotValue(entry));
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value;
  }
  if (valueType !== 'object') {
    return value;
  }

  const snapshot = value as Record<string, unknown>;
  const kind = typeof snapshot.kind === 'string' ? snapshot.kind : '';

  switch (kind) {
    case 'Field':
      return loadFieldSnapshot(snapshot);
    case 'Parameter':
      return loadParameterSnapshot(snapshot);
    case 'TablePoint':
      return loadTablePointSnapshot(snapshot);
    case 'Table':
      return loadTableSnapshot(snapshot);
    case 'DoubleOrTable':
      return loadDoubleOrTableSnapshot(snapshot);
    case 'Mask':
      return loadMaskSnapshot(snapshot);
    case 'Quantizer':
      return loadQuantizerSnapshot(snapshot);
    case 'Accumulator':
      return loadAccumulatorSnapshot(snapshot);
    case 'Probability':
      return loadProbabilitySnapshot(snapshot);
  }

  const generator = loadGeneratorSnapshot(snapshot);
  if (generator) {
    return generator;
  }

  const probabilityGenerator = loadProbabilityGeneratorSnapshot(snapshot);
  if (probabilityGenerator) {
    return probabilityGenerator;
  }

  const plainObject: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(snapshot)) {
    if (key === 'kind' || typeof childValue === 'function') {
      continue;
    }
    plainObject[key] = loadJMaskSnapshotValue(childValue);
  }
  if (kind) {
    plainObject.kind = kind;
  }
  return plainObject;
}

export function loadFieldFromSnapshot(snapshot: Record<string, unknown>): Field {
  return loadFieldSnapshot(snapshot);
}
