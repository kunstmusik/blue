// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectDefaultsSettings from '../components/settings/ProjectDefaultsSettings';
import { createDefaultProjectDefaultsSettings } from '../../shared/program-settings';

describe('Project Defaults default layer group selector', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders Track as the default and emits SoundObject changes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    const settings = createDefaultProjectDefaultsSettings();

    act(() => {
      root.render(<ProjectDefaultsSettings settings={settings} onChange={onChange} />);
    });

    const selector = container.querySelector('select') as HTMLSelectElement | null;
    expect(selector?.value).toBe('TRACK');
    expect(Array.from(selector?.options ?? [], (option) => option.textContent)).toEqual([
      'Track Layer',
      'SoundObject Layer',
    ]);

    act(() => {
      selector!.value = 'SOUND_OBJECT';
      selector!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      defaultLayerGroupType: 'SOUND_OBJECT',
    });

    act(() => root.unmount());
  });
});
