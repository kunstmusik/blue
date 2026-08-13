/**
 * Pure disk-render command planner.
 *
 * Encodes the Java Blue three-layer settings contract:
 *   - Program Disk Render settings provide format/output flags
 *   - Project ProjectProperties provide message-level flags + advanced settings
 *   - diskCompleteOverride bypasses normal flags and uses project settings verbatim
 *
 * Keeps executable resolution and filesystem access outside the pure planner.
 */
import type { DiskRenderSettingsSnapshot } from '../shared/program-settings';
import type { ProjectProperties } from '@blue/data';

export type DiskCommandMode = 'normal' | 'completeOverride';

export interface DiskCommandPlan {
  mode: DiskCommandMode;
  args: string[];
  /** Output path extracted from the plan; null when not identifiable. */
  outputPath: string | null;
}

export interface DiskCommandInputs {
  diskRender: DiskRenderSettingsSnapshot;
  props: ProjectProperties;
  /** Resolved output file path (absolute). Null when not yet resolved (e.g. askOnRender). */
  outputFile: string | null;
  /** Whether message colors are enabled (General setting). */
  messageColorsEnabled: boolean;
}

const AUDIO_EXTENSIONS = ['.wav', '.aiff', '.aif', '.aifc', '.flac', '.au', '.raw', '.w64', '.wavex', '.sd2'];

/**
 * Compute the disk message-level bitmask from project properties.
 * Mirrors Java: noteAmps=1, outOfRange=2, warnings=4, benchmark=128.
 */
export function getDiskMessageLevel(props: ProjectProperties): number {
  let level = 0;
  if (props.diskNoteAmpsEnabled) level += 1;
  if (props.diskOutOfRangeEnabled) level += 2;
  if (props.diskWarningsEnabled) level += 4;
  if (props.diskBenchmarkEnabled) level += 128;
  return level;
}

/**
 * Tokenize a command/option string respecting double and single quotes.
 */
export function tokenizeCommand(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches
    .map((token) => token.trim())
    .map((token) => (
      (token.startsWith('"') && token.endsWith('"'))
      || (token.startsWith("'") && token.endsWith("'"))
        ? token.slice(1, -1)
        : token
    ))
    .filter((token) => token.length > 0);
}

/**
 * Extract the output file path from a complete-override command.
 * Mirrors Java's getFileOutputFromCommand: scan tokens for audio extensions.
 */
export function extractOutputFromCommand(args: string[]): string | null {
  for (let index = 0; index < args.length; index++) {
    const token = args[index]!;
    if (token === '-o') {
      const output = args[index + 1];
      if (output && !output.startsWith('-')) return output;
      continue;
    }
    if (token.startsWith('-o') && token.length > 2) {
      return token.slice(2);
    }

    const lower = token.toLowerCase();
    for (const ext of AUDIO_EXTENSIONS) {
      if (lower.endsWith(ext)) {
        return token;
      }
    }
  }
  return null;
}

/**
 * Build the Program Disk Render flag tokens (the Java getCommandLine() equivalent).
 * Does NOT include the executable, the project message flag, project advanced
 * settings, or the output file.
 */
function buildDiskRenderFlags(diskRender: DiskRenderSettingsSnapshot, messageColorsEnabled: boolean): string[] {
  const flags: string[] = [];

  if (!messageColorsEnabled) {
    flags.push('-+msg_color=false');
  }

  if (diskRender.fileFormatEnabled) {
    let formatArg = `--format=${diskRender.fileFormat.toLowerCase()}`;
    if (diskRender.sampleFormatEnabled) {
      formatArg += `:${diskRender.sampleFormat.toLowerCase()}`;
    }
    flags.push(formatArg);
  }

  if (!diskRender.savePeakInformation) {
    flags.push('-K');
  }

  if (diskRender.ditherOutput) {
    flags.push('-Z');
  }

  if (diskRender.rewriteHeader) {
    flags.push('-R');
  }

  if (diskRender.displaysDisabled) {
    flags.push('-d');
  }

  return flags;
}

/**
 * Plan the complete disk-render command from the three-layer settings.
 *
 * Normal mode: executable + disk-render flags + project message flag +
 *   project advanced settings + `-o` + output file (separate arg).
 *
 * Complete-override mode: project diskAdvancedSettings verbatim +
 *   `-+msg_color=false` when applicable. Output extracted from the command.
 */
export function planDiskCommand(inputs: DiskCommandInputs): DiskCommandPlan {
  const { diskRender, props, outputFile, messageColorsEnabled } = inputs;

  // ─── Complete override mode ───
  if (props.diskCompleteOverride) {
    const overrideText = props.diskAdvancedSettings || props.diskCommandLine || '';
    const args = tokenizeCommand(overrideText);

    if (!messageColorsEnabled) {
      args.push('-+msg_color=false');
    }

    const extractedOutput = extractOutputFromCommand(args);
    if (!extractedOutput) {
      throw new Error('Complete disk-render override must include an output file using -o.');
    }

    return {
      mode: 'completeOverride',
      args,
      outputPath: extractedOutput,
    };
  }

  // ─── Normal mode ───
  if (!outputFile) {
    throw new Error('Normal disk render requires a resolved output file path');
  }

  const args: string[] = [];

  if (!messageColorsEnabled) {
    args.push('-+msg_color=false');
  }

  args.push(...buildDiskRenderFlags(diskRender, true));

  args.push(`-m${getDiskMessageLevel(props)}`);

  args.push(...tokenizeCommand(props.diskAdvancedSettings));

  args.push('-o');
  args.push(outputFile);

  return {
    mode: 'normal',
    args,
    outputPath: outputFile,
  };
}

/**
 * Build the freeze command plan from Utility settings.
 *
 * Mirrors Java: executable + freezeFlags tokens + outputFilePath + csdPath.
 * No ordinary Disk Render flags are inherited.
 */
export interface FreezeCommandInputs {
  freezeFlags: string;
  outputFilePath: string;
  csdPath: string;
}

export function planFreezeCommand(inputs: FreezeCommandInputs): { args: string[] } {
  const flagTokens = tokenizeCommand(inputs.freezeFlags);
  return {
    args: [...flagTokens, inputs.outputFilePath, inputs.csdPath],
  };
}
