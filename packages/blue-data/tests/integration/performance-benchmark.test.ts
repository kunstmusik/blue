/**
 * Performance benchmark for BlueData loading and CSD generation.
 * Run with: npx vitest run packages/blue-data/tests/integration/performance-benchmark.test.ts
 */
import { describe, it, expect } from 'vitest';
import { BlueData } from '../../src/blue-data';
import { TrackLayerGroup } from '../../src/score/track/track-layer-group';
import { AudioClip } from '../../src/score/audio/audio-clip';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { Score } from '../../src/score/score';
import { buildDeterministicPerformanceProject } from '../../src/test-support/performance-fixtures';

describe('Performance', () => {
  it('loads a project with 100 audio clips in under 500ms', async () => {
    // Build a large XML string
    const clips = [];
    for (let i = 0; i < 100; i++) {
      clips.push(`<audioClip>
        <name>Clip ${i}</name>
        <audioFile>/audio/clip${i}.wav</audioFile>
        <numChannels>2</numChannels>
        <audioDuration>2.0</audioDuration>
        <fileStart>0</fileStart>
        <startTime type="beats">${i}</startTime>
        <subjectiveDuration type="beats">2</subjectiveDuration>
        <fadeIn>0.01</fadeIn>
        <fadeInType>Linear</fadeInType>
        <fadeOut>0.01</fadeOut>
        <fadeOutType>Linear</fadeOutType>
        <looping>false</looping>
        <backgroundColor>4210752</backgroundColor>
      </audioClip>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<blueData version="2.9.1">
  <projectProperties>
    <title>Performance Test</title>
    <sampleRate>44100</sampleRate>
    <ksmps>64</ksmps>
    <channels>2</channels>
  </projectProperties>
  <score>
    <timeContext><tempo>120</tempo></timeContext>
    <audioLayerGroup name="Audio Layers" uniqueId="test">
      <defaultHeightIndex>0</defaultHeightIndex>
      <audioLayers>
        <audioLayer name="Layer 1" muted="false" solo="false" heightIndex="0" uniqueId="l1">
          ${clips.join('\n')}
        </audioLayer>
      </audioLayers>
    </audioLayerGroup>
  </score>
</blueData>`;

    const start = performance.now();
    const data = await BlueData.loadFromString(xml);
    const loadTime = performance.now() - start;

    expect(loadTime).toBeLessThan(500);
    expect(data.getScore()[0]).toBeInstanceOf(TrackLayerGroup);
    const ag = data.getScore()[0] as TrackLayerGroup;
    expect(ag[0].length).toBe(100);
  });

  it('generates CSD for 100 clips in under 200ms', () => {
    const data = new BlueData();
    data.getProjectProperties().sampleRate = '44100';
    data.getProjectProperties().ksmps = '64';
    data.getProjectProperties().nchnls = '2';

    const score = new Score();
    score.panningEnabled = false;
    const ag = new TrackLayerGroup();
    const layer = ag.newLayerAt(0);

    for (let i = 0; i < 100; i++) {
      const clip = new AudioClip();
      clip.setAudioFile(`/audio/clip${i}.wav`);
      clip.setAudioDuration(2);
      clip.setStartTime(TimePosition.beats(i));
      clip.setSubjectiveDuration(TimeDuration.beats(2));
      clip.setFadeIn(0.01);
      clip.setFadeOut(0.01);
      layer.push(clip);
    }

    score.push(ag);
    data.setScore(score);

    const start = performance.now();
    const csd = data.toCSD();
    const genTime = performance.now() - start;

    expect(genTime).toBeLessThan(200);
    expect(csd).toContain('<CsoundSynthesizer>');
  });

  it('saves a project with 100 clips in under 100ms', () => {
    const data = new BlueData();
    data.setVersion('2.9.1');
    data.getProjectProperties().title = 'Large Project';
    data.getProjectProperties().sampleRate = '44100';

    const score = new Score();
    const ag = new TrackLayerGroup();
    const layer = ag.newLayerAt(0);

    for (let i = 0; i < 100; i++) {
      const clip = new AudioClip();
      clip.setName(`Clip ${i}`);
      clip.setAudioFile(`/audio/clip${i}.wav`);
      clip.setAudioDuration(2);
      clip.setStartTime(TimePosition.beats(i));
      clip.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(clip);
    }

    score.push(ag);
    data.setScore(score);

    const start = performance.now();
    const xml = data.saveToString();
    const saveTime = performance.now() - start;

    expect(saveTime).toBeLessThan(100);
    expect(xml.length).toBeGreaterThan(10000);
  });

  it('builds, clones, and round-trips deterministic 1,000-clip, 32-instrument, 128-parameter workload', async () => {
    const buildStart = performance.now();
    const data = buildDeterministicPerformanceProject();
    const buildTime = performance.now() - buildStart;
    expect(buildTime).toBeLessThan(1000);

    // Verify 32 instrument assignments
    const arrangements = data.getArrangement().getArrangement();
    expect(arrangements).toHaveLength(32);
    for (let i = 0; i < 32; i++) {
      expect(arrangements[i].arrangementId).toBe(String(i + 1));
    }

    // Verify 128 parameters across the 32 instruments
    let totalParams = 0;
    for (const item of arrangements) {
      const bsb = item.instr as any;
      const params = bsb.getParameters();
      expect(params).toHaveLength(4);
      totalParams += params.length;
    }
    expect(totalParams).toBe(128);

    // Verify 1,000 clips with fixed IDs across layers
    const group = data.getScore()[0] as TrackLayerGroup;
    let totalClips = 0;
    for (let l = 0; l < 10; l++) {
      totalClips += group[l].length;
      for (const obj of group[l]) {
        expect((obj as any).uniqueId).toMatch(/^clip-\d+$/);
        expect(obj.getName()).toMatch(/^Clip \d+$/);
      }
    }
    expect(totalClips).toBe(1000);

    // History-copy clone performance
    const cloneStart = performance.now();
    const cloned = data.historyCopy();
    const cloneTime = performance.now() - cloneStart;
    expect(cloneTime).toBeLessThan(500);
    expect(cloned.getArrangement().getArrangement()).toHaveLength(32);
    expect((cloned.getScore()[0] as TrackLayerGroup)[0].length).toBe(100);

    // XML Save performance
    const saveStart = performance.now();
    const xml = data.saveToString();
    const saveTime = performance.now() - saveStart;
    expect(saveTime).toBeLessThan(1000);
    expect(xml.length).toBeGreaterThan(50000);

    // XML Load performance
    const loadStart = performance.now();
    const reloaded = await BlueData.loadFromString(xml);
    const loadTime = performance.now() - loadStart;
    expect(loadTime).toBeLessThan(2000);
    expect(reloaded.getArrangement().getArrangement()).toHaveLength(32);
  });
});
