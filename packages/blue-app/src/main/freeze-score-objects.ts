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
  javaScriptSession?: JavaScriptSession;
  javaRuntimeClient?: JavaRuntimeClientContract | null;
}

export type StatusCallback = (status: RenderOperationStatus) => void;

export interface FreezeExecutionSeam {
  /** Run Csound with the given args in the project directory. Returns exit code. */
  runCsound(args: string[], cwd: string, onProgress?: (progress: number) => void, totalDuration?: number): Promise<{ exitCode: number; stderr: string; stdout?: string; cancelled?: boolean }>;
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
 */
export function allocateFreezeFileName(
  projectDirectory: string,
  platform: string,
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

  // Advance on collision (Java-compatible behavior)
  while (true) {
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
export function resolveFreezeArtifactPath(projectDirectory: string, fileName: string): string | null {
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
  resolved: Array<{ target: ScoreObjectEditorTargetSnapshot; sObj: SoundObject; isFrozen: boolean }>;
  rejected: FreezeRejectedTarget[];
} {
  const resolved: Array<{ target: ScoreObjectEditorTargetSnapshot; sObj: SoundObject; isFrozen: boolean }> = [];
  const rejected: FreezeRejectedTarget[] = [];

  for (const target of targets) {
    if (target.ownerKind !== 'timeline' || !target.location) {
      rejected.push({ selectionId: target.selectionId, reason: 'Freeze requires a timeline-owned object with a valid location.' });
      continue;
    }

    const result = resolveTimelineTarget(data.getScore(), target.location);
    if (!result) {
      rejected.push({ selectionId: target.selectionId, reason: 'Could not resolve the selected object in the canonical project.' });
      continue;
    }

    if (!(result.sObj instanceof FrozenSoundObject) && !isFreezeEligible(result.sObj)) {
      rejected.push({ selectionId: target.selectionId, reason: 'This object type is not supported for freeze/unfreeze.' });
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
): Promise<FreezeOperationResult> {
  const { data, projectDirectory, isCancelled } = context;
  type StagedReplacement = {
    item: { target: ScoreObjectEditorTargetSnapshot; sObj: SoundObject; isFrozen: boolean };
    replacement: SoundObject;
    generatedArtifactPath?: string;
    unfreezeArtifact?: { fileName: string; path: string };
  };

  const result = (
    ok: boolean,
    rejectedTargets: FreezeRejectedTarget[],
    options: Partial<Pick<FreezeOperationResult, 'cancelled' | 'frozenCount' | 'unfrozenCount' | 'deletedFiles' | 'error'>> = {},
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

  const reportFailure = (message: string, rejectedTargets: FreezeRejectedTarget[]): FreezeOperationResult => {
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

  if (isCancelled?.()) return reportCancelled();
  if (resolved.length === 0 || rejected.length > 0) {
    return reportFailure(
      rejected.length > 0 ? 'One or more selected objects cannot be freeze/unfrozen.' : 'No eligible objects selected.',
      rejected.length > 0 ? rejected : [{ selectionId: '*', reason: 'No eligible objects selected.' }],
    );
  }

  const staged: StagedReplacement[] = [];
  const removeGeneratedArtifacts = (): void => {
    for (const replacement of staged) {
      if (replacement.generatedArtifactPath) fs.rmSync(replacement.generatedArtifactPath, { force: true });
    }
  };
  try {
    for (let itemIndex = 0; itemIndex < resolved.length; itemIndex++) {
      const item = resolved[itemIndex];
      const objectProgressStart = (itemIndex / resolved.length) * 90;
      const objectProgressSpan = 90 / resolved.length;
      if (isCancelled?.()) {
        removeGeneratedArtifacts();
        return reportCancelled();
      }

      if (item.isFrozen) {
        const frozen = item.sObj as FrozenSoundObject;
        const nested = frozen.getFrozenSoundObject();
        const fileName = frozen.getFrozenWaveFileName();
        const artifactPath = resolveFreezeArtifactPath(projectDirectory, fileName);
        if (!nested) {
          rejected.push({ selectionId: item.target.selectionId, reason: 'Frozen object has no nested source to restore.' });
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
        continue;
      }

      statusCallback({
        operationId,
        kind: 'freeze',
        phase: 'rendering',
        message: `Freezing object ${itemIndex + 1} of ${resolved.length}: "${item.sObj.getName()}"...`,
        progress: itemIndex === 0 ? null : objectProgressStart,
        outputPath: null,
        error: null,
      });

      try {
        const freezeResult = await freezeOneObject(context, item.sObj, executionSeam, (progress) => {
          statusCallback({
            operationId,
            kind: 'freeze',
            phase: 'rendering',
            message: `Freezing object ${itemIndex + 1} of ${resolved.length}: "${item.sObj.getName()}"...`,
            progress: objectProgressStart + (objectProgressSpan * progress / 100),
            outputPath: null,
            error: null,
          });
        });
        if (isCancelled?.()) {
          const artifactPath = resolveFreezeArtifactPath(projectDirectory, freezeResult.fileName);
          if (artifactPath) fs.rmSync(artifactPath, { force: true });
          removeGeneratedArtifacts();
          return reportCancelled();
        }

        statusCallback({
          operationId,
          kind: 'freeze',
          phase: 'inspecting',
          message: `Inspecting object ${itemIndex + 1} of ${resolved.length}...`,
          progress: objectProgressStart + objectProgressSpan * 0.9,
          outputPath: freezeResult.fileName,
          error: null,
        });

        const fso = new FrozenSoundObject();
        fso.setFrozenSoundObject(item.sObj.deepCopy() as SoundObject);
        fso.setFrozenWaveFileName(freezeResult.fileName);
        fso.setNumChannels(freezeResult.channels);
        fso.setName(`F: ${item.sObj.getName()}`);
        fso.setStartTime(item.sObj.getStartTime());

        const timeContext = data.getScore().getTimeContext();
        const measuredBeats = timeContext.secondsToBeats(freezeResult.durationSeconds);
        const sourceDuration = item.sObj.getSubjectiveDuration();
        fso.setSubjectiveDuration(
          beatsToDuration(measuredBeats, sourceDuration.getTimeBase(), timeContext),
        );

        const artifactPath = resolveFreezeArtifactPath(projectDirectory, freezeResult.fileName);
        staged.push({ item, replacement: fso, generatedArtifactPath: artifactPath ?? undefined });
      } catch (err) {
        if (isCancelled?.()) {
          removeGeneratedArtifacts();
          return reportCancelled();
        }
        const message = err instanceof Error ? err.message : String(err);
        rejected.push({ selectionId: item.target.selectionId, reason: `Freeze failed: ${message}` });
      }
    }
  } finally {
    await cleanupTempCsdSnapshots();
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
      return reportFailure('The project changed while preparing freeze/unfreeze; no changes were applied.', [
        { selectionId: replacement.item.target.selectionId, reason: 'Selected object is no longer at its original location.' },
      ]);
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

  const deletedFiles: string[] = [];
  for (const artifact of staged.flatMap((replacement) => replacement.unfreezeArtifact ? [replacement.unfreezeArtifact] : [])) {
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

async function freezeOneObject(
  context: FreezeContext,
  sourceObject: SoundObject,
  executionSeam: FreezeExecutionSeam,
  onProgress?: (progress: number) => void,
): Promise<FreezeOneResult> {
  const { data, projectDirectory, utility, platform } = context;

  // Build temporary project with isolated object
  const freezeData = buildFreezeRenderData(data, sourceObject);

  // Generate CSD
  const csdText = await generateDiskCsd(
    freezeData.tempData,
    context.javaScriptSession,
    context.javaRuntimeClient,
  );

  // Allocate freeze filename
  const fileName = allocateFreezeFileName(projectDirectory, platform);
  const outputPath = path.join(projectDirectory, fileName);

  // Write temp CSD
  const csdPath = await writeTempCsdSnapshot(csdText, projectDirectory);
  if (!csdPath) {
    throw new Error('Failed to write temporary CSD file for freeze.');
  }

  // Build and run command
  const cmd = planFreezeCommand({
    freezeFlags: utility.freezeFlags,
    outputFilePath: outputPath,
    csdPath,
  });

  try {
    const result = await executionSeam.runCsound(cmd.args, projectDirectory, onProgress);

    if (result.cancelled || context.isCancelled?.()) {
      throw new Error('Operation cancelled.');
    }

    if (result.exitCode !== 0) {
      throw new Error(`Csound exited with code ${result.exitCode}. ${result.stderr}`);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Freeze render completed but output file not found: ${outputPath}`);
    }

    const fileBytes = fs.readFileSync(outputPath);
    const meta = parseAudioFileMetadata(new Uint8Array(fileBytes));
    const expectedFormat = platform === 'darwin' ? 'AIFF' : 'WAV';
    if (meta.format !== expectedFormat) {
      throw new Error(`Freeze artifact format ${meta.format} does not match expected ${expectedFormat} output.`);
    }
    if (!Number.isFinite(meta.durationSeconds) || meta.durationSeconds <= 0) {
      throw new Error(`Freeze artifact has no measurable audio duration: ${outputPath}`);
    }

    return {
      fileName,
      channels: meta.channels,
      durationSeconds: meta.durationSeconds,
    };
  } catch (error) {
    fs.rmSync(outputPath, { force: true });
    throw error;
  }
}
