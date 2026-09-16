// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyScoreDocumentSnapshot,
  type ScoreDocumentSnapshot,
} from '../../shared/project-editor';
import ScoreSettingsDialog from '../components/workbench/panels/score/ScoreSettingsDialog';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderDialog(
  overrides: Partial<{
    score: ScoreDocumentSnapshot;
    mixerEnabled: boolean;
    legacyNotice: boolean;
  }> = {},
): {
  container: HTMLDivElement;
  root: Root;
  onModeChange: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onModeChange = vi.fn();
  const onClose = vi.fn();
  const score = {
    ...createEmptyScoreDocumentSnapshot(),
    ...overrides.score,
  };

  act(() => {
    root.render(
      <ScoreSettingsDialog
        score={score}
        mixerEnabled={overrides.mixerEnabled ?? true}
        legacyNotice={overrides.legacyNotice ?? false}
        onModeChange={onModeChange}
        onClose={onClose}
      />,
    );
  });

  return { container, root, onModeChange, onClose };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ScoreSettingsDialog', () => {
  it('provides the Audio/Event track-header setting in an accessible modal', () => {
    const { container, root } = renderDialog();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-labelledby')).toBe('score-settings-dialog-title');
    expect(dialog?.textContent).toContain('Score Settings');

    const group = dialog?.querySelector(
      '[role="radiogroup"][aria-label="Track header mute/solo behavior"]',
    );
    expect(group).toBeTruthy();
    expect(group?.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe('Audio');
    expect(group?.textContent).toContain('Event');
    expect(dialog?.textContent).not.toContain('Project Information');

    act(() => root.unmount());
  });

  it('routes mode selection to the existing project-history action boundary', () => {
    const { container, root, onModeChange } = renderDialog();
    const event = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (radio) => radio.textContent === 'Event',
    ) as HTMLButtonElement;

    act(() => event.click());

    expect(onModeChange).toHaveBeenCalledWith('event');

    act(() => root.unmount());
  });

  it('explains the mixer-disabled Event override', () => {
    const { container, root } = renderDialog({
      mixerEnabled: false,
      score: {
        ...createEmptyScoreDocumentSnapshot(),
        trackLayerMuteSoloMode: 'event',
      },
    });

    expect(container.textContent).toContain('Effective behavior: Event');
    expect(container.textContent).toContain('mixer is disabled');

    act(() => root.unmount());
  });

  it('shows the compatibility notice in Score Settings when required', () => {
    const { container, root } = renderDialog({ legacyNotice: true });

    expect(container.textContent).toContain('active channel Mute or Solo flags');

    act(() => root.unmount());
  });

  it('closes from the dialog close control without changing the mode', () => {
    const { container, root, onModeChange, onClose } = renderDialog();
    const closeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close Score Settings"]',
    );

    expect(closeButton).toBeTruthy();
    act(() => closeButton!.click());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onModeChange).not.toHaveBeenCalled();

    act(() => root.unmount());
  });
});
