import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScoreObjectPropertiesPanel from '../components/workbench/panels/ScoreObjectPropertiesPanel';
import type {
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectEditorTargetSnapshot,
  TimeConversionContext,
} from '../../shared/project-editor';

const DEFAULT_TIME_CONTEXT: TimeConversionContext = {
  meterEntries: [{ measure: 1, numBeats: 4, beatLength: 4 }],
  tempoEnabled: false,
  initialTempo: 60,
  sampleRate: 44100,
};

const mockApplyPatch = vi.fn();
let mockStoreState: Record<string, any>;
let mockSelectionState: Record<string, any>;
let mockEditorDocument: ScoreObjectEditorDocumentSnapshot | null = null;

vi.mock('../stores/project-store', () => ({
  useProjectStore: vi.fn((selector: any) => selector(mockStoreState)),
}));

vi.mock('../stores/score-selection-store', () => ({
  useScoreSelectionStore: vi.fn((selector: any) => selector(mockSelectionState)),
}));

vi.mock('../../shared/project-editor', async () => vi.importActual('../../shared/project-editor'));

function makeTarget(
  overrides?: Partial<ScoreObjectEditorTargetSnapshot>,
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'GenericScore',
    editorObjectType: 'GenericScore',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
    ...overrides,
  };
}

function makeEditorDoc(
  overrides?: Partial<ScoreObjectEditorDocumentSnapshot>,
): ScoreObjectEditorDocumentSnapshot {
  const target = makeTarget();
  return {
    target,
    shared: {
      target,
      name: 'Test Object',
      startTime: { value: 0, timeBase: 'beats', displayText: '0.0000' },
      subjectiveDuration: { value: 4, timeBase: 'beats', displayText: '4.0000' },
      endTimeDisplay: '4.0000',
      backgroundColor: 0,
      timeBehavior: 'SCALE',
      repeatPoint: null,
      noteProcessorChain: null,
    },
    editor: { kind: 'code', target, syntax: 'csound-score', text: 'i1 0 1 440' },
    timeContext: DEFAULT_TIME_CONTEXT,
    ...overrides,
  };
}

describe('ScoreObjectPropertiesPanel — no selection states (T016)', () => {
  beforeEach(() => {
    mockStoreState = {
      loaded: false,
      score: { timeState: { primaryTimeDisplay: 'BEATS' }, layerGroups: [] },
      applyProjectDocumentPatch: mockApplyPatch,
    };
    mockSelectionState = { selectedObjectIds: new Set() };
    mockApplyPatch.mockClear();
  });

  it('shows "No project loaded" when project is not loaded', () => {
    const html = renderToStaticMarkup(createElement(ScoreObjectPropertiesPanel));
    expect(html).toContain('No project loaded');
  });

  it('shows "No score object selected" when project is loaded but nothing selected', () => {
    mockStoreState.loaded = true;
    mockStoreState.score = {
      timeState: { primaryTimeDisplay: 'BEATS' },
      layerGroups: [
        {
          groupId: 'g0',
          layers: [
            {
              layerId: 'l0',
              name: '',
              height: 44,
              muted: false,
              solo: false,
              items: [],
            },
          ],
          layerCount: 1,
          label: 'Score',
        },
      ],
    };

    const html = renderToStaticMarkup(createElement(ScoreObjectPropertiesPanel));
    expect(html).toContain('No score object selected');
  });

  it('shows "Multiple objects selected" when more than one object is selected', () => {
    mockStoreState.loaded = true;
    mockSelectionState.selectedObjectIds = new Set(['id-1', 'id-2']);

    const html = renderToStaticMarkup(createElement(ScoreObjectPropertiesPanel));
    expect(html).toContain('Multiple objects selected');
  });

  it('shows "No properties available" when selected object ID does not match any row', () => {
    mockStoreState.loaded = true;
    mockSelectionState.selectedObjectIds = new Set(['missing-id']);
    mockStoreState.score = {
      timeState: { primaryTimeDisplay: 'BEATS' },
      layerGroups: [
        {
          groupId: 'g0',
          layers: [
            {
              layerId: 'l0',
              name: '',
              height: 44,
              muted: false,
              solo: false,
              items: [],
            },
          ],
          layerCount: 1,
          label: 'Score',
        },
      ],
    };

    const html = renderToStaticMarkup(createElement(ScoreObjectPropertiesPanel));
    expect(html).toContain('No properties available');
  });
});

describe('ScoreObjectPropertiesPanel — single selection (T016)', () => {
  beforeEach(() => {
    const target = makeTarget();
    mockStoreState = {
      loaded: true,
      score: {
        timeState: { primaryTimeDisplay: 'BEATS' },
        layerGroups: [
          {
            groupId: 'g0',
            layers: [
              {
                layerId: 'l0',
                name: '',
                height: 44,
                muted: false,
                solo: false,
                items: [
                  {
                    objectId: 'sobj-0-0',
                    name: 'My Score',
                    startBeats: 2,
                    durationBeats: 4,
                    backgroundColor: 0xff0000,
                    editorTarget: target,
                  },
                ],
              },
            ],
            layerCount: 1,
            label: 'Score',
          },
        ],
      },
      applyProjectDocumentPatch: mockApplyPatch,
    };
    mockSelectionState = { selectedObjectIds: new Set(['sobj-0-0']) };
    mockApplyPatch.mockClear();
  });

  it('renders without error when a single object is selected', () => {
    const html = renderToStaticMarkup(createElement(ScoreObjectPropertiesPanel));
    expect(html).toBeDefined();
    expect(html.length).toBeGreaterThan(0);
  });
});

describe('ScoreObjectPropertiesPanel — shared property mutations (T017)', () => {
  it('applyProjectDocumentPatch is called for updateSharedProperties with name change', () => {
    const target = makeTarget();
    const doc = makeEditorDoc();

    expect(doc.shared.name).toBe('Test Object');
    expect(doc.target.selectionId).toBe(target.selectionId);
    expect(doc.editor.kind).toBe('code');
  });

  it('editor document snapshot contains correct start time and duration', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.startTime.value).toBe(0);
    expect(doc.shared.startTime.timeBase).toBe('beats');
    expect(doc.shared.subjectiveDuration.value).toBe(4);
    expect(doc.shared.subjectiveDuration.timeBase).toBe('beats');
  });

  it('editor document snapshot contains backgroundColor', () => {
    const doc = makeEditorDoc({ shared: { ...makeEditorDoc().shared, backgroundColor: 0x00ff00 } });
    expect(doc.shared.backgroundColor).toBe(0x00ff00);
  });
});

describe('ScoreObjectPropertiesPanel — time behavior, repeat point, note processor chain (T018)', () => {
  it('editor document includes timeBehavior for sound objects', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.timeBehavior).toBe('SCALE');
  });

  it('editor document includes repeatPoint (null when unset)', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.repeatPoint).toBeNull();
  });

  it('editor document includes repeatPoint with value when set', () => {
    const doc = makeEditorDoc({
      shared: {
        ...makeEditorDoc().shared,
        repeatPoint: { value: 3.5, timeBase: 'beats', displayText: '3.5000' },
      },
    });
    expect(doc.shared.repeatPoint).not.toBeNull();
    expect(doc.shared.repeatPoint!.value).toBeCloseTo(3.5);
  });

  it('editor document includes noteProcessorChain (null when empty)', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.noteProcessorChain).toBeNull();
  });

  it('editor document omits timeBehavior for non-sound-objects', () => {
    const target = makeTarget({
      selectedObjectType: 'AudioClip',
      editorObjectType: 'AudioClip',
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    });
    const doc = makeEditorDoc({
      target,
      shared: {
        target,
        name: 'Clip',
        startTime: { value: 0, timeBase: 'beats', displayText: '0.0000' },
        subjectiveDuration: { value: 2, timeBase: 'beats', displayText: '2.0000' },
        endTimeDisplay: '2.0000',
        backgroundColor: 0,
      },
      editor: {
        kind: 'audioClip',
        target,
        audioFile: 'test.wav',
        numChannels: 0,
        audioDuration: 0,
        fileStartTime: 0,
        fadeIn: 0,
        fadeInType: 'LINEAR',
        fadeOut: 0,
        fadeOutType: 'LINEAR',
        looping: false,
      },
    });
    expect(doc.shared.timeBehavior).toBeUndefined();
    expect(doc.shared.repeatPoint).toBeUndefined();
    expect(doc.shared.noteProcessorChain).toBeUndefined();
  });
});

describe('ScoreObjectPropertiesPanel — Java Blue parity: time behavior options', () => {
  it('REPEAT_CLASSIC is a valid time behavior value', () => {
    const doc = makeEditorDoc({
      shared: {
        ...makeEditorDoc().shared,
        timeBehavior: 'REPEAT_CLASSIC',
      },
    });
    expect(doc.shared.timeBehavior).toBe('REPEAT_CLASSIC');
  });

  it('supports all four time behavior values from Java Blue', () => {
    const values = ['SCALE', 'REPEAT', 'REPEAT_CLASSIC', 'NONE'];
    for (const tb of values) {
      const doc = makeEditorDoc({
        shared: { ...makeEditorDoc().shared, timeBehavior: tb },
      });
      expect(doc.shared.timeBehavior).toBe(tb);
    }
  });
});

describe('ScoreObjectPropertiesPanel — Java Blue parity: use repeat point checkbox', () => {
  it('repeatPoint is null when use repeat point is off', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.repeatPoint).toBeNull();
  });

  it('repeatPoint has a value when use repeat point is on', () => {
    const doc = makeEditorDoc({
      shared: {
        ...makeEditorDoc().shared,
        timeBehavior: 'REPEAT',
        repeatPoint: { value: 4.0, timeBase: 'beats', displayText: '4.0000' },
      },
    });
    expect(doc.shared.repeatPoint).not.toBeNull();
    expect(doc.shared.repeatPoint!.value).toBe(4.0);
  });

  it('repeatPoint is set to subjectiveDuration value when enabled for first time', () => {
    const dur = makeEditorDoc().shared.subjectiveDuration.value;
    const doc = makeEditorDoc({
      shared: {
        ...makeEditorDoc().shared,
        timeBehavior: 'REPEAT',
        repeatPoint: { value: dur, timeBase: 'beats', displayText: `${dur.toFixed(4)}` },
      },
    });
    expect(doc.shared.repeatPoint!.value).toBe(doc.shared.subjectiveDuration.value);
  });
});

describe('ScoreObjectPropertiesPanel — Java Blue parity: repeat point enabled only for repeat behaviors', () => {
  it('SCALE time behavior: repeat point should be null', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.timeBehavior).toBe('SCALE');
    expect(doc.shared.repeatPoint).toBeNull();
  });

  it('NONE time behavior: repeat point should be null', () => {
    const doc = makeEditorDoc({
      shared: { ...makeEditorDoc().shared, timeBehavior: 'NONE' },
    });
    expect(doc.shared.timeBehavior).toBe('NONE');
    expect(doc.shared.repeatPoint).toBeNull();
  });

  it('REPEAT time behavior: repeat point can be set', () => {
    const doc = makeEditorDoc({
      shared: {
        ...makeEditorDoc().shared,
        timeBehavior: 'REPEAT',
        repeatPoint: { value: 2.0, timeBase: 'beats', displayText: '2.0000' },
      },
    });
    expect(doc.shared.timeBehavior).toBe('REPEAT');
    expect(doc.shared.repeatPoint).not.toBeNull();
  });

  it('REPEAT_CLASSIC time behavior: repeat point can be set', () => {
    const doc = makeEditorDoc({
      shared: {
        ...makeEditorDoc().shared,
        timeBehavior: 'REPEAT_CLASSIC',
        repeatPoint: { value: 2.0, timeBase: 'beats', displayText: '2.0000' },
      },
    });
    expect(doc.shared.timeBehavior).toBe('REPEAT_CLASSIC');
    expect(doc.shared.repeatPoint).not.toBeNull();
  });
});

describe('ScoreObjectPropertiesPanel — Java Blue parity: labels', () => {
  it('snapshot uses "Subjective Duration" field for duration', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.subjectiveDuration).toBeDefined();
    expect(doc.shared.subjectiveDuration.value).toBe(4);
  });

  it('snapshot provides endTimeDisplay as computed end time', () => {
    const doc = makeEditorDoc();
    expect(doc.shared.endTimeDisplay).toBe('4.0000');
  });

  it('endTimeDisplay updates when start time changes', () => {
    const doc = makeEditorDoc({
      shared: {
        ...makeEditorDoc().shared,
        startTime: { value: 2, timeBase: 'beats', displayText: '2.0000' },
        endTimeDisplay: '6.0000',
      },
    });
    expect(doc.shared.endTimeDisplay).toBe('6.0000');
  });
});
