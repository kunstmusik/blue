import { AddProcessor } from './add-processor';
import { MultiplyProcessor } from './multiply-processor';
import { RandomAddProcessor } from './random-add-processor';
import { RandomMultiplyProcessor } from './random-multiply-processor';
import { SubListProcessor } from './sublist-processor';
import { RotateProcessor } from './rotate-processor';
import { RetrogradeProcessor } from './retrograde-processor';
import { InversionProcessor } from './inversion-processor';
import { PchAddProcessor } from './pch-add-processor';
import { PchInversionProcessor } from './pch-inversion-processor';
import { EqualsProcessor } from './equals-processor';
import { SwitchProcessor } from './switch-processor';
import { TimeWarpProcessor } from './time-warp-processor';
import { LineAddProcessor } from './line-add-processor';
import { LineMultiplyProcessor } from './line-multiply-processor';
import { TuningProcessor } from './tuning-processor';
import { PythonProcessor, DEFAULT_PYTHON_PROCESSOR_CODE } from './python-processor';
import { NoteProcessor } from './note-processor';

export type ParameterValueType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'multilineText'
  | 'code';

export interface NoteProcessorParameterDefinition {
  name: string;
  label: string;
  valueType: ParameterValueType;
  defaultValue: string | number | boolean;
  required: boolean;
}

export interface NoteProcessorDefinition {
  type: string;
  displayName: string;
  position: number;
  parameters: NoteProcessorParameterDefinition[];
  createDefault: () => NoteProcessor;
}

const DEFAULT_TWELVE_TET_RATIOS = Array.from({ length: 12 }, (_unused, i) =>
  Math.pow(2, i / 12).toString(),
).join('\n');

const CATALOG: NoteProcessorDefinition[] = [
  {
    type: 'AddProcessor',
    displayName: 'AddProcessor',
    position: 10,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'val', label: 'Value', valueType: 'number', defaultValue: '0', required: true },
    ],
    createDefault: () => new AddProcessor(),
  },
  {
    type: 'PchAddProcessor',
    displayName: 'PchAddProcessor',
    position: 20,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'val', label: 'Value', valueType: 'integer', defaultValue: '0', required: true },
    ],
    createDefault: () => new PchAddProcessor(),
  },
  {
    type: 'MultiplyProcessor',
    displayName: 'MultiplyProcessor',
    position: 30,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'val', label: 'Value', valueType: 'number', defaultValue: '1', required: true },
    ],
    createDefault: () => new MultiplyProcessor(),
  },
  {
    type: 'RandomAddProcessor',
    displayName: 'RandomAddProcessor',
    position: 40,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'min', label: 'Min', valueType: 'number', defaultValue: '0', required: true },
      { name: 'max', label: 'Max', valueType: 'number', defaultValue: '1', required: true },
      {
        name: 'seedUsed',
        label: 'Use Seed',
        valueType: 'boolean',
        defaultValue: false,
        required: true,
      },
      { name: 'seed', label: 'Seed', valueType: 'integer', defaultValue: '0', required: false },
    ],
    createDefault: () => new RandomAddProcessor(),
  },
  {
    type: 'RandomMultiplyProcessor',
    displayName: 'RandomMultiplyProcessor',
    position: 50,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'min', label: 'Min', valueType: 'number', defaultValue: '0', required: true },
      { name: 'max', label: 'Max', valueType: 'number', defaultValue: '1', required: true },
      {
        name: 'seedUsed',
        label: 'Use Seed',
        valueType: 'boolean',
        defaultValue: false,
        required: true,
      },
      { name: 'seed', label: 'Seed', valueType: 'integer', defaultValue: '0', required: false },
    ],
    createDefault: () => new RandomMultiplyProcessor(),
  },
  {
    type: 'SubListProcessor',
    displayName: 'SubListProcessor',
    position: 60,
    parameters: [
      { name: 'start', label: 'Start', valueType: 'integer', defaultValue: '1', required: true },
      { name: 'end', label: 'End', valueType: 'integer', defaultValue: '2', required: true },
    ],
    createDefault: () => new SubListProcessor(),
  },
  {
    type: 'RotateProcessor',
    displayName: 'RotateProcessor',
    position: 70,
    parameters: [
      {
        name: 'noteIndex',
        label: 'Note Index',
        valueType: 'integer',
        defaultValue: '1',
        required: true,
      },
    ],
    createDefault: () => new RotateProcessor(),
  },
  {
    type: 'RetrogradeProcessor',
    displayName: 'RetrogradeProcessor',
    position: 80,
    parameters: [],
    createDefault: () => new RetrogradeProcessor(),
  },
  {
    type: 'InversionProcessor',
    displayName: 'InversionProcessor',
    position: 90,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'val', label: 'Value', valueType: 'number', defaultValue: '10', required: true },
    ],
    createDefault: () => new InversionProcessor(),
  },
  {
    type: 'PchInversionProcessor',
    displayName: 'PchInversionProcessor',
    position: 100,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'val', label: 'Value', valueType: 'number', defaultValue: '8.00', required: true },
    ],
    createDefault: () => new PchInversionProcessor(),
  },
  {
    type: 'EqualsProcessor',
    displayName: 'EqualsProcessor',
    position: 110,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      { name: 'val', label: 'Value', valueType: 'string', defaultValue: '2.0', required: true },
    ],
    createDefault: () => new EqualsProcessor(),
  },
  {
    type: 'SwitchProcessor',
    displayName: 'SwitchProcessor',
    position: 120,
    parameters: [
      {
        name: 'pfield1',
        label: 'P Field 1',
        valueType: 'integer',
        defaultValue: '4',
        required: true,
      },
      {
        name: 'pfield2',
        label: 'P Field 2',
        valueType: 'integer',
        defaultValue: '5',
        required: true,
      },
    ],
    createDefault: () => new SwitchProcessor(),
  },
  {
    type: 'TimeWarpProcessor',
    displayName: 'TimeWarpProcessor',
    position: 130,
    parameters: [
      {
        name: 'timeWarpString',
        label: 'Time Warp',
        valueType: 'string',
        defaultValue: '0 60',
        required: true,
      },
    ],
    createDefault: () => new TimeWarpProcessor(),
  },
  {
    type: 'LineAddProcessor',
    displayName: 'LineAddProcessor',
    position: 140,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      {
        name: 'lineAddString',
        label: 'Line',
        valueType: 'string',
        defaultValue: '0 0',
        required: true,
      },
    ],
    createDefault: () => new LineAddProcessor(),
  },
  {
    type: 'LineMultiplyProcessor',
    displayName: 'LineMultiplyProcessor',
    position: 150,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      {
        name: 'lineMultiplyString',
        label: 'Line',
        valueType: 'string',
        defaultValue: '0 1',
        required: true,
      },
    ],
    createDefault: () => new LineMultiplyProcessor(),
  },
  {
    type: 'TuningProcessor',
    displayName: 'TuningProcessor',
    position: 160,
    parameters: [
      { name: 'pfield', label: 'P Field', valueType: 'integer', defaultValue: '4', required: true },
      {
        name: 'baseFrequency',
        label: 'Base Frequency',
        valueType: 'number',
        defaultValue: '261.626',
        required: true,
      },
      {
        name: 'ratios',
        label: 'Scale Ratios',
        valueType: 'multilineText',
        defaultValue: DEFAULT_TWELVE_TET_RATIOS,
        required: true,
      },
    ],
    createDefault: () => new TuningProcessor(),
  },
  {
    type: 'PythonProcessor',
    displayName: 'PythonProcessor',
    position: 170,
    parameters: [
      {
        name: 'code',
        label: 'Code',
        valueType: 'code',
        defaultValue: DEFAULT_PYTHON_PROCESSOR_CODE,
        required: false,
      },
    ],
    createDefault: () => {
      const proc = new PythonProcessor();
      proc.setCode(DEFAULT_PYTHON_PROCESSOR_CODE);
      return proc;
    },
  },
];

const CATALOG_MAP = new Map<string, NoteProcessorDefinition>();
for (const def of CATALOG) {
  CATALOG_MAP.set(def.type, def);
}

export function getNoteProcessorCatalog(): NoteProcessorDefinition[] {
  return CATALOG;
}

export function getNoteProcessorDefinition(type: string): NoteProcessorDefinition | undefined {
  return CATALOG_MAP.get(type);
}

export function isAddableProcessor(type: string): boolean {
  return CATALOG_MAP.has(type);
}
