import {
  BlueData,
  CompileData,
  GenericInstrument,
  GenericScore,
  Instance,
  OpcodeDefinition,
  PolyObject,
  TimeContext,
  UDOStyle,
} from '@blue/data';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryProjectAdapter } from './project-adapter';

function projectData(): BlueData {
  const data = new BlueData();
  const instrument = new GenericInstrument();
  instrument.setName('Project Pad');
  const embeddedOpcode = new OpcodeDefinition();
  embeddedOpcode.setName('embeddedTone');
  embeddedOpcode.setStyle(UDOStyle.MODERN);
  embeddedOpcode.setOutTypes('a');
  embeddedOpcode.setInputArguments('ain:a');
  embeddedOpcode.setCode('return ain');
  instrument.getOpcodeList().addOpcode(embeddedOpcode);
  data.getArrangement().addInstrument(instrument, '7');

  const opcode = new OpcodeDefinition();
  opcode.setName('projectFx');
  opcode.setStyle(UDOStyle.CLASSIC);
  opcode.setOutTypes('a');
  opcode.setInTypes('a');
  opcode.setCode('aout = ain');
  data.getOpcodeList().addOpcode(opcode);

  const score = new GenericScore();
  score.setName('Shared Motif');
  data.getSoundObjectLibrary().addObject(score);
  return data;
}

describe('UnifiedLibraryProjectAdapter', () => {
  it('composes read-only project instruments, UDOs, and shared SoundObjects with stable locators', () => {
    const data = projectData();
    const adapter = new UnifiedLibraryProjectAdapter(() => ({ data, sessionId: 42 }));

    const instruments = adapter.list('instrument');
    const udos = adapter.list('udo');
    const soundObjects = adapter.list('soundObject');

    expect(instruments[0]).toMatchObject({
      displayName: 'Project Pad',
      scope: 'projectOwned',
      key: { projectSessionId: 42, locator: { kind: 'instrument', assignmentId: '7' } },
    });
    expect(udos[0]).toMatchObject({
      displayName: 'projectFx',
      key: {
        locator: {
          kind: 'udo',
          persistedFingerprint: { opcodeName: 'projectFx', style: 'CLASSIC' },
        },
      },
    });
    expect(udos[1]).toMatchObject({
      displayName: 'embeddedTone',
      breadcrumb: ['Project Orchestra', '7 Project Pad', 'UDOs'],
      key: {
        locator: {
          kind: 'udo',
          instrumentAssignmentId: '7',
          sessionObjectId: 'instrument:7:udo:0',
          persistedFingerprint: { opcodeName: 'embeddedTone', style: 'MODERN' },
        },
      },
    });
    expect(soundObjects[0]).toMatchObject({
      displayName: 'Shared Motif',
      scope: 'projectShared',
      key: { locator: { kind: 'soundObject', libraryId: 'lib_0' } },
    });
    expect(adapter.list('effect')).toEqual([]);

    expect(new UnifiedLibraryProjectAdapter(() => null).list('instrument')).toEqual([]);
  });

  it('returns lightweight previews and rejects stale project sessions', () => {
    const data = projectData();
    const adapter = new UnifiedLibraryProjectAdapter(() => ({ data, sessionId: 8 }));
    const item = adapter.list('udo')[0]!;

    expect(adapter.preview(item.key)).toMatchObject({
      displayName: 'projectFx',
      supportStatus: 'supported',
      fields: { style: { state: 'available', value: 'CLASSIC' } },
    });
    expect(item.key.scope).not.toBe('user');
    if (item.key.scope === 'user') return;
    expect(adapter.preview({ ...item.key, projectSessionId: 7 })).toBeNull();

    const embedded = adapter.list('udo')[1]!;
    expect(adapter.preview(embedded.key)).toMatchObject({
      displayName: 'embeddedTone',
      fields: { style: { state: 'available', value: 'MODERN' } },
    });
  });

  it('adds a timeline SoundObject to the project library and replaces it with a linked Instance', () => {
    const data = projectData();
    const root = data.getScore()[0];
    if (!(root instanceof PolyObject)) throw new Error('Expected the default PolyObject root');
    const timelineObject = new GenericScore();
    timelineObject.setName('Timeline Phrase');
    root[0]!.push(timelineObject);
    let revision = 3;
    const adapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 42,
      revision,
      commit: () => ++revision,
    }));

    const receipt = adapter.addTimelineSoundObjectToProjectLibrary({
      projectSessionId: 42,
      projectRevision: 3,
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
      },
    });

    expect(receipt).toMatchObject({
      projectSessionId: 42,
      projectRevision: 4,
      libraryType: 'soundObject',
      message: 'Timeline Phrase was added to Project SoundObjects.',
    });
    expect(data.getSoundObjectLibrary().size()).toBe(2);
    const replacement = root[0]![0];
    expect(replacement).toBeInstanceOf(Instance);
    expect((replacement as Instance).getLibraryId()).toBe(receipt.insertedIdentity);
    expect((replacement as Instance).getSoundObject()?.getName()).toBe('Timeline Phrase');
  });

  it('relinks every Instance to an edited library definition used for score generation', () => {
    const data = new BlueData();
    const definition = new GenericScore();
    definition.setName('Shared Phrase');
    definition.setScoreText('i1 0 1 440');
    const libraryId = data.getSoundObjectLibrary().addObject(definition);

    const root = new PolyObject(true);
    root.newLayerAt(0);
    const nested = new PolyObject(true);
    nested.newLayerAt(0);
    const first = new Instance();
    first.setSoundObject(definition);
    first.setLibraryId(libraryId);
    const second = new Instance();
    second.setSoundObject(definition);
    second.setLibraryId(libraryId);
    const libraryContainer = new PolyObject(true);
    libraryContainer.newLayerAt(0);
    const libraryNested = new Instance();
    libraryNested.setSoundObject(definition);
    libraryNested.setLibraryId(libraryId);
    libraryContainer[0]!.push(libraryNested);
    const libraryContainerId = data.getSoundObjectLibrary().addObject(libraryContainer);
    const containerInstance = new Instance();
    containerInstance.setSoundObject(libraryContainer);
    containerInstance.setLibraryId(libraryContainerId);
    root[0]!.push(first, nested, containerInstance);
    nested[0]!.push(second);
    data.getScore().push(root);

    let revision = 1;
    const adapter = new UnifiedLibraryProjectAdapter(() => ({
      data,
      sessionId: 42,
      revision,
      commit: () => ++revision,
    }));
    const key = adapter.list('soundObject')[0]!.key;
    const source = adapter.getEditorSource(key)!;
    const edited = GenericScore.loadFromXML(definition.saveAsXML());
    edited.setScoreText('i2 0 1 880');

    expect(adapter.saveEditorSource(key, source.revision, edited.saveAsXML().toXml())).not.toBeNull();

    const canonical = data.getSoundObjectLibrary().getObjectById(libraryId);
    expect(first.getSoundObject()).toBe(canonical);
    expect(second.getSoundObject()).toBe(canonical);
    expect(libraryNested.getSoundObject()).toBe(canonical);
    const context = new TimeContext();
    const compileData = CompileData.createEmptyCompileData();
    expect(first.generateForCSD(context, compileData, 0, -1).toString()).toContain('i2');
    expect(second.generateForCSD(context, compileData, 0, -1).toString()).toContain('i2');
    expect(libraryNested.generateForCSD(context, compileData, 0, -1).toString()).toContain('i2');
    expect(first.generateForCSD(context, compileData, 0, -1).toString()).not.toContain('i1');
    const generatedCsd = data.toCSD();
    expect(generatedCsd).toContain('i2');
    expect(generatedCsd).not.toContain('i1 0 1 440');
  });
});
