import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericScore,
  TuningProcessor,
  Element,
  AudioClip,
  TrackLayerGroup,
  External,
  JavaScriptObject,
  ObjectBuilder,
  SoundLayer,
} from '@blue/data';

const binary = path.resolve('dist/blue-cli.cjs');
const directories: string[] = [];
function fixture(data = new BlueData()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-cli-host-'));
  directories.push(directory);
  const project = path.join(directory, 'project.blue');
  const output = path.join(directory, 'project.csd');
  fs.writeFileSync(project, data.saveToString());
  return { directory, project, output };
}
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true });
});
describe('CLI host preparation', () => {
  it('resolves Scala scale references and preserves output when a scale disappears', () => {
    const { directory, project, output } = fixture();
    const scale = path.join(directory, 'scale.scl');
    fs.writeFileSync(scale, 'Test scale\n2\n3/2\n2\n');
    const data = new BlueData();
    const score = new GenericScore();
    score.setScoreText('i1 0 1 8.01');
    score
      .getNoteProcessorChain()
      .addProcessor(
        TuningProcessor.loadFromXML(
          Element.parse(
            '<noteProcessor type="TuningProcessor"><scale>' +
              scale +
              '</scale><baseFrequency>440</baseFrequency></noteProcessor>',
          ),
        ),
      );
    (data.getScore()[0]![0]! as SoundLayer).push(score);
    fs.writeFileSync(project, data.saveToString());
    execFileSync(process.execPath, [binary, 'compile', '-p', project, '-o', output]);
    expect(fs.readFileSync(output, 'utf8')).toMatch(/i1\s+0\.0\s+4\s+660/);
    fs.unlinkSync(scale);
    fs.writeFileSync(output, 'previous output');
    const result = spawnSync(process.execPath, [binary, 'compile', '-p', project, '-o', output], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Cannot resolve tuning scale');
    expect(fs.readFileSync(output, 'utf8')).toBe('previous output');
  });

  it.each([1, 2])(
    'inspects %s-channel audio and rejects missing sources without replacing output',
    (channels) => {
      const data = new BlueData();
      data.getMixer().setPanningEnabled(true);
      const group = new TrackLayerGroup();
      const track = group.newLayerAt(0);
      const clip = new AudioClip();
      clip.setAudioFile('sample.wav');
      track.push(clip);
      data.getScore().length = 0;
      data.getScore().push(group);
      const { directory, project, output } = fixture(data);
      const header = Buffer.alloc(44 + channels * 2);
      header.write('RIFF');
      header.writeUInt32LE(header.length - 8, 4);
      header.write('WAVEfmt ', 8);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(channels, 22);
      header.writeUInt32LE(44100, 24);
      header.writeUInt32LE(44100 * channels * 2, 28);
      header.writeUInt16LE(channels * 2, 32);
      header.writeUInt16LE(16, 34);
      header.write('data', 36);
      header.writeUInt32LE(channels * 2, 40);
      const sample = path.join(directory, 'sample.wav');
      fs.writeFileSync(sample, header);
      for (const mode of [[], ['--realtime'], ['--bluelive']]) {
        execFileSync(process.execPath, [binary, 'compile', '-p', project, '-o', output, ...mode]);
        expect(fs.readFileSync(output, 'utf8')).toContain('<CsoundSynthesizer>');
      }
      fs.unlinkSync(sample);
      fs.writeFileSync(output, 'previous output');
      const result = spawnSync(process.execPath, [binary, 'compile', '-p', project, '-o', output], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Cannot inspect audio file');
      expect(fs.readFileSync(output, 'utf8')).toBe('previous output');
    },
  );

  it('shares on-load JavaScript state with score generation', () => {
    const data = new BlueData();
    const init = new JavaScriptObject();
    init.setOnLoadProcessable(true);
    init.setJavaScriptCode('var sharedFrequency = 523;');
    const muted = new SoundLayer();
    muted.setMuted(true);
    muted.push(init);
    data.getScore()[0]!.push(muted);
    const score = new JavaScriptObject();
    score.setJavaScriptCode('score = "i1 0 1 " + sharedFrequency;');
    (data.getScore()[0]![0]! as SoundLayer).push(score);
    const { project, output } = fixture(data);
    execFileSync(process.execPath, [binary, 'compile', '-p', project, '-o', output]);
    expect(fs.readFileSync(output, 'utf8')).toMatch(/i1\s+0\.0\s+4\s+523/);
  });

  it.each(['External', 'ObjectBuilder'])(
    'runs %s commands in the project directory and fails on errors',
    (type) => {
      const data = new BlueData();
      const object = type === 'External' ? new External() : new ObjectBuilder();
      const callOperator = process.platform === 'win32' ? '& ' : '';
      const command = `${callOperator}"${process.execPath}" generator.cjs $infile $outfile`;
      object.setCommandLine(command);
      if (object instanceof External) object.setText('source');
      else {
        object.setLanguageType('EXTERNAL');
        object.setCode('source');
      }
      (data.getScore()[0]![0]! as SoundLayer).push(object);
      const { directory, project, output } = fixture(data);
      fs.writeFileSync(
        path.join(directory, 'generator.cjs'),
        "const fs=require('fs'); if(fs.readFileSync(process.argv[2],'utf8')!=='source')process.exit(2); fs.writeFileSync(process.argv[3], 'i1 0 1 440');",
      );
      execFileSync(process.execPath, [binary, 'compile', '-p', project, '-o', output]);
      expect(fs.readFileSync(output, 'utf8')).toMatch(/i1\s+0/);
      fs.writeFileSync(path.join(directory, 'generator.cjs'), 'process.exit(2)');
      fs.writeFileSync(output, 'previous output');
      const result = spawnSync(process.execPath, [binary, 'compile', '-p', project, '-o', output], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('External score generation failed');
      expect(fs.readFileSync(output, 'utf8')).toBe('previous output');
    },
  );

  it('protects the project from direct, symbolic-link and hard-link output aliases', () => {
    const { project, directory } = fixture();
    const source = fs.readFileSync(project, 'utf8');
    const hard = path.join(directory, 'hard.csd');
    const symbolic = path.join(directory, 'symbolic.csd');
    fs.linkSync(project, hard);
    fs.symlinkSync(project, symbolic);
    for (const output of [project, hard, symbolic]) {
      const result = spawnSync(process.execPath, [binary, 'compile', '-p', project, '-o', output], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('different file');
      expect(fs.readFileSync(project, 'utf8')).toBe(source);
    }
  });
});
