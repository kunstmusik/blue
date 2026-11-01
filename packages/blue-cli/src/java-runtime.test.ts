import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import {
  BlueData,
  ObjectBuilder,
  PythonObject,
  ClojureObject,
  PythonInstrument,
  PythonProcessor,
  SoundLayer,
} from '@blue/data';

const binary = path.resolve('dist/blue-cli.cjs');
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-cli-java-'));
  directories.push(directory);
  return {
    directory,
    project: path.join(directory, 'project.blue'),
    output: path.join(directory, 'output.csd'),
  };
}

it.each(['disk', 'realtime', 'bluelive'])(
  'compiles %s with the bundled Java helper',
  (mode) => {
    const { directory, project, output } = fixture();
    const data = new BlueData();
    const instrument = new PythonInstrument();
    instrument.setText('instrument = "outs 0, 0"');
    data.getArrangement().addInstrument(instrument, '1');
    const init = new PythonObject();
    init.setOnLoadProcessable(true);
    init.setPythonCode('shared_frequency = 431');
    const muted = new SoundLayer();
    muted.setMuted(true);
    muted.push(init);
    data.getScore()[0]!.push(muted);
    const builder = new ObjectBuilder();
    builder.setCode(
      'from pmask import *\nassert blueProjectDir is not None\nscore = "i1 0 1 %s" % shared_frequency',
    );
    const processor = new PythonProcessor();
    processor.setCode('for note in noteList:\n    note.setPField("432", 4)');
    builder.getNoteProcessorChain().addProcessor(processor);
    (data.getScore()[0]![0]! as SoundLayer).push(builder);
    const clojure = new ClojureObject();
    clojure.setClojureCode('(def score "i1 0 1 733")');
    (data.getScore()[0]![0]! as SoundLayer).push(clojure);
    fs.writeFileSync(project, data.saveToString());
    const original = fs.readFileSync(project, 'utf8');
    execFileSync(
      process.execPath,
      [binary, 'compile', '-p', project, '-o', output, ...(mode === 'disk' ? [] : ['--' + mode])],
      {
        cwd: directory,
        timeout: 45000,
      },
    );
    const csd = fs.readFileSync(output, 'utf8');
    expect(csd).toContain('outs 0, 0');
    if (mode !== 'bluelive') {
      expect(csd).toMatch(/i1\s+0\.0\s+4\s+432/);
      expect(csd).toMatch(/i1\s+0\.0\s+4\s+733/);
    }
    expect(fs.readFileSync(project, 'utf8')).toBe(original);
  },
  60000,
);

it('reports Java evaluation errors and retains previous output', () => {
  const { project, output } = fixture();
  const data = new BlueData();
  const builder = new ObjectBuilder();
  builder.setCode('raise RuntimeError("synthetic script failure")');
  (data.getScore()[0]![0]! as SoundLayer).push(builder);
  fs.writeFileSync(project, data.saveToString());
  fs.writeFileSync(output, 'previous output');
  const result = spawnSync(process.execPath, [binary, 'compile', '-p', project, '-o', output], {
    encoding: 'utf8',
    timeout: 45000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('synthetic script failure');
  expect(fs.readFileSync(output, 'utf8')).toBe('previous output');
}, 60000);
