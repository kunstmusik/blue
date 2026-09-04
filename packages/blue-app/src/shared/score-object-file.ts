import {
  Element,
  Instance,
  PolyObject,
  loadSoundObjectFromXML,
  type SoundObject,
  type TimeContext,
} from '@blue/data';

export interface ImportedScoreObject {
  serializedXml: string;
  objectType: string;
  name: string;
  backgroundColor: number;
  durationBeats: number;
  destinationTimeBase: string;
  isContainer: boolean;
}

export type ScoreObjectImportResult =
  | { ok: true; object: ImportedScoreObject }
  | { ok: false; error: string };

export type ScoreObjectExportResult =
  | { status: 'saved' | 'cancelled' }
  | { status: 'error'; error: string };

export type ScoreObjectValidationResult = { ok: true } | { ok: false; error: string };

type LoadedScoreObjectResult = { ok: true; object: SoundObject } | { ok: false; error: string };

function loadScoreObjectXML(xml: string): LoadedScoreObjectResult {
  let root: Element;
  try {
    root = Element.parse(xml);
  } catch {
    return { ok: false, error: 'Could not parse XML from file.' };
  }

  if (root.getName() !== 'soundObject') {
    return { ok: false, error: 'File did not contain a Sound Object.' };
  }

  try {
    const object = loadSoundObjectFromXML(root);
    return object
      ? { ok: true, object }
      : { ok: false, error: 'File contained an unsupported Sound Object type.' };
  } catch {
    return { ok: false, error: 'Could not load the Sound Object from XML.' };
  }
}

function containsInstance(polyObject: PolyObject): boolean {
  for (const layer of polyObject) {
    for (const object of layer) {
      if (object instanceof Instance) return true;
      if (object instanceof PolyObject && containsInstance(object)) return true;
    }
  }
  return false;
}

function hasUnsupportedInstance(object: SoundObject): boolean {
  return object instanceof Instance || (object instanceof PolyObject && containsInstance(object));
}

export function prepareScoreObjectImport(
  xml: string,
  context: TimeContext,
  destinationTimeBase: string,
): ScoreObjectImportResult {
  const loaded = loadScoreObjectXML(xml);
  if (!loaded.ok) return loaded;
  if (hasUnsupportedInstance(loaded.object)) {
    return {
      ok: false,
      error:
        'Import of Instance objects or PolyObjects containing Instance objects is not supported.',
    };
  }

  const durationBeats = loaded.object.getSubjectiveDuration().toBeats(context);
  if (!Number.isFinite(durationBeats) || durationBeats < 0) {
    return { ok: false, error: 'Sound Object has an invalid duration.' };
  }

  return {
    ok: true,
    object: {
      serializedXml: xml,
      objectType: loaded.object.constructor.name,
      name: loaded.object.getName() || 'Imported Object',
      backgroundColor: loaded.object.getBackgroundColor(),
      durationBeats,
      destinationTimeBase,
      isContainer: loaded.object instanceof PolyObject,
    },
  };
}

export function validateScoreObjectExport(xml: string): ScoreObjectValidationResult {
  const loaded = loadScoreObjectXML(xml);
  if (!loaded.ok) return loaded;
  if (hasUnsupportedInstance(loaded.object)) {
    return {
      ok: false,
      error:
        'Export of Instance objects or PolyObjects containing Instance objects is not allowed.',
    };
  }
  return { ok: true };
}
