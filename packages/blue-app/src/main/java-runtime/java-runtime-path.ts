import * as fs from 'fs';
import * as path from 'path';

export interface JavaRuntimePathContext {
  isPackaged: boolean;
  mainModuleDir: string;
  resourcesPath?: string;
  userDataPath?: string;
  existsSync?: (filePath: string) => boolean;
}

export interface JavaRuntimeArtifactResolution {
  artifactPath: string;
  candidatePaths: string[];
  exists: boolean;
}

export interface JavaRuntimePythonLibraryResolution {
  packagedLibraryRoot: string;
  packagedCandidateRoots: string[];
  userLibraryRoot: string | null;
  exists: boolean;
}

export function getJavaRuntimeArtifactCandidates(context: JavaRuntimePathContext): string[] {
  if (!context.isPackaged) {
    return [path.resolve(context.mainModuleDir, '../../assets/java/blue-java.jar')];
  }

  const resourcesPath = context.resourcesPath ?? '';
  return [
    path.join(resourcesPath, 'assets', 'java', 'blue-java.jar'),
    path.join(resourcesPath, 'app.asar.unpacked', 'assets', 'java', 'blue-java.jar'),
    path.join(
      resourcesPath,
      'app.asar.unpacked',
      'packages',
      'blue-app',
      'assets',
      'java',
      'blue-java.jar',
    ),
  ];
}

export function resolveJavaRuntimeArtifactPath(
  context: JavaRuntimePathContext,
): JavaRuntimeArtifactResolution {
  const existsSync = context.existsSync ?? fs.existsSync;
  const candidatePaths = getJavaRuntimeArtifactCandidates(context);
  const artifactPath =
    candidatePaths.find((candidate) => existsSync(candidate)) ?? candidatePaths[0];

  return {
    artifactPath,
    candidatePaths,
    exists: existsSync(artifactPath),
  };
}

export function getJavaRuntimePythonLibraryCandidates(context: JavaRuntimePathContext): string[] {
  if (!context.isPackaged) {
    return [path.resolve(context.mainModuleDir, '../../assets/java/pythonLib')];
  }

  const resourcesPath = context.resourcesPath ?? '';
  return [
    path.join(resourcesPath, 'assets', 'java', 'pythonLib'),
    path.join(resourcesPath, 'app.asar.unpacked', 'assets', 'java', 'pythonLib'),
    path.join(
      resourcesPath,
      'app.asar.unpacked',
      'packages',
      'blue-app',
      'assets',
      'java',
      'pythonLib',
    ),
  ];
}

export function resolveJavaRuntimePythonLibraryPaths(
  context: JavaRuntimePathContext,
): JavaRuntimePythonLibraryResolution {
  const existsSync = context.existsSync ?? fs.existsSync;
  const packagedCandidateRoots = getJavaRuntimePythonLibraryCandidates(context);
  const packagedLibraryRoot =
    packagedCandidateRoots.find((candidate) => existsSync(candidate)) ?? packagedCandidateRoots[0];

  return {
    packagedLibraryRoot,
    packagedCandidateRoots,
    userLibraryRoot: context.userDataPath ? path.join(context.userDataPath, 'pythonLib') : null,
    exists: existsSync(packagedLibraryRoot),
  };
}
