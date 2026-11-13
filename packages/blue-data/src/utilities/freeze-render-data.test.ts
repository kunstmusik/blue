import { describe, expect, it } from 'vitest';

import { BlueData } from '../blue-data';
import { GenericScore } from '../sound-objects/generic-score';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { JavaScriptObject } from '../sound-objects/javascript-object';
import { Instance } from '../sound-objects/instance';
import { PolyObject } from '../sound-objects/poly-object';
import { initializeJavaScriptRuntime, JavaScriptSession } from '../javascript-runtime';
import { buildFreezeRenderData } from './freeze-render-data';

describe('buildFreezeRenderData', () => {
  function createProjectWithMixer(extraRenderTime: number, mixerEnabled: boolean): BlueData {
    const data = new BlueData();
    data.getMixer().setEnabled(mixerEnabled);
    data.getMixer().setExtraRenderTime(extraRenderTime);
    return data;
  }

  it('preserves arrangement, mixer, and tempo from the source project', () => {
    const data = createProjectWithMixer(0, false);
    data.getMixer().setExtraRenderTime(2);

    const source = new GenericScore();
    source.setName('Source');
    source.setStartTime(TimePosition.beats(4));
    source.setSubjectiveDuration(TimeDuration.beats(2));
    source.setScoreText('instr 1\nendin');

    const result = buildFreezeRenderData(data, source);

    expect(result.tempData.getMixer().getExtraRenderTime()).toBe(2);
  });

  it('replaces score with a temporary PolyObject containing the deep-copied source', () => {
    const data = createProjectWithMixer(0, false);

    const source = new GenericScore();
    source.setName('Original Name');
    source.setStartTime(TimePosition.beats(8));
    source.setSubjectiveDuration(TimeDuration.beats(4));

    const result = buildFreezeRenderData(data, source);
    const tempScore = result.tempData.getScore();

    expect(tempScore).toHaveLength(1);
    const polyObj = tempScore[0] as unknown as {
      length: number;
      [0]: { length: number; [0]: { getName: () => string } };
    };
    expect(polyObj).toHaveLength(1);
    const layer = polyObj[0];
    expect(layer).toHaveLength(1);
    const cloned = layer[0];
    expect(cloned.getName()).toBe('Original Name');
    expect(cloned).not.toBe(source);
  });

  it('sets render window to start..start+duration when mixer is disabled', () => {
    const data = createProjectWithMixer(3, false);
    data.getProjectProperties().diskAlwaysRenderEntireProject = true;

    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(4));
    source.setSubjectiveDuration(TimeDuration.beats(2));

    const result = buildFreezeRenderData(data, source);

    expect(result.startTimeBeats).toBe(4);
    expect(result.endTimeBeats).toBe(6);
    expect(result.tempData.getProjectProperties().diskAlwaysRenderEntireProject).toBe(false);
  });

  it('adds mixer extra render time when mixer is enabled', () => {
    const data = createProjectWithMixer(1.5, true);

    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(4));
    source.setSubjectiveDuration(TimeDuration.beats(2));

    const result = buildFreezeRenderData(data, source);

    expect(result.startTimeBeats).toBe(4);
    expect(result.endTimeBeats).toBeCloseTo(7.5, 5);
  });

  it('does not mutate the original source object', () => {
    const data = createProjectWithMixer(0, false);

    const source = new GenericScore();
    source.setName('Original');
    source.setStartTime(TimePosition.beats(4));
    source.setSubjectiveDuration(TimeDuration.beats(2));

    buildFreezeRenderData(data, source);

    expect(source.getName()).toBe('Original');
    expect(source.getStartTime().getValue()).toBe(4);
    expect(source.getSubjectiveDuration().getValue()).toBe(2);
  });

  it('does not mutate the original project score', () => {
    const data = createProjectWithMixer(0, false);
    const originalScoreLength = data.getScore().length;

    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(0));
    source.setSubjectiveDuration(TimeDuration.beats(2));

    buildFreezeRenderData(data, source);

    expect(data.getScore().length).toBe(originalScoreLength);
  });

  it('generates valid disk CSD from the temporary project', () => {
    const data = createProjectWithMixer(0, false);

    const source = new GenericScore();
    source.setName('CSD Source');
    source.setStartTime(TimePosition.beats(2));
    source.setSubjectiveDuration(TimeDuration.beats(4));
    source.setScoreText('out oscili 0.1, 440');

    const result = buildFreezeRenderData(data, source);
    const csd = result.tempData.toDiskCSD();

    expect(csd).toContain('<CsoundSynthesizer>');
    expect(csd).toContain('</CsoundSynthesizer>');
  });

  it('uses the project JavaScript session when the frozen object depends on shared on-load code', async () => {
    await initializeJavaScriptRuntime();
    const session = new JavaScriptSession();
    try {
      const data = createProjectWithMixer(0, false);
      const layer = (data.getScore()[0] as PolyObject)[0];
      const sharedInitializer = new JavaScriptObject();
      sharedInitializer.setOnLoadProcessable(true);
      sharedInitializer.setJavaScriptCode('var mNote = "i1 0 1";');
      const source = new JavaScriptObject();
      source.setJavaScriptCode('score = mNote;');
      source.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(sharedInitializer, source);

      data.processOnLoad(session);
      const result = buildFreezeRenderData(data, source);

      expect(() => result.tempData.toDiskCSD(session)).not.toThrow();
    } finally {
      session.dispose();
    }
  });

  it('omits unrelated score layer groups while remapping copied library Instance targets', () => {
    const data = createProjectWithMixer(0, false);
    const extraGroup = new PolyObject(true);
    const extraLayer = extraGroup.newLayerAt(-1);
    const unrelated = new GenericScore();
    unrelated.setName('Unrelated Object');
    extraLayer.push(unrelated);
    data.getScore().push(extraGroup);

    const libTemplate = new GenericScore();
    libTemplate.setName('Lib Template');
    libTemplate.setSubjectiveDuration(TimeDuration.beats(2));
    libTemplate.setScoreText('i1 0 1');
    const sObjLib = data.getSoundObjectLibrary();
    sObjLib.addObject(libTemplate);

    const instance = new Instance();
    instance.setSoundObject(libTemplate);
    instance.setStartTime(TimePosition.beats(1));
    instance.setSubjectiveDuration(TimeDuration.beats(2));

    const result = buildFreezeRenderData(data, instance);
    expect(result.tempData.getScore()).toHaveLength(1);
    expect(result.tempData.getSoundObjectLibrary().size()).toBe(1);
    const frozenObj = (result.tempData.getScore()[0] as PolyObject)[0][0] as Instance;
    expect(frozenObj).toBeInstanceOf(Instance);
    expect(result.tempData.toDiskCSD()).toContain('i1');
  });
});
