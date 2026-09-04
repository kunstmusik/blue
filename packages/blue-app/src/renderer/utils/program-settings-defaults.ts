import { Effect, UDOStyle } from '@blue/data';

import type { UdoDefinitionSnapshot } from '../../shared/project-editor';
import {
  EMPTY_UDO_SNAPSHOT,
  cloneUdoSnapshot,
} from '../components/workbench/panels/udo/udo-snapshot-utils';

const FALLBACK_UDO_STYLE = 'MODERN' as const;

export async function getDefaultUdoStyle(): Promise<'CLASSIC' | 'MODERN'> {
  try {
    if (!window.blueAPI?.getProgramSettings) {
      return FALLBACK_UDO_STYLE;
    }

    const settings = await window.blueAPI.getProgramSettings();
    return settings.projectDefaults.defaultUdoStyle;
  } catch {
    return FALLBACK_UDO_STYLE;
  }
}

export async function createDefaultUdoSnapshot(): Promise<UdoDefinitionSnapshot> {
  const style = await getDefaultUdoStyle();
  return {
    ...cloneUdoSnapshot(EMPTY_UDO_SNAPSHOT),
    style,
  };
}

export async function createDefaultEffectXml(): Promise<string> {
  const style = await getDefaultUdoStyle();
  const effect = new Effect();
  effect.setStyle(UDOStyle[style as keyof typeof UDOStyle]);
  return effect.saveAsXML().toXml();
}
