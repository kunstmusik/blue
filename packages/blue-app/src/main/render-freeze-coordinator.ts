import { app, dialog, shell, type BrowserWindow } from 'electron';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import type { BlueData, JavaScriptSession } from '@blue/data';
import type { JavaRuntimeClient } from './java-runtime/java-runtime-client';
import type { EngineRuntimeService } from './engine-runtime';
import type { ProjectHistory } from './project-history';
import type { ProjectEditorSnapshot } from '../shared/project-editor';
import type { ProgramSettingsSnapshot } from '../shared/program-settings';
import type { SoundFontExecutionSeam } from './soundfont-viewer';
import {
  RENDER_OPERATION_STATUS_CHANNEL,
  FREEZE_ITEM_STATUS_CHANNEL,
  type CancelRenderOperationRequest,
  type DiskRenderAction,
  type FreezeItemStatus,
  type FreezeOperationResult,
  type FreezeScoreObjectsRequest,
  type RenderOperationResult,
  type RenderOperationStatus,
} from '../shared/render-freeze-contract';
import {
  executeRenderToDisk,
  parseCsoundProgressLine,
  resolveOutputFilePath,
  resolveRenderWorkingDirectory,
  type RenderExecutionSeam,
} from './render-to-disk';
import { tokenizeCommand } from './disk-render-command';
import {
  executeFreezeUnfreeze,
  type FreezeArtifactSettlement,
  type FreezeExecutionSeam,
} from './freeze-score-objects';
import {
  executeConfinedMcpRender,
  type AuthorizedRenderRoot,
  type ConfinedMcpRenderSuccess,
  type McpRenderFsSeam,
} from './mcp-render';
import type { McpAuthContext, McpDocumentReceipt, McpResult } from './mcp-bridge';

/** Output tab name used to stream disk-render Csound subprocess output. */
const DISK_RENDER_OUTPUT_TAB = 'Csound (Disk)';

export interface RenderFreezeCoordinatorDeps {
  getCurrentData: () => BlueData | null;
  getCurrentFilePath: () => string | null;
  getCurrentProjectDirectory: () => string | null;
  getCurrentProjectSessionId: () => number;
  getCurrentProjectSessionDocumentId: () => string;
  getCurrentProjectRevision: () => number;
  getCurrentProjectStateId?: () => string | null;
  getCurrentProjectDocument: () => ProjectEditorSnapshot | null;
  getMainWindow: () => BrowserWindow | null;
  getEngineRuntimeService: () => EngineRuntimeService | null;
  getJavaScriptSession: () => JavaScriptSession | null;
  getProjectHistory: () => ProjectHistory;
  loadProgramSettings: () => ProgramSettingsSnapshot;
  getConfiguredWorkDirectory: () => string | undefined;
  runProjectOnLoad: (data: BlueData) => Promise<JavaRuntimeClient | null>;
  transferProjectEditorIdentities: (source: BlueData, target: BlueData) => void;
  authorizeAudioFilePath: (filePath: string) => boolean;
  broadcastToWorkbenchWindows: (channel: string, payload: unknown) => void;
  rebuildApplicationMenuIfChanged: () => void;
}

export interface McpRenderToDiskRequest {
  readonly auth: McpAuthContext;
  readonly expectedReceipt: McpDocumentReceipt;
  readonly getCurrentReceipt?: () => McpDocumentReceipt | null;
  readonly nativeRoot: string;
  readonly authorizedRoot?: AuthorizedRenderRoot;
  readonly filename: string;
  readonly operationId?: string;
  readonly fsSeam?: McpRenderFsSeam;
  readonly platform?: NodeJS.Platform | string;
}

export interface RenderFreezeCoordinator {
  isRenderOperationActive: () => boolean;
  createCsoundExecutionSeam: (
    cancellationSignal?: { cancelled: boolean },
    streamOutput?: (text: string, type: 'stdout' | 'stderr') => void,
    options?: { trackRenderProcess?: boolean },
  ) => RenderExecutionSeam & FreezeExecutionSeam & SoundFontExecutionSeam;
  handleRenderToDisk: (
    action: DiskRenderAction,
    requestedOperationId?: string,
  ) => Promise<RenderOperationResult>;
  handleMcpRenderToDisk: (
    request: McpRenderToDiskRequest,
  ) => Promise<McpResult<ConfinedMcpRenderSuccess>>;
  handleFreezeScoreObjects: (request: FreezeScoreObjectsRequest) => Promise<FreezeOperationResult>;
  handleCancelRenderOperation: (request: CancelRenderOperationRequest) => Promise<boolean>;
  shutdownMcpRender: () => Promise<void>;
}

export function createRenderFreezeCoordinator(
  deps: RenderFreezeCoordinatorDeps,
): RenderFreezeCoordinator {
  let activeRenderOperationId: string | null = null;
  let activeRenderAbortController: AbortController | null = null;
  let activeRenderAction: DiskRenderAction | null = null;
  let activeRenderCancellationSignal: { cancelled: boolean } | null = null;
  let activeMcpRenderSettlement: Promise<void> | null = null;

  function createCsoundExecutionSeam(
    cancellationSignal?: { cancelled: boolean },
    streamOutput?: (text: string, type: 'stdout' | 'stderr') => void,
    options: { trackRenderProcess?: boolean } = {},
  ): RenderExecutionSeam & FreezeExecutionSeam & SoundFontExecutionSeam {
    const trackRenderProcess = options.trackRenderProcess ?? true;

    return {
      async runCsound(
        args: string[],
        cwd: string,
        onProgress?: (progress: number) => void,
        totalDuration?: number,
        onOutput?: (text: string, type: 'stdout' | 'stderr') => void,
      ): Promise<{
        exitCode: number;
        stderr: string;
        stdout: string;
        cancelled?: boolean;
        errorCode?: string | null;
      }> {
        const controller =
          trackRenderProcess && activeRenderAbortController
            ? activeRenderAbortController
            : new AbortController();
        if (cancellationSignal?.cancelled) controller.abort();
        let stderrLineBuffer = '';
        const result = await deps.getEngineRuntimeService()?.executeCsound(
          {
            kind: 'performance',
            operationId: activeRenderOperationId ?? `csound-${Date.now()}`,
            args,
            cwd,
          },
          {
            signal: controller.signal,
            onOutput: (text, source) => {
              streamOutput?.(text, source);
              onOutput?.(text, source);
              if (source !== 'stderr' || !onProgress) return;
              stderrLineBuffer += text;
              const lines = stderrLineBuffer.split('\n');
              stderrLineBuffer = lines.pop() ?? '';
              for (const line of lines) {
                const progress = parseCsoundProgressLine(line, totalDuration ?? 0);
                if (progress !== null) onProgress(progress);
              }
            },
          },
        );
        if (!result) {
          return {
            exitCode: -1,
            stderr: 'Blue Engine runtime service is unavailable.',
            stdout: '',
            errorCode: 'CSOUND_UNAVAILABLE',
          };
        }
        return {
          exitCode: result.exitCode ?? -1,
          stderr: result.stderr || (result.state === 'failed' ? result.message : ''),
          stdout: result.stdout,
          cancelled: result.state === 'cancelled',
          errorCode: result.errorCode,
        };
      },
      async runConfinedCsound(request) {
        const controller =
          trackRenderProcess && activeRenderAbortController
            ? activeRenderAbortController
            : new AbortController();
        if (cancellationSignal?.cancelled) controller.abort();
        const result = await deps.getEngineRuntimeService()?.executeCsound(
          {
            kind: 'confined-render',
            operationId: activeRenderOperationId ?? `csound-confined-${Date.now()}`,
            rootPath: request.rootPath,
            rootDev: request.rootDev,
            rootIno: request.rootIno,
            outputFilename: request.outputFilename,
            csdText: request.csdText,
            args: request.args,
          },
          {
            signal: controller.signal,
            beforeLaunch: request.beforeLaunch,
            beforePublish: request.beforePublish,
            onOutput: (text, source) => {
              streamOutput?.(text, source);
            },
          },
        );
        if (!result) {
          return {
            exitCode: -1,
            stderr: 'Blue Engine runtime service is unavailable.',
            stdout: '',
            errorCode: 'CSOUND_UNAVAILABLE',
          };
        }
        return {
          exitCode: result.exitCode ?? -1,
          stderr: result.stderr || (result.state === 'failed' ? result.message : ''),
          stdout: result.stdout,
          cancelled: result.state === 'cancelled',
          errorCode: result.errorCode,
          message: result.message,
        };
      },
    };
  }

  function finishRenderOperation(operationId: string): void {
    if (activeRenderOperationId !== operationId) return;
    activeRenderOperationId = null;
    activeRenderAction = null;
    activeRenderCancellationSignal = null;
    activeRenderAbortController = null;
    deps.rebuildApplicationMenuIfChanged();
  }

  function broadcastRenderStatus(status: RenderOperationStatus): void {
    const withAction: RenderOperationStatus =
      activeRenderAction !== null && (status.action === undefined || status.action === null)
        ? { ...status, action: activeRenderAction }
        : status;

    if (
      withAction.kind === 'diskRender' &&
      withAction.phase === 'completed' &&
      withAction.action === 'play' &&
      withAction.outputPath &&
      !deps.authorizeAudioFilePath(withAction.outputPath)
    ) {
      deps.broadcastToWorkbenchWindows(RENDER_OPERATION_STATUS_CHANNEL, {
        ...withAction,
        phase: 'failed',
        message: 'Could not authorize rendered file for in-app playback.',
        error: 'Could not authorize rendered file for in-app playback.',
      });
      return;
    }

    deps.broadcastToWorkbenchWindows(RENDER_OPERATION_STATUS_CHANNEL, withAction);
  }

  function launchExternalOutputCommand(
    template: string,
    outputPath: string,
    operationId: string,
    label: 'Open',
  ): void {
    const command = tokenizeCommand(template).map((token) =>
      token.replaceAll('$outfile', outputPath),
    );
    const executable = command.shift();
    if (!executable) {
      broadcastRenderStatus({
        operationId,
        kind: 'diskRender',
        phase: 'failed',
        message: `${label} command is empty.`,
        progress: null,
        outputPath,
        error: `${label} command is empty.`,
      });
      return;
    }

    const child = spawn(executable, command, { stdio: 'ignore' });
    let failedToStart = false;
    child.once('error', (error) => {
      failedToStart = true;
      broadcastRenderStatus({
        operationId,
        kind: 'diskRender',
        phase: 'failed',
        message: `${label} command failed: ${error.message}`,
        progress: null,
        outputPath,
        error: error.message,
      });
    });
    child.once('close', (code) => {
      if (failedToStart || code === 0) return;
      const message = `${label} command exited with code ${code ?? -1}.`;
      broadcastRenderStatus({
        operationId,
        kind: 'diskRender',
        phase: 'failed',
        message,
        progress: null,
        outputPath,
        error: message,
      });
    });
  }

  async function handleRenderToDisk(
    action: DiskRenderAction,
    requestedOperationId?: string,
  ): Promise<RenderOperationResult> {
    const data = deps.getCurrentData();
    if (!data) {
      return {
        ok: false,
        operationId: '',
        cancelled: false,
        outputPath: null,
        error: 'No project loaded.',
      };
    }

    if (activeRenderOperationId) {
      return {
        ok: false,
        operationId: '',
        cancelled: false,
        outputPath: null,
        error: 'Another render/freeze operation is already running.',
      };
    }

    // One-shot Blue Engine children are isolated from the realtime ZMQ session;
    // leave active playback/Blue Live untouched while an offline operation runs.

    const filePath = deps.getCurrentFilePath();
    const projectDirectory = resolveRenderWorkingDirectory(filePath, app.getPath('temp'));

    const operationId = requestedOperationId ?? `disk-${Date.now()}`;
    activeRenderOperationId = operationId;
    activeRenderAction = action;
    const cancellationSignal = { cancelled: false };
    activeRenderCancellationSignal = cancellationSignal;
    activeRenderAbortController = new AbortController();
    deps.rebuildApplicationMenuIfChanged();

    try {
      const settings = deps.loadProgramSettings();
      const props = data.getProjectProperties();
      const javaRuntimeClient = await deps.runProjectOnLoad(data);

      // Resolve output file
      let outputFile = props.diskCompleteOverride
        ? null
        : resolveOutputFilePath(data, projectDirectory);

      if (!props.diskCompleteOverride && !outputFile) {
        const defaultName =
          props.fileName?.trim() ||
          `${filePath ? path.basename(filePath, '.blue') : 'untitled'}.wav`;
        const dialogDirectory = filePath
          ? projectDirectory
          : (deps.getConfiguredWorkDirectory() ?? projectDirectory);
        const result = await dialog.showSaveDialog(deps.getMainWindow()!, {
          title: 'Render to Disk',
          defaultPath: path.join(dialogDirectory, defaultName),
          filters: [
            { name: 'WAV', extensions: ['wav'] },
            { name: 'AIFF', extensions: ['aif', 'aiff'] },
            { name: 'AU', extensions: ['au'] },
            { name: 'RAW', extensions: ['raw'] },
            { name: 'IRCAM', extensions: ['ircam'] },
            { name: 'W64', extensions: ['w64'] },
            { name: 'WAVEX', extensions: ['wavex'] },
            { name: 'SD2', extensions: ['sd2'] },
            { name: 'FLAC', extensions: ['flac'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          return { ok: false, operationId, cancelled: true, outputPath: null, error: null };
        }

        outputFile = result.filePath;
      }

      // Reset and focus the Csound (Disk) output tab before rendering so the
      // user sees streamed subprocess output and a fresh buffer each run.
      deps.broadcastToWorkbenchWindows('engine-output-reset', {
        tabName: DISK_RENDER_OUTPUT_TAB,
      });
      deps.broadcastToWorkbenchWindows('engine-output-select', {
        tabName: DISK_RENDER_OUTPUT_TAB,
      });

      const seam = createCsoundExecutionSeam(cancellationSignal, (text, type) =>
        deps.broadcastToWorkbenchWindows('engine-output', {
          tabName: DISK_RENDER_OUTPUT_TAB,
          text,
          type,
        }),
      );

      const renderResult = await executeRenderToDisk(
        {
          data,
          projectDirectory,
          diskRender: settings.diskRender,
          general: settings.general,
          outputFile,
          isCancelled: () => cancellationSignal.cancelled,
          javaScriptSession: deps.getJavaScriptSession() ?? undefined,
          javaRuntimeClient,
        },
        action,
        operationId,
        broadcastRenderStatus,
        seam,
      );

      if (renderResult.ok && renderResult.outputPath) {
        if (action === 'play') {
          // The renderer Audio File Player handles in-app playback after the
          // completed status carries this action and output path.
        } else if (action === 'open') {
          const openCmd = settings.diskRender.externalOpenCommand.trim();
          if (openCmd && openCmd !== 'command $outfile') {
            launchExternalOutputCommand(openCmd, renderResult.outputPath, operationId, 'Open');
          } else {
            shell.showItemInFolder(renderResult.outputPath);
          }
        }
      }

      return renderResult;
    } finally {
      finishRenderOperation(operationId);
    }
  }

  async function handleFreezeScoreObjects(
    request: FreezeScoreObjectsRequest,
  ): Promise<FreezeOperationResult> {
    const data = deps.getCurrentData();
    if (!data) {
      return {
        ok: false,
        operationId: '',
        cancelled: false,
        frozenCount: 0,
        unfrozenCount: 0,
        deletedFiles: [],
        rejectedTargets: [],
        error: 'No project loaded.',
        project: null,
      };
    }

    if (activeRenderOperationId) {
      return {
        ok: false,
        operationId: '',
        cancelled: false,
        frozenCount: 0,
        unfrozenCount: 0,
        deletedFiles: [],
        rejectedTargets: [],
        error: 'Another render/freeze operation is already running.',
        project: null,
      };
    }

    const projectDirectory = deps.getCurrentProjectDirectory();
    if (!projectDirectory) {
      return {
        ok: false,
        operationId: '',
        cancelled: false,
        frozenCount: 0,
        unfrozenCount: 0,
        deletedFiles: [],
        rejectedTargets: [{ selectionId: '*', reason: 'Project must be saved before freezing.' }],
        error: 'Project must be saved before freezing.',
        project: null,
      };
    }

    const operationId = request.operationId ?? `freeze-${Date.now()}`;
    activeRenderOperationId = operationId;
    activeRenderAction = null;
    const cancellationSignal = { cancelled: false };
    activeRenderCancellationSignal = cancellationSignal;
    activeRenderAbortController = new AbortController();
    deps.rebuildApplicationMenuIfChanged();

    const initialDocumentId = deps.getCurrentProjectSessionDocumentId();
    const initialSessionId = deps.getCurrentProjectSessionId();
    const initialRevision = deps.getCurrentProjectRevision();
    const stagedProject = data.historyCopy();
    deps.transferProjectEditorIdentities(data, stagedProject);

    const pendingArtifacts: { settlement?: FreezeArtifactSettlement } = {};
    try {
      const settings = deps.loadProgramSettings();
      const seam = createCsoundExecutionSeam(cancellationSignal);
      const javaRuntimeClient = await deps.runProjectOnLoad(data);

      const result = await executeFreezeUnfreeze(
        {
          // Freeze renders and applies replacements only to this detached
          // candidate. The live session remains available for edits while the
          // asynchronous render/Java work is in progress.
          data: stagedProject,
          projectDirectory,
          utility: settings.utility,
          platform: process.platform,
          isCancelled: () => cancellationSignal.cancelled,
          onPreparedArtifacts: (settlement) => {
            pendingArtifacts.settlement = settlement;
          },
          // SPEC 085: a systemic freeze failure aborts every in-flight render
          // through the shared operation controller. The user-cancellation
          // signal stays untouched so the outcome is reported as a failure,
          // not as a cancel.
          abortInFlight: () => {
            activeRenderAbortController?.abort();
          },
          javaScriptSession: deps.getJavaScriptSession() ?? undefined,
          javaRuntimeClient,
        },
        request.targets,
        operationId,
        broadcastRenderStatus,
        seam,
        (itemEvent: FreezeItemStatus) => {
          deps.broadcastToWorkbenchWindows(FREEZE_ITEM_STATUS_CHANNEL, itemEvent);
        },
      );

      if (result.ok && (result.frozenCount > 0 || result.unfrozenCount > 0)) {
        const label =
          result.frozenCount > 0 && result.unfrozenCount > 0
            ? 'Freeze/Unfreeze Score Objects'
            : result.frozenCount > 0
              ? 'Freeze Score Objects'
              : 'Unfreeze Score Objects';
        const receipt = await deps.getProjectHistory().commitPreparedStructuralMutation({
          label,
          candidate: stagedProject,
          rootFields: ['score', 'sObjLib'],
          expectedDocumentId: initialDocumentId,
          expectedSessionId: initialSessionId,
          expectedRevision: initialRevision,
          proposalToken: request.historyProposalToken,
          validateBeforeCommit: ({ filePath }) =>
            pendingArtifacts.settlement?.validateCommit(filePath),
          onCommitted: () => {
            activeRenderCancellationSignal = null;
            pendingArtifacts.settlement?.accept();
          },
        });
        if (receipt.changed) {
          result.project = deps.getCurrentProjectDocument();
        } else {
          result.ok = false;
          result.cancelled = cancellationSignal.cancelled;
          result.frozenCount = 0;
          result.unfrozenCount = 0;
          result.error = result.cancelled
            ? null
            : (receipt.oversizeProposal?.explanation ??
              receipt.error ??
              'Freeze result was not committed to project history.');
          if (receipt.oversizeProposal) {
            result.historyOversizeProposal = receipt.oversizeProposal;
          }
        }
      }

      return result;
    } finally {
      try {
        pendingArtifacts.settlement?.discard();
      } finally {
        finishRenderOperation(operationId);
      }
    }
  }

  async function handleMcpRenderToDisk(
    request: McpRenderToDiskRequest,
  ): Promise<McpResult<ConfinedMcpRenderSuccess>> {
    const resolveReceipt = (): McpDocumentReceipt | null => {
      if (request.getCurrentReceipt) {
        return request.getCurrentReceipt();
      }
      if (!deps.getCurrentData()) return null;
      const documentId = deps.getCurrentProjectSessionDocumentId();
      const stateId = deps.getCurrentProjectStateId?.() ?? '';
      if (!documentId || !stateId) return null;
      return {
        documentId,
        revision: deps.getCurrentProjectRevision(),
        stateId,
      };
    };

    if (request.auth.signal.aborted) {
      return { ok: false, code: 'CANCELLED', message: 'The MCP render request was cancelled.' };
    }
    if (
      !request.auth.isAuthorized() ||
      request.auth.accessMode !== 'read-write' ||
      request.auth.action !== 'runtime'
    ) {
      return {
        ok: false,
        code: 'ACCESS_DENIED',
        message: 'Read-write MCP authorization is required to render to disk.',
      };
    }

    const data = deps.getCurrentData();
    if (!data) {
      return {
        ok: false,
        code: 'NO_ACTIVE_PROJECT',
        message: 'No project is currently open in Blue. Open or create a project and retry.',
      };
    }

    const currentReceipt = resolveReceipt();
    if (
      !currentReceipt ||
      currentReceipt.documentId !== request.expectedReceipt.documentId ||
      currentReceipt.revision !== request.expectedReceipt.revision ||
      currentReceipt.stateId !== request.expectedReceipt.stateId
    ) {
      return {
        ok: false,
        code: 'CONFLICT',
        message:
          'The active project changed before rendering started. Reread the receipt and retry.',
      };
    }

    if (activeRenderOperationId) {
      return {
        ok: false,
        code: 'BUSY',
        message: 'Another render/freeze operation is already running.',
      };
    }

    const operationId = request.operationId ?? `mcp-disk-${Date.now()}`;
    activeRenderOperationId = operationId;
    activeRenderAction = null;
    const cancellationSignal = { cancelled: false };
    activeRenderCancellationSignal = cancellationSignal;
    activeRenderAbortController = new AbortController();
    deps.rebuildApplicationMenuIfChanged();

    let settleRender!: () => void;
    activeMcpRenderSettlement = new Promise<void>((resolve) => {
      settleRender = resolve;
    });

    const onAbort = (): void => {
      cancellationSignal.cancelled = true;
      activeRenderAbortController?.abort();
    };
    request.auth.signal.addEventListener('abort', onAbort, { once: true });
    if (request.auth.signal.aborted) {
      onAbort();
    }

    try {
      const settings = deps.loadProgramSettings();
      const seam = createCsoundExecutionSeam(cancellationSignal);

      return await executeConfinedMcpRender({
        data,
        expectedReceipt: request.expectedReceipt,
        getCurrentReceipt: resolveReceipt,
        auth: request.auth,
        nativeRoot: request.nativeRoot,
        authorizedRoot: request.authorizedRoot,
        filename: request.filename,
        diskRender: settings.diskRender,
        messageColorsEnabled: settings.general.messageColorsEnabled,
        executionSeam: seam,
        isCancelled: () => cancellationSignal.cancelled,
        fsSeam: request.fsSeam,
        platform: request.platform,
      });
    } finally {
      request.auth.signal.removeEventListener('abort', onAbort);
      activeMcpRenderSettlement = null;
      try {
        finishRenderOperation(operationId);
      } finally {
        settleRender();
      }
    }
  }

  async function handleCancelRenderOperation(
    request: CancelRenderOperationRequest,
  ): Promise<boolean> {
    if (activeRenderOperationId !== request.operationId || !activeRenderCancellationSignal) {
      return false;
    }

    activeRenderCancellationSignal.cancelled = true;
    activeRenderAbortController?.abort();

    return true;
  }

  return {
    isRenderOperationActive: () => activeRenderOperationId !== null,
    createCsoundExecutionSeam,
    handleRenderToDisk,
    handleMcpRenderToDisk,
    handleFreezeScoreObjects,
    handleCancelRenderOperation,
    async shutdownMcpRender() {
      if (!activeMcpRenderSettlement) return;
      activeRenderAbortController?.abort();
      await activeMcpRenderSettlement;
    },
  };
}
