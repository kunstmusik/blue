import { describe, expect, it } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  BSBKnob,
  TrackLayerGroup,
  AudioClip,
  TimePosition,
  TimeDuration,
} from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';
import type { ProjectDocumentPatch } from '../shared/project-editor';

function buildDeterministicPerformanceProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Deterministic 1000-Clip Benchmark Project';
  data.getProjectProperties().sampleRate = '44100';
  data.getProjectProperties().ksmps = '64';
  data.getProjectProperties().nchnls = '2';

  const arrangement = data.getArrangement();
  let paramIndex = 0;
  for (let i = 0; i < 32; i++) {
    const bsb = new BlueSynthBuilder();
    bsb.setName(`Instrument ${i}`);
    const root = bsb.getGraphicInterface().getRootGroup();
    for (let k = 0; k < 4; k++) {
      const knob = new BSBKnob();
      knob.objectName = `knob_${i}_${k}`;
      knob.setValue(0.5);
      knob.minimum = 0;
      knob.maximum = 1;
      root.addChild(knob);
    }
    const params = bsb.getParameters();
    for (let k = 0; k < params.length; k++) {
      params[k].setUniqueId(`param-${paramIndex}`);
      paramIndex++;
    }
    arrangement.addInstrument(bsb, String(i + 1));
  }

  const score = data.getScore();
  score.length = 0;
  const group = new TrackLayerGroup();
  group.setUniqueId('track-layer-group-1');
  const numLayers = 10;
  for (let l = 0; l < numLayers; l++) {
    const layer = group.newLayerAt(l);
    layer.setUniqueId(`layer-${l}`);
    layer.setName(`Layer ${l}`);
  }

  for (let c = 0; c < 1000; c++) {
    const layerIdx = c % numLayers;
    const layer = group[layerIdx];
    const clip = new AudioClip();
    (clip as any).uniqueId = `clip-${c}`;
    clip.setName(`Clip ${c}`);
    clip.setAudioFile(`/audio/clip${c}.wav`);
    clip.setAudioDuration(2);
    clip.setStartTime(TimePosition.beats(Math.floor(c / numLayers) * 2));
    clip.setSubjectiveDuration(TimeDuration.beats(2));
    clip.setFadeIn(0.01);
    clip.setFadeOut(0.01);
    layer.push(clip);
  }

  score.push(group);
  return data;
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[index];
}

describe('Deterministic large project history performance benchmark (T066 / SC-003)', () => {
  it('executes 100 actions, undos, and redos on 1,000-clip workload with p95 <= 200ms', async () => {
    // 1. Build deterministic large project: 1,000 clips, 32 instruments, 128 automation parameters
    const initialData = buildDeterministicPerformanceProject();
    const session = new ProjectSession();
    session.replace(initialData, '/path/to/benchmark-workload.blue');
    const initialXml = session.read().data!.saveToString();

    const recorder = new FakePublicationRecorder();
    const history = new ProjectHistory({
      session,
      publishUpdated: (evt) => recorder.record(evt),
    });

    const context = new MockHistoryContext('ctx-perf');
    const docId = session.read().documentId!;

    // Initial heap measurement
    if (global.gc) global.gc();
    const initialHeap = process.memoryUsage().heapUsed;

    // 2. Warmup: 5 actions to warm JIT
    for (let w = 0; w < 5; w++) {
      const warmupPatch: ProjectDocumentPatch = {
        mixer: {
          type: 'updateChannel',
          channelId: 'Master',
          patch: { level: 0.5 + w * 0.05 },
        },
      };
      const req = context.nextCommitRequest(docId, w, `Warmup ${w}`, [warmupPatch]);
      const res = await history.commit(req);
      expect(res.status).toBe('committed');
    }

    // Reset history after warmup for clean 100-action benchmark
    history.clear();
    session.replace(buildDeterministicPerformanceProject(), '/path/to/benchmark-workload.blue');
    const cleanDocId = session.read().documentId!;
    const cleanInitialXml = session.read().data!.saveToString();
    let currentRevision = 0;

    // 3. Measure 100 mixed actions (scalar mixer & transport edits)
    const commitLatencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      let patch: ProjectDocumentPatch;
      if (i % 2 === 0) {
        // Scalar mixer level adjustment
        patch = {
          mixer: {
            type: 'updateChannel',
            channelId: 'Master',
            patch: { level: Number((0.2 + (i % 50) * 0.01).toFixed(4)) },
          },
        };
      } else {
        // Scalar transport timing setting
        patch = {
          transport: {
            renderStartTime: Number((i * 0.25).toFixed(2)),
          },
        };
      }

      const req = context.nextCommitRequest(
        cleanDocId,
        currentRevision,
        `Action ${i + 1}: ${i % 2 === 0 ? 'Master Level' : 'Render Start'}`,
        [patch],
      );

      const t0 = performance.now();
      const res = await history.commit(req);
      const latency = performance.now() - t0;
      commitLatencies.push(latency);

      expect(res.status).toBe('committed');
      currentRevision = session.read().revision;
    }

    expect(commitLatencies).toHaveLength(100);
    const commitP50 = calculatePercentile(commitLatencies, 50);
    const commitP95 = calculatePercentile(commitLatencies, 95);
    const commitMax = Math.max(...commitLatencies);

    // SC-003 requires p95 <= 200ms
    expect(commitP95).toBeLessThanOrEqual(200);

    // Save final 100th state XML for redo verification
    const final100Xml = session.read().data!.saveToString();

    // Verify retained bytes under 64 MiB limit and 100 entries retained
    const historyProjection = history.read();
    expect(historyProjection.length).toBe(100);
    expect(historyProjection.retainedBytes).toBeGreaterThan(0);
    expect(historyProjection.retainedBytes).toBeLessThan(64 * 1024 * 1024);

    // 4. Measure 100 Undo operations
    const undoLatencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const req = context.nextUndoRequest(cleanDocId, currentRevision);
      const t0 = performance.now();
      const res = await history.undo(req);
      const latency = performance.now() - t0;
      undoLatencies.push(latency);

      expect(res.status).toBe('committed');
      currentRevision = session.read().revision;
    }

    expect(undoLatencies).toHaveLength(100);
    const undoP50 = calculatePercentile(undoLatencies, 50);
    const undoP95 = calculatePercentile(undoLatencies, 95);
    const undoMax = Math.max(...undoLatencies);

    expect(undoP95).toBeLessThanOrEqual(200);

    // Verify document returned to exact initial state
    const restoredInitialXml = session.read().data!.saveToString();
    expect(restoredInitialXml).toBe(cleanInitialXml);

    // 5. Measure 100 Redo operations
    const redoLatencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const req = context.nextRedoRequest(cleanDocId, currentRevision);
      const t0 = performance.now();
      const res = await history.redo(req);
      const latency = performance.now() - t0;
      redoLatencies.push(latency);

      expect(res.status).toBe('committed');
      currentRevision = session.read().revision;
    }

    expect(redoLatencies).toHaveLength(100);
    const redoP50 = calculatePercentile(redoLatencies, 50);
    const redoP95 = calculatePercentile(redoLatencies, 95);
    const redoMax = Math.max(...redoLatencies);

    expect(redoP95).toBeLessThanOrEqual(200);

    // Verify document returned to exact 100th committed state
    const restoredFinalXml = session.read().data!.saveToString();
    expect(restoredFinalXml).toBe(final100Xml);

    // Post-run heap measurement
    if (global.gc) global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const heapDelta = finalHeap - initialHeap;

    // Output benchmark metrics for reporting and record in quickstart.md
    console.log('[Performance Benchmark Results: 1000-clip deterministic workload]');
    console.log(
      `  Commit (100 actions): p50=${commitP50.toFixed(2)}ms, p95=${commitP95.toFixed(2)}ms, max=${commitMax.toFixed(2)}ms`,
    );
    console.log(
      `  Undo (100 actions):   p50=${undoP50.toFixed(2)}ms, p95=${undoP95.toFixed(2)}ms, max=${undoMax.toFixed(2)}ms`,
    );
    console.log(
      `  Redo (100 actions):   p50=${redoP50.toFixed(2)}ms, p95=${redoP95.toFixed(2)}ms, max=${redoMax.toFixed(2)}ms`,
    );
    console.log(
      `  Retained Bytes:       ${(historyProjection.retainedBytes / (1024 * 1024)).toFixed(2)} MiB (${historyProjection.retainedBytes} bytes)`,
    );
    console.log(`  Heap Used Delta:      ${(heapDelta / (1024 * 1024)).toFixed(2)} MB`);
    console.log(
      `[T087 coordinator metrics] ${JSON.stringify({
        samples: 100,
        commitMs: { p50: commitP50, p95: commitP95, max: commitMax },
        undoMs: { p50: undoP50, p95: undoP95, max: undoMax },
        redoMs: { p50: redoP50, p95: redoP95, max: redoMax },
        retainedBytes: historyProjection.retainedBytes,
        heapDeltaBytes: heapDelta,
      })}`,
    );
  });
});
