import * as nodePath from 'path';
import type { CandidateGeneration, ExampleLibraryInspection } from './example-library/service';

/**
 * Dependency-injected Open Example coordinator
 * (contracts/example-library-lifecycle.md, "Open Example Flow"). Owns
 * user-decision ordering and candidate cleanup without importing Electron;
 * main.ts supplies native dialogs, pickers, and the existing accepted-target
 * replacement gates.
 */

export interface InspectedStep {
  ok: true;
  inspection: ExampleLibraryInspection;
}
export interface BlockedStep {
  ok: false;
  kind: 'inspection-blocked';
  diagnostic: string;
}

export type InspectionStepResult = InspectedStep | BlockedStep;

export interface PreparationSucceeded {
  ok: true;
  candidate: CandidateGeneration | null;
}
export interface PreparationFailed {
  ok: false;
  code: string;
  message: string;
  retryable: boolean;
}

export type PreparationStepResult = PreparationSucceeded | PreparationFailed;

export interface ProjectLoadedOk<Project> {
  ok: true;
  project: Project;
}
export interface ProjectLoadFailed {
  ok: false;
  message: string;
}

export type ProjectLoadResult<Project> = ProjectLoadedOk<Project> | ProjectLoadFailed;

export type OpenExampleCommitStepResult =
  | { ok: true }
  | { ok: false; message: string; retryable: boolean };

export interface ResolvedExampleSelection {
  /** Existing project file to parse before any candidate is committed. */
  filePath: string;
  /** Location beneath the offered library content root. */
  relativePath: string;
}

export interface UpdateConflictReport {
  total: number;
  /** Bounded path sample for display. */
  samples: string[];
}

export type UpdateOfferChoice = 'update-and-open' | 'keep-current-and-open' | 'cancel';

export type OpenExampleFlowStatus = 'committed' | 'no-op' | 'cancelled' | 'blocked' | 'failed';

export interface OpenExampleFlowDependencies<Project> {
  /** Render/freeze safety gate; runs first and again after preparation. */
  preflight: () => Promise<boolean> | boolean;

  // -- Inspection & recovery (service-bound) ------------------------------
  runRecoveryAndInspect: () => Promise<InspectionStepResult>;
  prepareFirstUseCopy: () => Promise<PreparationStepResult>;
  prepareUpdateCandidate: () => Promise<PreparationStepResult>;
  recordKeepCurrentDecline: () => Promise<OpenExampleCommitStepResult>;
  commitCandidateOrNull: (
    candidate: CandidateGeneration | null,
  ) => Promise<OpenExampleCommitStepResult>;
  discardCandidate: (candidate: CandidateGeneration | null) => Promise<void>;

  // -- Native decision surfaces (fail closed to cancel) --------------------
  chooseFirstUseCopy: () => Promise<boolean>;
  chooseForUpdateOffer: () => Promise<UpdateOfferChoice>;
  chooseContinueDespiteUpdateConflicts: (report: UpdateConflictReport) => Promise<boolean>;
  chooseOpenCurrentExamplesWithoutUpdateCheck: () => Promise<boolean>;
  /**
   * Spec edge-case guard: when the active project is an example inside the
   * current library, its save/discard/cancel protection must run before a
   * library swap can modify its file. False aborts the swap (candidate is
   * discarded).
   */
  ensureActiveProjectSafeBeforeLibrarySwap: () => Promise<boolean> | boolean;

  // -- Picker, containment, parse ------------------------------------------
  showProjectPicker: (defaultRoot: string) => Promise<string | null>;
  /**
   * Resolve a picker result into the offered generation. The main-process
   * adapter may map the equivalent path from the stable Blue-owned current
   * tree when a native picker returns that tree during a staged update.
   */
  resolvePickerSelection: (
    selectedPath: string,
    offeredRoot: string,
  ) => ResolvedExampleSelection | null;
  loadProjectFromFile: (filePath: string) => Promise<ProjectLoadResult<Project>>;

  // -- Replacement composition (existing lifecycle) -------------------------
  isSameFileAsCurrent: (finalContentPath: string) => boolean;
  confirmLibraryDraftTransition: (finalContentPath: string) => Promise<boolean> | boolean;
  confirmSaveBeforeReplace: (finalContentPath: string) => Promise<boolean> | boolean;
  getCurrentContentRoot: () => string;
  installParsedProject: (project: Project, finalContentPath: string) => Promise<void> | void;

  // -- User-facing diagnostics ------------------------------------------------
  reportBlockedLibrary: (diagnostic: string) => Promise<void> | void;
  reportRejectedSelection: (selectedPath: string) => Promise<void> | void;
  reportPreparationFailure: (message: string, retryable: boolean) => Promise<boolean> | boolean;
  reportProjectLoadFailure: (message: string) => Promise<void> | void;
  reportPostCommitInstallFailure: (message: string) => Promise<void> | void;
}

/** Summarize preserved-conflict paths carried by an updated candidate state. */
function conflictSummaryFrom(candidate: CandidateGeneration | null): UpdateConflictReport | null {
  const summary = candidate?.summary;
  if (summary === null || summary === undefined) {
    return null;
  }
  const total = summary.totalConflicts + summary.totalCollisions;
  if (total === 0) {
    return null;
  }
  return {
    total,
    samples: [...summary.collisions, ...summary.conflicts].sort().slice(0, 6),
  };
}

/** Native-dialog detail for a bounded deterministic conflict summary. */
export function formatExampleConflictDetail(report: UpdateConflictReport): string {
  const noun = report.total === 1 ? 'file needs' : 'files need';
  const visible = report.samples.slice(0, 6);
  const remaining = Math.max(0, report.total - visible.length);
  const lines = [`${report.total} ${noun} attention.`];
  if (visible.length > 0) {
    lines.push('', ...visible);
  }
  if (remaining > 0) {
    lines.push(`…and ${remaining} more.`);
  }
  return lines.join('\n');
}

export async function runOpenExampleProjectFlow<Project>(
  dependencies: OpenExampleFlowDependencies<Project>,
): Promise<{ status: OpenExampleFlowStatus; detail?: string }> {
  type AttemptResult =
    | { status: OpenExampleFlowStatus; detail?: string }
    | { status: 'retry-requested'; detail: string };

  const requestRetry = async (message: string, retryable: boolean): Promise<AttemptResult> => {
    const retry = await dependencies.reportPreparationFailure(message, retryable);
    return retry
      ? { status: 'retry-requested', detail: message }
      : { status: 'cancelled', detail: message };
  };

  const runAttempt = async (): Promise<AttemptResult> => {
    if (!(await dependencies.preflight())) {
      return { status: 'cancelled' };
    }

    const step = await dependencies.runRecoveryAndInspect();
    if (!step.ok) {
      await dependencies.reportBlockedLibrary(step.diagnostic);
      return { status: 'blocked', detail: step.diagnostic };
    }

    const { inspection } = step;
    let candidate: CandidateGeneration | null = null;
    try {
      let pickerRoot: string;

      switch (inspection.status) {
        case 'needs-initialization': {
          if (!(await dependencies.chooseFirstUseCopy())) {
            return { status: 'cancelled' };
          }
          const prepared = await dependencies.prepareFirstUseCopy();
          if (!prepared.ok) {
            return requestRetry(prepared.message, prepared.retryable);
          }
          candidate = prepared.candidate;
          pickerRoot = prepared.candidate?.contentPath ?? dependencies.getCurrentContentRoot();
          break;
        }

        case 'ready':
        case 'declined-current': {
          pickerRoot = inspection.current.contentPath;
          break;
        }

        case 'update-available': {
          const choice = await dependencies.chooseForUpdateOffer();
          if (choice === 'cancel') {
            return { status: 'cancelled' };
          }
          if (choice === 'keep-current-and-open') {
            const recorded = await dependencies.recordKeepCurrentDecline();
            if (!recorded.ok) {
              return requestRetry(recorded.message, recorded.retryable);
            }
            pickerRoot = inspection.current.contentPath;
            break;
          }
          const prepared = await dependencies.prepareUpdateCandidate();
          if (!prepared.ok) {
            return requestRetry(prepared.message, prepared.retryable);
          }
          candidate = prepared.candidate;
          const summary = conflictSummaryFrom(prepared.candidate);
          if (
            summary !== null &&
            !(await dependencies.chooseContinueDespiteUpdateConflicts(summary))
          ) {
            return { status: 'cancelled' };
          }
          pickerRoot = prepared.candidate?.contentPath ?? dependencies.getCurrentContentRoot();
          break;
        }

        case 'factory-unavailable': {
          if (!(await dependencies.chooseOpenCurrentExamplesWithoutUpdateCheck())) {
            return { status: 'cancelled' };
          }
          pickerRoot = inspection.current.contentPath;
          break;
        }

        case 'invalid-user-library':
        case 'unavailable': {
          await dependencies.reportBlockedLibrary(inspection.diagnostic);
          return { status: 'blocked', detail: inspection.diagnostic };
        }

        default:
          return { status: 'blocked', detail: 'Unhandled example-library inspection.' };
      }

      const MAX_PICKER_ATTEMPTS = 5;
      let selection: ResolvedExampleSelection | null = null;
      for (let attempt = 0; attempt < MAX_PICKER_ATTEMPTS; attempt += 1) {
        const picked = await dependencies.showProjectPicker(pickerRoot);
        if (picked === null || picked === undefined) {
          return { status: 'cancelled' };
        }
        const resolved = dependencies.resolvePickerSelection(picked, pickerRoot);
        if (resolved !== null) {
          selection = resolved;
          break;
        }
        await dependencies.reportRejectedSelection(picked);
      }
      if (selection === null) {
        return { status: 'blocked', detail: 'No example selection was accepted.' };
      }

      const loaded = await dependencies.loadProjectFromFile(selection.filePath);
      if (!loaded.ok) {
        await dependencies.reportProjectLoadFailure(loaded.message);
        return { status: 'cancelled' };
      }

      const finalContentPath = nodePath.join(
        dependencies.getCurrentContentRoot(),
        selection.relativePath,
      );

      if (candidate === null && dependencies.isSameFileAsCurrent(finalContentPath)) {
        return { status: 'no-op' };
      }
      if (!(await dependencies.preflight())) {
        return { status: 'cancelled' };
      }
      if (!(await dependencies.confirmLibraryDraftTransition(finalContentPath))) {
        return { status: 'blocked' };
      }
      if (!(await dependencies.confirmSaveBeforeReplace(finalContentPath))) {
        return { status: 'blocked' };
      }

      if (
        candidate?.kind === 'update' &&
        !(await dependencies.ensureActiveProjectSafeBeforeLibrarySwap())
      ) {
        return { status: 'cancelled', detail: 'Library swap deferred.' };
      }

      if (candidate !== null) {
        const committed = await dependencies.commitCandidateOrNull(candidate);
        if (!committed.ok) {
          return requestRetry(committed.message, committed.retryable);
        }
        candidate = null;
      }

      try {
        await dependencies.installParsedProject(loaded.project, finalContentPath);
      } catch (err) {
        await dependencies.reportPostCommitInstallFailure(
          err instanceof Error ? err.message : String(err),
        );
        return { status: 'cancelled' };
      }

      return { status: 'committed' };
    } finally {
      await dependencies.discardCandidate(candidate);
    }
  };

  const MAX_FLOW_ATTEMPTS = 2;
  let lastRetryDetail = 'The example library operation did not complete.';
  for (let attempt = 0; attempt < MAX_FLOW_ATTEMPTS; attempt += 1) {
    const result = await runAttempt();
    if (result.status !== 'retry-requested') {
      return result;
    }
    lastRetryDetail = result.detail;
  }
  return { status: 'failed', detail: lastRetryDetail };
}
