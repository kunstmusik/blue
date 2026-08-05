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
});
