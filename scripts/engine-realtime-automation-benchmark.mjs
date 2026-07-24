#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Build a minimal environment object for spawned blue-engine processes.
 * Only forwards variables that the runtime needs, avoiding leakage of
 * unrelated shell credentials into the child.
 *
 * @param {Record<string, string>} extras
 * @returns {Record<string, string>}
 */
function buildMinimalEnv(extras) {
  /** @type {Record<string, string>} */
  const env = {
    HOME: process.env.HOME ?? '',
    PATH: process.env.PATH ?? '',
    TMPDIR: process.env.TMPDIR ?? '',
    LANG: process.env.LANG ?? '',
    ...extras,
  };
  if (process.platform === 'win32') {
    env.APPDATA = process.env.APPDATA ?? '';
    env.USERPROFILE = process.env.USERPROFILE ?? '';
    env.TEMP = process.env.TEMP ?? '';
    env.TMP = process.env.TMP ?? '';
    env.LOCALAPPDATA = process.env.LOCALAPPDATA ?? '';
  }
  return env;
}

let BlueData;
let AutomationCurve;
let getEngineAutomationPoints;
let initializeJavaScriptRuntime;
let EngineClient;
let AutomationCurveCode;

function loadModules() {
  const blueData = requireWithFallback(
    '@blue/data',
    '../packages/blue-data/dist/cjs/index.js',
  );
  BlueData = blueData.BlueData;
  AutomationCurve = blueData.AutomationCurve;
  getEngineAutomationPoints = blueData.getEngineAutomationPoints;
  initializeJavaScriptRuntime = blueData.initializeJavaScriptRuntime;

  const engineClient = requireWithFallback(
    '@blue/engine-client',
    '../packages/blue-engine-client/dist/cjs/index.js',
  );
  EngineClient = engineClient.EngineClient;
  AutomationCurveCode = engineClient.AutomationCurveCode;
}

function requireWithFallback(primarySpecifier, fallbackRelativePath) {
  try {
    return require(primarySpecifier);
  } catch {
    const fallbackPath = resolve(SCRIPT_DIR, fallbackRelativePath);
    return require(fallbackPath);
  }
}

function parseArgs(argv) {
  const args = {
    bluePath: '',
    enginePath: process.env.BLUE_ENGINE_PATH ?? '',
    endpointHost: '127.0.0.1',
    portBase: 5555,
    runs: 1,
    mode: 'both',
    timeoutMs: 120000,
    jsonOut: '',
    disableShm: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--blue' && next) {
      args.bluePath = next;
      i += 1;
    } else if (token === '--engine' && next) {
      args.enginePath = next;
      i += 1;
    } else if (token === '--host' && next) {
      args.endpointHost = next;
      i += 1;
    } else if (token === '--port-base' && next) {
      args.portBase = Number(next);
      i += 1;
    } else if (token === '--runs' && next) {
      args.runs = Number(next);
      i += 1;
    } else if (token === '--mode' && next) {
      args.mode = next;
      i += 1;
    } else if (token === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (token === '--json-out' && next) {
      args.jsonOut = next;
      i += 1;
    } else if (token === '--disable-shm') {
      args.disableShm = true;
    } else if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.bluePath || !args.enginePath) {
    printHelp();
    throw new Error('Both --blue and --engine (or BLUE_ENGINE_PATH) are required.');
  }

  if (!Number.isFinite(args.runs) || args.runs < 1) {
    throw new Error('--runs must be a positive integer.');
  }

  if (!['enabled', 'disabled', 'both'].includes(args.mode)) {
    throw new Error('--mode must be one of: enabled, disabled, both');
  }

  return args;
}

function printHelp() {
  console.log('Usage: node scripts/engine-realtime-automation-benchmark.mjs --blue <project.blue> --engine <blue-engine-path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --runs <n>             Number of runs per mode (default: 1)');
  console.log('  --mode <value>         enabled | disabled | both (default: both)');
  console.log('  --host <host>          Engine endpoint host (default: 127.0.0.1)');
  console.log('  --port-base <port>     Base REQ port (default: 5555; pub is +1)');
  console.log('  --timeout-ms <ms>      Max wait per run (default: 120000)');
  console.log('  --disable-shm          Pass --disable-shared-memory to blue-engine');
  console.log('  --json-out <path>      Write full results JSON to this path');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/engine-realtime-automation-benchmark.mjs --blue smoke-test.blue --engine ~/work/csound/blue-engine/build/blue-engine --runs 3 --mode both');
}

function parseCSD(csd) {
  const orcMatch = csd.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/);
  const scoMatch = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  const optsMatch = csd.match(/<CsOptions>([\s\S]*?)<\/CsOptions>/);

  const options = [];
  if (optsMatch) {
    const text = optsMatch[1] ?? '';
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith(';')) {
        options.push(trimmed);
      }
    }
  }

  return {
    orchestra: (orcMatch?.[1] ?? '').trim(),
    score: (scoMatch?.[1] ?? '').trim(),
    options,
  };
}

function mapAutomationCurve(curve) {
  switch (curve) {
    case AutomationCurve.STEP:
      return AutomationCurveCode.STEP;
    case AutomationCurve.EXPONENTIAL:
      return AutomationCurveCode.EXPONENTIAL;
    case AutomationCurve.LINEAR:
    default:
      return AutomationCurveCode.LINEAR;
  }
}

function extractCounterMap(line) {
  const map = {};
  const matcher = /([a-zA-Z0-9_]+)=(-?[0-9]+(?:\.[0-9]+)?)/g;
  let match = matcher.exec(line);
  while (match) {
    map[match[1]] = Number.parseFloat(match[2]);
    match = matcher.exec(line);
  }
  return map;
}

function summarizeMode(results, modeLabel) {
  const rows = results.filter((entry) => entry.mode === modeLabel);
  if (rows.length === 0) {
    return null;
  }

  const avg = (key) => {
    const values = rows.map((r) => (typeof r.counters?.[key] === 'number' ? r.counters[key] : 0));
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / rows.length;
  };

  return {
    runs: rows.length,
    avgHostUs: avg('host_avg_us').toFixed(3),
    avgPerformUs: avg('perform_avg_us').toFixed(3),
    avgAutomationUs: avg('auto_avg_us').toFixed(3),
    avgHostMaxUs: avg('host_max_us').toFixed(3),
    avgPerformMaxUs: avg('perform_max_us').toFixed(3),
  };
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(client, maxAttempts = 30) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.disconnect(false).catch(() => {});
      await delay(100);
      await client.connect();
      await delay(50);

      const resp = await client.createEngine();
      if (resp.ok) {
        return;
      }
      lastError = new Error(resp.message);
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) {
      await delay(100);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function sendAutomationDefinitions(client, parameters, renderStartTime, tempoMap) {
  await client.clearAutomations();

  for (const param of parameters ?? []) {
    const varName = param.getCompilationVarName();
    if (!varName) {
      continue;
    }

    if (param.isAutomationEnabled() && param.getPoints().length >= 2) {
      const points = getEngineAutomationPoints(param, renderStartTime, tempoMap);
      await client.createAutomation(
        varName,
        mapAutomationCurve(param.getCurve()),
        true,
        param.getResolution(),
        param.getResolutionScale(),
        param.isHighPrecision(),
        points,
      );
    } else {
      const fixed = param.getFixedValue();
      const createResp = await client.createChannel(varName, fixed);
      if (!createResp.ok) {
        await client.setChannel(varName, fixed);
      }
    }
  }
}

async function waitForCompletion(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;

  while (Date.now() < deadline) {
    const resp = await client.getEngineState();
    if (resp.ok && resp.state) {
      lastState = resp.state;
      const done = !resp.state.running && (resp.state.state === 'stopped' || resp.state.stopReason !== 'none');
      if (done) {
        return resp.state;
      }
    }
    await delay(25);
  }

  throw new Error(`Timed out waiting for engine completion. Last state: ${JSON.stringify(lastState)}`);
}

async function runOne({
  runIndex,
  mode,
  args,
  prepared,
}) {
  const reqPort = args.portBase + runIndex * 10;
  const pubPort = reqPort + 1;
  const shmName = `be${process.pid}_${runIndex}`;
  const engineArgs = ['--port', String(reqPort), '--pub-port', String(pubPort), '--shm', shmName];

  if (mode === 'disabled') {
    engineArgs.push('--disable-thread-priority-elevation');
  }
  if (args.disableShm) {
    engineArgs.push('--disable-shared-memory');
  }

  const endpoint = `tcp://${args.endpointHost}:${reqPort}`;
  const pubEndpoint = `tcp://${args.endpointHost}:${pubPort}`;
  const child = spawn(args.enginePath, engineArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: buildMinimalEnv({}),
    cwd: dirname(args.bluePath),
  });

  const stderrLines = [];
  const stdoutLines = [];

  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString('utf-8');
    for (const line of text.split(/\r?\n/)) {
      if (line.trim().length > 0) {
        stdoutLines.push(line);
      }
    }
  });

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString('utf-8');
    for (const line of text.split(/\r?\n/)) {
      if (line.trim().length > 0) {
        stderrLines.push(line);
      }
    }
  });

  const client = new EngineClient({ endpoint, pubEndpoint, timeout: 10000 });
  const runStart = Date.now();

  try {
    await delay(500);
    if (child.exitCode !== null) {
      throw new Error(
        `blue-engine exited early (code=${child.exitCode}). stderr=${stderrLines.slice(-10).join(' | ')}`,
      );
    }

    await connectWithRetry(client);

    const allOptions = [...new Set([...prepared.csdOptions, ...prepared.realtimeOptions])];
    if (!allOptions.includes('-d')) {
      allOptions.unshift('-d');
    }

    for (const option of allOptions) {
      await client.setOption(option);
    }

    const compileResp = await client.compileOrc(prepared.orchestra);
    if (!compileResp.ok) {
      throw new Error(`compileOrc failed: ${compileResp.message}`);
    }

    await sendAutomationDefinitions(
      client,
      prepared.parameters,
      prepared.renderStartTime,
      prepared.tempoMap,
    );

    const scoreResp = await client.readScore(prepared.score);
    if (!scoreResp.ok) {
      throw new Error(`readScore failed: ${scoreResp.message}`);
    }

    const startResp = await client.start();
    if (!startResp.ok) {
      const stderrTail = stderrLines.slice(-12).join(' | ');
      throw new Error(`start failed: ${startResp.message}${stderrTail ? ` | stderr=${stderrTail}` : ''}`);
    }

    const finalState = await waitForCompletion(client, args.timeoutMs);

    const stopResp = await client.stop();
    if (!stopResp.ok) {
      stderrLines.push(`[benchmark] stop warning: ${stopResp.message}`);
    }

    await client.disconnect(true);

    const durationMs = Date.now() - runStart;
    const counterLine = [...stderrLines].reverse().find((line) => line.startsWith('[Counters]')) ?? '';

    return {
      mode,
      run: runIndex,
      reqPort,
      pubPort,
      durationMs,
      finalState,
      counters: counterLine ? extractCounterMap(counterLine) : {},
      counterLine,
      stderrLines,
      stdoutLines,
      engineArgs,
    };
  } finally {
    await client.disconnect(false).catch(() => {});

    if (!child.killed) {
      child.kill('SIGTERM');
      await delay(100);
    }
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
}

async function main() {
  loadModules();

  if (typeof initializeJavaScriptRuntime === 'function') {
    await initializeJavaScriptRuntime();
  }

  const args = parseArgs(process.argv.slice(2));
  const xml = await readFile(args.bluePath, 'utf-8');
  const data = BlueData.loadFromString(xml);
  const render = data.toRealtimePlaybackCSD();
  const parsed = parseCSD(render.csdText);

  if (!parsed.orchestra || !parsed.score) {
    throw new Error('Generated realtime CSD is missing orchestra or score.');
  }

  const prepared = {
    orchestra: parsed.orchestra,
    score: parsed.score,
    csdOptions: parsed.options,
    realtimeOptions: data.getProjectProperties().getRealtimeCsoundOptions(),
    parameters: render.parameters ?? [],
    renderStartTime: data.getRenderStartTime(),
    tempoMap: data.getScore().getTimeContext().getTempoMap(),
  };

  const modes = args.mode === 'both' ? ['enabled', 'disabled'] : [args.mode];
  const results = [];

  for (const mode of modes) {
    for (let i = 0; i < args.runs; i += 1) {
      const runIndex = results.length + 1;
      console.log(`[benchmark] run=${runIndex} mode=${mode} starting`);
      const result = await runOne({ runIndex, mode, args, prepared });
      results.push(result);
      console.log(`[benchmark] run=${runIndex} mode=${mode} complete durationMs=${result.durationMs}`);
      if (result.counterLine) {
        console.log(result.counterLine);
      }
    }
  }

  console.log('');
  console.log('Summary');
  for (const mode of modes) {
    const summary = summarizeMode(results, mode);
    if (!summary) {
      continue;
    }
    console.log(`  mode=${mode} runs=${summary.runs} avgHostUs=${summary.avgHostUs} avgPerformUs=${summary.avgPerformUs} avgAutomationUs=${summary.avgAutomationUs} avgHostMaxUs=${summary.avgHostMaxUs} avgPerformMaxUs=${summary.avgPerformMaxUs}`);
  }

  if (args.jsonOut) {
    const output = {
      generatedAt: new Date().toISOString(),
      bluePath: args.bluePath,
      enginePath: args.enginePath,
      runsPerMode: args.runs,
      mode: args.mode,
      timeoutMs: args.timeoutMs,
      results,
    };
    await writeFile(args.jsonOut, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Wrote JSON report: ${args.jsonOut}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
