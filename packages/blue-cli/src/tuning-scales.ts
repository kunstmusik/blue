import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  Instance,
  FrozenSoundObject,
  PatternLayer,
  TuningProcessor,
  parseScalaScale,
  type BlueData,
  type NoteProcessorChain,
} from '@blue/data';

export function resolveCliTuningScales(project: BlueData): void {
  const visited = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if ('getNoteProcessorChain' in value && typeof value.getNoteProcessorChain === 'function') {
      const chain: NoteProcessorChain = value.getNoteProcessorChain();
      for (const processor of chain.getProcessors()) {
        if (!(processor instanceof TuningProcessor)) continue;
        const reference = processor.getScaleReference();
        if (!reference) continue;
        const source = path.isAbsolute(reference.filename)
          ? reference.filename
          : path.join(os.homedir(), '.blue', 'scl', reference.filename);
        try {
          processor.resolveScale(parseScalaScale(fs.readFileSync(source, 'utf8')));
        } catch (error) {
          throw new Error('Cannot resolve tuning scale ' + source + ': ' + String(error));
        }
      }
    }
    if (Array.isArray(value)) for (const child of value) visit(child);
    if (value instanceof Instance || value instanceof PatternLayer) visit(value.getSoundObject());
    if (value instanceof FrozenSoundObject) visit(value.getFrozenSoundObject());
  };
  visit(project.getScore());
  visit(project.getSoundObjectLibrary().getAllObjects());
  const bins = project.getLiveData().getLiveObjectBins();
  for (let column = 0; column < bins.getColumnCount(); column++) {
    for (let row = 0; row < bins.getRowCount(); row++)
      visit(bins.getLiveObject(column, row)?.getSoundObject());
  }
}
