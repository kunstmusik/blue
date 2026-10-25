import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { GenericInstrument } from './instruments/generic-instrument';
import { Tables } from './tables';
import { BlueX7 } from './instruments/blue-x7';
import { TrackLayerGroup } from './score/track/track-layer-group';
import { Channel } from './mixer/channel';
import { Send } from './mixer/send';

class DeterministicTableInstrument extends GenericInstrument {
  override generateFTables(tables: unknown): void {
    if (!(tables instanceof Tables)) {
      return;
    }

    const num = tables.getOpenFTableNumber();
    const current = tables.getTables();
    const line = `f ${num} 0 32 10 1`;
    tables.setTables(current ? `${current}\n${line}` : line);
  }

  override deepCopy(): GenericInstrument {
    const copy = new DeterministicTableInstrument();
    copy.setName(this.getName());
    copy.setText(this.getText());
    copy.setGlobalOrc(this.getGlobalOrc());
    copy.setGlobalSco(this.getGlobalSco());
    return copy;
  }
}

function extractScoreEvents(csd: string): string[] {
  const match = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('i'));
}

describe('BlueData deterministic render parity', () => {
  it('keeps source-id and ftable ordering stable across repeated runs', () => {
    const data = new BlueData();
    data.getGlobalOrcSco().setGlobalOrc('gi_reserved ftgen 1, 0, 1024, 10, 1');
    data.setRenderEndTime(16);

    const arrangement = new Arrangement();
    const tableInstrument = new DeterministicTableInstrument();
    tableInstrument.setName('Deterministic');
    tableInstrument.setText('aout oscili 0.1, 440\nblueMixerOut aout, aout');
    arrangement.addInstrument(tableInstrument, '4');
    data.setArrangement(arrangement);

    const first = data.toCSD();
    const second = data.toCSD();

    expect(second).toBe(first);
    expect(first).toContain('f 2 0 32 10 1');
    expect(first).not.toContain('f 1 0 32 10 1');

    const firstEvents = extractScoreEvents(first);
    const secondEvents = extractScoreEvents(second);
    expect(secondEvents).toEqual(firstEvents);
  });

  it('keeps four BlueX7 owners isolated across reorder, removal, and rebuild', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    for (const id of ['1', '2']) {
      const instrument = new BlueX7();
      instrument.setName('Duplicate BlueX7');
      data.getArrangement().addInstrument(instrument, id);
    }
    const group = new TrackLayerGroup();
    group.setUniqueId('four-owner-group');
    for (const id of ['track-a', 'track-b']) {
      const track = group.newLayerAt(group.length);
      track.setUniqueId(id);
      const instrument = new BlueX7();
      instrument.setName('Duplicate BlueX7');
      instrument.setEnabled(true);
      track.setOwnedInstrument(instrument);
    }
    data.getScore().push(group);

    const first = data.toRealtimePlaybackCSD();
    expect(first.blueX7Bindings).toHaveLength(4);
    expect(first.csdText.match(/bluex7\.orc — BlueX7 modern synthesis module/g)).toHaveLength(1);
    expect(first.blueX7Bindings.map((binding) => binding.ownerIdentity)).toEqual([
      'arrangement:1',
      'arrangement:2',
      'track:four-owner-group:track-a',
      'track:four-owner-group:track-b',
    ]);
    expect(
      new Set(first.blueX7Bindings.flatMap((binding) => [...binding.parameterChannels.values()]))
        .size,
    ).toBe(4 * 151);
    expect(new Set(first.blueX7Bindings.map((binding) => binding.domainEpoch)).size).toBe(4);
    expect(
      first.blueX7Bindings.every(
        (binding) => binding.directGlobalChannels === binding.parameterChannels,
      ),
    ).toBe(true);
    expect(
      first.blueX7Bindings
        .slice(2)
        .every((binding) => typeof binding.runtimeInstrumentId === 'number'),
    ).toBe(true);

    group.splice(0, 2, group[1]!, group[0]!);
    const reordered = data.toRealtimePlaybackCSD();
    expect(reordered.blueX7Bindings.map((binding) => binding.ownerIdentity)).toEqual([
      'arrangement:1',
      'arrangement:2',
      'track:four-owner-group:track-b',
      'track:four-owner-group:track-a',
    ]);

    data.getArrangement().updateAssignment('2', { enabled: false });
    group[0]!.clearInstrument();
    const afterRemoval = data.toRealtimePlaybackCSD();
    expect(afterRemoval.blueX7Bindings.map((binding) => binding.ownerIdentity)).toEqual([
      'arrangement:1',
      'track:four-owner-group:track-a',
    ]);
    const rebuilt = data.toRealtimePlaybackCSD();
    expect(
      rebuilt.blueX7Bindings.map((binding) => ({
        ownerIdentity: binding.ownerIdentity,
        channels: [...binding.parameterChannels.entries()],
      })),
    ).toEqual(
      afterRemoval.blueX7Bindings.map((binding) => ({
        ownerIdentity: binding.ownerIdentity,
        channels: [...binding.parameterChannels.entries()],
      })),
    );
  });
});

// ─── Spec 118 T021: optimized mixer paths stay deterministic ───

describe('mixer optimization determinism (Spec 118 T021)', () => {
  function createSendHeavyProject(): BlueData {
    const data = new BlueData();
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const returnChannel = new Channel();
    returnChannel.setName('Reverb');
    returnChannel.setOutChannel('Master');
    mixer.getSubChannels().push(returnChannel);
    for (let index = 0; index < 4; index++) {
      const source = new Channel();
      source.setName(`Track ${index}`);
      source.setAssociation(`track-${index}`);
      source.setOutChannel('Master');
      for (const [chain, level] of [
        [source.getPreEffects(), 0.3],
        [source.getPostEffects(), 0.45],
      ] as const) {
        const send = new Send();
        send.setSendChannel('Reverb');
        send.setLevel(level);
        chain.push(send);
      }
      mixer.getChannels().push(source);
      const instrument = new GenericInstrument();
      instrument.setName(`Src${index}`);
      instrument.setText('aL oscili 0.2, 440\naR oscili 0.2, 442\nblueMixerOut aL, aR');
      data.getArrangement().addInstrument(instrument, `Track ${index}`);
    }
    return data;
  }

  it('generates identical realtime CSD with combined send gains across repeated builds', () => {
    const data = createSendHeavyProject();
    const first = data.toRealtimePlaybackCSD();
    const second = data.toRealtimePlaybackCSD();
    expect(second.csdText).toBe(first.csdText);
    // Every gated non-unity send uses exactly one shared k-rate product.
    expect((first.csdText.match(/^kMixSendGain = /gm) ?? []).length).toBe(8);
    // Scratch symbol allocation does not consume automation ordinals: the
    // automation channel count is unchanged by the combined statements.
    expect((first.csdText.match(/^gk_blue_auto\d+ chnexport/gm) ?? []).length).toBe(
      second.parameters?.length,
    );
  });

  it('keeps async generation byte-identical to sync for optimized mixer paths', async () => {
    const data = createSendHeavyProject();
    const sync = data.toRealtimePlaybackCSD();
    const async = await data.toRealtimePlaybackCSDAsync();
    expect(async.csdText).toBe(sync.csdText);
    const diskSync = data.toDiskCSD();
    const diskAsync = await data.toDiskCSDAsync();
    expect(diskAsync).toBe(diskSync);
  });

  it('keeps the mixer-disabled route on the unchanged generation path', () => {
    const data = createSendHeavyProject();
    data.getMixer().setEnabled(false);
    const first = data.toRealtimePlaybackCSD();
    const second = data.toRealtimePlaybackCSD();
    expect(second.csdText).toBe(first.csdText);
    expect(first.csdText).not.toContain('BlueMixer');
    expect(first.csdText).not.toContain('kMixSendGain');
  });
});
