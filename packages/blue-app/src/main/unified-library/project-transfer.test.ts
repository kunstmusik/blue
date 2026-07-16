import {
  BlueData,
  Channel,
  Effect,
  GenericInstrument,
  GenericScore,
  OpcodeDefinition,
  PolyObject,
} from '@blue/data';
import { describe, expect, it, vi } from 'vitest';
import { createMixerSnapshot, createNestedPolyObjectSnapshot, createProjectEditorSnapshot } from '../../shared/project-editor';
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
    group,
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

  it('inserts at exact Orchestra/UDO positions without replacing same-name entries', () => {
    const project = activeProject();
    const adapter = new UnifiedLibraryProjectAdapter(project.provider);
    for (const name of ['First', 'Last']) {
      const instrument = new GenericInstrument();
      instrument.setName(name);
      project.data.getArrangement().addInstrumentAtEnd(instrument);
    }
    const middle = new GenericInstrument();
    middle.setName('Middle');
    adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'instrument', nodeId: 'middle' },
      payloadXml: middle.saveAsXML().toXml(),
      target: { ...target('instrument', project.revision), insertIndex: 1 },
      mode: 'independent',
    });
    expect(project.data.getArrangement().getArrangement().map((entry) => entry.instr?.getName()))
      .toEqual(['First', 'Middle', 'Last']);

    const existing = new OpcodeDefinition();
    existing.setName('sameName');
    project.data.getOpcodeList().addOpcode(existing);
    const duplicateNameXml = '<udo><style>CLASSIC</style><opcodeName>sameName</opcodeName><outTypes>a</outTypes><inTypes>a</inTypes><codeBody>aout = ain</codeBody><comments/></udo>';
    adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'udo', nodeId: 'same-name' },
      payloadXml: duplicateNameXml,
      target: { ...target('udo', project.revision), insertIndex: 0 },
      mode: 'independent',
    });
    expect(project.data.getOpcodeList().getOpcodes().map((udo) => udo.getName()))
      .toEqual(['sameName', 'sameName']);
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

  it('resolves a stable nested Score path and rejects changed paths or time contexts', () => {
    const project = activeProject();
    const nested = new PolyObject(true);
    nested.setName('Nested');
    if (nested.length === 0) nested.newLayerAt(0);
    project.group[0]!.push(nested);
    const adapter = new UnifiedLibraryProjectAdapter(project.provider);
    const snapshot = createProjectEditorSnapshot(project.data, null, 11);
    const rootGroup = snapshot.score?.layerGroups.find((candidate) => candidate.name === 'Root');
    const containerItem = rootGroup?.layers[0]?.items.find((candidate) => candidate.name === 'Nested');
    if (!rootGroup || !containerItem?.editorTarget?.location) throw new Error('Expected nested Score fixture');
    const nestedSnapshot = createNestedPolyObjectSnapshot(project.data, containerItem.editorTarget.location);
    if (!nestedSnapshot) throw new Error('Expected nested snapshot');
    const location = {
      rootGroupId: rootGroup.groupId,
      containerPath: [{ layerId: rootGroup.layers[0]!.layerId, objectIdentity: containerItem.objectId }],
      layerId: nestedSnapshot.layers[0]!.layerId,
      startTime: 3,
    };
    const source = new GenericScore();
    source.setName('Nested child');
    adapter.applyInsertion({
      key: { scope: 'user', libraryType: 'soundObject', nodeId: 'nested-child' },
      payloadXml: source.saveAsXML().toXml(),
      target: { ...target('soundObject', project.revision), location },
      mode: 'independent',
    });
    expect(Array.from(nested[0]!, (object) => object.getName())).toEqual(['Nested child']);

    expect(adapter.validateTransferTarget({
      kind: 'score', projectSessionId: 11, projectRevision: project.revision,
      location: { ...location, layerId: 'removed-layer' },
      timeContextRevision: String(project.revision),
    }, 'soundObject')).toMatch(/path|layer/i);
    expect(adapter.validateTransferTarget({
      kind: 'score', projectSessionId: 11, projectRevision: project.revision,
      location,
      timeContextRevision: String(project.revision - 1),
    }, 'soundObject')).toMatch(/time context/i);
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

  it('rejects a changed Effect chain boundary before mutation', () => {
    const project = activeProject();
    const channel = new Channel();
    channel.setAssociation('lead');
    const existing = new Effect();
    channel.getPreEffects().push(existing);
    project.data.getMixer().getChannels().push(channel);
    const adapter = new UnifiedLibraryProjectAdapter(project.provider);
    const channelSnapshot = createMixerSnapshot(project.data.getMixer()).channels[0]!;
    const exactTarget = {
      kind: 'effectChain' as const,
      projectSessionId: 11,
      projectRevision: project.revision,
      channelId: channelSnapshot.id,
      chain: 'pre' as const,
      insertIndex: 1,
      chainRevision: channelSnapshot.preChain.map((entry) => entry.entryId).join(':'),
    };
    expect(adapter.validateTransferTarget(exactTarget, 'effect')).toBeNull();
    channel.getPreEffects().push(new Effect());
    expect(adapter.validateTransferTarget(exactTarget, 'effect')).toMatch(/chain changed/i);
    expect(project.commit).not.toHaveBeenCalled();
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
