// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useProjectStore } from '../stores/project-store';
import type { NoteSnapshot } from '../components/workbench/panels/score-object/editors/pianoroll/types';
import PianoRollCanvas from '../components/workbench/panels/score-object/editors/pianoroll/PianoRollCanvas';
import FieldEditor from '../components/workbench/panels/score-object/editors/pianoroll/FieldEditor';
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
it.each(
  ['target', 'project', 'source'].flatMap((change) =>
    ['local', 'outside'].map((release) => ({ change, release })),
  ),
)(
  'discards a field draft after $change replacement on $release release (T048)',
  ({ change, release }) => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const commit = vi.fn();
    let notes: NoteSnapshot[] = [
      { start: 1, duration: 1, octave: 8, scaleDegree: 0, fieldValues: [0.5], noteTemplate: null },
    ];
    const render = (targetKey: string) =>
      act(() =>
        root.render(
          <FieldEditor
            notes={notes}
            selectedIndices={new Set([0])}
            scale={{} as any}
            fieldDef={{
              fieldName: 'AMP',
              fieldType: 'CONTINUOUS',
              minValue: 0,
              maxValue: 1,
              defaultValue: 0.5,
            }}
            fieldIndex={0}
            pixelSecond={40}
            noteHeight={10}
            width={400}
            snapEnabled={false}
            snapBeats={0}
            onSelectionChange={() => {}}
            onCommitFieldEdit={commit}
            targetKey={targetKey}
          />,
        ),
      );
    try {
      render('A');
      const lane = container.firstElementChild!;
      lane.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 100 }) as DOMRect;
      act(() =>
        lane.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 43, clientY: 50 }),
        ),
      );
      act(() =>
        window.dispatchEvent(
          new MouseEvent('mousemove', { bubbles: true, clientX: 43, clientY: 20 }),
        ),
      );
      if (change === 'source') notes = [];
      if (change === 'project')
        act(() =>
          useProjectStore.setState({ sessionId: useProjectStore.getState().sessionId + 1 }),
        );
      render(change === 'target' ? 'B' : 'A');
      act(() =>
        (release === 'local' ? lane : window).dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, clientX: 43, clientY: 20 }),
        ),
      );
      expect(commit).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  },
);

it.each(
  ['target', 'project', 'source'].flatMap((change) =>
    ['local', 'outside'].map((release) => ({ change, release })),
  ),
)(
  'cancels note-canvas input after $change replacement on $release release (T048)',
  ({ change, release }) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const canvasRef = React.createRef<HTMLDivElement>();
    let active = false;
    const listener = {
      mousePressed: vi.fn(() => {
        active = true;
      }),
      getDragMode: () => (active ? 'MOVE' : 'NONE'),
      mouseReleased: vi.fn(() => {
        active = false;
      }),
      mouseDragged: vi.fn(),
      cancel: vi.fn(() => {
        active = false;
      }),
      dispose: vi.fn(),
      getMarquee: () => null,
      getCursor: () => 'default',
    };
    let notes: NoteSnapshot[] = [
      { start: 1, duration: 1, octave: 8, scaleDegree: 0, fieldValues: [], noteTemplate: null },
    ];
    const render = (targetKey: string) =>
      act(() =>
        root.render(
          <PianoRollCanvas
            notes={notes}
            previewNotes={null}
            scale={{ ratios: [] } as any}
            fieldDefinitions={[]}
            selectedIndices={new Set()}
            pixelSecond={40}
            noteHeight={10}
            snapEnabled={false}
            snapBeats={1}
            durationBeats={16}
            pchGenerationMethod={1}
            listener={listener as any}
            canvasRef={canvasRef}
            targetKey={targetKey}
          />,
        ),
      );
    try {
      render('A');
      const canvas = canvasRef.current!;
      act(() => canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
      if (change === 'source') notes = [];
      if (change === 'project')
        act(() =>
          useProjectStore.setState({ sessionId: useProjectStore.getState().sessionId + 1 }),
        );
      render(change === 'target' ? 'B' : 'A');
      act(() =>
        (release === 'local' ? canvas : window).dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true }),
        ),
      );
      expect(listener.mouseReleased).not.toHaveBeenCalled();
      expect(listener.cancel).toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  },
);
