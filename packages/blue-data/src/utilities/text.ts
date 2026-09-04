/**
 * Text utilities — string utility functions.
 * Mirrors the Java TextUtilities class.
 */

/**
 * Replace all occurrences of a search string with a replacement string.
 * Simpler and more reliable than regex for literal string replacement.
 */
export function replaceAll(input: string, search: string, replacement: string): string {
  return input.split(search).join(replacement);
}

/**
 * Replace opcode names using Java-compatible whitespace boundary matching.
 * Mirrors TextUtilities.replaceOpcodeNames().
 */
export function replaceOpcodeNames(replacementValues: Map<string, string>, input: string): string {
  let output = input;

  for (const [from, to] of replacementValues) {
    if (!from || from === to) {
      continue;
    }

    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|\\s)${escaped}($|\\s)`, 'g');
    output = output.replace(pattern, `$1${to}$2`);
  }

  return output;
}

/**
 * Strip a single-line comment from a string.
 * Removes everything from // or ; to end of line.
 */
export function stripSingleLineComments(line: string): string {
  const doubleSlashIdx = line.indexOf('//');
  const semicolonIdx = line.indexOf(';');

  let idx = -1;
  if (doubleSlashIdx !== -1) {
    idx = doubleSlashIdx;
  }
  if (semicolonIdx !== -1 && (idx === -1 || semicolonIdx < idx)) {
    idx = semicolonIdx;
  }

  if (idx === -1) return line;
  return line.substring(0, idx);
}

/**
 * Strip block comments from a string.
 * Removes /* ... * / blocks.
 */
export function stripBlockComments(input: string): string {
  let result = '';
  let inBlock = false;
  let i = 0;

  while (i < input.length) {
    if (!inBlock && input[i] === '/' && input[i + 1] === '*') {
      inBlock = true;
      i += 2;
      continue;
    }
    if (inBlock && input[i] === '*' && input[i + 1] === '/') {
      inBlock = false;
      i += 2;
      continue;
    }
    if (!inBlock) {
      result += input[i];
    }
    i++;
  }

  return result;
}
