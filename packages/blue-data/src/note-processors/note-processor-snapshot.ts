import { NoteProcessor } from './note-processor';
import { NoteProcessorChain } from './note-processor-chain';
import { UnsupportedProcessor } from './unsupported-processor';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { canonicalSeed, validateMapping } from './xml-policy';
import { parseXmlBoolean, parseXmlInteger, parseXmlNumber } from '../utilities/xml';
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

/** Serializable editor representation of one processor and its capability status. */
export interface NoteProcessorEntrySnapshot {
  /** Editor identifier of this processor occurrence. */
  id: string;
  /** Registered processor type identifier. */
  processorType: string;
  /** Human-readable display label. */
  displayName: string;
  /** Indicates whether the processor type has a supported implementation. */
  supported: boolean;
  /** Indicates whether runtime support for the processor is deferred. */
  deferred: boolean;
  /** Human-readable summary suitable for displaying the processor in an editor. */
  summary: string;
  /** Values available to the note processor editor. */
  parameters: Record<string, string | number | boolean>;
  /** Serialized XML used to reconstitute the processor. */
  serializedXml: string;
}

/** Serializable processor chain with aggregate capability flags. */
export interface NoteProcessorChainSnapshot {
  /** Processors in execution order. */
  processors: NoteProcessorEntrySnapshot[];
  /** Whether any entry has an unsupported processor type. */
  hasUnsupportedProcessors: boolean;
  /** Whether any entry uses a deferred implementation. */
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
/** Resets the generated ID counter used by note-processor snapshots. */
export function resetSnapshotIdCounter(): void {
  _nextId = 1;
}

function generateId(): string {
  return `np-${_nextId++}`;
}

/** Captures one processor's editor fields and serializable state. */
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
    serializedXml: proc.saveAsXML().toXml(),
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

/** Captures the ordered editor representation of a processor chain. */
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

/** Reconstructs a configured processor from the supplied snapshot. */
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

  const def = getNoteProcessorDefinition(entry.processorType);
  if (!def) throw new RangeError('Unsupported processor snapshot type: ' + entry.processorType);
  let proc: NoteProcessor;
  if (entry.serializedXml) {
    const wrapper = new Element('noteProcessorChain');
    wrapper.addElement(Element.parse(entry.serializedXml));
    proc = NoteProcessorChain.loadFromXML(wrapper).getProcessors()[0];
  } else {
    proc = def.createDefault();
  }
  applyParametersToProcessor(proc, entry.parameters);
  return proc;
}

/** Reconstructs the ordered list of processors represented by the snapshot. */
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

function parseSnapshotBoolean(value: string | number | boolean, context: XmlLoadContext): boolean {
  return typeof value === 'string' ? parseXmlBoolean(value, context) : Boolean(value);
}

function applyParametersToProcessor(
  proc: NoteProcessor,
  params: Record<string, string | number | boolean>,
): void {
  const ctx = new XmlLoadContext(new Element('noteProcessor'));
  if (proc instanceof AddProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.val !== undefined) {
      const val = String(params.val);
      parseXmlNumber(val, ctx);
      proc.setVal(val);
    }
  } else if (proc instanceof PchAddProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.val !== undefined) {
      const val = String(params.val);
      parseXmlInteger(val, ctx, -2147483648, 2147483647);
      proc.setVal(val);
    }
  } else if (proc instanceof MultiplyProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.val !== undefined) {
      const val = String(params.val);
      parseXmlNumber(val, ctx);
      proc.setVal(val);
    }
  } else if (proc instanceof RandomAddProcessor || proc instanceof RandomMultiplyProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.min !== undefined) {
      const min = String(params.min);
      parseXmlNumber(min, ctx);
      proc.setMin(min);
    }
    if (params.max !== undefined) {
      const max = String(params.max);
      parseXmlNumber(max, ctx);
      proc.setMax(max);
    }
    if (Number(proc.getMin()) > Number(proc.getMax())) {
      throw ctx.error({
        code: 'value',
        message: 'Random processor minimum exceeds maximum.',
        recovery: 'Correct the bounds.',
      });
    }
    if (params.seedUsed !== undefined) proc.setSeedUsed(parseSnapshotBoolean(params.seedUsed, ctx));
    if (params.seed !== undefined) proc.setSeed(canonicalSeed(String(params.seed)));
  } else if (proc instanceof SubListProcessor) {
    if (params.start !== undefined) {
      const start = String(params.start);
      parseXmlInteger(start, ctx, -2147483648, 2147483647);
      proc.setStart(start);
    }
    if (params.end !== undefined) {
      const end = String(params.end);
      parseXmlInteger(end, ctx, 1, 2147483647);
      proc.setEnd(end);
    }
  } else if (proc instanceof RotateProcessor) {
    if (params.noteIndex !== undefined) {
      const noteIndex = String(params.noteIndex);
      parseXmlInteger(noteIndex, ctx, -2147483648, 2147483647);
      proc.setNoteIndex(noteIndex);
    }
  } else if (proc instanceof InversionProcessor || proc instanceof PchInversionProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.val !== undefined) {
      const val = String(params.val);
      parseXmlNumber(val, ctx);
      proc.setVal(val);
    }
  } else if (proc instanceof EqualsProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.val !== undefined) proc.setVal(String(params.val));
  } else if (proc instanceof SwitchProcessor) {
    if (params.pfield1 !== undefined) {
      const pfield1 = String(params.pfield1);
      parseXmlInteger(pfield1, ctx, 1, 2147483647);
      proc.setPfield1(pfield1);
    }
    if (params.pfield2 !== undefined) {
      const pfield2 = String(params.pfield2);
      parseXmlInteger(pfield2, ctx, 1, 2147483647);
      proc.setPfield2(pfield2);
    }
  } else if (proc instanceof TimeWarpProcessor) {
    if (params.timeWarpString !== undefined) {
      const timeWarpString = String(params.timeWarpString);
      validateMapping(timeWarpString, ctx, true);
      proc.setTimeWarpString(timeWarpString);
    }
  } else if (proc instanceof LineAddProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.lineAddString !== undefined) {
      const lineAddString = String(params.lineAddString);
      validateMapping(lineAddString, ctx, false);
      proc.setLineAddString(lineAddString);
    }
  } else if (proc instanceof LineMultiplyProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 1, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.lineMultiplyString !== undefined) {
      const lineMultiplyString = String(params.lineMultiplyString);
      validateMapping(lineMultiplyString, ctx, false);
      proc.setLineMultiplyString(lineMultiplyString);
    }
  } else if (proc instanceof TuningProcessor) {
    if (params.pfield !== undefined) {
      const pfield = String(params.pfield);
      parseXmlInteger(pfield, ctx, 4, 2147483647);
      proc.setPfield(pfield);
    }
    if (params.baseFrequency !== undefined) {
      const baseFrequency = String(params.baseFrequency);
      parseXmlNumber(baseFrequency, ctx);
      proc.setBaseFrequency(baseFrequency);
    }
    if (params.ratios !== undefined) {
      const tokens = String(params.ratios)
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0);
      if (tokens.length > 0) {
        const ratios = tokens.map((token) => {
          const value = parseXmlNumber(token, ctx);
          if (value <= 0) {
            throw ctx.error({
              code: 'value',
              value: token,
              message: 'Scale values must be positive.',
              recovery: 'Supply a positive finite value.',
            });
          }
          return value;
        });
        proc.setRatios(ratios);
      }
    }
  } else if (proc instanceof PythonProcessor) {
    if (params.code !== undefined) proc.setCode(String(params.code));
  }
}
