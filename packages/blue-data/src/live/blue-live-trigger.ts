/**
 * Pure Blue Live Manual Trigger preparation service.
 *
 * This module implements the Java-compatible target selection, isolated-copy
 * preparation, synchronous/asynchronous SoundObject generation, Java-compatible
 * `60 / tempo` note scaling, atomic batch merging, and prepared-score-text
 * conversion. It performs NO engine submission, NO process spawning, NO I/O,
 * and imports no host (Electron/Node) modules — it is reusable by `@blue/data`
 * unit tests and the main-owned trigger controller alike.
 *
 * Java parity reference (see specs/065-blue-live-parity/research.md):
 *   - Selected trigger targets one populated cell regardless of `enabled`.
 *   - Enabled-batch trigger flattens the column-major grid and targets every
 *     enabled cell without row/column exclusivity.
 *   - Both generate from start 0 with no end bound and scale note p2/p3 by
 *     `60 / LiveData.tempo`.
 *
 * Intentional divergences:
 *   - Generate from an isolated copy instead of temporarily mutating the
 *     authored SoundObject TimeBehavior.
 *   - Fail an enabled batch atomically if any member fails.
 *   - Await asynchronous generation when available.
 */
import { BlueData } from '../blue-data';
import { LiveData } from '../live-data';
import { LiveObject } from './live-object';
import { LiveObjectBins } from './live-object-bins';
import { CompileData } from '../compile-data';
import { NoteList } from '../sound-objects/note-list';
import { SoundObject } from '../sound-objects/sound-object';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { setScoreStart } from '../utilities/score';
import { disposeJavaScriptCompileState, setJavaScriptSession } from '../javascript-runtime';
import type { JavaScriptSession } from '../javascript-runtime';
import { setJavaRuntimeClient } from '../java-runtime';
import type { JavaRuntimeClientContract } from '../java-runtime';

/**
 * Discriminated preparation outcome. A successful preparation returns a
 * {@link PreparedScoreBatch}; any failure returns a {@link TriggerPreparationFailure}.
 */
export type TriggerPreparationResult =
  | { kind: 'prepared'; batch: PreparedScoreBatch }
  | { kind: 'failure'; failure: TriggerPreparationFailure }
  | { kind: 'empty'; empty: TriggerEmptyResult };

export interface PreparedScoreBatch {
  /** Stable LiveObject IDs in deterministic column-major target order. */
  targetIds: string[];
  targetCount: number;
  noteCount: number;
  /** Score text; empty only when the generated note count is zero. */
  scoreText: string;
  /** Exactly `60 / tempo`. */
  tempoScale: number;
  /** The tempo used for scaling. */
  tempo: number;
}

export interface TriggerEmptyResult {
  targetIds: string[];
  targetCount: number;
  tempo: number;
  tempoScale: number;
}

export type TriggerPreparationFailureCode =
  | 'invalid-request'
  | 'target-not-found'
  | 'invalid-tempo'
  | 'runtime-unavailable'
  | 'generation-failed';

export interface TriggerPreparationFailure {
  code: TriggerPreparationFailureCode;
  message: string;
  /** Stable ID of the target that failed, when known. */
  targetId?: string;
}

/**
 * Abstract runtime/session injection surface. The main-owned controller
 * supplies concrete Java/JavaScript sessions; pure tests supply fakes. When
 * both are absent, only synchronous generation is attempted.
 */
export interface TriggerRuntimeContext {
  javaScriptSession?: JavaScriptSession;
  javaRuntimeClient?: JavaRuntimeClientContract | null;
}

/**
 * Trigger mode mirroring the renderer request.
 */
export type TriggerMode = 'selected' | 'enabled';

/**
 * Resolve the target LiveObjects from an isolated project copy in Java
 * column-major order.
 *
 * - `selected` mode resolves exactly one LiveObject by stable `uniqueId`,
 *   regardless of its enabled flag. Returns `target-not-found` when the ID is
 *   absent or the cell has no SoundObject.
 * - `enabled` mode flattens the bins column-major and includes every non-null
 *   LiveObject whose `enabled` flag is true. An empty result is benign.
 */
export function resolveTriggerTargets(
  bins: LiveObjectBins,
  mode: TriggerMode,
  liveObjectId?: string,
): { targets: LiveObject[] } | { failure: TriggerPreparationFailure } {
  if (mode === 'selected') {
    if (!liveObjectId || liveObjectId.trim() === '') {
      return {
        failure: { code: 'invalid-request', message: 'Missing liveObjectId for selected trigger' },
      };
    }
    const obj = bins.getLiveObjectByUniqueId(liveObjectId);
    if (!obj) {
      return {
        failure: {
          code: 'target-not-found',
          message: `No LiveObject with id ${liveObjectId}`,
          targetId: liveObjectId,
        },
      };
    }
    if (!obj.getSoundObject()) {
      return {
        failure: {
          code: 'target-not-found',
          message: `LiveObject ${liveObjectId} has no SoundObject`,
          targetId: liveObjectId,
        },
      };
    }
    return { targets: [obj] };
  }

  // enabled mode — column-major traversal
  const targets: LiveObject[] = [];
  for (let c = 0; c < bins.getColumnCount(); c++) {
    for (let r = 0; r < bins.getRowCount(); r++) {
      const obj = bins.getLiveObject(c, r);
      if (obj && obj.isEnabled() && obj.getSoundObject()) {
        targets.push(obj);
      }
    }
  }
  return { targets };
}

/**
 * Prepare a trigger batch from an isolated project copy without mutating
 * canonical data. The caller is responsible for deep-copying the project
 * before calling this function.
 *
 * Returns a `prepared`, `empty`, or `failure` outcome. On failure, no partial
 * batch is returned.
 */
export async function prepareTriggerBatch(
  project: BlueData,
  mode: TriggerMode,
  liveObjectId?: string,
  runtime?: TriggerRuntimeContext,
): Promise<TriggerPreparationResult> {
  const liveData = project.getLiveData();
  const tempo = liveData.getTempo();

  if (!Number.isFinite(tempo) || tempo <= 0) {
    return {
      kind: 'failure',
      failure: { code: 'invalid-tempo', message: `Invalid Blue Live tempo: ${tempo}` },
    };
  }

  const bins = liveData.getLiveObjectBins();
  const resolved = resolveTriggerTargets(bins, mode, liveObjectId);
  if ('failure' in resolved) {
    return { kind: 'failure', failure: resolved.failure };
  }

  const targets = resolved.targets;
  const targetIds = targets.map((t) => t.getUniqueId());

  if (targets.length === 0) {
    return {
      kind: 'empty',
      empty: {
        targetIds,
        targetCount: 0,
        tempo,
        tempoScale: 60 / tempo,
      },
    };
  }

  const context = project.getScore().getTimeContext();
  const tempoScale = 60 / tempo;
  const compileData = createRequestLocalCompileData(project, runtime);

  // Generate each target's notes into one merged NoteList. Generation operates
  // only on the isolated copy: set the copied TimeBehavior to NONE so the
  // generated notes preserve their authored timing, then scale by tempo.
  const merged = new NoteList();

  try {
    for (const target of targets) {
      const soundObject = target.getSoundObject();
      if (!soundObject) {
        return {
          kind: 'failure',
          failure: {
            code: 'target-not-found',
            message: `LiveObject ${target.getUniqueId()} has no SoundObject`,
            targetId: target.getUniqueId(),
          },
        };
      }

      // Override the copied TimeBehavior to NONE so applyTimeBehavior inside
      // generateForCSD does not scale/repeat the notes. We then apply our own
      // tempo scaling afterward.
      const originalTimeBehavior = soundObject.getTimeBehavior();
      soundObject.setTimeBehavior(TimeBehavior.NONE);

      try {
        let notes: NoteList;
        try {
          if (typeof soundObject.generateForCSDAsync === 'function') {
            notes = await soundObject.generateForCSDAsync(context, compileData, 0, -1);
          } else {
            notes = soundObject.generateForCSD(context, compileData, 0, -1);
          }
        } catch (error) {
          return {
            kind: 'failure',
            failure: mapGenerationError(error, target.getUniqueId(), runtime),
          };
        }

        const invalidTiming = findInvalidTiming(notes);
        if (invalidTiming) {
          return {
            kind: 'failure',
            failure: {
              code: 'generation-failed',
              message: `LiveObject ${target.getUniqueId()} generated ${invalidTiming}`,
              targetId: target.getUniqueId(),
            },
          };
        }

        scaleNotesByTempo(notes, tempoScale);
        merged.merge(notes);
      } finally {
        // Restore the copied object's authored TimeBehavior on the isolated copy.
        soundObject.setTimeBehavior(originalTimeBehavior);
      }
    }
  } finally {
    disposeJavaScriptCompileState(compileData);
  }

  const scoreText = merged.toScoreText();
  const noteCount = merged.length;

  if (noteCount === 0) {
    return {
      kind: 'empty',
      empty: {
        targetIds,
        targetCount: targets.length,
        tempo,
        tempoScale,
      },
    };
  }

  return {
    kind: 'prepared',
    batch: {
      targetIds,
      targetCount: targets.length,
      noteCount,
      scoreText,
      tempoScale,
      tempo,
    },
  };
}

/**
 * Scale every note's start time (p2) and duration (p3) by the tempo factor
 * `60 / tempo`, matching Java Blue Live behavior. Other p-fields are
 * preserved.
 */
export function scaleNotesByTempo(notes: NoteList, tempoScale: number): void {
  for (const note of notes) {
    const startTime = note.getStartTime();
    const duration = note.getObjectiveDuration();
    note.setStartTime(startTime * tempoScale);
    note.setSubjectiveDuration(duration * tempoScale);
  }
}

function findInvalidTiming(notes: NoteList): string | null {
  for (const note of notes) {
    if (!Number.isFinite(note.getStartTime())) {
      return 'a non-finite start time';
    }
    if (!Number.isFinite(note.getObjectiveDuration())) {
      return 'a non-finite duration';
    }
  }
  return null;
}

/**
 * Create a request-local CompileData seeded with the project's arrangement and
 * tables plus any injected runtime sessions. A fresh CompileData per request
 * avoids cross-request state leakage.
 */
function createRequestLocalCompileData(
  project: BlueData,
  runtime?: TriggerRuntimeContext,
): CompileData {
  const compileData = new CompileData(project.getArrangement(), project.getTableSet(), false);
  if (runtime?.javaScriptSession) {
    // The data-layer helpers look up the session from the CompileData.
    setJavaScriptSession(compileData, runtime.javaScriptSession);
  }
  if (runtime?.javaRuntimeClient) {
    setJavaRuntimeClient(compileData, runtime.javaRuntimeClient);
  }
  return compileData;
}

function mapGenerationError(
  error: unknown,
  targetId: string,
  runtime?: TriggerRuntimeContext,
): TriggerPreparationFailure {
  const message = error instanceof Error ? error.message : String(error);
  // If the runtime client is absent and the object requires it, the error is
  // an availability issue rather than a generation defect.
  if (!runtime?.javaRuntimeClient && !runtime?.javaScriptSession) {
    if (/runtime|unavailable|not initialized|quickjs/i.test(message)) {
      return {
        code: 'runtime-unavailable',
        message,
        targetId,
      };
    }
  }
  return {
    code: 'generation-failed',
    message,
    targetId,
  };
}

/**
 * Convenience helper exposing the Java-compatible `60 / tempo` tempo scale for
 * diagnostic display and test oracles.
 */
export function computeTempoScale(tempo: number): number {
  return 60 / tempo;
}

// Re-export helpers used by the controller/tests.
export { setScoreStart };
export type { LiveData, LiveObject, SoundObject };
export { TimePosition, TimeDuration };
