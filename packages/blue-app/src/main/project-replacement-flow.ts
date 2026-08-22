/**
 * Dependency-injected project replacement sequencing (see
 * specs/080-defer-replacement-prompts/contracts/replacement-flow.md).
 *
 * The coordinator owns stage ordering and cancellation semantics only. It
 * does not mutate currentData, currentFilePath, editor windows, runtime
 * sessions, library state, or MIDI pending state; main.ts supplies the
 * Electron dialogs and lifecycle callbacks.
 */

export type ReplacementFlowOutcome =
  | { status: 'committed' }
  | { status: 'no-op' }
  | { status: 'cancelled' }
  | { status: 'blocked' };

export interface ReplacementFlowCallbacks<Target> {
  /** Render/freeze safety gate. Runs before prepare and again before prompts. */
  preflight: () => Promise<boolean> | boolean;
  /**
   * Collect every cancelable chooser/configuration decision and validate the
   * selected source. Returns null when the user cancelled or nothing was
   * selected; throws when the source is invalid (the caller shows its
   * existing load/import error dialog).
   */
  prepare: () => Promise<Target | null> | Target | null;
  /** Same-file no-op detection for project-file targets. */
  isNoOp?: (target: Target) => boolean;
  /** Related library-draft decision. False blocks replacement. */
  confirmLibraryDraft: (target: Target) => Promise<boolean> | boolean;
  /** Project-save decision for the accepted target. False blocks replacement. */
  confirmSave: (target: Target) => Promise<boolean> | boolean;
  /** Install the prepared target through the existing lifecycle. */
  commit: (target: Target) => Promise<void> | void;
}

/**
 * Run one interactive replacement request through the shared stage order:
 * preflight -> prepare -> no-op check -> preflight re-check -> library
 * decision -> save decision -> single commit.
 */
export async function runReplacementFlow<Target>(
  flow: ReplacementFlowCallbacks<Target>,
): Promise<ReplacementFlowOutcome> {
  if (!(await flow.preflight())) {
    return { status: 'cancelled' };
  }

  const target = await flow.prepare();
  if (target === null || target === undefined) {
    return { status: 'cancelled' };
  }

  if (flow.isNoOp !== undefined && flow.isNoOp(target)) {
    return { status: 'no-op' };
  }

  if (!(await flow.preflight())) {
    return { status: 'cancelled' };
  }

  if (!(await flow.confirmLibraryDraft(target))) {
    return { status: 'blocked' };
  }

  if (!(await flow.confirmSave(target))) {
    return { status: 'blocked' };
  }

  await flow.commit(target);
  return { status: 'committed' };
}

/**
 * Project-file entry path (Open Project, keyboard/preload open, recent
 * projects, examples): select the source, read and parse it, apply the
 * canonical same-file no-op, then run the accepted-target replacement
 * decisions and a single commit.
 */
export interface ProjectFileReplacementDependencies<Project> {
  /** Native chooser. Returns null when cancelled; absent for fixed-path routes. */
  selectFile: () => Promise<string | null> | string | null;
  readFile: (filePath: string) => string;
  parseProject: (xml: string, filePath: string) => Promise<Project> | Project;
  /** Canonical same-file comparison against the current project path. */
  isSameFile: (filePath: string) => boolean;
  preflight: () => Promise<boolean> | boolean;
  confirmLibraryDraft: (filePath: string) => Promise<boolean> | boolean;
  confirmSave: (filePath: string) => Promise<boolean> | boolean;
  commit: (project: Project, filePath: string) => Promise<void> | void;
}

interface PreparedProjectFile<Project> {
  project: Project;
  filePath: string;
}

export async function runProjectFileReplacement<Project>(
  dependencies: ProjectFileReplacementDependencies<Project>,
): Promise<ReplacementFlowOutcome> {
  return runReplacementFlow<PreparedProjectFile<Project>>({
    preflight: dependencies.preflight,
    prepare: async () => {
      const filePath = await dependencies.selectFile();
      if (filePath === null || filePath === undefined) {
        return null;
      }
      const xml = dependencies.readFile(filePath);
      const project = await dependencies.parseProject(xml, filePath);
      return { project, filePath };
    },
    isNoOp: (target) => dependencies.isSameFile(target.filePath),
    confirmLibraryDraft: (target) => dependencies.confirmLibraryDraft(target.filePath),
    confirmSave: (target) => dependencies.confirmSave(target.filePath),
    commit: (target) => dependencies.commit(target.project, target.filePath),
  });
}

export type ReplacementSaveChoice = 'save' | 'discard' | 'cancel';
export type ReplacementSaveOutcome = 'saved' | 'discarded' | 'cancelled' | 'blocked';

export interface ReplacementSaveDecisionDependencies {
  /** Presents the Save Changes decision dialog. */
  choose: () => Promise<ReplacementSaveChoice> | ReplacementSaveChoice;
  hasCurrentProject: () => boolean;
  hasCurrentPath: () => boolean;
  /** Durable save to the current path; false on write failure. */
  saveCurrent: () => boolean;
  /** Transactional Save As; false on cancel, overwrite decline, or failure. */
  saveAs: () => Promise<boolean> | boolean;
}

/**
 * Resolve the replacement save decision. Replacement proceeds only on
 * 'saved' (durable write, including a successful Save As) or 'discarded';
 * 'cancelled' and 'blocked' leave the current project session intact.
 */
export async function resolveReplacementSaveDecision(
  dependencies: ReplacementSaveDecisionDependencies,
): Promise<ReplacementSaveOutcome> {
  if (!dependencies.hasCurrentProject()) {
    return 'discarded';
  }

  const choice = await dependencies.choose();
  if (choice === 'cancel') {
    return 'cancelled';
  }
  if (choice === 'discard') {
    return 'discarded';
  }

  if (dependencies.hasCurrentPath()) {
    return dependencies.saveCurrent() ? 'saved' : 'blocked';
  }
  return (await dependencies.saveAs()) ? 'saved' : 'blocked';
}

export interface TransactionalSaveAsDependencies {
  /** Save dialog; null when cancelled or an overwrite is declined. */
  chooseDestination: () => Promise<string | null> | string | null;
  /** Durable write of the current project; false on failure. */
  writeProject: (filePath: string) => boolean;
  /** Publishes the new current path; only called after a successful write. */
  publishPath: (filePath: string) => void;
}

/**
 * Transactional Save As: the new current path is published only after the
 * write succeeds, so a cancelled or failed save leaves the recovery path
 * stable.
 */
export async function runTransactionalSaveAs(
  dependencies: TransactionalSaveAsDependencies,
): Promise<boolean> {
  const destination = await dependencies.chooseDestination();
  if (destination === null || destination === undefined) {
    return false;
  }

  if (!dependencies.writeProject(destination)) {
    return false;
  }

  dependencies.publishPath(destination);
  return true;
}
