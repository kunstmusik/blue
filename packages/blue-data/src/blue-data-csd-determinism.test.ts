import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { GenericInstrument } from './instruments/generic-instrument';
import { Tables } from './tables';
import { BlueX7 } from './instruments/blue-x7';
import { TrackLayerGroup } from './score/track/track-layer-group';

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
