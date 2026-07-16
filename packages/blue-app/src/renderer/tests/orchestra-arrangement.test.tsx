import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OrchestraSnapshot } from '../../shared/project-editor';
import ArrangementPanel from '../components/workbench/panels/orchestra/ArrangementPanel';

const ORCHESTRA: OrchestraSnapshot = {
  loaded: true,
  arrangement: {
    rows: [
      {
        assignmentId: '1',
        enabled: true,
        instrumentName: 'Lead',
        instrumentType: 'generic',
        instrumentSummary: 'GenericInstrument',
        editable: true,
      },
      {
        assignmentId: '2',
        enabled: false,
        instrumentName: 'Builder',
        instrumentType: 'blueSynthBuilder',
        instrumentSummary: 'BlueSynthBuilder',
        editable: true,
      },
    ],
  },
  instruments: [],
  temporaryLibrary: {
    status: 'deferred',
    message: 'Program-wide orchestra library is deferred for this slice.',
  },
};

describe('Orchestra arrangement panel', () => {
  it('renders TanStack-backed arrangement columns and rows', () => {
    const html = renderToStaticMarkup(
      <ArrangementPanel
        rows={ORCHESTRA.arrangement.rows}
        selectedAssignmentId="1"
        onSelectAssignment={vi.fn()}
        onOrchestraPatch={vi.fn()}
        projectSessionId={1}
        projectRevision={1}
      />,
    );

    expect(html).toContain('Arrangement');
    expect(html).toContain('Instr ID');
    expect(html).toContain('Instr Name');
    expect(html).toContain('Lead');
    expect(html).toContain('Builder');
    expect(html).toContain('+ Add');
  });
});
