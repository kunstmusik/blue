/**
 * Isolated consumer smoke verification for @kunstmusik/blue-data.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import {
  assertArchiveMarkdownLinksResolve,
  createDisposableConsumer,
  runCommand,
} from '../verify-npm-packages.mjs';

const REQUIRED_DATA_ARCHIVE_FILES = [
  'package.json',
  'README.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'LICENSES/Apache-2.0.txt',
  'resources/blue-x7-modern/ATTRIBUTION.md',
  'resources/blue-x7-modern/provenance.json',
  'examples/inspect-edit.mjs',
  'dist/esm/index.js',
  'dist/esm/index.d.ts',
  'dist/esm/package.json',
  'dist/cjs/index.js',
  'dist/cjs/index.d.ts',
  'dist/cjs/package.json',
];

const TEST_ARTIFACT_PATTERN =
  /(?:\.(?:test|spec)\.(?:js|cjs|mjs|d\.ts|js\.map|d\.ts\.map)$|-test-fixtures\.(?:js|cjs|mjs|d\.ts|js\.map|d\.ts\.map)$)/i;

/**
 * Validate @kunstmusik/blue-data tarball inventory, notice links, and test exclusion.
 *
 * @param {ReturnType<import('../verify-npm-packages.mjs').readTarballEntries>} archiveInfo
 */
export function verifyDataInventory(archiveInfo) {
  const missing = REQUIRED_DATA_ARCHIVE_FILES.filter((entry) => !archiveInfo.entries.has(entry));
  if (missing.length > 0) {
    throw new Error(
      `${archiveInfo.filename}: missing required archive file(s):\n  - ${missing.join('\n  - ')}`,
    );
  }

  const esmPkg = JSON.parse(archiveInfo.entries.get('dist/esm/package.json').toString('utf8'));
  const cjsPkg = JSON.parse(archiveInfo.entries.get('dist/cjs/package.json').toString('utf8'));
  assert.equal(esmPkg.type, 'module', 'dist/esm/package.json must declare "type": "module"');
  assert.equal(cjsPkg.type, 'commonjs', 'dist/cjs/package.json must declare "type": "commonjs"');

  const unexpectedTests = [...archiveInfo.entries.keys()].filter(
    (entry) => entry.startsWith('dist/') && TEST_ARTIFACT_PATTERN.test(entry),
  );
  if (unexpectedTests.length > 0) {
    throw new Error(
      `${archiveInfo.filename}: dist/ must exclude compiled test artifacts; found ${unexpectedTests.length} (first: ${unexpectedTests[0]}).`,
    );
  }

  assertArchiveMarkdownLinksResolve(archiveInfo, 'THIRD_PARTY_NOTICES.md');
  assertArchiveMarkdownLinksResolve(archiveInfo, 'resources/blue-x7-modern/ATTRIBUTION.md');

  return {
    entryCount: archiveInfo.entries.size,
    testFilesInDist: 0,
  };
}

/**
 * Verify ESM named exports match CommonJS exports and share BlueData identity.
 *
 * @param {string} consumerDir
 */
function verifyNodeModuleParity(consumerDir) {
  const scriptPath = path.join(consumerDir, 'verify-esm-cjs.mjs');
  writeFileSync(
    scriptPath,
    `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esmMod from '@kunstmusik/blue-data';

const require = createRequire(import.meta.url);
const cjsMod = require('@kunstmusik/blue-data');

const cjsKeys = Object.keys(cjsMod).filter((key) => key !== '__esModule' && key !== 'default');
const missingNamed = cjsKeys.filter((key) => !(key in esmMod));
assert.equal(
  missingNamed.length,
  0,
  'Missing ESM named exports: ' + missingNamed.slice(0, 10).join(', '),
);
assert.equal(typeof esmMod.BlueData, 'function');
assert.equal(esmMod.BlueData, cjsMod.BlueData, 'ESM and CJS BlueData class identity must match');
assert.equal(
  esmMod.readProjectXml,
  cjsMod.readProjectXml,
  'ESM and CJS readProjectXml function identity must match',
);
assert.equal(
  esmMod.TimePosition,
  cjsMod.TimePosition,
  'ESM and CJS TimePosition class identity must match',
);

const sample = '<blueData version="2.10.1"><projectProperties><title>Parity</title></projectProperties></blueData>';
const esmRes = esmMod.readProjectXml(sample);
const cjsRes = cjsMod.readProjectXml(sample);
assert.equal(esmRes.ok, true);
assert.equal(cjsRes.ok, true);
assert.equal(cjsRes.value instanceof esmMod.BlueData, true);
assert.equal(cjsRes.value instanceof cjsMod.BlueData, true);

console.log(JSON.stringify({ exportCount: cjsKeys.length }));
`.trimStart(),
    'utf8',
  );

  const res = runCommand(process.execPath, [scriptPath], {
    cwd: consumerDir,
    label: 'node ESM/CJS parity check',
  });
  return JSON.parse(res.stdout.trim());
}

/**
 * Verify strict NodeNext TypeScript declaration resolution for both .mts and .cts consumers.
 *
 * @param {string} consumerDir
 * @param {string} repoRoot
 */
function verifyNodeNextDeclarations(consumerDir, repoRoot) {
  const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(tscBin)) {
    throw new Error(`Workspace TypeScript compiler not found at ${tscBin}`);
  }

  writeFileSync(
    path.join(consumerDir, 'consumer-esm.mts'),
    `
import {
  BlueData,
  TimeDuration,
  TimePosition,
  initializeJavaScriptRuntime,
  readProjectXml,
  type JavaRuntimeClientContract,
  type RenderCsdResult,
  type XmlDiagnostic,
  type XmlLoadResult,
  type XmlSource,
} from '@kunstmusik/blue-data';

const source: XmlSource = { kind: 'project', label: 'esm.blue' };
const result: XmlLoadResult<BlueData> = readProjectXml('<blueData/>', source);
if (result.ok) {
  const title: string = result.value.getProjectProperties().title;
  const pos = TimePosition.beats(1);
  const dur = TimeDuration.beats(2);
  void [title, pos, dur, initializeJavaScriptRuntime];
} else {
  const diags: readonly XmlDiagnostic[] = result.diagnostics;
  void diags;
}
type Contracts = [JavaRuntimeClientContract | null, RenderCsdResult | null];
export type { Contracts };
`.trimStart(),
    'utf8',
  );

  writeFileSync(
    path.join(consumerDir, 'consumer-cjs.cts'),
    `
import {
  BlueData,
  TimeDuration,
  TimePosition,
  readProjectXml,
  type XmlLoadResult,
} from '@kunstmusik/blue-data';

const res: XmlLoadResult<BlueData> = readProjectXml('<blueData/>');
if (res.ok) {
  res.value.getProjectProperties().title = 'Typed CJS';
  void [TimePosition.beats(0), TimeDuration.beats(1)];
}
`.trimStart(),
    'utf8',
  );

  writeFileSync(
    path.join(consumerDir, 'tsconfig.nodenext.json'),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: true,
        },
        files: ['consumer-esm.mts', 'consumer-cjs.cts'],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  runCommand(process.execPath, [tscBin, '-p', 'tsconfig.nodenext.json'], {
    cwd: consumerDir,
    label: 'tsc strict NodeNext declaration check (.mts + .cts)',
  });

  return { passed: true };
}

/**
 * Bundle and execute the portable browser entry point with workspace esbuild.
 *
 * @param {string} consumerDir
 * @param {string} repoRoot
 */
async function verifyBrowserBundle(consumerDir, repoRoot) {
  const cliReq = createRequire(path.join(repoRoot, 'packages', 'blue-cli', 'package.json'));
  const esbuild = cliReq('esbuild');

  const browserDir = path.join(consumerDir, 'browser-check');
  mkdirSync(browserDir, { recursive: true });
  const entryPath = path.join(browserDir, 'entry.mjs');
  const outPath = path.join(browserDir, 'bundle.mjs');

  writeFileSync(
    entryPath,
    `
import { BlueData, TimePosition, readProjectXml } from '@kunstmusik/blue-data';

function runBrowserSmoke() {
  const xml = '<blueData version="2.10.1"><projectProperties><title>Initial</title></projectProperties></blueData>';
  const loaded = readProjectXml(xml, { kind: 'project', label: 'browser.blue' });
  if (!loaded.ok) {
    throw new Error('Failed browser load: ' + JSON.stringify(loaded.diagnostics));
  }
  const project = loaded.value;
  project.getProjectProperties().title = 'Browser Bundled';
  const pos = TimePosition.beats(2.5);
  const saved = project.saveToString();
  const reloaded = readProjectXml(saved, { kind: 'project', label: 'browser-reloaded.blue' });
  if (!reloaded.ok) {
    throw new Error('Failed browser reload: ' + JSON.stringify(reloaded.diagnostics));
  }
  return {
    isBlueData: reloaded.value instanceof BlueData,
    title: reloaded.value.getProjectProperties().title,
    beats: pos.getCsoundBeats(),
  };
}
globalThis.__BLUE_BROWSER_RESULT__ = runBrowserSmoke();
`.trimStart(),
    'utf8',
  );

  const buildResult = await esbuild.build({
    entryPoints: [entryPath],
    outfile: outPath,
    bundle: true,
    write: true,
    platform: 'browser',
    format: 'esm',
    conditions: ['browser', 'import'],
    target: ['es2022'],
    metafile: true,
    logLevel: 'silent',
  });

  const inputKeys = Object.keys(buildResult.metafile?.inputs ?? {}).map((key) =>
    key.replace(/\\/g, '/'),
  );
  const usedEsm = inputKeys.some((key) => key.endsWith('/dist/esm/index.js'));
  const usedCjs = inputKeys.some((key) => key.endsWith('/dist/cjs/index.js'));
  const usedNodeBuiltin = inputKeys.some((key) => key.startsWith('node:'));
  assert.equal(
    usedEsm,
    true,
    'Browser bundle must resolve @kunstmusik/blue-data to dist/esm/index.js',
  );
  assert.equal(
    usedCjs,
    false,
    'Browser bundle must not resolve @kunstmusik/blue-data to dist/cjs/index.js',
  );
  assert.equal(usedNodeBuiltin, false, 'Browser bundle must not import node:* built-ins');

  const bundledCode = readFileSync(outPath, 'utf8').replace(/export\s*\{[\s\S]*?\}\s*;?\s*$/, '');
  const sandbox = {
    globalThis: /** @type {Record<string, unknown>} */ ({}),
    console,
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    URL,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(bundledCode, sandbox, { filename: 'browser-bundle.mjs' });

  const smokeResult = /** @type {{ isBlueData?: unknown, title?: unknown, beats?: unknown }} */ (
    sandbox.__BLUE_BROWSER_RESULT__
  );
  assert.equal(smokeResult?.isBlueData, true);
  assert.equal(smokeResult?.title, 'Browser Bundled');
  assert.equal(smokeResult?.beats, 2.5);

  return {
    bundledInputs: inputKeys.length,
    resolvedEsmEntry: true,
    result: {
      isBlueData: true,
      title: 'Browser Bundled',
      beats: 2.5,
    },
  };
}

/**
 * Exercise the shipped inspect-edit.mjs example across current, historical, script-bearing, and malformed fixtures.
 *
 * @param {string} consumerDir
 * @param {string} repoRoot
 */
function verifyInspectEditExamples(consumerDir, repoRoot) {
  const exampleScript = path.join(
    consumerDir,
    'node_modules',
    '@kunstmusik',
    'blue-data',
    'examples',
    'inspect-edit.mjs',
  );
  assert.equal(existsSync(exampleScript), true, `Missing installed example: ${exampleScript}`);

  const workDir = path.join(consumerDir, 'work', 'project files');
  mkdirSync(workDir, { recursive: true });

  // 1. Current fixture (`fixtures/smoke-test.blue`): title edit + preserved secondary fields + intact source
  const smokeSource = path.join(workDir, 'smoke-source.blue');
  const smokeEdited = path.join(workDir, 'smoke-edited.blue');
  const smokeFixtureBytes = readFileSync(path.join(repoRoot, 'fixtures', 'smoke-test.blue'));
  writeFileSync(smokeSource, smokeFixtureBytes);

  const smokeRun = runCommand(
    process.execPath,
    [exampleScript, smokeSource, smokeEdited, 'Smoke Edited Title'],
    { cwd: consumerDir, label: 'inspect-edit.mjs on smoke-test.blue' },
  );
  assert.match(smokeRun.stdout, /Smoke Edited Title/);
  assert.equal(
    Buffer.compare(readFileSync(smokeSource), smokeFixtureBytes),
    0,
    'Source fixture bytes must remain unchanged after inspect-edit.mjs',
  );
  assert.equal(existsSync(smokeEdited), true);

  // Verify reloaded edited copy via both ESM and CJS in consumer
  const reloadCheckScript = path.join(consumerDir, 'verify-reloaded-smoke.mjs');
  writeFileSync(
    reloadCheckScript,
    `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readProjectXml as readEsm } from '@kunstmusik/blue-data';

const require = createRequire(import.meta.url);
const { readProjectXml: readCjs } = require('@kunstmusik/blue-data');
const xml = readFileSync(process.argv[2], 'utf8');

for (const [label, reader] of [['esm', readEsm], ['cjs', readCjs]]) {
  const result = reader(xml, { kind: 'project', label: process.argv[2] });
  assert.equal(result.ok, true, label + ' failed to reload smoke-edited.blue');
  const props = result.value.getProjectProperties();
  assert.equal(props.title, 'Smoke Edited Title', label + ' title mismatch');
  assert.equal(props.author, 'blue-electron', label + ' author not preserved');
  assert.equal(props.sampleRate, '44100', label + ' sampleRate not preserved');
  const inst = result.value.getArrangement().getInstrumentById('1');
  assert.equal(inst?.getName(), 'All Widgets Synth', label + ' instrument name not preserved');
}
`.trimStart(),
    'utf8',
  );
  runCommand(process.execPath, [reloadCheckScript, smokeEdited], {
    cwd: consumerDir,
    label: 'reload smoke-edited.blue via ESM and CJS',
  });

  // 2. Historical compatibility fixture (`version="2.2.0"` root PolyObject + timeUnit warning)
  const historicalSource = path.join(workDir, 'historical.blue');
  const historicalEdited = path.join(workDir, 'historical-edited.blue');
  const historicalXml = [
    '<blueData version="2.2.0">',
    '  <soundObject type="blue.soundObject.PolyObject">',
    '    <name>Legacy root</name>',
    '    <timeUnit>5</timeUnit>',
    '    <soundLayer name="Layer">',
    '      <soundObject type="blue.soundObject.GenericScore">',
    '        <name>Nested score</name>',
    '        <score>i1 0 2 440</score>',
    '      </soundObject>',
    '    </soundLayer>',
    '  </soundObject>',
    '</blueData>',
    '',
  ].join('\n');
  writeFileSync(historicalSource, historicalXml, 'utf8');

  const historicalRun = runCommand(
    process.execPath,
    [exampleScript, historicalSource, historicalEdited, 'Historical Title Updated'],
    { cwd: consumerDir, label: 'inspect-edit.mjs on historical 2.2.0 project' },
  );
  assert.match(historicalRun.stderr, /P-TIME-STATE-HISTORICAL-RULER/);
  assert.equal(readFileSync(historicalSource, 'utf8'), historicalXml);
  const historicalReloadScript = path.join(consumerDir, 'verify-reloaded-historical.mjs');
  writeFileSync(
    historicalReloadScript,
    `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readProjectXml } from '@kunstmusik/blue-data';

const xml = readFileSync(process.argv[2], 'utf8');
const res = readProjectXml(xml, { kind: 'project', label: process.argv[2] });
assert.equal(res.ok, true);
assert.equal(res.value.getProjectProperties().title, 'Historical Title Updated');
assert.equal(res.value.getScore()[0].getName(), 'Legacy root');
assert.equal(xml.includes('<score>i1 0 2 440</score>'), true);
assert.equal(xml.includes('<timeUnit>5</timeUnit>'), true);
`.trimStart(),
    'utf8',
  );
  runCommand(process.execPath, [historicalReloadScript, historicalEdited], {
    cwd: consumerDir,
    label: 'verify reloaded historical fixture',
  });

  // 3. Script-bearing XML inspected & saved WITHOUT executing Python, Clojure, JS, or External scripts
  const scriptSource = path.join(workDir, 'script-bearing.blue');
  const scriptEdited = path.join(workDir, 'script-bearing-edited.blue');
  const scriptXml = [
    '<blueData version="2.10.1">',
    '  <projectProperties><title>Script Project</title></projectProperties>',
    '  <arrangement>',
    '    <instrumentAssignment arrangementId="1" isEnabled="true">',
    '      <instrument type="blue.orchestra.PythonInstrument" enabled="true">',
    '        <name>PyInst</name>',
    '        <instrumentText>raise RuntimeError("must not execute during inspect")</instrumentText>',
    '      </instrument>',
    '    </instrumentAssignment>',
    '  </arrangement>',
    '  <score>',
    '    <soundObject type="blue.soundObject.PolyObject">',
    '      <soundLayer name="Scripts">',
    '        <soundObject type="blue.soundObject.PythonObject" onLoadProcessable="true">',
    '          <name>PyObj</name>',
    '          <pythonCode>raise RuntimeError("must not run on-load python")</pythonCode>',
    '        </soundObject>',
    '        <soundObject type="blue.soundObject.ClojureObject" onLoadProcessable="true">',
    '          <name>CljObj</name>',
    '          <clojureCode>(throw (Exception. "must not run clojure"))</clojureCode>',
    '        </soundObject>',
    '        <soundObject type="blue.soundObject.JavaScriptObject" onLoadProcessable="true">',
    '          <name>JsObj</name>',
    '          <javaScriptCode>throw new Error("must not run quickjs");</javaScriptCode>',
    '        </soundObject>',
    '        <soundObject type="blue.soundObject.External">',
    '          <name>ExtObj</name>',
    '          <commandLine>exit 99</commandLine>',
    '          <text>external source payload</text>',
    '        </soundObject>',
    '      </soundLayer>',
    '    </soundObject>',
    '  </score>',
    '</blueData>',
    '',
  ].join('\n');
  writeFileSync(scriptSource, scriptXml, 'utf8');

  runCommand(
    process.execPath,
    [exampleScript, scriptSource, scriptEdited, 'Script Project Edited'],
    {
      cwd: consumerDir,
      env: { ...process.env, JAVA_HOME: path.join(workDir, 'missing-java') },
      label: 'inspect-edit.mjs on script-bearing project without execution',
    },
  );
  assert.equal(readFileSync(scriptSource, 'utf8'), scriptXml);
  const reloadedScriptXml = readFileSync(scriptEdited, 'utf8');
  assert.equal(reloadedScriptXml.includes('Script Project Edited'), true);
  assert.equal(reloadedScriptXml.includes('must not execute during inspect'), true);
  assert.equal(reloadedScriptXml.includes('must not run on-load python'), true);
  assert.equal(reloadedScriptXml.includes('must not run clojure'), true);
  assert.equal(reloadedScriptXml.includes('must not run quickjs'), true);
  assert.equal(reloadedScriptXml.includes('exit 99'), true);

  // 4. Malformed and unsupported inputs report diagnostics and produce NO output
  const malformedCases = [
    {
      name: 'syntax-error',
      content: '<blueData><unclosed>',
      expectedDiagnostic: /syntax/i,
    },
    {
      name: 'unsupported-version',
      content: '<blueData version="2.7.4_preview"/>',
      expectedDiagnostic: /@version|Invalid project version/i,
    },
  ];
  for (const testCase of malformedCases) {
    const badIn = path.join(workDir, `${testCase.name}.blue`);
    const badOut = path.join(workDir, `${testCase.name}-out.blue`);
    writeFileSync(badIn, testCase.content, 'utf8');
    const result = spawnSync(process.execPath, [exampleScript, badIn, badOut, 'Should Not Write'], {
      cwd: consumerDir,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, `${testCase.name} must fail`);
    assert.match(result.stderr, testCase.expectedDiagnostic);
    assert.equal(existsSync(badOut), false, `${testCase.name} must not create output`);
    assert.equal(readFileSync(badIn, 'utf8'), testCase.content);
  }

  // Same-file rejection leaves source unchanged
  const sameFileResult = spawnSync(
    process.execPath,
    [exampleScript, smokeSource, smokeSource, 'Should Not Overwrite'],
    { cwd: consumerDir, encoding: 'utf8' },
  );
  assert.notEqual(sameFileResult.status, 0);
  assert.equal(Buffer.compare(readFileSync(smokeSource), smokeFixtureBytes), 0);

  return {
    currentFixture: 'passed',
    historicalFixture: 'passed',
    scriptBearingWithoutExecution: 'passed',
    malformedAndSameFileRejection: 'passed',
  };
}

/**
 * Execute full isolated smoke verification for @kunstmusik/blue-data.
 *
 * @param {{
 *   archivePath: string,
 *   archiveInfo: ReturnType<import('../verify-npm-packages.mjs').readTarballEntries>,
 *   manifest: ReturnType<import('../verify-npm-packages.mjs').validateArchiveManifest>,
 *   repoRoot: string,
 * }} context
 */
export async function verifyDataArchive({ archivePath, archiveInfo, repoRoot }) {
  const inventory = verifyDataInventory(archiveInfo);
  const consumer = createDisposableConsumer('blue-data-smoke-', [archivePath]);
  try {
    const moduleParity = verifyNodeModuleParity(consumer.dir);
    const declarations = verifyNodeNextDeclarations(consumer.dir, repoRoot);
    const browserBundle = await verifyBrowserBundle(consumer.dir, repoRoot);
    const examples = verifyInspectEditExamples(consumer.dir, repoRoot);
    return {
      inventory,
      moduleParity,
      declarations,
      browserBundle,
      examples,
    };
  } finally {
    consumer.cleanup();
  }
}
