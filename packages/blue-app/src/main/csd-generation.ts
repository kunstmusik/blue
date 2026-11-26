import {
  AudioClip,
  AudioFile,
  BlueData,
  ClojureObject,
  Comment,
  External,
  FrozenSoundObject,
  GenericInstrument,
  GenericScore,
  Instance,
  JavaScriptInstrument,
  JavaScriptObject,
  ObjectBuilder,
  PatternsLayerGroup,
  PianoRoll,
  PolyObject,
  PythonInstrument,
  PythonObject,
  PythonProcessor,
  TimeBehavior,
  TrackLayerGroup,
  TuningProcessor,
  createNoteProcessorChainSnapshot,
  type AudioLayoutManifest,
  type JavaRuntimeClientContract,
  type JavaScriptSession,
  type NoteProcessorChain,
} from '@blue/data';
import { prepareProjectTuningDependencies } from './tuning-scale-dependencies';

export interface ObservationCsdBudget {
  readonly maxDepth: number;
  readonly maxTraversalNodes: number;
  readonly maxInstruments: number;
  readonly maxEstimatedInputBytes: number;
  readonly maxEstimatedScoreEvents: number;
  readonly maxOutputBytes: number;
}

export const DEFAULT_OBSERVATION_CSD_BUDGET: ObservationCsdBudget = {
  maxDepth: 32,
  maxTraversalNodes: 2_000,
  maxInstruments: 256,
  maxEstimatedInputBytes: 512 * 1024,
  maxEstimatedScoreEvents: 20_000,
  maxOutputBytes: 512 * 1024,
};

export type ObservationCsdPreflightResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'EXECUTION_REQUIRED' | 'UNSUPPORTED_CONTENT' | 'RESPONSE_TOO_LARGE';
      readonly message: string;
    };

export type ObservationOnlyDiskCsdResult =
  | {
      readonly ok: true;
      readonly csd: string;
      readonly diagnostics: readonly string[];
    }
  | {
      readonly ok: false;
      readonly code: 'EXECUTION_REQUIRED' | 'UNSUPPORTED_CONTENT' | 'RESPONSE_TOO_LARGE';
      readonly message: string;
    };

function resolveObservationCsdBudget(
  overrides?: Partial<ObservationCsdBudget>,
): ObservationCsdBudget {
  return {
    maxDepth: overrides?.maxDepth ?? DEFAULT_OBSERVATION_CSD_BUDGET.maxDepth,
    maxTraversalNodes:
      overrides?.maxTraversalNodes ?? DEFAULT_OBSERVATION_CSD_BUDGET.maxTraversalNodes,
    maxInstruments: overrides?.maxInstruments ?? DEFAULT_OBSERVATION_CSD_BUDGET.maxInstruments,
    maxEstimatedInputBytes:
      overrides?.maxEstimatedInputBytes ?? DEFAULT_OBSERVATION_CSD_BUDGET.maxEstimatedInputBytes,
    maxEstimatedScoreEvents:
      overrides?.maxEstimatedScoreEvents ?? DEFAULT_OBSERVATION_CSD_BUDGET.maxEstimatedScoreEvents,
    maxOutputBytes: overrides?.maxOutputBytes ?? DEFAULT_OBSERVATION_CSD_BUDGET.maxOutputBytes,
  };
}

function countScoreLines(text: string, maxCap: number): number {
  if (!text) return 0;
  let lines = 1;
  let idx = text.indexOf('\n');
  while (idx >= 0) {
    lines += 1;
    if (lines > maxCap) return lines;
    idx = text.indexOf('\n', idx + 1);
  }
  return lines;
}

/**
 * Verify that generating a disk-profile CSD for `data` requires no on-load
 * hooks, script interpreters, Java runtime, or host filesystem reads, and
 * stays within traversal, depth, and output-expansion budgets before copying.
 */
export function preflightObservationOnlyDiskCsd(
  data: BlueData,
  budgetOverrides?: Partial<ObservationCsdBudget>,
): ObservationCsdPreflightResult {
  const budget = resolveObservationCsdBudget(budgetOverrides);
  const panningEnabled = data.getMixer().isPanningEnabled();
  const scoreContext = data.getScore().getTimeContext();
  let executionReason: string | null = null;
  let unsupportedReason: string | null = null;
  let budgetReason: string | null = null;
  let nodeCount = 0;
  let instrumentCount = 0;
  let estimatedInputBytes = 0;
  let estimatedScoreEvents = 0;

  const recordExecution = (reason: string): void => {
    if (executionReason === null) {
      executionReason = reason;
    }
  };

  const recordUnsupported = (reason: string): void => {
    if (unsupportedReason === null) {
      unsupportedReason = reason;
    }
  };

  const tripBudget = (reason: string): boolean => {
    if (budgetReason === null) {
      budgetReason = reason;
    }
    return true;
  };

  const consumeNodes = (count = 1): boolean => {
    if (budgetReason !== null) return false;
    nodeCount += count;
    if (nodeCount > budget.maxTraversalNodes) {
      tripBudget(
        `Project graph traversal exceeded the ${budget.maxTraversalNodes}-node observation CSD budget.`,
      );
      return false;
    }
    return true;
  };

  const addEstimatedBytes = (bytes: number): boolean => {
    if (budgetReason !== null) return false;
    if (!Number.isFinite(bytes) || bytes > budget.maxEstimatedInputBytes) {
      estimatedInputBytes = budget.maxEstimatedInputBytes + 1;
      tripBudget(
        `Estimated project CSD input exceeds the ${budget.maxEstimatedInputBytes}-byte inspection budget.`,
      );
      return false;
    }
    estimatedInputBytes += bytes;
    if (estimatedInputBytes > budget.maxEstimatedInputBytes) {
      tripBudget(
        `Estimated project CSD input (${estimatedInputBytes} bytes) exceeds the ${budget.maxEstimatedInputBytes}-byte inspection budget.`,
      );
      return false;
    }
    return true;
  };

  const addEstimatedEvents = (events: number): boolean => {
    if (budgetReason !== null) return false;
    if (!Number.isFinite(events) || events > budget.maxEstimatedScoreEvents) {
      estimatedScoreEvents = budget.maxEstimatedScoreEvents + 1;
      tripBudget(
        `Estimated expanded score events exceed the ${budget.maxEstimatedScoreEvents}-event observation CSD budget.`,
      );
      return false;
    }
    estimatedScoreEvents += events;
    if (estimatedScoreEvents > budget.maxEstimatedScoreEvents) {
      tripBudget(
        `Estimated expanded score events (${estimatedScoreEvents}) exceed the ${budget.maxEstimatedScoreEvents}-event observation CSD budget.`,
      );
      return false;
    }
    return true;
  };

  const estimateRepeatFactor = (value: {
    getTimeBehavior?: () => TimeBehavior;
    getSubjectiveDuration?: () => { toBeats: (ctx: typeof scoreContext) => number };
    getRepeatPoint?: () => { toBeats: (ctx: typeof scoreContext) => number } | null;
  }): number => {
    const behavior = value.getTimeBehavior?.();
    if (behavior !== TimeBehavior.REPEAT && behavior !== TimeBehavior.REPEAT_CLASSIC) return 1;
    const duration = value.getSubjectiveDuration?.().toBeats(scoreContext);
    const period = value.getRepeatPoint?.()?.toBeats(scoreContext);
    if (
      duration === undefined ||
      !Number.isFinite(duration) ||
      period === undefined ||
      !Number.isFinite(period) ||
      period <= 0
    ) {
      recordUnsupported(
        'Observation-only CSD generation requires a finite duration and an explicit positive repeat period.',
      );
      return 1;
    }
    // Both generators advance by the period. Allow for floating-point addition and a final window.
    const windows = Math.max(1, Math.ceil(2 * (duration / period)) + 1);
    if (windows > budget.maxEstimatedScoreEvents) {
      addEstimatedEvents(windows);
    }
    return windows;
  };

  const checkInstrument = (instrument: unknown): void => {
    if (budgetReason !== null || !instrument) return;
    instrumentCount += 1;
    if (instrumentCount > budget.maxInstruments) {
      tripBudget(
        `Project instrument count exceeded the ${budget.maxInstruments}-instrument observation CSD budget.`,
      );
      return;
    }
    if (instrument instanceof PythonInstrument) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains a PythonInstrument.',
      );
    } else if (instrument instanceof JavaScriptInstrument) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains a JavaScriptInstrument.',
      );
    } else if (instrument instanceof GenericInstrument) {
      addEstimatedBytes(
        instrument.getText().length +
          instrument.getGlobalOrc().length +
          instrument.getGlobalSco().length,
      );
    } else if (typeof instrument === 'object' && instrument !== null) {
      if ('getText' in instrument && typeof instrument.getText === 'function') {
        const text = instrument.getText();
        if (typeof text === 'string') addEstimatedBytes(text.length);
      }
    }
  };

  const checkNoteProcessorChain = (chain: NoteProcessorChain | null | undefined): void => {
    if (budgetReason !== null || !chain) return;
    if (!consumeNodes()) return;
    for (const processor of chain.getProcessors()) {
      if (!consumeNodes()) return;
      if (processor instanceof PythonProcessor) {
        recordExecution(
          'Observation-only CSD generation refused because a NoteProcessorChain contains a PythonProcessor.',
        );
      } else if (processor instanceof TuningProcessor && processor.getScaleReference()) {
        recordUnsupported(
          'Observation-only CSD generation refused because a TuningProcessor references an external scale file.',
        );
      } else if (processor.constructor?.name === 'UnsupportedProcessor') {
        recordUnsupported(
          'Observation-only CSD generation refused because a NoteProcessorChain contains an unsupported processor.',
        );
      }
    }
    if (createNoteProcessorChainSnapshot(chain).hasUnsupportedProcessors) {
      recordUnsupported(
        'Observation-only CSD generation refused because a NoteProcessorChain contains an unsupported processor.',
      );
    }
  };

  const visitSoundObject = (value: unknown, depth: number, repeatMultiplier: number): void => {
    if (budgetReason !== null || !value || typeof value !== 'object') return;
    if (depth > budget.maxDepth) {
      tripBudget(
        `Score hierarchy depth (${depth}) exceeded the ${budget.maxDepth}-level observation CSD budget.`,
      );
      return;
    }
    if (!consumeNodes()) return;

    if (value instanceof AudioClip) {
      addEstimatedEvents(repeatMultiplier);
      addEstimatedBytes((value.getAudioFile().length + 512) * repeatMultiplier);
      if (panningEnabled) {
        recordUnsupported(
          'Observation-only CSD generation refused because mixer panning is enabled with AudioClips that require host audio header inspection.',
        );
      }
      return;
    }

    if ('getNoteProcessorChain' in value && typeof value.getNoteProcessorChain === 'function') {
      checkNoteProcessorChain(value.getNoteProcessorChain() as NoteProcessorChain);
      if (budgetReason !== null) return;
    }

    if (value instanceof PythonObject) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains a PythonObject.',
      );
    } else if (value instanceof JavaScriptObject) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains a JavaScriptObject.',
      );
    } else if (value instanceof ClojureObject) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains a ClojureObject.',
      );
    } else if (value instanceof External) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains an External sound object.',
      );
    } else if (value instanceof ObjectBuilder) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains an ObjectBuilder sound object.',
      );
    } else if (
      'isOnLoadProcessable' in value &&
      typeof value.isOnLoadProcessable === 'function' &&
      value.isOnLoadProcessable()
    ) {
      recordExecution(
        'Observation-only CSD generation refused because the project contains an on-load processable sound object.',
      );
    }

    const factor = estimateRepeatFactor(value as Parameters<typeof estimateRepeatFactor>[0]);
    const nextMultiplier = Math.min(budget.maxEstimatedScoreEvents + 1, repeatMultiplier * factor);
    if (budgetReason !== null) return;

    if (value instanceof GenericScore) {
      const scoreText = value.getScoreText();
      if (!addEstimatedBytes(scoreText.length * nextMultiplier)) return;
      const lines = countScoreLines(scoreText, budget.maxEstimatedScoreEvents + 1);
      if (!addEstimatedEvents(lines * nextMultiplier)) return;
    } else if (value instanceof PianoRoll) {
      if (!addEstimatedEvents(value.getNoteCount() * nextMultiplier)) return;
      if (!consumeNodes(value.getNoteCount())) return;
      const defaultTemplate = value.getNoteTemplate();
      const tokenSize = Math.max(32, 2 + value.getInstrumentId().length);
      if (!addEstimatedBytes(defaultTemplate.length + tokenSize)) return;
      for (const note of value.getNotes()) {
        const fields = note.getFields();
        if (!consumeNodes(fields.length)) return;
        // A field name containing angle brackets can match across template tokens.
        if (fields.some((field) => /[<>]/.test(field.getFieldDef().getFieldName()))) {
          recordUnsupported(
            'Observation-only CSD generation cannot bound this piano roll template.',
          );
          return;
        }
        const template = note.getNoteTemplate() || defaultTemplate;
        if (!addEstimatedBytes((template.length * tokenSize + 64) * nextMultiplier)) return;
      }
    } else if (value instanceof PolyObject) {
      if (depth + 1 > budget.maxDepth) {
        for (const layer of value) {
          for (const _child of layer) {
            tripBudget(
              `Score hierarchy depth (${depth + 1}) exceeded the ${budget.maxDepth}-level observation CSD budget.`,
            );
            return;
          }
        }
      }
      for (const layer of value) {
        if (!consumeNodes()) return;
        checkNoteProcessorChain(layer.getNoteProcessorChain());
        if (budgetReason !== null) return;
        for (const child of layer) {
          visitSoundObject(child, depth + 1, nextMultiplier);
          if (budgetReason !== null) return;
        }
      }
    } else if (value instanceof Instance) {
      visitSoundObject(value.getSoundObject(), depth + 1, nextMultiplier);
    } else if (value instanceof FrozenSoundObject) {
      addEstimatedEvents(nextMultiplier);
      addEstimatedBytes((value.getFrozenWaveFileName().length + 512) * nextMultiplier);
      visitSoundObject(value.getFrozenSoundObject(), depth + 1, nextMultiplier);
    } else if (value instanceof AudioFile) {
      addEstimatedEvents(nextMultiplier);
      addEstimatedBytes((value.getSoundFileName().length + 512) * nextMultiplier);
    } else if (!(value instanceof Comment)) {
      recordUnsupported(
        `Observation-only CSD generation cannot bound ${value.constructor.name} note generation.`,
      );
    }
  };

  const globalOrcSco = data.getGlobalOrcSco();
  addEstimatedBytes(globalOrcSco.getGlobalOrc().length + globalOrcSco.getGlobalSco().length);
  addEstimatedBytes(data.getTableSet().getTables().length);

  for (const assignment of data.getArrangement().getArrangement()) {
    checkInstrument(assignment.instr);
    if (budgetReason !== null) break;
  }

  const score = data.getScore();
  checkNoteProcessorChain(score.getNoteProcessorChain());
  for (const layerGroup of score) {
    if (budgetReason !== null) break;
    if (layerGroup instanceof PolyObject) {
      visitSoundObject(layerGroup, 0, 1);
    } else if (layerGroup instanceof TrackLayerGroup) {
      if (!consumeNodes()) break;
      checkNoteProcessorChain(layerGroup.getNoteProcessorChain());
      for (const track of layerGroup) {
        if (budgetReason !== null) break;
        if (!consumeNodes()) break;
        checkInstrument(track.getInstrument());
        checkNoteProcessorChain(track.getNoteProcessorChain());
        for (const item of track) {
          visitSoundObject(item, 1, 1);
          if (budgetReason !== null) break;
        }
      }
    } else if (layerGroup instanceof PatternsLayerGroup) {
      if (!consumeNodes()) break;
      checkNoteProcessorChain(layerGroup.getNoteProcessorChain());
      const patternLength = layerGroup.getPatternBeatsLength();
      if (!Number.isFinite(patternLength) || patternLength <= 0) {
        recordUnsupported(
          'Observation-only CSD generation requires a finite, positive pattern length.',
        );
      }
      for (const patternLayer of layerGroup) {
        const steps = patternLayer.getPatternData().getSize();
        if (!consumeNodes(steps + 1)) break;
        visitSoundObject(patternLayer.getSoundObject(), 1, steps + 1);
        if (budgetReason !== null) break;
      }
    }
  }

  for (const libraryObject of data.getSoundObjectLibrary().getAllObjects()) {
    if (budgetReason !== null) break;
    visitSoundObject(libraryObject, 0, 1);
  }

  const liveBins = data.getLiveData().getLiveObjectBins();
  for (let column = 0; column < liveBins.getColumnCount() && budgetReason === null; column++) {
    for (let row = 0; row < liveBins.getRowCount() && budgetReason === null; row++) {
      if (!consumeNodes()) break;
      visitSoundObject(liveBins.getLiveObject(column, row)?.getSoundObject(), 0, 1);
    }
  }

  if (budgetReason !== null) {
    return { ok: false, code: 'RESPONSE_TOO_LARGE', message: budgetReason };
  }
  if (executionReason !== null) {
    return { ok: false, code: 'EXECUTION_REQUIRED', message: executionReason };
  }
  if (unsupportedReason !== null) {
    return { ok: false, code: 'UNSUPPORTED_CONTENT', message: unsupportedReason };
  }
  return { ok: true };
}

/**
 * Generate a disk-profile CSD using detached project state with no script
 * interpreters, Java runtime, or host filesystem reads.
 */
export async function generateObservationOnlyDiskCsd(
  data: BlueData,
  options?: {
    readonly budget?: Partial<ObservationCsdBudget>;
    readonly skipCopy?: boolean;
  },
): Promise<ObservationOnlyDiskCsdResult> {
  const budget = resolveObservationCsdBudget(options?.budget);
  const preflight = preflightObservationOnlyDiskCsd(data, budget);
  if (!preflight.ok) {
    return preflight;
  }

  try {
    const detached = options?.skipCopy ? data : data.historyCopy();
    const csd = detached.toDiskCSD(undefined, null);
    const outputBytes = Buffer.byteLength(csd, 'utf8');
    if (outputBytes > budget.maxOutputBytes) {
      return {
        ok: false,
        code: 'RESPONSE_TOO_LARGE',
        message: `Generated CSD (${outputBytes} bytes) exceeds the ${budget.maxOutputBytes}-byte inspection limit.`,
      };
    }
    return { ok: true, csd, diagnostics: [] };
  } catch (error) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Generate the disk-profile CSD used by Java's "Generate CSD to Screen" action. */
export async function generateDiskCsdForScreen(
  data: Pick<BlueData, 'toDiskCSD' | 'toDiskCSDAsync'>,
  javaScriptSession?: JavaScriptSession,
  javaRuntimeClient?: JavaRuntimeClientContract | null,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<string> {
  const compileData = data instanceof BlueData ? prepareProjectTuningDependencies(data) : data;
  return javaRuntimeClient
    ? compileData.toDiskCSDAsync(javaScriptSession, javaRuntimeClient, layoutManifest)
    : compileData.toDiskCSD(javaScriptSession, layoutManifest);
}

/** Generate the API-backed realtime-profile CSD used by the realtime screen action. */
export async function generateRealtimeCsdForScreen(
  data: Pick<BlueData, 'toCSD' | 'toCSDAsync'>,
  javaScriptSession?: JavaScriptSession,
  javaRuntimeClient?: JavaRuntimeClientContract | null,
  layoutManifest?: AudioLayoutManifest | null,
): Promise<string> {
  const compileData = data instanceof BlueData ? prepareProjectTuningDependencies(data) : data;
  return javaRuntimeClient
    ? compileData.toCSDAsync(javaScriptSession, javaRuntimeClient, layoutManifest)
    : compileData.toCSD(javaScriptSession, layoutManifest);
}
