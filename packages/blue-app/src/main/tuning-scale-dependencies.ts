import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BlueData,
  Scale,
  TuningProcessor,
  Instance,
  FrozenSoundObject,
  PatternLayer,
  type SoundObject,
  type NoteProcessorChain,
} from '@blue/data';

export interface TuningDependencyOptions {
  readonly scaleDirectory?: string;
  readonly readFile?: (nativePath: string) => string;
}

/**
 * Original parser based on the public Scala format rules:
 * https://www.huygens-fokker.org/scala/scl_format.html
 * The final supplied interval is the period; implicit unison starts the degrees.
 */
export function parseScalaScale(text: string): Scale {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r\n?|\n/)
    .filter((line) => !line.trimStart().startsWith('!'));
  const scale = new Scale();
  scale.scaleName = lines.shift() ?? '';
  const countText = (lines.shift() ?? '').trim();
  if (!/^\d+$/.test(countText)) throw new Error('Scala scale requires an integral degree count.');
  const count = Number(countText);
  if (!Number.isSafeInteger(count) || count < 0 || count > lines.length)
    throw new Error('Scala scale requires a complete interval list.');
  const intervals: number[] = [];
  for (let index = 0; index < count; index++) {
    const token = lines[index]!.trim().split(/\s+/)[0];
    if (!token) throw new Error('Scala scale contains an empty interval.');
    let ratio: number;
    if (token.includes('.')) {
      if (!/^[+-]?(?:\d+\.\d*|\.\d+)$/.test(token))
        throw new Error('Invalid Scala cents interval.');
      ratio = Math.pow(2, Number(token) / 1200);
    } else {
      if (!/^\d+(?:\/\d+)?$/.test(token)) throw new Error('Invalid Scala ratio interval.');
      const [numerator, denominator = '1'] = token.split('/');
      const numeratorValue = Number(numerator);
      const denominatorValue = Number(denominator);
      if (
        !Number.isSafeInteger(numeratorValue) ||
        numeratorValue <= 0 ||
        !Number.isSafeInteger(denominatorValue) ||
        denominatorValue <= 0
      )
        throw new Error('Invalid Scala ratio interval.');
      ratio = numeratorValue / denominatorValue;
    }
    if (!Number.isFinite(ratio) || ratio <= 0)
      throw new Error('Scala intervals must produce finite positive ratios.');
    intervals.push(ratio);
  }
  scale.octave = intervals.pop() ?? 1;
  scale.ratios = [1, ...intervals];
  return Scale.loadFromXML(scale.saveAsXML());
}

function tuningProcessors(root: BlueData | SoundObject): TuningProcessor[] {
  const found = new Set<TuningProcessor>();
  const seen = new Set<object>();
  const chain = (value: NoteProcessorChain) => {
    for (const processor of value.getProcessors())
      if (processor instanceof TuningProcessor && processor.getScaleReference())
        found.add(processor);
  };
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if ('getNoteProcessorChain' in value && typeof value.getNoteProcessorChain === 'function')
      chain(value.getNoteProcessorChain());
    if (Array.isArray(value)) for (const child of value) visit(child);
    if (value instanceof Instance || value instanceof PatternLayer) visit(value.getSoundObject());
    if (value instanceof FrozenSoundObject) visit(value.getFrozenSoundObject());
  };
  if (root instanceof BlueData) {
    visit(root.getScore());
    for (const object of root.getSoundObjectLibrary().getAllObjects()) visit(object);
    const bins = root.getLiveData().getLiveObjectBins();
    for (let column = 0; column < bins.getColumnCount(); column++)
      for (let row = 0; row < bins.getRowCount(); row++)
        visit(bins.getLiveObject(column, row)?.getSoundObject());
  } else visit(root);
  return [...found];
}

/** Resolve a detached insertion/render candidate; validate every file before changing it. */
export function resolveTuningDependencies(
  candidate: BlueData | SoundObject,
  options: TuningDependencyOptions = {},
): void {
  const directory = options.scaleDirectory ?? path.join(os.homedir(), '.blue', 'scl');
  const readFile = options.readFile ?? ((nativePath) => fs.readFileSync(nativePath, 'utf8'));
  const resolved = tuningProcessors(candidate).map((processor) => {
    const reference = processor.getScaleReference()!;
    const nativePath = path.isAbsolute(reference.filename)
      ? reference.filename
      : path.join(directory, reference.filename);
    try {
      return { processor, scale: parseScalaScale(readFile(nativePath)) };
    } catch (error) {
      throw new Error(
        `Unresolved tuning scale ${reference.filename}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
  for (const { processor, scale } of resolved) processor.resolveScale(scale);
}

/** Canonical XML stays untouched; resolved dependencies belong to disposable compilation. */
export function prepareProjectTuningDependencies(
  project: BlueData,
  options?: TuningDependencyOptions,
): BlueData {
  if (tuningProcessors(project).length === 0) return project;
  const candidate = project.historyCopy();
  resolveTuningDependencies(candidate, options);
  return candidate;
}
