import { describe, expect, it } from 'vitest';
import { BlueData } from '../../src/blue-data';
import { Score } from '../../src/score/score';
import { PolyObject } from '../../src/sound-objects/poly-object';
import { SoundLayer } from '../../src/sound-objects/sound-layer';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { TimeBehavior } from '../../src/sound-objects/time-behavior';
import { TimeDuration } from '../../src/time/time-duration';
import { NoteProcessorChain } from '../../src/note-processors/note-processor-chain';
import { NoteProcessorChainMap } from '../../src/note-processors/note-processor-chain-map';
import { AddProcessor } from '../../src/note-processors/add-processor';
import { MultiplyProcessor } from '../../src/note-processors/multiply-processor';
import { PythonProcessor } from '../../src/note-processors/python-processor';
import { RotateProcessor } from '../../src/note-processors/rotate-processor';
import { RetrogradeProcessor } from '../../src/note-processors/retrograde-processor';
import { UnsupportedProcessor } from '../../src/note-processors/unsupported-processor';

function buildProjectWithChainsAtAllScopes(): BlueData {
  const data = new BlueData();
  data.getScore().length = 0;

  const gs = new GenericScore();
  gs.setScoreText('i 1 0 2 440');
  gs.setTimeBehavior(TimeBehavior.NONE);
  gs.setSubjectiveDuration(TimeDuration.beats(4));

  const objectNpc = new NoteProcessorChain();
  const addProc = new AddProcessor();
  addProc.setVal('5');
  objectNpc.addProcessor(addProc);
  gs.setNoteProcessorChain(objectNpc);

  const layer = new SoundLayer();
  layer.push(gs);

  const layerNpc = new NoteProcessorChain();
  const mulProc = new MultiplyProcessor();
  mulProc.setVal('2');
  layerNpc.addProcessor(mulProc);
  layer.setNoteProcessorChain(layerNpc);

  const pObj = new PolyObject(true);
  pObj.setTimeBehavior(TimeBehavior.NONE);
  pObj.setSubjectiveDuration(TimeDuration.beats(4));
  pObj.push(layer);

  const groupNpc = new NoteProcessorChain();
  const rotProc = new RotateProcessor();
  rotProc.setNoteIndex(1);
  groupNpc.addProcessor(rotProc);
  pObj.setNoteProcessorChain(groupNpc);

  const score = new Score();
  score.length = 0;
  score.push(pObj);

  const rootNpc = new NoteProcessorChain();
  const retProc = new RetrogradeProcessor();
  rootNpc.addProcessor(retProc);
  score.setNoteProcessorChain(rootNpc);

  data.setScore(score);

  const namedChain = new NoteProcessorChain();
  namedChain.addProcessor(new AddProcessor());
  data.getNoteProcessorChainMap().setChain('testChain', namedChain);

  return data;
}

describe('Note processor chain round-trip', () => {
  it('preserves chains at all four scopes through save/load', async () => {
    const original = buildProjectWithChainsAtAllScopes();
    const xml = original.saveToString();

    const loaded = await BlueData.loadFromString(xml);

    const score = loaded.getScore();
    expect(score.length).toBe(1);

    const rootNpc = score.getNoteProcessorChain();
    expect(rootNpc.getProcessors().length).toBe(1);
    expect(rootNpc.getProcessors()[0]).toBeInstanceOf(RetrogradeProcessor);

    const pObj = score[0] as PolyObject;
    const groupNpc = pObj.getNoteProcessorChain();
    expect(groupNpc.getProcessors().length).toBe(1);
    expect(groupNpc.getProcessors()[0]).toBeInstanceOf(RotateProcessor);

    const layer = pObj[0];
    const layerNpc = layer.getNoteProcessorChain();
    expect(layerNpc.getProcessors().length).toBe(1);
    expect(layerNpc.getProcessors()[0]).toBeInstanceOf(MultiplyProcessor);

    const gs = layer[0] as GenericScore;
    const objectNpc = gs.getNoteProcessorChain();
    expect(objectNpc.getProcessors().length).toBe(1);
    expect(objectNpc.getProcessors()[0]).toBeInstanceOf(AddProcessor);
    expect((objectNpc.getProcessors()[0] as AddProcessor).getVal()).toBe('5');
  });

  it('preserves named chains through round-trip', async () => {
    const original = buildProjectWithChainsAtAllScopes();
    const xml = original.saveToString();
    const loaded = await BlueData.loadFromString(xml);

    const chainNames = loaded.getNoteProcessorChainMap().getChainNames();
    expect(chainNames).toContain('testChain');

    const chain = loaded.getNoteProcessorChainMap().getNoteProcessorChain('testChain');
    expect(chain).toBeDefined();
    expect(chain!.getProcessors().length).toBe(1);
    expect(chain!.getProcessors()[0]).toBeInstanceOf(AddProcessor);
  });

  it('preserves named chain processor parameters through round-trip', async () => {
    const original = buildProjectWithChainsAtAllScopes();

    const paramChain = new NoteProcessorChain();
    const addProc = new AddProcessor();
    addProc.setPfield('5');
    addProc.setVal('42');
    paramChain.addProcessor(addProc);
    original.getNoteProcessorChainMap().setChain('paramChain', paramChain);

    const xml = original.saveToString();
    const loaded = await BlueData.loadFromString(xml);

    const chain = loaded.getNoteProcessorChainMap().getNoteProcessorChain('paramChain')!;
    expect(chain.getProcessors().length).toBe(1);
    const proc = chain.getProcessors()[0] as AddProcessor;
    expect(proc.getPfield()).toBe('5');
    expect(proc.getVal()).toBe('42');
  });

  it('upgrades deferred PythonProcessor XML to an executable processor through round-trip', async () => {
    const original = buildProjectWithChainsAtAllScopes();

    const unsupportedChain = new NoteProcessorChain();
    const xmlFragment = await import('../../src/serialization/xml-reader').then((m) =>
      m.Element.parse(
        `<noteProcessor type="blue.noteProcessor.PythonProcessor"><code>print("hello")</code></noteProcessor>`,
      ),
    );
    const unsupported = UnsupportedProcessor.loadFromXML(
      xmlFragment,
      'blue.noteProcessor.PythonProcessor',
    );
    unsupportedChain.addProcessor(unsupported);
    original.getNoteProcessorChainMap().setChain('unsupportedChain', unsupportedChain);

    const xml = original.saveToString();
    const loaded = await BlueData.loadFromString(xml);

    const chain = loaded.getNoteProcessorChainMap().getNoteProcessorChain('unsupportedChain')!;
    expect(chain.getProcessors().length).toBe(1);
    expect(chain.getProcessors()[0]).toBeInstanceOf(PythonProcessor);
    expect((chain.getProcessors()[0] as PythonProcessor).getCode()).toContain('print("hello")');
  });

  it('double round-trip is stable', async () => {
    const original = buildProjectWithChainsAtAllScopes();
    const xml1 = original.saveToString();

    const loaded1 = await BlueData.loadFromString(xml1);
    const xml2 = loaded1.saveToString();

    const loaded2 = await BlueData.loadFromString(xml2);
    const xml3 = loaded2.saveToString();

    expect(xml2).toBe(xml3);
  });
});
