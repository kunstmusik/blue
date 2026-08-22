import { describe, expect, it } from 'vitest';
import { BlueData, GenericInstrument, TrackLayerGroup } from '@blue/data';
import { UnifiedLibraryProjectAdapter } from './project-adapter';

describe('Unified Library Track instrument transfer', () => {
  it('validates a live Track target and assigns an independent project instrument copy', () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    group.setUniqueId('track-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('track-1');
    data.getScore().splice(0, data.getScore().length, group);

    const source = new GenericInstrument();
    source.setName('Library Source');
    source.setText('outs 0, 0');
    data.getArrangement().addInstrumentWithId(source, '1');

    let revision = 0;
    const adapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 7,
      revision,
      commit: () => { revision += 1; return revision; },
    }));
    const key = adapter.list('instrument')[0]!.key;
    const target = {
      kind: 'trackInstrument' as const,
      projectSessionId: 7,
      projectRevision: 0,
      track: { rootGroupId: 'track-group', trackId: 'track-1' },
    };

    expect(adapter.validateTransferTarget(target, 'instrument')).toBeNull();
    const receipt = adapter.applyInsertion({
      key,
      mode: 'independent',
      target: {
        libraryType: 'instrument',
        projectSessionId: 7,
        label: 'Track Instrument',
        valid: true,
        targetRevision: '0',
        destinationKind: 'trackInstrument',
        track: target.track,
      },
    });

    expect(receipt.insertedIdentity).toBe('track-1');
    expect(track.getInstrument()).not.toBeNull();
    expect(track.getInstrument()).not.toBe(source);
    expect(track.getInstrument()?.getName()).toBe('Library Source');
    track.getInstrument()?.setName('Track Copy');
    expect(source.getName()).toBe('Library Source');
  });

  it('rejects a stale or wrong-type Track target without mutation', () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    group.setUniqueId('track-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('track-1');
    data.getScore().splice(0, data.getScore().length, group);
    const adapter = new UnifiedLibraryProjectAdapter(() => ({ data, sessionId: 2, revision: 3 }));
    const target = {
      kind: 'trackInstrument' as const,
      projectSessionId: 2,
      projectRevision: 2,
      track: { rootGroupId: 'track-group', trackId: 'track-1' },
    };

    expect(adapter.validateTransferTarget({ ...target, projectRevision: 3 }, 'soundObject')).toMatch(/type/i);
    expect(adapter.validateTransferTarget(target, 'instrument')).toMatch(/changed/i);
    expect(track.getInstrument()).toBeNull();
  });

  it('copies Track-owned UDOs through the shared UDO buffer contract', () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    group.setUniqueId('track-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('track-1');
    track.setName('Lead Track');
    track.setInstrument(new GenericInstrument());
    data.getScore().splice(0, data.getScore().length, group);

    let revision = 0;
    const adapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 7,
      revision,
      commit: () => { revision += 1; return revision; },
    }));
    const trackOwner = { rootGroupId: 'track-group', trackId: 'track-1' };
    const trackTarget = {
      kind: 'projectUdo' as const,
      projectSessionId: 7,
      projectRevision: 0,
      track: trackOwner,
      insertIndex: 0,
    };
    const payloadXml = '<udo><style>CLASSIC</style><opcodeName>trackTone</opcodeName><outTypes>a</outTypes><inTypes>a</inTypes><codeBody>aout = ain</codeBody><comments/></udo>';

    expect(adapter.validateTransferTarget(trackTarget, 'udo')).toBeNull();
    adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'udo', nodeId: 'track-tone' },
      payloadXml,
      target: {
        libraryType: 'udo',
        projectSessionId: 7,
        label: 'Track UDOs',
        valid: true,
        targetRevision: '0',
        track: trackOwner,
        insertIndex: 0,
      },
      mode: 'independent',
    });

    const trackUdo = adapter.list('udo').find((entry) => (
      entry.key.scope === 'projectOwned'
      && entry.key.locator.kind === 'udo'
      && entry.key.locator.track?.trackId === 'track-1'
    ));
    expect(trackUdo).toMatchObject({
      displayName: 'trackTone',
      breadcrumb: ['Tracks', 'Lead Track', 'UDOs'],
      key: {
        locator: {
          sessionObjectId: 'track:track-group:track-1:udo:0',
          track: trackOwner,
        },
      },
    });

    adapter.applyInsertion({
      key: trackUdo!.key,
      target: {
        libraryType: 'udo',
        projectSessionId: 7,
        label: 'Project UDOs',
        valid: true,
        targetRevision: '1',
        insertIndex: 0,
      },
      mode: 'independent',
    });
    expect(data.getOpcodeList().getOpcode(0)?.getName()).toBe('trackTone');

    const deletion = adapter.previewDelete(trackUdo!.key);
    adapter.deleteProjectItem(trackUdo!.key, deletion.confirmationToken);
    expect((track.getInstrument() as GenericInstrument).getOpcodeList().size()).toBe(0);
  });
});
