import { writeFileSync, mkdirSync } from 'fs';
import {
  BlueData,
  PolyObject,
  SoundLayer,
  GenericScore,
  TimePosition,
  TimeDuration,
  NoteProcessorChain,
  getNoteProcessorCatalog,
} from '../src/index';

const data = new BlueData();
const props = data.getProjectProperties();
props.title = 'Note Processor Test';
props.author = 'blue-electron';
props.sampleRate = '44100';

const score = data.getScore();
score.length = 0;

const BEATS_PER_OBJECT = 4;
const SCORE_TEXT = 'i1 0 2 3 4 5';

const catalog = getNoteProcessorCatalog();

const root = new PolyObject(true);
root.setName('Root');
const layer = new SoundLayer();
layer.setName('NPC Test Layer');
root.push(layer);

for (let i = 0; i < catalog.length; i++) {
  const def = catalog[i];
  const sObj = new GenericScore();
  sObj.setName(def.type);
  sObj.setScoreText(SCORE_TEXT);
  sObj.setStartTime(TimePosition.beats(i * BEATS_PER_OBJECT));
  sObj.setSubjectiveDuration(TimeDuration.beats(BEATS_PER_OBJECT));
  sObj.setBackgroundColor(0x4488cc + i * 0x111111);

  const proc = def.createDefault();
  const chain = new NoteProcessorChain();
  chain.addProcessor(proc);
  sObj.setNoteProcessorChain(chain);

  layer.push(sObj);
}

score.push(root);

const xml = data.saveToString();
const outDir = new URL('../../../fixtures/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const outPath = new URL('../../../fixtures/noteprocessor_test.blue', import.meta.url);
writeFileSync(outPath, xml, 'utf-8');
console.log(`Wrote ${outPath.pathname} (${xml.length} bytes)`);
console.log(`Generated ${catalog.length} sound objects, one per processor type.`);
