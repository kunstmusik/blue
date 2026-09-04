import { NoteProcessor } from './note-processor';
import { NoteProcessorChain } from './note-processor-chain';
import { UnsupportedProcessor } from './unsupported-processor';
import { Element } from '../serialization/xml-reader';
import { getNoteProcessorDefinition } from './note-processor-catalog';
import { AddProcessor } from './add-processor';
import { MultiplyProcessor } from './multiply-processor';
import { RandomAddProcessor } from './random-add-processor';
import { RandomMultiplyProcessor } from './random-multiply-processor';
import { SubListProcessor } from './sublist-processor';
import { RotateProcessor } from './rotate-processor';
import { RetrogradeProcessor } from './retrograde-processor';
import { InversionProcessor } from './inversion-processor';
import { PchAddProcessor } from './pch-add-processor';
import { PchInversionProcessor } from './pch-inversion-processor';
import { EqualsProcessor } from './equals-processor';
import { SwitchProcessor } from './switch-processor';
import { TimeWarpProcessor } from './time-warp-processor';
import { LineAddProcessor } from './line-add-processor';
import { LineMultiplyProcessor } from './line-multiply-processor';
import { TuningProcessor } from './tuning-processor';
import { PythonProcessor } from './python-processor';

export interface NoteProcessorEntrySnapshot {
  id: string;
  processorType: string;
  displayName: string;
  supported: boolean;
  deferred: boolean;
  summary: string;
  parameters: Record<string, string | number | boolean>;
  serializedXml: string;
}

export interface NoteProcessorChainSnapshot {
  processors: NoteProcessorEntrySnapshot[];
  hasUnsupportedProcessors: boolean;
  hasDeferredProcessors: boolean;
}

const PYTHON_PROCESSOR_TYPES: ReadonlySet<string> = new Set([
  'PythonProcessor',
  'blue.noteProcessor.PythonProcessor',
]);

function isPythonProcessorType(type: string): boolean {
  return PYTHON_PROCESSOR_TYPES.has(type);
}

function getProcessorParameters(proc: NoteProcessor): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};

  if (proc instanceof AddProcessor) {
    params.pfield = proc.getPfield();
    params.val = proc.getVal();
  } else if (proc instanceof PchAddProcessor) {
    params.pfield = proc.getPfield();
    params.val = proc.getVal();
  } else if (proc instanceof MultiplyProcessor) {
    params.pfield = proc.getPfield();
    params.val = proc.getVal();
  } else if (proc instanceof RandomAddProcessor) {
    params.pfield = proc.getPfield();
    params.min = proc.getMin();
    params.max = proc.getMax();
    params.seedUsed = proc.isSeedUsed();
    params.seed = proc.getSeed();
  } else if (proc instanceof RandomMultiplyProcessor) {
    params.pfield = proc.getPfield();
    params.min = proc.getMin();
    params.max = proc.getMax();
    params.seedUsed = proc.isSeedUsed();
    params.seed = proc.getSeed();
  } else if (proc instanceof SubListProcessor) {
    params.start = proc.getStart();
    params.end = proc.getEnd();
  } else if (proc instanceof RotateProcessor) {
    params.noteIndex = proc.getNoteIndex();
  } else if (proc instanceof RetrogradeProcessor) {
    // no parameters
  } else if (proc instanceof InversionProcessor) {
    params.pfield = proc.getPfield();
    params.val = proc.getVal();
  } else if (proc instanceof PchInversionProcessor) {
    params.pfield = proc.getPfield();
    params.val = proc.getVal();
  } else if (proc instanceof EqualsProcessor) {
    params.pfield = proc.getPfield();
    params.val = proc.getVal();
  } else if (proc instanceof SwitchProcessor) {
    params.pfield1 = proc.getPfield1();
    params.pfield2 = proc.getPfield2();
  } else if (proc instanceof TimeWarpProcessor) {
    params.timeWarpString = proc.getTimeWarpString();
  } else if (proc instanceof LineAddProcessor) {
    params.pfield = proc.getPfield();
    params.lineAddString = proc.getLineAddString();
  } else if (proc instanceof LineMultiplyProcessor) {
    params.pfield = proc.getPfield();
    params.lineMultiplyString = proc.getLineMultiplyString();
  } else if (proc instanceof TuningProcessor) {
    params.pfield = proc.getPfield();
    params.baseFrequency = proc.getBaseFrequency();
    params.ratios = proc
      .getRatios()
      .map((ratio) => ratio.toString())
      .join('\n');
  } else if (proc instanceof PythonProcessor) {
    params.code = proc.getCode();
  }

  return params;
}

let _nextId = 1;
export function resetSnapshotIdCounter(): void {
  _nextId = 1;
}

function generateId(): string {
  return `np-${_nextId++}`;
}

export function createNoteProcessorEntrySnapshot(proc: NoteProcessor): NoteProcessorEntrySnapshot {
  if (proc instanceof UnsupportedProcessor) {
    const originalType = proc.getOriginalType();
    const xmlStr = proc.saveAsXML().toXml();
    return {
      id: generateId(),
      processorType: originalType,
      displayName: `[unsupported: ${originalType}]`,
      supported: false,
      deferred: false,
      summary: `[unsupported: ${originalType}]`,
      parameters: {},
      serializedXml: xmlStr,
    };
  }

  const typeName = proc.constructor.name;
  const params = getProcessorParameters(proc);

  return {
    id: generateId(),
    processorType: typeName,
    displayName: proc.getDisplayName(),
    supported: true,
    deferred: false,
    summary: buildSummary(proc, params),
    parameters: params,
    serializedXml: '',
  };
}

function buildSummary(
  proc: NoteProcessor,
  params: Record<string, string | number | boolean>,
): string {
  if (proc instanceof PythonProcessor) {
    return proc.getDisplayName();
  }

  const entries = Object.entries(params);
  if (entries.length === 0) return proc.getDisplayName();
  const parts = entries.map(([k, v]) => {
    if (k === 'ratios') {
      const count = String(v)
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0).length;
      return `ratios=${count} values`;
    }
    return `${k}=${v}`;
  });
  return `${proc.getDisplayName()} (${parts.join(', ')})`;
}

export function createNoteProcessorChainSnapshot(
  chain: NoteProcessorChain,
): NoteProcessorChainSnapshot {
  let hasUnsupported = false;
  let hasDeferred = false;
  const processors: NoteProcessorEntrySnapshot[] = [];

  for (const proc of chain.getProcessors()) {
    const entry = createNoteProcessorEntrySnapshot(proc);
    if (!entry.supported) hasUnsupported = true;
    if (entry.deferred) hasDeferred = true;
    processors.push(entry);
  }

  return {
    processors,
    hasUnsupportedProcessors: hasUnsupported,
    hasDeferredProcessors: hasDeferred,
  };
}

export function reifyProcessorFromSnapshot(
  entry: NoteProcessorEntrySnapshot,
): NoteProcessor | null {
  if (isPythonProcessorType(entry.processorType)) {
    if (entry.serializedXml) {
      try {
        return PythonProcessor.loadFromXML(Element.parse(entry.serializedXml));
      } catch {
        return null;
      }
    }

    const processor = new PythonProcessor();
    if (entry.parameters.code !== undefined) {
      processor.setCode(String(entry.parameters.code));
    }
    return processor;
  }

  if (!entry.supported) {
    if (entry.serializedXml) {
      try {
        const elem = Element.parse(entry.serializedXml);
        const type = elem.getAttribute('type') ?? entry.processorType;
        return UnsupportedProcessor.loadFromXML(elem, type);
      } catch {
        return null;
      }
    }
    return null;
  }

  const def = getNoteProcessorDefinition(entry.processorType);
  if (!def) return null;

  const proc = def.createDefault();
  applyParametersToProcessor(proc, entry.parameters);
  return proc;
}

export function reifyChainFromSnapshot(snapshot: NoteProcessorChainSnapshot): NoteProcessorChain {
  const chain = new NoteProcessorChain();
  for (const entry of snapshot.processors) {
    const proc = reifyProcessorFromSnapshot(entry);
    if (proc) {
      chain.addProcessor(proc);
    }
  }
  return chain;
}

function applyParametersToProcessor(
  proc: NoteProcessor,
  params: Record<string, string | number | boolean>,
): void {
  if (proc instanceof AddProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.val !== undefined) proc.setVal(String(params.val));
  } else if (proc instanceof PchAddProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.val !== undefined) proc.setVal(String(params.val));
  } else if (proc instanceof MultiplyProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.val !== undefined) proc.setVal(String(params.val));
  } else if (proc instanceof RandomAddProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.min !== undefined) proc.setMin(String(params.min));
    if (params.max !== undefined) proc.setMax(String(params.max));
    if (params.seedUsed !== undefined) proc.setSeedUsed(Boolean(params.seedUsed));
    if (params.seed !== undefined) proc.setSeed(String(params.seed));
  } else if (proc instanceof RandomMultiplyProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.min !== undefined) proc.setMin(String(params.min));
    if (params.max !== undefined) proc.setMax(String(params.max));
    if (params.seedUsed !== undefined) proc.setSeedUsed(Boolean(params.seedUsed));
    if (params.seed !== undefined) proc.setSeed(String(params.seed));
  } else if (proc instanceof SubListProcessor) {
    if (params.start !== undefined) proc.setStart(String(params.start));
    if (params.end !== undefined) proc.setEnd(String(params.end));
  } else if (proc instanceof RotateProcessor) {
    if (params.noteIndex !== undefined) proc.setNoteIndex(String(params.noteIndex));
  } else if (proc instanceof InversionProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.val !== undefined) proc.setVal(String(params.val));
  } else if (proc instanceof PchInversionProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.val !== undefined) proc.setVal(String(params.val));
  } else if (proc instanceof EqualsProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.val !== undefined) proc.setVal(String(params.val));
  } else if (proc instanceof SwitchProcessor) {
    if (params.pfield1 !== undefined) proc.setPfield1(String(params.pfield1));
    if (params.pfield2 !== undefined) proc.setPfield2(String(params.pfield2));
  } else if (proc instanceof TimeWarpProcessor) {
    if (params.timeWarpString !== undefined) proc.setTimeWarpString(String(params.timeWarpString));
  } else if (proc instanceof LineAddProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.lineAddString !== undefined) proc.setLineAddString(String(params.lineAddString));
  } else if (proc instanceof LineMultiplyProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.lineMultiplyString !== undefined)
      proc.setLineMultiplyString(String(params.lineMultiplyString));
  } else if (proc instanceof TuningProcessor) {
    if (params.pfield !== undefined) proc.setPfield(String(params.pfield));
    if (params.baseFrequency !== undefined) proc.setBaseFrequency(String(params.baseFrequency));
    if (params.ratios !== undefined) {
      const ratios = String(params.ratios)
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .map((token) => parseFloat(token));
      if (ratios.length > 0 && ratios.every((ratio) => Number.isFinite(ratio))) {
        proc.setRatios(ratios);
      }
    }
  } else if (proc instanceof PythonProcessor) {
    if (params.code !== undefined) proc.setCode(String(params.code));
  }
}
