import { runReplacementFlow, type ReplacementFlowOutcome } from './project-replacement-flow';

export interface ReplacementFileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface ReplacementChoiceDialogResult {
  response: number;
}

export interface CsdImportReplacementDependencies<Project, Mode> {
  preflight: () => Promise<boolean> | boolean;
  showSourceDialog: () => Promise<ReplacementFileDialogResult>;
  showModeDialog: () => Promise<ReplacementChoiceDialogResult>;
  cancelModeResponse: number;
  readSource: (filePath: string) => string;
  convert: (source: string, mode: Mode) => Promise<Project> | Project;
  confirmLibraryDraft: () => Promise<boolean> | boolean;
  confirmSave: () => Promise<boolean> | boolean;
  commit: (project: Project) => Promise<void> | void;
}

/**
 * Adapter for the CSD import entry point. Electron dialogs and conversion
 * are injected so the main-process sequencing can be tested without opening
 * native windows.
 */
export async function runCsdImportReplacement<Project, Mode>(
  dependencies: CsdImportReplacementDependencies<Project, Mode>,
): Promise<ReplacementFlowOutcome> {
  return runReplacementFlow<Project>({
    preflight: dependencies.preflight,
    prepare: async () => {
      const sourceResult = await dependencies.showSourceDialog();
      const filePath = sourceResult.filePaths[0];
      if (sourceResult.canceled || filePath === undefined) {
        return null;
      }

      const modeResult = await dependencies.showModeDialog();
      if (modeResult.response === dependencies.cancelModeResponse) {
        return null;
      }

      const source = dependencies.readSource(filePath);
      return dependencies.convert(source, modeResult.response as Mode);
    },
    confirmLibraryDraft: () => dependencies.confirmLibraryDraft(),
    confirmSave: () => dependencies.confirmSave(),
    commit: dependencies.commit,
  });
}

export interface OrcScoImportReplacementDependencies<Project, Mode> {
  preflight: () => Promise<boolean> | boolean;
  showOrcDialog: () => Promise<ReplacementFileDialogResult>;
  showScoDialog: () => Promise<ReplacementFileDialogResult>;
  showModeDialog: () => Promise<ReplacementChoiceDialogResult>;
  cancelModeResponse: number;
  readSource: (filePath: string) => string;
  convert: (orc: string, sco: string, mode: Mode) => Promise<Project> | Project;
  confirmLibraryDraft: () => Promise<boolean> | boolean;
  confirmSave: () => Promise<boolean> | boolean;
  commit: (project: Project) => Promise<void> | void;
}

/** Adapter for the two-file ORC/SCO import entry point. */
export async function runOrcScoImportReplacement<Project, Mode>(
  dependencies: OrcScoImportReplacementDependencies<Project, Mode>,
): Promise<ReplacementFlowOutcome> {
  return runReplacementFlow<Project>({
    preflight: dependencies.preflight,
    prepare: async () => {
      const orcResult = await dependencies.showOrcDialog();
      const orcPath = orcResult.filePaths[0];
      if (orcResult.canceled || orcPath === undefined) {
        return null;
      }

      const scoResult = await dependencies.showScoDialog();
      const scoPath = scoResult.filePaths[0];
      if (scoResult.canceled || scoPath === undefined) {
        return null;
      }

      const modeResult = await dependencies.showModeDialog();
      if (modeResult.response === dependencies.cancelModeResponse) {
        return null;
      }

      const orc = dependencies.readSource(orcPath);
      const sco = dependencies.readSource(scoPath);
      return dependencies.convert(orc, sco, modeResult.response as Mode);
    },
    confirmLibraryDraft: () => dependencies.confirmLibraryDraft(),
    confirmSave: () => dependencies.confirmSave(),
    commit: dependencies.commit,
  });
}

export interface MidiImportReplacementDependencies<Project> {
  preflight: () => Promise<boolean> | boolean;
  prepare: () => Promise<Project | null> | Project | null;
  confirmLibraryDraft: () => Promise<boolean> | boolean;
  confirmSave: () => Promise<boolean> | boolean;
  revalidate: () => Promise<void> | void;
  commit: (project: Project) => Promise<void> | void;
}

/**
 * Adapter for MIDI commit. Revalidation stays immediately before the actual
 * install so cancelled decisions preserve the pending mapping session.
 */
export async function runMidiImportReplacement<Project>(
  dependencies: MidiImportReplacementDependencies<Project>,
): Promise<ReplacementFlowOutcome> {
  return runReplacementFlow<Project>({
    preflight: dependencies.preflight,
    prepare: dependencies.prepare,
    confirmLibraryDraft: dependencies.confirmLibraryDraft,
    confirmSave: dependencies.confirmSave,
    commit: async (project) => {
      await dependencies.revalidate();
      await dependencies.commit(project);
    },
  });
}

export interface NonInteractiveProjectLoadDependencies<Project> {
  filePath: string;
  preflight: () => Promise<boolean> | boolean;
  readProject: (filePath: string) => Promise<Project> | Project;
  installProject: (project: Project, filePath: string) => Promise<void> | void;
  reportError: (filePath: string, error: unknown) => Promise<void> | void;
}

/**
 * Load a project for revert and packaged verification without replacement
 * prompts. Interactive opens use the replacement entry points instead.
 */
export async function runNonInteractiveProjectLoad<Project>(
  dependencies: NonInteractiveProjectLoadDependencies<Project>,
): Promise<boolean> {
  if (!(await dependencies.preflight())) {
    return false;
  }

  try {
    const project = await dependencies.readProject(dependencies.filePath);
    await dependencies.installProject(project, dependencies.filePath);
    return true;
  } catch (error: unknown) {
    await dependencies.reportError(dependencies.filePath, error);
    return false;
  }
}
