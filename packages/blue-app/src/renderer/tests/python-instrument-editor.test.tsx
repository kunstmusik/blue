// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PythonInstrumentSnapshot,
  UdoDefinitionSnapshot,
} from '../../shared/project-editor';
import PythonInstrumentEditor from '../components/workbench/panels/orchestra/PythonInstrumentEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function udoSnapshot(name: string): UdoDefinitionSnapshot {
  return {
    name,
    style: 'CLASSIC',
    outTypes: 'a',
    inTypes: 'a',
    inputArguments: '',
    code: '',
    comments: '',
  };
}

describe('PythonInstrumentEditor', () => {
  const defaultInstrument: PythonInstrumentSnapshot = {
    assignmentId: 'py-1',
    type: 'python',
    name: 'Python Lead',
    enabled: true,
    comment: '',
    text: 'instrument = "aout oscili 32000, 440, 1"',
    globalOrc: 'gi1 ftgen 0, 0, 1024, 10, 1',
    globalSco: 'f1 0 8192 10 1',
    udolist: [udoSnapshot('MyPythonUdo')],
  };

  let container: HTMLDivElement;
  let root: Root;
  let rangeRectsDescriptor: PropertyDescriptor | undefined;
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    rangeRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 0, item: () => null }),
    });
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      toJSON: () => ({}),
    } as DOMRect);
    (window as any).blueAPI = {
      testPythonInstrument: vi.fn(async () => ({
        ok: true,
        output: 'aout oscili 32000, 440, 1',
      })),
      reinitializeJythonRuntime: vi.fn(async () => ({
        ok: true,
      })),
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    rectSpy.mockRestore();
    if (rangeRectsDescriptor) {
      Object.defineProperty(Range.prototype, 'getClientRects', rangeRectsDescriptor);
    } else {
      delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    }
    vi.unstubAllGlobals();
  });

  it('renders all four tabs, header controls, and Python code mode', () => {
    const html = renderToStaticMarkup(
      <PythonInstrumentEditor
        instrument={defaultInstrument}
        onInstrumentPatch={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />,
    );

    expect(html).toContain('Python Lead');
    expect(html).toContain('Instrument');
    expect(html).toContain('UDO');
    expect(html).toContain('Global Orc');
    expect(html).toContain('Global Sco');
    expect(html).toContain('Test');
    expect(html).toContain('Reinitialize Jython');
    expect(html).toContain('data-editor-language="python"');
    expect(html).toContain('data-editor-language="csound-orc"');
    expect(html).toContain('data-editor-language="csound-sco"');
  });

  it('switches tabs between Instrument, UDO, Global Orc, and Global Sco', async () => {
    await act(async () => {
      root.render(
        <PythonInstrumentEditor
          instrument={defaultInstrument}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const tabButtons = buttons.filter((b) =>
      ['Instrument', 'UDO', 'Global Orc', 'Global Sco'].includes(b.textContent || ''),
    );
    expect(tabButtons).toHaveLength(4);

    // Switch to UDO tab
    const udoTab = tabButtons.find((b) => b.textContent === 'UDO')!;
    await act(async () => {
      udoTab.click();
    });
    expect(container.textContent).toContain('MyPythonUdo');

    // Switch to Global Orc tab
    const orcTab = tabButtons.find((b) => b.textContent === 'Global Orc')!;
    await act(async () => {
      orcTab.click();
    });
    expect(orcTab.className).toContain('border-blue-accent');

    // Switch to Global Sco tab
    const scoTab = tabButtons.find((b) => b.textContent === 'Global Sco')!;
    await act(async () => {
      scoTab.click();
    });
    expect(scoTab.className).toContain('border-blue-accent');
  });

  it('executes Test action and displays generated Csound instrument in modal', async () => {
    await act(async () => {
      root.render(
        <PythonInstrumentEditor
          instrument={defaultInstrument}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );
    });

    const testButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Test',
    )!;

    await act(async () => {
      testButton.click();
    });

    expect(window.blueAPI.testPythonInstrument).toHaveBeenCalledWith({
      code: defaultInstrument.text,
      assignmentId: 'py-1',
    });

    expect(container.textContent).toContain('Generated Instrument');
    expect(container.textContent).toContain('aout oscili 32000, 440, 1');

    // Close the modal
    const closeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Close',
    )!;
    await act(async () => {
      closeBtn.click();
    });

    expect(container.textContent).not.toContain('Generated Instrument');
  });

  it('displays error alert when test evaluation fails and allows dismissal', async () => {
    (window as any).blueAPI.testPythonInstrument = vi.fn(async () => ({
      ok: false,
      error: 'NameError: name "undefined_var" is not defined',
    }));

    await act(async () => {
      root.render(
        <PythonInstrumentEditor
          instrument={defaultInstrument}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );
    });

    const testButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Test',
    )!;

    await act(async () => {
      testButton.click();
    });

    expect(container.textContent).toContain('NameError: name "undefined_var" is not defined');

    // Dismiss error
    const dismissBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'dismiss',
    )!;

    await act(async () => {
      dismissBtn.click();
    });

    expect(container.textContent).not.toContain('NameError:');
  });

  it('handles Jython runtime reinitialize action', async () => {
    await act(async () => {
      root.render(
        <PythonInstrumentEditor
          instrument={defaultInstrument}
          onInstrumentPatch={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />,
      );
    });

    const reinitButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Reinitialize Jython',
    )!;

    await act(async () => {
      reinitButton.click();
    });

    expect(window.blueAPI.reinitializeJythonRuntime).toHaveBeenCalled();
  });

  it('successfully creates a PythonInstrument in the orchestra arrangement', async () => {
    const { useProjectStore } = await import('../stores/project-store');
    const { createEmptyProjectEditorSnapshot } = await import('../../shared/project-editor');
    (window as any).blueAPI.updateProjectDocument = vi.fn().mockResolvedValue(null);

    const baseSnapshot = createEmptyProjectEditorSnapshot();
    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      author: 'Test',
      sampleRate: '44100',
      version: '2.10.0',
      filePath: '/path/to/test.blue',
      loaded: true,
      globalOrc: baseSnapshot.globalOrc,
      globalSco: baseSnapshot.globalSco,
      orchestra: {
        ...baseSnapshot.orchestra,
        loaded: true,
      },
      projectProperties: {
        ...baseSnapshot.projectProperties,
        title: 'Test',
        author: 'Test',
      },
      transport: baseSnapshot.transport,
    });

    await useProjectStore.getState().updateOrchestra({
      type: 'addInstrument',
      instrumentType: 'python',
    });

    const orchestra = useProjectStore.getState().orchestra;
    expect(orchestra.arrangement.rows).toHaveLength(1);
    expect(orchestra.arrangement.rows[0]?.instrumentType).toBe('python');
    expect(orchestra.instruments).toHaveLength(1);
    expect(orchestra.instruments[0]?.type).toBe('python');
    expect(orchestra.instruments[0]?.name).toBe('PythonInstrument');
  });
});
