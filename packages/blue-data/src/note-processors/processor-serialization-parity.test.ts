import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { NoteProcessorChain } from './note-processor-chain';
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
import { PythonProcessor } from './python-processor';
import { UnsupportedProcessor } from './unsupported-processor';
import { getNoteProcessorCatalog } from './note-processor-catalog';

const JAVA_PREFIX = 'blue.noteProcessor.';

const PROCESSOR_XML_CASES: Array<{
  type: string;
  createProc: () => InstanceType<typeof AddProcessor>;
}> = [
  { type: 'AddProcessor', createProc: () => new AddProcessor() as any },
  { type: 'MultiplyProcessor', createProc: () => new MultiplyProcessor() as any },
  { type: 'RandomAddProcessor', createProc: () => new RandomAddProcessor() as any },
  { type: 'RandomMultiplyProcessor', createProc: () => new RandomMultiplyProcessor() as any },
  { type: 'SubListProcessor', createProc: () => new SubListProcessor() as any },
  { type: 'RotateProcessor', createProc: () => new RotateProcessor() as any },
  { type: 'RetrogradeProcessor', createProc: () => new RetrogradeProcessor() as any },
  { type: 'InversionProcessor', createProc: () => new InversionProcessor() as any },
  { type: 'PchAddProcessor', createProc: () => new PchAddProcessor() as any },
  { type: 'PchInversionProcessor', createProc: () => new PchInversionProcessor() as any },
  { type: 'EqualsProcessor', createProc: () => new EqualsProcessor() as any },
  { type: 'SwitchProcessor', createProc: () => new SwitchProcessor() as any },
  { type: 'TimeWarpProcessor', createProc: () => new TimeWarpProcessor() as any },
  { type: 'LineAddProcessor', createProc: () => new LineAddProcessor() as any },
  { type: 'LineMultiplyProcessor', createProc: () => new LineMultiplyProcessor() as any },
  { type: 'TuningProcessor', createProc: () => new TuningProcessor() as any },
];

describe('Processor serialization parity', () => {
  for (const { type, createProc } of PROCESSOR_XML_CASES) {
    describe(type, () => {
      it(`emits Java-compatible type attribute`, () => {
        const proc = createProc();
        const xml = proc.saveAsXML();
        expect(xml.getAttribute('type')).toBe(`${JAVA_PREFIX}${type}`);
      });

      it(`round-trips through XML`, () => {
        const chain = new NoteProcessorChain();
        chain.addProcessor(createProc());
        const xml = chain.saveAsXML();
        const restored = NoteProcessorChain.loadFromXML(xml);
        expect(restored.getProcessors()).toHaveLength(1);
        expect(restored.getProcessors()[0].constructor.name).toBe(type);
      });

      it(`deep copies correctly`, () => {
        const proc = createProc();
        const copy = proc.deepCopy();
        expect(copy.constructor.name).toBe(type);
        const origXml = proc.saveAsXML().toXml();
        const copyXml = copy.saveAsXML().toXml();
        expect(copyXml).toBe(origXml);
      });
    });
  }

  it('loads from Java full class name XML', () => {
    for (const { type, createProc } of PROCESSOR_XML_CASES) {
      const proc = createProc();
      const elem = proc.saveAsXML();
      const chainXml = new Element('noteProcessorChain');
      chainXml.addElement(elem);
      const chain = NoteProcessorChain.loadFromXML(chainXml);
      expect(chain.getProcessors()[0].constructor.name).toBe(type);
    }
  });

  it('loads PythonProcessor as a supported runtime-backed processor', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.PythonProcessor">
          <code>print("hello")</code>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    expect(chain.getProcessors()).toHaveLength(1);
    const proc = chain.getProcessors()[0];
    expect(proc).toBeInstanceOf(PythonProcessor);
    expect(chain.saveAsXML().toXml()).toBe(xml.toXml());
  });

  it('preserves legacy Code XML as UnsupportedProcessor', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.Code">
          <code>some code</code>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    expect(chain.getProcessors()).toHaveLength(1);
    expect(chain.getProcessors()[0]).toBeInstanceOf(UnsupportedProcessor);
    expect(chain.saveAsXML().toXml()).toBe(xml.toXml());
  });
});

describe('Catalog completeness', () => {
  it('catalog contains all 17 in-scope processor types', () => {
    const catalog = getNoteProcessorCatalog();
    expect(catalog).toHaveLength(17);
    const types = catalog.map((d) => d.type);
    expect(types).toContain('AddProcessor');
    expect(types).toContain('MultiplyProcessor');
    expect(types).toContain('RandomAddProcessor');
    expect(types).toContain('RandomMultiplyProcessor');
    expect(types).toContain('SubListProcessor');
    expect(types).toContain('RotateProcessor');
    expect(types).toContain('RetrogradeProcessor');
    expect(types).toContain('InversionProcessor');
    expect(types).toContain('PchAddProcessor');
    expect(types).toContain('PchInversionProcessor');
    expect(types).toContain('EqualsProcessor');
    expect(types).toContain('SwitchProcessor');
    expect(types).toContain('TimeWarpProcessor');
    expect(types).toContain('LineAddProcessor');
    expect(types).toContain('LineMultiplyProcessor');
    expect(types).toContain('TuningProcessor');
    expect(types).toContain('PythonProcessor');
  });

  it('catalog does not include legacy Code', () => {
    const catalog = getNoteProcessorCatalog();
    const types = catalog.map((d) => d.type);
    expect(types).not.toContain('Code');
  });

  it('catalog is sorted by Java plugin position', () => {
    const catalog = getNoteProcessorCatalog();
    for (let i = 1; i < catalog.length; i++) {
      expect(catalog[i].position).toBeGreaterThan(catalog[i - 1].position);
    }
  });
});
