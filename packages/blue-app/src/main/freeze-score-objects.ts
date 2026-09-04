/**
 * Freeze/Unfreeze ScoreObjects — main-process orchestration.
 *
 * Mirrors Java FreezeUnfreezeAction:
 *   - Freeze: render source object to project-local freezeN.wav/aif, replace with FrozenSoundObject
 *   - Unfreeze: restore nested source, reference-count cleanup of freeze file
 *
 * Uses Utility freeze flags, not a caller-selected Csound executable.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  BlueData,
  FrozenSoundObject,
  PolyObject,
  type SoundObject,
  parseAudioFileMetadata,
  buildFreezeRenderData,
  beatsToDuration,
  type Score,
  type JavaRuntimeClientContract,
  type JavaScriptSession,
} from '@blue/data';

import type { ScoreObjectEditorTargetSnapshot } from '../shared/project-editor';
import { resolveTimelineTarget } from '../shared/project-editor';
import type { UtilitySettingsSnapshot } from '../shared/program-settings';
import type {
  FreezeItemStatus,
  FreezeOperationResult,
  FreezeRejectedTarget,
  RenderOperationStatus,
} from '../shared/render-freeze-contract';
import { planFreezeCommand } from './disk-render-command';
import { writeTempCsdSnapshot, cleanupTempCsdSnapshots } from './render-command';
import { generateDiskCsd } from './render-to-disk';

// ─── Types ───

export interface FreezeContext {
  data: BlueData;
  projectDirectory: string;
  utility: UtilitySettingsSnapshot;
  platform: string;
  /** True after the operation has been cancelled by its main-process owner. */
  isCancelled?: () => boolean;
  /**
   * SPEC 085: called when a systemic failure dooms the operation so the
   * owner can abort every in-flight render immediately (the shared
   * operation AbortController in the main process). Distinct from user
   * cancellation: `isCancelled` must stay false.
   */
  abortInFlight?: () => void;
  javaScriptSession?: JavaScriptSession;
  javaRuntimeClient?: JavaRuntimeClientContract | null;
}

/**
 * Engine-runtime error codes for failures of the shared command or
 * environment that no freeze job can survive (SPEC 085, FR-007a).
 */
const SYSTEMIC_FREEZE_ERROR_CODES: ReadonlySet<string> = new Set([
  'CSOUND_UNAVAILABLE',
  'ENGINE_CAPABILITY_MISSING',
  'CSOUND_EXECUTION_INVALID_CWD',
  'CSOUND_PROCESS_FAILED',
]);

/** A failure of the shared render environment, not of one object. */
class SystemicFreezeError extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode: string) {
    super(message);
    this.name = 'SystemicFreezeError';
    this.errorCode = errorCode;
  }
}

export type StatusCallback = (status: RenderOperationStatus) => void;

/** Per-object progress sink for freeze/unfreeze item events. */
export type FreezeItemEventCallback = (event: FreezeItemStatus) => void;

export interface FreezeExecutionSeam {
  /**
   * Run Csound with the given args in the project directory. Returns exit code.
   * The optional per-call onOutput receives streamed subprocess output in
   * addition to any seam-level output sink.
   */
  runCsound(
    args: string[],
    cwd: string,
    onProgress?: (progress: number) => void,
    totalDuration?: number,
    onOutput?: (text: string, type: 'stdout' | 'stderr') => void,
  ): Promise<{
    exitCode: number;
    stderr: string;
    stdout?: string;
    cancelled?: boolean;
    errorCode?: string | null;
  }>;
}

// ─── Filename Allocation ───

/**
 * Java-compatible freeze filename allocation.
 *
 * Inspects existing project-directory entries beginning with "freeze",
 * derives the next counter from the highest parseable numeric suffix,
 * starts at zero when none exists, and advances on collision.
 *
 * macOS uses `.aif`; other platforms use `.wav`.
 *
 * `reservedNames` carries names already allocated earlier in the same
 * operation whose artifacts are not on disk yet; candidates inside it are
 * skipped so a sequentially-prepared parallel batch can never target the
 * same file (SPEC 085, FR-006).
 */
export function allocateFreezeFileName(
  projectDirectory: string,
  platform: string,
  reservedNames?: ReadonlySet<string>,
): string {
  const extension = platform === 'darwin' ? '.aif' : '.wav';
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(projectDirectory);
  } catch {
    // Directory might not exist or not be readable
  }

  let maxCounter = -1;

  for (const entry of entries) {
    if (!entry.startsWith('freeze')) continue;

    const afterPrefix = entry.substring(6);
    const dotIdx = afterPrefix.indexOf('.');
    if (dotIdx <= 0) continue;

    const numStr = afterPrefix.substring(0, dotIdx);
    if (!/^\d+$/.test(numStr)) continue;
    const num = Number(numStr);
    if (!Number.isSafeInteger(num) || num < 0) continue;

    if (num > maxCounter) {
      maxCounter = num;
    }
  }

  let counter = maxCounter + 1;
  let candidate = `freeze${counter}${extension}`;

  // Advance on collision (Java-compatible behavior), including names
  // reserved within the current batch.
  while (true) {
    if (reservedNames?.has(candidate)) {
      counter++;
      candidate = `freeze${counter}${extension}`;
      continue;
    }
    try {
      fs.accessSync(path.join(projectDirectory, candidate));
      counter++;
      candidate = `freeze${counter}${extension}`;
    } catch {
      break;
    }
  }

  return candidate;
}

// ─── Reference Counting ───

/**
 * Recursively count all FrozenSoundObjects in the score that reference
 * the given filename. Walks nested PolyObjects.
 */
export function countFreezeReferences(score: Score, fileName: string): number {
  let count = 0;

  function walkLayerGroup(lg: unknown): void {
    if (lg instanceof PolyObject) {
      for (const layer of lg) {
        for (const sObj of layer) {
          if (sObj instanceof FrozenSoundObject && sObj.getFrozenWaveFileName() === fileName) {
            count++;
          }
          if (sObj instanceof PolyObject) {
            walkLayerGroup(sObj);
          }
        }
      }
    }
  }

  for (const lg of score) {
    walkLayerGroup(lg);
  }

  return count;
}

// ─── Eligibility ───

/**
 * Check if a sound object is eligible for freezing.
 * FrozenSoundObjects themselves are unfrozen, not frozen again.
 * AudioClips are score layer clips, not SoundObjects.
 */
export function isFreezeEligible(sObj: unknown): boolean {
  if (!sObj || sObj instanceof FrozenSoundObject) return false;
  return typeof (sObj as { generateForCSD?: unknown }).generateForCSD === 'function';
}

/** Freeze artifacts are generated directly in the project directory. */
export function resolveFreezeArtifactPath(
  projectDirectory: string,
  fileName: string,
): string | null {
  if (!fileName || path.isAbsolute(fileName) || path.basename(fileName) !== fileName) {
    return null;
  }

  const projectRoot = path.resolve(projectDirectory);
  const artifactPath = path.resolve(projectRoot, fileName);
  return artifactPath.startsWith(`${projectRoot}${path.sep}`) ? artifactPath : null;
}

// ─── Freeze / Unfreeze ───

/**
 * Resolve targets against the canonical project and determine freeze/unfreeze actions.
 */
export function resolveFreezeTargets(
  data: BlueData,
  targets: ScoreObjectEditorTargetSnapshot[],
): {
  resolved: Array<{
    target: ScoreObjectEditorTargetSnapshot;
    sObj: SoundObject;
    isFrozen: boolean;
  }>;
  rejected: FreezeRejectedTarget[];
} {
  const resolved: Array<{
    target: ScoreObjectEditorTargetSnapshot;
    sObj: SoundObject;
    isFrozen: boolean;
  }> = [];
  const rejected: FreezeRejectedTarget[] = [];

  for (const target of targets) {
    if (target.ownerKind !== 'timeline' || !target.location) {
      rejected.push({
        selectionId: target.selectionId,
        reason: 'Freeze requires a timeline-owned object with a valid location.',
      });
      continue;
    }

    const result = resolveTimelineTarget(data.getScore(), target.location);
    if (!result) {
      rejected.push({
        selectionId: target.selectionId,
        reason: 'Could not resolve the selected object in the canonical project.',
      });
      continue;
    }

    if (!(result.sObj instanceof FrozenSoundObject) && !isFreezeEligible(result.sObj)) {
      rejected.push({
        selectionId: target.selectionId,
        reason: 'This object type is not supported for freeze/unfreeze.',
      });
      continue;
    }

    resolved.push({
      target,
      sObj: result.sObj as SoundObject,
      isFrozen: result.sObj instanceof FrozenSoundObject,
    });
  }

  return { resolved, rejected };
}

/**
 * Execute freeze/unfreeze for the given targets.
 *
 * This function performs the canonical mutation on `context.data`.
 * Returns the operation result with counts and rejected targets.
 */
export async function executeFreezeUnfreeze(
  context: FreezeContext,
  targets: ScoreObjectEditorTargetSnapshot[],
  operationId: string,
  statusCallback: StatusCallback,
  executionSeam: FreezeExecutionSeam,
  itemEventCallback?: FreezeItemEventCallback,
): Promise<FreezeOperationResult> {
  const { data, projectDirectory, isCancelled } = context;

  const emitItemEvent = (
    selectionId: string,
    name: string,
    action: 'freeze' | 'unfreeze',
    phase: 'pending' | 'running' | 'rendered' | 'complete' | 'failed',
    options: Partial<
      Pick<FreezeItemStatus, 'freezeFile' | 'reason' | 'outputAppend' | 'outputType'>
    > = {},
  ): void => {
    itemEventCallback?.({
      operationId,
      selectionId,
      name,
      action,
      phase,
      freezeFile: options.freezeFile ?? null,
      reason: options.reason ?? null,
      outputAppend: options.outputAppend ?? null,
      outputType: options.outputType ?? null,
    });
  };

  type StagedReplacement = {
    item: { target: ScoreObjectEditorTargetSnapshot; sObj: SoundObject; isFrozen: boolean };
    replacement: SoundObject;
    generatedArtifactPath?: string;
    unfreezeArtifact?: { fileName: string; path: string };
  };

  const result = (
    ok: boolean,
    rejectedTargets: FreezeRejectedTarget[],
    options: Partial<
      Pick<
        FreezeOperationResult,
        'cancelled' | 'frozenCount' | 'unfrozenCount' | 'deletedFiles' | 'error'
      >
    > = {},
  ): FreezeOperationResult => ({
    ok,
    operationId,
    cancelled: options.cancelled ?? false,
    frozenCount: options.frozenCount ?? 0,
    unfrozenCount: options.unfrozenCount ?? 0,
    deletedFiles: options.deletedFiles ?? [],
    rejectedTargets,
    error: options.error ?? null,
    project: null,
  });

  const reportCancelled = (): FreezeOperationResult => {
    statusCallback({
      operationId,
      kind: 'freeze',
      phase: 'cancelled',
      message: 'Freeze operation cancelled.',
      progress: null,
      outputPath: null,
      error: null,
    });
    return result(false, [], { cancelled: true });
  };

  const reportFailure = (
    message: string,
    rejectedTargets: FreezeRejectedTarget[],
  ): FreezeOperationResult => {
    statusCallback({
      operationId,
      kind: 'freeze',
      phase: 'failed',
      message,
      progress: null,
      outputPath: null,
      error: message,
    });
    return result(false, rejectedTargets, { error: message });
  };

  statusCallback({
    operationId,
    kind: 'freeze',
    phase: 'preparing',
    message: 'Resolving selected objects...',
    progress: 0,
    outputPath: null,
    error: null,
  });

  const { resolved, rejected } = resolveFreezeTargets(data, targets);

  for (const item of resolved) {
    emitItemEvent(
      item.target.selectionId,
      item.sObj.getName(),
      item.isFrozen ? 'unfreeze' : 'freeze',
      'pending',
      {
        freezeFile: item.isFrozen ? (item.sObj as FrozenSoundObject).getFrozenWaveFileName() : null,
      },
    );
  }
  for (const rejectedTarget of rejected) {
    emitItemEvent(rejectedTarget.selectionId, '', 'freeze', 'failed', {
      reason: rejectedTarget.reason,
    });
  }

  if (isCancelled?.()) return reportCancelled();
  if (resolved.length === 0 || rejected.length > 0) {
    return reportFailure(
      rejected.length > 0
        ? 'One or more selected objects cannot be freeze/unfrozen.'
        : 'No eligible objects selected.',
      rejected.length > 0
        ? rejected
        : [{ selectionId: '*', reason: 'No eligible objects selected.' }],
    );
  }

  const staged: StagedReplacement[] = [];
  const removeGeneratedArtifacts = (): void => {
    for (const replacement of staged) {
      if (replacement.generatedArtifactPath)
        fs.rmSync(replacement.generatedArtifactPath, { force: true });
    }
  };
  try {
    // Unfreeze targets stage without rendering and never occupy render slots.
    for (const item of resolved) {
      if (!item.isFrozen) continue;
      const frozen = item.sObj as FrozenSoundObject;
      const nested = frozen.getFrozenSoundObject();
      const fileName = frozen.getFrozenWaveFileName();
      const artifactPath = resolveFreezeArtifactPath(projectDirectory, fileName);
      emitItemEvent(item.target.selectionId, item.sObj.getName(), 'unfreeze', 'running', {
        freezeFile: fileName,
      });
      if (!nested) {
        rejected.push({
          selectionId: item.target.selectionId,
          reason: 'Frozen object has no nested source to restore.',
        });
        emitItemEvent(item.target.selectionId, item.sObj.getName(), 'unfreeze', 'failed', {
          reason: 'Frozen object has no nested source to restore.',
        });
        continue;
      }
      const restored = nested.deepCopy() as SoundObject;
      restored.setStartTime(frozen.getStartTime());
      staged.push({
        item,
        replacement: restored,
        ...(artifactPath && fs.existsSync(artifactPath)
          ? { unfreezeArtifact: { fileName, path: artifactPath } }
          : {}),
      });
    }

    // Prepare freeze jobs sequentially: the shared script session behind CSD
    // generation is never used concurrently, and Java-compatible filename
    // allocation stays race-free by reserving names within the batch.
    const prepared: PreparedFreezeJob[] = [];
    const reservedNames = new Set<string>();
    for (const item of resolved) {
      if (item.isFrozen) continue;
      if (isCancelled?.()) {
        removeGeneratedArtifacts();
        return reportCancelled();
      }
      try {
        const job = await prepareFreezeJob(context, item, reservedNames);
        reservedNames.add(job.fileName);
        prepared.push(job);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const reason = `Freeze failed: ${message}`;
        rejected.push({ selectionId: item.target.selectionId, reason });
        emitItemEvent(item.target.selectionId, item.sObj.getName(), 'freeze', 'failed', { reason });
      }
    }

    if (prepared.length > 0 && !isCancelled?.()) {
      const maxJobs = resolveFreezeMaxJobs(context.utility.freezeMaxJobs);
      const totalRenderJobs = prepared.length;
      const timeContext = data.getScore().getTimeContext();
      let completedRenderJobs = 0;
      let nextDispatch = 0;
      let stopDispatch = false;
      let systemicFailure: SystemicFreezeError | null = null;
      const inflightProgress = new Map<number, number>();
      let lastReportedProgress = -1;

      const reportRendering = (): void => {
        const runningCount = inflightProgress.size;
        const inflightSum = [...inflightProgress.values()].reduce(
          (total, value) => total + value / 100,
          0,
        );
        const raw = ((completedRenderJobs + inflightSum) / totalRenderJobs) * 90;
        const progress = Math.max(Math.min(raw, 90), Math.max(lastReportedProgress, 0));
        lastReportedProgress = progress;
        statusCallback({
          operationId,
          kind: 'freeze',
          phase: 'rendering',
          message: `Freezing ${totalRenderJobs} object${totalRenderJobs === 1 ? '' : 's'}: ${completedRenderJobs} rendered, ${runningCount} running...`,
          progress,
          outputPath: null,
          error: null,
        });
      };

      statusCallback({
        operationId,
        kind: 'freeze',
        phase: 'rendering',
        message: `Freezing ${totalRenderJobs} object${totalRenderJobs === 1 ? '' : 's'} with up to ${maxJobs} concurrent render${maxJobs === 1 ? '' : 's'}...`,
        progress: null,
        outputPath: null,
        error: null,
      });

      const renderOne = async (job: PreparedFreezeJob, dispatchIndex: number): Promise<void> => {
        emitItemEvent(job.item.target.selectionId, job.item.sObj.getName(), 'freeze', 'running');
        emitItemEvent(job.item.target.selectionId, job.item.sObj.getName(), 'freeze', 'running', {
          freezeFile: job.fileName,
        });
        inflightProgress.set(dispatchIndex, 0);
        reportRendering();
        try {
          const freezeResult = await runPreparedFreezeJob(context, job, executionSeam, {
            onProgress: (progress) => {
              inflightProgress.set(dispatchIndex, progress);
              reportRendering();
            },
            onOutput: (text, outputType) => {
              emitItemEvent(
                job.item.target.selectionId,
                job.item.sObj.getName(),
                'freeze',
                'running',
                {
                  outputAppend: text,
                  outputType,
                },
              );
            },
          });

          const inspectionProgress = Math.max(
            lastReportedProgress,
            Math.min(90, ((completedRenderJobs + 0.9) / totalRenderJobs) * 90),
          );
          lastReportedProgress = inspectionProgress;
          statusCallback({
            operationId,
            kind: 'freeze',
            phase: 'inspecting',
            message: `Inspecting "${job.item.sObj.getName()}" (${completedRenderJobs + 1} of ${totalRenderJobs})...`,
            progress: inspectionProgress,
            outputPath: job.fileName,
            error: null,
          });

          const fso = new FrozenSoundObject();
          fso.setFrozenSoundObject(job.item.sObj.deepCopy() as SoundObject);
          fso.setFrozenWaveFileName(freezeResult.fileName);
          fso.setNumChannels(freezeResult.channels);
          fso.setName(`F: ${job.item.sObj.getName()}`);
          fso.setStartTime(job.item.sObj.getStartTime());

          const measuredBeats = timeContext.secondsToBeats(freezeResult.durationSeconds);
          const sourceDuration = job.item.sObj.getSubjectiveDuration();
          fso.setSubjectiveDuration(
            beatsToDuration(measuredBeats, sourceDuration.getTimeBase(), timeContext),
          );

          staged.push({
            item: job.item,
            replacement: fso,
            generatedArtifactPath: job.artifactPath ?? undefined,
          });
          completedRenderJobs += 1;
          inflightProgress.delete(dispatchIndex);
          emitItemEvent(
            job.item.target.selectionId,
            job.item.sObj.getName(),
            'freeze',
            'rendered',
            { freezeFile: job.fileName },
          );
          reportRendering();
        } catch (err) {
          // The render may have succeeded before artifact inspection,
          // FrozenSoundObject construction, or duration conversion fails.
          // Remove the job's output on every post-render failure path.
          fs.rmSync(job.outputPath, { force: true });
          inflightProgress.delete(dispatchIndex);
          if (err instanceof SystemicFreezeError) {
            if (!systemicFailure) {
              systemicFailure = err;
              rejected.push({ selectionId: job.item.target.selectionId, reason: err.message });
              emitItemEvent(
                job.item.target.selectionId,
                job.item.sObj.getName(),
                'freeze',
                'failed',
                { reason: err.message },
              );
            }
            // Abort every in-flight job immediately; their results are
            // discarded by the systemic failure path below.
            context.abortInFlight?.();
            return;
          }
          if (systemicFailure || isCancelled?.()) return;
          // Per-object failure: stop dispatching new jobs, drain in-flight
          // jobs, and discard their staged results during cleanup.
          stopDispatch = true;
          const message = err instanceof Error ? err.message : String(err);
          const reason = `Freeze failed: ${message}`;
          rejected.push({ selectionId: job.item.target.selectionId, reason });
          emitItemEvent(job.item.target.selectionId, job.item.sObj.getName(), 'freeze', 'failed', {
            reason,
          });
        }
      };

      const worker = async (): Promise<void> => {
        while (
          nextDispatch < prepared.length &&
          !isCancelled?.() &&
          !systemicFailure &&
          !stopDispatch
        ) {
          const dispatchIndex = nextDispatch++;
          await renderOne(prepared[dispatchIndex], dispatchIndex);
        }
      };

      await Promise.all(Array.from({ length: Math.min(maxJobs, prepared.length) }, () => worker()));

      // Re-read through the union: renderOne assigns this inside closures,
      // which TypeScript's control-flow analysis cannot observe.
      const systemic = systemicFailure as SystemicFreezeError | null;
      if (systemic && !isCancelled?.()) {
        removeGeneratedArtifacts();
        return reportFailure(systemic.message, rejected);
      }
    }
  } finally {
    await cleanupTempCsdSnapshots();
  }

  if (isCancelled?.()) {
    removeGeneratedArtifacts();
    return reportCancelled();
  }

  if (rejected.length > 0) {
    removeGeneratedArtifacts();
    const reasons = rejected.map(({ reason }) => reason).join('\n');
    return reportFailure(
      `Freeze/unfreeze did not change the project because one or more objects failed.\n${reasons}`,
      rejected,
    );
  }

  // Confirm every source is still in place before making the first mutation.
  for (const replacement of staged) {
    const layerResult = resolveTimelineTarget(data.getScore(), replacement.item.target.location!);
    if (!layerResult || layerResult.sObj !== replacement.item.sObj) {
      removeGeneratedArtifacts();
      return reportFailure(
        'The project changed while preparing freeze/unfreeze; no changes were applied.',
        [
          {
            selectionId: replacement.item.target.selectionId,
            reason: 'Selected object is no longer at its original location.',
          },
        ],
      );
    }
  }

  statusCallback({
    operationId,
    kind: 'freeze',
    phase: 'committing',
    message: 'Committing freeze/unfreeze changes...',
    progress: 95,
    outputPath: null,
    error: null,
  });

  for (const replacement of staged) {
    const layerResult = resolveTimelineTarget(data.getScore(), replacement.item.target.location!);
    layerResult!.layer[layerResult!.objectIndex] = replacement.replacement;
  }

  for (const replacement of staged) {
    const freezeFile = replacement.item.isFrozen
      ? (replacement.item.sObj as FrozenSoundObject).getFrozenWaveFileName()
      : (replacement.replacement as FrozenSoundObject).getFrozenWaveFileName();
    emitItemEvent(
      replacement.item.target.selectionId,
      replacement.item.sObj.getName(),
      replacement.item.isFrozen ? 'unfreeze' : 'freeze',
      'complete',
      { freezeFile },
    );
  }

  const deletedFiles: string[] = [];
  for (const artifact of staged.flatMap((replacement) =>
    replacement.unfreezeArtifact ? [replacement.unfreezeArtifact] : [],
  )) {
    if (countFreezeReferences(data.getScore(), artifact.fileName) === 0) {
      try {
        fs.unlinkSync(artifact.path);
        deletedFiles.push(artifact.fileName);
      } catch {
        // The artifact was verified during staging; a later delete race is non-fatal.
      }
    }
  }

  statusCallback({
    operationId,
    kind: 'freeze',
    phase: 'completed',
    message: 'Freeze/unfreeze complete.',
    progress: 100,
    outputPath: null,
    error: null,
  });

  return result(true, [], {
    frozenCount: staged.filter((replacement) => !replacement.item.isFrozen).length,
    unfrozenCount: staged.filter((replacement) => replacement.item.isFrozen).length,
    deletedFiles,
  });
}

interface FreezeOneResult {
  fileName: string;
  channels: number;
  durationSeconds: number;
}

/** A freeze target with everything needed to run its render (SPEC 085). */
interface PreparedFreezeJob {
  item: { target: ScoreObjectEditorTargetSnapshot; sObj: SoundObject; isFrozen: boolean };
  fileName: string;
  outputPath: string;
  artifactPath: string | null;
  csdPath: string;
  args: string[];
}

/** Freeze-job concurrency cap read defensively: the settings layer already normalizes. */
function resolveFreezeMaxJobs(value: number | undefined): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : 1;
}

interface FreezeJobRunCallbacks {
  onProgress?: (progress: number) => void;
  /** Streamed Csound subprocess output for this item. */
  onOutput?: (text: string, type: 'stdout' | 'stderr') => void;
}

/**
 * Prepare one freeze job: build the isolated temporary project, generate its
 * CSD through the shared script session, allocate a Java-compatible artifact
 * name, and write the temporary CSD. Runs only in the sequential prepare
 * phase so shared state is never used concurrently.
 */
async function prepareFreezeJob(
  context: FreezeContext,
  item: PreparedFreezeJob['item'],
  reservedNames: ReadonlySet<string>,
): Promise<PreparedFreezeJob> {
  const { data, projectDirectory, utility, platform } = context;

  const freezeData = buildFreezeRenderData(data, item.sObj);

  const csdText = await generateDiskCsd(
    freezeData.tempData,
    context.javaScriptSession,
    context.javaRuntimeClient,
  );

  const fileName = allocateFreezeFileName(projectDirectory, platform, reservedNames);
  const outputPath = path.join(projectDirectory, fileName);

  const csdPath = await writeTempCsdSnapshot(csdText, projectDirectory);
  if (!csdPath) {
    throw new Error('Failed to write temporary CSD file for freeze.');
  }

  const cmd = planFreezeCommand({
    freezeFlags: utility.freezeFlags,
    outputFilePath: outputPath,
    csdPath,
  });

  return {
    item,
    fileName,
    outputPath,
    artifactPath: resolveFreezeArtifactPath(projectDirectory, fileName),
    csdPath,
    args: cmd.args,
  };
}

/**
 * Run one prepared freeze job: execute Csound and inspect the artifact.
 * Removes its own output file when anything fails.
 */
async function runPreparedFreezeJob(
  context: FreezeContext,
  job: PreparedFreezeJob,
  executionSeam: FreezeExecutionSeam,
  callbacks: FreezeJobRunCallbacks = {},
): Promise<FreezeOneResult> {
  const { projectDirectory, platform } = context;

  try {
    const result = await executionSeam.runCsound(
      job.args,
      projectDirectory,
      callbacks.onProgress,
      undefined,
      callbacks.onOutput,
    );

    if (result.cancelled || context.isCancelled?.()) {
      throw new Error('Operation cancelled.');
    }

    if (result.exitCode !== 0) {
      if (result.errorCode && SYSTEMIC_FREEZE_ERROR_CODES.has(result.errorCode)) {
        throw new SystemicFreezeError(
          `Csound runtime failed for all jobs (${result.errorCode}): ${result.stderr}`,
          result.errorCode,
        );
      }
      throw new Error(`Csound exited with code ${result.exitCode}. ${result.stderr}`);
    }

    if (!fs.existsSync(job.outputPath)) {
      throw new Error(`Freeze render completed but output file not found: ${job.outputPath}`);
    }

    const fileBytes = fs.readFileSync(job.outputPath);
    const meta = parseAudioFileMetadata(new Uint8Array(fileBytes));
    const expectedFormat = platform === 'darwin' ? 'AIFF' : 'WAV';
    if (meta.format !== expectedFormat) {
      throw new Error(
        `Freeze artifact format ${meta.format} does not match expected ${expectedFormat} output.`,
      );
    }
    if (!Number.isFinite(meta.durationSeconds) || meta.durationSeconds <= 0) {
      throw new Error(`Freeze artifact has no measurable audio duration: ${job.outputPath}`);
    }

    return {
      fileName: job.fileName,
      channels: meta.channels,
      durationSeconds: meta.durationSeconds,
    };
  } catch (error) {
    fs.rmSync(job.outputPath, { force: true });
    throw error;
  }
}
