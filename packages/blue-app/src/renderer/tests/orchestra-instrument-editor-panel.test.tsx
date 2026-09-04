// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GenericInstrumentSnapshot } from '../../shared/project-editor';
import InstrumentEditorPanel from '../components/workbench/panels/orchestra/InstrumentEditorPanel';
import InstrumentCommentsPanel from '../components/workbench/panels/orchestra/InstrumentCommentsPanel';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const GENERIC_INSTRUMENT: GenericInstrumentSnapshot = {
  assignmentId: '1',
  type: 'generic',
  name: 'Lead',
  enabled: true,
  comment: 'lead comment',
  text: 'aout oscili p4, p5',
  globalOrc: '',
  globalSco: '',
};

describe('Orchestra instrument editor panel', () => {
  beforeAll(async () => {
    await import('../components/workbench/panels/orchestra/GenericInstrumentEditor');
  });

  it('renders the editor/comments tab shell for a selected instrument', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <InstrumentEditorPanel
          instrument={GENERIC_INSTRUMENT}
          projectUdos={[]}
          onOrchestraPatch={vi.fn()}
        />,
      );
      for (
        let attempt = 0;
        attempt < 50 && container.querySelector('[data-instrument-editor-loading]');
        attempt += 1
      ) {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      }
    });
    const html = container.innerHTML;

    expect(html).toContain('Instrument Editor');
    expect(html).toContain('Comments');
    expect(html).toContain('Lead');
    expect(html).toContain('aout oscili');

    root.unmount();
    container.remove();
  });

  it('renders a no-selection state', () => {
    const html = renderToStaticMarkup(
      <InstrumentEditorPanel instrument={undefined} projectUdos={[]} onOrchestraPatch={vi.fn()} />,
    );

    expect(html).toContain('Select an arrangement instrument to edit.');
  });

  it('renders instrument comments for editing', () => {
    const html = renderToStaticMarkup(
      <InstrumentCommentsPanel comment="lead comment" onCommentChange={vi.fn()} />,
    );

    expect(html).toContain('lead comment');
    expect(html).toContain('Instrument comments');
  });
});
