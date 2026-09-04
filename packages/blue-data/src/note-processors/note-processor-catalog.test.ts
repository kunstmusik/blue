import { describe, expect, it } from 'vitest';
import {
  getNoteProcessorCatalog,
  getNoteProcessorDefinition,
  isAddableProcessor,
} from './note-processor-catalog';
import { AddProcessor } from './add-processor';
import { MultiplyProcessor } from './multiply-processor';
import { PythonProcessor } from './python-processor';

describe('Note processor catalog', () => {
  it('has 17 in-scope processors', () => {
    expect(getNoteProcessorCatalog()).toHaveLength(17);
  });

  it('creates default instances for each processor type', () => {
    for (const def of getNoteProcessorCatalog()) {
      const proc = def.createDefault();
      expect(proc).toBeDefined();
      expect(proc.getDisplayName()).toBe(def.displayName);
    }
  });

  it('looks up definition by type', () => {
    const def = getNoteProcessorDefinition('AddProcessor');
    expect(def).toBeDefined();
    expect(def!.type).toBe('AddProcessor');
    expect(def!.position).toBe(10);

    const pyDef = getNoteProcessorDefinition('PythonProcessor');
    expect(pyDef).toBeDefined();
    expect(pyDef!.type).toBe('PythonProcessor');
    expect(pyDef!.position).toBe(170);
  });

  it('returns undefined for unknown type', () => {
    expect(getNoteProcessorDefinition('Unknown')).toBeUndefined();
  });

  it('isAddableProcessor returns true for in-scope types including PythonProcessor', () => {
    expect(isAddableProcessor('AddProcessor')).toBe(true);
    expect(isAddableProcessor('MultiplyProcessor')).toBe(true);
    expect(isAddableProcessor('PythonProcessor')).toBe(true);
  });

  it('isAddableProcessor returns false for legacy Code', () => {
    expect(isAddableProcessor('Code')).toBe(false);
  });

  it('definitions have correct parameter counts', () => {
    expect(getNoteProcessorDefinition('AddProcessor')!.parameters).toHaveLength(2);
    expect(getNoteProcessorDefinition('RetrogradeProcessor')!.parameters).toHaveLength(0);
    expect(getNoteProcessorDefinition('RandomAddProcessor')!.parameters).toHaveLength(5);
    expect(getNoteProcessorDefinition('TuningProcessor')!.parameters).toHaveLength(3);
    expect(getNoteProcessorDefinition('TuningProcessor')!.parameters[2]!.valueType).toBe(
      'multilineText',
    );
    expect(getNoteProcessorDefinition('PythonProcessor')!.parameters).toHaveLength(1);
    expect(getNoteProcessorDefinition('PythonProcessor')!.parameters[0]!.valueType).toBe('code');
    expect(getNoteProcessorDefinition('PythonProcessor')!.parameters[0]!.defaultValue).toContain(
      'for note in noteList:',
    );
    const pyInstance = getNoteProcessorDefinition(
      'PythonProcessor',
    )!.createDefault() as PythonProcessor;
    expect(pyInstance.getCode()).toContain('note.setPField(str(p3 * 0.95), 3)');
  });
});
