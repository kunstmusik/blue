import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ClojureProjectSnapshot,
  ProjectPropertiesSnapshot,
} from '../../shared/project-editor';
import GlobalOrchestraPanel from '../components/workbench/panels/GlobalOrchestraPanel';
import GlobalScorePanel from '../components/workbench/panels/GlobalScorePanel';
import ProjectPropertiesPanel from '../components/workbench/panels/ProjectPropertiesPanel';
import ClojureProjectTab from '../components/workbench/panels/project-properties/ClojureProjectTab';
import { createDynamicCsoundCompletionSource } from '../components/workbench/panels/editors/csound-completions';
import { createJavaBlueCsoundCompletionSource } from '../components/workbench/panels/editors/csound-java-blue-completions';

interface MockProjectState {
  loaded: boolean;
  title: string;
  globalOrc: string;
  globalSco: string;
  projectProperties: ProjectPropertiesSnapshot;
  clojureProject: ClojureProjectSnapshot;
  updateGlobalOrc: (value: string) => void | Promise<void>;
  updateGlobalSco: (value: string) => void | Promise<void>;
  updateProjectProperties: (
    patch: Partial<ProjectPropertiesSnapshot>,
  ) => void | Promise<void>;
  updateClojureProject: (
    clojureProject: ClojureProjectSnapshot,
  ) => void | Promise<void>;
}

const { BASE_PROJECT_PROPERTIES, BASE_CLOJURE_PROJECT, mockProjectState } = vi.hoisted(() => {
  const BASE_PROJECT_PROPERTIES: ProjectPropertiesSnapshot = {
    title: '',
    author: '',
    notes: '',
    sampleRate: '44100',
    ksmps: '64',
    nchnls: '2',
    useZeroDbFS: false,
    zeroDbFS: '32768',
    diskSampleRate: '44100',
    diskKsmps: '64',
    diskChannels: '2',
    diskUseZeroDbFS: false,
    diskZeroDbFS: '32768',
    useAudioOut: true,
    useAudioIn: false,
    useMidiIn: false,
    useMidiOut: false,
    noteAmpsEnabled: true,
    outOfRangeEnabled: true,
    warningsEnabled: true,
    benchmarkEnabled: true,
    advancedSettings: '',
    completeOverride: false,
    fileName: '',
    askOnRender: false,
    diskNoteAmpsEnabled: true,
    diskOutOfRangeEnabled: true,
    diskWarningsEnabled: true,
    diskBenchmarkEnabled: true,
    diskAdvancedSettings: '',
    diskCompleteOverride: false,
    diskAlwaysRenderEntireProject: false,
    mediaFolder: '',
    copyToMediaFileOnImport: true,
  };

  const BASE_CLOJURE_PROJECT: ClojureProjectSnapshot = {
    libraryEntries: [],
  };

  return {
    BASE_PROJECT_PROPERTIES,
    BASE_CLOJURE_PROJECT,
    mockProjectState: {
      loaded: false,
      title: '',
      globalOrc: '',
      globalSco: '',
      projectProperties: { ...BASE_PROJECT_PROPERTIES },
      clojureProject: { ...BASE_CLOJURE_PROJECT },
      updateGlobalOrc: vi.fn(),
      updateGlobalSco: vi.fn(),
      updateProjectProperties: vi.fn(),
      updateClojureProject: vi.fn(),
    } satisfies MockProjectState,
  };
});

interface ProjectEditorPanelFixture {
  loaded?: boolean;
  title?: string;
  globalOrc?: string;
  globalSco?: string;
  projectProperties?: Partial<ProjectPropertiesSnapshot>;
  clojureProject?: ClojureProjectSnapshot;
}

function applyProjectFixture(fixture: ProjectEditorPanelFixture = {}): void {
  const projectProperties = {
    ...BASE_PROJECT_PROPERTIES,
    ...fixture.projectProperties,
  };
  const clojureProject = fixture.clojureProject ?? BASE_CLOJURE_PROJECT;

  if (fixture.title !== undefined) {
    projectProperties.title = fixture.title;
  }

  mockProjectState.loaded = fixture.loaded ?? true;
  mockProjectState.title = fixture.title ?? '';
  mockProjectState.globalOrc = fixture.globalOrc ?? '';
  mockProjectState.globalSco = fixture.globalSco ?? '';
  mockProjectState.projectProperties = projectProperties;
  mockProjectState.clojureProject = {
    libraryEntries: clojureProject.libraryEntries.map((entry) => ({ ...entry })),
  };
}

function renderProjectPanelMarkup(
  Component: () => React.ReactElement,
  fixture: ProjectEditorPanelFixture = {},
): string {
  applyProjectFixture(fixture);
  return renderToStaticMarkup(createElement(Component));
}

function createPanelCompletionResult(doc: string) {
  const source = createJavaBlueCsoundCompletionSource();
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, state.doc.length, true);
  const result = source(context);

  if (result instanceof Promise) {
    throw new Error('Expected synchronous Java Blue completion results');
  }

  return result;
}

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: MockProjectState) => unknown) =>
    selector(mockProjectState),
}));

beforeEach(() => {
  applyProjectFixture({
    loaded: false,
    title: '',
    globalOrc: '',
    globalSco: '',
    projectProperties: {
      title: '',
      author: '',
      notes: '',
      sampleRate: '44100',
      ksmps: '64',
      nchnls: '2',
    },
  });
  vi.clearAllMocks();
});

describe('Project editor panels', () => {
  it('shows the global orchestra empty state when unloaded', () => {
    const html = renderToStaticMarkup(createElement(GlobalOrchestraPanel));

    expect(html).toContain('No project loaded');
  });

  it('renders the global orchestra editor when loaded', () => {
    const html = renderProjectPanelMarkup(GlobalOrchestraPanel, {
      title: 'Loaded Project',
      globalOrc: 'instr 1\n  out 0\nendin',
    });

    expect(html).toContain('data-editor-kind="codemirror"');
    expect(html).toContain('data-editor-language="csound-orc"');
    expect(html).toContain('aria-label="Global Orchestra Csound editor"');
    expect(html).toContain('instr 1');
    expect(html).not.toContain('textarea');
  });

  it('keeps the loaded Global Orchestra text visible across save/reopen-style rerenders', () => {
    const initialHtml = renderProjectPanelMarkup(GlobalOrchestraPanel, {
      title: 'Loaded Project',
      globalOrc: 'instr 1\n  out 0\nendin',
    });

    const reopenedHtml = renderProjectPanelMarkup(GlobalOrchestraPanel, {
      title: 'Loaded Project',
      globalOrc: 'instr 1\n  out 0.5\nendin',
    });

    expect(initialHtml).toContain('out 0');
    expect(reopenedHtml).toContain('out 0.5');
    expect(reopenedHtml).toContain('data-editor-kind="codemirror"');
  });

  it('adapts dynamic Csound completions for the selected editor', async () => {
    const source = createDynamicCsoundCompletionSource([
      (context) => [
        {
          label: `project_${context.text.length}_${context.position}`,
          type: 'function',
          detail: context.explicit ? 'explicit' : 'implicit',
        },
      ],
    ]);
    const result = source({
      explicit: true,
      pos: 4,
      state: {
        doc: {
          toString: () => 'instr 1\nendin',
        },
      },
      matchBefore: () => ({ from: 0, to: 4, text: 'proj' }),
    } as never);

    const resolved = result instanceof Promise ? await result : result;

    expect(resolved?.from).toBe(0);
    expect(resolved?.options).toEqual([
      {
        label: 'project_13_4',
        type: 'function',
        detail: 'explicit',
      },
    ]);
  });

  it('shows the project properties empty state when unloaded', () => {
    const html = renderToStaticMarkup(createElement(ProjectPropertiesPanel));

    expect(html).toContain('No project loaded');
    expect(html).toContain('Open a project to edit project information, render settings, and media paths.');
  });

  it('renders the built-in project properties tabs when loaded', () => {
    const html = renderProjectPanelMarkup(ProjectPropertiesPanel, {
      title: 'Loaded Project',
      projectProperties: {
        title: 'Loaded Project',
        author: 'Composer',
        sampleRate: '48000',
        ksmps: '32',
      },
    });

    expect(html).toContain('Information');
    expect(html).toContain('Realtime');
    expect(html).toContain('Disk Render');
    expect(html).toContain('Media');
    expect(html).toContain('Clojure');
    expect(html).toContain('Project Information');
    expect(html).toContain('Loaded Project');
  });

  it('renders project property fields with the compact inspector-sized input primitive', () => {
    const html = renderProjectPanelMarkup(ProjectPropertiesPanel, {
      title: 'Loaded Project',
      projectProperties: {
        title: 'Loaded Project',
        author: 'Composer',
        notes: 'Project notes',
      },
    });

    expect(html).toContain('bg-app-input px-2 py-1 text-body text-app-text shadow-inner');
    expect(html).not.toContain('bg-app-input px-3 py-2 text-sm text-app-text shadow-inner');
    expect(html).toContain('text-body text-app-text-muted');
    expect(html).not.toContain('text-body font-medium uppercase tracking-[0.18em] text-app-text-muted');
  });

  it('renders the clojure project dependency editor with library rows', () => {
    const html = renderToStaticMarkup(
      createElement(ClojureProjectTab, {
        disabled: false,
        clojureProject: {
          libraryEntries: [
            {
              entryId: 'clj-lib-1',
              dependencyCoordinates: 'org.clojure/data.json',
              version: '2.5.1',
            },
          ],
        },
        updateClojureProject: vi.fn(),
      }),
    );

    expect(html).toContain('Project Libraries');
    expect(html).toContain('Library Coordinates');
    expect(html).toContain('org.clojure/data.json');
    expect(html).toContain('2.5.1');
    expect(html).toContain('Move Up');
    expect(html).toContain('text-body text-app-text-muted');
    expect(html).not.toContain('text-ui font-medium uppercase tracking-[0.18em] text-app-text-muted');
  });

  it('renders the global score editor when loaded', () => {
    const html = renderProjectPanelMarkup(GlobalScorePanel, {
      title: 'Loaded Project',
      globalSco: 'e',
    });

    expect(html).toContain('data-editor-kind="codemirror"');
    expect(html).toContain('aria-label="Global Score Csound editor"');
    expect(html).not.toContain('textarea');
  });

  it('exposes Blue opcode completions from the panel-level Java Blue completion source', () => {
    const result = createPanelCompletionResult('blueMixer');

    expect(result?.options).toContainEqual({
      label: 'blueMixerOut',
      type: 'function',
      detail: 'Blue opcode',
      apply: 'blueMixerOut asig1 [, asig2...]',
      info: 'blueMixerOut\n\nRoutes audio-rate signals to the Blue mixer.',
      boost: 25,
    });
  });
});
