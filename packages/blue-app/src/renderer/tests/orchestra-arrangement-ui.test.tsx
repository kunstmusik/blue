// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArrangementRowSnapshot } from '../../shared/project-editor';
import ArrangementPanel from '../components/workbench/panels/orchestra/ArrangementPanel';
import { HostDocumentContext } from '../hooks/use-host-document';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

function renderRoot(element: React.ReactElement): {
  container: HTMLDivElement;
  unmount: () => void;
} {
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
      <HostDocumentContext.Provider value={document}>
        <ArrangementPanel
          projectSessionId={1}
          projectRevision={1}
          rows={ROWS}
          selectedAssignmentId={null}
          onSelectAssignment={vi.fn()}
          onOrchestraPatch={vi.fn()}
        />
      </HostDocumentContext.Provider>,
    );

    try {
      const addButton = Array.from(rendered.container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === '+ Add',
      );
      expect(addButton).toBeDefined();

      act(() => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      // The menu portals into the hosting document body (spec 090).
      expect(document.body.textContent).toContain('Generic Instrument');

      act(() => {
        document.body.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
        );
      });

      expect(document.body.textContent).not.toContain('Generic Instrument');
    } finally {
      rendered.unmount();
    }
  });
});
const midiRoutingMock = vi.hoisted(() => {
  const focusOrchestra = vi.fn();
  const state = {
    focusedTarget: null as {
      kind: 'orchestra';
      projectSessionId: number;
      assignmentId: string;
      displayName: string;
    } | null,
  };
  const useMidiRoutingStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => ({ focusOrchestra }) },
  );
  return { focusOrchestra, state, useMidiRoutingStore };
});
vi.mock('../stores/midi-routing-store', () => ({
  useMidiRoutingStore: midiRoutingMock.useMidiRoutingStore,
}));

describe('ArrangementPanel MIDI focus (Spec 067 US2)', () => {
  beforeEach(() => {
    midiRoutingMock.focusOrchestra.mockReset();
    midiRoutingMock.state.focusedTarget = null;
  });

  it('focuses the Orchestra assignment on explicit row click', () => {
    const rows: ArrangementRowSnapshot[] = [
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
        enabled: true,
        instrumentName: 'Pad',
        instrumentType: 'generic',
        instrumentSummary: 'GenericInstrument',
        editable: true,
      },
    ];
    const onSelect = vi.fn();
    const rendered = renderRoot(
      <ArrangementPanel
        projectSessionId={3}
        projectRevision={1}
        rows={rows}
        selectedAssignmentId={null}
        onSelectAssignment={onSelect}
        onOrchestraPatch={vi.fn()}
      />,
    );
    try {
      const row2 = rendered.container.querySelector('[data-assignment-id="2"]') as HTMLElement;
      expect(row2).toBeTruthy();
      act(() => {
        row2.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(onSelect).toHaveBeenCalledWith('2');
      expect(midiRoutingMock.focusOrchestra).toHaveBeenCalledWith({
        projectSessionId: 3,
        assignmentId: '2',
        displayName: 'Pad',
      });
    } finally {
      rendered.unmount();
    }
  });

  it('uses (unnamed) for an assignment with an empty instrument name', () => {
    const rows: ArrangementRowSnapshot[] = [
      {
        assignmentId: '7',
        enabled: true,
        instrumentName: '',
        instrumentType: 'generic',
        instrumentSummary: 'GenericInstrument',
        editable: true,
      },
    ];
    const rendered = renderRoot(
      <ArrangementPanel
        projectSessionId={1}
        projectRevision={1}
        rows={rows}
        selectedAssignmentId={null}
        onSelectAssignment={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />,
    );
    try {
      const row = rendered.container.querySelector('[data-assignment-id="7"]') as HTMLElement;
      act(() => {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(midiRoutingMock.focusOrchestra).toHaveBeenCalledWith(
        expect.objectContaining({ assignmentId: '7', displayName: '(unnamed)' }),
      );
    } finally {
      rendered.unmount();
    }
  });

  it('marks the focused assignment separately from editor selection', () => {
    midiRoutingMock.state.focusedTarget = {
      kind: 'orchestra',
      projectSessionId: 1,
      assignmentId: '1',
      displayName: 'Lead',
    };
    const rendered = renderRoot(
      <ArrangementPanel
        projectSessionId={1}
        projectRevision={1}
        rows={ROWS}
        selectedAssignmentId="1"
        onSelectAssignment={vi.fn()}
        onOrchestraPatch={vi.fn()}
      />,
    );
    try {
      const row = rendered.container.querySelector('[data-assignment-id="1"]');
      expect(row?.getAttribute('data-midi-focused')).toBe('true');
      expect(row?.className).toContain('bg-app-accent/20');
      expect(row?.className).toContain('ring-app-accent/70');
    } finally {
      rendered.unmount();
    }
  });
});
