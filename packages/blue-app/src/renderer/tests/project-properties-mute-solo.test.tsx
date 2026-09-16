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
  const properties = {
    ...useProjectStore.getState().projectProperties,
    trackLayerMuteSoloMode: 'audio' as const,
    trackLayerMuteSoloModeRaw: null,
  };
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

describe('Track header mode selector (Spec 111)', () => {
  beforeEach(() => {
    useProjectStore.getState().clearProject();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders Audio/Event radios with the saved mode checked', () => {
    const { host, unmount } = mountTab();
    const group = host.querySelector(
      '[role="radiogroup"][aria-label="Track header mute/solo behavior"]',
    );
    expect(group).toBeTruthy();
    const audio = host.querySelector('[role="radio"][aria-checked="true"]');
    expect(audio?.textContent).toBe('Audio');
    unmount();
  });

  it('submits one semantic mode change per selection', () => {
    const { host, updateSpy, unmount } = mountTab();
    const eventRadio = Array.from(host.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === 'Event',
    ) as HTMLButtonElement;
    act(() => {
      eventRadio.click();
    });
    expect(updateSpy).toHaveBeenCalledWith(
      { trackLayerMuteSoloMode: 'event' },
      { label: 'Set Track Header Mode to Event' },
    );
    unmount();
  });

  it('reports an unsupported saved value as an Event diagnostic', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const updateSpy = vi.fn();
    const properties = {
      ...useProjectStore.getState().projectProperties,
      trackLayerMuteSoloMode: 'event' as const,
      trackLayerMuteSoloModeRaw: 'solo-all',
    };
    let root: Root | null = null;
    act(() => {
      root = createRoot(host);
      root!.render(
        React.createElement(ProjectInformationTab, {
          disabled: false,
          properties: properties as never,
          updateProjectProperties: updateSpy,
        }),
      );
    });
    expect(host.textContent).toContain('solo-all');
    expect(host.textContent).toContain('Event behavior is used');
    act(() => root?.unmount());
    host.remove();
  });
});
