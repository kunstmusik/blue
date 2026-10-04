import { loadXml } from './serialization/xml-load';
import type { XmlLoadResult, XmlSource } from './serialization/xml-load';
import { loadInstrumentFromXML } from './instruments/instrument-registry';
import type { Instrument } from './instruments/instrument';
import { Effect } from './mixer/effect';
import { loadSoundObjectFromXML } from './sound-objects/sound-object-registry';
import './sound-objects/register-sound-object-types';
import type { SoundObject } from './sound-objects/sound-object';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { Preset } from './instruments/blue-synth-builder/preset';
import { PresetGroup } from './instruments/blue-synth-builder/preset-group';
import { checkRoot } from './utilities/xml';

export type XmlResourceKind = 'instrument' | 'effect' | 'soundObject' | 'udo' | 'preset';
export type XmlResource =
  Instrument | Effect | SoundObject | OpcodeDefinition | Preset | PresetGroup;

/** Disk, library and BlueShare-shaped resources use local owners without project migrations. */
export function readResourceXml(
  kind: XmlResourceKind,
  xml: string,
  source: XmlSource,
): XmlLoadResult<XmlResource> {
  return loadXml(xml, source, (root, context) => {
    const name = root.getName();
    checkRoot(root, kind === 'preset' ? ['preset', 'presetGroup'] : kind, context);
    switch (kind) {
      case 'instrument':
        return loadInstrumentFromXML(root, context);
      case 'effect':
        return Effect.loadFromXML(root, context);
      case 'soundObject':
        return loadSoundObjectFromXML(root, undefined, context);
      case 'udo':
        return OpcodeDefinition.loadFromXML(root, context);
      case 'preset':
        return name === 'preset'
          ? Preset.loadFromXML(root, context)
          : PresetGroup.loadFromXML(root, context);
      default:
        throw context.error({
          code: 'root',
          message: 'Unsupported resource kind.',
          recovery: 'Choose a supported resource kind.',
        });
    }
  });
}
