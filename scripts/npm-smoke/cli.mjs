/**
 * Isolated consumer smoke and inventory verification for @kunstmusik/blue-cli.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertArchiveMarkdownLinksResolve,
  createDisposableConsumer,
  spawnShimCommand,
} from '../verify-npm-packages.mjs';

const REQUIRED_CLI_ARCHIVE_FILES = [
  'package.json',
  'README.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'LICENSES/Apache-2.0.txt',
  'LICENSES/ISC.txt',
  'dist/blue-cli.cjs',
  'dist/java/blue-java.jar',
  'dist/java/THIRD_PARTY_NOTICES.md',
  'dist/java/source/pom.xml',
  'dist/java/pythonLib/blue/pmask/COPYING',
  'dist/java/pythonLib/blue/orchestra/COPYING',
  'dist/java/pythonLib/blue/jythonconsole/COPYING',
  'dist/java/licenses/EPL-2.0.txt',
  'dist/java/licenses/EPL-1.0.txt',
  'dist/java/licenses/Apache-2.0.txt',
  'dist/java/licenses/MPL-2.0.txt',
  'dist/java/licenses/BSD-2-Clause.txt',
  'dist/java/licenses/jsoup-MIT.txt',
  'dist/java/licenses/slf4j-MIT.txt',
  'dist/java/licenses/Jython-LICENSE.txt',
  'dist/java/licenses/GPL-2.0.txt',
  'dist/java/licenses/wxWindows-Library-License-3.1.txt',
  'dist/attribution/blue-data.md',
  'dist/attribution/blue-x7-msfa.md',
  'dist/attribution/provenance.json',
];

/**
 * Validate @kunstmusik/blue-cli tarball inventory and notice/attribution links.
 *
 * @param {ReturnType<import('../verify-npm-packages.mjs').readTarballEntries>} archiveInfo
 */
export function verifyCliInventory(archiveInfo) {
  const missing = REQUIRED_CLI_ARCHIVE_FILES.filter((entry) => !archiveInfo.entries.has(entry));
  if (missing.length > 0) {
    throw new Error(
      `${archiveInfo.filename}: missing required CLI archive file(s):\n  - ${missing.join('\n  - ')}`,
    );
  }

  const javaSources = [...archiveInfo.entries.keys()].filter(
    (entry) => entry.startsWith('dist/java/source/java/') && entry.endsWith('.java'),
  );
  if (javaSources.length === 0) {
    throw new Error(
      `${archiveInfo.filename}: missing Java helper sources under dist/java/source/java/.`,
    );
  }

  assertArchiveMarkdownLinksResolve(archiveInfo, 'THIRD_PARTY_NOTICES.md');
  assertArchiveMarkdownLinksResolve(archiveInfo, 'dist/java/THIRD_PARTY_NOTICES.md');
  assertArchiveMarkdownLinksResolve(archiveInfo, 'dist/attribution/blue-data.md');
  assertArchiveMarkdownLinksResolve(archiveInfo, 'dist/attribution/blue-x7-msfa.md');

  return {
    entryCount: archiveInfo.entries.size,
    javaSourceCount: javaSources.length,
  };
}

/**
 * Escape XML character data and attribute entities in generated smoke fixtures.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Invoke the npm-installed blue-cli shim cleanly across POSIX and Windows without `shell: true`.
 *
 * @param {string} shimPath
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, timeout?: number }} options
 */
function runCliShim(shimPath, args, options) {
  return spawnShimCommand(shimPath, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    timeout: options.timeout ?? 60_000,
    label: `installed blue-cli shim (${shimPath})`,
  });
}

function createMinimalMonoWavHeader() {
  const channels = 1;
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
  return header;
}

/**
 * Execute full isolated smoke verification for @kunstmusik/blue-cli.
 *
 * @param {{
 *   archivePath: string,
 *   archiveInfo: ReturnType<import('../verify-npm-packages.mjs').readTarballEntries>,
 * }} context
 */
export async function verifyCliArchive({ archivePath, archiveInfo }) {
  const inventory = verifyCliInventory(archiveInfo);
  const consumer = createDisposableConsumer('blue-cli smoke %OS%-', [archivePath]);

  try {
    const binName = process.platform === 'win32' ? 'blue-cli.cmd' : 'blue-cli';
    const shimPath = path.join(consumer.dir, 'node_modules', '.bin', binName);
    assert.equal(existsSync(shimPath), true, `Installed CLI shim not found at ${shimPath}`);

    const workDir = path.join(consumer.dir, 'work');
    mkdirSync(workDir, { recursive: true });
    const missingJavaHome = path.join(workDir, 'missing-java');
    const missingJavaEnv = { ...process.env, JAVA_HOME: missingJavaHome };

    // 1. Plain project compiles in disk, realtime, and Blue Live modes without Java
    const plainProject = path.join(workDir, 'plain.blue');
    const plainXml = [
      '<blueData version="2.10.1">',
      '  <projectProperties>',
      '    <title>Plain CLI Smoke</title>',
      '    <ksmps>64</ksmps>',
      '    <diskKsmps>16</diskKsmps>',
      '    <useAudioOut>true</useAudioOut>',
      '    <fileName>plain-out.wav</fileName>',
      '  </projectProperties>',
      '  <arrangement>',
      '    <instrumentAssignment arrangementId="1" isEnabled="true">',
      '      <instrument type="blue.orchestra.GenericInstrument" enabled="true">',
      '        <name>PlainSine</name>',
      '        <instrumentText>aout oscili 0.2, 440\nouts aout, aout</instrumentText>',
      '      </instrument>',
      '    </instrumentAssignment>',
      '  </arrangement>',
      '  <score>',
      '    <soundObject type="blue.soundObject.PolyObject">',
      '      <soundLayer name="Main">',
      '        <soundObject type="blue.soundObject.GenericScore">',
      '          <score>i1 0 1 440</score>',
      '        </soundObject>',
      '      </soundLayer>',
      '    </soundObject>',
      '  </score>',
      '</blueData>',
      '',
    ].join('\n');
    writeFileSync(plainProject, plainXml, 'utf8');

    const plainDiskOut = path.join(workDir, 'plain-disk.csd');
    const plainRtOut = path.join(workDir, 'plain-realtime.csd');
    const plainBlOut = path.join(workDir, 'plain-bluelive.csd');

    const plainDisk = runCliShim(shimPath, ['compile', '-p', plainProject, '-o', plainDiskOut], {
      cwd: workDir,
      env: missingJavaEnv,
    });
    assert.equal(plainDisk.status, 0, plainDisk.stderr);
    const plainDiskCsd = readFileSync(plainDiskOut, 'utf8');
    assert.equal(plainDiskCsd.includes('<CsoundSynthesizer>'), true);
    assert.equal(plainDiskCsd.includes('ksmps=16'), true);
    assert.match(plainDiskCsd, /i1\s+0\.0\s+4\s+440/);
    assert.equal(readFileSync(plainProject, 'utf8'), plainXml);

    const plainRt = runCliShim(
      shimPath,
      ['compile', '-p', plainProject, '-o', plainRtOut, '--realtime'],
      { cwd: workDir, env: missingJavaEnv },
    );
    assert.equal(plainRt.status, 0, plainRt.stderr);
    const plainRtCsd = readFileSync(plainRtOut, 'utf8');
    assert.equal(plainRtCsd.includes('<CsoundSynthesizer>'), true);
    assert.equal(plainRtCsd.includes('ksmps=64'), true);
    assert.match(plainRtCsd, /i1\s+0\.0\s+4\s+440/);
    assert.equal(readFileSync(plainProject, 'utf8'), plainXml);

    const plainBl = runCliShim(
      shimPath,
      ['compile', '-p', plainProject, '-o', plainBlOut, '--bluelive'],
      { cwd: workDir, env: missingJavaEnv },
    );
    assert.equal(plainBl.status, 0, plainBl.stderr);
    const plainBlCsd = readFileSync(plainBlOut, 'utf8');
    assert.equal(plainBlCsd.includes('<CsoundSynthesizer>'), true);
    assert.equal(plainBlCsd.includes('instr blueAllNotesOff'), true);
    assert.equal(plainBlCsd.includes('e 36000'), true);
    assert.equal(readFileSync(plainProject, 'utf8'), plainXml);

    // 2. Conflicting mode flags and same-file rejection
    const conflictOut = path.join(workDir, 'conflict-sentinel.csd');
    writeFileSync(conflictOut, 'previous sentinel output', 'utf8');
    const conflictRun = runCliShim(
      shimPath,
      ['compile', '-p', plainProject, '-o', conflictOut, '--realtime', '--bluelive'],
      { cwd: workDir, env: missingJavaEnv },
    );
    assert.notEqual(conflictRun.status, 0);
    assert.match(conflictRun.stderr, /mutually exclusive/i);
    assert.equal(readFileSync(conflictOut, 'utf8'), 'previous sentinel output');
    assert.equal(readFileSync(plainProject, 'utf8'), plainXml);

    const sameFileRun = runCliShim(shimPath, ['compile', '-p', plainProject, '-o', plainProject], {
      cwd: workDir,
      env: missingJavaEnv,
    });
    assert.notEqual(sameFileRun.status, 0);
    assert.match(sameFileRun.stderr, /different file/i);
    assert.equal(readFileSync(plainProject, 'utf8'), plainXml);

    // 3. Native path with spaces + relative WAV audio layout + TuningProcessor scale resolution
    const spaceDir = path.join(workDir, 'project dir with spaces %OS%');
    mkdirSync(spaceDir, { recursive: true });
    const scalePath = path.join(spaceDir, 'scale with spaces.scl');
    const sampleWavPath = path.join(spaceDir, 'sample.wav');
    const hostProject = path.join(spaceDir, 'host project.blue');
    const hostOut = path.join(spaceDir, 'host output.csd');

    writeFileSync(scalePath, 'Test scale\n2\n3/2\n2\n', 'utf8');
    writeFileSync(sampleWavPath, createMinimalMonoWavHeader());
    const hostXml = [
      '<blueData version="2.10.1">',
      '  <projectProperties><title>Host Resources</title></projectProperties>',
      '  <mixer panningEnabled="true"/>',
      '  <score>',
      '    <soundObject type="blue.soundObject.PolyObject">',
      '      <soundLayer name="Scores">',
      '        <soundObject type="blue.soundObject.GenericScore">',
      '          <noteProcessorChain>',
      '            <noteProcessor type="blue.noteProcessor.TuningProcessor">',
      `              <scale>${escapeXml(scalePath)}</scale>`,
      '              <baseFrequency>440</baseFrequency>',
      '            </noteProcessor>',
      '          </noteProcessorChain>',
      '          <score>i1 0 1 8.01</score>',
      '        </soundObject>',
      '      </soundLayer>',
      '    </soundObject>',
      '    <trackLayerGroup name="Audio">',
      '      <tracks>',
      '        <track name="Audio 1">',
      '          <audioClip>',
      '            <audioFile>sample.wav</audioFile>',
      '          </audioClip>',
      '        </track>',
      '      </tracks>',
      '    </trackLayerGroup>',
      '  </score>',
      '</blueData>',
      '',
    ].join('\n');
    writeFileSync(hostProject, hostXml, 'utf8');

    const hostRun = runCliShim(shimPath, ['compile', '-p', hostProject, '-o', hostOut], {
      cwd: workDir,
      env: missingJavaEnv,
    });
    assert.equal(hostRun.status, 0, hostRun.stderr);
    const hostCsd = readFileSync(hostOut, 'utf8');
    assert.equal(hostCsd.includes('<CsoundSynthesizer>'), true);
    assert.match(hostCsd, /i1\s+0\.0\s+4\s+660/);
    assert.equal(readFileSync(hostProject, 'utf8'), hostXml);

    unlinkSync(sampleWavPath);
    writeFileSync(hostOut, 'previous host sentinel', 'utf8');
    const hostMissingRun = runCliShim(shimPath, ['compile', '-p', hostProject, '-o', hostOut], {
      cwd: workDir,
      env: missingJavaEnv,
    });
    assert.notEqual(hostMissingRun.status, 0);
    assert.match(hostMissingRun.stderr, /Cannot inspect audio file/);
    assert.equal(readFileSync(hostOut, 'utf8'), 'previous host sentinel');
    assert.equal(readFileSync(hostProject, 'utf8'), hostXml);

    // 4. Java-backed compilation across disk, realtime, and Blue Live + missing Java error preservation
    const javaDir = path.join(workDir, 'java project');
    mkdirSync(javaDir, { recursive: true });
    const javaProject = path.join(javaDir, 'java-backed.blue');
    const javaXml = [
      '<blueData version="2.10.1">',
      '  <projectProperties><title>Java CLI Smoke</title></projectProperties>',
      '  <arrangement>',
      '    <instrumentAssignment arrangementId="1" isEnabled="true">',
      '      <instrument type="blue.orchestra.PythonInstrument" enabled="true">',
      '        <name>PyInst</name>',
      '        <instrumentText>instrument = "outs 0, 0"</instrumentText>',
      '      </instrument>',
      '    </instrumentAssignment>',
      '  </arrangement>',
      '  <score>',
      '    <soundObject type="blue.soundObject.PolyObject">',
      '      <soundLayer name="Main">',
      '        <soundObject type="blue.soundObject.ObjectBuilder">',
      '          <name>PyBuilder</name>',
      '          <noteProcessorChain>',
      '            <noteProcessor type="blue.noteProcessor.PythonProcessor">',
      '              <code>for note in noteList:\n    note.setPField("432", 4)</code>',
      '            </noteProcessor>',
      '          </noteProcessorChain>',
      '          <code>from pmask import *\nassert blueProjectDir is not None\nscore = "i1 0 1 %s" % shared_frequency</code>',
      '        </soundObject>',
      '        <soundObject type="blue.soundObject.ClojureObject">',
      '          <name>CljObj</name>',
      '          <clojureCode>(def score "i1 0 1 733")</clojureCode>',
      '        </soundObject>',
      '      </soundLayer>',
      '      <soundLayer name="OnLoad" muted="true">',
      '        <soundObject type="blue.soundObject.PythonObject" onLoadProcessable="true">',
      '          <name>PyInit</name>',
      '          <pythonCode>shared_frequency = 431</pythonCode>',
      '        </soundObject>',
      '      </soundLayer>',
      '    </soundObject>',
      '  </score>',
      '</blueData>',
      '',
    ].join('\n');
    writeFileSync(javaProject, javaXml, 'utf8');

    for (const [modeName, flags] of [
      ['disk', []],
      ['realtime', ['--realtime']],
      ['bluelive', ['--bluelive']],
    ]) {
      const modeOut = path.join(javaDir, `java-${modeName}.csd`);
      const javaRun = runCliShim(
        shimPath,
        ['compile', '-p', javaProject, '-o', modeOut, ...flags],
        {
          cwd: javaDir,
          timeout: 60_000,
        },
      );
      assert.equal(javaRun.status, 0, `${modeName} compile failed:\n${javaRun.stderr}`);
      const csd = readFileSync(modeOut, 'utf8');
      assert.equal(csd.includes('<CsoundSynthesizer>'), true);
      assert.equal(csd.includes('outs 0, 0'), true);
      if (modeName !== 'bluelive') {
        assert.match(csd, /i1\s+0\.0\s+4\s+432/);
        assert.match(csd, /i1\s+0\.0\s+4\s+733/);
      } else {
        assert.equal(csd.includes('instr blueAllNotesOff'), true);
      }
      assert.equal(readFileSync(javaProject, 'utf8'), javaXml);
    }

    const javaFailureOut = path.join(javaDir, 'java-disk.csd');
    writeFileSync(javaFailureOut, 'previous sentinel output', 'utf8');
    const missingJavaRun = runCliShim(
      shimPath,
      ['compile', '-p', javaProject, '-o', javaFailureOut],
      { cwd: javaDir, env: missingJavaEnv },
    );
    assert.notEqual(missingJavaRun.status, 0);
    assert.match(missingJavaRun.stderr, /Cannot start Java 17/);
    assert.equal(readFileSync(javaFailureOut, 'utf8'), 'previous sentinel output');
    assert.equal(readFileSync(javaProject, 'utf8'), javaXml);

    return {
      inventory,
      plainModes: 'passed',
      conflictAndSameFileRejection: 'passed',
      hostSpacesAndRelativeResources: 'passed',
      javaBackedModes: 'passed',
      missingJavaPreservesOutput: 'passed',
    };
  } finally {
    consumer.cleanup();
  }
}
