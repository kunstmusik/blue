import { describe, expect, it } from 'vitest';
import { BlueData, Channel, Effect, GenericInstrument, Send } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createMixerSnapshot,
  createOrchestraSnapshot,
  reconcileMixerSnapshotWithArrangement,
} from '../../shared/project-editor';

function createArrangementProject(): BlueData {
  const data = new BlueData();

  const lead = new GenericInstrument();
  lead.setName('Lead');
  data.getArrangement().addInstrument(lead, '1');

  const pad = new GenericInstrument();
  pad.setName('Pad');
  data.getArrangement().addInstrument(pad, '2');

  const channel = new Channel();
  channel.setName('Lead Channel');
  channel.setAssociation('1');
  data.getMixer().getChannels().splice(0, 0, channel);

  return data;
}

describe('Mixer arrangement synchronization', () => {
  it('reconciles mixer channels to the current arrangement rows', () => {
    const data = createArrangementProject();
    const reconciled = reconcileMixerSnapshotWithArrangement(
      createMixerSnapshot(data.getMixer()),
      createOrchestraSnapshot(data),
    );

    expect(reconciled.channels).toHaveLength(2);
    expect(reconciled.channels[0]?.association).toBe('1');
    expect(reconciled.channels[0]?.name).toBe('Lead Channel');
    expect(reconciled.channels[1]?.association).toBe('2');
    expect(reconciled.channels[1]?.name).toBe('Pad');
    expect(reconciled.master.name).toBe('Master');
  });

  it('removes mixer channel when instrument is removed from arrangement', () => {
    const data = createArrangementProject();

    applyProjectDocumentPatch(data, {
      orchestra: { type: 'removeAssignment', assignmentId: '1' },
    });

    const snapshot = createMixerSnapshot(data.getMixer());
    expect(snapshot.channels).toHaveLength(1);
    expect(snapshot.channels[0]?.association).toBe('2');
  });

  it('creates default channel for new instrument after removal', () => {
    const data = createArrangementProject();

    applyProjectDocumentPatch(data, {
      orchestra: { type: 'removeAssignment', assignmentId: '1' },
    });

    expect(data.getMixer().getChannels()).toHaveLength(1);

    applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'addInstrument',
        instrument: { type: 'generic', name: 'Synth' },
        assignmentId: '3',
      },
    });

    const snapshot = createMixerSnapshot(data.getMixer());
    expect(snapshot.channels).toHaveLength(2);
    const newChannel = snapshot.channels.find((c) => c.association === '3');
    expect(newChannel).toBeDefined();
    expect(newChannel?.outChannel).toBe('Master');
  });
});

describe('Instrument ID change preserves mixer channel', () => {
  it('updates channel association when assignment ID changes', () => {
    const data = createArrangementProject();

    applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateAssignment',
        assignmentId: '1',
        nextAssignmentId: '5',
      },
    });

    const snapshot = createMixerSnapshot(data.getMixer());
    const ch = snapshot.channels.find((c) => c.association === '5');
    expect(ch).toBeDefined();
    expect(ch?.name).toBe('5');
  });

  it('preserves channel effects when assignment ID changes', () => {
    const data = createArrangementProject();
    const channel = data
      .getMixer()
      .getChannels()
      .find((ch) => ch.getAssociation() === '1')!;
    const effect = new Effect();
    effect.setName('Reverb');
    effect.setCode('aout = ain');
    channel.getPreEffects().push(effect);

    applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateAssignment',
        assignmentId: '1',
        nextAssignmentId: '10',
      },
    });

    const snapshot = createMixerSnapshot(data.getMixer());
    const ch = snapshot.channels.find((c) => c.association === '10');
    expect(ch).toBeDefined();
    expect(ch?.preChain).toHaveLength(1);
    expect(ch?.preChain[0]).toEqual(expect.objectContaining({ kind: 'effect', name: 'Reverb' }));
  });

  it('preserves sends when assignment ID changes', () => {
    const data = createArrangementProject();
    const channel = data
      .getMixer()
      .getChannels()
      .find((ch) => ch.getAssociation() === '1')!;
    const send = new Send();
    send.setSendChannel('Master');
    channel.getPostEffects().push(send);

    applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateAssignment',
        assignmentId: '1',
        nextAssignmentId: '7',
      },
    });

    const snapshot = createMixerSnapshot(data.getMixer());
    const ch = snapshot.channels.find((c) => c.association === '7');
    expect(ch).toBeDefined();
    expect(ch?.postChain).toHaveLength(1);
    expect(ch?.postChain[0]).toEqual(
      expect.objectContaining({ kind: 'send', sendChannel: 'Master' }),
    );
  });

  it('preserves channel level and pan when assignment ID changes', () => {
    const data = createArrangementProject();
    const channel = data
      .getMixer()
      .getChannels()
      .find((ch) => ch.getAssociation() === '1')!;
    channel.setLevel(-6);
    channel.setPan(0.75);

    applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateAssignment',
        assignmentId: '1',
        nextAssignmentId: '3',
      },
    });

    const snapshot = createMixerSnapshot(data.getMixer());
    const ch = snapshot.channels.find((c) => c.association === '3');
    expect(ch).toBeDefined();
    expect(ch?.level).toBe(-6);
    expect(ch?.pan).toBe(0.75);
  });

  it('does not change channel if new ID is a duplicate', () => {
    const data = createArrangementProject();

    applyProjectDocumentPatch(data, {
      orchestra: {
        type: 'updateAssignment',
        assignmentId: '1',
        nextAssignmentId: '2',
      },
    });

    const snapshot = createMixerSnapshot(data.getMixer());
    const ch1 = snapshot.channels.find((c) => c.association === '1');
    expect(ch1).toBeDefined();
  });
});
