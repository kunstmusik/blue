// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, JMask, PolyObject, SoundLayer, TimeDuration } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createScoreObjectEditorDocument,
  type JMaskEditorPayload,
  type ScoreObjectEditorDocumentSnapshot,
  type ScoreObjectEditorTargetSnapshot,
} from '../../shared/project-editor';
import { applyPatchToDocument } from '../components/workbench/panels/score-object/score-object-document-reducer';
import { useProjectStore } from '../stores/project-store';
import JMaskEditor from '../components/workbench/panels/score-object/editors/JMaskEditor';
import TableEditor from '../components/workbench/panels/score-object/editors/jmask/TableEditor';
import {
  createDefaultGeneratorSnapshot,
  createDefaultParameterSnapshot,
  type FieldSnapshot,
  type ParameterSnapshot,
  type TableSnapshot,
} from '../components/workbench/panels/score-object/editors/jmask/jmask-utils';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe() {
    this.callback([] as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
  disconnect() {}
  unobserve() {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    save() {},
    restore() {},
    scale() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    stroke() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    fillText() {},
  });
}

function makeTimelineTarget(): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'JMask',
    editorObjectType: 'JMask',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function makeJMaskDocument(): {
  data: BlueData;
  jmask: JMask;
  target: ScoreObjectEditorTargetSnapshot;
  doc: ScoreObjectEditorDocumentSnapshot;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const jmask = new JMask();
  jmask.setName('JMask');
  jmask.setSubjectiveDuration(TimeDuration.beats(6));
  layer.push(jmask);
  poly.push(layer);
  data.getScore().push(poly);

  const target = makeTimelineTarget();
  const doc = createScoreObjectEditorDocument(data, { target });
  if (!doc || doc.editor.kind !== 'structured' || doc.editor.editorFamily !== 'JMask') {
    throw new Error('Expected JMask structured editor document');
  }

  return { data, jmask, target, doc };
}

function makeFieldSnapshot(parameters: ParameterSnapshot[]): FieldSnapshot {
  return {
    kind: 'Field',
    parameters,
  };
}

describe('JMask editor contract and renderer helpers', () => {
  it('creates Item List defaults from both Java registry label and snapshot kind', () => {
    expect(createDefaultGeneratorSnapshot('Item List')).toMatchObject({ kind: 'ItemList' });
    expect(createDefaultGeneratorSnapshot('ItemList')).toMatchObject({ kind: 'ItemList' });

    const randomParameter = createDefaultParameterSnapshot('Random');
    expect(randomParameter.generator).toMatchObject({ kind: 'Random' });
    expect(randomParameter.mask).toBeNull();
    expect(randomParameter.quantizer).toMatchObject({ kind: 'Quantizer', enabled: false });
    expect(randomParameter.accumulator).toMatchObject({ kind: 'Accumulator', enabled: false });

    const probabilityParameter = createDefaultParameterSnapshot('Probability');
    expect(probabilityParameter.mask).toMatchObject({ kind: 'Mask', enabled: false });
    expect(probabilityParameter.quantizer).toMatchObject({ kind: 'Quantizer', enabled: false });
    expect(probabilityParameter.accumulator).toMatchObject({ kind: 'Accumulator', enabled: false });
  });

  it('creates a Java-style JMask editor payload and renders the top bar plus parameter rows', () => {
    const { doc } = makeJMaskDocument();
    const payload = doc.editor.payload as JMaskEditorPayload;

    expect(payload.seedUsed).toBe(false);
    expect(payload.seed).toBe('0');
    expect(payload.field.kind).toBe('Field');
    expect((payload.field.parameters as ParameterSnapshot[]).map((p) => p.name)).toEqual([
      'Instrument ID',
      'Start',
      'Duration',
    ]);
    expect(doc.editor.payloadSummary).toBe('random; 3 params');

    const html = renderToStaticMarkup(<JMaskEditor document={doc} onPatch={vi.fn()} />);
    expect(html).toContain('JMask');
    expect(html).toContain('Seed');
    expect(html).toContain('Test');
    expect(html).toContain('p1 - Instrument ID');
    expect(html).toContain('p2 - Start');
    expect(html).toContain('p3 - Duration');
    expect(html).toContain('Constant');
  });

  it('applies JMask optimistic field patches without dropping nested modifier defaults', () => {
    const { doc, target } = makeJMaskDocument();
    const p1 = createDefaultParameterSnapshot('Constant');
    p1.name = 'Instrument ID';
    const p2 = createDefaultParameterSnapshot('Constant');
    p2.name = 'Start';
    const p3 = createDefaultParameterSnapshot('Item List');
    p3.name = 'Duration';

    const next = applyPatchToDocument(doc, {
      type: 'updateTypeSpecificEditor',
      target,
      patch: {
        seedUsed: true,
        seed: '77',
        field: makeFieldSnapshot([p1, p2, p3]),
      },
    });

    expect(next.editor.kind).toBe('structured');
    if (next.editor.kind !== 'structured') return;
    const payload = next.editor.payload as JMaskEditorPayload;
    const parameters = payload.field.parameters as ParameterSnapshot[];
    expect(next.editor.payloadSummary).toBe('seed: 77; 3 params');
    expect(parameters[2]!.generator).toMatchObject({ kind: 'ItemList' });
    expect(parameters[2]!.accumulator).toMatchObject({ kind: 'Accumulator', enabled: false });
  });

  it('applies JMask field patches canonically through the project document patch bridge', () => {
    const { data, jmask, target } = makeJMaskDocument();
    const p1 = createDefaultParameterSnapshot('Constant');
    p1.name = 'Instrument ID';
    const p2 = createDefaultParameterSnapshot('Constant');
    p2.name = 'Start';
    const p3 = createDefaultParameterSnapshot('Item List');
    p3.name = 'Duration';

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updateTypeSpecificEditor',
        target,
        patch: {
          seedUsed: true,
          seed: '99',
          field: makeFieldSnapshot([p1, p2, p3]),
        },
      },
    });

    expect(jmask.isSeedUsed()).toBe(true);
    expect(jmask.getSeed()).toBe('99');
    const xml = jmask.saveAsXML().toXml();
    expect(xml).toContain('<generator type="blue.soundObject.jmask.ItemList">');
    expect(xml).toContain('<accumulator>');
  });

  it('renders and patches exact signed-64 seed digits', () => {
    const { data, jmask, target } = makeJMaskDocument();
    const seed = '9223372036854775807';
    jmask.setSeedUsed(true);
    jmask.setSeed(seed);
    const doc = createScoreObjectEditorDocument(data, { target })!;
    const html = renderToStaticMarkup(<JMaskEditor document={doc} onPatch={vi.fn()} />);
    expect(html).toContain(`value="${seed}"`);
    applyProjectDocumentPatch(data, {
      score: { type: 'updateTypeSpecificEditor', target, patch: { seed: '-9223372036854775808' } },
    });
    expect(jmask.getSeed()).toBe('-9223372036854775808');
    expect(jmask.saveAsXML().getTextString('seed')).toBe('-9223372036854775808');
  });
});

describe('TableEditor draft and terminal gesture lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let rectSpy: ReturnType<typeof vi.spyOn>;

  const baseTable: TableSnapshot = {
    kind: 'Table',
    min: 0,
    max: 1,
    interpolationType: 1,
    interpolation: 0,
    points: [
      { kind: 'TablePoint', time: 0, value: 0 },
      { kind: 'TablePoint', time: 1, value: 1 },
    ],
  };

  beforeEach(() => {
    document.documentElement.style.setProperty('--text-role-subheadline', '11px');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    rectSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 100,
      width: 400,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--text-role-subheadline');
    rectSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it.each([false, true])('handles table replacement during a draft (changed: %s)', (changed) => {
    const oldChange = vi.fn();
    const newChange = vi.fn();
    act(() => root.render(<TableEditor table={baseTable} duration={4} onChange={oldChange} />));
    const canvas = container.querySelector('canvas')!;
    act(() =>
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 200, clientY: 50 }),
      ),
    );
    const nextTable = structuredClone(baseTable);
    if (changed) nextTable.points[1]!.value = 0.25;
    act(() => root.render(<TableEditor table={nextTable} duration={4} onChange={newChange} />));
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 30 }),
      );
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 200, clientY: 30 }));
    });
    expect(oldChange).not.toHaveBeenCalled();
    expect(newChange).toHaveBeenCalledTimes(changed ? 0 : 1);
  });

  it('keeps local draft during point drag and commits once on release', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;
    expect(canvas).not.toBeNull();

    // Hit point 0 at (5, 95)
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 5,
          clientY: 95,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 20,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 20,
        }),
      );
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedPoints = onChange.mock.calls[0]![0].points;
    expect(updatedPoints[0].value).toBeGreaterThan(0.5);
  });

  it('discards drag draft on Escape without calling onChange', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 5,
          clientY: 95,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 20,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 20,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('discards drag draft on blur without calling onChange', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 5,
          clientY: 95,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 20,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 20,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when dragged back to original position (net zero)', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 5,
          clientY: 95,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 20,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 95,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 5,
          clientY: 95,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps local draft during point insertion and commits on release', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;

    // Click at middle (200, 50) to insert a point
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 200,
          clientY: 50,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 30,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 30,
        }),
      );
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].points).toHaveLength(3);
  });

  it('discards point insertion draft on Escape', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 200,
          clientY: 50,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 30,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('discards local draft on unmount without calling onChange (T039)', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 200,
          clientY: 50,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 30,
        }),
      );
    });

    expect(onChange).not.toHaveBeenCalled();

    // Closure / unmount
    act(() => {
      root.unmount();
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('fences drag move and release on session mismatch without calling onChange (T035)', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<TableEditor table={baseTable} duration={4} onChange={onChange} />);
    });

    const canvas = container.querySelector('canvas')!;

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 200,
          clientY: 50,
        }),
      );
    });

    const origSessionId = useProjectStore.getState().sessionId;
    useProjectStore.setState({ sessionId: origSessionId + 10 });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 30,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 30,
        }),
      );
    });

    expect(onChange).not.toHaveBeenCalled();
    useProjectStore.setState({ sessionId: origSessionId });
  });
});
