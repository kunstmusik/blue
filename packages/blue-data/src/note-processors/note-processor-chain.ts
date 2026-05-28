import type { CompileData } from '../compile-data';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { AddProcessor } from './add-processor';
import { MultiplyProcessor } from './multiply-processor';
import { RandomAddProcessor } from './random-add-processor';
import { RandomMultiplyProcessor } from './random-multiply-processor';
import { LineAddProcessor } from './line-add-processor';
import { LineMultiplyProcessor } from './line-multiply-processor';
import { PchAddProcessor } from './pch-add-processor';
import { PchInversionProcessor } from './pch-inversion-processor';
import { InversionProcessor } from './inversion-processor';
import { RetrogradeProcessor } from './retrograde-processor';
import { RotateProcessor } from './rotate-processor';
import { TimeWarpProcessor } from './time-warp-processor';
import { TuningProcessor } from './tuning-processor';
import { SwitchProcessor } from './switch-processor';
import { SubListProcessor } from './sublist-processor';
import { EqualsProcessor } from './equals-processor';
import { PythonProcessor } from './python-processor';
import { UnsupportedProcessor } from './unsupported-processor';

const PROCESSOR_MAP: Record<string, { loadFromXML: (data: Element) => NoteProcessor }> = {
  AddProcessor,
  MultiplyProcessor,
  RandomAddProcessor,
  RandomMultiplyProcessor,
  LineAddProcessor,
  LineMultiplyProcessor,
  PchAddProcessor,
  PchInversionProcessor,
  InversionProcessor,
  RetrogradeProcessor,
  RotateProcessor,
  TimeWarpProcessor,
  TuningProcessor,
  SwitchProcessor,
  SubListProcessor,
  EqualsProcessor,
  PythonProcessor,
};

const FULL_CLASS_NAME_MAP: Record<string, string> = {
  'blue.noteProcessor.AddProcessor': 'AddProcessor',
  'blue.noteProcessor.MultiplyProcessor': 'MultiplyProcessor',
  'blue.noteProcessor.RandomAddProcessor': 'RandomAddProcessor',
  'blue.noteProcessor.RandomMultiplyProcessor': 'RandomMultiplyProcessor',
  'blue.noteProcessor.LineAddProcessor': 'LineAddProcessor',
  'blue.noteProcessor.LineMultiplyProcessor': 'LineMultiplyProcessor',
  'blue.noteProcessor.PchAddProcessor': 'PchAddProcessor',
  'blue.noteProcessor.PchInversionProcessor': 'PchInversionProcessor',
  'blue.noteProcessor.InversionProcessor': 'InversionProcessor',
  'blue.noteProcessor.RetrogradeProcessor': 'RetrogradeProcessor',
  'blue.noteProcessor.RotateProcessor': 'RotateProcessor',
  'blue.noteProcessor.TimeWarpProcessor': 'TimeWarpProcessor',
  'blue.noteProcessor.TuningProcessor': 'TuningProcessor',
  'blue.noteProcessor.SwitchProcessor': 'SwitchProcessor',
  'blue.noteProcessor.SubListProcessor': 'SubListProcessor',
  'blue.noteProcessor.EqualsProcessor': 'EqualsProcessor',
  'blue.noteProcessor.PythonProcessor': 'PythonProcessor',
};

export function normalizeProcessorType(typeAttr: string): string {
  return FULL_CLASS_NAME_MAP[typeAttr] ?? typeAttr;
}

export class NoteProcessorChain {
  private _processors: NoteProcessor[] = [];

  constructor(other?: NoteProcessorChain) {
    if (other) {
      this._processors = other._processors.map((p) => p.deepCopy());
    }
  }

  getProcessors(): NoteProcessor[] {
    return [...this._processors];
  }

  addProcessor(proc: NoteProcessor): void {
    this._processors.push(proc);
  }

  clear(): void {
    this._processors = [];
  }

  apply(notes: NoteList): NoteList {
    let result = notes;
    for (const proc of this._processors) {
      try {
        result = proc.process(result);
      } catch (e: unknown) {
        if (e instanceof NoteProcessorException) {
          throw e;
        }
        throw new NoteProcessorException(
          `Error in ${proc.getDisplayName()}: ${e instanceof Error ? e.message : String(e)}`,
          -1,
          e as Error,
        );
      }
    }
    return result;
  }

  async applyAsync(notes: NoteList, compileData?: CompileData): Promise<NoteList> {
    let result = notes;
    for (const proc of this._processors) {
      try {
        result = await proc.processAsync(result, compileData);
      } catch (e: unknown) {
        if (e instanceof NoteProcessorException) {
          throw e;
        }
        throw new NoteProcessorException(
          `Error in ${proc.getDisplayName()}: ${e instanceof Error ? e.message : String(e)}`,
          -1,
          e as Error,
        );
      }
    }
    return result;
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessorChain');
    for (const proc of this._processors) {
      const procElem = proc.saveAsXML();
      procElem.setName('noteProcessor');
      elem.addElement(procElem);
    }
    return elem;
  }

  static loadFromXML(data: Element): NoteProcessorChain {
    const chain = new NoteProcessorChain();
    const procNodes = data.getElements('noteProcessor');
    while (procNodes.hasMoreElements()) {
      const node = procNodes.next();
      const type = node.getAttribute('type') ?? '';
      const proc = createProcessorFromXML(type, node);
      if (proc) {
        chain.addProcessor(proc);
      }
    }
    return chain;
  }

  deepCopy(): NoteProcessorChain {
    return new NoteProcessorChain(this);
  }
}

function createProcessorFromXML(type: string, data: Element): NoteProcessor | null {
  const shortName = normalizeProcessorType(type);

  const loader = PROCESSOR_MAP[shortName];
  if (loader) {
    return loader.loadFromXML(data);
  }

  return UnsupportedProcessor.loadFromXML(data, type);
}
