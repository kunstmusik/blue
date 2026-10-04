/**
 * SoundObjectRegistry — central dispatch for SoundObject XML deserialization.
 * Maps type names (including Java full class names) to their loadFromXML functions.
 * Uses self-registration to avoid circular dependencies.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';

type SoundObjectLoader = (
  data: Element,
  objRefMap?: ObjRefLoadMap,
  context?: XmlLoadContext,
) => SoundObject | null;
type SoundObjectFactory = () => SoundObject;

export type TrackPlacement = 'compatible' | 'incompatible';
export type InstrumentTargetBehavior = 'assignable' | 'propagated' | 'preserve' | 'none';

export interface SoundObjectTypeDescriptor {
  readonly typeName: string;
  readonly trackPlacement: TrackPlacement;
  readonly trackPlacementReason?: string;
  readonly instrumentTargetBehavior: InstrumentTargetBehavior;
}

const XML_TYPES = new Set([
  'GenericScore',
  'PolyObject',
  'PythonObject',
  'ClojureObject',
  'JavaScriptObject',
  'CSDSoundObject',
  'Comment',
  'AudioFile',
  'Sound',
  'External',
  'Instance',
  'LineObject',
  'ZakLineObject',
  'PatternObject',
  'PianoRoll',
  'JMask',
  'TrackerObject',
  'FrozenSoundObject',
  'ObjectBuilder',
]);

const registry = new Map<string, SoundObjectLoader>();
const factories = new Map<string, SoundObjectFactory>();
const descriptors = new Map<string, SoundObjectTypeDescriptor>();

export function normalizeClassName(type: string | null): string {
  if (!type) return '';
  const shortName = type.split('.').pop() || type;
  return shortName;
}

export function registerSoundObjectType(
  typeName: string,
  loader: SoundObjectLoader,
  descriptor: Omit<SoundObjectTypeDescriptor, 'typeName'>,
): void {
  if (!descriptor || !descriptor.trackPlacement || !descriptor.instrumentTargetBehavior) {
    throw new Error(`SoundObject type '${typeName}' must declare Track placement metadata`);
  }
  const canonicalName = normalizeClassName(typeName);
  registry.set(typeName, loader);
  descriptors.set(typeName, { typeName: canonicalName, ...descriptor });
  if (canonicalName !== typeName) {
    descriptors.set(canonicalName, { typeName: canonicalName, ...descriptor });
  }
}

export function registerSoundObjectFactory(typeName: string, factory: SoundObjectFactory): void {
  factories.set(typeName, factory);
}

export function createSoundObject(typeName: string): SoundObject | null {
  const factory = factories.get(typeName) ?? factories.get(normalizeClassName(typeName));
  return factory ? factory() : null;
}

export function getSoundObjectTypeDescriptor(
  typeName: string | null | undefined,
): SoundObjectTypeDescriptor | undefined {
  if (!typeName) return undefined;
  return descriptors.get(typeName) ?? descriptors.get(normalizeClassName(typeName));
}

export function getAllSoundObjectTypeDescriptors(): readonly SoundObjectTypeDescriptor[] {
  const seen = new Map<string, SoundObjectTypeDescriptor>();
  for (const descriptor of descriptors.values()) {
    seen.set(descriptor.typeName, descriptor);
  }
  return [...seen.values()];
}

export function getTrackPlacementForSoundObject(object: SoundObject): {
  compatible: boolean;
  reason?: string;
  descriptor?: SoundObjectTypeDescriptor;
} {
  const placement = getTrackPlacementForSoundObjectType(object.constructor.name);
  if (!placement.compatible || placement.descriptor?.instrumentTargetBehavior !== 'propagated') {
    return placement;
  }

  const referenced = (
    object as SoundObject & { getSoundObject?: () => SoundObject | null }
  ).getSoundObject?.();
  if (!referenced) return placement;

  const referencedPlacement = getTrackPlacementForSoundObject(referenced);
  if (referencedPlacement.compatible) return placement;
  return {
    compatible: false,
    descriptor: placement.descriptor,
    reason: `Referenced ${referenced.constructor.name} is not valid in a Track: ${referencedPlacement.reason ?? 'incompatible type'}`,
  };
}

export function getTrackPlacementForSoundObjectType(typeName: string | null | undefined): {
  compatible: boolean;
  reason?: string;
  descriptor?: SoundObjectTypeDescriptor;
} {
  const rawType = typeName ?? '';
  const descriptor = getSoundObjectTypeDescriptor(rawType);
  if (!descriptor) {
    return {
      compatible: false,
      reason: `SoundObject type '${rawType}' is not registered for Track placement`,
    };
  }
  return {
    compatible: descriptor.trackPlacement === 'compatible',
    reason: descriptor.trackPlacementReason,
    descriptor,
  };
}

export function loadSoundObjectFromXML(
  data: Element,
  objRefMap?: ObjRefLoadMap,
  providedContext?: XmlLoadContext,
  sink?: XmlDiagnosticSink,
): SoundObject {
  const context = providedContext ?? new XmlLoadContext(data);
  const rawType = data.getAttribute('type');
  // The finite built-in short aliases also accept their exact Java package spelling.
  const type =
    rawType === 'blue.clojure.soundObject.ClojureObject'
      ? 'ClojureObject'
      : rawType?.startsWith('blue.soundObject.')
        ? rawType.slice('blue.soundObject.'.length)
        : rawType;
  const loader = type && XML_TYPES.has(type) ? registry.get(type) : undefined;
  if (data.getName() !== 'soundObject' || !loader)
    throw context.at(data).error({
      code: 'type',
      member: '@type',
      value: rawType ?? '',
      message: 'Unsupported or missing SoundObject type.',
      recovery:
        'Use a supported exact type or retain the original in the separate library archive.',
    });
  const object = loader(data, objRefMap, context);
  if (!object)
    throw context.at(data).error({
      code: 'type',
      member: '@type',
      value: rawType!,
      message: 'SoundObject loader did not produce a complete candidate.',
      recovery: 'Repair this resource in a compatible editor.',
    });
  return providedContext ? object : requireXmlValue(context.result(object), sink);
}
