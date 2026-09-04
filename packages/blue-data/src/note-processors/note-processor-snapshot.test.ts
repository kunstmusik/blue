import { describe, expect, it, beforeEach } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { NoteProcessorChain } from './note-processor-chain';
import { AddProcessor } from './add-processor';
import { MultiplyProcessor } from './multiply-processor';
import { TuningProcessor } from './tuning-processor';
import {
  createNoteProcessorChainSnapshot,
  reifyChainFromSnapshot,
  resetSnapshotIdCounter,
} from './note-processor-snapshot';
import { PythonProcessor } from './python-processor';
import { UnsupportedProcessor } from './unsupported-processor';

describe('Note processor snapshot', () => {
  beforeEach(() => {
    resetSnapshotIdCounter();
  });

  it('creates snapshot from chain with supported processors', () => {
    const chain = new NoteProcessorChain();
    const add = new AddProcessor();
    add.setVal('5');
    chain.addProcessor(add);
    chain.addProcessor(new MultiplyProcessor());

    const snapshot = createNoteProcessorChainSnapshot(chain);
    expect(snapshot.processors).toHaveLength(2);
    expect(snapshot.processors[0].processorType).toBe('AddProcessor');
    expect(snapshot.processors[0].supported).toBe(true);
    expect(snapshot.processors[0].deferred).toBe(false);
    expect(snapshot.processors[0].parameters.val).toBe('5');
    expect(snapshot.processors[1].processorType).toBe('MultiplyProcessor');
    expect(snapshot.hasUnsupportedProcessors).toBe(false);
    expect(snapshot.hasDeferredProcessors).toBe(false);
  });

  it('creates snapshot marking PythonProcessor as supported', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.PythonProcessor">
          <code>print("hello")</code>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    const snapshot = createNoteProcessorChainSnapshot(chain);
    expect(snapshot.processors).toHaveLength(1);
    expect(snapshot.processors[0].supported).toBe(true);
    expect(snapshot.processors[0].deferred).toBe(false);
    expect(snapshot.processors[0].displayName).toBe('PythonProcessor');
    expect(snapshot.processors[0].parameters.code).toContain('print');
    expect(snapshot.hasDeferredProcessors).toBe(false);
    expect(snapshot.hasUnsupportedProcessors).toBe(false);
  });

  it('creates snapshot marking unknown processors as unsupported', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.SomeFutureProcessor">
          <data>test</data>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    const snapshot = createNoteProcessorChainSnapshot(chain);
    expect(snapshot.processors[0].supported).toBe(false);
    expect(snapshot.processors[0].deferred).toBe(false);
    expect(snapshot.hasUnsupportedProcessors).toBe(true);
  });

  it('preserves serializedXml for unsupported processors', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.SomeFutureProcessor">
          <code>print("hello")</code>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    const snapshot = createNoteProcessorChainSnapshot(chain);
    expect(snapshot.processors[0].serializedXml).toContain('SomeFutureProcessor');
    expect(snapshot.processors[0].serializedXml).toContain('print');
  });

  it('reifies supported processors from snapshot', () => {
    const chain = new NoteProcessorChain();
    const add = new AddProcessor();
    add.setVal('42');
    add.setPfield('5');
    chain.addProcessor(add);

    const snapshot = createNoteProcessorChainSnapshot(chain);
    const reified = reifyChainFromSnapshot(snapshot);
    expect(reified.getProcessors()).toHaveLength(1);
    expect(reified.getProcessors()[0]).toBeInstanceOf(AddProcessor);
    expect((reified.getProcessors()[0] as AddProcessor).getVal()).toBe('42');
    expect((reified.getProcessors()[0] as AddProcessor).getPfield()).toBe('5');
  });

  it('preserves TuningProcessor scale ratios through snapshot reification', () => {
    const chain = new NoteProcessorChain();
    const tuning = new TuningProcessor();
    tuning.setBaseFrequency('220');
    tuning.setRatios([1, 1.25, 1.5, 1.875]);
    chain.addProcessor(tuning);

    const snapshot = createNoteProcessorChainSnapshot(chain);
    expect(snapshot.processors[0].parameters.baseFrequency).toBe('220');
    expect(snapshot.processors[0].parameters.ratios).toBe('1\n1.25\n1.5\n1.875');

    const reified = reifyChainFromSnapshot(snapshot);
    const reifiedTuning = reified.getProcessors()[0] as TuningProcessor;
    expect(reifiedTuning).toBeInstanceOf(TuningProcessor);
    expect(reifiedTuning.getBaseFrequency()).toBe('220');
    expect(reifiedTuning.getRatios()).toEqual([1, 1.25, 1.5, 1.875]);
    expect(reifiedTuning.saveAsXML().toXml()).toContain('1.875');
  });

  it('reifies supported PythonProcessor from snapshot', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.PythonProcessor">
          <code>print("hello")</code>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    const snapshot = createNoteProcessorChainSnapshot(chain);
    const reified = reifyChainFromSnapshot(snapshot);
    expect(reified.getProcessors()).toHaveLength(1);
    expect(reified.getProcessors()[0]).toBeInstanceOf(PythonProcessor);
    expect((reified.getProcessors()[0] as PythonProcessor).getCode()).toContain('print');
  });

  it('round-trips a mixed chain through snapshot and reification', () => {
    const xml = Element.parse(`
      <noteProcessorChain>
        <noteProcessor type="blue.noteProcessor.AddProcessor">
          <pfield>4</pfield>
          <value>10</value>
        </noteProcessor>
        <noteProcessor type="blue.noteProcessor.PythonProcessor">
          <code>x = 1</code>
        </noteProcessor>
        <noteProcessor type="blue.noteProcessor.MultiplyProcessor">
          <pfield>4</pfield>
          <value>2</value>
        </noteProcessor>
      </noteProcessorChain>
    `);
    const chain = NoteProcessorChain.loadFromXML(xml);
    const snapshot = createNoteProcessorChainSnapshot(chain);
    const reified = reifyChainFromSnapshot(snapshot);

    expect(reified.getProcessors()).toHaveLength(3);
    expect(reified.getProcessors()[0]).toBeInstanceOf(AddProcessor);
    expect(reified.getProcessors()[1]).toBeInstanceOf(PythonProcessor);
    expect(reified.getProcessors()[2]).toBeInstanceOf(MultiplyProcessor);
  });

  it('reifies older deferred PythonProcessor snapshots into supported processors', () => {
    const reified = reifyChainFromSnapshot({
      processors: [
        {
          id: 'np-legacy',
          processorType: 'blue.noteProcessor.PythonProcessor',
          displayName: 'PythonProcessor (deferred)',
          supported: false,
          deferred: true,
          summary: 'PythonProcessor (deferred)',
          parameters: {},
          serializedXml:
            '<noteProcessor type="blue.noteProcessor.PythonProcessor"><code>x = 1</code></noteProcessor>',
        },
      ],
      hasUnsupportedProcessors: true,
      hasDeferredProcessors: true,
    });

    expect(reified.getProcessors()).toHaveLength(1);
    expect(reified.getProcessors()[0]).toBeInstanceOf(PythonProcessor);
    expect((reified.getProcessors()[0] as PythonProcessor).getCode()).toBe('x = 1');
  });
});
