import { describe, it, expect } from 'vitest';
import {
  createProjectEditorSnapshot,
  createEffectEditorSnapshot,
  applyProjectDocumentPatch,
  isEmptyProjectDocumentPatch,
  udoToSnapshot,
} from '../../shared/project-editor';
import { BlueData, Effect, OpcodeDefinition, UDOStyle, Tables } from '@blue/data';

function makeTestProject(): BlueData {
  const data = new BlueData();
  data.getTableSet().setTables('f 1 0 1024 10 1\nf 2 0 2048 10 1');

  const udo1 = new OpcodeDefinition();
  udo1.setName('saturate');
  udo1.setStyle(UDOStyle.CLASSIC);
  udo1.setOutTypes('a');
  udo1.setInTypes('ak');
  udo1.setCode('aSig, kDrive xin\naOut = tanh(aSig * kDrive)\nxout aOut');
  data.getOpcodeList().addOpcode(udo1);

  const udo2 = new OpcodeDefinition();
  udo2.setName('distort');
  udo2.setStyle(UDOStyle.MODERN);
  udo2.setOutTypes('a');
  udo2.setInputArguments('aSig, kAmount');
  udo2.setCode('aOut = aSig * kAmount\nxout aOut');
  data.getOpcodeList().addOpcode(udo2);

  return data;
}

describe('Tables and UDO contract tests', () => {
  describe('ProjectEditorSnapshot includes tables and UDOs', () => {
    it('snapshot contains tablesText from project data', () => {
      const data = makeTestProject();
      const snapshot = createProjectEditorSnapshot(data, '/test.blue');
      expect(snapshot.tablesText).toBe('f 1 0 1024 10 1\nf 2 0 2048 10 1');
    });

    it('snapshot contains projectUdos from root opcode list', () => {
      const data = makeTestProject();
      const snapshot = createProjectEditorSnapshot(data, '/test.blue');
      expect(snapshot.projectUdos).toHaveLength(2);
      expect(snapshot.projectUdos[0].name).toBe('saturate');
      expect(snapshot.projectUdos[0].style).toBe('CLASSIC');
      expect(snapshot.projectUdos[1].name).toBe('distort');
      expect(snapshot.projectUdos[1].style).toBe('MODERN');
    });

    it('empty project has empty tables and UDOs', () => {
      const data = new BlueData();
      const snapshot = createProjectEditorSnapshot(data, null);
      expect(snapshot.tablesText).toBe('');
      expect(snapshot.projectUdos).toHaveLength(0);
    });
  });

  describe('Tables text patch', () => {
    it('updates tables text on canonical BlueData', () => {
      const data = new BlueData();
      data.getTableSet().setTables('old text');

      const changed = applyProjectDocumentPatch(data, {
        tablesText: 'new table text',
      });

      expect(changed).toBe(true);
      expect(data.getTableSet().getTables()).toBe('new table text');
    });

    it('tablesText is not an empty patch', () => {
      expect(isEmptyProjectDocumentPatch({ tablesText: 'x' })).toBe(false);
    });
  });

  describe('Project UDO patch: add', () => {
    it('adds a new UDO at the end by default', () => {
      const data = makeTestProject();
      applyProjectDocumentPatch(data, {
        projectUdo: { type: 'add' },
      });
      expect(data.getOpcodeList().size()).toBe(3);
      expect(data.getOpcodeList().getOpcode(2)!.getName()).toBe('newOpcode');
    });

    it('adds a UDO with a definition at a specific index', () => {
      const data = makeTestProject();
      applyProjectDocumentPatch(data, {
        projectUdo: {
          type: 'add',
          index: 0,
          definition: {
            name: 'inserted',
            style: 'CLASSIC',
            outTypes: 'k',
            inTypes: 'k',
            inputArguments: '',
            code: 'xout 1',
            comments: '',
          },
        },
      });
      expect(data.getOpcodeList().size()).toBe(3);
      expect(data.getOpcodeList().getOpcode(0)!.getName()).toBe('inserted');
    });
  });

  describe('Project UDO patch: remove', () => {
    it('removes a UDO at the given index', () => {
      const data = makeTestProject();
      applyProjectDocumentPatch(data, {
        projectUdo: { type: 'remove', index: 0 },
      });
      expect(data.getOpcodeList().size()).toBe(1);
      expect(data.getOpcodeList().getOpcode(0)!.getName()).toBe('distort');
    });
  });

  describe('Project UDO patch: update', () => {
    it('updates specific fields on a UDO', () => {
      const data = makeTestProject();
      applyProjectDocumentPatch(data, {
        projectUdo: { type: 'update', index: 0, patch: { name: 'renamed' } },
      });
      expect(data.getOpcodeList().getOpcode(0)!.getName()).toBe('renamed');
      expect(data.getOpcodeList().getOpcode(0)!.getOutTypes()).toBe('a');
    });
  });

  describe('Project UDO patch: reorder', () => {
    it('moves a UDO from one index to another', () => {
      const data = makeTestProject();
      applyProjectDocumentPatch(data, {
        projectUdo: { type: 'reorder', from: 0, to: 1 },
      });
      expect(data.getOpcodeList().getOpcode(0)!.getName()).toBe('distort');
      expect(data.getOpcodeList().getOpcode(1)!.getName()).toBe('saturate');
    });
  });

  describe('Project UDO patch: convertStyle', () => {
    it('converts a classic UDO to modern', () => {
      const data = makeTestProject();
      applyProjectDocumentPatch(data, {
        projectUdo: { type: 'convertStyle', index: 0, style: 'MODERN' },
      });
      const udo = data.getOpcodeList().getOpcode(0)!;
      expect(udo.getStyle()).toBe(UDOStyle.MODERN);
      expect(udo.getInputArguments().length).toBeGreaterThan(0);
    });
  });

  describe('isEmptyProjectDocumentPatch', () => {
    it('returns true for empty object', () => {
      expect(isEmptyProjectDocumentPatch({})).toBe(true);
    });

    it('returns false for projectUdo patch', () => {
      expect(isEmptyProjectDocumentPatch({ projectUdo: { type: 'add' } })).toBe(false);
    });
  });

  describe('udoToSnapshot', () => {
    it('converts OpcodeDefinition to UdoDefinitionSnapshot', () => {
      const udo = new OpcodeDefinition();
      udo.setName('test');
      udo.setStyle(UDOStyle.CLASSIC);
      udo.setOutTypes('a');
      udo.setInTypes('k');
      udo.setCode('xout 1');
      udo.setComments('a comment');

      const snap = udoToSnapshot(udo);
      expect(snap.name).toBe('test');
      expect(snap.style).toBe('CLASSIC');
      expect(snap.outTypes).toBe('a');
      expect(snap.inTypes).toBe('k');
      expect(snap.code).toBe('xout 1');
      expect(snap.comments).toBe('a comment');
    });
  });

  describe('completion compatibility (US5, T031)', () => {
    it('udoToSnapshot preserves authored UDO definition fields used by completion', () => {
      const udo = new OpcodeDefinition();
      udo.setName('PolyTone');
      udo.setStyle(UDOStyle.MODERN);
      udo.setOutTypes('a, k');
      udo.setInTypes('');
      udo.setInputArguments('aSig, kFreq');
      udo.setCode('xout aSig, kFreq');
      udo.setComments('');

      const snap = udoToSnapshot(udo);
      // Completion derives its signature from exactly these fields; they must
      // remain the authored values, unaffected by the completion feature.
      expect(snap.name).toBe('PolyTone');
      expect(snap.style).toBe('MODERN');
      expect(snap.outTypes).toBe('a, k');
      expect(snap.inputArguments).toBe('aSig, kFreq');
    });

    it('createEffectEditorSnapshot forces an empty project UDO projection for library effects', () => {
      const udo = new OpcodeDefinition();
      udo.setName('ProjectOnly');
      udo.setStyle(UDOStyle.CLASSIC);
      udo.setOutTypes('a');
      udo.setInTypes('a');
      const projectUdoSnapshot = [udoToSnapshot(udo)];

      const effect = new Effect();
      effect.setName('Delay');
      effect.setCode('aout = ain');

      const project = createEffectEditorSnapshot(effect, 'fx-1', 'project', {
        projectUdos: projectUdoSnapshot,
      });
      expect(project.projectUdos).toHaveLength(1);

      const library = createEffectEditorSnapshot(effect, 'fx-2', 'library', {
        projectUdos: projectUdoSnapshot,
      });
      // Library effects never receive project UDOs, even when supplied.
      expect(library.projectUdos).toEqual([]);
    });
  });
});
