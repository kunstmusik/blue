import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Command } from 'commander';
import { BlueData, initializeJavaScriptRuntime } from '@blue/data';

export type CompileMode = 'disk' | 'realtime' | 'bluelive';

interface CompileCommandOptions {
  project: string;
  output: string;
  realtime?: boolean;
  bluelive?: boolean;
}

interface CompileProjectRequest {
  projectPath: string;
  outputPath: string;
  mode: CompileMode;
}

export function resolveCompileMode(
  options: Pick<CompileCommandOptions, 'realtime' | 'bluelive'>,
): CompileMode {
  if (options.realtime && options.bluelive) {
    throw new Error('`--realtime` and `--bluelive` are mutually exclusive.');
  }

  if (options.bluelive) {
    return 'bluelive';
  }

  if (options.realtime) {
    return 'realtime';
  }

  return 'disk';
}

export async function compileProject(
  request: CompileProjectRequest,
): Promise<{ bytesWritten: number }> {
  const projectPath = path.resolve(request.projectPath);
  const outputPath = path.resolve(request.outputPath);

  const source = await fs.readFile(projectPath, 'utf8');
  await initializeJavaScriptRuntime();

  const project = BlueData.loadFromString(source);
  const csd =
    request.mode === 'bluelive'
      ? project.toBlueLiveCSD().csdText
      : request.mode === 'realtime'
        ? project.toCSD()
        : project.toDiskCSD();

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, csd, 'utf8');

  return { bytesWritten: Buffer.byteLength(csd, 'utf8') };
}

function createProgram(): Command {
  const program = new Command();

  program
    .name('blue-cli')
    .description('Compile Blue .blue projects into Csound .csd files.')
    .showHelpAfterError();

  program
    .command('compile')
    .description('Compile a Blue project to a Csound CSD file.')
    .requiredOption('-p, --project <path>', 'input .blue project file')
    .requiredOption('-o, --output <path>', 'output .csd file')
    .option('--realtime', 'generate the CSD used for realtime playback')
    .option('--bluelive', 'generate the CSD used for Blue Live playback')
    .action(async (options: CompileCommandOptions) => {
      const mode = resolveCompileMode(options);
      const { bytesWritten } = await compileProject({
        projectPath: options.project,
        outputPath: options.output,
        mode,
      });

      process.stdout.write(
        `Wrote ${path.resolve(options.output)} (${mode}, ${bytesWritten} bytes)\n`,
      );
    });

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
