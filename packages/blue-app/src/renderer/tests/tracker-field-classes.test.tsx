// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TrackPropertiesModal,
  TRACKER_FIELD_CLASS,
  TRACKER_MONO_FIELD_CLASS,
} from '../components/workbench/panels/score-object/editors/TrackerScoreObjectEditor';
import { cn } from '../lib/cn';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Tracker editor field conflict resolution (US2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders input fields with py-1.5 override and no duplicate py-1', () => {
    act(() => {
      root.render(
        <TrackPropertiesModal
          track={{
            trackName: 'Test Track',
            instrumentId: 'inst-1',
            noteTemplate: 'i 1 0 1',
            columns: [],
          }}
          onClose={() => {}}
          onSave={() => {}}
        />,
      );
    });

    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    for (const input of inputs) {
      const classes = input.className.split(/\s+/).filter(Boolean);
      expect(classes).toContain('py-1.5');
      expect(classes).not.toContain('py-1');
    }

    const textarea = container.querySelector('textarea')!;
    expect(textarea).not.toBeNull();
    const textareaClasses = textarea.className.split(/\s+/).filter(Boolean);
    expect(textareaClasses).toContain('py-1.5');
    expect(textareaClasses).not.toContain('py-1');
  });

  it('resolves py-1 and py-1.5 conflict via cn() composition', () => {
    const composedField = cn('w-full', TRACKER_FIELD_CLASS, 'py-1.5');
    const fieldClasses = composedField.split(/\s+/).filter(Boolean);
    expect(fieldClasses).toContain('py-1.5');
    expect(fieldClasses).not.toContain('py-1');

    const composedMono = cn('h-16 w-full', TRACKER_MONO_FIELD_CLASS, 'resize-none py-1.5');
    const monoClasses = composedMono.split(/\s+/).filter(Boolean);
    expect(monoClasses).toContain('py-1.5');
    expect(monoClasses).not.toContain('py-1');
  });
});
