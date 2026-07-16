// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArrangementRowSnapshot } from '../../shared/project-editor';
import ArrangementPanel from '../components/workbench/panels/orchestra/ArrangementPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROWS: ArrangementRowSnapshot[] = [
  {
    assignmentId: '1',
    enabled: true,
    instrumentName: 'Lead',
    instrumentType: 'generic',
    instrumentSummary: 'GenericInstrument',
    editable: true,
  },
];

function renderRoot(element: React.ReactElement): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ArrangementPanel', () => {
  it('closes the add menu on outside mouse down', () => {
    const rendered = renderRoot(
      <ArrangementPanel
        projectSessionId={1}
        projectRevision={1}
        rows={ROWS}
        selectedAssignmentId={null}
        onSelectAssignment={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />, 
    );

    try {
      const addButton = Array.from(rendered.container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === '+ Add',
      );
      expect(addButton).toBeDefined();

      act(() => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      expect(rendered.container.textContent).toContain('Generic Instrument');

      act(() => {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      });

      expect(rendered.container.textContent).not.toContain('Generic Instrument');
    } finally {
      rendered.unmount();
    }
  });
});
