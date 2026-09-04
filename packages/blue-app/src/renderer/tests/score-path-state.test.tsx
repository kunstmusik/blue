// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useScorePathState } from '../components/workbench/panels/score/useScorePathState';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface Captured {
  session: ReturnType<typeof useScorePathState>['session'];
  navigateToGroup: ReturnType<typeof useScorePathState>['navigateToGroup'];
}

function Harness({
  capture,
}: {
  capture: React.MutableRefObject<Captured | null>;
}): React.ReactElement {
  const { session, navigateToGroup } = useScorePathState();
  capture.current = { session, navigateToGroup };
  return React.createElement('div');
}

describe('useScorePathState navigateToGroup', () => {
  let container: HTMLDivElement;
  let root: Root;
  let capture: React.MutableRefObject<Captured | null>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    capture = { current: null };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('does not stack duplicate segments when re-entering the active group', () => {
    act(() => {
      root.render(React.createElement(Harness, { capture }));
    });

    const loc = { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 3 };

    act(() => {
      capture.current!.navigateToGroup('sobj-nested', 'Nested PolyObject', loc);
    });
    expect(capture.current!.session.segments.map((s) => s.label)).toEqual([
      'Root',
      'Nested PolyObject',
    ]);
    expect(capture.current!.session.activeGroupId).toBe('sobj-nested');

    // Repeated double-clicks on the already-active group must not append again.
    act(() => {
      capture.current!.navigateToGroup('sobj-nested', 'Nested PolyObject', loc);
    });
    act(() => {
      capture.current!.navigateToGroup('sobj-nested', 'Nested PolyObject', loc);
    });
    expect(capture.current!.session.segments.map((s) => s.label)).toEqual([
      'Root',
      'Nested PolyObject',
    ]);
  });
});
