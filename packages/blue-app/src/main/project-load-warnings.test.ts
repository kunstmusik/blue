import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createSourceFile, isFunctionDeclaration, ScriptTarget, transpileModule } from 'typescript';
import { BlueData } from '@blue/data';
import { describe, expect, it, vi } from 'vitest';
import {
  formatProjectXmlDiagnostics,
  prepareProjectXml,
  runProjectFileReplacement,
} from './project-replacement-flow';

// Execute the production load/publication functions without starting Electron.
const source = createSourceFile(
  'main.ts',
  readFileSync(join(__dirname, 'main.ts'), 'utf8'),
  ScriptTarget.Latest,
);
const names = new Set([
  'readProjectFromDisk',
  'prepareProjectForLoad',
  'openProjectFile',
  'buildAndSendProjectLoaded',
]);
const executable = transpileModule(
  source.statements
    .filter((node) => isFunctionDeclaration(node) && node.name && names.has(node.name.text))
    .map((node) => node.getText(source))
    .join('\n'),
  {
    compilerOptions: { target: ScriptTarget.ES2022 },
  },
).outputText;

function setup(xml: string) {
  let api: {
    readProjectFromDisk(path: string): Promise<BlueData>;
    buildAndSendProjectLoaded(data: BlueData, path: string): void;
    openProjectFile(path: string): Promise<boolean>;
  };
  const environment = {
    fs: { readFileSync: vi.fn(() => xml) },
    path: { basename: (value: string) => value.split('/').pop() },
    prepareProjectXml,
    formatProjectXmlDiagnostics,
    process: { env: {}, stderr: { write: vi.fn() } },
    dialog: { showErrorBox: vi.fn() },
    mainWindow: {},
    projectCompatibilityWarnings: new WeakMap(),
    createProjectEditorSnapshot: vi.fn(() => ({ loaded: true })),
    getCurrentProjectSessionId: () => 1,
    getCurrentProjectSessionDocumentId: () => 'doc-1',
    scanMissingAudioAssets: () => undefined,
    broadcastToWorkbenchWindows: vi.fn(),
    runProjectFileReplacement,
    isCurrentProjectFilePath: () => false,
    canReplaceProjectWhileRenderActive: () => true,
    confirmLibraryDraftTransition: () => true,
    confirmSaveBeforeReplaceInsideBoundary: vi.fn(() => true),
    installProjectData: (data: BlueData, filePath: string) =>
      api.buildAndSendProjectLoaded(data, filePath),
    runTerminalProjectTransition: (action: () => Promise<unknown>) => action(),
    reportProjectLoadError: vi.fn(),
  };
  const context = createContext(environment);
  runInContext(executable, context);
  api = runInContext(
    '({ readProjectFromDisk, buildAndSendProjectLoaded, openProjectFile })',
    context,
  );
  return { api, environment };
}

describe('Project compatibility warnings', () => {
  it('uses the same non-blocking report for ordinary opens and keeps cancelled opens quiet', async () => {
    const { api, environment } = setup(
      '<blueData><score><timeState><timeUnit>5</timeUnit></timeState></score></blueData>',
    );
    environment.confirmSaveBeforeReplaceInsideBoundary.mockReturnValueOnce(false);
    await expect(api.openProjectFile('/projects/legacy.blue')).resolves.toBe(false);
    expect(environment.broadcastToWorkbenchWindows).not.toHaveBeenCalled();
    await expect(api.openProjectFile('/projects/legacy.blue')).resolves.toBe(true);
    expect(environment.broadcastToWorkbenchWindows).toHaveBeenCalledWith(
      'project-loaded',
      expect.objectContaining({
        compatibilityWarnings: [expect.objectContaining({ code: 'P-TIME-STATE-HISTORICAL-RULER' })],
      }),
    );
    expect(environment.dialog.showErrorBox).not.toHaveBeenCalled();
  });

  it('loads without a native dialog and publishes diagnostics only for the installed candidate, once', async () => {
    const { api, environment } = setup(
      '<blueData><score><timeState><timeUnit>5</timeUnit></timeState></score></blueData>',
    );
    const data = await api.readProjectFromDisk('/projects/legacy.blue');
    expect(environment.dialog.showErrorBox).not.toHaveBeenCalled();
    expect(environment.broadcastToWorkbenchWindows).not.toHaveBeenCalled();
    expect(data.saveToString()).toContain('<timeUnit>5</timeUnit>');

    // A different candidate can win (or the original open can be cancelled).
    api.buildAndSendProjectLoaded(new BlueData(), '/projects/clean.blue');
    expect(environment.broadcastToWorkbenchWindows).toHaveBeenLastCalledWith(
      'project-loaded',
      expect.objectContaining({ compatibilityWarnings: undefined }),
    );

    api.buildAndSendProjectLoaded(data, '/projects/legacy.blue');
    expect(environment.broadcastToWorkbenchWindows).toHaveBeenLastCalledWith(
      'project-loaded',
      expect.objectContaining({
        compatibilityWarnings: [
          expect.objectContaining({
            code: 'P-TIME-STATE-HISTORICAL-RULER',
            severity: 'warning',
            value: '5',
          }),
        ],
      }),
    );
    api.buildAndSendProjectLoaded(data, '/projects/legacy.blue');
    expect(environment.broadcastToWorkbenchWindows).toHaveBeenLastCalledWith(
      'project-loaded',
      expect.objectContaining({ compatibilityWarnings: undefined }),
    );
  });

  it('rejects invalid input without publishing a successful load or warning notice', async () => {
    const { api, environment } = setup('<blueData><unexpected>meaningful</unexpected></blueData>');
    await expect(api.readProjectFromDisk('/projects/invalid.blue')).rejects.toMatchObject({
      diagnostics: [expect.objectContaining({ severity: 'error' })],
    });
    expect(environment.broadcastToWorkbenchWindows).not.toHaveBeenCalled();
  });
});
