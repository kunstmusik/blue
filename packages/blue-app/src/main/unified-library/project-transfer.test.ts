import {
  BlueData,
  Channel,
  Effect,
  GenericInstrument,
  GenericScore,
  PolyObject,
} from '@blue/data';
import { describe, expect, it, vi } from 'vitest';
import { createProjectEditorSnapshot } from '../../shared/project-editor';
import type { InsertionTargetSnapshot, LibraryItemKey } from '../../shared/unified-library';
import { UnifiedLibraryProjectAdapter } from './project-adapter';

function activeProject() {
  const data = new BlueData();
  const group = new PolyObject(true);
  group.setName('Root');
  group.newLayerAt(0);
  data.getScore().push(group);
  const shared = new GenericScore();
  shared.setName('Shared Motif');
  data.getSoundObjectLibrary().addObject(shared);
  let revision = 4;
  const commit = vi.fn(() => ++revision);
  return {
    data,
    get revision() { return revision; },
    provider: () => ({ data, sessionId: 11, revision, commit }),
    commit,
  };
}

function target(
  libraryType: InsertionTargetSnapshot['libraryType'],
  revision: number,
  projectSessionId = 11,
): InsertionTargetSnapshot {
  return {
    libraryType,
    projectSessionId,
    label: `Project ${libraryType}`,
    valid: true,
    targetRevision: String(revision),
  };
}

describe('project library transfer', () => {
  it('inserts independent Instrument and UDO copies and survives project save/reopen', async () => {
    const project = activeProject();
    const adapter = new UnifiedLibraryProjectAdapter(project.provider);
    const instrument = new GenericInstrument();
    instrument.setName('Imported Pad');
    const udoXml = '<udo><style>CLASSIC</style><opcodeName>importedFx</opcodeName><outTypes>a</outTypes><inTypes>a</inTypes><codeBody>aout = ain</codeBody><comments/></udo>';

    const instrumentReceipt = adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'instrument', nodeId: 'instrument-1' },
      payloadXml: instrument.saveAsXML().toXml(),
      target: target('instrument', project.revision),
      mode: 'independent',
    });
    expect(instrumentReceipt).toMatchObject({ libraryType: 'instrument', projectRevision: 5 });
    expect(project.data.getArrangement().getArrangement()[0]?.instr).not.toBe(instrument);

    const udoReceipt = adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'udo', nodeId: 'udo-1' },
      payloadXml: udoXml,
      target: target('udo', project.revision),
      mode: 'independent',
    });
    expect(udoReceipt).toMatchObject({ libraryType: 'udo', projectRevision: 6 });

    const reopened = await BlueData.loadFromString(project.data.saveToString());
    expect(reopened.getArrangement().getInstrumentById(instrumentReceipt.insertedIdentity)?.getName())
      .toBe('Imported Pad');
    expect(reopened.getOpcodeList().getOpcodes().map((udo) => udo.getName())).toContain('importedFx');
  });

  it('inserts independent and explicitly shared SoundObject copies at an exact score target', () => {
    const project = activeProject();
    const adapter = new UnifiedLibraryProjectAdapter(project.provider);
    const snapshot = createProjectEditorSnapshot(project.data, null, 11);
    if (!snapshot.score) throw new Error('Expected score snapshot');
    const group = snapshot.score.layerGroups[0]!;
    const location = {
      rootGroupId: group.groupId,
      containerPath: [],
      layerId: group.layers[0]!.layerId,
      startTime: 8,
    };
    const independent = new GenericScore();
    independent.setName('Independent');

    adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'soundObject', nodeId: 'sound-1' },
      payloadXml: independent.saveAsXML().toXml(),
      target: { ...target('soundObject', project.revision), location },
      mode: 'independent',
    });

    const sharedKey = adapter.list('soundObject')[0]!.key;
    adapter.applyInsertion({
      key: sharedKey,
      target: { ...target('soundObject', project.revision), location },
      mode: 'sharedInstance',
    });

    const scoreObjects = (project.data.getScore()[0] as PolyObject)[0]!;
    expect(scoreObjects).toHaveLength(2);
    expect(scoreObjects[0]?.getName()).toBe('Independent');
    expect(scoreObjects[0]?.getStartTime().getValue()).toBe(8);
    expect(scoreObjects[1]?.constructor.name).toBe('Instance');
  });

  it('inserts an independent enabled Effect at the exact mixer chain position', () => {
    const project = activeProject();
    const channel = new Channel();
    channel.setName('Lead');
    channel.setAssociation('1');
    const existing = new Effect();
    existing.setName('Existing');
    channel.getPreEffects().push(existing);
    project.data.getMixer().getChannels().push(channel);

    const effect = new Effect();
    effect.setName('Library Delay');
    effect.setEnabled(false);
    effect.setCode('aout = ain * 0.5');

    const adapter = new UnifiedLibraryProjectAdapter(project.provider);
    const receipt = adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'effect', nodeId: 'effect-1' },
      payloadXml: effect.saveAsXML().toXml(),
      target: {
        ...target('effect', project.revision),
        channelId: '1',
        chain: 'pre',
        insertIndex: 0,
      },
      mode: 'independent',
    });

    expect(receipt).toMatchObject({ libraryType: 'effect', projectRevision: 5 });
    expect(channel.getPreEffects()).toHaveLength(2);
    expect(channel.getPreEffects()[0]).not.toBe(effect);
    expect((channel.getPreEffects()[0] as Effect).getName()).toBe('Library Delay');
    expect((channel.getPreEffects()[0] as Effect).isEnabled()).toBe(true);
    expect((channel.getPreEffects()[1] as Effect).getName()).toBe('Existing');
  });

  it('rejects stale sessions and target revisions with zero mutation', () => {
    const project = activeProject();
    const adapter = new UnifiedLibraryProjectAdapter(project.provider);
    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'instrument-1' };
    expect(() => adapter.applyInsertion({
      key,
      payloadXml: new GenericInstrument().saveAsXML().toXml(),
      target: target('instrument', project.revision, 99),
      mode: 'independent',
    })).toThrow(/stale project session/i);
    expect(() => adapter.applyInsertion({
      key,
      payloadXml: new GenericInstrument().saveAsXML().toXml(),
      target: target('instrument', project.revision - 1),
      mode: 'independent',
    })).toThrow(/stale target/i);
    expect(project.data.getArrangement().size()).toBe(0);
    expect(project.commit).not.toHaveBeenCalled();
  });
});
