// @vitest-environment jsdom

import { Effect, Element, UDOStyle } from '@blue/data';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultProgramSettings } from '../../shared/program-settings';
import {
  createDefaultEffectXml,
  createDefaultUdoSnapshot,
  getDefaultUdoStyle,
} from '../utils/program-settings-defaults';

describe('program-settings default style helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as typeof window & { blueAPI?: unknown }).blueAPI;
  });

  it('creates default UDO snapshots using the saved project default style', async () => {
    const settings = createDefaultProgramSettings('darwin');
    settings.projectDefaults.defaultUdoStyle = 'CLASSIC';

    window.blueAPI = {
      getProgramSettings: vi.fn().mockResolvedValue(settings),
    } as typeof window.blueAPI;

    const snapshot = await createDefaultUdoSnapshot();

    expect(snapshot.name).toBe('newOpcode');
    expect(snapshot.style).toBe('CLASSIC');
  });

  it('creates default effect XML using the saved project default style', async () => {
    const settings = createDefaultProgramSettings('darwin');
    settings.projectDefaults.defaultUdoStyle = 'CLASSIC';

    window.blueAPI = {
      getProgramSettings: vi.fn().mockResolvedValue(settings),
    } as typeof window.blueAPI;

    const xml = await createDefaultEffectXml();
    const effect = Effect.loadFromXML(Element.parse(xml));

    expect(effect.getStyle()).toBe(UDOStyle.CLASSIC);
  });

  it('falls back to MODERN when program settings are unavailable', async () => {
    window.blueAPI = {
      getProgramSettings: vi.fn().mockRejectedValue(new Error('boom')),
    } as typeof window.blueAPI;

    await expect(getDefaultUdoStyle()).resolves.toBe('MODERN');
  });
});
