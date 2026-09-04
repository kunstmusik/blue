import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  SoundLayer,
  GenericScore,
  NoteProcessorChain,
  AddProcessor,
  MultiplyProcessor,
} from '@blue/data';
import { applyProjectDocumentPatch, createScoreDocumentSnapshot } from './project-editor';
import type { NoteProcessorChainSnapshot } from './project-editor';

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

const emptyChainSnapshot: NoteProcessorChainSnapshot = {
  processors: [],
  hasUnsupportedProcessors: false,
  hasDeferredProcessors: false,
};

function createTestData(): BlueData {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const poly = new PolyObject(true);
  poly.newLayerAt(0);
  const layer0 = poly[0];
  const gs0 = new GenericScore();
  gs0.setName('SoundObj0');
  layer0.push(gs0);

  poly.newLayerAt(1);
  const layer1 = poly[1];
  const gs1 = new GenericScore();
  gs1.setName('SoundObj1');
  layer1.push(gs1);

  score.push(poly);
  return data;
}

describe('replaceScopedNoteProcessorChain patch - soundLayer scope', () => {
  it('replaces empty chain with non-empty chain on sound layer', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);
    const groupId = snap.layerGroups[0]!.groupId;

    expect(snap.layerGroups[0]!.layers[0]!.noteProcessorChain).toBeUndefined();

    const chain = makeChainSnapshot('AddProcessor', '5');
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
    expect(after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
      'AddProcessor',
    );
    expect(after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.parameters.val).toBe(
      '5',
    );
  });

  it('replaces non-empty chain with empty chain on sound layer', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);
    const groupId = snap.layerGroups[0]!.groupId;

    const chain = makeChainSnapshot('AddProcessor', '10');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'soundLayer',
        groupId,
        layerIndex: 1,
        chain,
      },
    });

    const afterSet = createScoreDocumentSnapshot(data);
    expect(afterSet.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors).toHaveLength(1);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'soundLayer',
        groupId,
        layerIndex: 1,
        chain: emptyChainSnapshot,
      },
    });

    const afterClear = createScoreDocumentSnapshot(data);
    expect(afterClear.layerGroups[0]!.layers[1]!.noteProcessorChain).toBeUndefined();
  });

  it('round-trips chain through replace and snapshot at soundLayer scope', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);
    const groupId = snap.layerGroups[0]!.groupId;

    const chain = makeChainSnapshot('MultiplyProcessor', '3');
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
    const layerChain = after.layerGroups[0]!.layers[0]!.noteProcessorChain;
    expect(layerChain).toBeDefined();
    expect(layerChain!.processors).toHaveLength(1);
    expect(layerChain!.processors[0]!.processorType).toBe('MultiplyProcessor');
    expect(layerChain!.processors[0]!.parameters.val).toBe('3');
    expect(layerChain!.hasUnsupportedProcessors).toBe(false);
    expect(layerChain!.hasDeferredProcessors).toBe(false);
  });
});

describe('replaceScopedNoteProcessorChain patch - layerGroup scope', () => {
  it('replaces empty chain with non-empty chain on layer group', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);
    const groupId = snap.layerGroups[0]!.groupId;

    expect(snap.layerGroups[0]!.noteProcessorChain).toBeUndefined();

    const chain = makeChainSnapshot('AddProcessor', '7');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'layerGroup',
        groupId,
        chain,
      },
    });

    const after = createScoreDocumentSnapshot(data);
    expect(after.layerGroups[0]!.noteProcessorChain).toBeDefined();
    expect(after.layerGroups[0]!.noteProcessorChain!.processors).toHaveLength(1);
    expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
      'AddProcessor',
    );
    expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.parameters.val).toBe('7');
  });

  it('replaces non-empty chain with empty chain on layer group', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);
    const groupId = snap.layerGroups[0]!.groupId;

    const chain = makeChainSnapshot('MultiplyProcessor', '2');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'layerGroup',
        groupId,
        chain,
      },
    });

    const afterSet = createScoreDocumentSnapshot(data);
    expect(afterSet.layerGroups[0]!.noteProcessorChain!.processors).toHaveLength(1);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'layerGroup',
        groupId,
        chain: emptyChainSnapshot,
      },
    });

    const afterClear = createScoreDocumentSnapshot(data);
    expect(afterClear.layerGroups[0]!.noteProcessorChain).toBeUndefined();
  });

  it('round-trips chain through replace and snapshot at layerGroup scope', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);
    const groupId = snap.layerGroups[0]!.groupId;

    const chain = makeChainSnapshot('AddProcessor', '42');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'layerGroup',
        groupId,
        chain,
      },
    });

    const after = createScoreDocumentSnapshot(data);
    const groupChain = after.layerGroups[0]!.noteProcessorChain;
    expect(groupChain).toBeDefined();
    expect(groupChain!.processors).toHaveLength(1);
    expect(groupChain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(groupChain!.processors[0]!.parameters.val).toBe('42');
    expect(groupChain!.hasUnsupportedProcessors).toBe(false);
    expect(groupChain!.hasDeferredProcessors).toBe(false);
  });
});

describe('replaceScopedNoteProcessorChain patch - rootScore scope', () => {
  it('replaces empty chain with non-empty chain on root score', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);

    expect(snap.rootNoteProcessorChain).toBeUndefined();

    const chain = makeChainSnapshot('MultiplyProcessor', '4');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'rootScore',
        chain,
      },
    });

    const after = createScoreDocumentSnapshot(data);
    expect(after.rootNoteProcessorChain).toBeDefined();
    expect(after.rootNoteProcessorChain!.processors).toHaveLength(1);
    expect(after.rootNoteProcessorChain!.processors[0]!.processorType).toBe('MultiplyProcessor');
    expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('4');
  });

  it('replaces non-empty chain with empty chain on root score', () => {
    const data = createTestData();

    const chain = makeChainSnapshot('AddProcessor', '8');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'rootScore',
        chain,
      },
    });

    const afterSet = createScoreDocumentSnapshot(data);
    expect(afterSet.rootNoteProcessorChain!.processors).toHaveLength(1);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'rootScore',
        chain: emptyChainSnapshot,
      },
    });

    const afterClear = createScoreDocumentSnapshot(data);
    expect(afterClear.rootNoteProcessorChain).toBeUndefined();
  });

  it('round-trips chain through replace and snapshot at rootScore scope', () => {
    const data = createTestData();

    const chain = makeChainSnapshot('AddProcessor', '99');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'rootScore',
        chain,
      },
    });

    const after = createScoreDocumentSnapshot(data);
    expect(after.rootNoteProcessorChain).toBeDefined();
    expect(after.rootNoteProcessorChain!.processors).toHaveLength(1);
    expect(after.rootNoteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('99');
    expect(after.rootNoteProcessorChain!.hasUnsupportedProcessors).toBe(false);
    expect(after.rootNoteProcessorChain!.hasDeferredProcessors).toBe(false);
  });
});

describe('replaceScopedNoteProcessorChain patch - all three scopes together', () => {
  it('applies patches to all three scopes independently', () => {
    const data = createTestData();
    const snap = createScoreDocumentSnapshot(data);
    const groupId = snap.layerGroups[0]!.groupId;

    const rootChain = makeChainSnapshot('AddProcessor', '1');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'rootScore',
        chain: rootChain,
      },
    });

    const groupChain = makeChainSnapshot('MultiplyProcessor', '2');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'layerGroup',
        groupId,
        chain: groupChain,
      },
    });

    const layerChain = makeChainSnapshot('AddProcessor', '3');
    applyProjectDocumentPatch(data, {
      score: {
        type: 'replaceScopedNoteProcessorChain',
        scope: 'soundLayer',
        groupId,
        layerIndex: 0,
        chain: layerChain,
      },
    });

    const after = createScoreDocumentSnapshot(data);

    expect(after.rootNoteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(after.rootNoteProcessorChain!.processors[0]!.parameters.val).toBe('1');

    expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
      'MultiplyProcessor',
    );
    expect(after.layerGroups[0]!.noteProcessorChain!.processors[0]!.parameters.val).toBe('2');

    expect(after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.processorType).toBe(
      'AddProcessor',
    );
    expect(after.layerGroups[0]!.layers[0]!.noteProcessorChain!.processors[0]!.parameters.val).toBe(
      '3',
    );
  });
});
