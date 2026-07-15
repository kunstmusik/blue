import {
  BlueData,
  GenericInstrument,
  GenericScore,
  OpcodeDefinition,
  UDOStyle,
} from '@blue/data';
import { describe, expect, it } from 'vitest';
import { UnifiedLibraryProjectAdapter } from './project-adapter';

function projectData(): BlueData {
  const data = new BlueData();
  const instrument = new GenericInstrument();
  instrument.setName('Project Pad');
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
  });
});
