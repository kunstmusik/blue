import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GenericInstrumentSnapshot } from '../../shared/project-editor';
import InstrumentEditorPanel from '../components/workbench/panels/orchestra/InstrumentEditorPanel';
import InstrumentCommentsPanel from '../components/workbench/panels/orchestra/InstrumentCommentsPanel';

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
  it('renders the editor/comments tab shell for a selected instrument', () => {
    const html = renderToStaticMarkup(
      <InstrumentEditorPanel
        instrument={GENERIC_INSTRUMENT}
        projectUdos={[]}
        onOrchestraPatch={vi.fn()}
      />,
    );

    expect(html).toContain('Instrument Editor');
    expect(html).toContain('Comments');
    expect(html).toContain('Lead');
    expect(html).toContain('aout oscili');
  });

  it('renders a no-selection state', () => {
    const html = renderToStaticMarkup(
      <InstrumentEditorPanel
        instrument={undefined}
        projectUdos={[]}
        onOrchestraPatch={vi.fn()}
      />,
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
