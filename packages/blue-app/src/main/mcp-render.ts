import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AudioClip,
  AudioFile,
  BlueData,
  ClojureObject,
  Comment,
  Effect,
  External,
  FrozenSoundObject,
  GenericInstrument,
  GenericScore,
  Instance,
  JavaScriptObject,
  ObjectBuilder,
  PatternsLayerGroup,
  PolyObject,
  PythonObject,
  PythonProcessor,
  TrackLayerGroup,
  TuningProcessor,
  createNoteProcessorChainSnapshot,
  type NoteProcessorChain,
} from '@blue/data';
import type { DiskRenderSettingsSnapshot } from '../shared/program-settings';
import { preflightObservationOnlyDiskCsd } from './csd-generation';
import { planVettedMcpDiskCommand } from './disk-render-command';
import type {
  McpAuthContext,
  McpDocumentReceipt,
  McpDomainErrorCode,
  McpResult,
} from './mcp-bridge';
import { canonicalProjectPathIdentity } from './project-path';
import {
  estimateTotalScoreDuration,
  type ConfinedCsoundRunRequest,
  type RenderExecutionSeam,
} from './render-to-disk';

const MAX_FILENAME_LENGTH = 255;
const WINDOWS_RESERVED_DEVICE_PATTERN = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const FORBIDDEN_FILENAME_CHARS_PATTERN = /[/\\:*?"<>|]/;

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Exact pan-gains macro emitted by Blue's Mixer codegen when panning is enabled. */
const BLUE_MIXER_CALC_PAN_GAINS_MACRO = `#define BLUE_MIXER_CALC_PAN_GAINS(POS'LEFT'RIGHT'LAW'BOOST) #
$LEFT = ($LAW == 0 ? min(1, 2 * (1 - ($POS))) : $LAW == -3 ? cos(1.5707963267948966 * ($POS)) : $LAW == -4.5 ? (0.46189768862683755 * cos(1.5707963267948966 * ($POS)) + 0.5381023113731624 * (1 - ($POS))) : (1 - ($POS)))
$RIGHT = ($LAW == 0 ? min(1, 2 * ($POS)) : $LAW == -3 ? sin(1.5707963267948966 * ($POS)) : $LAW == -4.5 ? (0.46189768862683755 * sin(1.5707963267948966 * ($POS)) + 0.5381023113731624 * ($POS)) : ($POS))
if $BOOST != 0 && $LAW != 0 then
  k_pan_boost = 1 + k_pan_boost_amount * 2 * abs(($POS) - 0.5)
  $LEFT *= k_pan_boost
  $RIGHT *= k_pan_boost
endif
#`;

const HEADER_DECLARATION_NAMES = new Set(['sr', 'ksmps', 'nchnls', '0dbfs']);

const VETTED_CSOUND_OPCODES = new Set([
  // Oscillators & sources
  'oscil',
  'oscili',
  'oscil3',
  'poscil',
  'poscil3',
  'vco2',
  // Envelopes & lines
  'line',
  'linseg',
  'linsegr',
  'expseg',
  'expsegr',
  'expon',
  'linen',
  'linenr',
  'adsr',
  'madsr',
  // Tables & phasors
  'phasor',
  'table',
  'tablei',
  'table3',
  // Math & pitch/amplitude conversions
  'ampdb',
  'ampdbfs',
  'cpspch',
  'cpsoct',
  'cpsmidinn',
  'mtof',
  'dbamp',
  'abs',
  'int',
  'frac',
  'sqrt',
  'sin',
  'cos',
  'tan',
  'pow',
  'exp',
  'log',
  'limit',
  'min',
  'max',
  // Filters, reverbs, delays, panners
  'butterlp',
  'butterhp',
  'butterbp',
  'butterbr',
  'tone',
  'atone',
  'moogladder',
  'reson',
  'areson',
  'reverb',
  'reverbsc',
  'freeverb',
  'delay',
  'delayr',
  'delayw',
  'deltap',
  'deltapi',
  'pan2',
  // Output, initialization, clearing
  'out',
  'outs',
  'outch',
  'outc',
  'init',
  'clear',
]);

/** Opcodes/prefixes blocked even if referenced as bare tokens in expressions. */
const BLOCKED_CSOUND_IDENTIFIERS_PATTERN =
  /^(?:fout.*|system.*|ftsave.*|soundin|diskin.*|py.*|osc(?:init|listen|send|raw|count|bundle).*|chn.*|event.*|schedule.*|scoreline.*|readk.*|dumpk.*|fprint.*|printf.*|prints.*|puts|strcpy|strset|strget|fiopen|ficlose|fin|fini|fink|compileorc|compilestr|evalstr|readscore|ftgen|opcode|endop|zakinit|zkr|zkcl)$/i;

const SAFE_SCORE_GEN_ROUTINES = new Set([2, 5, 7, 9, 10, 11, 13, 14, 15, 19, 20]);

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const NUMBER_TOKEN_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const SIGNED_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export type WavFilenameValidationResult =
  | { readonly ok: true; readonly filename: string }
  | { readonly ok: false; readonly message: string };

export type McpRenderEligibilityResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'EXECUTION_REQUIRED' | 'UNSUPPORTED_CONTENT' | 'RESPONSE_TOO_LARGE';
      readonly message: string;
    };

export interface McpRenderStatResult {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  dev: number | bigint;
  ino: number | bigint;
}

export interface McpRenderFsSeam {
  readonly supportsAnchoredContainment?: boolean;
  realpathSync(targetPath: string): string;
  lstatSync(targetPath: string): McpRenderStatResult;
  openSync(targetPath: string, flags: number, mode?: number): number;
  fstatSync(fd: number): McpRenderStatResult;
  fchmodSync?(fd: number, mode: number): void;
  writeFileSync?(targetPath: number | string, data: string, encoding: BufferEncoding): void;
  closeSync(fd: number): void;
  mkdirSync?(targetPath: string, options?: { mode?: number }): void;
  chmodSync?(targetPath: string, mode: number): void;
  linkSync?(existingPath: string, newPath: string): void;
  readdirSync?(targetPath: string): string[];
  unlinkSync?(targetPath: string): void;
  rmdirSync?(targetPath: string): void;
}

export interface AuthorizedRenderRoot {
  readonly requestedPath: string;
  readonly canonicalPath: string;
  readonly pathIdentity: string;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly fd: number | null;
  readonly platform: NodeJS.Platform | string;
  dispose(): void;
}

export interface ConfinedMcpRenderInput {
  readonly data: BlueData;
  readonly expectedReceipt: McpDocumentReceipt;
  readonly getCurrentReceipt: () => McpDocumentReceipt | null;
  readonly auth: McpAuthContext;
  readonly nativeRoot: string;
  readonly authorizedRoot?: AuthorizedRenderRoot;
  readonly filename: string;
  readonly diskRender: DiskRenderSettingsSnapshot;
  readonly messageColorsEnabled: boolean;
  readonly executionSeam: RenderExecutionSeam;
  readonly isCancelled?: () => boolean;
  readonly fsSeam?: McpRenderFsSeam;
  readonly platform?: NodeJS.Platform | string;
}

export interface ConfinedMcpRenderSuccess {
  readonly outputPath: string;
  readonly receipt: McpDocumentReceipt;
}

const defaultFsSeam: McpRenderFsSeam = {
  realpathSync: (targetPath) => fs.realpathSync(targetPath),
  lstatSync: (targetPath) => fs.lstatSync(targetPath, { bigint: true }),
  openSync: (targetPath, flags, mode) => fs.openSync(targetPath, flags, mode),
  fstatSync: (fd) => fs.fstatSync(fd, { bigint: true }),
  closeSync: (fd) => fs.closeSync(fd),
};

const SUPPORTED_CONFINED_PLATFORMS = new Set<string>(['darwin', 'linux', 'win32']);

function toBigIntId(value: number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
}

function statsMatchInode(a: McpRenderStatResult, b: McpRenderStatResult): boolean {
  return toBigIntId(a.dev) === toBigIntId(b.dev) && toBigIntId(a.ino) === toBigIntId(b.ino);
}

function errResult<T>(code: McpDomainErrorCode, message: string): McpResult<T> {
  return { ok: false, code, message };
}

function receiptsMatch(a: McpDocumentReceipt, b: McpDocumentReceipt): boolean {
  return a.documentId === b.documentId && a.revision === b.revision && a.stateId === b.stateId;
}

/**
 * Validate a single WAV leaf filename against POSIX and Windows confinement rules.
 * Rejects path separators, traversal, whitespace padding, trailing dots,
 * control characters, Windows drive/UNC/ADS delimiters, and reserved device names.
 */
export function validateMcpWavFilename(filename: string): WavFilenameValidationResult {
  if (typeof filename !== 'string' || filename.length === 0) {
    return { ok: false, message: 'Output filename must be a non-empty string.' };
  }
  if (filename.length > MAX_FILENAME_LENGTH) {
    return {
      ok: false,
      message: `Output filename must not exceed ${MAX_FILENAME_LENGTH} characters.`,
    };
  }
  if (filename !== filename.trim()) {
    return { ok: false, message: 'Output filename must not have leading or trailing whitespace.' };
  }
  if (filename === '.' || filename === '..') {
    return { ok: false, message: 'Output filename must be a single WAV filename.' };
  }
  if (hasControlChar(filename) || FORBIDDEN_FILENAME_CHARS_PATTERN.test(filename)) {
    return {
      ok: false,
      message:
        'Output filename must be a single leaf name without path separators, colons, or reserved characters.',
    };
  }
  if (filename.endsWith('.')) {
    return { ok: false, message: 'Output filename must not end with a trailing dot.' };
  }
  if (!filename.toLowerCase().endsWith('.wav')) {
    return { ok: false, message: 'Output filename must end with ".wav".' };
  }
  const stem = filename.slice(0, -4);
  if (stem.length === 0) {
    return { ok: false, message: 'Output filename must include a non-empty name before ".wav".' };
  }
  const baseBeforeDot = filename.split('.')[0] ?? '';
  if (WINDOWS_RESERVED_DEVICE_PATTERN.test(baseBeforeDot)) {
    return {
      ok: false,
      message: `Output filename "${filename}" uses a reserved Windows device name.`,
    };
  }
  return { ok: true, filename };
}

function stripCsoundComments(
  text: string,
): { ok: true; text: string } | { ok: false; message: string } {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const ch = text[index]!;
    const next = text[index + 1];
    if (ch === '/' && next === '*') {
      const closeIndex = text.indexOf('*/', index + 2);
      if (closeIndex < 0) {
        return { ok: false, message: 'Unclosed block comment in generated CSD.' };
      }
      // Preserve newlines inside block comments so line boundaries remain intact.
      const commentBody = text.slice(index, closeIndex + 2);
      for (let i = 0; i < commentBody.length; i++) {
        if (commentBody[i] === '\n') out += '\n';
      }
      out += ' ';
      index = closeIndex + 2;
      continue;
    }
    if (ch === ';') {
      const newlineIndex = text.indexOf('\n', index + 1);
      if (newlineIndex < 0) {
        break;
      }
      index = newlineIndex;
      continue;
    }
    out += ch;
    index += 1;
  }
  return { ok: true, text: out };
}

type ExprToken =
  | { kind: 'number'; value: string }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'question' }
  | { kind: 'colon' };

function tokenizeCsoundExpr(expr: string): ExprToken[] | null {
  const tokens: ExprToken[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' });
      i += 1;
      continue;
    }
    if (ch === '?') {
      tokens.push({ kind: 'question' });
      i += 1;
      continue;
    }
    if (ch === ':') {
      tokens.push({ kind: 'colon' });
      i += 1;
      continue;
    }
    const twoChar = expr.slice(i, i + 2);
    if (
      twoChar === '==' ||
      twoChar === '!=' ||
      twoChar === '<=' ||
      twoChar === '>=' ||
      twoChar === '&&' ||
      twoChar === '||'
    ) {
      tokens.push({ kind: 'op', value: twoChar });
      i += 2;
      continue;
    }
    if ('+-*/%^<>!'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const rest = expr.slice(i);
      const match = rest.match(/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) return null;
      tokens.push({ kind: 'number', value: match[0] });
      i += match[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const rest = expr.slice(i);
      const match = rest.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (!match) return null;
      tokens.push({ kind: 'ident', value: match[0] });
      i += match[0].length;
      continue;
    }
    return null;
  }
  return tokens;
}

function isValidCsoundExpression(expr: string): boolean {
  const tokens = tokenizeCsoundExpr(expr);
  if (!tokens || tokens.length === 0) return false;

  let parenDepth = 0;
  let ternaryDepth = 0;
  let expectOperand = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1];

    if (token.kind === 'ident') {
      if (!expectOperand) return false;
      if (BLOCKED_CSOUND_IDENTIFIERS_PATTERN.test(token.value)) return false;
      if (next?.kind === 'lparen') {
        if (!VETTED_CSOUND_OPCODES.has(token.value)) {
          return false;
        }
        // Function call: identifier followed by '('
        expectOperand = true;
        continue;
      }
      expectOperand = false;
      continue;
    }

    if (token.kind === 'number') {
      if (!expectOperand || !NUMBER_TOKEN_PATTERN.test(token.value)) return false;
      expectOperand = false;
      continue;
    }

    if (token.kind === 'lparen') {
      if (!expectOperand) return false;
      parenDepth += 1;
      expectOperand = true;
      continue;
    }

    if (token.kind === 'rparen') {
      if (parenDepth === 0) return false;
      // Allow empty arg list only right after '(' if inside call? Vetted functions require >=1 arg.
      if (expectOperand) return false;
      parenDepth -= 1;
      expectOperand = false;
      continue;
    }

    if (token.kind === 'comma') {
      if (parenDepth === 0 || expectOperand) return false;
      expectOperand = true;
      continue;
    }

    if (token.kind === 'question') {
      if (expectOperand) return false;
      ternaryDepth += 1;
      expectOperand = true;
      continue;
    }

    if (token.kind === 'colon') {
      if (expectOperand || ternaryDepth === 0) return false;
      ternaryDepth -= 1;
      expectOperand = true;
      continue;
    }

    if (token.kind === 'op') {
      if (expectOperand) {
        if (token.value === '+' || token.value === '-' || token.value === '!') {
          continue;
        }
        return false;
      }
      expectOperand = true;
    }
  }

  return !expectOperand && parenDepth === 0 && ternaryDepth === 0;
}

function splitTopLevelCommaArgs(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) return null;
    } else if (ch === ',' && depth === 0) {
      args.push(trimmed.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) return null;
  args.push(trimmed.slice(start).trim());
  return args.every((arg) => arg.length > 0) ? args : null;
}

function isValidVarList(text: string): boolean {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return false;
  return parts.every(
    (part) => IDENTIFIER_PATTERN.test(part) && !BLOCKED_CSOUND_IDENTIFIERS_PATTERN.test(part),
  );
}

function isVettedInstrumentStatement(
  line: string,
  state: { inInstr: boolean; currentInstrName: string | null; mixerEnabled: boolean },
): boolean {
  if (!state.inInstr) {
    const instrMatch = line.match(/^instr\s+(.+)$/);
    if (instrMatch) {
      const target = instrMatch[1]!.trim();
      if (target === 'BlueMixer' && state.mixerEnabled) {
        state.inInstr = true;
        state.currentInstrName = 'BlueMixer';
        return true;
      }
      const ids = target.split(',').map((part) => part.trim());
      if (ids.length > 0 && ids.every((id) => /^\d+$/.test(id))) {
        state.inInstr = true;
        state.currentInstrName = ids[0]!;
        return true;
      }
      return false;
    }

    const headerMatch = line.match(/^(sr|ksmps|nchnls|0dbfs)\s*=\s*(.+)$/);
    if (headerMatch && HEADER_DECLARATION_NAMES.has(headerMatch[1]!)) {
      return isValidCsoundExpression(headerMatch[2]!);
    }
  } else {
    if (line === 'endin') {
      state.inInstr = false;
      state.currentInstrName = null;
      return true;
    }
    if (line === 'else' || line === 'endif') {
      return true;
    }
    const ifMatch = line.match(/^(?:if|elseif)\s+(.+?)\s+then$/);
    if (ifMatch) {
      return isValidCsoundExpression(ifMatch[1]!);
    }
    if (
      state.mixerEnabled &&
      state.currentInstrName === 'BlueMixer' &&
      line.startsWith('$BLUE_MIXER_CALC_PAN_GAINS(') &&
      line.endsWith(')')
    ) {
      const inner = line.slice('$BLUE_MIXER_CALC_PAN_GAINS('.length, -1);
      const parts = inner.split("'");
      return parts.length === 5 && parts.every((part) => isValidCsoundExpression(part));
    }
  }

  // Assignment form: var[, var2] (=|+=|-=|*=|/=) expr
  // Avoid matching '==' inside 'if' (already matched above).
  const assignMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_,\s]*?)\s*(\+=|-=|\*=|\/=|=(?!=))\s*(.+)$/);
  if (assignMatch) {
    const lhs = assignMatch[1]!.trim();
    const rhs = assignMatch[3]!.trim();
    if (!isValidVarList(lhs)) return false;
    return isValidCsoundExpression(rhs);
  }

  // Traditional opcode form without outputs: <opcode> [args...]
  const noOutputMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(.*))?$/);
  if (noOutputMatch && VETTED_CSOUND_OPCODES.has(noOutputMatch[1]!)) {
    const argsText = noOutputMatch[2] ?? '';
    const args = splitTopLevelCommaArgs(argsText);
    return args !== null && args.every((arg) => isValidCsoundExpression(arg));
  }

  // Traditional opcode form with outputs: <varList> <opcode> [args...]
  const withOutputMatch = line.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(.*))?$/,
  );
  if (withOutputMatch) {
    const outputs = withOutputMatch[1]!.trim();
    const opcode = withOutputMatch[2]!;
    const argsText = withOutputMatch[3] ?? '';
    if (!isValidVarList(outputs) || !VETTED_CSOUND_OPCODES.has(opcode)) {
      return false;
    }
    const args = splitTopLevelCommaArgs(argsText);
    return args !== null && args.every((arg) => isValidCsoundExpression(arg));
  }

  return false;
}

function isVettedScoreStatement(line: string, mixerEnabled: boolean): boolean {
  if (
    mixerEnabled &&
    /^i"BlueMixer"(?:\s+[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?){2,}$/.test(line)
  ) {
    return true;
  }

  if (line.includes('"') || line.includes('{{') || line.includes('}}') || line.includes('#')) {
    return false;
  }

  // e [optional duration]
  if (line === 'e' || /^e\s+[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(line)) {
    return true;
  }

  // s [optional section args]
  if (line === 's') {
    return true;
  }

  const tokens = line.split(/\s+/);
  const head = tokens[0] ?? '';

  // t <tempo...>
  if (head === 't') {
    return tokens.length >= 2 && tokens.slice(1).every((tok) => SIGNED_NUMBER_PATTERN.test(tok));
  }

  // i<num> ... or i <num> ...
  if (head === 'i' || /^i[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(head)) {
    const numericTokens = head === 'i' ? tokens.slice(1) : [head.slice(1), ...tokens.slice(1)];
    return (
      numericTokens.length >= 3 && numericTokens.every((tok) => SIGNED_NUMBER_PATTERN.test(tok))
    );
  }

  // f<num> p2 p3 p4 ... or f <num> p2 p3 p4 ...
  if (head === 'f' || /^f[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(head)) {
    const numericTokens = head === 'f' ? tokens.slice(1) : [head.slice(1), ...tokens.slice(1)];
    if (
      numericTokens.length < 4 ||
      !numericTokens.every((tok) => SIGNED_NUMBER_PATTERN.test(tok))
    ) {
      return false;
    }
    const genNumber = Number(numericTokens[3]!);
    if (!Number.isInteger(genNumber)) return false;
    return SAFE_SCORE_GEN_ROUTINES.has(Math.abs(genNumber));
  }

  return false;
}

function containsUnvettedUserDirectivesOrStrings(text: string): boolean {
  const stripped = stripCsoundComments(text);
  if (!stripped.ok) return true;
  return /[#"{}\\]|\}\}/.test(stripped.text) || stripped.text.includes('$');
}

function checkModelEligibility(
  data: BlueData,
  diskRender: DiskRenderSettingsSnapshot,
): McpRenderEligibilityResult {
  const preflight = preflightObservationOnlyDiskCsd(data);
  if (!preflight.ok) {
    return preflight;
  }

  const props = data.getProjectProperties();
  if (
    props.diskCompleteOverride ||
    props.diskAdvancedSettings.trim().length > 0 ||
    props.diskCommandLine.trim().length > 0
  ) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message:
        'MCP render refuses projects with diskCompleteOverride, diskAdvancedSettings, or diskCommandLine.',
    };
  }

  try {
    planVettedMcpDiskCommand({
      diskRender,
      props,
      outputFile: 'probe.wav',
      messageColorsEnabled: true,
    });
  } catch (error) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (data.getOpcodeList().getOpcodes().length > 0) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message: 'MCP render refuses projects with user-defined opcodes.',
    };
  }

  const mixer = data.getMixer();
  if (mixer.isEnabled()) {
    const channels = [
      ...mixer.getAllSourceChannels(),
      ...mixer.getSubChannels(),
      mixer.getMaster(),
    ];
    for (const channel of channels) {
      for (const chain of [
        channel.getPreEffects(),
        channel.getPostEffects(),
        channel.getEffectsChain(),
      ]) {
        for (const item of chain) {
          if (item instanceof Effect && item.isEnabled()) {
            return {
              ok: false,
              code: 'UNSUPPORTED_CONTENT',
              message: 'MCP render refuses projects with enabled mixer effects.',
            };
          }
        }
      }
    }
  }

  const globalOrcSco = data.getGlobalOrcSco();
  if (
    containsUnvettedUserDirectivesOrStrings(globalOrcSco.getGlobalOrc()) ||
    containsUnvettedUserDirectivesOrStrings(globalOrcSco.getGlobalSco()) ||
    containsUnvettedUserDirectivesOrStrings(data.getTableSet().getTables())
  ) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message:
        'MCP render refuses global orchestra/score/tables containing preprocessor directives or string literals.',
    };
  }

  for (const assignment of data.getArrangement().getArrangement()) {
    if (!assignment.enabled) continue;
    if (!(assignment.instr instanceof GenericInstrument)) {
      return {
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
        message: 'MCP render requires all enabled arrangement instruments to be GenericInstrument.',
      };
    }
    if (assignment.instr.getOpcodeList().getOpcodes().length > 0) {
      return {
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
        message: 'MCP render refuses instruments with user-defined opcodes.',
      };
    }
    if (
      containsUnvettedUserDirectivesOrStrings(assignment.instr.getText()) ||
      containsUnvettedUserDirectivesOrStrings(assignment.instr.getGlobalOrc()) ||
      containsUnvettedUserDirectivesOrStrings(assignment.instr.getGlobalSco())
    ) {
      return {
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
        message:
          'MCP render refuses instrument code containing preprocessor directives or string literals.',
      };
    }
  }

  const checkChain = (chain: NoteProcessorChain | null | undefined): McpRenderEligibilityResult => {
    if (!chain) return { ok: true };
    for (const processor of chain.getProcessors()) {
      if (processor instanceof PythonProcessor) {
        return {
          ok: false,
          code: 'EXECUTION_REQUIRED',
          message: 'MCP render refuses PythonProcessor in note processor chains.',
        };
      }
      if (processor instanceof TuningProcessor && processor.getScaleReference()) {
        return {
          ok: false,
          code: 'UNSUPPORTED_CONTENT',
          message: 'MCP render refuses TuningProcessor referencing external scale files.',
        };
      }
    }
    if (createNoteProcessorChainSnapshot(chain).hasUnsupportedProcessors) {
      return {
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
        message: 'MCP render refuses unsupported note processors.',
      };
    }
    return { ok: true };
  };

  const checkScoreObject = (value: unknown, seen: Set<object>): McpRenderEligibilityResult => {
    if (!value || typeof value !== 'object' || seen.has(value)) return { ok: true };
    seen.add(value);

    if ('getNoteProcessorChain' in value && typeof value.getNoteProcessorChain === 'function') {
      const chainResult = checkChain(value.getNoteProcessorChain() as NoteProcessorChain);
      if (!chainResult.ok) return chainResult;
    }

    if (
      value instanceof PythonObject ||
      value instanceof JavaScriptObject ||
      value instanceof ClojureObject ||
      value instanceof External ||
      value instanceof ObjectBuilder ||
      ('isOnLoadProcessable' in value &&
        typeof value.isOnLoadProcessable === 'function' &&
        value.isOnLoadProcessable())
    ) {
      return {
        ok: false,
        code: 'EXECUTION_REQUIRED',
        message: 'MCP render refuses scripted or external score objects.',
      };
    }

    if (value instanceof GenericScore) {
      if (containsUnvettedUserDirectivesOrStrings(value.getScoreText())) {
        return {
          ok: false,
          code: 'UNSUPPORTED_CONTENT',
          message:
            'MCP render refuses GenericScore text containing preprocessor directives or string literals.',
        };
      }
      return { ok: true };
    }

    if (value instanceof Comment) {
      return { ok: true };
    }

    if (value instanceof PolyObject) {
      for (const layer of value) {
        const layerChain = checkChain(layer.getNoteProcessorChain());
        if (!layerChain.ok) return layerChain;
        for (const child of layer) {
          const childRes = checkScoreObject(child, seen);
          if (!childRes.ok) return childRes;
        }
      }
      return { ok: true };
    }

    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message: `MCP render supports only GenericScore, Comment, and PolyObject (found ${value.constructor?.name || 'unknown'}).`,
    };
  };

  const checkAuxiliaryObject = (value: unknown, seen: Set<object>): McpRenderEligibilityResult => {
    if (!value || typeof value !== 'object' || seen.has(value)) return { ok: true };
    seen.add(value);

    if ('getNoteProcessorChain' in value && typeof value.getNoteProcessorChain === 'function') {
      const chainResult = checkChain(value.getNoteProcessorChain() as NoteProcessorChain);
      if (!chainResult.ok) return chainResult;
    }

    if (
      value instanceof PythonObject ||
      value instanceof JavaScriptObject ||
      value instanceof ClojureObject ||
      value instanceof External ||
      value instanceof ObjectBuilder ||
      ('isOnLoadProcessable' in value &&
        typeof value.isOnLoadProcessable === 'function' &&
        value.isOnLoadProcessable())
    ) {
      return {
        ok: false,
        code: 'EXECUTION_REQUIRED',
        message: 'MCP render refuses scripted or runtime-backed library/live objects.',
      };
    }

    if (
      value instanceof AudioClip ||
      value instanceof AudioFile ||
      value instanceof FrozenSoundObject
    ) {
      return {
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
        message: 'MCP render refuses audio or frozen objects in library or live bins.',
      };
    }

    if (value instanceof PolyObject) {
      for (const layer of value) {
        const layerChain = checkChain(layer.getNoteProcessorChain());
        if (!layerChain.ok) return layerChain;
        for (const child of layer) {
          const childRes = checkAuxiliaryObject(child, seen);
          if (!childRes.ok) return childRes;
        }
      }
    } else if (value instanceof Instance) {
      return checkAuxiliaryObject(value.getSoundObject(), seen);
    }

    return { ok: true };
  };

  const seenScore = new Set<object>();
  const score = data.getScore();
  const rootChain = checkChain(score.getNoteProcessorChain());
  if (!rootChain.ok) return rootChain;

  for (const group of score) {
    if (group instanceof PolyObject) {
      const res = checkScoreObject(group, seenScore);
      if (!res.ok) return res;
    } else if (group instanceof TrackLayerGroup) {
      const groupChain = checkChain(group.getNoteProcessorChain());
      if (!groupChain.ok) return groupChain;
      for (const track of group) {
        const trackInstr = track.getInstrument();
        if (trackInstr && trackInstr.isEnabled() && !(trackInstr instanceof GenericInstrument)) {
          return {
            ok: false,
            code: 'UNSUPPORTED_CONTENT',
            message: 'MCP render requires track instruments to be GenericInstrument.',
          };
        }
        const trackChain = checkChain(track.getNoteProcessorChain());
        if (!trackChain.ok) return trackChain;
        for (const item of track) {
          const itemRes = checkScoreObject(item, seenScore);
          if (!itemRes.ok) return itemRes;
        }
      }
    } else if (group instanceof PatternsLayerGroup) {
      const groupChain = checkChain(group.getNoteProcessorChain());
      if (!groupChain.ok) return groupChain;
      for (const patternLayer of group) {
        const itemRes = checkScoreObject(patternLayer.getSoundObject(), seenScore);
        if (!itemRes.ok) return itemRes;
      }
    }
  }

  const seenAux = new Set<object>();
  for (const libObj of data.getSoundObjectLibrary().getAllObjects()) {
    const res = checkAuxiliaryObject(libObj, seenAux);
    if (!res.ok) return res;
  }

  const liveBins = data.getLiveData().getLiveObjectBins();
  for (let col = 0; col < liveBins.getColumnCount(); col++) {
    for (let row = 0; row < liveBins.getRowCount(); row++) {
      const res = checkAuxiliaryObject(liveBins.getLiveObject(col, row)?.getSoundObject(), seenAux);
      if (!res.ok) return res;
    }
  }

  return { ok: true };
}

/**
 * Fail-closed capability admission check over both the BlueData model/settings
 * and the generated disk-profile CSD text.
 */
export function verifyMcpRenderEligibility(
  data: BlueData,
  csdText: string,
  diskRender: DiskRenderSettingsSnapshot,
): Extract<McpRenderEligibilityResult, { ok: false }> | { ok: true; csdText: string } {
  const modelResult = checkModelEligibility(data, diskRender);
  if (!modelResult.ok) return modelResult;

  // Disk generation emits only a comment preamble, an orchestra, and a score.
  const envelope =
    /^(?:[ \t]*(?:;[^\r\n]*)?\r?\n)*<CsoundSynthesizer>\s*<CsInstruments>\r?\n([\s\S]*?\n)<\/CsInstruments>\s*<CsScore>\r?\n([\s\S]*?\n)<\/CsScore>\s*<\/CsoundSynthesizer>[ \t\r\n]*(?![\s\S])/;
  const match = envelope.exec(csdText);
  if (!match || /^[ \t]*</m.test(match[1]!) || /^[ \t]*</m.test(match[2]!)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message: 'Generated CSD must contain one orchestra and one score in the Blue disk envelope.',
    };
  }

  const strippedOrc = stripCsoundComments(match[1]!);
  if (!strippedOrc.ok) {
    return { ok: false, code: 'UNSUPPORTED_CONTENT', message: strippedOrc.message };
  }

  const mixerEnabled = data.getMixer().isEnabled();
  let orcText = strippedOrc.text;

  // Allow at most the exact Blue-generated pan-gains macro when the mixer is enabled
  // and user code was already proven free of directives/strings.
  if (mixerEnabled && orcText.includes(BLUE_MIXER_CALC_PAN_GAINS_MACRO)) {
    const firstIdx = orcText.indexOf(BLUE_MIXER_CALC_PAN_GAINS_MACRO);
    orcText =
      orcText.slice(0, firstIdx) + orcText.slice(firstIdx + BLUE_MIXER_CALC_PAN_GAINS_MACRO.length);
  }

  if (/#|"|\{\{|\}\}|\\/.test(orcText)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message:
        'MCP render refuses preprocessor directives, string literals, or line continuations in <CsInstruments>.',
    };
  }

  const orcState = { inInstr: false, currentInstrName: null as string | null, mixerEnabled };
  for (const rawLine of orcText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!isVettedInstrumentStatement(line, orcState)) {
      return {
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
        message: `MCP render rejected unvetted statement in <CsInstruments>: ${line}`,
      };
    }
  }
  if (orcState.inInstr) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message: 'Unclosed instr block in <CsInstruments>.',
    };
  }

  const strippedSco = stripCsoundComments(match[2]!);
  if (!strippedSco.ok) {
    return { ok: false, code: 'UNSUPPORTED_CONTENT', message: strippedSco.message };
  }

  if (/\{\{|\}\}|#|\\/.test(strippedSco.text)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
      message:
        'MCP render refuses preprocessor directives, string blocks, or line continuations in <CsScore>.',
    };
  }

  for (const rawLine of strippedSco.text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!isVettedScoreStatement(line, mixerEnabled)) {
      return {
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
        message: `MCP render rejected unvetted statement in <CsScore>: ${line}`,
      };
    }
  }

  return {
    ok: true,
    // Send only vetted section text. Metadata and section comments never reach Csound.
    csdText:
      '<CsoundSynthesizer>\n<CsInstruments>\n' +
      strippedOrc.text +
      '\n</CsInstruments>\n<CsScore>\n' +
      strippedSco.text +
      '\n</CsScore>\n</CsoundSynthesizer>\n',
  };
}

/**
 * Capture and anchor the identity of an authorized native destination directory
 * when it is resolved or returned by the folder picker, before user confirmation.
 */
export function captureAuthorizedRenderRoot(
  nativeRoot: string,
  options: {
    readonly fsSeam?: McpRenderFsSeam;
    readonly platform?: NodeJS.Platform | string;
  } = {},
): McpResult<AuthorizedRenderRoot> {
  const fsSeam = options.fsSeam ?? defaultFsSeam;
  const platform = options.platform ?? process.platform;
  const pathApi = platform === 'win32' ? path.win32 : path.posix;

  if (!SUPPORTED_CONFINED_PLATFORMS.has(platform) || fsSeam.supportsAnchoredContainment === false) {
    return errResult(
      'OUTPUT_REJECTED',
      'Anchored native directory containment is unavailable on this platform or filesystem.',
    );
  }
  if (!nativeRoot || !pathApi.isAbsolute(nativeRoot)) {
    return errResult(
      'OUTPUT_REJECTED',
      'Render destination root must be an absolute native directory path.',
    );
  }

  const isWin32 = platform === 'win32';
  if (
    !isWin32 &&
    (fs.constants.O_DIRECTORY === undefined || fs.constants.O_NOFOLLOW === undefined)
  ) {
    return errResult(
      'OUTPUT_REJECTED',
      'Platform directory handle flags (O_DIRECTORY/O_NOFOLLOW) are unavailable to prove containment.',
    );
  }

  let canonicalPath: string;
  let initialLstat: McpRenderStatResult;
  try {
    canonicalPath = fsSeam.realpathSync(nativeRoot);
    initialLstat = fsSeam.lstatSync(canonicalPath);
  } catch (error) {
    return errResult(
      'OUTPUT_REJECTED',
      `Render destination directory is inaccessible: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!initialLstat.isDirectory() || initialLstat.isSymbolicLink()) {
    return errResult(
      'OUTPUT_REJECTED',
      'Render destination root must resolve to a real directory.',
    );
  }

  const pathIdentity = canonicalProjectPathIdentity(canonicalPath, platform);
  let fd: number | null = null;
  let authoritativeStat = initialLstat;

  if (!isWin32) {
    try {
      fd = fsSeam.openSync(
        canonicalPath,
        fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW,
      );
      authoritativeStat = fsSeam.fstatSync(fd);
    } catch (error) {
      if (fd !== null) {
        try {
          fsSeam.closeSync(fd);
        } catch {
          // Ignore close error.
        }
      }
      return errResult(
        'OUTPUT_REJECTED',
        `Render destination root cannot be anchored safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!authoritativeStat.isDirectory() || !statsMatchInode(initialLstat, authoritativeStat)) {
      try {
        fsSeam.closeSync(fd);
      } catch {
        // Ignore close error.
      }
      return errResult(
        'OUTPUT_REJECTED',
        'Render destination root changed while anchoring directory handle.',
      );
    }

    try {
      const currentReal = fsSeam.realpathSync(nativeRoot);
      if (canonicalProjectPathIdentity(currentReal, platform) !== pathIdentity) {
        fsSeam.closeSync(fd);
        return errResult(
          'OUTPUT_REJECTED',
          'Render destination root changed while capturing directory identity.',
        );
      }
    } catch (error) {
      try {
        fsSeam.closeSync(fd);
      } catch {
        // Ignore close error.
      }
      return errResult(
        'OUTPUT_REJECTED',
        `Render destination root could not be verified: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  let disposed = false;
  return {
    ok: true,
    value: {
      requestedPath: nativeRoot,
      canonicalPath,
      pathIdentity,
      dev: toBigIntId(authoritativeStat.dev),
      ino: toBigIntId(authoritativeStat.ino),
      fd,
      platform,
      dispose: () => {
        if (disposed || fd === null) return;
        disposed = true;
        try {
          fsSeam.closeSync(fd);
        } catch {
          // Ignore close failure during cleanup.
        }
      },
    },
  };
}

/** Verify that a previously captured directory handle and path identity still match. */
export function verifyAuthorizedRenderRoot(
  root: AuthorizedRenderRoot,
  fsSeam: McpRenderFsSeam = defaultFsSeam,
): boolean {
  if (
    !SUPPORTED_CONFINED_PLATFORMS.has(root.platform) ||
    fsSeam.supportsAnchoredContainment === false
  ) {
    return false;
  }
  try {
    const resolvedRequested = fsSeam.realpathSync(root.requestedPath);
    if (canonicalProjectPathIdentity(resolvedRequested, root.platform) !== root.pathIdentity) {
      return false;
    }
    const currentStat = fsSeam.lstatSync(root.canonicalPath);
    if (
      !currentStat.isDirectory() ||
      currentStat.isSymbolicLink() ||
      toBigIntId(currentStat.dev) !== root.dev ||
      toBigIntId(currentStat.ino) !== root.ino
    ) {
      return false;
    }
    if (root.fd !== null) {
      const fdStat = fsSeam.fstatSync(root.fd);
      if (
        !fdStat.isDirectory() ||
        toBigIntId(fdStat.dev) !== root.dev ||
        toBigIntId(fdStat.ino) !== root.ino
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function stripOutputFlagFromVettedArgs(
  args: readonly string[],
  safeFilename: string,
):
  | { readonly ok: true; readonly args: string[] }
  | { readonly ok: false; readonly message: string } {
  if (args.length < 2 || args[args.length - 2] !== '-o' || args[args.length - 1] !== safeFilename) {
    return {
      ok: false,
      message: 'Vetted disk-render command did not end with expected output target flag.',
    };
  }
  const stripped = args.slice(0, -2);
  if (stripped.some((arg) => arg === '-o' || arg.startsWith('-o'))) {
    return {
      ok: false,
      message: 'Vetted disk-render command contains an unexpected output flag.',
    };
  }
  return { ok: true, args: stripped };
}

/**
 * Execute a confined one-shot WAV render anchored to an authorized native directory
 * using native directory-handle confinement and atomic no-replace publication.
 */
export async function executeConfinedMcpRender(
  input: ConfinedMcpRenderInput,
): Promise<McpResult<ConfinedMcpRenderSuccess>> {
  const fsSeam = input.fsSeam ?? defaultFsSeam;
  const platform = input.platform ?? input.authorizedRoot?.platform ?? process.platform;
  const pathApi = platform === 'win32' ? path.win32 : path.posix;

  const checkGate = (): McpResult<true> => {
    if (input.isCancelled?.() || input.auth.signal.aborted) {
      return errResult('CANCELLED', 'The MCP render request was cancelled.');
    }
    if (
      !input.auth.isAuthorized() ||
      input.auth.accessMode !== 'read-write' ||
      input.auth.action !== 'runtime'
    ) {
      return errResult(
        'ACCESS_DENIED',
        'MCP authorization is missing or read-write access is disabled.',
      );
    }
    const currentReceipt = input.getCurrentReceipt();
    if (!currentReceipt || !receiptsMatch(currentReceipt, input.expectedReceipt)) {
      return errResult(
        'CONFLICT',
        'The active project changed before render completed. Reread the receipt and retry.',
      );
    }
    return { ok: true, value: true };
  };

  const initialGate = checkGate();
  if (!initialGate.ok) return initialGate;

  const filenameResult = validateMcpWavFilename(input.filename);
  if (!filenameResult.ok) {
    return errResult('OUTPUT_REJECTED', filenameResult.message);
  }
  const safeFilename = filenameResult.filename;

  const preflight = preflightObservationOnlyDiskCsd(input.data);
  if (!preflight.ok) {
    return errResult(preflight.code, preflight.message);
  }

  let csdText: string;
  try {
    csdText = input.data.historyCopy().toDiskCSD(undefined, null);
  } catch (error) {
    return errResult('UNSUPPORTED_CONTENT', error instanceof Error ? error.message : String(error));
  }

  const midGate = checkGate();
  if (!midGate.ok) return midGate;

  const eligibility = verifyMcpRenderEligibility(input.data, csdText, input.diskRender);
  if (!eligibility.ok) {
    return errResult(eligibility.code, eligibility.message);
  }

  if (!SUPPORTED_CONFINED_PLATFORMS.has(platform) || fsSeam.supportsAnchoredContainment === false) {
    return errResult(
      'OUTPUT_REJECTED',
      'Anchored native directory containment is unavailable for MCP render.',
    );
  }

  if (typeof input.executionSeam.runConfinedCsound !== 'function') {
    return errResult('OUTPUT_REJECTED', 'Native directory-anchored render runner is unavailable.');
  }

  let plan;
  try {
    plan = planVettedMcpDiskCommand({
      diskRender: input.diskRender,
      props: input.data.getProjectProperties(),
      outputFile: safeFilename,
      messageColorsEnabled: input.messageColorsEnabled,
    });
  } catch (error) {
    return errResult('UNSUPPORTED_CONTENT', error instanceof Error ? error.message : String(error));
  }

  const strippedArgs = stripOutputFlagFromVettedArgs(plan.args, safeFilename);
  if (!strippedArgs.ok) {
    return errResult('UNSUPPORTED_CONTENT', strippedArgs.message);
  }

  const ownsCapturedRoot = !input.authorizedRoot;
  let activeRoot: AuthorizedRenderRoot;
  if (input.authorizedRoot) {
    activeRoot = input.authorizedRoot;
  } else {
    const captured = captureAuthorizedRenderRoot(input.nativeRoot, { fsSeam, platform });
    if (!captured.ok) return captured;
    activeRoot = captured.value;
  }

  try {
    if (!verifyAuthorizedRenderRoot(activeRoot, fsSeam)) {
      return errResult(
        'OUTPUT_REJECTED',
        'Render destination directory changed after authorization and before dispatch.',
      );
    }

    const finalTargetPath = pathApi.join(activeRoot.canonicalPath, safeFilename);

    // Pre-check before launching Csound so existing targets fail before audio work starts.
    try {
      fsSeam.lstatSync(finalTargetPath);
      return errResult(
        'OUTPUT_REJECTED',
        `Output file "${safeFilename}" already exists and will not be overwritten.`,
      );
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException | undefined)?.code;
      if (errCode !== 'ENOENT') {
        return errResult(
          'OUTPUT_REJECTED',
          `Cannot verify destination path "${safeFilename}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const preDispatchGate = checkGate();
    if (!preDispatchGate.ok) return preDispatchGate;

    if (!verifyAuthorizedRenderRoot(activeRoot, fsSeam)) {
      return errResult(
        'OUTPUT_REJECTED',
        'Render destination directory changed before Csound dispatch.',
      );
    }

    const totalDuration = estimateTotalScoreDuration(eligibility.csdText);
    const checkEffect = (effect: string): ReturnType<ConfinedCsoundRunRequest['beforeLaunch']> => {
      const launchGate = checkGate();
      if (!launchGate.ok) return launchGate;
      if (!verifyAuthorizedRenderRoot(activeRoot, fsSeam)) {
        return {
          ok: false,
          code: 'OUTPUT_REJECTED',
          message: `Render destination directory changed before ${effect}.`,
        };
      }
      return { ok: true };
    };
    const confinedRequest: ConfinedCsoundRunRequest = {
      rootPath: activeRoot.canonicalPath,
      rootDev: activeRoot.dev.toString(),
      rootIno: activeRoot.ino.toString(),
      outputFilename: safeFilename,
      csdText: eligibility.csdText,
      args: strippedArgs.args,
      totalDuration,
      beforeLaunch: () => checkEffect('native engine launch'),
      beforePublish: () => checkEffect('WAV publication'),
    };

    let runResult: {
      exitCode: number;
      stderr: string;
      stdout?: string;
      cancelled?: boolean;
      errorCode?: string | null;
      message?: string;
    };
    try {
      runResult = await input.executionSeam.runConfinedCsound(confinedRequest);
    } catch (error) {
      return errResult(
        'ENGINE_UNAVAILABLE',
        `Could not run Csound: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (
      runResult.errorCode === 'CANCELLED' ||
      runResult.errorCode === 'CSOUND_EXECUTION_CANCELLED' ||
      runResult.cancelled
    ) {
      return errResult('CANCELLED', runResult.stderr || 'The MCP render request was cancelled.');
    }

    if (
      runResult.errorCode === 'ACCESS_DENIED' ||
      runResult.errorCode === 'CONFLICT' ||
      runResult.errorCode === 'OUTPUT_REJECTED' ||
      runResult.errorCode === 'NO_ACTIVE_PROJECT' ||
      runResult.errorCode === 'BUSY' ||
      runResult.errorCode === 'UNSUPPORTED_CONTENT'
    ) {
      return errResult(
        runResult.errorCode,
        runResult.stderr || runResult.message || 'The MCP render request could not proceed.',
      );
    }

    if (
      runResult.errorCode === 'ENGINE_CAPABILITY_MISSING' ||
      runResult.errorCode === 'CSOUND_EXECUTION_INVALID_CWD'
    ) {
      return errResult(
        'OUTPUT_REJECTED',
        runResult.stderr ||
          'Blue Engine cannot satisfy confined directory-anchored rendering for this destination.',
      );
    }

    if (
      runResult.errorCode === 'CSOUND_UNAVAILABLE' ||
      (typeof runResult.errorCode === 'string' && runResult.errorCode.startsWith('ENGINE_'))
    ) {
      return errResult('ENGINE_UNAVAILABLE', runResult.stderr || 'Csound engine is unavailable.');
    }

    if (runResult.exitCode !== 0) {
      return errResult(
        'OUTPUT_REJECTED',
        `Csound exited with code ${runResult.exitCode}. ${runResult.stderr}`.trim(),
      );
    }

    // The coordinator has completed native no-replace publication.
    return {
      ok: true,
      value: {
        outputPath: finalTargetPath,
        receipt: input.expectedReceipt,
      },
    };
  } finally {
    if (ownsCapturedRoot) {
      activeRoot.dispose();
    }
  }
}
