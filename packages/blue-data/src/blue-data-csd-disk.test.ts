import fs from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { Arrangement } from './arrangement';
import { Parameter } from './automation/parameter';
import { BlueData } from './blue-data';
import { GenericInstrument } from './instruments/generic-instrument';
import { Channel } from './mixer/channel';
import { AudioClip } from './score/audio/audio-clip';
import { Track } from './score/track/track';
import { TrackLayerGroup } from './score/track/track-layer-group';
import { initializeJavaScriptRuntime } from './javascript-runtime';
import { TimeDuration } from './time/time-duration';
import { TimePosition } from './time/time-position';
import {
  RHYTHMIC_BLUE_PATH,
  RHYTHMIC_DISK_CSD_PATH,
  extractScoreEvents,
  hasRhythmicFixture,
} from './test-support/csd-render-fixtures';

class AutomationFixtureInstrument extends GenericInstrument {
  constructor(private readonly parameters: Parameter[]) {
    super();
  }

  getParameters(): Parameter[] {
    return [...this.parameters];
  }

  override deepCopy(): AutomationFixtureInstrument {
    const copy = new AutomationFixtureInstrument(
      this.parameters.map((parameter) => parameter.deepCopy() as Parameter),
    );
    copy.setName(this.getName());
    copy.setText(this.getText());
    copy.setGlobalOrc(this.getGlobalOrc() ?? '');
    copy.setGlobalSco(this.getGlobalSco() ?? '');
    return copy;
  }
}

function createAutomationProject(diskAlwaysRenderEntireProject: boolean): BlueData {
  const data = new BlueData();
  data.setRenderStartTime(4);
  data.setRenderEndTime(-1);

  const props = data.getProjectProperties();
  props.sampleRate = '48000';
  props.ksmps = '128';
  props.channels = '2';
  props.useZeroDbFS = true;
  props.zeroDbFS = '0.5';
  props.diskSampleRate = '96000';
  props.diskKsmps = '32';
  props.diskChannels = '6';
  props.diskUseZeroDbFS = true;
  props.diskZeroDbFS = '1';
  props.diskAlwaysRenderEntireProject = diskAlwaysRenderEntireProject;

  const parameter = new Parameter();
  parameter.setName('gain');
  parameter.setAutomationEnabled(true);
  parameter.addPoint(0, 0.2);
  parameter.addPoint(8, 0.8);

  const instrument = new AutomationFixtureInstrument([parameter]);
  instrument.setName('Automation Fixture');
  instrument.setText('aout oscili 0.1, 440\nout aout');

  const arrangement = new Arrangement();
  arrangement.addInstrument(instrument, '1');
  data.setArrangement(arrangement);

  return data;
}

function createRenderWindowProject(diskAlwaysRenderEntireProject: boolean): BlueData {
  const data = new BlueData();
  data.setRenderStartTime(4);
  data.setRenderEndTime(-1);

  const props = data.getProjectProperties();
  props.diskAlwaysRenderEntireProject = diskAlwaysRenderEntireProject;

  const layer = new Track();
  const clip = new AudioClip();
  clip.setAudioFile('/tmp/render-window.wav');
  clip.setStartTime(TimePosition.beats(4));
  clip.setSubjectiveDuration(TimeDuration.beats(2));
  clip.setLooping(null, false);
  layer.push(clip);

  const layerGroup = new TrackLayerGroup();
  layerGroup.push(layer);
  data.getScore().push(layerGroup);

  const channel = new Channel();
  channel.setName('Render Window Audio');
  channel.setAssociation(layer.getUniqueId());
  data.getMixer().getChannels().push(channel);

  return data;
}

function extractDiskPrologue(csd: string): string[] {
  const lines: string[] = [];

  for (const rawLine of csd.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (/^instr\s+6\b/.test(line)) {
      break;
    }
    lines.push(line);
  }

  return lines;
}

beforeAll(async () => {
  await initializeJavaScriptRuntime();
});

describe.skipIf(!hasRhythmicFixture())('disk CSD parity', () => {
  it('matches the Java Blue 2.10.1 disk export prologue for rhythmic/01.blue', async () => {
    const source = fs.readFileSync(RHYTHMIC_BLUE_PATH, 'utf-8');
    const data = await BlueData.loadFromString(source);
    const generated = data.toDiskCSD();
    const reference = fs.readFileSync(RHYTHMIC_DISK_CSD_PATH, 'utf-8');

    expect(extractDiskPrologue(generated)).toEqual(extractDiskPrologue(reference));
  });

  it('uses disk project properties for the CsInstruments header', () => {
    const data = createAutomationProject(false);
    const realtime = data.toCSD();
    const disk = data.toDiskCSD();

    expect(realtime).toContain('sr=48000');
    expect(realtime).toContain('ksmps=128');
    expect(realtime).toContain('nchnls=2');
    expect(realtime).toContain('0dbfs=0.5');

    expect(disk).toContain('sr=96000');
    expect(disk).toContain('ksmps=32');
    expect(disk).toContain('nchnls=6');
    expect(disk).toContain('0dbfs=1');
  });

  it('omits realtime channel export lines from disk init statements', () => {
    const data = createAutomationProject(false);
    const disk = data.toDiskCSD();

    expect(disk).not.toContain('chnexport');
  });

  it('honors diskAlwaysRenderEntireProject when building score notes', () => {
    const renderWindowProject = createRenderWindowProject(false);
    const fullProject = createRenderWindowProject(true);

    const renderWindowEvents = extractScoreEvents(renderWindowProject.toDiskCSD()).filter((line) =>
      /^i\d+\t/.test(line),
    );
    const fullProjectEvents = extractScoreEvents(fullProject.toDiskCSD()).filter((line) =>
      /^i\d+\t/.test(line),
    );

    expect(renderWindowEvents[0]).toMatch(/^i\d+\t0(\.0+)?\t/);
    expect(fullProjectEvents[0]).toMatch(/^i\d+\t4(\.0+)?\t/);
  });
});
