// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MidiSettings from '../components/settings/MidiSettings';
import { useMidiInputStore } from '../stores/midi-input-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

declare global {
  interface Window {
    blueAPI?: {
      requestMidiInputRescan?: () => Promise<{ accepted: boolean; message?: string }>;
    };
  }
}

function renderPanel(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MidiSettings />);
  });
  return { container, root };
}

beforeEach(() => {
  useMidiInputStore.getState().reset();
  window.blueAPI = {
    requestMidiInputRescan: vi.fn(async () => ({ accepted: true })),
  };
});

afterEach(() => {
  delete window.blueAPI;
});

describe('MidiSettings', () => {
  it('renders an explanatory empty state when no devices are discovered or saved', () => {
    const { container, root } = renderPanel();
    expect(container.textContent).toContain('No MIDI input devices found');
    // No toolbar MIDI Input button here; this panel is app-wide device settings.
    const buttons = Array.from(container.querySelectorAll('button'));
    const rescanButton = buttons.find((b) => b.textContent === 'Rescan');
    expect(rescanButton).toBeTruthy();
    act(() => { root.unmount(); });
    container.remove();
  });

  it('renders rows from the draft preferences and reflects runtime connection state', () => {
    useMidiInputStore.getState().setSavedPreferences({
      devices: [
        { id: 'a', name: 'Alpha', manufacturer: 'M', version: '1', enabled: true },
        { id: 'b', name: 'Bravo', manufacturer: '', version: '', enabled: false },
      ],
    });
    useMidiInputStore.getState().setSnapshot({
      instanceId: 'inst',
      revision: 1,
      phase: 'partial',
      devices: [
        { id: 'a', name: 'Alpha', manufacturer: 'M', version: '1', enabled: true, availability: 'available', connection: 'connected', lastError: null },
        { id: 'b', name: 'Bravo', manufacturer: '', version: '', enabled: false, availability: 'unavailable', connection: 'closed', lastError: null },
      ],
      message: null,
      updatedAt: 0,
    });

    const { container, root } = renderPanel();

    const table = container.querySelector('table');
    expect(table?.classList).toContain('text-role-body');
    expect(table?.querySelector('thead')?.classList).toContain('text-role-headline');
    expect(table?.querySelector('thead')?.classList).toContain('font-bold');

    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    const enabledValues = checkboxes.map((c) => c.checked).sort();
    expect(enabledValues).toContain(true);
    expect(enabledValues).toContain(false);

    // phase badge visible
    expect(container.textContent).toContain('partial');

    act(() => { root.unmount(); });
    container.remove();
  });

  it('shows newly discovered devices as enabled by default', () => {
    // The user just plugged in a controller; nothing is saved yet. The
    // snapshot reports the discovered device; the draft preferences are
    // empty. The panel must surface the device as enabled and connected.
    useMidiInputStore.getState().setSavedPreferences({ devices: [] });
    useMidiInputStore.getState().setSnapshot({
      instanceId: 'inst',
      revision: 1,
      phase: 'ready',
      devices: [
        { id: 'live-1', name: 'Live Controller', manufacturer: 'Acme', version: '1.0', enabled: true, availability: 'available', connection: 'connected', lastError: null },
      ],
      message: null,
      updatedAt: 0,
    });

    const { container, root } = renderPanel();

    expect(container.textContent).toContain('Live Controller');
    expect(container.textContent).toContain('Acme');
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    act(() => { root.unmount(); });
    container.remove();
  });

  it('disabling a discovered device upserts the explicit choice with live metadata', () => {
    useMidiInputStore.getState().setSavedPreferences({ devices: [] });
    useMidiInputStore.getState().setSnapshot({
      instanceId: 'inst',
      revision: 1,
      phase: 'ready',
      devices: [
        { id: 'live-1', name: 'Live Controller', manufacturer: 'Acme', version: '1.0', enabled: true, availability: 'available', connection: 'connected', lastError: null },
      ],
      message: null,
      updatedAt: 0,
    });

    const { container, root } = renderPanel();
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    act(() => {
      checkbox.click();
    });

    const draft = useMidiInputStore.getState().draftMidiInput;
    expect(draft.devices).toHaveLength(1);
    expect(draft.devices[0]).toMatchObject({
      id: 'live-1',
      name: 'Live Controller',
      manufacturer: 'Acme',
      version: '1.0',
      enabled: false,
    });
    expect(useMidiInputStore.getState().draftDirty).toBe(true);

    act(() => { root.unmount(); });
    container.remove();
  });

  it('shows an OS-permission/denied hint when the service reports a denied phase', () => {
    useMidiInputStore.getState().setSavedPreferences({ devices: [] });
    useMidiInputStore.getState().setSnapshot({
      instanceId: 'inst',
      revision: 1,
      phase: 'denied',
      devices: [],
      message: null,
      updatedAt: 0,
    });

    const { container, root } = renderPanel();
    expect(container.textContent).toContain('MIDI permission was denied');

    act(() => { root.unmount(); });
    container.remove();
  });

  it('toggling an enabled checkbox updates the store draft dirty state', () => {
    useMidiInputStore.getState().setSavedPreferences({
      devices: [
        { id: 'a', name: 'Alpha', manufacturer: '', version: '', enabled: true },
      ],
    });
    // Surface the saved device through a snapshot so the merge logic doesn't
    // treat it as newly discovered.
    useMidiInputStore.getState().setSnapshot({
      instanceId: 'inst',
      revision: 1,
      phase: 'ready',
      devices: [
        { id: 'a', name: 'Alpha', manufacturer: '', version: '', enabled: true, availability: 'available', connection: 'closed', lastError: null },
      ],
      message: null,
      updatedAt: 0,
    });

    const { container, root } = renderPanel();
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(useMidiInputStore.getState().draftDirty).toBe(false);

    act(() => {
      checkbox.click();
    });

    expect(useMidiInputStore.getState().draftMidiInput.devices[0]?.enabled).toBe(false);
    expect(useMidiInputStore.getState().draftDirty).toBe(true);

    act(() => { root.unmount(); });
    container.remove();
  });

  it('Rescan calls the blueAPI requestMidiInputRescan method', () => {
    useMidiInputStore.getState().setSavedPreferences({
      devices: [{ id: 'a', name: 'Alpha', manufacturer: '', version: '', enabled: true }],
    });
    useMidiInputStore.getState().setSnapshot({
      instanceId: 'inst',
      revision: 1,
      phase: 'ready',
      devices: [
        { id: 'a', name: 'Alpha', manufacturer: '', version: '', enabled: true, availability: 'available', connection: 'closed', lastError: null },
      ],
      message: null,
      updatedAt: 0,
    });

    const { container, root } = renderPanel();
    const rescanButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Rescan') as HTMLButtonElement;

    act(() => {
      rescanButton.click();
    });

    expect(window.blueAPI?.requestMidiInputRescan).toHaveBeenCalledTimes(1);

    act(() => { root.unmount(); });
    container.remove();
  });
});
