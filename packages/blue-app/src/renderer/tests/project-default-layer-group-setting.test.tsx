// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectDefaultsSettings from '../components/settings/ProjectDefaultsSettings';
import { createDefaultProjectDefaultsSettings } from '../../shared/program-settings';
import { chooseAppSelectOption, getAppSelectOptionLabels } from './app-select-test-utils';

describe('Project Defaults default layer group selector', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders Track as the default and emits SoundObject changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    const settings = createDefaultProjectDefaultsSettings();

    act(() => {
      root.render(<ProjectDefaultsSettings settings={settings} onChange={onChange} />);
    });

    const selector = container.querySelector('[role="combobox"]') as HTMLButtonElement | null;
    expect(selector?.textContent).toContain('Track Layer');
    expect(await getAppSelectOptionLabels(selector!)).toEqual([
      'Track Layer',
      'SoundObject Layer',
    ]);

    await chooseAppSelectOption(selector!, 'SoundObject Layer');
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      defaultLayerGroupType: 'SOUND_OBJECT',
    });

    act(() => root.unmount());
  });
});
