import {
  Element,
  Instance,
  PolyObject,
  readResourceXml,
  type XmlDiagnostic,
  type XmlSource,
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
  | { ok: true; object: ImportedScoreObject; diagnostics?: readonly XmlDiagnostic[] }
  | { ok: false; error: string; diagnostics?: readonly XmlDiagnostic[] };

export type ScoreObjectExportResult =
  { status: 'saved' | 'cancelled' } | { status: 'error'; error: string };

export type ScoreObjectValidationResult = { ok: true } | { ok: false; error: string };

type LoadedScoreObjectResult =
  | { ok: true; object: SoundObject; diagnostics: readonly XmlDiagnostic[] }
  | { ok: false; error: string; diagnostics?: readonly XmlDiagnostic[] };

function loadScoreObjectXML(
  xml: string,
  source: XmlSource = { kind: 'soundObject', label: 'Sound Object file' },
): LoadedScoreObjectResult {
  let root: Element;
  try {
    root = Element.parse(xml);
  } catch {
    return { ok: false, error: 'Could not parse XML from file.' };
  }

  if (root.getName() !== 'soundObject') {
    return { ok: false, error: 'File did not contain a Sound Object.' };
  }

  const report = readResourceXml('soundObject', xml, source);
  if (!report.ok)
    return {
      ok: false,
      diagnostics: report.diagnostics,
      error: report.diagnostics
        .map((item) => `${item.source.label}: ${item.path}: ${item.message} ${item.recovery}`)
        .join('\n'),
    };
  return { ok: true, object: report.value as SoundObject, diagnostics: report.diagnostics };
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
  source?: XmlSource,
): ScoreObjectImportResult {
  const loaded = loadScoreObjectXML(xml, source);
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
    ...(loaded.diagnostics.length ? { diagnostics: loaded.diagnostics } : {}),
    object: {
      serializedXml: loaded.object.saveAsXML().toXml(),
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
