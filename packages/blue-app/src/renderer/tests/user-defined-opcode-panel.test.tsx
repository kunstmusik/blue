// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UserDefinedOpcodePanel from '../components/workbench/panels/UserDefinedOpcodePanel';
import { useProjectStore } from '../stores/project-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();

vi.mock('../components/workbench/panels/udo/UdoWorkspacePanel', () => ({
  default: (props: {
    udos: Array<{ name: string }>;
    libraryDropTarget?: { projectSessionId: number; projectRevision: number };
  }) => (
    <div
      data-testid="reusable-udo-workspace"
      data-project-session={props.libraryDropTarget?.projectSessionId}
      data-project-revision={props.libraryDropTarget?.projectRevision}
    >
      {props.udos.map((udo) => udo.name).join(',')}
    </div>
  ),
}));

afterEach(() => {
  document.body.replaceChildren();
  useProjectStore.setState(originalProjectState, true);
});

describe('UserDefinedOpcodeTopComponent', () => {
  it('uses the reusable project UDO list/editor with a typed Library drop target', () => {
    useProjectStore.setState({
      loaded: true,
      sessionId: 17,
      filePath: '/tmp/project.blue',
      projectUdos: [{
        name: 'tone',
        style: 'CLASSIC',
        outTypes: 'a',
        inTypes: 'a',
        inputArguments: '',
        code: 'aout = ain',
        comments: '',
      }],
      applyProjectUdoPatch: vi.fn(async () => true),
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<UserDefinedOpcodePanel />));

    const workspace = container.querySelector('[data-testid="reusable-udo-workspace"]');
    expect(workspace?.textContent).toBe('tone');
    expect(workspace?.getAttribute('data-project-session')).toBe('17');
    expect(workspace?.hasAttribute('data-project-revision')).toBe(true);

    act(() => root.unmount());
  });
});
