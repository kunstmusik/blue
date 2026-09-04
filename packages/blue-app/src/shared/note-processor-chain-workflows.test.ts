import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  SoundLayer,
  GenericScore,
  NoteProcessorChain,
  AddProcessor,
  MultiplyProcessor,
  RotateProcessor,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createScoreDocumentSnapshot,
  createProjectEditorSnapshot,
  createScoreObjectEditorDocument,
} from './project-editor';
import type { NoteProcessorChainSnapshot, ScoreObjectEditorRequest } from './project-editor';

function makeChainSnapshot(processorType: string, val: string): NoteProcessorChainSnapshot {
  return {
    processors: [
      {
        id: 'np-0',
        processorType,
        displayName: processorType,
        supported: true,
        deferred: false,
        summary: processorType,
        parameters: { pfield: '4', val },
        serializedXml: '',
      },
    ],
    hasUnsupportedProcessors: false,
    hasDeferredProcessors: false,
  };
}

function createDataWithAllScopes(): BlueData {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const rootChain = new NoteProcessorChain();
  const rootAdd = new AddProcessor();
  rootAdd.setVal('10');
  rootChain.addProcessor(rootAdd);
  score.setNoteProcessorChain(rootChain);

  const poly = new PolyObject(true);
  poly.setName('Group');

  const groupChain = new NoteProcessorChain();
  const groupRot = new RotateProcessor();
  groupRot.setNoteIndex('2');
  groupChain.addProcessor(groupRot);
  poly.setNoteProcessorChain(groupChain);

  const layer0 = new SoundLayer();
  layer0.setName('L0');
  const gs0 = new GenericScore();
  gs0.setName('Obj0');
  layer0.push(gs0);

  const layer1 = new SoundLayer();
  layer1.setName('L1');
  const gs1 = new GenericScore();
  gs1.setName('Obj1');
  const layerChain = new NoteProcessorChain();
  const layerMul = new MultiplyProcessor();
  layerMul.setVal('3');
  layerChain.addProcessor(layerMul);
  layer1.setNoteProcessorChain(layerChain);
  layer1.push(gs1);

  poly.push(layer0);
  poly.push(layer1);
  score.push(poly);

  return data;
}

describe('note-processor-chain-workflows', () => {
  describe('full workflow snapshot', () => {
    it('captures chains at all scopes in a single snapshot', () => {
      const data = createDataWithAllScopes();
      const snap = createScoreDocumentSnapshot(data);

      expect(snap.rootNoteProcessorChain).toBeDefined();
      expect(snap.rootNoteProcessorChain!.processors).toHaveLength(1);
      expect(snap.rootNoteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
      expect(snap.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('10');

      expect(snap.layerGroups).toHaveLength(1);
      expect(snap.layerGroups[0]!.noteProcessorChain).toBeDefined();
      expect(snap.layerGroups[0]!.noteProcessorChain!.processors).toHaveLength(1);
      expect(snap.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        'RotateProcessor',
      );

      expect(snap.layerGroups[0]!.layers[0]!.noteProcessorChain).toBeUndefined();
      expect(snap.layerGroups[0]!.layers[1]!.noteProcessorChain).toBeDefined();
      expect(snap.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors).toHaveLength(1);
      expect(snap.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        'MultiplyProcessor',
      );
      expect(
        snap.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.parameters.val,
      ).toBe('3');
    });
  });

  describe('object scope patch workflow', () => {
    it('applies replaceNoteProcessorChain and reflects in score object editor document', () => {
      const data = createDataWithAllScopes();
      const fullSnap = createProjectEditorSnapshot(data, null);
      const item = fullSnap.score?.layerGroups[0]?.layers[1]?.items[0]!;
      const target = item.editorTarget;

      const newChain = makeChainSnapshot('AddProcessor', '77');
      applyProjectDocumentPatch(data, {
        score: { type: 'replaceNoteProcessorChain', target, chain: newChain },
      });

      const request: ScoreObjectEditorRequest = { target };
      const doc = createScoreObjectEditorDocument(data, request);
      expect(doc?.shared.noteProcessorChain).toBeDefined();
      expect(doc!.shared.noteProcessorChain!.processors).toHaveLength(1);
      expect(doc!.shared.noteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
      expect(doc!.shared.noteProcessorChain!.processors[0]!.parameters.val).toBe('77');
    });
  });

  describe('layer scope patch workflow', () => {
    it('applies replaceScopedNoteProcessorChain with soundLayer scope and reflects in snapshot', () => {
      const data = createDataWithAllScopes();
      const snap = createScoreDocumentSnapshot(data);
      const groupId = snap.layerGroups[0]!.groupId;

      expect(snap.layerGroups[0]!.layers[0]!.noteProcessorChain).toBeUndefined();

      const chain = makeChainSnapshot('MultiplyProcessor', '5');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'soundLayer',
          groupId,
          layerIndex: 0,
          chain,
        },
      });

      const after = createScoreDocumentSnapshot(data);
      expect(after.layerGroups[0]!.layers[0]!.noteProcessorChain).toBeDefined();
      expect(after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors).toHaveLength(1);
      expect(
        after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.processorType,
      ).toBe('MultiplyProcessor');
      expect(
        after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.parameters.val,
      ).toBe('5');
    });
  });

  describe('group scope patch workflow', () => {
    it('applies replaceScopedNoteProcessorChain with layerGroup scope and reflects in snapshot', () => {
      const data = createDataWithAllScopes();
      const snap = createScoreDocumentSnapshot(data);
      const groupId = snap.layerGroups[0]!.groupId;

      expect(snap.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        'RotateProcessor',
      );

      const chain = makeChainSnapshot('AddProcessor', '11');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'layerGroup',
          groupId,
          chain,
        },
      });

      const after = createScoreDocumentSnapshot(data);
      expect(after.layerGroups[0]!.noteProcessorChain!.processors).toHaveLength(1);
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        'AddProcessor',
      );
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.parameters.val).toBe('11');
    });
  });

  describe('root scope patch workflow', () => {
    it('applies replaceScopedNoteProcessorChain with rootScore scope and reflects in snapshot', () => {
      const data = createDataWithAllScopes();
      const snap = createScoreDocumentSnapshot(data);

      expect(snap.rootNoteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
      expect(snap.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('10');

      const chain = makeChainSnapshot('MultiplyProcessor', '9');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'rootScore',
          chain,
        },
      });

      const after = createScoreDocumentSnapshot(data);
      expect(after.rootNoteProcessorChain!.processors).toHaveLength(1);
      expect(after.rootNoteProcessorChain!.processors[0]!.processorType).toBe('MultiplyProcessor');
      expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('9');
    });
  });

  describe('named chain save workflow', () => {
    it('saves a named chain and it appears in getChainNames', () => {
      const data = createDataWithAllScopes();
      expect(data.getNoteProcessorChainMap().getChainNames()).toHaveLength(0);

      const chain = makeChainSnapshot('AddProcessor', '42');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'saveNamedNoteProcessorChain',
          name: 'MyChain',
          chain,
        },
      });

      expect(data.getNoteProcessorChainMap().getChainNames()).toContain('MyChain');
    });
  });

  describe('named chain delete workflow', () => {
    it('deletes a named chain and it is removed from getChainNames', () => {
      const data = createDataWithAllScopes();

      const chain = makeChainSnapshot('MultiplyProcessor', '7');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'saveNamedNoteProcessorChain',
          name: 'ToDelete',
          chain,
        },
      });
      expect(data.getNoteProcessorChainMap().getChainNames()).toContain('ToDelete');

      applyProjectDocumentPatch(data, {
        score: {
          type: 'deleteNamedNoteProcessorChain',
          name: 'ToDelete',
        },
      });

      expect(data.getNoteProcessorChainMap().getChainNames()).not.toContain('ToDelete');
    });
  });

  describe('independent scope updates', () => {
    it('modifying root chain does not affect group or layer chains', () => {
      const data = createDataWithAllScopes();
      const before = createScoreDocumentSnapshot(data);

      const originalGroupType =
        before.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType;
      const originalLayerVal =
        before.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.parameters.val;

      const newRoot = makeChainSnapshot('MultiplyProcessor', '99');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'rootScore',
          chain: newRoot,
        },
      });

      const after = createScoreDocumentSnapshot(data);
      expect(after.rootNoteProcessorChain!.processors[0]!.processorType).toBe('MultiplyProcessor');
      expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('99');
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        originalGroupType,
      );
      expect(
        after.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.parameters.val,
      ).toBe(originalLayerVal);
    });

    it('modifying layer chain does not affect root or group chains', () => {
      const data = createDataWithAllScopes();
      const snap = createScoreDocumentSnapshot(data);
      const groupId = snap.layerGroups[0]!.groupId;

      const originalRootVal = snap.rootNoteProcessorChain!.processors[0]!.parameters.val;
      const originalGroupType =
        snap.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType;

      const newLayer = makeChainSnapshot('AddProcessor', '55');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'soundLayer',
          groupId,
          layerIndex: 0,
          chain: newLayer,
        },
      });

      const after = createScoreDocumentSnapshot(data);
      expect(
        after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.processorType,
      ).toBe('AddProcessor');
      expect(
        after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.parameters.val,
      ).toBe('55');
      expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe(originalRootVal);
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        originalGroupType,
      );
    });

    it('modifying group chain does not affect root or layer chains', () => {
      const data = createDataWithAllScopes();
      const snap = createScoreDocumentSnapshot(data);
      const groupId = snap.layerGroups[0]!.groupId;

      const originalRootVal = snap.rootNoteProcessorChain!.processors[0]!.parameters.val;
      const originalLayerVal =
        snap.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.parameters.val;

      const newGroup = makeChainSnapshot('MultiplyProcessor', '88');
      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'layerGroup',
          groupId,
          chain: newGroup,
        },
      });

      const after = createScoreDocumentSnapshot(data);
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        'MultiplyProcessor',
      );
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.parameters.val).toBe('88');
      expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe(originalRootVal);
      expect(
        after.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.parameters.val,
      ).toBe(originalLayerVal);
    });
  });

  describe('snapshot reflects all patches', () => {
    it('applies patches at all scopes then verifies final snapshot', () => {
      const data = createDataWithAllScopes();
      const snap = createScoreDocumentSnapshot(data);
      const groupId = snap.layerGroups[0]!.groupId;

      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'rootScore',
          chain: makeChainSnapshot('MultiplyProcessor', '100'),
        },
      });

      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'layerGroup',
          groupId,
          chain: makeChainSnapshot('AddProcessor', '200'),
        },
      });

      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'soundLayer',
          groupId,
          layerIndex: 0,
          chain: makeChainSnapshot('MultiplyProcessor', '300'),
        },
      });

      applyProjectDocumentPatch(data, {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'soundLayer',
          groupId,
          layerIndex: 1,
          chain: makeChainSnapshot('AddProcessor', '400'),
        },
      });

      const after = createScoreDocumentSnapshot(data);

      expect(after.rootNoteProcessorChain!.processors).toHaveLength(1);
      expect(after.rootNoteProcessorChain!.processors[0]!.processorType).toBe('MultiplyProcessor');
      expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('100');

      expect(after.layerGroups[0]!.noteProcessorChain!.processors).toHaveLength(1);
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
        'AddProcessor',
      );
      expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.parameters.val).toBe('200');

      expect(after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors).toHaveLength(1);
      expect(
        after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.processorType,
      ).toBe('MultiplyProcessor');
      expect(
        after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.parameters.val,
      ).toBe('300');

      expect(after.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors).toHaveLength(1);
      expect(
        after.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.processorType,
      ).toBe('AddProcessor');
      expect(
        after.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0]!.parameters.val,
      ).toBe('400');
    });
  });
});
