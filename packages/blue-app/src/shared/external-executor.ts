export interface ExternalTestRequest {
  commandLine: string;
  text: string;
  projectDir: string | null;
}

export interface ExternalTestResult {
  ok: boolean;
  output: string;
  error?: string;
}

export function prepareCommandLine(
  commandLine: string,
  inFileName: string,
  outFileName?: string,
): string {
  let cmd = commandLine;
  if (!cmd.includes('$infile')) {
    cmd = cmd + ' ' + inFileName;
  } else {
    cmd = cmd.replace(/\$infile/g, inFileName);
  }
  if (outFileName !== undefined) {
    cmd = cmd.replace(/\$outfile/g, outFileName);
  }
  return cmd.trim();
}

export function shouldUseOutFile(commandLine: string): boolean {
  return commandLine.includes('$outfile');
}
