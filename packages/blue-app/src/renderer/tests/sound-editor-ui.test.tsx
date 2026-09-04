import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SoundEditor from '../components/workbench/panels/score-object/editors/SoundEditor';
import type { ScoreObjectEditorDocumentSnapshot } from '../../shared/project-editor';

function createSoundEditorDocument(): ScoreObjectEditorDocumentSnapshot {
  return {
    target: {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'Sound',
      editorObjectType: 'Sound',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: true,
    },
    object: {
      id: 'sobj-0-0',
      name: 'Sound',
      objectType: 'Sound',
      startTime: { unit: 'csoundBeats', value: 2 },
      subjectiveDuration: { unit: 'csoundBeats', value: 8 },
      endTime: { unit: 'csoundBeats', value: 10 },
      color: '#000000',
      timeBehavior: 'notSupported',
      repeatPointEnabled: false,
      repeatPoint: null,
      noteProcessorChainEnabled: false,
      librarySource: null,
    },
    owner: {
      kind: 'timeline',
      groupPath: [],
      layerId: 'layer-0',
      laneLabel: 'Sound',
      startLabel: '2.00',
      durationLabel: '8.00',
    },
    shared: {
      name: 'Sound',
      startTime: { unit: 'csoundBeats', value: 2, availableUnits: ['csoundBeats'] },
      subjectiveDuration: { unit: 'csoundBeats', value: 8, availableUnits: ['csoundBeats'] },
      endTimeLabel: '10.00',
      color: '#000000',
      timeBehavior: {
        value: 'notSupported',
        editable: false,
        options: [],
      },
      repeatPoint: {
        enabled: false,
        value: { unit: 'csoundBeats', value: 0, availableUnits: ['csoundBeats'] },
      },
      noteProcessorChain: {
        enabled: false,
        summary: 'None',
      },
    },
    editor: {
      kind: 'structured',
      editorFamily: 'Sound',
      payload: {
        comment: 'test',
        bsbInstrument: null,
        availableTabs: ['automation', 'comments'],
        testAvailable: false,
        automationParameters: [
          {
            parameterId: 'grainrate',
            name: 'grainrate',
            label: 'grainrate',
            automationEnabled: true,
            value: 0.5,
            minimum: 0,
            maximum: 1,
            curve: 'LINEAR',
            points: [
              { x: 0, y: 0.25 },
              { x: 0.5, y: 0.75 },
              { x: 1, y: 0.4 },
            ],
          },
        ],
      },
    },
  };
}

describe('SoundEditor automation UI parity', () => {
  it('renders Java-style automation selector footer with Edit button', () => {
    const document = createSoundEditorDocument();
    const html = renderToStaticMarkup(<SoundEditor document={document} onPatch={vi.fn()} />);

    expect(html).toContain('Automations');
    expect(html).toContain('Edit');
    expect(html).not.toContain('Automated');
    expect(html).not.toContain('data-sound-test-button');
  });

  it('renders all enabled automation lines with hollow control points', () => {
    const document = createSoundEditorDocument();
    const payload = (
      document.editor as {
        payload: {
          automationParameters: Array<{
            parameterId: string;
            name: string;
            label: string;
            automationEnabled: boolean;
            value: number;
            minimum: number;
            maximum: number;
            curve: string;
            points: Array<{ x: number; y: number }>;
          }>;
        };
      }
    ).payload;
    payload.automationParameters.push({
      parameterId: 'grainsize',
      name: 'grainsize',
      label: 'grainsize',
      automationEnabled: true,
      value: 0.35,
      minimum: 0,
      maximum: 1,
      curve: 'LINEAR',
      points: [
        { x: 0, y: 0.6 },
        { x: 0.75, y: 0.2 },
        { x: 1, y: 0.5 },
      ],
    });

    const html = renderToStaticMarkup(<SoundEditor document={document} onPatch={vi.fn()} />);
    const polylineCount = (html.match(/<polyline/g) || []).length;

    expect(polylineCount).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/<circle[^>]*fill="#000000"/);
  });
});
