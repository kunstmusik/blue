/**
 * UDO type utilities — pure functions for UDO type normalization and formatting.
 * Extracted from UDOUtilities to avoid circular dependencies with OpcodeDefinition.
 * Mirrors the Java UDOUtilities class.
 */

// ─── Normalization ───

export function normalizeModernOutTypes(outTypes: string | null): string {
  if (outTypes == null) return '';
  const trimmed = outTypes.trim();
  if (trimmed === '' || trimmed === '0' || trimmed === 'void' || trimmed === '()') return '';
  return trimmed;
}

export function normalizeClassicOutTypes(outTypes: string | null): string {
  if (outTypes == null) return '0';
  const trimmed = outTypes.trim();
  if (trimmed === '' || trimmed === 'void') return '0';
  return trimmed;
}

export function normalizeModernOutTypesForComparison(outTypes: string): string {
  let trimmed = normalizeModernOutTypes(outTypes);
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  }
  return trimmed.replaceAll(/\s*,\s*/g, ',');
}

export function getModernOutTypesDisplay(outTypes: string): string {
  const trimmed = normalizeModernOutTypes(outTypes);
  return trimmed.length === 0 ? 'void' : trimmed;
}

export function getModernOutputSignature(outTypes: string): string {
  const trimmed = normalizeModernOutTypes(outTypes);
  if (trimmed.length === 0) return 'void';
  const tokens = parseTypeTokens(trimmed);
  if (tokens.length === 0) return trimmed;
  if (tokens.length === 1) return tokens[0];
  return `(${tokens.join(',')})`;
}

// ─── Type Token Parsing ───

function isTypeTokenStart(ch: string): boolean {
  return (
    ch === 'a' || ch === 'k' || ch === 'i' || ch === 'S' || ch === 'f' || ch === 'o' || ch === 'j'
  );
}

function normalizeTypeToken(typeToken: string): string {
  const trimmed = typeToken.trim();
  if (trimmed === '' || trimmed === '0') return '';
  if (trimmed.endsWith('[]') && trimmed.length >= 3) {
    return trimmed.substring(0, trimmed.length - 2) + '[]';
  }
  return trimmed;
}

export function parseTypeTokens(typeSpec: string | null): string[] {
  const typeTokens: string[] = [];
  if (typeSpec == null) return typeTokens;

  const trimmedSpec = typeSpec.trim();
  if (trimmedSpec === '' || trimmedSpec === '0') return typeTokens;

  if (trimmedSpec.startsWith('(') && trimmedSpec.endsWith(')')) {
    for (const part of splitCommaSeparated(trimmedSpec.substring(1, trimmedSpec.length - 1))) {
      const normalized = normalizeTypeToken(part);
      if (normalized.length > 0) {
        typeTokens.push(normalized);
      }
    }
    return typeTokens;
  }

  let index = 0;
  while (index < trimmedSpec.length) {
    const currentChar = trimmedSpec[index];
    if (
      /\s/.test(currentChar) ||
      currentChar === ',' ||
      currentChar === '(' ||
      currentChar === ')'
    ) {
      index++;
      continue;
    }

    if (isTypeTokenStart(currentChar)) {
      if (
        index + 2 < trimmedSpec.length &&
        trimmedSpec[index + 1] === '[' &&
        trimmedSpec[index + 2] === ']'
      ) {
        typeTokens.push(currentChar + '[]');
        index += 3;
      } else {
        typeTokens.push(currentChar);
        index++;
      }
    } else {
      index++;
    }
  }

  return typeTokens;
}

// ─── Comma Separation (depth-aware) ───

export function splitCommaSeparated(text: string | null): string[] {
  const values: string[] = [];
  if (!text || text.trim().length === 0) return values;

  let currentValue = '';
  let parenthesisDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenthesisDepth++;
    else if (ch === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);

    if (ch === ',' && parenthesisDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      const value = currentValue.trim();
      if (value.length > 0) values.push(value);
      currentValue = '';
    } else {
      currentValue += ch;
    }
  }

  const value = currentValue.trim();
  if (value.length > 0) values.push(value);

  return values;
}

// ─── Out Type Conversions ───

export function joinedOutTypesToCommaSeparated(joinedTypes: string): string {
  const trimmed = normalizeClassicOutTypes(joinedTypes);
  if (trimmed === '0') return '';
  const tokens = parseTypeTokens(trimmed);
  if (tokens.length === 0) return '';
  return tokens.join(', ');
}

export function commaSeparatedOutTypesToJoined(commaSeparated: string): string {
  const trimmed = commaSeparated.trim();
  if (trimmed === 'void' || trimmed === '0') return '0';
  const tokens = parseTypeTokens(trimmed);
  return tokens.length === 0 ? '0' : tokens.join('');
}

// ─── Input Argument Utilities ───

function isVariableRatePrefix(prefix: string): boolean {
  return prefix === 'a' || prefix === 'k' || prefix === 'i' || prefix === 'S' || prefix === 'f';
}

function mapClassicInputTypeToVariablePrefix(inputType: string): string {
  if (inputType === 'o' || inputType === 'j') return 'k';
  return inputType;
}

function getTypeTokenFromInputArgument(inputArgument: string): string {
  let token = inputArgument.trim();
  const equalsIndex = token.indexOf('=');
  if (equalsIndex >= 0) {
    token = token.substring(0, equalsIndex).trim();
  }

  const spaceIndex = token.lastIndexOf(' ');
  if (spaceIndex >= 0) {
    token = token.substring(spaceIndex + 1).trim();
  }

  const colonIndex = token.lastIndexOf(':');
  if (colonIndex >= 0 && colonIndex < token.length - 1) {
    return normalizeTypeToken(token.substring(colonIndex + 1));
  }

  const arrayType = token.endsWith('[]');
  if (arrayType) {
    token = token.substring(0, token.length - 2).trim();
  }

  if (token.length === 0) return '';

  const prefix = token[0];
  if (!isVariableRatePrefix(prefix)) return '';

  return prefix + (arrayType ? '[]' : '');
}

export function getInTypesFromInputArguments(inputArguments: string | null): string {
  if (!inputArguments || inputArguments.trim().length === 0) return '';

  let result = '';
  for (const inputArgument of splitCommaSeparated(inputArguments)) {
    const typeToken = getTypeTokenFromInputArgument(inputArgument);
    if (typeToken.length === 0) return '';
    result += typeToken;
  }
  return result;
}

export function getInputArgumentsFromCodeBody(codeBody: string): string {
  for (const line of codeBody.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(.*?)\bxin\b\s*$/);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

export function removeXinLines(codeBody: string): string {
  const lines: string[] = [];
  for (const line of codeBody.split('\n')) {
    const trimmed = line.trim();
    if (!/\bxin\b\s*$/.test(trimmed)) {
      lines.push(line);
    }
  }
  return lines.join('\n');
}

export function stripTypeAnnotations(inputArguments: string): string {
  const variableNames: string[] = [];
  for (const inputArgument of splitCommaSeparated(inputArguments)) {
    let argument = inputArgument.trim();
    const equalsIndex = argument.indexOf('=');
    if (equalsIndex >= 0) {
      argument = argument.substring(0, equalsIndex).trim();
    }
    const colonIndex = argument.lastIndexOf(':');
    if (colonIndex >= 0) {
      argument = argument.substring(0, colonIndex).trim();
    }
    variableNames.push(argument);
  }
  return variableNames.join(', ');
}

export function applyLegacyTypeAnnotations(inputArguments: string, inTypes: string): string {
  const arguments_ = splitCommaSeparated(inputArguments);
  const typeTokens = parseTypeTokens(inTypes);

  if (arguments_.length !== typeTokens.length) return inputArguments;

  const annotated: string[] = [];
  for (let i = 0; i < arguments_.length; i++) {
    const argument = arguments_[i].trim();
    const typeToken = typeTokens[i];
    if (argument.length === 0) return inputArguments;

    if (needsAnnotation(argument, typeToken)) {
      annotated.push(argument + ':' + typeToken);
    } else {
      annotated.push(argument);
    }
  }

  return annotated.join(', ');
}

function needsAnnotation(inputArgument: string, typeToken: string): boolean {
  if (!typeToken || typeToken.trim().length === 0) return false;
  const normalized = normalizeTypeToken(typeToken);
  if (normalized.length === 0) return false;
  const derived = getTypeTokenFromInputArgument(inputArgument);
  return normalized !== derived;
}

function requiresTypeAnnotation(typeToken: string, generatedPrefix: string): boolean {
  const normalized = normalizeTypeToken(typeToken);
  if (normalized.length === 0) return false;
  const expected = generatedPrefix + (normalized.endsWith('[]') ? '[]' : '');
  return normalized !== expected;
}

export function getInputArgumentsFromTypeString(inTypes: string): string {
  const typeTokens = parseTypeTokens(inTypes);
  const args: string[] = [];

  for (let i = 0; i < typeTokens.length; i++) {
    if (i > 0) args.push(', ');

    const typeToken = typeTokens[i];
    const baseType = typeToken.startsWith('S')
      ? 'S'
      : mapClassicInputTypeToVariablePrefix(typeToken[0]);

    args.push(`${baseType}In${i + 1}`);

    if (requiresTypeAnnotation(typeToken, baseType)) {
      args.push(`:${typeToken}`);
    }

    if (typeToken.endsWith('[]')) {
      if (!requiresTypeAnnotation(typeToken, baseType)) {
        args.push('[]');
      }
    }
  }

  return args.join('');
}

export function trimLeadingBlankLines(source: string): string {
  let result = source;
  while (result.startsWith('\n')) {
    result = result.substring(1);
  }
  return result;
}

/**
 * Parse modern output types from a signature string.
 * "void"/"0"/"" → "", "(a,k)" → "a, k", "a" → "a"
 */
export function getModernOutTypesFromSignature(outputSignature: string): string {
  const trimmed = outputSignature.trim();
  if (trimmed === 'void' || trimmed === '0' || trimmed === '') return '';
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return normalizeModernOutTypes(trimmed.substring(1, trimmed.length - 1).trim());
  }
  return trimmed;
}

// ─── Callable Signature Normalization ───

/**
 * Lightweight authored UDO definition accepted by the completion adapter.
 * Mirrors the field subset of {@link UdoCompletionDefinition} that completion
 * needs; code and comments are deliberately excluded.
 */
export interface UdoCallableSignatureInput {
  name: string;
  style: 'CLASSIC' | 'MODERN';
  outTypes: string;
  /** Classic-style input declaration; empty for modern style. */
  inTypes: string;
  /** Modern-style input declaration; empty for classic style. */
  inputArguments: string;
}

/**
 * Stable callable-signature identity independent of declaration formatting.
 * Used to distinguish UDO overloads and resolve exact cross-source duplicates.
 */
export interface NormalizedUdoCallableSignature {
  /** Authored, case-sensitive UDO name. */
  readonly name: string;
  /** Ordered normalized input type tokens. */
  readonly inputTypes: readonly string[];
  /** Ordered normalized output type tokens. */
  readonly outputTypes: readonly string[];
  /** False when any required type cannot yet be derived from the declaration. */
  readonly complete: boolean;
  /** Comma-separated input display, or `void` for an empty list. */
  readonly inputDisplay: string;
  /** Comma-separated output display, or `void` for an empty list. */
  readonly outputDisplay: string;
  /**
   * Deterministic signature comparison key made from completeness plus ordered
   * output and input tokens. Excludes the name so equivalent callable
   * signatures compare equal regardless of authored name.
   */
  readonly key: string;
  /**
   * Deterministic identity key combining the authored name and the signature
   * key. Two UDOs share an identity only when their names and callable
   * signatures are equivalent.
   */
  readonly identityKey: string;
}

const VOID_DISPLAY = 'void';

function formatTypeDisplay(tokens: readonly string[]): string {
  return tokens.length === 0 ? VOID_DISPLAY : tokens.join(', ');
}

interface ParsedCallableTypeList {
  readonly tokens: readonly string[];
  readonly complete: boolean;
}

/**
 * Parse only valid callable type tokens. Unlike the permissive public
 * parseTypeTokens helper, this parser must not mine valid-looking characters
 * out of an unfinished word such as "pending".
 */
function parseCallableTypeList(
  typeSpec: string | null,
  noValueAliases: readonly string[],
): ParsedCallableTypeList {
  const trimmed = typeSpec?.trim() ?? '';
  if (noValueAliases.includes(trimmed.toLowerCase())) {
    return { tokens: [], complete: true };
  }

  const tokens: string[] = [];
  let segmentTokens: string[] = [];
  let segmentValid = true;
  let complete = true;
  let parenthesisDepth = 0;

  const finishSegment = () => {
    if (!segmentValid) {
      complete = false;
    } else {
      tokens.push(...segmentTokens);
    }
    segmentTokens = [];
    segmentValid = true;
  };

  for (let index = 0; index < trimmed.length; index += 1) {
    const ch = trimmed[index];
    if (/\s/.test(ch) || ch === ',') {
      finishSegment();
      continue;
    }
    if (ch === '(' || ch === ')') {
      finishSegment();
      if (ch === '(') {
        parenthesisDepth += 1;
      } else if (parenthesisDepth === 0) {
        complete = false;
      } else {
        parenthesisDepth -= 1;
      }
      continue;
    }
    if (!isTypeTokenStart(ch)) {
      segmentValid = false;
      continue;
    }

    if (trimmed[index + 1] === '[') {
      if (trimmed[index + 2] === ']') {
        segmentTokens.push(`${ch}[]`);
        index += 2;
      } else {
        segmentValid = false;
      }
      continue;
    }
    segmentTokens.push(ch);
  }
  finishSegment();

  if (parenthesisDepth !== 0 || tokens.length === 0) {
    complete = false;
  }
  return { tokens, complete };
}

/**
 * Normalize a classic or modern UDO declaration into ordered input/output type
 * tokens plus a completeness flag. Normalization ignores insignificant
 * whitespace, separators, grouping parentheses, argument variable names, and
 * default values; uses explicit modern type annotations before rate/type
 * inference; normalizes valid no-output spellings; and preserves semantically
 * meaningful token order and modifiers (arrays, optional-rate markers).
 *
 * A signature is marked incomplete rather than guessed when a required type
 * cannot be derived; incomplete and complete signatures never share an identity.
 */
export function normalizeUdoCallableSignature(
  input: UdoCallableSignatureInput,
): NormalizedUdoCallableSignature {
  const name = input.name;
  const isModern = input.style === 'MODERN';

  // Output tokens: classic and modern share output-type spelling semantics.
  const output = parseCallableTypeList(input.outTypes, ['', '0', 'void', '()']);
  const outputTokens = output.tokens;

  // Input tokens depend on declaration style.
  let inputTokens: readonly string[] = [];
  let complete = output.complete;

  if (isModern) {
    const trimmedArgs = (input.inputArguments ?? '').trim();
    if (trimmedArgs.length === 0) {
      inputTokens = [];
    } else {
      const derived = deriveModernInputTokens(trimmedArgs);
      if (derived === null) {
        // At least one argument could not be resolved; preserve partial tokens
        // for display while marking the signature incomplete.
        inputTokens = deriveModernInputTokensLenient(trimmedArgs);
        complete = false;
      } else {
        inputTokens = derived;
      }
    }
  } else {
    const parsedInputs = parseCallableTypeList(input.inTypes, ['', '0', 'void']);
    inputTokens = parsedInputs.tokens;
    complete = complete && parsedInputs.complete;
  }

  const inputDisplay = formatTypeDisplay(inputTokens);
  const outputDisplay = formatTypeDisplay(outputTokens);
  const key = `${complete ? '1' : '0'}|${outputTokens.join(',')}|${inputTokens.join(',')}`;
  const identityKey = `${name}|${key}`;

  return {
    name,
    inputTypes: inputTokens,
    outputTypes: outputTokens,
    complete,
    inputDisplay,
    outputDisplay,
    key,
    identityKey,
  };
}

/**
 * Derive ordered modern input type tokens from an argument declaration list.
 * Returns `null` when any argument's type cannot be derived (incomplete).
 */
function deriveModernInputTokens(inputArguments: string): readonly string[] | null {
  const tokens: string[] = [];
  for (const argument of splitCommaSeparated(inputArguments)) {
    const token = deriveModernInputToken(argument);
    if (token === null) return null;
    tokens.push(token);
  }
  return tokens;
}

/**
 * Lenient variant used when a signature is already known to be incomplete.
 * Drops arguments whose type cannot be derived so the visible display still
 * shows the derivable prefix; the `complete` flag carries the incompleteness.
 */
function deriveModernInputTokensLenient(inputArguments: string): readonly string[] {
  const tokens: string[] = [];
  for (const argument of splitCommaSeparated(inputArguments)) {
    const token = deriveModernInputToken(argument);
    if (token !== null) {
      tokens.push(token);
    }
  }
  return tokens;
}

function deriveModernInputToken(inputArgument: string): string | null {
  const declaration = inputArgument.split('=', 1)[0]?.trim() ?? '';
  const colonIndex = declaration.lastIndexOf(':');
  if (colonIndex >= 0 && declaration.substring(colonIndex + 1).trim().length === 0) {
    return null;
  }

  const token = getTypeTokenFromInputArgument(inputArgument);
  const parsed = parseCallableTypeList(token, []);
  return parsed.complete && parsed.tokens.length === 1 ? parsed.tokens[0] : null;
}
