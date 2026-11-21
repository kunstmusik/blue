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

/** Standalone XML formats accepted by {@link readResourceXml}. A preset can be a single preset or a preset group. */
export type XmlResourceKind = 'instrument' | 'effect' | 'soundObject' | 'udo' | 'preset';
/** Model returned by a successful standalone resource load. The concrete type depends on the resource kind and root element. */
export type XmlResource =
  | Instrument
  | Effect
  | SoundObject
  | OpcodeDefinition
  | Preset
  | PresetGroup;

/**
 * Loads a standalone resource from disk, library, or BlueShare XML using its resource-specific rules.
 *
 * @param kind - Resource kind to validate against. `preset` accepts both preset and preset-group roots.
 * @param xml - Source XML text for the standalone resource.
 * @param source - Caller-supplied metadata attached to the diagnostics.
 * @returns The loaded resource and any warnings, or error diagnostics if the XML was rejected.
 */
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
