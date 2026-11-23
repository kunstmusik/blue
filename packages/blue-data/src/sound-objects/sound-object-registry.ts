/**
 * SoundObjectRegistry — central dispatch for SoundObject XML deserialization.
 * Maps type names (including Java full class names) to their loadFromXML functions.
 * Uses self-registration to avoid circular dependencies.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';

/** Callback that reconstructs a sound object from XML and shared load context. */
export type SoundObjectLoader = (
  data: Element,
  objRefMap?: ObjRefLoadMap,
  context?: XmlLoadContext,
) => SoundObject | null;
/** Callback that creates a fresh instance of a registered sound-object type. */
export type SoundObjectFactory = () => SoundObject;

/** Whether a sound-object type may be placed on a track. */
export type TrackPlacement = 'compatible' | 'incompatible';
/** Registry classification controlling how generated notes interact with a track instrument assignment. */
export type InstrumentTargetBehavior = 'assignable' | 'propagated' | 'preserve' | 'none';

/** Registry metadata describing a sound-object type's placement and instrument-target behavior. */
export interface SoundObjectTypeDescriptor {
  /** Registered sound-object type name. */
  readonly typeName: string;
  /** Whether this type can be placed in a track. */
  readonly trackPlacement: TrackPlacement;
  /** Explanation when track placement is unavailable. */
  readonly trackPlacementReason?: string;
  /** How generated notes participate in track instrument targeting. */
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

/** Registers a loader for a persisted sound-object type and its placement metadata. */
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

/** Registers a factory for creating a new sound object of the given type. */
export function registerSoundObjectFactory(typeName: string, factory: SoundObjectFactory): void {
  factories.set(typeName, factory);
}

/** Creates a sound object using the factory registered under the supplied type name. */
export function createSoundObject(typeName: string): SoundObject | null {
  const factory = factories.get(typeName) ?? factories.get(normalizeClassName(typeName));
  return factory ? factory() : null;
}

/** Looks up placement and instrument-target metadata for a registered type. */
export function getSoundObjectTypeDescriptor(
  typeName: string | null | undefined,
): SoundObjectTypeDescriptor | undefined {
  if (!typeName) return undefined;
  return descriptors.get(typeName) ?? descriptors.get(normalizeClassName(typeName));
}

/** Returns the registered sound-object type metadata. */
export function getAllSoundObjectTypeDescriptors(): readonly SoundObjectTypeDescriptor[] {
  const seen = new Map<string, SoundObjectTypeDescriptor>();
  for (const descriptor of descriptors.values()) {
    seen.set(descriptor.typeName, descriptor);
  }
  return [...seen.values()];
}

/** Checks whether the supplied sound object supports placement on a track. */
export function getTrackPlacementForSoundObject(object: SoundObject): {
  /** Whether the object can be placed on a track. */
  compatible: boolean;
  /** Explanation of why the requested value is unavailable. */
  reason?: string;
  /** Registration metadata used to determine placement, when available. */
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

/** Checks track compatibility for a registered sound-object type name. */
export function getTrackPlacementForSoundObjectType(typeName: string | null | undefined): {
  /** Whether the type can be placed on a track. */
  compatible: boolean;
  /** Explanation of why the requested value is unavailable. */
  reason?: string;
  /** Registration metadata used to determine placement, when available. */
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

/** Reconstructs the registered sound-object type using the supplied reference map and XML diagnostic context. */
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
