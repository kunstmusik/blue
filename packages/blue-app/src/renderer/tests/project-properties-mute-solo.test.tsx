// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectInformationTab from '../components/workbench/panels/project-properties/ProjectInformationTab';
import { useProjectStore } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function mountTab(): {
  host: HTMLDivElement;
  updateSpy: ReturnType<typeof vi.fn>;
  unmount: () => void;
} {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const updateSpy = vi.fn();
  const properties = useProjectStore.getState().projectProperties;
  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root!.render(
      React.createElement(ProjectInformationTab, {
        disabled: false,
        properties,
        updateProjectProperties: updateSpy,
      }),
    );
  });
  return {
    host,
    updateSpy,
    unmount: () => {
      act(() => root?.unmount());
      host.remove();
    },
  };
}

describe('Project Information metadata (Spec 111)', () => {
  beforeEach(() => {
    useProjectStore.getState().clearProject();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render the Score Settings mode selector', () => {
    const { host, unmount } = mountTab();
    expect(host.querySelector('[role="radiogroup"]')).toBeNull();
    expect(host.textContent).not.toContain('Track Header M/S');
    expect(host.textContent).not.toContain('Audio');
    expect(host.textContent).not.toContain('Event');
    unmount();
  });

  it('keeps project metadata and notes available', () => {
    const { host, updateSpy, unmount } = mountTab();
    expect(host.querySelectorAll('input')).toHaveLength(2);
    expect(host.querySelector('textarea')).toBeTruthy();
    expect(updateSpy).not.toHaveBeenCalled();
    unmount();
  });
});
