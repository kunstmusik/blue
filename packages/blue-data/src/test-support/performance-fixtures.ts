import { BlueData } from '../blue-data';
import { BlueSynthBuilder } from '../instruments/blue-synth-builder';
import { BSBKnob } from '../instruments/blue-synth-builder/bsb-knob';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { AudioClip } from '../score/audio/audio-clip';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';

/**
 * Generates a deterministic performance workload project with:
 * - 1,000 clips with fixed IDs ('clip-0' .. 'clip-999')
 * - 32 instrument assignments ('assignment-0' .. 'assignment-31')
 * - 128 automation parameters ('param-0' .. 'param-127') across 32 BSB instruments (4 knobs each)
 */
export function buildDeterministicPerformanceProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Deterministic 1000-Clip Benchmark Project';
  data.getProjectProperties().sampleRate = '44100';
  data.getProjectProperties().ksmps = '64';
  data.getProjectProperties().nchnls = '2';

  // 1. 32 instrument assignments with 128 automation parameters (4 knobs each)
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

  // 2. 1,000 clips with fixed IDs across 10 layers
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
