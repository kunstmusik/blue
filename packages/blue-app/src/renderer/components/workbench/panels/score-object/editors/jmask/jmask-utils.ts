export type FieldSnapshot = Record<string, unknown>;
export type ParameterSnapshot = Record<string, unknown>;
export type GeneratorSnapshot = Record<string, unknown>;
export type TableSnapshot = Record<string, unknown>;
export type MaskSnapshot = Record<string, unknown>;
export type QuantizerSnapshot = Record<string, unknown>;
export type AccumulatorSnapshot = Record<string, unknown>;

export const GENERATOR_REGISTRY = [
  'Constant',
  'Item List',
  'Segment',
  'Random',
  'Probability',
  'Oscillator',
] as const;

export type GeneratorKind =
  | 'Constant'
  | 'ItemList'
  | 'Segment'
  | 'Random'
  | 'Probability'
  | 'Oscillator';

const MASKABLE_GENERATORS: ReadonlySet<string> = new Set(['Oscillator', 'Probability']);
const QUANTIZABLE_GENERATORS: ReadonlySet<string> = new Set([
  'Random',
  'Oscillator',
  'Segment',
  'Probability',
]);
const ACCUMULATABLE_GENERATORS: ReadonlySet<string> = new Set([
  'Constant',
  'Random',
  'Oscillator',
  'Segment',
  'ItemList',
  'Probability',
]);

export function getGeneratorKind(gen: GeneratorSnapshot | null | undefined): string {
  if (!gen) return '';
  return typeof gen.kind === 'string' ? gen.kind : '';
}

export function supportsMask(gen: GeneratorSnapshot | null | undefined): boolean {
  return MASKABLE_GENERATORS.has(getGeneratorKind(gen));
}

export function supportsQuantizer(gen: GeneratorSnapshot | null | undefined): boolean {
  return QUANTIZABLE_GENERATORS.has(getGeneratorKind(gen));
}

export function supportsAccumulator(gen: GeneratorSnapshot | null | undefined): boolean {
  return ACCUMULATABLE_GENERATORS.has(getGeneratorKind(gen));
}

export function getParameters(field: FieldSnapshot): ParameterSnapshot[] {
  return (field.parameters as ParameterSnapshot[]) ?? [];
}

export function cloneField(field: FieldSnapshot): FieldSnapshot {
  return structuredClone(field);
}

export function mapParameterInField(
  field: FieldSnapshot,
  index: number,
  mapper: (param: ParameterSnapshot) => ParameterSnapshot,
): FieldSnapshot {
  const next = cloneField(field);
  const params = getParameters(next);
  if (index >= 0 && index < params.length) {
    params[index] = mapper(params[index]!);
  }
  return next;
}

export function createDefaultGeneratorSnapshot(registryName: string): GeneratorSnapshot {
  const kind = registryNameToKind(registryName);
  switch (kind) {
    case 'Constant':
      return { kind: 'Constant', value: 1.0 };
    case 'ItemList':
      return { kind: 'ItemList', listType: 0, listItems: [], index: 0, direction: 0 };
    case 'Segment':
      return {
        kind: 'Segment',
        table: {
          kind: 'Table',
          points: [
            { kind: 'TablePoint', time: 0, value: 0.5 },
            { kind: 'TablePoint', time: 1, value: 0.5 },
          ],
          min: 0,
          max: 1,
          interpolationType: 1,
          interpolation: 0,
        },
      };
    case 'Random':
      return { kind: 'Random', min: 0, max: 1 };
    case 'Probability':
      return {
        kind: 'Probability',
        selectedIndex: 0,
        generators: [
          { kind: 'Uniform' },
          { kind: 'Linear', direction: 0 },
          { kind: 'Triangle' },
          {
            kind: 'Exponential',
            direction: 0,
            lambda: 0.5,
            lambdaTableEnabled: false,
            lambdaTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.0001 },
                { kind: 'TablePoint', time: 1, value: 0.0001 },
              ],
              min: 0.0001,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
          },
          {
            kind: 'Gaussian',
            sigma: 0.1,
            mu: 0.5,
            sigmaTableEnabled: false,
            muTableEnabled: false,
            sigmaTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.1 },
                { kind: 'TablePoint', time: 1, value: 0.1 },
              ],
              min: 0,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
            muTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.5 },
                { kind: 'TablePoint', time: 1, value: 0.5 },
              ],
              min: 0,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
          },
          {
            kind: 'Cauchy',
            alpha: 0.1,
            mu: 0.5,
            alphaTableEnabled: false,
            muTableEnabled: false,
            alphaTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.1 },
                { kind: 'TablePoint', time: 1, value: 0.1 },
              ],
              min: 0,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
            muTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.5 },
                { kind: 'TablePoint', time: 1, value: 0.5 },
              ],
              min: 0,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
          },
          {
            kind: 'Beta',
            a: 0.1,
            b: 0.1,
            aTableEnabled: false,
            bTableEnabled: false,
            aTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.1 },
                { kind: 'TablePoint', time: 1, value: 0.1 },
              ],
              min: 0,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
            bTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.1 },
                { kind: 'TablePoint', time: 1, value: 0.1 },
              ],
              min: 0,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
          },
          {
            kind: 'Weibull',
            s: 0.5,
            t: 2.0,
            sTableEnabled: false,
            tTableEnabled: false,
            sTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 0.5 },
                { kind: 'TablePoint', time: 1, value: 0.5 },
              ],
              min: 0,
              max: 1,
              interpolationType: 1,
              interpolation: 0,
            },
            tTable: {
              kind: 'Table',
              points: [
                { kind: 'TablePoint', time: 0, value: 2.0 },
                { kind: 'TablePoint', time: 1, value: 2.0 },
              ],
              min: 0.001,
              max: 4,
              interpolationType: 1,
              interpolation: 0,
            },
          },
        ],
      };
    case 'Oscillator':
      return {
        kind: 'Oscillator',
        oscillatorType: 0,
        phaseInit: 0,
        frequency: 1,
        freqTableEnabled: false,
        exponent: 1,
        freqTable: {
          kind: 'Table',
          points: [
            { kind: 'TablePoint', time: 0, value: 1 },
            { kind: 'TablePoint', time: 1, value: 1 },
          ],
          min: 0.001,
          max: 10,
          interpolationType: 1,
          interpolation: 0,
        },
      };
    default:
      return { kind: 'Constant', value: 1.0 };
  }
}

export function createDefaultMaskSnapshot(): MaskSnapshot {
  return {
    kind: 'Mask',
    high: 1,
    low: 0,
    mapValue: 0,
    highTableEnabled: false,
    lowTableEnabled: false,
    highTable: {
      kind: 'Table',
      points: [
        { kind: 'TablePoint', time: 0, value: 1 },
        { kind: 'TablePoint', time: 1, value: 1 },
      ],
      min: 0,
      max: 1,
      interpolationType: 1,
      interpolation: 0,
    },
    lowTable: {
      kind: 'Table',
      points: [
        { kind: 'TablePoint', time: 0, value: 0 },
        { kind: 'TablePoint', time: 1, value: 0 },
      ],
      min: 0,
      max: 1,
      interpolationType: 1,
      interpolation: 0,
    },
    enabled: false,
  };
}

export function createDefaultQuantizerSnapshot(): QuantizerSnapshot {
  return {
    kind: 'Quantizer',
    gridSize: 1,
    strength: 1,
    offset: 0,
    gridSizeTableEnabled: false,
    strengthTableEnabled: false,
    offsetTableEnabled: false,
    gridSizeTable: {
      kind: 'Table',
      points: [
        { kind: 'TablePoint', time: 0, value: 1 },
        { kind: 'TablePoint', time: 1, value: 1 },
      ],
      min: Number.MIN_VALUE,
      max: 1,
      interpolationType: 1,
      interpolation: 0,
    },
    strengthTable: {
      kind: 'Table',
      points: [
        { kind: 'TablePoint', time: 0, value: 1 },
        { kind: 'TablePoint', time: 1, value: 1 },
      ],
      min: 0,
      max: 1,
      interpolationType: 1,
      interpolation: 0,
    },
    offsetTable: {
      kind: 'Table',
      points: [
        { kind: 'TablePoint', time: 0, value: 0 },
        { kind: 'TablePoint', time: 1, value: 0 },
      ],
      min: 0,
      max: 1,
      interpolationType: 1,
      interpolation: 0,
    },
    enabled: false,
  };
}

export function createDefaultAccumulatorSnapshot(): AccumulatorSnapshot {
  return {
    kind: 'Accumulator',
    highTable: {
      kind: 'Table',
      points: [
        { kind: 'TablePoint', time: 0, value: 1 },
        { kind: 'TablePoint', time: 1, value: 1 },
      ],
      min: 0,
      max: 1,
      interpolationType: 1,
      interpolation: 0,
    },
    lowTable: {
      kind: 'Table',
      points: [
        { kind: 'TablePoint', time: 0, value: 0 },
        { kind: 'TablePoint', time: 1, value: 0 },
      ],
      min: 0,
      max: 1,
      interpolationType: 1,
      interpolation: 0,
    },
    highTableEnabled: false,
    lowTableEnabled: false,
    mode: 0,
    low: 0,
    high: 1,
    initialValue: 0,
    enabled: false,
  };
}

export function registryNameToKind(name: string): GeneratorKind {
  switch (name) {
    case 'Constant':
      return 'Constant';
    case 'Item List':
      return 'ItemList';
    case 'ItemList':
      return 'ItemList';
    case 'Segment':
      return 'Segment';
    case 'Random':
      return 'Random';
    case 'Probability':
      return 'Probability';
    case 'Oscillator':
      return 'Oscillator';
    default:
      return 'Constant';
  }
}

export function kindToRegistryName(kind: string): string {
  switch (kind) {
    case 'Constant':
      return 'Constant';
    case 'ItemList':
      return 'Item List';
    case 'Segment':
      return 'Segment';
    case 'Random':
      return 'Random';
    case 'Probability':
      return 'Probability';
    case 'Oscillator':
      return 'Oscillator';
    default:
      return 'Constant';
  }
}

export function ensureModifier<T extends Record<string, unknown>>(
  existing: T | null | undefined,
  defaultValue: T,
  enabled: boolean,
): T {
  if (existing) {
    return { ...structuredClone(existing), enabled };
  }
  return { ...structuredClone(defaultValue), enabled };
}

export function createDefaultParameterSnapshot(generatorName: string): ParameterSnapshot {
  const generator = createDefaultGeneratorSnapshot(generatorName);
  return {
    kind: 'Parameter',
    visible: true,
    name: '',
    generator,
    mask: supportsMask(generator) ? createDefaultMaskSnapshot() : null,
    quantizer: supportsQuantizer(generator) ? createDefaultQuantizerSnapshot() : null,
    accumulator: supportsAccumulator(generator) ? createDefaultAccumulatorSnapshot() : null,
  };
}
