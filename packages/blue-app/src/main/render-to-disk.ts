/**
 * Render to Disk — main-process service.
 *
 * Generates a disk-profile CSD from the canonical project, combines
 * Program Disk Render settings with project-owned ProjectProperties,
 * executes the configured Csound command, and verifies the output.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { BlueData, JavaRuntimeClientContract, JavaScriptSession } from '@blue/data';

import type { DiskRenderSettingsSnapshot, GeneralSettingsSnapshot } from '../shared/program-settings';
import type {
  RenderOperationResult,
  RenderOperationStatus,
  DiskRenderAction,
} from '../shared/render-freeze-contract';
import { planDiskCommand } from './disk-render-command';
import { writeTempCsdSnapshot, cleanupTempCsdSnapshots } from './render-command';

// ─── Types ───

export interface RenderToDiskContext {
  data: BlueData;
  projectDirectory: string;
  diskRender: DiskRenderSettingsSnapshot;
  general: Pick<GeneralSettingsSnapshot, 'messageColorsEnabled'>;
  /** Resolved output path (already selected via dialog or project fileName). */
  outputFile: string | null;
  /** True after the operation has been cancelled by its main-process owner. */
  isCancelled?: () => boolean;
  javaScriptSession?: JavaScriptSession;
  javaRuntimeClient?: JavaRuntimeClientContract | null;
}

export type RenderStatusCallback = (status: RenderOperationStatus) => void;

export interface RenderExecutionSeam {
  runCsound(
    executable: string,
    args: string[],
    cwd: string,
    onProgress?: (progress: number) => void,
    totalDuration?: number,
  ): Promise<{ exitCode: number; stderr: string; stdout?: string }>;
}

// ─── Service ───

/**
 * Execute a Render-to-Disk operation.
 *
 * Steps:
 *   1. Generate disk CSD from the canonical project
 *   2. Plan the command from three-layer settings
 *   3. Spawn Csound subprocess
 *   4. Verify output file exists
 *   5. Return verified output path
 *
 * Does NOT mutate project content. Cancellation is handled by the caller
 * through the execution seam.
 */
export async function executeRenderToDisk(
  context: RenderToDiskContext,
  action: DiskRenderAction,
  operationId: string,
  statusCallback: RenderStatusCallback,
  executionSeam: RenderExecutionSeam,
): Promise<RenderOperationResult> {
  const {
    data,
    projectDirectory,
    diskRender,
    general,
    outputFile,
    isCancelled,
    javaScriptSession,
    javaRuntimeClient,
  } = context;

  const reportFailure = (message: string): RenderOperationResult => {
    statusCallback({
      operationId,
      kind: 'diskRender',
      phase: 'failed',
      message,
      progress: null,
      outputPath: null,
      error: message,
    });
    return { ok: false, operationId, cancelled: false, outputPath: null, error: message };
  };

  const reportCancelled = (): RenderOperationResult => {
    statusCallback({
      operationId,
      kind: 'diskRender',
      phase: 'cancelled',
      message: 'Render cancelled.',
      progress: null,
      outputPath: null,
      error: null,
    });
    return { ok: false, operationId, cancelled: true, outputPath: null, error: null };
  };

  statusCallback({
    operationId,
    kind: 'diskRender',
    phase: 'preparing',
    message: 'Generating disk CSD...',
    progress: 0,
    outputPath: outputFile,
    error: null,
  });

  const props = data.getProjectProperties();
  const messageColorsEnabled = general.messageColorsEnabled;

  let plan;
  try {
    plan = planDiskCommand({
      diskRender,
      props,
      outputFile,
      messageColorsEnabled,
    });
  } catch (err) {
    return reportFailure(err instanceof Error ? err.message : String(err));
  }

  const verifyPath = path.isAbsolute(plan.outputPath!)
    ? plan.outputPath!
    : path.resolve(projectDirectory, plan.outputPath!);

  if (isCancelled?.()) return reportCancelled();

  let csdText: string;
  try {
    csdText = await generateDiskCsd(data, javaScriptSession, javaRuntimeClient);
  } catch (err) {
    return reportFailure(`CSD generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const csdPath = await writeTempCsdSnapshot(csdText, projectDirectory);
  if (!csdPath) return reportFailure('Failed to write temporary CSD file.');

  statusCallback({
    operationId,
    kind: 'diskRender',
    phase: 'rendering',
    message: `Rendering to ${path.basename(verifyPath)}...`,
    progress: null,
    outputPath: verifyPath,
    error: null,
  });

  const allArgs = [...plan.args, csdPath];

  const totalDuration = estimateTotalScoreDuration(csdText);

  let result: { exitCode: number; stderr: string };
  try {
    result = await executionSeam.runCsound(plan.executable, allArgs, projectDirectory, (progress) => {
      statusCallback({
        operationId,
        kind: 'diskRender',
        phase: 'rendering',
        message: `Rendering to ${path.basename(verifyPath)}...`,
        progress,
        outputPath: verifyPath,
        error: null,
      });
    }, totalDuration);
  } catch (err) {
    await cleanupTempCsdSnapshots();
    return reportFailure(`Could not start Csound: ${err instanceof Error ? err.message : String(err)}`);
  }

  await cleanupTempCsdSnapshots();

  if (isCancelled?.()) return reportCancelled();

  if (result.exitCode !== 0) {
    return reportFailure(`Csound exited with code ${result.exitCode}. ${result.stderr}`);
  }

  // Verify output exists
  if (!fs.existsSync(verifyPath)) {
    return reportFailure(`Render completed but output file not found: ${verifyPath}`);
  }

  statusCallback({
    operationId,
    kind: 'diskRender',
    phase: 'completed',
    message: 'Render complete.',
    progress: 100,
    outputPath: verifyPath,
    error: null,
  });

  return {
    ok: true,
    operationId,
    cancelled: false,
    outputPath: verifyPath,
    error: null,
  };
}

export async function generateDiskCsd(
  data: Pick<BlueData, 'toDiskCSD' | 'toDiskCSDAsync'>,
  javaScriptSession?: JavaScriptSession,
  javaRuntimeClient?: JavaRuntimeClientContract | null,
): Promise<string> {
  return javaRuntimeClient
    ? data.toDiskCSDAsync(javaScriptSession, javaRuntimeClient)
    : data.toDiskCSD(javaScriptSession);
}

// ─── Output Path Resolution ───

/**
 * Resolve the output file path for Render to Disk.
 *
 * Uses the project's `fileName` when configured and `askOnRender` is false.
 * Returns null when the caller should show a dialog (askOnRender or empty fileName).
 */
export function resolveOutputFilePath(
  data: BlueData,
  projectDirectory: string,
): string | null {
  const props = data.getProjectProperties();

  if (props.askOnRender || !props.fileName || props.fileName.trim().length === 0) {
    return null;
  }

  if (path.isAbsolute(props.fileName)) {
    return props.fileName;
  }

  return path.resolve(projectDirectory, props.fileName);
}

/** Unsaved projects render from the app temp directory; only freezing requires a saved project. */
export function resolveRenderWorkingDirectory(currentFilePath: string | null, tempDirectory: string): string {
  return currentFilePath ? path.dirname(currentFilePath) : tempDirectory;
}

/**
 * Estimate the total score duration (in seconds) from generated CSD text.
 *
 * Scans `<CsScore>` `i` statements for the maximum `p2 + p3` (start + duration).
 * Used to compute determinate progress from Csound's `B` line `TT` values.
 * Returns 0 when the score is empty or unparseable.
 */
export function estimateTotalScoreDuration(csdText: string): number {
  const scoreMatch = csdText.match(/<CsScore>\s*([\s\S]*?)<\/CsScore>/);
  if (!scoreMatch) return 0;

  let maxEndTime = 0;

  for (const line of scoreMatch[1]!.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('i') === false) continue;

    const fields = trimmed.split(/\s+/);
    if (fields.length < 3) continue;

    const start = Number(fields[1]);
    const duration = Number(fields[2]);
    if (Number.isFinite(start) && Number.isFinite(duration)) {
      maxEndTime = Math.max(maxEndTime, start + duration);
    }
  }

  return maxEndTime;
}

/**
 * Parse a Csound "B" progress line and compute a percentage.
 *
 * Csound emits lines like:
 *   B  0.000 ..  5.000 T  5.000 TT  5.000 M:  ...
 *
 * where `TT` is the cumulative total time across all score sections.
 * Returns `null` when the line is not a B-line or progress can't be computed.
 */
export function parseCsoundProgressLine(line: string, totalDuration: number): number | null {
  const match = line.match(/B\s+[\d.]+\s+\.\.\s*[\d.]+\s+T\s*([\d.]+)\s+TT\s*([\d.]+)/);
  if (!match) return null;

  const cumulativeTime = Number(match[2]);
  if (!Number.isFinite(cumulativeTime)) return null;

  if (totalDuration > 0) {
    return Math.max(0, Math.min(100, (cumulativeTime / totalDuration) * 100));
  }

  const sectionTime = Number(match[1]);
  if (Number.isFinite(sectionTime) && sectionTime > 0 && cumulativeTime > 0) {
    return 100;
  }

  return null;
}
