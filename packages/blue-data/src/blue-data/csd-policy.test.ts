import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';
import { GenericInstrument } from '../instruments/generic-instrument';

function createProjectWithMixer(): BlueData {
  const data = new BlueData();
  const mixer = data.getMixer();
  mixer.setEnabled(true);

  // Add source channel
  const ch0 = new Channel();
  ch0.setName('Track 1');
  ch0.setAssociation('track-1-layer-1');
  ch0.setOutChannel('Reverb');
  mixer.getChannels().push(ch0);

  // Add subchannel
  const sub = new Channel();
  sub.setName('Reverb');
  sub.setOutChannel('Master');
  mixer.getSubChannels().push(sub);

  // Add a generic instrument
  const instr = new GenericInstrument();
  instr.setName('Sine');
  instr.setText('a1 oscili 0.2, 440\n  outc a1, a1');
  data.getArrangement().addInstrument(instr, '1');

  return data;
}

describe('CSD meter emission and MeterBindingMap', () => {
  it('does not emit meter statements or binding map when emitMetering is false', () => {
    const data = createProjectWithMixer();

    const realtimeResult = data.toRealtimePlaybackCSD();
    expect(realtimeResult.meterBindingMap).toBeUndefined();
    expect(realtimeResult.csdText).not.toContain('bm_meter_');
    expect(realtimeResult.csdText).not.toContain('kMeterSamples');
    expect(realtimeResult.csdText).not.toContain('kMeterTrig');

    const liveResult = data.toBlueLiveCSD();
    expect(liveResult.meterBindingMap).toBeUndefined();
    expect(liveResult.csdText).not.toContain('bm_meter_');
    expect(liveResult.csdText).not.toContain('kMeterSamples');
  });

  it('emits meter init declarations, taps, and MeterBindingMap when emitMetering is true', () => {
    const data = createProjectWithMixer();

    const result = data.toRealtimePlaybackCSD(undefined, true);
    expect(result.meterBindingMap).toBeDefined();

    const map = result.meterBindingMap!;
    expect(map.nchnls).toBe(2);
    expect(map.entries.length).toBe(3); // 1 source, 1 sub, 1 master

    // Check source entry
    const sourceEntry = map.entries.find((e) => e.kind === 'source');
    expect(sourceEntry).toBeDefined();
    expect(sourceEntry!.stripId).toBe('track-1-layer-1');
    expect(sourceEntry!.displayName).toBe('Track 1');
    expect(sourceEntry!.csdKey).toBe('0');

    // Check sub entry
    const subEntry = map.entries.find((e) => e.kind === 'sub');
    expect(subEntry).toBeDefined();
    expect(subEntry!.stripId).toBe('Reverb');
    expect(subEntry!.displayName).toBe('Reverb');
    expect(subEntry!.csdKey).toBe('sub_Reverb');

    // Check master entry
    const masterEntry = map.entries.find((e) => e.kind === 'master');
    expect(masterEntry).toBeDefined();
    expect(masterEntry!.stripId).toBe('master');
    expect(masterEntry!.displayName).toBe('Master');
    expect(masterEntry!.csdKey).toBe('sub_Master');

    // Verify CSD text has declarations
    expect(result.csdText).toContain('chn_k\t"bm_meter_rms_0_0", 2');
    expect(result.csdText).toContain('chn_k\t"bm_meter_peak_0_0", 2');
    expect(result.csdText).toContain('chn_k\t"bm_meter_rms_sub_Reverb_0", 2');
    expect(result.csdText).toContain('chn_k\t"bm_meter_peak_sub_Reverb_0", 2');
    expect(result.csdText).toContain('chn_k\t"bm_meter_rms_sub_Master_0", 2');
    expect(result.csdText).toContain('chn_k\t"bm_meter_peak_sub_Master_0", 2');

    // Verify CSD text has sample window trigger in instr BlueMixer
    expect(result.csdText).toContain('kMeterSamples init 0');
    expect(result.csdText).toContain('kMeterWindow = sr / 30');
    expect(result.csdText).toContain('kMeterSamples += ksmps');
    expect(result.csdText).toContain('if kMeterSamples >= kMeterWindow then');

    // Verify CSD text has meter taps with maxk and rms
    expect(result.csdText).toMatch(/kMeter_rms_\d+ rms ga_bluemix_0_0/);
    expect(result.csdText).toMatch(/kMeter_peak_\d+ maxk ga_bluemix_0_0, kMeterTrig, 1/);
    expect(result.csdText).toContain('chnset kMeter_rms_');
    expect(result.csdText).toContain('"bm_meter_rms_0_0"');
    expect(result.csdText).toContain('"bm_meter_peak_0_0"');
    expect(result.csdText).toContain('"bm_meter_rms_sub_Reverb_0"');
    expect(result.csdText).toContain('"bm_meter_peak_sub_Reverb_0"');
    expect(result.csdText).toContain('"bm_meter_rms_sub_Master_0"');
    expect(result.csdText).toContain('"bm_meter_peak_sub_Master_0"');
  });

  it('works identically in toBlueLiveCSD when emitMetering is true', () => {
    const data = createProjectWithMixer();
    const result = data.toBlueLiveCSD(undefined, true);

    expect(result.meterBindingMap).toBeDefined();
    expect(result.meterBindingMap!.entries.length).toBe(3);
    expect(result.csdText).toContain('bm_meter_rms_0_0');
    expect(result.csdText).toContain('kMeterWindow = sr / 30');
  });

  it('does not emit meter statements when mixer is disabled even if emitMetering is true', () => {
    const data = createProjectWithMixer();
    data.getMixer().setEnabled(false);

    const result = data.toRealtimePlaybackCSD(undefined, true);
    expect(result.meterBindingMap).toBeUndefined();
    expect(result.csdText).not.toContain('bm_meter_');
  });

  it('never emits meter statements in toDiskCSD regardless of project state', async () => {
    const data = createProjectWithMixer();
    const diskCsd = await data.toDiskCSD();

    expect(diskCsd).not.toContain('bm_meter_');
    expect(diskCsd).not.toContain('kMeterSamples');
    expect(diskCsd).not.toContain('kMeterTrig');
  });

  it('carries stable compile-time identity across duplicate names, renames, and reorders', () => {
    const data = createProjectWithMixer();
    const mixer = data.getMixer();

    // Add another source channel with the identical default name "Track 1"
    const channel2 = new Channel();
    channel2.setName('Track 1');
    channel2.setAssociation('track-2-layer-1');
    mixer.getChannels().push(channel2);

    // Add duplicate subchannel named "Reverb"
    const sub2 = new Channel();
    sub2.setName('Reverb');
    mixer.getSubChannels().push(sub2);

    const result = data.toRealtimePlaybackCSD(undefined, true);
    expect(result.meterBindingMap).toBeDefined();

    const map = result.meterBindingMap!;
    // 2 sources + 2 subs + 1 master = 5
    expect(map.entries.length).toBe(5);

    const sources = map.entries.filter((e) => e.kind === 'source');
    expect(sources.length).toBe(2);
    expect(sources[0].channelIndex).toBe(0);
    expect(sources[0].stripId).toBe('track-1-layer-1');
    expect(sources[0].csdKey).toBe('0');
    expect(sources[1].channelIndex).toBe(1);
    expect(sources[1].stripId).toBe('track-2-layer-1');
    expect(sources[1].csdKey).toBe('1');

    const subs = map.entries.filter((e) => e.kind === 'sub');
    expect(subs.length).toBe(2);
    expect(subs[0].channelIndex).toBe(0);
    expect(subs[0].csdKey).toBe('sub_Reverb');
    expect(subs[1].channelIndex).toBe(1);
    expect(subs[1].csdKey).toBe('sub_Reverb_2');
  });

  describe('legacy CSD snapshots and sync/async parity for mixer-disabled and mixer projects (T003)', () => {
    it('generates identical sync and async CSD for mixer-enabled legacy projects', async () => {
      const data = createProjectWithMixer();
      const syncCsd = data.toCSD();
      const asyncCsd = await data.toCSDAsync();
      expect(syncCsd).toBe(asyncCsd);
      expect(syncCsd).toContain('ga_bluemix_0_0');
      expect(syncCsd).toContain('ga_bluesub_Reverb_0');
      expect(syncCsd).toContain('ga_bluesub_Master_0');
    });

    it('generates identical sync and async CSD for mixer-disabled projects', async () => {
      const data = createProjectWithMixer();
      data.getMixer().setEnabled(false);
      const syncCsd = data.toCSD();
      const asyncCsd = await data.toCSDAsync();
      expect(syncCsd).toBe(asyncCsd);
      expect(syncCsd).not.toContain('ga_bluemix_');
    });
  });
});
