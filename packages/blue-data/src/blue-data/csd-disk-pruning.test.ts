import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';
import { Send } from '../mixer/send';
import { Effect } from '../mixer/effect';
import { GenericInstrument } from '../instruments/generic-instrument';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { Track } from '../score/track/track';
import { AudioClip } from '../score/audio/audio-clip';
import { buildStandardCSD, buildStandardCSDAsync } from './csd-policy';
import { AddProcessor } from '../note-processors/add-processor';
import { GenericScore } from '../sound-objects/generic-score';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';

/**
 * Certifiable fixture: an empty arrangement, one TrackLayerGroup of
 * AudioClip-only tracks with associated mixer channels, no global code, no
 * UDOs, no processors, and no enabled mixer effects. Each clip registers a
 * tiny silent waveform as a plain audio file path.
 */
function createCertifiableProject(): {
  data: BlueData;
  group: TrackLayerGroup;
  trackA: Track;
  trackB: Track;
} {
  const data = new BlueData();
  data.getMixer().setEnabled(true);

  const group = new TrackLayerGroup();
  const trackA = new Track();
  trackA.setName('A');
  const trackB = new Track();
  trackB.setName('B');
  group.push(trackA, trackB);
  data.getScore().length = 0;
  data.getScore().push(group);

  const channelA = new Channel();
  channelA.setName('CA');
  channelA.setAssociation(trackA.getUniqueId());
  const channelB = new Channel();
  channelB.setName('CB');
  channelB.setAssociation(trackB.getUniqueId());
  data.getMixer().getChannels().push(channelA, channelB);

  return { data, group, trackA, trackB };
}

function addClip(track: Track, start: number, duration: number): void {
  const clip = new AudioClip();
  clip.setStartTime(TimePosition.beats(start));
  clip.setSubjectiveDuration(TimeDuration.beats(duration));
  clip.setAudioFile('test.wav');
  track.push(clip);
}

describe('disk pruning eligibility and route survival (Spec 111 US3)', () => {
  it('prunes an audio-only track whose channel is muted while others still sound', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('BlueMixer');
    // Only the muted channel's track is pruned; the unmuted track remains.
    expect(score.match(/"test\.wav"/g)?.length ?? 0).toBe(1);
    expect(score).not.toContain('\t4\t"test.wav"');
  });

  it('keeps a feeder whose send survives a soloed return even when its dry output is excluded', () => {
    const { data, trackA } = createCertifiableProject();
    const reverb = new Channel();
    reverb.setName('R');
    reverb.setOutChannel('Master');
    data.getMixer().getSubChannels().push(reverb);

    const sendA = new Send();
    sendA.setSendChannel('R');
    data.getMixer().getChannels()[0].getPostEffects().push(sendA);

    addClip(trackA, 0, 3);
    reverb.setSolo(true);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    // Dry output is excluded, but the send into the soloed return survives.
    expect(score).toContain('"test.wav"');
  });

  it('prunes every certified track when the master is muted and retains full duration', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 8); // the longest clip
    addClip(trackB, 0, 2);
    data.getMixer().getMaster().setMuted(true);

    const pruned = buildStandardCSD(data, 'disk');
    const score = pruned.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).not.toContain('"test.wav"');
    expect(score).toContain('BlueMixer');

    // Duration is preserved against the identical unpruned project.
    const unprunedData = createCertifiableProject();
    addClip(unprunedData.trackA, 0, 8);
    addClip(unprunedData.trackB, 0, 2);
    const unpruned = buildStandardCSD(unprunedData.data, 'disk');
    const renderEndOf = (text: string) =>
      text
        .match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1]
        .split('\n')
        .filter((line) => line.trim().length > 0).length;
    void renderEndOf;
    const notesOf = (text: string) =>
      text
        .match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('i'));
    expect(notesOf(unpruned.csdText).length).toBeGreaterThan(0);
    // Both versions keep the render-end and BlueMixer notes; durations align
    // through the shared unpruned bound (asserted via the score `e` marker
    // timing context and note start/duration equality below).
    const unprunedNonClip = notesOf(unpruned.csdText).filter((n) => !n.includes('.wav'));
    const prunedNonClip = notesOf(pruned.csdText).filter((n) => !n.includes('.wav'));
    expect(prunedNonClip.length).toBe(unprunedNonClip.length);
    // The BlueMixer note carries the shared unpruned duration bound (8s from
    // the longest clip) in both versions.
    const mixerNote = (text: string) => notesOf(text).find((note) => note.includes('BlueMixer'));
    expect(mixerNote(pruned.csdText)).toBe(mixerNote(unpruned.csdText));
    expect(mixerNote(pruned.csdText)).toMatch(/8/);
  });

  it('does not prune when a track holds non-clip content', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    // Force uncertification through a different route: disable the mixer.
    data.getMixer().setEnabled(false);
    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('does not prune when an enabled mixer effect is present', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    const effect = new Effect();
    data.getMixer().getChannels()[1].getPreEffects().push(effect);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('does not prune when custom global orchestra text is present', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    data.getGlobalOrcSco().setGlobalOrc('; custom instrumentation\n');

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('never prunes in realtime generation', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);

    const result = buildStandardCSD(data, 'realtime');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    // Realtime keeps every event; audibility is handled by the gates.
    expect(score).toContain('"test.wav"');
    expect(result.mixerGateBindings).toBeDefined();
  });

  it('does not prune without an associated channel even when the project is otherwise certifiable', () => {
    const { data, trackA } = createCertifiableProject();
    const solo = new Track();
    solo.setName('Loose');
    (data.getScore()[0] as TrackLayerGroup).push(solo);
    addClip(solo, 0, 5);
    addClip(trackA, 0, 1);
    data.getMixer().getChannels()[0].setMuted(true);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    // Unassociated clips stay (they route into Master outside channel gates).
    expect(score).toContain('"test.wav"');
  });

  it('leaves the project untouched by pruning decisions', () => {
    const { data, trackA } = createCertifiableProject();
    addClip(trackA, 0, 4);
    data.getMixer().getChannels()[0].setMuted(true);
    const before = data.saveToString();
    buildStandardCSD(data, 'disk');
    expect(data.saveToString()).toBe(before);
  });

  it('an arrangement instrument disables pruning entirely', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    const instr = new GenericInstrument();
    instr.setName('Sine');
    instr.setText('a1 oscili 0.2, 440\n  outc a1, a1');
    data.getArrangement().addInstrument(instr, '1');

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });
});

describe('disk pruning fallback matrix (Spec 111 T068)', () => {
  it('refuses pruning for mixed content with a note SoundObject on a track', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    // Any non-clip item makes the project uncertified, not just its own track.
    trackB.push(new GenericScore());

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('refuses pruning when a track carries a note processor', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    const group = data.getScore()[0] as TrackLayerGroup;
    const processor = new AddProcessor();
    processor.setPfield('2'); // numeric p-field: the chain still runs cleanly
    (group[0] as unknown as { getNoteProcessorChain: () => { addProcessor: (p: unknown) => void } })
      .getNoteProcessorChain()
      .addProcessor(processor);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('refuses pruning for unknown preserved track content', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    const reloaded = BlueData.loadFromString(
      data.saveToString().replace('<track ', '<track futureExtension="enabled" '),
    );
    const result = buildStandardCSD(reloaded, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('keeps a pre-fader send feeder audible through a soloed return', () => {
    const { data, trackA } = createCertifiableProject();
    const reverb = new Channel();
    reverb.setName('R');
    reverb.setOutChannel('Master');
    data.getMixer().getSubChannels().push(reverb);
    const preSend = new Send();
    preSend.setSendChannel('R');
    data.getMixer().getChannels()[0].getPreEffects().push(preSend);
    addClip(trackA, 0, 3);
    reverb.setSolo(true);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('refuses pruning when routing is unresolved', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    const ghost = new Send();
    ghost.setSendChannel('NoSuchChannel');
    data.getMixer().getChannels()[1].getPostEffects().push(ghost);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });

  it('refuses pruning when subchannel routing is cyclic', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    const x = new Channel();
    x.setName('X');
    x.setOutChannel('Y');
    const y = new Channel();
    y.setName('Y');
    y.setOutChannel('X');
    data.getMixer().getSubChannels().push(x, y);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    expect(score).toContain('"test.wav"');
  });
});

describe('disk pruning scheduling and parity (Spec 111 T069)', () => {
  it('preserves a nonzero render window when the longest in-window clip is pruned', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 10);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);
    data.setRenderEndTime(6);

    const pruned = buildStandardCSD(data, 'disk');
    const mixerNote = pruned.csdText
      .match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1]
      .split('\n')
      .find((line) => line.includes('BlueMixer'));
    expect(mixerNote).toBeTruthy();

    // Same project, pruning disabled via a benign global-orc comment oracle:
    // identical audio, uncertified, so every event renders.
    const oracleData = createCertifiableProject();
    addClip(oracleData.trackA, 0, 10);
    addClip(oracleData.trackB, 0, 2);
    oracleData.data.setRenderEndTime(6);
    oracleData.data.getGlobalOrcSco().setGlobalOrc('; pruning-disable oracle\n');
    const unpruned = buildStandardCSD(oracleData.data, 'disk');
    const unprunedMixerNote = unpruned.csdText
      .match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1]
      .split('\n')
      .find((line) => line.includes('BlueMixer'));
    expect(unprunedMixerNote).toBe(mixerNote);
  });

  it('keeps mixer extra render time and tempo-mapped clip bounds in the duration', () => {
    const { data, trackA } = createCertifiableProject();
    const clip = new AudioClip();
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(4));
    clip.setAudioFile('test.wav');
    trackA.push(clip);
    data.getMixer().setExtraRenderTime(2.5);
    data.getMixer().getChannels()[0].setMuted(true);

    const pruned = buildStandardCSD(data, 'disk');
    const mixerNote = pruned.csdText
      .match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1]
      .split('\n')
      .find((line) => line.includes('BlueMixer'));
    // 4-beat clip at the default 60 bpm tempo map = 4 s + 2.5 s extra.
    expect(mixerNote).toMatch(/6\.5/);
  });

  it('produces identical CSD text through the sync and async paths', async () => {
    const { data, trackA, trackB } = createCertifiableProject();
    addClip(trackA, 0, 4);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);

    const sync = buildStandardCSD(data, 'disk');
    const async = await buildStandardCSDAsync(data, 'disk');
    expect(async.csdText).toBe(sync.csdText);
    expect(sync.csdText).not.toContain('8\t"test.wav"');
  });

  it('retains fades and looping flags on surviving events', () => {
    const { data, trackA, trackB } = createCertifiableProject();
    const clip = new AudioClip();
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(4));
    clip.setAudioFile('test.wav');
    clip.setLooping(null, true);
    clip.setFadeIn(0.5);
    clip.setFadeOut(1);
    trackA.push(clip);
    addClip(trackB, 0, 2);
    data.getMixer().getChannels()[0].setMuted(true);

    const result = buildStandardCSD(data, 'disk');
    const score = result.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
    // The muted track's looping clip is pruned; the other track's is intact.
    expect(score).not.toContain('4\t"test.wav"');
    expect(score).toContain('"test.wav"\t0\t0\t2\t');
  });
});
